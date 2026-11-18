import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const DEFAULT_CHROME_PATH = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/google-chrome';

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export class CDPDriver {
  constructor(options = {}) {
    this.chromePath = options.chromePath || DEFAULT_CHROME_PATH;
    this.headless = options.headless !== false;
    this.chromeProcess = null;
    this.ws = null;
    this.port = null;
    this.userDataDir = null;
    this.msgId = 0;
    this.pendingCallbacks = new Map();
    this.consoleLogs = [];
    this.pageErrors = [];
    this.eventListeners = new Map();
  }

  async launch() {
    this.port = await findAvailablePort();
    this.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-chrome-'));

    const chromeArgs = [
      this.headless ? '--headless=new' : '',
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.userDataDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-breakpad',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio=false',
      '--window-size=1366,768'
    ].filter(Boolean);

    this.chromeProcess = spawn(this.chromePath, chromeArgs, {
      stdio: ['ignore', 'ignore', 'ignore']
    });

    this.chromeProcess.on('error', (err) => {
      console.error('[CDP] Chrome spawn error:', err);
    });

    // Poll for Chrome to initialize DevTools HTTP endpoint
    let wsUrl = null;
    const maxRetries = 40;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(r => setTimeout(r, 150));
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
        if (res.ok) {
          const list = await res.json();
          const pageTarget = list.find(t => t.type === 'page');
          if (pageTarget && pageTarget.webSocketDebuggerUrl) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {
        // Retry
      }
    }

    if (!wsUrl) {
      this.chromeProcess.kill();
      throw new Error(`Failed to connect to Chrome CDP on port ${this.port} after ${maxRetries * 150}ms`);
    }

    // Connect via native WebSocket
    this.ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pendingCallbacks.has(msg.id)) {
          const { resolve, reject } = this.pendingCallbacks.get(msg.id);
          this.pendingCallbacks.delete(msg.id);
          if (msg.error) {
            reject(new Error(`CDP Error in ${msg.error.message} (${JSON.stringify(msg.error)})`));
          } else {
            resolve(msg.result);
          }
        } else if (msg.method) {
          this.handleEvent(msg.method, msg.params);
        }
      } catch (e) {
        console.error('[CDP] Message parse error:', e);
      }
    };

    // Enable essential domains
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
    await this.send('Network.enable');

    // Grant clipboard permissions
    await this.grantClipboardPermissions();

    return this;
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pendingCallbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  handleEvent(method, params) {
    if (method === 'Runtime.consoleAPICalled') {
      const text = params.args ? params.args.map(a => a.value ?? a.description ?? '').join(' ') : '';
      this.consoleLogs.push({
        type: params.type,
        text,
        timestamp: params.timestamp
      });
    } else if (method === 'Runtime.exceptionThrown') {
      const text = params.exceptionDetails?.text || 'Uncaught JS Exception';
      const desc = params.exceptionDetails?.exception?.description || '';
      this.pageErrors.push({ text: `${text}: ${desc}`, details: params.exceptionDetails });
    }

    const listeners = this.eventListeners.get(method) || [];
    for (const listener of listeners) {
      try {
        listener(params);
      } catch (e) {
        console.error(`[CDP] Event listener error for ${method}:`, e);
      }
    }
  }

  on(method, callback) {
    if (!this.eventListeners.has(method)) {
      this.eventListeners.set(method, []);
    }
    this.eventListeners.get(method).push(callback);
  }

  async grantClipboardPermissions() {
    try {
      await this.send('Browser.grantPermissions', {
        permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite']
      });
    } catch (e) {
      // Fallback: grant via evaluate shim if Browser domain not directly bound to page
    }

    // In addition, ensure navigator.clipboard works in headless sandbox
    await this.evaluate(() => {
      if (!window.__clipboardMemory) {
        window.__clipboardMemory = '';
      }
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        navigator.clipboard = {
          writeText: async (text) => {
            window.__clipboardMemory = String(text);
            return text;
          },
          readText: async () => window.__clipboardMemory
        };
      } else {
        const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
        const origRead = navigator.clipboard.readText.bind(navigator.clipboard);
        navigator.clipboard.writeText = async (text) => {
          window.__clipboardMemory = String(text);
          try {
            await origWrite(text);
          } catch (err) {
            // Memory fallback when headless restricts focus
          }
          return text;
        };
        navigator.clipboard.readText = async () => {
          try {
            const val = await origRead();
            if (val) return val;
          } catch (err) {}
          return window.__clipboardMemory;
        };
      }
    });
  }

  async navigate(url, { timeoutMs = 15000 } = {}) {
    this.consoleLogs = [];
    this.pageErrors = [];

    const loadPromise = new Promise((resolve) => {
      const onDOMContentLoaded = () => {
        this.eventListeners.get('Page.domContentEventFired')?.splice(
          this.eventListeners.get('Page.domContentEventFired').indexOf(onDOMContentLoaded), 1
        );
        resolve();
      };
      this.on('Page.domContentEventFired', onDOMContentLoaded);
    });

    await this.send('Page.navigate', { url });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Navigation to ${url} timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    await Promise.race([loadPromise, timeoutPromise]);
    // Small settle delay for script executions and fonts
    await new Promise(r => setTimeout(r, 250));
    await this.grantClipboardPermissions();
  }

  async evaluate(fnOrStr, ...args) {
    let expression;
    if (typeof fnOrStr === 'function') {
      expression = `(${fnOrStr.toString()})(...${JSON.stringify(args)})`;
    } else {
      expression = String(fnOrStr);
    }

    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true
    });

    if (res.exceptionDetails) {
      const text = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`CDP Evaluation Error: ${text}`);
    }

    return res.result?.value;
  }

  async waitForFunction(fnOrStr, { timeoutMs = 6000, pollIntervalMs = 80 } = {}, ...args) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const val = await this.evaluate(fnOrStr, ...args);
        if (val) return val;
      } catch (e) {
        // Retry
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`waitForFunction timed out after ${timeoutMs}ms for expression: ${fnOrStr}`);
  }

  async waitForSelector(selector, { timeoutMs = 6000, visible = false } = {}) {
    return this.waitForFunction((sel, reqVisible) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      if (reqVisible) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
      }
      return true;
    }, { timeoutMs }, selector, visible);
  }

  async click(selector, { timeoutMs = 6000 } = {}) {
    await this.waitForSelector(selector, { timeoutMs });
    return this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Element not found for click: ${sel}`);
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      
      const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
      const pointerUp = new PointerEvent('pointerup', { bubbles: true, cancelable: true });

      el.dispatchEvent(pointerDown);
      el.dispatchEvent(pointerUp);
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'A') {
        el.click();
      } else {
        const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        el.dispatchEvent(click);
      }
      return true;
    }, selector);
  }

  async type(selector, text, { clear = false, timeoutMs = 6000 } = {}) {
    await this.waitForSelector(selector, { timeoutMs });
    return this.evaluate((sel, txt, doClear) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Element not found for typing: ${sel}`);
      el.focus();
      if (doClear) {
        el.value = '';
      }
      el.value = (el.value || '') + String(txt);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    }, selector, text, clear);
  }

  async setInputValue(selector, value) {
    return this.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Element not found: ${sel}`);
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    }, selector, value);
  }

  async getText(selector) {
    return this.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : null;
    }, selector);
  }

  async getAttribute(selector, attr) {
    return this.evaluate((sel, a) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute(a) : null;
    }, selector, attr);
  }

  async hasClass(selector, className) {
    return this.evaluate((sel, cls) => {
      const el = document.querySelector(sel);
      return el ? el.classList.contains(cls) : false;
    }, selector, className);
  }

  async getBoundingBox(selector) {
    return this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right
      };
    }, selector);
  }

  async getComputedStyle(selector, property) {
    return this.evaluate((sel, prop) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue(prop);
    }, selector, property);
  }

  async setViewport({ width, height, deviceScaleFactor = 1, isMobile = false }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: isMobile
    });
    // Trigger resize event in window
    await this.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }

  getConsoleLogs() {
    return [...this.consoleLogs];
  }

  getPageErrors() {
    return [...this.pageErrors];
  }

  async close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
    if (this.chromeProcess) {
      try {
        this.chromeProcess.kill();
      } catch (e) {}
    }
    if (this.userDataDir) {
      // Windows lock delay
      await new Promise(r => setTimeout(r, 400));
      try {
        fs.rmSync(this.userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch (e) {
        // Non-critical temp dir deletion
      }
    }
  }
}

export default CDPDriver;
