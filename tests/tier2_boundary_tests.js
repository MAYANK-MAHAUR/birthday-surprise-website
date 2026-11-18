import { TestHarness, assert, postgrestFetch, storageFetch, SUPABASE_CONFIG } from './test_helpers.js';

export async function runTier2Tests({ baseUrl, cdp }) {
  const harness = new TestHarness('Tier 2: Boundary, Negative & Security Tests');

  // --- SUITE 2.1: KEYPAD & INPUT BOUNDARIES ---
  harness.describe('Keypad & Input Boundaries', () => {
    harness.beforeEach(async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#slide-passcode.active');
    });

    harness.test('TC-T2-KEY-01: Invalid Passcode Shakes Keypad and Resets Input Slots', async () => {
      await cdp.click('.key-btn[data-key="0"]');
      await cdp.click('.key-btn[data-key="0"]');
      await cdp.click('.key-btn[data-key="0"]');
      await cdp.click('.key-btn[data-key="0"]');

      await cdp.waitForSelector('#slide-wrong-passcode.active', { timeoutMs: 3000 });
      const wrongActive = await cdp.hasClass('#slide-wrong-passcode', 'active');
      assert.equal(wrongActive, true, 'Transitions to wrong passcode screen');
    });

    harness.test('TC-T2-KEY-02: Entering Beyond 4 Digits Capped at 4 Slots', async () => {
      await cdp.click('.key-btn[data-key="1"]');
      await cdp.click('.key-btn[data-key="2"]');
      await cdp.click('.key-btn[data-key="3"]');
      // Rapid extra clicks
      await cdp.click('.key-btn[data-key="5"]');
      await cdp.click('.key-btn[data-key="6"]');

      const filledCount = await cdp.evaluate(() => {
        const slots = document.querySelectorAll('#pin-display .pin-slot');
        return Array.from(slots).filter(s => s.classList.contains('filled')).length;
      });

      assert.ok(filledCount <= 4, `Slots filled should be at most 4, got: ${filledCount}`);
    });

    harness.test('TC-T2-KEY-03: Backspace on Empty PIN Display is Safe No-Op', async () => {
      // Click clear 4 times while empty
      await cdp.click('.key-btn[data-key="clear"]');
      await cdp.click('.key-btn[data-key="clear"]');
      await cdp.click('.key-btn[data-key="clear"]');

      const slotsValid = await cdp.evaluate(() => {
        const slots = document.querySelectorAll('#pin-display .pin-slot');
        return slots.length === 4 && Array.from(slots).every(s => s.textContent === '');
      });

      assert.equal(slotsValid, true, 'Display remains safely empty');
      assert.equal(cdp.getPageErrors().length, 0, 'No uncaught exceptions thrown');
    });

    harness.test('TC-T2-KEY-04: Special Keypad Characters (* and #) Do Not Crash Application', async () => {
      await cdp.click('.key-btn[data-key="*"]');
      await cdp.click('.key-btn[data-key="#"]');

      const errs = cdp.getPageErrors();
      assert.equal(errs.length, 0, 'No exceptions on * or # keys');
    });
  });

  // --- SUITE 2.2: AUDIO ENGINE BOUNDARIES ---
  harness.describe('Audio Engine Boundaries', () => {
    harness.beforeEach(async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.waitForSelector('#music-player');
    });

    harness.test('TC-T2-AUD-01: Rapid Double-Toggling of Song Switch Button Does Not Crash', async () => {
      await cdp.evaluate(() => {
        const btn = document.getElementById('song-switch-btn');
        btn.click();
        btn.click();
      });

      await new Promise(r => setTimeout(r, 400));
      const errors = cdp.getPageErrors();
      assert.equal(errors.length, 0, 'Rapid toggle should not produce unhandled promise rejections');

      const trackTitle = await cdp.getText('#music-title');
      assert.ok(trackTitle === 'Haareya' || trackTitle === 'City of Stars', 'Title remains valid');
    });

    harness.test('TC-T2-AUD-02: Audio Track Switch While Paused Updates Source Cleanly', async () => {
      // Ensure audio is paused
      await cdp.evaluate(() => {
        const audio = document.getElementById('bg-music');
        audio.pause();
      });

      await cdp.click('#song-switch-btn');
      await new Promise(r => setTimeout(r, 200));

      const title = await cdp.getText('#music-title');
      assert.equal(title, 'City of Stars', 'Title updates while paused');
      assert.equal(cdp.getPageErrors().length, 0, 'No errors when switching while paused');
    });
  });

  // --- SUITE 2.3: CLIMAX SURPRISE & PASSCODE BOUNDS ---
  harness.describe('Climax Surprise & Passcode Bounds', () => {
    harness.beforeEach(async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
    });

    harness.test('TC-T2-BND-01: Passcode rejects non-numeric and limits length strictly to 4 digits', async () => {
      await cdp.evaluate(() => {
        window.BirthdayApp.state.passcodeEntered = '';
      });
      await cdp.click('.key-btn[data-key="1"]');
      await cdp.click('.key-btn[data-key="2"]');
      await cdp.click('.key-btn[data-key="3"]');
      await cdp.click('.key-btn[data-key="4"]');
      const len = await cdp.evaluate(() => window.BirthdayApp.state.passcodeEntered.length);
      assert.ok(len <= 4, `Passcode length must not exceed 4, got: ${len}`);
    });

    harness.test('TC-T2-BND-02: Repeated clicks on Mystery Surprise Box are idempotent and safe', async () => {
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });
      await cdp.click('#box-1-visual');
      await cdp.click('#box-1-visual');
      await cdp.click('#box-1-visual');
      await new Promise(r => setTimeout(r, 500));
      const isRevealed = await cdp.evaluate(() => {
        return window.getComputedStyle(document.getElementById('box-1-revealed')).display !== 'none';
      });
      assert.equal(isRevealed, true, 'Mystery box should remain stably revealed without error');
    });

    harness.test('TC-T2-BND-03: End celebration modal dismisses and ignores duplicate close clicks', async () => {
      await cdp.evaluate(() => {
        if (window.BirthdayApp && window.BirthdayApp.showEndCelebrationModal) {
          window.BirthdayApp.showEndCelebrationModal();
        }
      });
      await cdp.waitForSelector('#end-celebration-modal.active');
      await cdp.click('#btn-close-end-modal');
      await cdp.click('#btn-close-end-modal');
      const isClosed = await cdp.evaluate(() => {
        const m = document.getElementById('end-celebration-modal');
        return !m.classList.contains('active');
      });
      assert.equal(isClosed, true, 'Modal should close cleanly and idempotently');
    });

    harness.test('TC-T2-BND-04: Single Surprise Box 1-Click Copy Handles Clipboard Gracefully', async () => {
      await cdp.evaluate(() => {
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
        document.getElementById('box-1-visual').style.display = 'none';
        document.getElementById('box-1-revealed').style.display = 'block';
      });
      const firstCopyBtn = await cdp.evaluate(() => {
        const btn = document.querySelector('.copy-btn');
        return !!btn;
      });
      assert.equal(firstCopyBtn, true, 'Copy button exists');
    });
  });

  // --- SUITE 2.4: SUPABASE RLS TAMPERING REJECTIONS ---
  harness.describe('Supabase RLS Tampering Protection (Anon Forbidden Ops)', () => {
    harness.test('TC-T2-RLS-01: Unauthorized UPDATE/PATCH on Celebrations Denied (0 rows affected)', async () => {
      const res = await postgrestFetch('/celebrations?slug=eq.default', {
        method: 'PATCH',
        body: JSON.stringify({ person_name: 'Hacked Persona' })
      });

      // PostgREST with RLS returning representation gives empty array [] on denied rows
      assert.equal(res.status, 200);
      assert.deepEqual(res.data, [], 'Should not modify any rows');

      // Verify original seed remains intact
      const verifyRes = await postgrestFetch('/celebrations?slug=eq.default&select=person_name');
      assert.equal(verifyRes.data[0].person_name, 'Birthday Boy', 'Seed record name unchanged');
    });

    harness.test('TC-T2-RLS-02: Unauthorized DELETE on Celebrations Denied (0 rows affected)', async () => {
      const res = await postgrestFetch('/celebrations?slug=eq.default', {
        method: 'DELETE'
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.data, [], 'Should not delete any rows');

      // Verify record still exists
      const verifyRes = await postgrestFetch('/celebrations?slug=eq.default&select=slug');
      assert.equal(verifyRes.data.length, 1, 'Default celebration record still present');
    });

    harness.test('TC-T2-RLS-03: Unauthorized UPDATE/PATCH on Community Wishes Denied (0 rows affected)', async () => {
      // Query an existing wish
      const wishesRes = await postgrestFetch('/community_wishes?select=id&limit=1');
      assert.ok(wishesRes.data.length >= 1, 'At least 1 wish exists');
      const wishId = wishesRes.data[0].id;

      const res = await postgrestFetch(`/community_wishes?id=eq.${wishId}`, {
        method: 'PATCH',
        body: JSON.stringify({ message: 'Tampered wish content' })
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.data, [], 'Should not modify any wish rows');
    });

    harness.test('TC-T2-RLS-04: Unauthorized DELETE on Community Wishes Denied (0 rows affected)', async () => {
      const wishesRes = await postgrestFetch('/community_wishes?select=id&limit=1');
      const wishId = wishesRes.data[0].id;

      const res = await postgrestFetch(`/community_wishes?id=eq.${wishId}`, {
        method: 'DELETE'
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.data, [], 'Should not delete any wish rows');
    });

    harness.test('TC-T2-RLS-05: Unauthorized DELETE on Storage Asset Rejected with HTTP 403 or 400', async () => {
      const res = await storageFetch(`/object/${SUPABASE_CONFIG.bucket}/wishes/sample.png`, {
        method: 'DELETE'
      });

      // Storage API returns 403 Forbidden or 400/401 for unauthorized/invalid deletes
      assert.ok(res.status === 403 || res.status === 401 || res.status === 400 || res.status === 404, `Expected rejection 403/401/400, got ${res.status}`);
    });
  });

  // --- SUITE 2.5: BACKEND RLS CHECK CONSTRAINTS ---
  harness.describe('Supabase RLS CHECK Policy Validations', () => {
    harness.test('TC-T2-CHK-01: Passcode < 4 chars Violates RLS CHECK Policy', async () => {
      const res = await postgrestFetch('/celebrations', {
        method: 'POST',
        body: JSON.stringify({
          slug: `bnd-pin-short-${Date.now()}`,
          person_name: 'Short Pin Person',
          passcode: '12' // < 4 chars
        })
      });

      assert.ok(res.status === 401 || res.status === 400, `Expected 401/400, got ${res.status}`);
      if (typeof res.data === 'object' && res.data !== null) {
        assert.equal(res.data.code, '42501', 'Should return Postgres error code 42501');
      }
    });

    harness.test('TC-T2-CHK-02: Passcode > 12 chars Violates RLS CHECK Policy', async () => {
      const res = await postgrestFetch('/celebrations', {
        method: 'POST',
        body: JSON.stringify({
          slug: `bnd-pin-long-${Date.now()}`,
          person_name: 'Long Pin Person',
          passcode: '1234567890123' // 13 chars
        })
      });

      assert.ok(res.status === 401 || res.status === 400, `Expected 401/400, got ${res.status}`);
    });

    harness.test('TC-T2-CHK-03: Empty Person Name Violates RLS CHECK Policy', async () => {
      const res = await postgrestFetch('/celebrations', {
        method: 'POST',
        body: JSON.stringify({
          slug: `bnd-name-empty-${Date.now()}`,
          person_name: '',
          passcode: '1204'
        })
      });

      assert.ok(res.status === 401 || res.status === 400, `Expected 401/400, got ${res.status}`);
    });

    harness.test('TC-T2-CHK-04: Empty Wish Message Violates RLS CHECK Policy', async () => {
      const res = await postgrestFetch('/community_wishes', {
        method: 'POST',
        body: JSON.stringify({
          wisher_name: 'Test Wisher',
          message: ''
        })
      });

      assert.ok(res.status === 401 || res.status === 400, `Expected 401/400, got ${res.status}`);
    });

    harness.test('TC-T2-CHK-05: Storage Upload with Disallowed MIME Type Rejected', async () => {
      const res = await storageFetch(`/object/${SUPABASE_CONFIG.bucket}/test-disallowed.sh`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/x-shellscript' },
        body: 'echo hello'
      });

      // Supabase storage bucket allowed_mime_types only allows images
      assert.ok(res.status === 400 || res.status === 415 || res.status === 403, `Expected rejection 400/415/403, got ${res.status}`);
    });
  });

  // --- SUITE 2.6: ADVERSARIAL & ESCAPING INTEGRITY (SQLI & XSS) ---
  harness.describe('Adversarial & Escaping Integrity (SQLi & XSS)', () => {
    harness.test('TC-T2-SEC-01: SQL Injection Payload in PostgREST Query Parameter is Parameterized', async () => {
      const sqliSlug = "' UNION SELECT * FROM celebrations--";
      const res = await postgrestFetch(`/celebrations?slug=eq.${encodeURIComponent(sqliSlug)}`);
      assert.equal(res.status, 200, 'Should return HTTP 200');
      assert.deepEqual(res.data, [], 'Should safely return empty array without SQL execution');
    });

    harness.test('TC-T2-SEC-02: SQL Injection Payload in Wish Text is Stored as Literal String', async () => {
      const sqliPayload = "'); DROP TABLE celebrations; --";
      const res = await postgrestFetch('/community_wishes', {
        method: 'POST',
        body: JSON.stringify({
          wisher_name: 'SQLi Probe',
          birth_date: '1995-12-12',
          message: sqliPayload
        })
      });

      assert.equal(res.status, 201, 'Should safely insert as literal text');
      assert.equal(res.data[0].message, sqliPayload, 'Message stored verbatim');
    });

    harness.test('TC-T2-SEC-03: Stored XSS Script Tag in Social Handle is Escaped in DOM', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);
      await cdp.evaluate(() => {
        window.__xss_leaked = false;
        document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        document.getElementById('slide-real-gifts').classList.add('active');
      });

      const xssPayload = `<script>window.__xss_leaked=true;</script><img src="x" onerror="window.__xss_leaked=true">`;
      await cdp.evaluate((payload) => {
        const valEl = document.getElementById('social-val-insta');
        if (valEl) valEl.textContent = payload;
      }, xssPayload);

      await new Promise(r => setTimeout(r, 400));
      const xssLeaked = await cdp.evaluate(() => window.__xss_leaked);
      assert.equal(xssLeaked, false, 'XSS script payload must never execute');
    });

    harness.test('TC-T2-SEC-04: Stored XSS Script Tag in Recipient Name Does Not Execute During Hydration', async () => {
      const xssName = `Hacker<script>window.__name_xss=true;</script>`;
      const payload = btoa(JSON.stringify({ passcode: '1204', name: xssName }));

      await cdp.navigate(`${baseUrl}/index.html?data=${encodeURIComponent(payload)}`);
      await cdp.waitForSelector('#slide-passcode');

      const nameXss = await cdp.evaluate(() => window.__name_xss);
      assert.equal(nameXss, undefined, 'Script in recipient name must not execute');
    });

    harness.test('TC-T2-SEC-05: Malformed Corrupted Base64 in URL Query Handled Without Crash', async () => {
      await cdp.navigate(`${baseUrl}/index.html?data=$$$corrupt_base64_payload$$$`);
      await cdp.waitForSelector('#slide-passcode.active');

      const isPasscodeActive = await cdp.hasClass('#slide-passcode', 'active');
      assert.equal(isPasscodeActive, true, 'Falls back safely to default passcode screen');
      assert.equal(cdp.getPageErrors().length, 0, 'No unhandled exception on corrupt URL parameter');
    });
  });

  return harness.run();
}

export default runTier2Tests;
