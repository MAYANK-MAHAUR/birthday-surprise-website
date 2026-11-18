#!/usr/bin/env node

/**
 * Test Suite: Complete Photo Customization Across Every Slide & Screen
 * Verifies:
 * 1. Payload formatting for all 15 photos (named properties, photos array, photos_data JSONB)
 * 2. Supabase persistence of all 15 customized photos
 * 3. End-to-End browser DOM hydration: verifies all 15 <img> elements receive custom src
 * 4. Admin Portal UI verification: verifies all 15 photo slots, file upload buttons, and previews
 */

import assert from 'node:assert/strict';
import { createStaticServer } from './server.js';
import { CDPDriver } from './cdp-driver.js';
import {
  formatCelebrationPayload,
  buildShareUrl
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
  console.log('   PHOTO CUSTOMIZATION SUITE: ALL 15 SLIDE PHOTOS & REACTION GIFS');
  console.log('======================================================================\n');

  const dummyPhotos = [
    'https://images.example.com/photo-01-polaroid.jpg',
    'https://images.example.com/photo-02-spread.jpg',
    'https://images.example.com/photo-03-letter.jpg',
    'https://images.example.com/photo-04-scrapbook-1.jpg',
    'https://images.example.com/photo-05-scrapbook-2.jpg',
    'https://images.example.com/photo-06-flower-1.jpg',
    'https://images.example.com/photo-07-flower-2.jpg',
    'https://images.example.com/photo-08-flower-3.jpg',
    'https://images.example.com/photo-09-cake.jpg',
    'https://images.example.com/photo-10-cake-blown.jpg',
    'https://images.example.com/photo-11-bear-mascot.jpg',
    'https://images.example.com/photo-12-teddy-mascot.jpg',
    'https://images.example.com/photo-13-wrong-cat.gif',
    'https://images.example.com/photo-14-angry-cat.gif',
    'https://images.example.com/photo-15-crying-cat.gif',
  ];

  // --- SUITE 1: PAYLOAD FORMATTING FOR ALL 15 PHOTOS ---
  console.log('▶ Suite 1: Payload Formatting for All 15 Photo Customizations');

  runTest('TC-PHOTO-PAYLOAD-01: formatCelebrationPayload correctly maps all 15 photos', () => {
    const raw = {
      name: 'Maya',
      sender: 'Dev QA',
      passcode: '1204',
      photos: dummyPhotos
    };

    const payload = formatCelebrationPayload(raw);

    assert.equal(payload.cover_photo, dummyPhotos[0]);
    assert.equal(payload.spread_photo, dummyPhotos[1]);
    assert.equal(payload.letter_photo, dummyPhotos[2]);
    assert.equal(payload.scrapbook_photo_1, dummyPhotos[3]);
    assert.equal(payload.scrapbook_photo_2, dummyPhotos[4]);
    assert.equal(payload.flower_photo_1, dummyPhotos[5]);
    assert.equal(payload.flower_photo_2, dummyPhotos[6]);
    assert.equal(payload.flower_photo_3, dummyPhotos[7]);
    assert.equal(payload.cake_photo, dummyPhotos[8]);
    assert.equal(payload.cake_celebrate_photo, dummyPhotos[9]);
    assert.equal(payload.mascot_photo, dummyPhotos[10]);
    assert.equal(payload.teddy_photo, dummyPhotos[11]);
    assert.equal(payload.wrong_code_photo, dummyPhotos[12]);
    assert.equal(payload.angry_cat_photo, dummyPhotos[13]);
    assert.equal(payload.crying_cat_photo, dummyPhotos[14]);

    assert.equal(payload.photos.length, 15);
    assert.ok(payload.photos_data, 'photos_data object must be present for PostgreSQL JSONB column');
    assert.equal(payload.photos_data.flower_photo_1, dummyPhotos[5]);
  });

  runTest('TC-PHOTO-PAYLOAD-02: Named photo properties without array fill photos array properly', () => {
    const raw = {
      name: 'Rohan',
      sender: 'Kavya',
      passcode: '9988',
      cover_photo: dummyPhotos[0],
      spread_photo: dummyPhotos[1],
      letter_photo: dummyPhotos[2],
      scrapbook_photo_1: dummyPhotos[3],
      scrapbook_photo_2: dummyPhotos[4],
      flower_photo_1: dummyPhotos[5],
      flower_photo_2: dummyPhotos[6],
      flower_photo_3: dummyPhotos[7],
      cake_photo: dummyPhotos[8],
      cake_celebrate_photo: dummyPhotos[9],
      mascot_photo: dummyPhotos[10],
      teddy_photo: dummyPhotos[11],
      wrong_code_photo: dummyPhotos[12],
      angry_cat_photo: dummyPhotos[13],
      crying_cat_photo: dummyPhotos[14]
    };

    const payload = formatCelebrationPayload(raw);
    assert.equal(payload.photos.length, 15);
    assert.equal(payload.photos[4], dummyPhotos[4]);
    assert.equal(payload.photos[8], dummyPhotos[8]);
    assert.equal(payload.photos[14], dummyPhotos[14]);
  });

  // --- SUITE 2: SUPABASE PERSISTENCE WITH PHOTOS_DATA ---
  console.log('\n▶ Suite 2: Supabase Persistence with Photos Data');

  await runAsyncTest('TC-PHOTO-SUPABASE-01: Saves and reads back celebration with all 15 photos in Supabase', async () => {
    const client = new SupabaseCelebrationClient();
    const testSlug = `sec_photo_test_${Date.now().toString(16)}`;

    const payload = formatCelebrationPayload({
      slug: testSlug,
      name: 'Photo Test Subject',
      sender: 'Test Runner',
      passcode: '4321',
      photos: dummyPhotos
    });

    const saveRes = await client.saveCelebration(payload);
    assert.ok(saveRes.success, 'saveCelebration must succeed');

    const fetched = await client.getCelebration(testSlug);
    assert.ok(fetched, 'Must fetch created celebration');
    assert.equal(fetched.slug, testSlug);
    assert.equal(fetched.person_name, 'Photo Test Subject');

    // Confirm photos_data or enriched photos array preserves all 15 customized photos
    assert.ok(fetched.photos_data || fetched.photos, 'Photos data must exist on record');
    const p1 = fetched.flower_photo_1 || (fetched.photos_data && fetched.photos_data.flower_photo_1) || (fetched.photos && fetched.photos[5]);
    assert.equal(p1, dummyPhotos[5], 'flower_photo_1 must match dummy photo 5');

    const pCake = fetched.cake_photo || (fetched.photos_data && fetched.photos_data.cake_photo) || (fetched.photos && fetched.photos[8]);
    assert.equal(pCake, dummyPhotos[8], 'cake_photo must match dummy photo 8');
  });

  // --- SUITE 3: BROWSER DOM HYDRATION VIA CDP ---
  console.log('\n▶ Suite 3: End-to-End Headless Chrome CDP Verification');

  const server = createStaticServer();
  const { baseUrl } = await server.start();
  const cdp = new CDPDriver();
  await cdp.launch();

  try {
    // 3.1 Test Admin Portal UI
    await runAsyncTest('TC-PHOTO-UI-01: Admin portal displays all 15 photo input fields with choose photo buttons', async () => {
      await cdp.navigate(`${baseUrl}/admin.html`);

      // Authenticate admin portal with 1204
      await cdp.evaluate(() => {
        sessionStorage.setItem('admin_authenticated', 'true');
        sessionStorage.setItem('admin_auth', 'true');
        const gate = document.getElementById('admin-auth-gate');
        if (gate) { gate.classList.add('unlocked'); gate.style.display = 'none'; }
      });

      const photoInputsCount = await cdp.evaluate(() => {
        return [
          'admin-photo-polaroid',
          'admin-photo-spread',
          'admin-photo-letter',
          'admin-photo-scrapbook-1',
          'admin-photo-scrapbook-2',
          'admin-photo-flower-1',
          'admin-photo-flower-2',
          'admin-photo-flower-3',
          'admin-photo-cake',
          'admin-photo-cake-celebrate',
          'admin-photo-mascot',
          'admin-photo-teddy',
          'admin-photo-wrong-code',
          'admin-photo-angry-cat',
          'admin-photo-crying-cat'
        ].filter(id => !!document.getElementById(id)).length;
      });

      assert.equal(photoInputsCount, 15, 'All 15 photo URL inputs must exist in admin.html');

      const fileButtonsCount = await cdp.evaluate(() => {
        return [
          'admin-file-polaroid',
          'admin-file-spread',
          'admin-file-letter',
          'admin-file-scrapbook-1',
          'admin-file-scrapbook-2',
          'admin-file-flower-1',
          'admin-file-flower-2',
          'admin-file-flower-3',
          'admin-file-cake',
          'admin-file-cake-celebrate',
          'admin-file-mascot',
          'admin-file-teddy',
          'admin-file-wrong-code',
          'admin-file-angry-cat',
          'admin-file-crying-cat'
        ].filter(id => !!document.getElementById(id)).length;
      });

      assert.equal(fileButtonsCount, 15, 'All 15 file inputs must exist in admin.html');

      const previewsCount = await cdp.evaluate(() => {
        return [
          'preview-polaroid',
          'preview-spread',
          'preview-letter',
          'preview-scrapbook-1',
          'preview-scrapbook-2',
          'preview-flower-1',
          'preview-flower-2',
          'preview-flower-3',
          'preview-cake',
          'preview-cake-celebrate',
          'preview-mascot',
          'preview-teddy',
          'preview-wrong-code',
          'preview-angry-cat',
          'preview-crying-cat'
        ].filter(id => !!document.getElementById(id)).length;
      });

      assert.equal(previewsCount, 15, 'All 15 preview containers must exist in admin.html');
    });

    // 3.2 Test Celebration DOM Hydration of all 15 elements
    await runAsyncTest('TC-PHOTO-DOM-01: Main website hydrates all 15 custom photo <img> elements on page load', async () => {
      await cdp.navigate(`${baseUrl}/index.html`);

      const hydrationCheck = await cdp.evaluate((photos) => {
        const testCelebration = {
          id: 'test-photos-123',
          name: 'Aarav',
          passcode: '1204',
          photos: photos,
          cover_photo: photos[0],
          spread_photo: photos[1],
          letter_photo: photos[2],
          scrapbook_photo_1: photos[3],
          scrapbook_photo_2: photos[4],
          flower_photo_1: photos[5],
          flower_photo_2: photos[6],
          flower_photo_3: photos[7],
          cake_photo: photos[8],
          cake_celebrate_photo: photos[9],
          mascot_photo: photos[10],
          teddy_photo: photos[11],
          wrong_code_photo: photos[12],
          angry_cat_photo: photos[13],
          crying_cat_photo: photos[14]
        };

        if (window.BirthdayApp && typeof window.BirthdayApp.applyCelebrationData === 'function') {
          window.BirthdayApp.applyCelebrationData(testCelebration);
        }

        const targets = [
          { id: 'passcode-polaroid', expected: photos[0] },
          { id: 'imgSpread', expected: photos[1] },
          { id: 'letter-photo', expected: photos[2] },
          { id: 'scrapbook-photo-1', expected: photos[3] },
          { id: 'scrapbook-photo-2', expected: photos[4] },
          { id: 'flower-photo-1', expected: photos[5] },
          { id: 'flower-photo-2', expected: photos[6] },
          { id: 'flower-photo-3', expected: photos[7] },
          { id: 'cake-img', expected: photos[8] },
          { id: 'cake-celebrate-img', expected: photos[9] },
          { id: 'mascot-img', expected: photos[10] },
          { id: 'teddy-img', expected: photos[11] },
          { id: 'wrong-code-img', expected: photos[12] },
          { id: 'angry-cat-img', expected: photos[13] },
          { id: 'crying-cat-img', expected: photos[14] }
        ];

        return targets.map(t => {
          const el = document.getElementById(t.id);
          return {
            id: t.id,
            found: !!el,
            src: el ? el.src : null,
            matches: el ? el.src === t.expected : false
          };
        });
      }, dummyPhotos);

      assert.equal(hydrationCheck.length, 15, 'Must test all 15 photo elements');
      hydrationCheck.forEach(item => {
        assert.ok(item.found, `Element #${item.id} must exist in DOM`);
        assert.ok(item.matches, `Element #${item.id} src (${item.src}) must match expected (${item.id})`);
      });
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
    console.log('  ✔ ALL 15 PHOTO CUSTOMIZATION TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
