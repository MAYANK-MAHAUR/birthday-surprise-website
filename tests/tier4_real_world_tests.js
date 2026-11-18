import { TestHarness, assert, postgrestFetch } from './test_helpers.js';

export async function runTier4Tests({ baseUrl, cdp }) {
  const harness = new TestHarness('Tier 4: Real-World Persona Scenarios');

  harness.describe('Real-World User Journeys', () => {
    // --- SCENARIO 4.1: THE ROMANTIC BIRTHDAY WALKTHROUGH ---
    harness.test('Scenario 4.1: Romantic Celebration Walkthrough (Complete Happy Path)', async () => {
      await cdp.setViewport({ width: 1366, height: 768 });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      // 1. Enter passcode 1204
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="4"]');

      // 2. Surprise screen
      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-surprise-yes');

      // 3. Birthday spread / cake screen
      await cdp.waitForFunction(() => {
        const spread = document.getElementById('slide-bday-spread');
        const cake = document.getElementById('slide-candles');
        return (spread && spread.classList.contains('active')) || (cake && cake.classList.contains('active'));
      }, { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      const isSpread = await cdp.hasClass('#slide-bday-spread', 'active');
      if (isSpread) {
        await cdp.click('#btn-bday-celebrate, #slide-bday-spread button');
        await cdp.waitForSelector('#slide-candles.active', { timeoutMs: 5000 });
        await new Promise(r => setTimeout(r, 600));
      }

      // 4. Blow out candles
      await cdp.click('#cake-container');
      await cdp.waitForSelector('#slide-celebration.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 5. Advance to Accept Gifts
      await cdp.click('#btn-to-accept-gifts');
      await cdp.waitForSelector('#slide-accept-gifts.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 6. Click YES to accept gifts
      await cdp.click('#btn-accept-yes');
      await cdp.waitForSelector('#slide-choose-gift.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 7. Open Gift 1 (Letter)
      await cdp.click('#card-gift-1');
      await cdp.waitForSelector('#slide-letter.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-back-from-letter');
      await cdp.waitForSelector('#slide-choose-gift.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 8. Open Gift 2 (Flowers)
      await cdp.click('#card-gift-2');
      await cdp.waitForSelector('#slide-flowers.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-back-from-flowers');
      await cdp.waitForSelector('#slide-choose-gift.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 9. Open Gift 3 (Scrapbook) -> Advance to Real Gifts
      await cdp.click('#card-gift-3');
      await cdp.waitForSelector('#slide-scrapbook.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-to-real-gift');
      await cdp.waitForSelector('#slide-real-gifts.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 10. Unwrap Single Mystery Surprise Box
      await cdp.click('#box-1-visual');
      await cdp.waitForFunction(() => window.getComputedStyle(document.getElementById('box-1-revealed')).display !== 'none');

      // Final checks
      const errors = cdp.getPageErrors();
      assert.equal(errors.length, 0, 'Zero uncaught runtime errors during walkthrough');
    });

    // --- SCENARIO 4.2: THE PLAYFUL HESITANT WALKTHROUGH ---
    harness.test('Scenario 4.2: Playful Hesitant Walkthrough (Comic Detours & Resets)', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      // 1. Enter wrong passcode 0000
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');

      // 2. Comic Screen 1
      await cdp.waitForSelector('#slide-wrong-passcode.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-wrong-passcode-retry');
      await cdp.waitForSelector('#slide-passcode.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 3. Enter correct passcode 1204
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="2"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="4"]');
      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 4. Playfully click NO on surprise
      await cdp.click('#btn-surprise-no');
      await cdp.waitForSelector('#slide-how-dare-you.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-how-dare-retry');
      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 5. Advance to Accept Gifts
      await cdp.click('#btn-surprise-yes');
      await cdp.waitForFunction(() => {
        const spread = document.getElementById('slide-bday-spread');
        const cake = document.getElementById('slide-candles');
        return (spread && spread.classList.contains('active')) || (cake && cake.classList.contains('active'));
      }, { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-accept-gifts').classList.add('active');
      });

      // 6. Playfully click NO on accept gifts
      await cdp.click('#btn-accept-no');
      await cdp.waitForSelector('#slide-crying-cat.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-crying-okay');
      await cdp.waitForSelector('#slide-accept-gifts.active', { timeoutMs: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // 7. Click YES to reach gifts
      await cdp.click('#btn-accept-yes');
      await cdp.waitForSelector('#slide-choose-gift.active', { timeoutMs: 5000 });

      const chooseGiftActive = await cdp.hasClass('#slide-choose-gift', 'active');
      assert.equal(chooseGiftActive, true, 'Successfully recovered from all comic detours');
    });

    // --- SCENARIO 4.3: MOBILE TOUCH CELEBRATION (375x667) ---
    harness.test('Scenario 4.3: Mobile Touch Celebration Walkthrough (375x667)', async () => {
      await cdp.setViewport({ width: 375, height: 667, isMobile: true });
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');

      const screens = ['slide-passcode', 'slide-surprise', 'slide-candles', 'slide-choose-gift', 'slide-real-gifts'];
      for (const sid of screens) {
        await cdp.evaluate((id) => {
          document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
          document.getElementById(id).classList.add('active');
        }, sid);

        const scrollW = await cdp.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(scrollW <= 380, `Screen ${sid} horizontal scrollWidth must be <= 380px, got: ${scrollW}`);
      }
    });

    // --- SCENARIO 4.4: ADMIN CELEBRATION CREATION & HYDRATION ---
    harness.test('Scenario 4.4: Admin Custom Celebration Creation & Recipient Hydration', async () => {
      await cdp.setViewport({ width: 1366, height: 768 });
      await cdp.navigate(`${baseUrl}/admin.html`);

      // Creator fills form
      await cdp.setInputValue('#admin-name', 'Ishita');
      await cdp.setInputValue('#admin-sender', 'Aarav');
      await cdp.setInputValue('#admin-passcode', '3311');
      await cdp.setInputValue('#admin-letter-text', 'Ishita, from our late-night drives to quiet mornings, every moment is treasure. Happy Birthday!');

      await cdp.click('#creator-form button[type="submit"], #btn-generate-link, #creator-form .submit-btn');

      await cdp.waitForSelector('#share-result-card', { visible: true, timeoutMs: 6000 });
      const shareUrl = await cdp.evaluate(() => document.getElementById('share-link-input')?.value);
      assert.ok(shareUrl.length > 0, 'Shareable link generated');

      // Simulate recipient receiving and opening custom celebration via URL data fallback or slug
      const customData = Buffer.from(JSON.stringify({
        name: 'Ishita',
        sender_name: 'Aarav',
        passcode: '3311',
        letter_text: 'Ishita, from our late-night drives to quiet mornings, every moment is treasure. Happy Birthday!'
      }), 'utf8').toString('base64');

      await cdp.navigate(`${baseUrl}/index.html?data=${encodeURIComponent(customData)}`);
      await cdp.waitForSelector('#slide-passcode.active');

      // Verify recipient sees Ishita
      const title = await cdp.evaluate(() => document.title);
      assert.ok(title.includes('Ishita'), `Document title contains Ishita: "${title}"`);

      // Verify incorrect passcode 0000 fails
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await cdp.waitForSelector('#slide-wrong-passcode.active', { timeoutMs: 8000 });
      await new Promise(r => setTimeout(r, 600));
      await cdp.click('#btn-wrong-passcode-retry');
      await cdp.waitForSelector('#slide-passcode.active', { timeoutMs: 8000 });
      await new Promise(r => setTimeout(r, 600));

      // Verify 3311 succeeds
      await cdp.click('.key-btn[data-key="3"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="3"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="1"]');

      await cdp.waitForFunction(() => !document.getElementById('slide-passcode').classList.contains('active'), { timeoutMs: 5000 });
      const isUnlocked = await cdp.hasClass('#slide-passcode', 'active');
      assert.equal(isUnlocked, false, 'Custom passcode 3311 successfully unlocks the site');
    });

    // --- SCENARIO 4.5: MULTI-USER COMMUNITY WISHING ---
    harness.test('Scenario 4.5: Multi-User Community Wishing & Live Persistence', async () => {
      // Friend 1 submits wish
      const wish1Res = await postgrestFetch('/community_wishes', {
        method: 'POST',
        body: JSON.stringify({
          wisher_name: 'Tanvi',
          birth_date: '1999-02-14',
          message: 'Happy birthday dearest! Keep smiling always!'
        })
      });
      assert.equal(wish1Res.status, 201);

      // Friend 2 submits wish
      const wish2Res = await postgrestFetch('/community_wishes', {
        method: 'POST',
        body: JSON.stringify({
          wisher_name: 'Karan',
          birth_date: '1997-11-05',
          message: 'Party hard bro! Many happy returns!'
        })
      });
      assert.equal(wish2Res.status, 201);

      // Query wishes list to verify both exist
      const listRes = await postgrestFetch('/community_wishes?order=created_at.desc&limit=10');
      assert.equal(listRes.status, 200);

      const names = listRes.data.map(w => w.wisher_name);
      assert.ok(names.includes('Tanvi'), 'Tanvi wish persisted in database');
      assert.ok(names.includes('Karan'), 'Karan wish persisted in database');
    });

    // --- SCENARIO 4.6: PUBLIC LINK TAMPERING & SECURITY ISOLATION ---
    harness.test('Scenario 4.6: Public Link Tampering & Isolation Check', async () => {
      // 1. Malicious attempt to delete celebration
      const delRes = await postgrestFetch('/celebrations?slug=eq.default', { method: 'DELETE' });
      assert.equal(delRes.status, 200);
      assert.deepEqual(delRes.data, [], 'Tampering DELETE blocked by RLS');

      // 2. Malicious attempt to update celebration
      const patchRes = await postgrestFetch('/celebrations?slug=eq.default', {
        method: 'PATCH',
        body: JSON.stringify({ passcode: '0000' })
      });
      assert.equal(patchRes.status, 200);
      assert.deepEqual(patchRes.data, [], 'Tampering PATCH blocked by RLS');

      // 3. Duplicate slug insertion should fail
      const dupRes = await postgrestFetch('/celebrations', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'default',
          person_name: 'Duplicate Intruder',
          passcode: '9999'
        })
      });
      assert.ok(dupRes.status === 409 || dupRes.status === 400 || dupRes.status === 401, 'Duplicate slug insertion rejected by constraint');
    });
  });

  return harness.run();
}

export default runTier4Tests;
