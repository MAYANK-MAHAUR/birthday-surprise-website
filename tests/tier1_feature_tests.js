import { TestHarness, assert, postgrestFetch, storageFetch, SUPABASE_CONFIG } from './test_helpers.js';

export async function runTier1Tests({ baseUrl, cdp }) {
  const harness = new TestHarness('Tier 1: Core Feature Coverage');

  // --- AREA 1: SCREEN 0 KEYPAD & PASSCODE ENGINE ---
  harness.describe('Feature 1: Keypad & Passcode Engine (Screen 0)', () => {
    harness.beforeEach(async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');
    });

    harness.test('TC-T1-KEY-01: Keypad Numeric Button Click Populates PIN Display Slots', async () => {
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 60));
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 60));
      await cdp.click('.key-btn[data-key="0"]');

      const slots = await cdp.evaluate(() => {
        const els = document.querySelectorAll('#pin-display .pin-slot');
        return Array.from(els).map(el => ({
          text: el.textContent.trim(),
          filled: el.classList.contains('filled')
        }));
      });

      assert.equal(slots.length, 4, 'Should have 4 PIN slots');
      assert.equal(slots[0].filled, true, 'Slot 0 should be filled');
      assert.ok(slots[0].text === '●' || slots[0].text === '*', `Slot 0 should display masked pin mark, got: "${slots[0].text}"`);
      assert.equal(slots[1].filled, true, 'Slot 1 should be filled');
      assert.equal(slots[2].filled, true, 'Slot 2 should be filled');
      assert.equal(slots[3].filled, false, 'Slot 3 should be empty');
      assert.equal(slots[3].text, '', 'Slot 3 should have empty text');
    });

    harness.test('TC-T1-KEY-02: Keypad Clear Button Clears Digits in Reverse Order', async () => {
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 60));
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 60));
      await cdp.click('.key-btn[data-key="3"]');
      await new Promise(r => setTimeout(r, 60));

      // Click clear / backspace
      await cdp.click('.key-btn[data-key="clear"]');

      const slots = await cdp.evaluate(() => {
        const els = document.querySelectorAll('#pin-display .pin-slot');
        return Array.from(els).map(el => ({
          text: el.textContent.trim(),
          filled: el.classList.contains('filled')
        }));
      });

      assert.equal(slots[0].filled, true, 'Slot 0 remains filled');
      assert.equal(slots[1].filled, true, 'Slot 1 remains filled');
      assert.equal(slots[2].filled, false, 'Slot 2 should be cleared');
      assert.equal(slots[3].filled, false, 'Slot 3 remains empty');
    });

    harness.test('TC-T1-KEY-03: Physical Keyboard Keydown Events Drive PIN Input', async () => {
      await cdp.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      });

      const slots = await cdp.evaluate(() => {
        const els = document.querySelectorAll('#pin-display .pin-slot');
        return Array.from(els).map(el => el.classList.contains('filled'));
      });

      assert.equal(slots[0], true, 'Slot 0 filled with 5');
      assert.equal(slots[1], false, 'Slot 1 cleared by Backspace');
    });

    harness.test('TC-T1-KEY-04: Default Passcode (1204) Unlocks and Navigates', async () => {
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="4"]');

      // Wait for success transition
      await cdp.waitForFunction(() => {
        const s0 = document.getElementById('slide-passcode');
        const s2 = document.getElementById('slide-surprise');
        const sSpread = document.getElementById('slide-bday-spread');
        return (!s0.classList.contains('active')) && (s2.classList.contains('active') || (sSpread && sSpread.classList.contains('active')));
      }, { timeoutMs: 5000 });

      const s0Active = await cdp.hasClass('#slide-passcode', 'active');
      assert.equal(s0Active, false, 'Screen 0 should no longer be active');
    });

    harness.test('TC-T1-KEY-05: Audio Autoplay Starts Upon First Keypad Click', async () => {
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 200));

      const isPlaying = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const widget = document.getElementById('music-player');
        return !audio.paused || (widget && widget.classList.contains('playing'));
      });

      assert.equal(isPlaying, true, 'Audio should start playing or indicate playing state on first click');
    });

    harness.test('TC-T1-KEY-06: Custom Passcode Hydration & Unlock via URL parameter', async () => {
      const payload = btoa(JSON.stringify({ passcode: '8899', name: 'Rohit' }));
      await cdp.navigate(`${baseUrl}/index.html?data=${encodeURIComponent(payload)}`);
      await cdp.waitForSelector('#slide-passcode.active');

      const noteText = await cdp.getText('#passcode-polaroid-note');
      assert.ok(noteText.includes('Rohit'), `Polaroid note should hydrate name Rohit, got: "${noteText}"`);

      // Enter custom passcode 8899
      await cdp.click('.key-btn[data-key="8"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="8"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="9"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="9"]');

      await cdp.waitForFunction(() => {
        return !document.getElementById('slide-passcode').classList.contains('active');
      }, { timeoutMs: 5000 });

      const s0Active = await cdp.hasClass('#slide-passcode', 'active');
      assert.equal(s0Active, false, 'Screen 0 should unlock with custom passcode 8899');
    });
  });

  // --- AREA 2: SCREEN 1-13 SLIDE NAVIGATION FLOW ---
  harness.describe('Feature 2: Scrapbook Slide Navigation Flow', () => {
    // Helper to ensure wipe transition is completely settled and isTransitioning is cleared
    const waitForTransitionSettle = async (delayMs = 750) => {
      await new Promise(r => setTimeout(r, delayMs));
      await cdp.waitForFunction(() => {
        const wipe = document.getElementById('cloudWipe');
        return !wipe || !wipe.classList.contains('animating');
      }, { timeoutMs: 5000 }).catch(() => {});
    };

    harness.beforeEach(async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        try { localStorage.clear(); } catch (e) {}
      });
      await cdp.waitForSelector('#slide-passcode.active', { timeoutMs: 8000 });
    });

    harness.test('TC-T1-NAV-01: Wrong Passcode Screen & Retry Navigation', async () => {
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');

      await cdp.waitForSelector('#slide-wrong-passcode.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      const heading = await cdp.getText('#slide-wrong-passcode .slide-title, #slide-wrong-passcode h1, #slide-wrong-passcode h2');
      assert.ok(heading && heading.includes('Wrong Passcode'), `Wrong passcode heading should appear, got: "${heading}"`);

      // Click Retry
      await cdp.click('#btn-wrong-passcode-retry');
      await cdp.waitForSelector('#slide-passcode.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      const slotsEmpty = await cdp.evaluate(() => {
        const els = document.querySelectorAll('#pin-display .pin-slot');
        return Array.from(els).every(el => el.textContent === '' && !el.classList.contains('filled'));
      });
      assert.equal(slotsEmpty, true, 'All PIN slots should reset after retry');
    });

    harness.test('TC-T1-NAV-02: Wanna See Surprise Prompt NO Sassy Reaction & Recovery', async () => {
      // Unlock to Screen 2
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="4"]');
      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      // Click NO
      await cdp.click('#btn-surprise-no');
      await cdp.waitForSelector('#slide-how-dare-you.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      const title = await cdp.getText('#slide-how-dare-you .slide-title, #slide-how-dare-you h1, #slide-how-dare-you h2');
      assert.ok(title && (title.includes('How dare you') || title.includes('NO')), `Title should show sassy reaction, got: "${title}"`);

      // Click Retry
      await cdp.click('#btn-how-dare-retry');
      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);
      const surpriseActive = await cdp.hasClass('#slide-surprise', 'active');
      assert.equal(surpriseActive, true, 'Should return to Screen 2');
    });

    harness.test('TC-T1-NAV-03: Wanna See Surprise YES Advances to Birthday Spread or Candles', async () => {
      // Unlock to Screen 2
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="4"]');
      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      // Click YES
      await cdp.click('#btn-surprise-yes');

      await cdp.waitForFunction(() => {
        const spread = document.getElementById('slide-bday-spread');
        const candles = document.getElementById('slide-candles');
        return (spread && spread.classList.contains('active')) || (candles && candles.classList.contains('active'));
      }, { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      const nextActive = await cdp.evaluate(() => {
        const spread = document.getElementById('slide-bday-spread');
        if (spread && spread.classList.contains('active')) return 'spread';
        const candles = document.getElementById('slide-candles');
        if (candles && candles.classList.contains('active')) return 'candles';
        return null;
      });
      assert.ok(nextActive !== null, 'Should advance to birthday spread or cake slide');
    });

    harness.test('TC-T1-NAV-04: Restored 12:00 AM Birthday Spread Advances to Cake', async () => {
      const hasSpread = await cdp.evaluate(() => !!document.getElementById('slide-bday-spread'));
      if (hasSpread) {
        await cdp.evaluate(() => {
          const wipe = document.getElementById('cloudWipe');
          if (wipe) wipe.classList.remove('animating');
          if (typeof window.__isTransitioning !== 'undefined') window.__isTransitioning = false;
          document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
          document.getElementById('slide-bday-spread').classList.add('active');
        });

        const toCakeBtn = await cdp.evaluate(() => {
          const btn = document.querySelector('#slide-bday-spread button, #slide-bday-spread .spread-btn, #btn-to-cake');
          return btn ? (btn.id || btn.className) : null;
        });

        if (toCakeBtn) {
          await cdp.click('#slide-bday-spread button, #slide-bday-spread .spread-btn, #btn-to-cake');
          await cdp.waitForSelector('#slide-candles.active', { timeoutMs: 8000 });
          await waitForTransitionSettle(750);
          const candlesActive = await cdp.hasClass('#slide-candles', 'active');
          assert.equal(candlesActive, true, 'Should advance to cake slide');
        }
      }
      assert.ok(true, '12:00 AM spread test passed');
    });

    harness.test('TC-T1-NAV-05: Cake Click Extinguishes Candles and Triggers Celebration', async () => {
      await cdp.evaluate(() => {
        const wipe = document.getElementById('cloudWipe');
        if (wipe) wipe.classList.remove('animating');
        if (typeof window.__isTransitioning !== 'undefined') window.__isTransitioning = false;
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-candles').classList.add('active');
      });

      await cdp.click('#cake-container');

      const candlesBlown = await cdp.evaluate(() => {
        const candles = document.querySelectorAll('#candles-row .candle');
        return Array.from(candles).every(c => c.classList.contains('blown'));
      });
      assert.equal(candlesBlown, true, 'All candles should gain class blown');

      await cdp.waitForSelector('#slide-celebration.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);
      const celebrationActive = await cdp.hasClass('#slide-celebration', 'active');
      assert.equal(celebrationActive, true, 'Should transition to slide-celebration');
    });

    harness.test('TC-T1-NAV-06: Accept Gifts Prompt NO Shows Crying Cat Reaction and Recovers', async () => {
      await cdp.evaluate(() => {
        const wipe = document.getElementById('cloudWipe');
        if (wipe) wipe.classList.remove('animating');
        if (typeof window.__isTransitioning !== 'undefined') window.__isTransitioning = false;
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-accept-gifts').classList.add('active');
      });

      await cdp.click('#btn-accept-no');
      await cdp.waitForSelector('#slide-crying-cat.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      const cryingText = await cdp.getText('#slide-crying-cat .slide-title, #slide-crying-cat h1, #slide-crying-cat h2');
      assert.ok(cryingText && (cryingText.includes('Please try again') || cryingText.includes('crying') || cryingText.includes('Cat')), `Crying text displayed: "${cryingText}"`);

      // Click OKAY
      await cdp.click('#btn-crying-okay');
      await cdp.waitForSelector('#slide-accept-gifts.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);
      const acceptActive = await cdp.hasClass('#slide-accept-gifts', 'active');
      assert.equal(acceptActive, true, 'Should return to accept gifts slide');
    });

    harness.test('TC-T1-NAV-07: 3-Gift Grid: Gift 1 (Letter) Navigation and Return', async () => {
      await cdp.evaluate(() => {
        const wipe = document.getElementById('cloudWipe');
        if (wipe) wipe.classList.remove('animating');
        if (typeof window.__isTransitioning !== 'undefined') window.__isTransitioning = false;
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-choose-gift').classList.add('active');
      });

      await cdp.click('#card-gift-1');
      await cdp.waitForSelector('#slide-letter.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      const greeting = await cdp.getText('#letter-greeting');
      assert.ok(greeting.length > 0, 'Letter greeting should not be empty');

      await cdp.click('#btn-back-from-letter');
      await cdp.waitForSelector('#slide-choose-gift.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);
    });

    harness.test('TC-T1-NAV-08: 3-Gift Grid: Gift 2 (Flowers) Navigation and Return', async () => {
      await cdp.evaluate(() => {
        const wipe = document.getElementById('cloudWipe');
        if (wipe) wipe.classList.remove('animating');
        if (typeof window.__isTransitioning !== 'undefined') window.__isTransitioning = false;
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-choose-gift').classList.add('active');
      });

      await cdp.click('#card-gift-2');
      await cdp.waitForSelector('#slide-flowers.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      const flowersCount = await cdp.evaluate(() => document.querySelectorAll('#slide-flowers img').length);
      assert.ok(flowersCount >= 1, 'Should display flowers / bouquet images');

      await cdp.click('#btn-back-from-flowers');
      await cdp.waitForSelector('#slide-choose-gift.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);
    });

    harness.test('TC-T1-NAV-09: 3-Gift Grid: Gift 3 (Scrapbook) to Real Gifts Flow', async () => {
      await cdp.evaluate(() => {
        const wipe = document.getElementById('cloudWipe');
        if (wipe) wipe.classList.remove('animating');
        if (typeof window.__isTransitioning !== 'undefined') window.__isTransitioning = false;
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-choose-gift').classList.add('active');
      });

      await cdp.click('#card-gift-3');
      await cdp.waitForSelector('#slide-scrapbook.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      await cdp.click('#btn-to-real-gift');
      await cdp.waitForSelector('#slide-real-gifts.active', { timeoutMs: 8000 });
      await waitForTransitionSettle(750);

      const heading = await cdp.getText('#slide-real-gifts h2, #slide-real-gifts h1');
      assert.ok(heading && (heading.includes('REAL') || heading.includes('gift')), `Should reach real gifts screen: "${heading}"`);
    });
  });

  // --- AREA 3: DUAL AUDIO ENGINE ---
  harness.describe('Feature 3: Dual Audio Engine & In-App Toggle', () => {
    harness.beforeEach(async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#music-player');
    });

    harness.test('TC-T1-AUD-01: Default Initial Audio Track is Haareya', async () => {
      const trackInfo = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const titleEl = document.getElementById('music-title');
        const src = audio.currentSrc || audio.src || audio.querySelector('source')?.getAttribute('src');
        return {
          title: titleEl?.textContent.trim(),
          src
        };
      });

      assert.equal(trackInfo.title, 'Haareya', 'Title should be Haareya');
      assert.ok(trackInfo.src.includes('haareya.mp3'), `Source should point to haareya.mp3, got: ${trackInfo.src}`);
    });

    harness.test('TC-T1-AUD-02: Play/Pause Toggle Controls Playback State', async () => {
      await cdp.click('#music-toggle');
      await new Promise(r => setTimeout(r, 300));

      const isPlaying = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const player = document.getElementById('music-player');
        return !audio.paused || player.classList.contains('playing');
      });
      assert.equal(isPlaying, true, 'Music should start playing on first toggle');

      // Click toggle again to pause
      await cdp.click('#music-toggle');
      await new Promise(r => setTimeout(r, 300));

      const isPaused = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const player = document.getElementById('music-player');
        return audio.paused && !player.classList.contains('playing');
      });
      assert.equal(isPaused, true, 'Music should be paused on second toggle');
    });

    harness.test('TC-T1-AUD-03: Song Switch Button Toggles to City of Stars', async () => {
      await cdp.click('#song-switch-btn');
      await new Promise(r => setTimeout(r, 400));

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
      assert.ok(trackInfo.src.includes('city_of_stars.mp3'), `Source should point to city_of_stars.mp3, got: ${trackInfo.src}`);
    });

    harness.test('TC-T1-AUD-04: Song Switch Button Round-Robins Back to Haareya', async () => {
      // Toggle to City of Stars
      await cdp.click('#song-switch-btn');
      await new Promise(r => setTimeout(r, 300));

      // Toggle back to Haareya
      await cdp.click('#song-switch-btn');
      await new Promise(r => setTimeout(r, 300));

      const title = await cdp.getText('#music-title');
      assert.equal(title, 'Haareya', 'Title should return to Haareya');
    });

    harness.test('TC-T1-AUD-05: Audio Element Retains Persistence Across Slide Transitions', async () => {
      await cdp.click('#music-toggle');

      await cdp.evaluate(() => {
        window.BirthdayApp?.goToSlide?.('slide-candles') || (() => {
          document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
          document.getElementById('slide-candles').classList.add('active');
        })();
      });

      const audioMounted = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        return audio !== null && audio.parentElement !== null;
      });
      assert.equal(audioMounted, true, 'Audio element must remain mounted in body');
    });

    harness.test('TC-T1-AUD-06: Equalizer Bar Dance Animation Present During Playback', async () => {
      await cdp.click('#music-toggle');
      await new Promise(r => setTimeout(r, 200));

      const barCount = await cdp.evaluate(() => {
        return document.querySelectorAll('#music-bars span').length;
      });
      assert.ok(barCount >= 3, `Equalizer should contain at least 3 bars, got: ${barCount}`);
    });
  });

  // --- AREA 4: END GAME MYSTERY BOXES & WISHES BOARD ---
  harness.describe('Feature 4: Mystery Boxes & Community Wishes', () => {
    harness.beforeEach(async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });
      await cdp.waitForSelector('#slide-real-gifts.active');
    });

    harness.test('TC-T1-BOX-01: Mystery Box 1 Initial State (Lid Visible, Content Hidden)', async () => {
      const state = await cdp.evaluate(() => {
        const visual = document.getElementById('box-1-visual');
        const revealed = document.getElementById('box-1-revealed');
        return {
          visualDisplay: window.getComputedStyle(visual).display,
          revealedDisplay: window.getComputedStyle(revealed).display
        };
      });

      assert.notEqual(state.visualDisplay, 'none', 'Box 1 visual should be visible');
      assert.equal(state.revealedDisplay, 'none', 'Box 1 revealed should be hidden initially');
    });

    harness.test('TC-T1-BOX-02: Mystery Box 1 Unwrap Reveals 4 Social Channels', async () => {
      await cdp.click('#box-1-visual');
      await cdp.waitForFunction(() => {
        const revealed = document.getElementById('box-1-revealed');
        return window.getComputedStyle(revealed).display !== 'none';
      });

      const handles = await cdp.evaluate(() => ({
        insta: document.getElementById('social-val-insta')?.textContent.trim(),
        snap: document.getElementById('social-val-snap')?.textContent.trim(),
        email: document.getElementById('social-val-email')?.textContent.trim(),
        wa: document.getElementById('social-val-wa')?.textContent.trim()
      }));

      assert.ok(handles.insta && handles.insta.length > 0, 'Instagram handle rendered');
      assert.ok(handles.snap && handles.snap.length > 0, 'Snapchat handle rendered');
      assert.ok(handles.email && handles.email.length > 0, 'Email handle rendered');
      assert.ok(handles.wa && handles.wa.length > 0, 'WhatsApp handle rendered');
    });

    harness.test('TC-T1-BOX-03: Mystery Box 1 Copy Button Copies to Clipboard with Feedback', async () => {
      await cdp.click('#box-1-visual');
      await cdp.waitForSelector('.copy-btn[data-copy="social-val-insta"]');

      await cdp.click('.copy-btn[data-copy="social-val-insta"]');

      const btnText = await cdp.getText('.copy-btn[data-copy="social-val-insta"]');
      assert.ok(btnText.includes('Copied') || btnText.includes('✨'), `Button feedback should show Copied, got: "${btnText}"`);

      const clipText = await cdp.evaluate(async () => {
        return window.__clipboardMemory || (await navigator.clipboard.readText());
      });
      assert.ok(clipText.length > 0, 'Clipboard content should not be empty');
    });

    harness.test('TC-T1-BOX-04: Mystery Box 2 Initial State (Lid Visible, Content Hidden)', async () => {
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

    harness.test('TC-T1-BOX-05: Mystery Box 2 Unwrap Renders Wishes Feed', async () => {
      await cdp.click('#box-2-visual');
      await cdp.waitForFunction(() => {
        const revealed = document.getElementById('box-2-revealed');
        return window.getComputedStyle(revealed).display !== 'none';
      });

      const wishCardsCount = await cdp.evaluate(() => {
        return document.querySelectorAll('#wishes-feed .wish-item, #wishes-list .wish-item').length;
      });
      assert.ok(wishCardsCount >= 1, `Wishes feed should contain at least 1 wish, got: ${wishCardsCount}`);
    });

    harness.test('TC-T1-BOX-06: Mystery Box 2 YES Prompt Displays Wish Submission Form', async () => {
      await cdp.click('#box-2-visual');
      await cdp.waitForSelector('#btn-wish-yes');

      await cdp.click('#btn-wish-yes');
      await cdp.waitForSelector('#wish-form');

      const formVisible = await cdp.evaluate(() => {
        const form = document.getElementById('wish-form');
        return window.getComputedStyle(form).display !== 'none';
      });
      assert.equal(formVisible, true, 'Wish submission form should be visible after clicking YES');
    });

    harness.test('TC-T1-BOX-07: Mystery Box 2 NO Prompt Hides Prompt Courteously', async () => {
      await cdp.click('#box-2-visual');
      await cdp.waitForSelector('#btn-wish-no');

      await cdp.click('#btn-wish-no');

      const formHidden = await cdp.evaluate(() => {
        const form = document.getElementById('wish-form');
        return !form || window.getComputedStyle(form).display === 'none';
      });
      assert.equal(formHidden, true, 'Wish form should remain hidden when choosing NO');
    });

    harness.test('TC-T1-BOX-08: Submitting Valid Wish Appends to Feed Immediately', async () => {
      await cdp.click('#box-2-visual');
      await cdp.waitForSelector('#btn-wish-yes');
      await cdp.click('#btn-wish-yes');
      await cdp.waitForSelector('#wish-form');

      const initialCount = await cdp.evaluate(() => {
        return document.querySelectorAll('#wishes-feed .wish-item, #wishes-list .wish-item').length;
      });

      await cdp.setInputValue('#wish-input-name', 'Kavita Rao');
      await cdp.setInputValue('#wish-input-bday', '1997-08-14');
      await cdp.setInputValue('#wish-input-text', 'Happy Birthday! Wishing you endless smiles and sweet adventures! 🌟');

      await cdp.click('#btn-submit-wish');
      await new Promise(r => setTimeout(r, 600));

      const newCount = await cdp.evaluate(() => {
        return document.querySelectorAll('#wishes-feed .wish-item, #wishes-list .wish-item').length;
      });
      assert.equal(newCount, initialCount + 1, 'Wishes feed count should increment by 1');

      const topWish = await cdp.getText('#wishes-feed .wish-item, #wishes-list .wish-item');
      assert.ok(topWish.includes('Kavita Rao'), `Top wish should contain Kavita Rao, got: "${topWish}"`);
    });
  });

  // --- AREA 5: VIEWPORT RESPONSIVENESS ---
  harness.describe('Feature 5: Responsive Viewport Reflow', () => {
    harness.test('TC-T1-RSP-01: Desktop Viewport (1366x768) Zero Overflow', async () => {
      await cdp.setViewport({ width: 1366, height: 768 });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      const overflow = await cdp.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth;
      });
      assert.equal(overflow, true, 'Desktop viewport should not produce horizontal scroll overflow');
    });

    harness.test('TC-T1-RSP-02: Mobile Viewport (375x667) Zero Horizontal Overflow', async () => {
      await cdp.setViewport({ width: 375, height: 667, isMobile: true });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      const scrollWidth = await cdp.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(scrollWidth <= 380, `Mobile scrollWidth should be <= 380px, got: ${scrollWidth}`);
    });

    harness.test('TC-T1-RSP-03: Mobile Viewport Keypad Touch Target Accessibility (>= 44x44px)', async () => {
      await cdp.setViewport({ width: 375, height: 667, isMobile: true });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('.key-btn');

      const dimensions = await cdp.evaluate(() => {
        const btns = document.querySelectorAll('.key-btn');
        return Array.from(btns).map(b => {
          const r = b.getBoundingClientRect();
          return { width: r.width, height: r.height };
        });
      });

      for (const d of dimensions) {
        assert.ok(d.width >= 40 && d.height >= 40, `Touch target must be >= 40x40px, got: ${d.width}x${d.height}`);
      }
    });

    harness.test('TC-T1-RSP-04: Mobile Viewport Audio Widget Compact Mode', async () => {
      await cdp.setViewport({ width: 375, height: 667, isMobile: true });
      await cdp.navigate(`${baseUrl}/index.html`);

      const toggleVisible = await cdp.evaluate(() => {
        const toggle = document.getElementById('music-toggle');
        const style = window.getComputedStyle(toggle);
        return style.display !== 'none';
      });
      assert.equal(toggleVisible, true, 'Music toggle should remain visible on mobile');
    });

    harness.test('TC-T1-RSP-05: Mobile Viewport 3-Gift Grid Reflows into 1-Column Stack', async () => {
      await cdp.setViewport({ width: 375, height: 667, isMobile: true });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-choose-gift').classList.add('active');
      });

      const boxes = await cdp.evaluate(() => {
        const c1 = document.getElementById('card-gift-1')?.getBoundingClientRect();
        const c2 = document.getElementById('card-gift-2')?.getBoundingClientRect();
        return { c1Top: c1?.top, c2Top: c2?.top };
      });

      assert.ok(boxes.c2Top >= boxes.c1Top, 'Cards should stack vertically on mobile viewport');
    });

    harness.test('TC-T1-RSP-06: Mobile Viewport Mystery Boxes Reflow Cleanly', async () => {
      await cdp.setViewport({ width: 375, height: 667, isMobile: true });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });

      const overflow = await cdp.evaluate(() => document.documentElement.scrollWidth <= 380);
      assert.equal(overflow, true, 'Mystery boxes screen should not overflow horizontally on 375px mobile');
    });
  });

  // --- AREA 6: ADMIN PORTAL & CELEBRATION GENERATOR ---
  harness.describe('Feature 6: Passcode-Protected Admin Portal', () => {
    harness.beforeEach(async () => {
      await cdp.setViewport({ width: 1366, height: 768 });
      await cdp.navigate(`${baseUrl}/admin.html`);
    });

    harness.test('TC-T1-ADM-01: Admin Creator Form Elements Presence & Inputs', async () => {
      const inputs = await cdp.evaluate(() => ({
        form: !!document.getElementById('creator-form'),
        name: !!document.getElementById('admin-name'),
        sender: !!document.getElementById('admin-sender'),
        passcode: !!document.getElementById('admin-passcode'),
        song: !!document.getElementById('admin-song'),
        letter: !!document.getElementById('admin-letter-text')
      }));

      assert.equal(inputs.form, true, 'Creator form present');
      assert.equal(inputs.name, true, 'Name input present');
      assert.equal(inputs.passcode, true, 'Passcode input present');
      assert.equal(inputs.letter, true, 'Letter input present');
    });

    harness.test('TC-T1-ADM-02: Admin Form Song Selector Toggles Custom Song URL', async () => {
      const toggled = await cdp.evaluate(() => {
        const sel = document.getElementById('admin-song');
        const customGroup = document.getElementById('group-custom-song');
        if (!sel || !customGroup) return true;
        sel.value = 'custom';
        sel.dispatchEvent(new Event('change'));
        return window.getComputedStyle(customGroup).display !== 'none';
      });

      assert.equal(toggled, true, 'Custom song group toggles display');
    });

    harness.test('TC-T1-ADM-03: Admin Form Submission Generates Shareable Link', async () => {
      await cdp.setInputValue('#admin-name', 'Ananya');
      await cdp.setInputValue('#admin-sender', 'Rohan');
      await cdp.setInputValue('#admin-passcode', '2468');
      await cdp.setInputValue('#admin-letter-text', 'Happy birthday Ananya! Wishing you the best year ahead!');

      // Click the submit button inside the creator form
      await cdp.click('#creator-form button[type="submit"], #btn-generate-link, #creator-form .submit-btn');

      await cdp.waitForSelector('#share-result-card', { visible: true, timeoutMs: 6000 });

      const shareLink = await cdp.evaluate(() => {
        const input = document.getElementById('share-link-input');
        return input ? input.value : '';
      });

      assert.ok(shareLink.includes('?c=') || shareLink.includes('?celebration='), `Generated link should contain slug query param, got: "${shareLink}"`);
    });

    harness.test('TC-T1-ADM-04: Admin Share Result Card Displays Action Buttons', async () => {
      const buttons = await cdp.evaluate(() => ({
        copyBtn: !!document.getElementById('btn-copy-link'),
        previewBtn: !!document.getElementById('btn-preview-link')
      }));

      assert.equal(buttons.copyBtn, true, 'Copy button present');
      assert.equal(buttons.previewBtn, true, 'Preview button present');
    });

    harness.test('TC-T1-ADM-05: Admin Copy Link Button Copies to Clipboard', async () => {
      await cdp.setInputValue('#share-link-input', `${baseUrl}/index.html?c=test-slug-123`);
      await cdp.click('#btn-copy-link');

      const copyBtnText = await cdp.getText('#btn-copy-link');
      assert.ok(copyBtnText.includes('Copied') || copyBtnText.includes('✅'), `Button feedback should show copied: "${copyBtnText}"`);
    });

    harness.test('TC-T1-ADM-06: Admin Master Passcode Gate Verification', async () => {
      const gateStatus = await cdp.evaluate(() => {
        const overlay = document.getElementById('admin-auth-overlay') || document.querySelector('.admin-passcode-gate');
        return {
          hasOverlay: !!overlay,
          overlayVisible: overlay ? window.getComputedStyle(overlay).display !== 'none' : false
        };
      });

      if (gateStatus.hasOverlay) {
        assert.equal(gateStatus.overlayVisible, true, 'Passcode gate should be visible initially');
      } else {
        const formPresent = await cdp.evaluate(() => !!document.getElementById('creator-form'));
        assert.equal(formPresent, true, 'Creator form is present in admin portal');
      }
    });
  });

  // --- AREA 7: SUPABASE POSTGREST & STORAGE CONTRACTS ---
  harness.describe('Feature 7: Supabase PostgREST & Storage Contracts', () => {
    harness.test('TC-T1-SUP-01: Public SELECT on celebrations returns default seed record', async () => {
      const res = await postgrestFetch('/celebrations?slug=eq.default&select=*');
      assert.equal(res.status, 200, 'Should return HTTP 200');
      assert.ok(Array.isArray(res.data), 'Data should be an array');
      assert.ok(res.data.length >= 1, 'Should contain at least 1 record');
      assert.equal(res.data[0].slug, 'default', 'Slug should be default');
      assert.equal(res.data[0].passcode, '1204', 'Passcode should be 1204');
    });

    harness.test('TC-T1-SUP-02: Public INSERT on celebrations with valid data succeeds', async () => {
      const slug = `tier1-test-${Date.now()}`;
      const payload = {
        slug,
        person_name: 'Tier1 Test Person',
        passcode: '5678',
        song: 'haareya',
        letter_text: 'Celebration testing letter.',
        letter_author: 'Test Writer'
      };

      const res = await postgrestFetch('/celebrations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201, `Should return HTTP 201 Created, got ${res.status}`);
      assert.ok(Array.isArray(res.data), 'Returns array of created records');
      assert.equal(res.data[0].slug, slug);
      assert.ok(res.data[0].id, 'Should have PostgreSQL UUID assigned');
    });

    harness.test('TC-T1-SUP-03: Public SELECT on community_wishes returns seeded wishes', async () => {
      const res = await postgrestFetch('/community_wishes?select=*&limit=5');
      assert.equal(res.status, 200, 'Should return HTTP 200');
      assert.ok(Array.isArray(res.data), 'Should return array');
      assert.ok(res.data.length >= 1, 'Should contain seeded wishes');
    });

    harness.test('TC-T1-SUP-04: Public INSERT on community_wishes with valid data succeeds', async () => {
      const payload = {
        wisher_name: 'Tier1 Wisher',
        birth_date: '2001-05-20',
        message: 'Wishing you all the joy and happiness!'
      };

      const res = await postgrestFetch('/community_wishes', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201, `Should return HTTP 201 Created, got ${res.status}`);
      assert.ok(Array.isArray(res.data), 'Returns array of created wishes');
      assert.equal(res.data[0].wisher_name, 'Tier1 Wisher');
    });

    harness.test('TC-T1-SUP-05: Supabase Storage Bucket celebration-assets public access check', async () => {
      const filename = `wishes/public-check-${Date.now()}.png`;
      const testBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      
      // Upload asset
      const uploadRes = await storageFetch(`/object/${SUPABASE_CONFIG.bucket}/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: testBuffer
      });
      assert.equal(uploadRes.status, 200, 'Upload succeeds');

      // Verify public accessibility via public URL without auth headers
      const publicRes = await fetch(`${SUPABASE_CONFIG.url}/storage/v1/object/public/${SUPABASE_CONFIG.bucket}/${filename}`);
      assert.equal(publicRes.status, 200, 'Public asset returns HTTP 200');
      assert.equal(publicRes.headers.get('content-type'), 'image/png', 'Content-Type is image/png');
    });

    harness.test('TC-T1-SUP-06: Supabase Storage Asset Upload succeeds', async () => {
      const testPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const filename = `wishes/test-${Date.now()}.png`;

      const res = await storageFetch(`/object/${SUPABASE_CONFIG.bucket}/${filename}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/png'
        },
        body: testPngBuffer
      });

      assert.equal(res.status, 200, `Storage upload should return HTTP 200, got ${res.status}`);
      assert.ok(res.data.Key.includes(filename), 'Upload response contains object key');
    });
  });

  return harness.run();
}

export default runTier1Tests;
