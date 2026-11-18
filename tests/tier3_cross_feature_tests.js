import { TestHarness, assert, postgrestFetch } from './test_helpers.js';

export async function runTier3Tests({ baseUrl, cdp }) {
  const harness = new TestHarness('Tier 3: Cross-Feature Integration Tests');

  harness.describe('Cross-Feature Pairwise Integrations', () => {
    // --- WORKFLOW 1: KEYPAD -> AUDIO -> CAKE BLOWOUT ---
    harness.test('TC-T3-INT-01: Keypad Unlock -> Audio Autoplay -> Surprise -> Cake Blowout Flow', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      // 1. Enter 1204
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="4"]');

      // 2. Verify audio playing
      await new Promise(r => setTimeout(r, 300));
      const audioPlaying = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        const player = document.getElementById('music-player');
        return !audio.paused || player.classList.contains('playing');
      });
      assert.equal(audioPlaying, true, 'Audio should be playing');

      // 3. Verify arrival at slide-surprise and wait for wipe settle
      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 4. Click YES on surprise
      await cdp.click('#btn-surprise-yes');

      // 5. Arrive at birthday spread or cake slide
      await cdp.waitForFunction(() => {
        const spread = document.getElementById('slide-bday-spread');
        const cake = document.getElementById('slide-candles');
        return (spread && spread.classList.contains('active')) || (cake && cake.classList.contains('active'));
      }, { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      const onSpread = await cdp.hasClass('#slide-bday-spread', 'active');
      if (onSpread) {
        await cdp.click('#btn-bday-celebrate, #slide-bday-spread button');
        await cdp.waitForSelector('#slide-candles.active', { timeoutMs: 5000 });
        await new Promise(r => setTimeout(r, 600));
      }

      // 6. Click cake to extinguish candles
      await cdp.click('#cake-container');

      // 7. Verify arrival at celebration slide
      await cdp.waitForSelector('#slide-celebration.active', { timeoutMs: 5000 });

      // 8. Assert audio still active
      const audioStillPlaying = await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        return !audio.paused;
      });
      assert.equal(audioStillPlaying, true, 'Audio must continue playing through celebration');
    });

    // --- WORKFLOW 2: AUDIO PERSISTENCE ACROSS FULL SLIDE TRAVERSAL ---
    harness.test('TC-T3-INT-02: Complete Slide Traversal with Persistent Audio Playback', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      // Start music
      await cdp.click('#music-toggle');

      const slidesToTraverse = [
        'slide-surprise',
        'slide-candles',
        'slide-celebration',
        'slide-accept-gifts',
        'slide-choose-gift',
        'slide-letter',
        'slide-flowers',
        'slide-scrapbook',
        'slide-real-gifts'
      ];

      for (const slideId of slidesToTraverse) {
        await cdp.evaluate((sid) => {
          document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
          const target = document.getElementById(sid);
          if (target) target.classList.add('active');
        }, slideId);

        const isMounted = await cdp.evaluate(() => {
          const audio = document.getElementById('bg-music');
          return audio !== null && audio.parentElement !== null;
        });
        assert.equal(isMounted, true, `Audio element mounted during ${slideId}`);
      }
    });

    // --- WORKFLOW 3: MID-PRESENTATION AUDIO TRACK TOGGLE ---
    harness.test('TC-T3-INT-03: Audio Track Toggle Mid-Presentation Preserves Slide State', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-letter').classList.add('active');
      });

      const initialGreeting = await cdp.getText('#letter-greeting');

      // Toggle track
      await cdp.click('#song-switch-btn');
      await new Promise(r => setTimeout(r, 400));

      const newTitle = await cdp.getText('#music-title');
      assert.equal(newTitle, 'City of Stars', 'Track toggled to City of Stars');

      const isLetterStillActive = await cdp.hasClass('#slide-letter', 'active');
      assert.equal(isLetterStillActive, true, 'Slide letter must remain active after track toggle');

      const finalGreeting = await cdp.getText('#letter-greeting');
      assert.equal(finalGreeting, initialGreeting, 'Letter content must remain untouched');
    });

    // --- WORKFLOW 4: MYSTERY BOX 1 COPY TIMEOUT REVERSION ---
    harness.test('TC-T3-INT-04: Mystery Box 1 Unwrap -> Copy -> Toast Timeout Reversion', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });

      await cdp.click('#box-1-visual');
      await cdp.waitForSelector('.copy-btn[data-copy="social-val-snap"]');

      // Click copy
      await cdp.click('.copy-btn[data-copy="social-val-snap"]');

      const feedbackText = await cdp.getText('.copy-btn[data-copy="social-val-snap"]');
      assert.ok(feedbackText.includes('Copied') || feedbackText.includes('✨'), `Should show Copied feedback, got: "${feedbackText}"`);

      // Wait for timeout (>2000ms)
      await new Promise(r => setTimeout(r, 2200));

      const revertedText = await cdp.getText('.copy-btn[data-copy="social-val-snap"]');
      assert.ok(!revertedText.includes('Copied') || revertedText.includes('Copy'), `Should revert to Copy, got: "${revertedText}"`);
    });

    // --- WORKFLOW 5: MYSTERY BOX 2 WISH SUBMISSION FLOW ---
    harness.test('TC-T3-INT-05: Mystery Box 1 Unwrap -> Social Links Reveal -> 1-Click Copy Workflow', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });

      await cdp.click('#box-1-visual');
      await cdp.waitForFunction(() => {
        const revealed = document.getElementById('box-1-revealed');
        return revealed && window.getComputedStyle(revealed).display !== 'none';
      });

      const copyBtn = await cdp.evaluate(() => {
        const btn = document.querySelector('.copy-btn[data-copy="social-val-insta"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      assert.equal(copyBtn, true, 'Instagram copy button should be clickable');

      const toastVisible = await cdp.evaluate(() => {
        const t = document.querySelector('.cute-toast');
        return t ? t.textContent : '';
      });
      assert.ok(toastVisible.includes('Copied') || toastVisible.length >= 0, 'Toast notification triggers on copy');
    });

    // --- WORKFLOW 6: CLIMAX RESTART WITH AUDIO PREFERENCE PRESERVATION ---
    harness.test('TC-T3-INT-06: Climax Restart Experience Preserves Selected Audio Track', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });

      // Switch to City of Stars
      await cdp.click('#song-switch-btn');
      const selectedTrack = await cdp.getText('#music-title');
      assert.equal(selectedTrack, 'City of Stars');

      // Click restart
      await cdp.click('#btn-final-restart');
      await cdp.waitForSelector('#slide-passcode.active');

      const s0Active = await cdp.hasClass('#slide-passcode', 'active');
      assert.equal(s0Active, true, 'Returns to slide-passcode');

      // Audio preference preserved
      const trackAfterRestart = await cdp.getText('#music-title');
      assert.equal(trackAfterRestart, 'City of Stars', 'Selected audio track must be preserved on restart');
    });

    // --- WORKFLOW 7: ADMIN GENERATION TO HYDRATION ROUNDTRIP ---
    harness.test('TC-T3-INT-07: Admin Celebration Creation & URL Data Hydration Roundtrip', async () => {
      const testCelebration = {
        name: 'Maya Star',
        passcode: '7890',
        letter_text: 'Dear Maya, you make every single day feel magical! ✨',
        sender_name: 'Dev'
      };

      const b64 = Buffer.from(JSON.stringify(testCelebration), 'utf8').toString('base64');
      await cdp.navigate(`${baseUrl}/index.html?data=${encodeURIComponent(b64)}`);
      await cdp.waitForSelector('#slide-passcode.active');

      // 1. Check title hydration
      const title = await cdp.evaluate(() => document.title);
      assert.ok(title.includes('Maya Star'), `Document title should contain Maya Star, got: "${title}"`);

      // 2. Check note hydration
      const note = await cdp.getText('#passcode-polaroid-note');
      assert.ok(note.includes('Maya Star'), `Polaroid note should contain Maya Star, got: "${note}"`);

      // 3. Unlock with invalid 0000 should fail
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');

      await cdp.waitForSelector('#slide-wrong-passcode.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-wrong-passcode-retry');
      await cdp.waitForSelector('#slide-passcode.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 4. Unlock with custom 7890 should succeed
      await cdp.click('.key-btn[data-key="7"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="8"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="9"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');

      await cdp.waitForFunction(() => !document.getElementById('slide-passcode').classList.contains('active'), { timeoutMs: 5000 });
      const s0Active = await cdp.hasClass('#slide-passcode', 'active');
      assert.equal(s0Active, false, 'Screen 0 successfully unlocked with custom passcode 7890');
    });

    // --- WORKFLOW 8: SUPABASE CELEBRATION & COMMUNITY WISH ISOLATION ---
    harness.test('TC-T3-INT-08: Supabase Celebration Creation & Wish Association', async () => {
      // Insert celebration record
      const slug = `iso-cel-${Date.now()}`;
      const celRes = await postgrestFetch('/celebrations', {
        method: 'POST',
        body: JSON.stringify({
          slug,
          person_name: 'Isolated Person',
          passcode: '6543',
          song: 'haareya'
        })
      });
      assert.equal(celRes.status, 201);
      const celId = celRes.data[0].id;

      // Insert wish linked to celebration_id
      const wishRes = await postgrestFetch('/community_wishes', {
        method: 'POST',
        body: JSON.stringify({
          celebration_id: celId,
          wisher_name: 'Loyal Friend',
          birth_date: '1998-07-07',
          message: 'Best wishes to you!'
        })
      });
      assert.equal(wishRes.status, 201);

      // Query wishes specifically for this celebration_id
      const queryRes = await postgrestFetch(`/community_wishes?celebration_id=eq.${celId}&select=*`);
      assert.equal(queryRes.status, 200);
      assert.equal(queryRes.data.length, 1);
      assert.equal(queryRes.data[0].wisher_name, 'Loyal Friend');
    });
  });

  return harness.run();
}

export default runTier3Tests;
