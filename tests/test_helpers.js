import assert from 'node:assert/strict';

export const SUPABASE_CONFIG = {
  url: 'https://obnuhnxhriluesrigxjz.supabase.co',
  publishableKey: 'sb_publishable_M4OGbz-SJWwF3sQsJrONBw_SBBOPHY0',
  bucket: 'celebration-assets'
};

export function getPostgrestHeaders(extra = {}) {
  return {
    apikey: SUPABASE_CONFIG.publishableKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.publishableKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra
  };
}

export async function postgrestFetch(endpoint, options = {}) {
  const url = `${SUPABASE_CONFIG.url}/rest/v1${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = getPostgrestHeaders(options.headers);
  const response = await fetch(url, {
    ...options,
    headers
  });
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await response.text();
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    data
  };
}

export async function storageFetch(endpoint, options = {}) {
  const url = `${SUPABASE_CONFIG.url}/storage/v1${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = {
    apikey: SUPABASE_CONFIG.publishableKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.publishableKey}`,
    ...options.headers
  };
  const response = await fetch(url, {
    ...options,
    headers
  });
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await response.text();
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    data
  };
}

export class TestHarness {
  constructor(name = 'Test Suite') {
    this.name = name;
    this.suites = [];
    this.currentSuite = null;
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
  }

  describe(title, fn) {
    const suite = {
      title,
      tests: [],
      beforeAllFns: [],
      afterAllFns: [],
      beforeEachFns: [],
      afterEachFns: []
    };
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = prevSuite;
    }
  }

  test(title, fn) {
    if (!this.currentSuite) {
      const defaultSuite = {
        title: this.name || 'Default Suite',
        tests: [],
        beforeAllFns: [],
        afterAllFns: [],
        beforeEachFns: [],
        afterEachFns: []
      };
      this.suites.push(defaultSuite);
      this.currentSuite = defaultSuite;
    }
    this.currentSuite.tests.push({ title, fn, status: 'pending', error: null, duration: 0 });
  }

  beforeAll(fn) {
    if (this.currentSuite) this.currentSuite.beforeAllFns.push(fn);
  }

  afterAll(fn) {
    if (this.currentSuite) this.currentSuite.afterAllFns.push(fn);
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEachFns.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEachFns.push(fn);
  }

  async run() {
    const overallStart = Date.now();
    console.log(`\n======================================================`);
    console.log(` RUNNING: ${this.name}`);
    console.log(`======================================================\n`);

    for (const suite of this.suites) {
      console.log(`  \x1b[1m\x1b[36m▶ Suite: ${suite.title}\x1b[0m`);

      // Run beforeAll hooks
      for (const fn of suite.beforeAllFns) {
        await fn();
      }

      for (const t of suite.tests) {
        this.stats.total++;
        const testStart = Date.now();

        // Run beforeEach hooks
        for (const fn of suite.beforeEachFns) {
          await fn();
        }

        try {
          await t.fn();
          t.duration = Date.now() - testStart;
          t.status = 'passed';
          this.stats.passed++;
          console.log(`    \x1b[32m✔ [PASS]\x1b[0m ${t.title} \x1b[90m(${t.duration}ms)\x1b[0m`);
        } catch (err) {
          t.duration = Date.now() - testStart;
          t.status = 'failed';
          t.error = err;
          this.stats.failed++;
          console.log(`    \x1b[31m✖ [FAIL]\x1b[0m ${t.title} \x1b[90m(${t.duration}ms)\x1b[0m`);
          console.log(`      \x1b[31mError:\x1b[0m ${err.message}`);
          if (err.stack) {
            const stackLines = err.stack.split('\n').slice(1, 4).join('\n      ');
            console.log(`      \x1b[90m${stackLines}\x1b[0m`);
          }
        }

        // Run afterEach hooks
        for (const fn of suite.afterEachFns) {
          try {
            await fn();
          } catch (e) {
            console.error(`      \x1b[33m[WARN] afterEach hook error:\x1b[0m`, e.message);
          }
        }
      }

      // Run afterAll hooks
      for (const fn of suite.afterAllFns) {
        try {
          await fn();
        } catch (e) {
          console.error(`    \x1b[33m[WARN] afterAll hook error:\x1b[0m`, e.message);
        }
      }
      console.log('');
    }

    this.stats.duration = Date.now() - overallStart;
    console.log(`------------------------------------------------------`);
    console.log(` Summary: ${this.stats.passed} passed, ${this.stats.failed} failed of ${this.stats.total} total \x1b[90m(${this.stats.duration}ms)\x1b[0m`);
    console.log(`------------------------------------------------------\n`);

    return this.stats;
  }
}

export { assert };
export default {
  CDPDriver: null,
  TestHarness,
  assert,
  SUPABASE_CONFIG,
  postgrestFetch,
  storageFetch
};
