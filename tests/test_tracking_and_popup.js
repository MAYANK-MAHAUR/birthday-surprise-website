#!/usr/bin/env node

/**
 * Test Suite: Creator Telemetry Tracking, Emphasized "Create Yours" & End Celebration Pop-Up
 * Verifies:
 * 1. Creator IP, device, and payload telemetry collection
 * 2. Supabase persistence in creator_activity_logs & celebrations tables
 * 3. Emphasized "Create Yours" floating button & in-slide CTA banner
 * 4. End Celebration Pop-up Modal behavior (display, CTA link, dismiss, replay)
 * 5. Automated trigger of End Pop-up upon unboxing both mystery boxes
 */

import assert from 'node:assert/strict';
import { createStaticServer } from './server.js';
import { CDPDriver } from './cdp-driver.js';
import {
  collectCreatorTelemetry,
  formatCelebrationPayload
} from '../admin.js';
import { SupabaseCelebrationClient } from '../supabase-client.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n======================================================================');
  console.log('   CREATOR TELEMETRY TRACKING & END CELEBRATION POP-UP SUITE');
  console.log('======================================================================\n');

  // --- SUITE 1: CREATOR TELEMETRY ENGINE ---
  console.log('▶ Suite 1: Creator Telemetry Collection & Audit Payload');

  await runAsyncTest('TC-TRACK-01: collectCreatorTelemetry gathers IP, device, and environment info', async () => {
    const tele = await collectCreatorTelemetry();
    assert.ok(tele, 'Telemetry object must be returned');
    assert.ok(tele.userAgent, 'userAgent must be present');
    assert.ok(tele.timestamp, 'timestamp must be present');
    assert.ok('ip' in tele, 'ip property must exist');
    assert.ok('screen' in tele, 'screen property must exist');
    assert.ok('language' in tele, 'language property must exist');
    assert.ok('timezone' in tele, 'timezone property must exist');
  });

  runTest('TC-TRACK-02: formatCelebrationPayload encapsulates creator tracking telemetry', () => {
    const testTelemetry = {
      ip: '198.51.100.42',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestBrowser',
      platform: 'Win32',
      screen: '1920x1080',
      language: 'en-US'
    };

    const payload = formatCelebrationPayload({
      name: 'Simran',
      sender: 'Dev',
      passcode: '3344',
      creator_ip: testTelemetry.ip,
      creator_user_agent: testTelemetry.userAgent,
      creator_metadata: testTelemetry,
      photos: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg']
    });

    assert.equal(payload.creator_ip, '198.51.100.42');
    assert.equal(payload.creator_user_agent, testTelemetry.userAgent);
    assert.deepEqual(payload.creator_metadata, testTelemetry);
  });

  // --- SUITE 2: SUPABASE CREATOR ACTIVITY LOGGING ---
  console.log('\n▶ Suite 2: Supabase Activity Logging Table (creator_activity_logs)');

  await runAsyncTest('TC-TRACK-SUPABASE-01: Logs creator activity to Supabase and queries back record', async () => {
    const client = new SupabaseCelebrationClient();
    const testSlug = `sec_audit_${Date.now().toString(16)}`;

    const logRes = await client.logCreatorActivity({
      celebration_slug: testSlug,
      creator_ip: '203.0.113.195',
      creator_user_agent: 'TestAgent/2.0 (Automated QA)',
      recipient_name: 'Audit Recipient',
      sender_name: 'Audit Creator',
      passcode: '9021',
      song: 'haareya',
      photos: [
        'https://example.com/photo-1.jpg',
        'https://example.com/photo-2.jpg',
        'https://example.com/photo-3.jpg'
      ],
      full_payload: { test: true, slug: testSlug }
    });

    assert.ok(logRes.success, 'logCreatorActivity must succeed');

    const logs = await client.getCreatorActivityLogs(10);
    assert.ok(Array.isArray(logs), 'Must return array of logs');
    const matchedLog = logs.find(l => l.celebration_slug === testSlug);
    assert.ok(matchedLog, `Must find recently logged activity for slug ${testSlug}`);
    assert.equal(matchedLog.creator_ip, '203.0.113.195');
    assert.equal(matchedLog.recipient_name, 'Audit Recipient');
    assert.equal(matchedLog.photo_count, 3);
  });

  // --- SUITE 3: BROWSER CDP: EMPHASIZED BUTTON & END POP-UP MODAL ---
  console.log('\n▶ Suite 3: End-to-End Headless Chrome CDP Verification');

  const server = createStaticServer();
  const { baseUrl } = await server.start();
  const cdp = new CDPDriver();
  await cdp.launch();

  try {
    // 3.1 Emphasized "Create Yours" Floating Button & In-Slide CTA
    await runAsyncTest('TC-EMPHASIZE-01: Floating "Create Yours" button is enlarged, animated, and styled', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);

      const btnStyles = await cdp.evaluate(() => {
        const btn = document.querySelector('.floating-admin-btn');
        if (!btn) return null;
        const comp = window.getComputedStyle(btn);
        return {
          exists: true,
          text: btn.textContent.trim(),
          fontSize: comp.fontSize,
          fontWeight: comp.fontWeight,
          href: btn.getAttribute('href')
        };
      });

      assert.ok(btnStyles && btnStyles.exists, 'Floating button must exist in DOM');
      assert.ok(btnStyles.text.includes('Create Yours'), `Button text should be emphasized, got: "${btnStyles.text}"`);
      assert.equal(btnStyles.href, 'admin.html', 'Button must link to admin.html');
      assert.ok(parseInt(btnStyles.fontSize) >= 14, `Font size must be >= 14px for emphasis, got ${btnStyles.fontSize}`);
    });

    await runAsyncTest('TC-EMPHASIZE-02: Real Gifts slide contains emphasized in-page CTA banner', async () => {
      const banner = await cdp.evaluate(() => {
        const el = document.getElementById('create-yours-cta-card');
        const ctaBtn = document.getElementById('btn-create-in-page');
        return {
          exists: !!el,
          btnExists: !!ctaBtn,
          btnHref: ctaBtn ? ctaBtn.getAttribute('href') : null
        };
      });

      assert.ok(banner.exists, 'In-page CTA banner must exist on real gifts slide');
      assert.ok(banner.btnExists, 'In-page CTA button must exist');
      assert.equal(banner.btnHref, 'admin.html', 'CTA button must link to admin.html');
    });

    // 3.2 End Celebration Pop-up Modal
    await runAsyncTest('TC-POPUP-01: End celebration modal displays upon button click and dismisses cleanly', async () => {
      // Initially hidden
      const initialHidden = await cdp.evaluate(() => {
        const m = document.getElementById('end-celebration-modal');
        return !m || m.style.display === 'none' || !m.classList.contains('active');
      });
      assert.ok(initialHidden, 'End modal must be initially hidden');

      // Click "Finish Surprise" button to trigger modal
      await cdp.click('#btn-show-end-modal');
      await new Promise(r => setTimeout(r, 400));

      const modalState = await cdp.evaluate(() => {
        const m = document.getElementById('end-celebration-modal');
        const title = document.querySelector('.end-modal-title');
        const cta = document.getElementById('btn-end-popup-create');
        return {
          isActive: m && m.classList.contains('active'),
          display: m ? m.style.display : null,
          titleText: title ? title.textContent : '',
          ctaHref: cta ? cta.getAttribute('href') : ''
        };
      });

      assert.ok(modalState.isActive, 'Modal must receive active class');
      assert.ok(modalState.titleText.includes('Happy Birthday'), `Modal title must celebrate birthday, got: ${modalState.titleText}`);
      assert.equal(modalState.ctaHref, 'admin.html', 'CTA must link to admin.html');

      // Dismiss modal
      await cdp.click('#btn-close-end-modal');
      await new Promise(r => setTimeout(r, 400));

      const closedState = await cdp.evaluate(() => {
        const m = document.getElementById('end-celebration-modal');
        return !m.classList.contains('active');
      });
      assert.ok(closedState, 'Modal must be dismissed when close button clicked');
    });

    // 3.3 Automated Trigger on Unboxing Both Mystery Boxes
    await runAsyncTest('TC-POPUP-02: Opening both Mystery Box 1 and Box 2 triggers the celebration pop-up', async () => {
      await cdp.evaluate(() => {
        // Reset modal state
        window.BirthdayApp.state.box1Opened = false;
        window.BirthdayApp.state.box2Opened = false;
        window.BirthdayApp.state.endModalShown = false;
        const m = document.getElementById('end-celebration-modal');
        if (m) { m.classList.remove('active'); m.style.display = 'none'; }
      });

      // Unwrap Box 1
      await cdp.click('#box-1-visual');
      await new Promise(r => setTimeout(r, 400));

      // Unwrap Box 2
      await cdp.click('#box-2-visual');
      
      // Wait for automated timer (2.5s delay + reflow)
      await new Promise(r => setTimeout(r, 2900));

      const modalActive = await cdp.evaluate(() => {
        const m = document.getElementById('end-celebration-modal');
        return m && m.classList.contains('active');
      });

      assert.ok(modalActive, 'End celebration pop-up must automatically trigger after opening both mystery boxes');
    });

  } finally {
    await cdp.close();
    await server.stop();
  }

  console.log('\n======================================================================');
  console.log('                    FINAL TEST EXECUTION SUMMARY');
  console.log('======================================================================');
  console.log(`  Total Test Assertions: ${totalTests}`);
  console.log(`  Passed:                ${passedTests}`);
  console.log(`  Failed:                ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    console.error('  ✖ SOME TESTS FAILED!');
    process.exit(1);
  } else {
    console.log('  ✔ ALL TRACKING & POP-UP TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
