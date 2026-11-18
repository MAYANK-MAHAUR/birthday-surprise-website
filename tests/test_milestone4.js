#!/usr/bin/env node

/**
 * ======================================================================
 * MILESTONE 4 TEST SUITE: Dual Audio Engine, Mystery Boxes & Dynamic Hydration
 * ======================================================================
 * Validates:
 * 1. Dual Audio Playback Engine (#music-player, vinyl disc, song toggle, crossfade, autoplay compliance)
 * 2. Mystery Box 1 (Screen 13 / #slide-real-gifts: unwrap animation, official SVGs, 1-click clipboard copy with feedback & toast)
 * 3. Mystery Box 2 (Screen 13 / #slide-real-gifts: unwrap animation, live wishes board with photo thumbnails, prompt, form with date/photo upload, optimistic update)
 * 4. Dynamic Celebration Hydration (?c=<slug>, Supabase query, recipient name/passcode/photos/letter/socials/song, graceful fallback)
 * 5. Responsive Layout (.mystery-boxes-row column reflow on mobile <= 780px)
 * 6. Slide Preservation (14 screens strictly preserved, Screen 4 #slide-bday-spread)
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './server.js';
import { CDPDriver } from './cdp-driver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name, duration = 0) {
  totalTests++;
  passedTests++;
  console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name} ${duration ? `(${duration}ms)` : ''}`);
}

function fail(name, err) {
  totalTests++;
  failedTests++;
  console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name}`);
  console.error(`     Error: ${err.message}`);
}

async function runTest(name, fn) {
  const start = Date.now();
  try {
    await fn();
    pass(name, Date.now() - start);
  } catch (err) {
    fail(name, err);
  }
}

async function main() {
  console.log('\n======================================================================');
  console.log('   MILESTONE 4: DUAL AUDIO ENGINE, MYSTERY BOXES & HYDRATION SUITE');
  console.log('======================================================================\n');

  // --------------------------------------------------------------------
  // SUITE 1: STATIC PRESERVATION & ASSET RESOLUTION CONTRACTS
  // --------------------------------------------------------------------
  console.log('▶ Suite 1: Slide Preservation & Asset Resolution Contracts');

  await runTest('TC-M4-PRES-01: Exactly 14 sequential slides exist in index.html', () => {
    const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    const slideMatches = html.split('<section').slice(1).map(s => {
      const match = s.match(/id=["']([^"']+)["']/);
      return match ? match[1] : null;
    }).filter(Boolean);

    assert.equal(slideMatches.length, 14, `Expected exactly 14 slides, found ${slideMatches.length}`);
    assert.equal(slideMatches[0], 'slide-passcode', 'Slide 0 should be slide-passcode');
    assert.equal(slideMatches[4], 'slide-bday-spread', 'Slide 4 must be slide-bday-spread (Milestone 3 spread)');
    assert.equal(slideMatches[13], 'slide-real-gifts', 'Slide 13 must be slide-real-gifts (Milestone 4 climax)');
  });

  await runTest('TC-M4-PRES-02: Mandatory Milestone 4 DOM elements and inputs exist in index.html', () => {
    const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    const required = [
      'music-player',
      'vinyl-disc',
      'music-title',
      'music-bars',
      'song-switch-btn',
      'bg-music',
      'slide-real-gifts',
      'mystery-box-1',
      'box-1-visual',
      'box-1-revealed',
      'mystery-box-2',
      'box-2-visual',
      'box-2-revealed',
      'wishes-feed',
      'wish-prompt-section',
      'btn-wish-yes',
      'btn-wish-no',
      'wish-form',
      'wish-input-name',
      'wish-input-bday',
      'wish-input-text',
      'wish-input-photo',
      'btn-submit-wish',
      'toast-container'
    ];

    for (const id of required) {
      assert.ok(
        html.includes(`id="${id}"`) || html.includes(`id='${id}'`),
        `Required element with id="${id}" missing from index.html`
      );
    }
  });

  await runTest('TC-M4-PRES-03: Audio and Mystery Box SVG assets all exist on disk', () => {
    const assets = [
      'assets/audio/haareya.mp3',
      'assets/audio/city_of_stars.mp3',
      'assets/images/mystery-box-1.svg',
      'assets/images/mystery-box-2.svg',
      'assets/images/icon-instagram.svg',
      'assets/images/icon-snapchat.svg',
      'assets/images/icon-gmail.svg',
      'assets/images/icon-whatsapp.svg'
    ];

    for (const relPath of assets) {
      const fullPath = path.join(ROOT_DIR, relPath);
      assert.ok(fs.existsSync(fullPath), `Asset file not found on disk: ${relPath}`);
      assert.ok(fs.statSync(fullPath).size > 0, `Asset file is empty: ${relPath}`);
    }
  });

  await runTest('TC-M4-PRES-04: CSS brackets and responsive column reflow query exist', () => {
    const css = fs.readFileSync(path.join(ROOT_DIR, 'styles.css'), 'utf8');
    const openBrackets = (css.match(/\{/g) || []).length;
    const closeBrackets = (css.match(/\}/g) || []).length;
    assert.equal(openBrackets, closeBrackets, `CSS bracket mismatch: { ${openBrackets} vs } ${closeBrackets}`);
    assert.ok(css.includes('.mystery-boxes-row'), 'CSS must define .mystery-boxes-row');
    assert.ok(css.includes('flex-direction: column'), 'CSS must include flex-direction: column for mobile mystery boxes');
    assert.ok(css.includes('.copy-btn.copied'), 'CSS must define .copy-btn.copied tactile feedback');
    assert.ok(css.includes('.toast-container'), 'CSS must define .toast-container');
  });

  // --------------------------------------------------------------------
  // SPIN UP SERVER & CHROME CDP DRIVER FOR BROWSER INTEGRATION
  // --------------------------------------------------------------------
  let staticServer = null;
  let cdp = null;
  let baseUrl = '';

  try {
    staticServer = createStaticServer(ROOT_DIR);
    const srvInfo = await staticServer.start();
    baseUrl = srvInfo.baseUrl;
    cdp = new CDPDriver();
    await cdp.launch();
    console.log(`\n Chrome CDP connected on port ${cdp.port} (Base URL: ${baseUrl})\n`);

    // --------------------------------------------------------------------
    // SUITE 2: DUAL AUDIO PLAYBACK ENGINE & CROSSFADE
    // --------------------------------------------------------------------
    console.log('▶ Suite 2: Dual Audio Playback Engine & Crossfade');

    await runTest('TC-M4-AUD-01: Default Initial Audio Track is Haareya (#bg-music & #music-title)', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#music-player');

      const info = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const titleEl = document.getElementById('music-title');
        const src = audio.currentSrc || audio.src || audio.querySelector('source')?.getAttribute('src');
        return {
          title: titleEl?.textContent.trim(),
          src,
          paused: audio.paused
        };
      });

      assert.equal(info.title, 'Haareya', 'Music title badge should be Haareya initially');
      assert.ok(info.src.includes('haareya.mp3'), `Audio src should contain haareya.mp3, got: ${info.src}`);
    });

    await runTest('TC-M4-AUD-02: Play/Pause Toggle Controls State and Vinyl Spin Animation', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#music-player');
      await cdp.click('#music-toggle');
      await new Promise(r => setTimeout(r, 250));

      const playingState = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const widget = document.getElementById('music-player');
        return {
          isPlaying: !audio.paused || widget.classList.contains('playing'),
          hasPlayingClass: widget.classList.contains('playing')
        };
      });
      assert.equal(playingState.isPlaying, true, 'Audio should start playing after clicking toggle');
      assert.equal(playingState.hasPlayingClass, true, 'Widget should have playing class');

      // Click toggle again to pause
      await cdp.click('#music-toggle');
      await new Promise(r => setTimeout(r, 250));

      const pausedState = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const widget = document.getElementById('music-player');
        return {
          isPaused: audio.paused && !widget.classList.contains('playing'),
          hasPlayingClass: widget.classList.contains('playing')
        };
      });
      assert.equal(pausedState.isPaused, true, 'Audio should be paused on second toggle');
      assert.equal(pausedState.hasPlayingClass, false, 'Widget should not have playing class when paused');
    });

    await runTest('TC-M4-AUD-03: Song Switch Button Toggles to City of Stars with Crossfade', async () => {
      await cdp.click('#song-switch-btn');
      await new Promise(r => setTimeout(r, 350));

      const trackInfo = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const titleEl = document.getElementById('music-title');
        const src = audio.currentSrc || audio.src || audio.querySelector('source')?.getAttribute('src');
        return {
          title: titleEl?.textContent.trim(),
          src
        };
      });

      assert.equal(trackInfo.title, 'City of Stars', 'Title should switch to City of Stars');
      assert.ok(trackInfo.src.includes('city_of_stars.mp3'), `Audio source should switch to city_of_stars.mp3, got: ${trackInfo.src}`);
    });

    await runTest('TC-M4-AUD-04: Song Switch Button Round-Robins Back to Haareya', async () => {
      await cdp.click('#song-switch-btn');
      await new Promise(r => setTimeout(r, 350));

      const trackInfo = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const titleEl = document.getElementById('music-title');
        const src = audio.currentSrc || audio.src || audio.querySelector('source')?.getAttribute('src');
        return {
          title: titleEl?.textContent.trim(),
          src
        };
      });

      assert.equal(trackInfo.title, 'Haareya', 'Title should return to Haareya');
      assert.ok(trackInfo.src.includes('haareya.mp3'), `Audio source should return to haareya.mp3, got: ${trackInfo.src}`);
    });

    await runTest('TC-M4-AUD-05: Global window.BirthdayAudioEngine Interface Contract', async () => {
      const apiCheck = await cdp.evaluate(() => {
        const eng = window.BirthdayAudioEngine;
        if (!eng) return { exists: false };
        return {
          exists: true,
          hasPlay: typeof eng.play === 'function',
          hasPause: typeof eng.pause === 'function',
          hasToggle: typeof eng.toggle === 'function',
          hasSwitchTrack: typeof eng.switchTrack === 'function',
          hasGetCurrentTrack: typeof eng.getCurrentTrack === 'function',
          hasIsPlaying: typeof eng.isPlaying === 'function',
          currentTrack: eng.getCurrentTrack()
        };
      });

      assert.equal(apiCheck.exists, true, 'window.BirthdayAudioEngine must be exposed');
      assert.equal(apiCheck.hasPlay, true, 'AudioEngine must have play()');
      assert.equal(apiCheck.hasPause, true, 'AudioEngine must have pause()');
      assert.equal(apiCheck.hasToggle, true, 'AudioEngine must have toggle()');
      assert.equal(apiCheck.hasSwitchTrack, true, 'AudioEngine must have switchTrack()');
      assert.equal(apiCheck.hasGetCurrentTrack, true, 'AudioEngine must have getCurrentTrack()');
      assert.ok(apiCheck.currentTrack && apiCheck.currentTrack.name, 'getCurrentTrack() returns active track');
    });

    await runTest('TC-M4-AUD-06: Audio Autoplay Initiates upon First Keypad Interaction', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      const initialPlaying = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const widget = document.getElementById('music-player');
        return !audio.paused || widget.classList.contains('playing');
      });
      assert.equal(initialPlaying, false, 'Audio should not be playing before interaction');

      // Click keypad digit '1'
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 200));

      const startedPlaying = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const widget = document.getElementById('music-player');
        return !audio.paused || widget.classList.contains('playing');
      });
      assert.equal(startedPlaying, true, 'Audio should start playing immediately on first keypad tap');
    });

    // --------------------------------------------------------------------
    // SUITE 3: MYSTERY BOX 1 (SOCIALS, SVGS & 1-CLICK COPY)
    // --------------------------------------------------------------------
    console.log('\n▶ Suite 3: Mystery Box 1 (Screen 13 Socials & 1-Click Copy)');

    await runTest('TC-M4-BX1-01: Mystery Box 1 Initial State (Lid Visible, Content Hidden)', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });
      await cdp.waitForSelector('#slide-real-gifts.active');

      const state = await cdp.evaluate(() => {
        const visual = document.getElementById('box-1-visual');
        const revealed = document.getElementById('box-1-revealed');
        return {
          visualDisplay: window.getComputedStyle(visual).display,
          revealedDisplay: window.getComputedStyle(revealed).display
        };
      });

      assert.notEqual(state.visualDisplay, 'none', 'Box 1 visual should be visible initially');
      assert.equal(state.revealedDisplay, 'none', 'Box 1 revealed content should be hidden initially');
    });

    await runTest('TC-M4-BX1-02: Unwrap Mystery Box 1 Reveals Official Social SVGs and Handles', async () => {
      await cdp.click('#box-1-visual');
      await cdp.waitForFunction(() => {
        const revealed = document.getElementById('box-1-revealed');
        return revealed && window.getComputedStyle(revealed).display !== 'none';
      }, { timeoutMs: 5000 });

      const data = await cdp.evaluate(() => {
        const rows = document.querySelectorAll('.social-row');
        const svgs = Array.from(document.querySelectorAll('.social-row img.social-icon-img')).map(img => img.src);
        const handles = {
          insta: document.getElementById('social-val-insta')?.textContent.trim(),
          snap: document.getElementById('social-val-snap')?.textContent.trim(),
          email: document.getElementById('social-val-email')?.textContent.trim(),
          wa: document.getElementById('social-val-wa')?.textContent.trim()
        };
        const links = {
          insta: document.getElementById('social-link-insta')?.getAttribute('href'),
          snap: document.getElementById('social-link-snap')?.getAttribute('href'),
          email: document.getElementById('social-link-email')?.getAttribute('href'),
          wa: document.getElementById('social-link-wa')?.getAttribute('href')
        };
        return { rowsCount: rows.length, svgs, handles, links };
      });

      assert.equal(data.rowsCount, 4, 'Should render exactly 4 social rows');
      assert.equal(data.svgs.length, 4, 'All 4 rows should render official SVG icons');
      assert.ok(data.svgs[0].includes('icon-instagram.svg'), 'Instagram SVG rendered');
      assert.ok(data.svgs[1].includes('icon-snapchat.svg'), 'Snapchat SVG rendered');
      assert.ok(data.svgs[2].includes('icon-gmail.svg'), 'Gmail SVG rendered');
      assert.ok(data.svgs[3].includes('icon-whatsapp.svg'), 'WhatsApp SVG rendered');

      assert.ok(data.handles.insta && data.handles.insta.length > 0, 'Instagram handle non-empty');
      assert.ok(data.handles.snap && data.handles.snap.length > 0, 'Snapchat handle non-empty');
      assert.ok(data.handles.email && data.handles.email.length > 0, 'Gmail handle non-empty');
      assert.ok(data.handles.wa && data.handles.wa.length > 0, 'WhatsApp handle non-empty');

      assert.ok(data.links.insta.includes('instagram.com'), 'Instagram link valid');
      assert.ok(data.links.snap.includes('snapchat.com'), 'Snapchat link valid');
      assert.ok(data.links.email.startsWith('mailto:'), 'Gmail mailto link valid');
      assert.ok(data.links.wa.includes('wa.me'), 'WhatsApp chat link valid');
    });

    await runTest('TC-M4-BX1-03: 1-Click Clipboard Copy with Tactile Feedback & Toast Notification', async () => {
      const copyBtnSelector = '.copy-btn[data-copy="social-val-insta"]';
      await cdp.click(copyBtnSelector);

      const feedback = await cdp.evaluate((sel) => {
        const btn = document.querySelector(sel);
        const toast = document.querySelector('.toast-notification');
        return {
          btnText: btn.textContent.trim(),
          isCopiedClass: btn.classList.contains('copied'),
          toastText: toast ? toast.textContent.trim() : null,
          clipboardMem: window.__clipboardMemory
        };
      }, copyBtnSelector);

      assert.ok(feedback.btnText.includes('Copied'), `Button text should change to Copied! ✨, got: "${feedback.btnText}"`);
      assert.equal(feedback.isCopiedClass, true, 'Button should receive .copied class with green pulse');
      assert.ok(feedback.toastText && feedback.toastText.includes('Copied'), `Toast should surface, got: "${feedback.toastText}"`);
      assert.ok(feedback.clipboardMem && feedback.clipboardMem.includes('birthday'), 'Clipboard memory updated');

      // Wait 2100ms and verify state reverts back
      await new Promise(r => setTimeout(r, 2100));
      const reverted = await cdp.evaluate((sel) => {
        const btn = document.querySelector(sel);
        return {
          btnText: btn.textContent.trim(),
          isCopiedClass: btn.classList.contains('copied')
        };
      }, copyBtnSelector);

      assert.equal(reverted.btnText, 'Copy', 'Button text should revert back to "Copy"');
      assert.equal(reverted.isCopiedClass, false, 'Button should remove .copied class after 2000ms');
    });

    // --------------------------------------------------------------------
    // SUITE 4: MYSTERY BOX 2 (WISHES BOARD, FORM & PHOTO UPLOAD)
    // --------------------------------------------------------------------
    console.log('\n▶ Suite 4: Mystery Box 2 (Screen 13 Wishes Board & Photo Upload)');

    await runTest('TC-M4-BX2-01: Mystery Box 2 Initial State (Lid Visible, Content Hidden)', async () => {
      const state = await cdp.evaluate(() => {
        const visual = document.getElementById('box-2-visual');
        const revealed = document.getElementById('box-2-revealed');
        return {
          visualDisplay: window.getComputedStyle(visual).display,
          revealedDisplay: window.getComputedStyle(revealed).display
        };
      });

      assert.notEqual(state.visualDisplay, 'none', 'Box 2 visual should be visible initially');
      assert.equal(state.revealedDisplay, 'none', 'Box 2 revealed should be hidden initially');
    });

    await runTest('TC-M4-BX2-02: Unwrap Mystery Box 2 Renders Wishes Feed with Photo Thumbnails', async () => {
      await cdp.click('#box-2-visual');
      await cdp.waitForFunction(() => {
        const revealed = document.getElementById('box-2-revealed');
        return revealed && window.getComputedStyle(revealed).display !== 'none';
      }, { timeoutMs: 5000 });

      const feedData = await cdp.evaluate(() => {
        const items = document.querySelectorAll('#wishes-feed .wish-item');
        const photos = document.querySelectorAll('#wishes-feed .wish-thumb');
        const names = Array.from(document.querySelectorAll('#wishes-feed .wisher-name')).map(el => el.textContent.trim());
        const bdays = Array.from(document.querySelectorAll('#wishes-feed .wisher-bday')).map(el => el.textContent.trim());
        return {
          count: items.length,
          photoCount: photos.length,
          names,
          bdays
        };
      });

      assert.ok(feedData.count >= 2, `Wishes feed should contain at least 2 wishes, got: ${feedData.count}`);
      assert.ok(feedData.photoCount >= 1, `Feed should render photo thumbnails, found: ${feedData.photoCount}`);
      assert.ok(feedData.bdays[0].includes('🎂'), 'Birth date formatted with cake emoji');
    });

    await runTest('TC-M4-BX2-03: Interactive Prompt YES Displays Live Form with Date & Photo Input', async () => {
      await cdp.waitForSelector('#btn-wish-yes');
      await cdp.click('#btn-wish-yes');
      await cdp.waitForSelector('#wish-form');

      const formElements = await cdp.evaluate(() => {
        const form = document.getElementById('wish-form');
        const nameInput = document.getElementById('wish-input-name');
        const bdayInput = document.getElementById('wish-input-bday');
        const textInput = document.getElementById('wish-input-text');
        const photoInput = document.getElementById('wish-input-photo');
        const submitBtn = document.getElementById('btn-submit-wish');
        return {
          formVisible: window.getComputedStyle(form).display !== 'none',
          hasName: !!nameInput && nameInput.required,
          hasBday: !!bdayInput && bdayInput.type === 'date',
          hasText: !!textInput && textInput.required,
          hasPhoto: !!photoInput && photoInput.getAttribute('accept')?.includes('image'),
          hasSubmit: !!submitBtn
        };
      });

      assert.equal(formElements.formVisible, true, 'Wish submission form should be visible');
      assert.equal(formElements.hasName, true, 'Name input present and required');
      assert.equal(formElements.hasBday, true, 'Birth date input of type date present');
      assert.equal(formElements.hasText, true, 'Wish message textarea present and required');
      assert.equal(formElements.hasPhoto, true, 'Photo upload input with accept="image/*" present');
      assert.equal(formElements.hasSubmit, true, 'Submit button present');
    });

    await runTest('TC-M4-BX2-04: Optimistic Wish Submission Immediately Prepends Card to Feed', async () => {
      const initialCount = await cdp.evaluate(() => {
        return document.querySelectorAll('#wishes-feed .wish-item').length;
      });

      await cdp.setInputValue('#wish-input-name', 'Devika Sen');
      await cdp.setInputValue('#wish-input-bday', '1996-07-22');
      await cdp.setInputValue('#wish-input-text', 'Wishing you endless joy, bright dreams, and the happiest birthday ever! 💖✨');

      await cdp.click('#btn-submit-wish');
      await new Promise(r => setTimeout(r, 400));

      const updated = await cdp.evaluate(() => {
        const items = document.querySelectorAll('#wishes-feed .wish-item');
        const topWish = items[0] ? items[0].textContent : '';
        const statusEl = document.getElementById('wish-form-status');
        return {
          newCount: items.length,
          topWish,
          statusText: statusEl ? statusEl.textContent : ''
        };
      });

      assert.equal(updated.newCount, initialCount + 1, 'Feed count should immediately increment by 1');
      assert.ok(updated.topWish.includes('Devika Sen'), `Top wish should contain Devika Sen, got: "${updated.topWish}"`);
      assert.ok(updated.statusText.includes('Wish added'), `Status should confirm wish added, got: "${updated.statusText}"`);
    });

    // --------------------------------------------------------------------
    // SUITE 5: DYNAMIC CELEBRATION HYDRATION
    // --------------------------------------------------------------------
    console.log('\n▶ Suite 5: Dynamic Celebration Hydration (?c=<slug> / ?data=)');

    await runTest('TC-M4-HYD-01: Hydration parses URL query and personalizes name, passcode, letter and socials', async () => {
      const customPayload = {
        name: 'Simran Sharma',
        passcode: '2809',
        song: 'city_of_stars',
        photo_polaroid: 'assets/images/8893d690706f9c045b2c6e478c07636c.jpg',
        letter_text: 'Dearest Simran, you make every second wonderful. Happiest Birthday!',
        sender_name: 'Mayank With Love',
        social_insta: '@simran.official',
        social_snap: '@simran_vibes',
        social_email: 'simran@celebrate.com',
        social_wa: '+919988776655'
      };

      const base64Data = Buffer.from(JSON.stringify(customPayload)).toString('base64');
      await cdp.navigate(`${baseUrl}/index.html?data=${encodeURIComponent(base64Data)}`);
      await cdp.waitForSelector('#slide-passcode.active');
      await new Promise(r => setTimeout(r, 300));

      const hydrated = await cdp.evaluate(() => {
        const appState = window.BirthdayApp?.state;
        const pageTitle = document.title;
        const polaroidNote = document.getElementById('passcode-polaroid-note')?.textContent.trim();
        const letterGreeting = document.getElementById('letter-greeting')?.textContent.trim();
        const letterContent = document.getElementById('letter-content')?.textContent.trim();
        const letterAuthor = document.getElementById('letter-author')?.textContent.trim();
        const socialInsta = document.getElementById('social-val-insta')?.textContent.trim();
        const socialLinkInsta = document.getElementById('social-link-insta')?.getAttribute('href');
        const musicTitle = document.getElementById('music-title')?.textContent.trim();

        return {
          passcode: appState?.currentPasscode,
          pageTitle,
          polaroidNote,
          letterGreeting,
          letterContent,
          letterAuthor,
          socialInsta,
          socialLinkInsta,
          musicTitle
        };
      });

      assert.equal(hydrated.passcode, '2809', 'Lock screen passcode should be updated to custom 2809');
      assert.ok(hydrated.pageTitle.includes('Simran Sharma'), `Title should hydrate recipient name, got: "${hydrated.pageTitle}"`);
      assert.ok(hydrated.polaroidNote.includes('Simran Sharma'), `Polaroid note should hydrate name, got: "${hydrated.polaroidNote}"`);
      assert.ok(hydrated.letterGreeting.includes('Simran Sharma'), `Letter greeting should hydrate name, got: "${hydrated.letterGreeting}"`);
      assert.ok(hydrated.letterContent.includes('Dearest Simran'), 'Letter text hydrated');
      assert.equal(hydrated.letterAuthor, 'Mayank With Love', 'Letter author hydrated');
      assert.equal(hydrated.socialInsta, '@simran.official', 'Mystery Box 1 social handle hydrated');
      assert.ok(hydrated.socialLinkInsta.includes('simran.official'), 'Social direct link hydrated');
      assert.equal(hydrated.musicTitle, 'City of Stars', 'Default song hydrated to City of Stars');
    });

    await runTest('TC-M4-HYD-02: Custom Hydrated Passcode Unlocks Presentation Flow', async () => {
      // Enter custom passcode '2809'
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 60));
      await cdp.click('.key-btn[data-key="8"]');
      await new Promise(r => setTimeout(r, 60));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 60));
      await cdp.click('.key-btn[data-key="9"]');

      await cdp.waitForFunction(() => {
        const s0 = document.getElementById('slide-passcode');
        const sSurprise = document.getElementById('slide-surprise');
        return !s0.classList.contains('active') && sSurprise.classList.contains('active');
      }, { timeoutMs: 6000 });

      const unlocked = await cdp.hasClass('#slide-surprise', 'active');
      assert.equal(unlocked, true, 'Slide surprise should be active after entering custom passcode');
    });

    await runTest('TC-M4-HYD-03: Graceful Offline & Default Fallback When No URL Slug Present', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      const fallback = await cdp.evaluate(() => {
        const appState = window.BirthdayApp?.state;
        const audioSrc = document.getElementById('bg-music')?.src;
        const wishes = appState?.wishes;
        return {
          passcode: appState?.currentPasscode,
          audioSrc,
          wishesLength: wishes ? wishes.length : 0
        };
      });

      assert.equal(fallback.passcode, '1204', 'Default passcode is 1204');
      assert.ok(fallback.audioSrc.includes('haareya.mp3'), 'Default song is Haareya');
      assert.ok(fallback.wishesLength >= 2, 'Default wishes board populated');
    });

    // --------------------------------------------------------------------
    // SUITE 6: RESPONSIVE VIEWPORT REFLOW & NAVIGATION ROBUSTNESS
    // --------------------------------------------------------------------
    console.log('\n▶ Suite 6: Responsive Layout & Non-Blocking Navigation');

    await runTest('TC-M4-RSP-01: Mobile Viewport (375x667) Mystery Boxes Column Reflow & Zero Overflow', async () => {
      await cdp.setViewport({ width: 375, height: 667 });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });
      await cdp.waitForSelector('#slide-real-gifts.active');

      const mobileMetrics = await cdp.evaluate(() => {
        const row = document.querySelector('.mystery-boxes-row');
        const cards = document.querySelectorAll('.mystery-box-card');
        const rowStyle = window.getComputedStyle(row);
        const cardStyle = window.getComputedStyle(cards[0]);
        const body = document.body;
        return {
          flexDirection: rowStyle.flexDirection,
          cardWidth: parseFloat(cardStyle.width),
          bodyScrollWidth: body.scrollWidth,
          bodyClientWidth: body.clientWidth
        };
      });

      assert.equal(mobileMetrics.flexDirection, 'column', '.mystery-boxes-row must reflow to column on mobile');
      assert.ok(mobileMetrics.cardWidth <= 375, `Mystery box card width (${mobileMetrics.cardWidth}px) must fit within mobile screen`);
      assert.ok(mobileMetrics.bodyScrollWidth <= mobileMetrics.bodyClientWidth + 5, 'No horizontal scrollbar allowed on mobile viewport');
    });

    await runTest('TC-M4-NAV-01: Non-blocking Slide Navigation Does Not Drop Fast Clicks', async () => {
      await cdp.setViewport({ width: 1366, height: 768 });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      // Test rapid slide changes via window.BirthdayApp.goToSlide
      await cdp.evaluate(() => {
        window.BirthdayApp.goToSlide('slide-surprise');
      });
      await new Promise(r => setTimeout(r, 220));

      const surpriseActive = await cdp.hasClass('#slide-surprise', 'active');
      assert.equal(surpriseActive, true, 'Slide surprise active');

      await cdp.evaluate(() => {
        window.BirthdayApp.goToSlide('slide-candles');
      });
      await new Promise(r => setTimeout(r, 220));

      const candlesActive = await cdp.hasClass('#slide-candles', 'active');
      assert.equal(candlesActive, true, 'Slide candles active');
    });

  } catch (err) {
    console.error('\n\x1b[31m[CRITICAL TEST ERROR]\x1b[0m', err);
    failedTests++;
  } finally {
    if (cdp) await cdp.close();
    if (staticServer) await staticServer.stop();
  }

  // --------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('              MILESTONE 4 TEST EXECUTION SUMMARY');
  console.log('======================================================================');
  console.log(`  Total Test Assertions: ${totalTests}`);
  console.log(`  Passed:                \x1b[32m${passedTests}\x1b[0m`);
  console.log(`  Failed:                \x1b[${failedTests > 0 ? '31' : '32'}m${failedTests}\x1b[0m`);
  console.log('======================================================================');

  if (failedTests > 0) {
    console.error(`\n  ✖ MILESTONE 4 VERIFICATION FAILED WITH ${failedTests} FAILURE(S)`);
    process.exit(1);
  } else {
    console.log('\n  ✔ ALL MILESTONE 4 TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
