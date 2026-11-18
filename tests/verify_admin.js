#!/usr/bin/env node

/**
 * Verification Test Suite for Milestone 2: Passcode-Protected Admin Celebration Link Generator
 * Tests:
 * 1. Master Passcode Validation Engine (1204 default, error rejection)
 * 2. Slug Generation Algorithm (URL safety, formatting, uniqueness)
 * 3. Celebration Payload Schema Formatting (PostgreSQL 17 celebrations table columns)
 * 4. Shareable URL & WhatsApp Share URL Formatting
 * 5. Live Supabase Table Insertion & Verification against project obnuhnxhriluesrigxjz
 * 6. Live Supabase Storage Asset Upload & Public Access Verification
 */

const assert = require('node:assert/strict');
const {
  DEFAULT_MASTER_PASSCODE,
  verifyMasterPasscode,
  generateSlug,
  formatCelebrationPayload,
  buildShareUrl,
  buildWhatsAppShareUrl,
} = require('../admin.js');

const {
  SupabaseCelebrationClient,
  clientInstance,
  SUPABASE_CONFIG,
} = require('../supabase-client.js');

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
  console.log('   MILESTONE 2: ADMIN CELEBRATION GENERATOR VERIFICATION SUITE');
  console.log('======================================================================\n');

  // --- SUITE 1: MASTER PASSCODE VALIDATION ENGINE ---
  console.log('▶ Suite 1: Master Passcode Authentication Engine');
  
  runTest('TC-ADM-AUTH-01: Default master passcode is 1204', () => {
    assert.equal(DEFAULT_MASTER_PASSCODE, '1204', 'Default master passcode must be 1204');
    assert.equal(verifyMasterPasscode('1204'), true, 'Passcode 1204 must verify successfully');
    assert.equal(verifyMasterPasscode(1204), true, 'Numeric 1204 must verify successfully');
    assert.equal(verifyMasterPasscode('  1204  '), true, 'Passcode with whitespace must verify successfully');
  });

  runTest('TC-ADM-AUTH-02: Invalid passcodes are rejected', () => {
    assert.equal(verifyMasterPasscode('0000'), false, 'Passcode 0000 must fail');
    assert.equal(verifyMasterPasscode('1234'), false, 'Passcode 1234 must fail');
    assert.equal(verifyMasterPasscode('12045'), false, 'Passcode with extra digit must fail');
    assert.equal(verifyMasterPasscode('abcd'), false, 'Alphabetic passcode must fail');
    assert.equal(verifyMasterPasscode(''), false, 'Empty passcode must fail');
    assert.equal(verifyMasterPasscode(null), false, 'Null passcode must fail');
    assert.equal(verifyMasterPasscode(undefined), false, 'Undefined passcode must fail');
  });

  // --- SUITE 2: SLUG GENERATION ENGINE ---
  console.log('\n▶ Suite 2: Unique Slug Generation Engine');

  runTest('TC-ADM-SLUG-01: Generates clean lowercase URL-safe slug with numeric suffix', () => {
    const slug1 = generateSlug('Sarah Connor');
    assert.match(slug1, /^sarah-connor-\d{4}$/, `Expected slug format sarah-connor-XXXX, got ${slug1}`);

    const slug2 = generateSlug('Dr. Emily & Alex @ 2026!');
    assert.match(slug2, /^dr-emily-alex-2026-\d{4}$/, `Special chars should be normalized: ${slug2}`);
  });

  runTest('TC-ADM-SLUG-02: Empty or whitespace names fall back safely', () => {
    const slugEmpty = generateSlug('');
    assert.match(slugEmpty, /^birthday-\d{4}$/, `Empty name should fall back to birthday-XXXX: ${slugEmpty}`);

    const slugWhitespace = generateSlug('   ');
    assert.match(slugWhitespace, /^birthday-\d{4}$/, `Whitespace name should fall back to birthday-XXXX: ${slugWhitespace}`);
  });

  runTest('TC-ADM-SLUG-03: Repeated slug generations produce unique values', () => {
    const slugs = new Set();
    for (let i = 0; i < 50; i++) {
      slugs.add(generateSlug('Maya'));
    }
    // High probability of zero collisions for 50 samples out of 9,000 range
    assert.ok(slugs.size >= 45, `Expected high entropy across 50 generations, got ${slugs.size} unique`);
  });

  // --- SUITE 3: CELEBRATION PAYLOAD SCHEMA FORMATTING ---
  console.log('\n▶ Suite 3: Celebration Payload Schema Formatting');

  runTest('TC-ADM-SCHEMA-01: Formats complete PostgreSQL public.celebrations payload', () => {
    const rawInput = {
      name: 'Pooja',
      sender: 'Karan',
      passcode: '9876',
      song: 'assets/audio/city_of_stars.mp3',
      photos: [
        'assets/images/8893d690706f9c045b2c6e478c07636c.jpg',
        'assets/images/2bd6fdb2b6bf296a351bf5c516e35238.jpg',
        'assets/images/b0741a182561ced2d924951b42ac6dc6.jpg',
        'assets/images/45aae7f5e21ba481cbe5a6bae512295a.jpg'
      ],
      polaroidNote: 'Happy 25th Birthday Pooja! ✨',
      letter: 'You bring endless light into our lives!',
      dedication: 'To the best partner anyone could ask for.',
      sticky1: 'Keep smiling always! 🌟',
      sticky2: 'Adventures await! ✈️',
      socials: {
        instagram: '@pooja_travels',
        snapchat: '@pooja_snaps',
        gmail: 'pooja@example.com',
        whatsapp: '+91 99887 76655'
      }
    };

    const payload = formatCelebrationPayload(rawInput);

    // Database column assertions
    assert.equal(payload.person_name, 'Pooja');
    assert.equal(payload.letter_author, 'Karan');
    assert.equal(payload.passcode, '9876');
    assert.equal(payload.song, 'city_of_stars');
    assert.equal(payload.cover_photo, rawInput.photos[0]);
    assert.equal(payload.polaroid_1_photo, rawInput.photos[1]);
    assert.equal(payload.polaroid_2_photo, rawInput.photos[2]);
    assert.equal(payload.polaroid_3_photo, rawInput.photos[3]);
    assert.equal(payload.polaroid_note, 'Happy 25th Birthday Pooja! ✨');
    assert.equal(payload.letter_text, 'You bring endless light into our lives!');
    assert.equal(payload.dedication_text, 'To the best partner anyone could ask for.');
    assert.equal(payload.scrapbook_note_1, 'Keep smiling always! 🌟');
    assert.equal(payload.scrapbook_note_2, 'Adventures await! ✈️');
    assert.equal(payload.social_instagram, '@pooja_travels');
    assert.equal(payload.social_snapchat, '@pooja_snaps');
    assert.equal(payload.social_gmail, 'pooja@example.com');
    assert.equal(payload.social_whatsapp, '+91 99887 76655');

    // UI backward compatibility aliases
    assert.equal(payload.name, 'Pooja');
    assert.equal(payload.sender, 'Karan');
    assert.equal(payload.letter, payload.letter_text);
    assert.equal(payload.dedication, payload.dedication_text);
  });

  // --- SUITE 4: SHAREABLE URL & WHATSAPP LINK FORMATTING ---
  console.log('\n▶ Suite 4: Shareable URL & WhatsApp Link Construction');

  runTest('TC-ADM-URL-01: buildShareUrl constructs valid index.html?c=${slug} link', () => {
    const record = { slug: 'ananya-4821' };
    const url = buildShareUrl(record, 'https://example.com', '/birthday/admin.html');
    assert.equal(url, 'https://example.com/birthday/index.html?c=ananya-4821');

    const urlRoot = buildShareUrl(record, 'http://localhost:3000', '/admin.html');
    assert.equal(urlRoot, 'http://localhost:3000/index.html?c=ananya-4821');
  });

  runTest('TC-ADM-URL-02: buildWhatsAppShareUrl constructs URL-encoded WhatsApp direct link', () => {
    const waUrl = buildWhatsAppShareUrl('Ananya', '2468', 'https://example.com/index.html?c=ananya-4821');
    assert.ok(waUrl.startsWith('https://api.whatsapp.com/send?text='), 'Should start with WhatsApp API URL');
    assert.ok(waUrl.includes('Ananya'), 'Encoded message should include recipient name');
    assert.ok(waUrl.includes('2468'), 'Encoded message should include secret passcode');
    assert.ok(waUrl.includes(encodeURIComponent('https://example.com/index.html?c=ananya-4821')), 'Encoded message should include share URL');
  });

  // --- SUITE 5: LIVE SUPABASE TABLE INSERTION & QUERYING ---
  console.log('\n▶ Suite 5: Live Supabase Database Persistence (obnuhnxhriluesrigxjz)');

  const testSlug = `test-adm-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const livePayload = formatCelebrationPayload({
    slug: testSlug,
    name: 'Mira Tester',
    sender: 'Kabir QA',
    passcode: '8833',
    song: 'haareya',
    photos: [
      'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600',
      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600',
      'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600',
      'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=600'
    ],
    polaroidNote: 'Happy Birthday Mira! 🎂',
    letter: 'You are the most incredible person I know. Wishing you a year of pure happiness!',
    dedication: 'Every moment with you is a memory I cherish.',
    sticky1: 'Always shine bright! ⭐',
    sticky2: 'Today is your day! 🎉',
    socials: {
      instagram: '@mira.tester',
      snapchat: '@mira_snaps',
      gmail: 'mira.tester@example.com',
      whatsapp: '+1 555 123 4567'
    }
  });

  let savedRecord = null;

  await runAsyncTest('TC-ADM-SUP-01: Live record insertion into public.celebrations', async () => {
    const res = await clientInstance.saveCelebration(livePayload);
    assert.equal(res.success, true, 'saveCelebration should return success: true');
    assert.equal(res.source, 'supabase', 'Record must be saved to live Supabase, not offline cache');
    assert.ok(res.record, 'Record must be returned');
    assert.ok(res.record.id, 'Record must have UUID id');
    assert.match(
      res.record.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      `Record ID must be RFC 4122 UUID: ${res.record.id}`
    );
    assert.equal(res.record.slug, testSlug, 'Record slug must match generated slug');
    savedRecord = res.record;
  });

  await runAsyncTest('TC-ADM-SUP-02: Live query back celebration by slug confirms exact data match', async () => {
    assert.ok(savedRecord, 'Pre-condition: savedRecord must exist');
    const fetched = await clientInstance.getCelebration(testSlug);
    assert.ok(fetched, `Celebration with slug ${testSlug} must be retrieved from Supabase`);
    assert.equal(fetched.id, savedRecord.id, 'Fetched ID must match inserted ID');
    assert.equal(fetched.person_name, 'Mira Tester');
    assert.equal(fetched.letter_author, 'Kabir QA');
    assert.equal(fetched.passcode, '8833');
    assert.equal(fetched.song, 'haareya');
    assert.equal(fetched.cover_photo, livePayload.cover_photo);
    assert.equal(fetched.polaroid_1_photo, livePayload.polaroid_1_photo);
    assert.equal(fetched.polaroid_2_photo, livePayload.polaroid_2_photo);
    assert.equal(fetched.polaroid_3_photo, livePayload.polaroid_3_photo);
    assert.equal(fetched.polaroid_note, 'Happy Birthday Mira! 🎂');
    assert.equal(fetched.letter_text, livePayload.letter_text);
    assert.equal(fetched.dedication_text, livePayload.dedication_text);
    assert.equal(fetched.scrapbook_note_1, 'Always shine bright! ⭐');
    assert.equal(fetched.scrapbook_note_2, 'Today is your day! 🎉');
    assert.equal(fetched.social_instagram, '@mira.tester');
    assert.equal(fetched.social_snapchat, '@mira_snaps');
    assert.equal(fetched.social_gmail, 'mira.tester@example.com');
    assert.equal(fetched.social_whatsapp, '+1 555 123 4567');
  });

  // --- SUITE 6: LIVE SUPABASE STORAGE ASSET UPLOAD ---
  console.log('\n▶ Suite 6: Live Supabase Storage Asset Upload (celebration-assets)');

  await runAsyncTest('TC-ADM-STOR-01: Upload asset to celebration-assets/celebrations folder', async () => {
    // 1x1 transparent PNG data URL
    const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await clientInstance.uploadAsset(testDataUrl, 'celebrations');
    
    assert.equal(uploadRes.success, true, 'uploadAsset must return success: true');
    assert.ok(uploadRes.publicUrl, 'uploadAsset must return publicUrl');
    assert.ok(
      uploadRes.publicUrl.startsWith(`${SUPABASE_CONFIG.url}/storage/v1/object/public/${SUPABASE_CONFIG.bucket}/celebrations/`),
      `publicUrl should be in celebration-assets/celebrations/: ${uploadRes.publicUrl}`
    );

    // Verify asset is publicly readable over HTTP GET
    const fetchResp = await fetch(uploadRes.publicUrl, { method: 'GET' });
    assert.equal(fetchResp.status, 200, `Uploaded asset publicUrl must be readable via HTTP 200, got ${fetchResp.status}`);
  });

  // --- FINAL REPORT ---
  console.log('\n======================================================================');
  console.log('                    FINAL TEST EXECUTION SUMMARY');
  console.log('======================================================================');
  console.log(`  Total Test Assertions: ${totalTests}`);
  console.log(`  Passed:                \x1b[32m${passedTests}\x1b[0m`);
  console.log(`  Failed:                ${failedTests > 0 ? `\x1b[31m${failedTests}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);
  console.log('======================================================================');

  if (failedTests === 0 && totalTests > 0) {
    console.log('  \x1b[32m✔ ALL MILESTONE 2 ADMIN TESTS PASSED SUCCESSFULLY!\x1b[0m\n');
    process.exit(0);
  } else {
    console.log(`  \x1b[31m✖ TEST SUITE RUN COMPLETED WITH ${failedTests} FAILURES\x1b[0m\n`);
    process.exit(1);
  }
}

main().catch(fatal => {
  console.error('\n[FATAL ERROR IN VERIFY SCRIPT]', fatal);
  process.exit(1);
});
