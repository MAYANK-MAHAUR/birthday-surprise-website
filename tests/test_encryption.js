#!/usr/bin/env node

/**
 * ==============================================================================
 * ENCRYPTION & ANTI-GUESSING URL VERIFICATION SUITE (test_encryption.js)
 * ==============================================================================
 * Validates:
 * 1. Cryptographically Secure Unguessable Slug Generation (128-bit entropy)
 * 2. AES-256-GCM Payload Encryption & Decryption with 256-bit Keys
 * 3. Tamper-Proof Authentication Tag Enforcement (Wrong key / corrupted token rejected)
 * 4. Zero-Knowledge Passcode-Derived Encryption (PBKDF2 100,000 iterations)
 * 5. Admin Form Anti-Guessing Mode & Shareable Encrypted URL Construction
 * 6. CDP Browser End-to-End Decryption & Keypad Passcode Unlock
 */

import assert from 'node:assert/strict';
import { createStaticServer } from './server.js';
import { CDPDriver } from './cdp-driver.js';
import CelebrationCrypto from '../crypto-util.js';
import {
  generateSecureSlug,
  generateSlug,
  formatCelebrationPayload,
  buildShareUrl,
  buildEncryptedShareUrl
} from '../admin.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name, ms = 0) {
  totalTests++;
  passedTests++;
  console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name} ${ms ? `(${ms}ms)` : ''}`);
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
  console.log('   ENCRYPTION & ANTI-GUESSING URL VERIFICATION SUITE');
  console.log('======================================================================\n');

  // --- SUITE 1: UNGUESSABLE SLUG ENTROPY & ANTI-GUESSING ---
  console.log('▶ Suite 1: Cryptographically Secure Unguessable Slugs');

  await runTest('TC-ENC-SLUG-01: generateSecureSlug generates 128-bit hex formatted token', () => {
    const slug = generateSecureSlug();
    assert.match(slug, /^sec_[a-f0-9]{32}$/, `Expected sec_<32 hex chars>, got: ${slug}`);
  });

  await runTest('TC-ENC-SLUG-02: 100 consecutively generated slugs are 100% collision-free', () => {
    const slugSet = new Set();
    for (let i = 0; i < 100; i++) {
      slugSet.add(generateSecureSlug());
    }
    assert.equal(slugSet.size, 100, 'All 100 slugs must be completely unique');
  });

  await runTest('TC-ENC-SLUG-03: Secure slugs do not expose or leak recipient name or date', () => {
    const name = 'Aarav Sharma';
    const secureSlug = generateSecureSlug();
    assert.equal(secureSlug.toLowerCase().includes('aarav'), false, 'Secure slug must not contain recipient name');
    assert.equal(secureSlug.toLowerCase().includes('sharma'), false, 'Secure slug must not contain recipient surname');
  });

  // --- SUITE 2: AES-256-GCM PAYLOAD ENCRYPTION & DECRYPTION ---
  console.log('\n▶ Suite 2: AES-256-GCM Payload Encryption & Integrity');

  const sampleCelebration = {
    name: 'Ishita Roy',
    sender: 'Kabir',
    passcode: '7722',
    letter_text: 'From the first rainy drive to endless late night talks, you are my favorite adventure.',
    photos: [
      'assets/images/8893d690706f9c045b2c6e478c07636c.jpg',
      'assets/images/2bd6fdb2b6bf296a351bf5c516e35238.jpg'
    ],
    socials: {
      instagram: '@ishita_secret',
      snapchat: '@ishita.snap',
      email: 'ishita@secret.com',
      whatsapp: '+91 99887 76655'
    }
  };

  let testKey = '';
  let testEncryptedToken = '';

  await runTest('TC-ENC-CRYPT-01: Encrypts celebration payload with 256-bit AES-GCM key', async () => {
    testKey = CelebrationCrypto.generateEncryptionKey();
    assert.equal(testKey.length, 64, '256-bit key should be 64 hex characters');

    testEncryptedToken = await CelebrationCrypto.encryptPayload(sampleCelebration, testKey);
    assert.equal(CelebrationCrypto.isEncryptedToken(testEncryptedToken), true, 'Must start with enc_v1.');
    assert.equal(testEncryptedToken.includes('Ishita'), false, 'Ciphertext must not leak plaintext name');
    assert.equal(testEncryptedToken.includes('7722'), false, 'Ciphertext must not leak passcode');
  });

  await runTest('TC-ENC-CRYPT-02: Decrypts celebration payload cleanly with valid key', async () => {
    const decrypted = await CelebrationCrypto.decryptPayload(testEncryptedToken, testKey);
    assert.equal(decrypted.name, 'Ishita Roy');
    assert.equal(decrypted.passcode, '7722');
    assert.equal(decrypted.letter_text, sampleCelebration.letter_text);
    assert.equal(decrypted.socials.instagram, '@ishita_secret');
  });

  await runTest('TC-ENC-CRYPT-03: Decryption fails and rejects incorrect key', async () => {
    const wrongKey = CelebrationCrypto.generateEncryptionKey();
    let threw = false;
    try {
      await CelebrationCrypto.decryptPayload(testEncryptedToken, wrongKey);
    } catch (_) {
      threw = true;
    }
    assert.equal(threw, true, 'AES-GCM must reject decryption with wrong key');
  });

  await runTest('TC-ENC-CRYPT-04: Tampered ciphertext fails authentication tag check', async () => {
    const parts = testEncryptedToken.split('.');
    // Flip a character in the ciphertext
    const tamperedCipher = parts[3].slice(0, -2) + (parts[3].endsWith('a') ? 'b' : 'a');
    const tamperedToken = `${parts[0]}.${parts[1]}.${parts[2]}.${tamperedCipher}`;

    let threw = false;
    try {
      await CelebrationCrypto.decryptPayload(tamperedToken, testKey);
    } catch (_) {
      threw = true;
    }
    assert.equal(threw, true, 'AES-GCM must reject tampered ciphertext');
  });

  // --- SUITE 3: ZERO-KNOWLEDGE PASSCODE-DERIVED ENCRYPTION ---
  console.log('\n▶ Suite 3: Zero-Knowledge Passcode Encryption');

  let passcodeEncryptedToken = '';
  await runTest('TC-ENC-PASS-01: Encrypts celebration directly using 4-digit passcode', async () => {
    passcodeEncryptedToken = await CelebrationCrypto.encryptPayload(sampleCelebration, '7722');
    assert.equal(CelebrationCrypto.isEncryptedToken(passcodeEncryptedToken), true);
  });

  await runTest('TC-ENC-PASS-02: Decrypts with exact passcode 7722', async () => {
    const decrypted = await CelebrationCrypto.decryptPayload(passcodeEncryptedToken, '7722');
    assert.equal(decrypted.name, 'Ishita Roy');
  });

  await runTest('TC-ENC-PASS-03: Rejects wrong passcodes (0000, 1204, 1234)', async () => {
    for (const badCode of ['0000', '1204', '1234', '7721', '9999']) {
      let threw = false;
      try {
        await CelebrationCrypto.decryptPayload(passcodeEncryptedToken, badCode);
      } catch (_) {
        threw = true;
      }
      assert.equal(threw, true, `Passcode ${badCode} must fail decryption`);
    }
  });

  // --- SUITE 4: END-TO-END BROWSER HYDRATION & KEYPAD UNLOCK VIA CDP ---
  console.log('\n▶ Suite 4: End-to-End Browser CDP Verification');

  const server = createStaticServer();
  const { baseUrl } = await server.start();
  const cdp = new CDPDriver();
  await cdp.launch();

  try {
    // 4.1 Admin Form Anti-Guessing Toggle Presence
    await runTest('TC-ENC-E2E-01: Admin portal displays Anti-Guessing toggle (enabled by default)', async () => {
      await cdp.navigate(`${baseUrl}/admin.html`);
      await cdp.waitForSelector('#admin-encrypt-toggle');
      const isChecked = await cdp.evaluate(() => document.getElementById('admin-encrypt-toggle').checked);
      assert.equal(isChecked, true, 'Anti-guessing mode should be checked by default');
    });

    // 4.2 Form Submission Generates Unguessable Encrypted Link
    await runTest('TC-ENC-E2E-02: Admin submission generates link with unguessable slug and encryption', async () => {
      await cdp.setInputValue('#admin-name', 'Ria Kapoor');
      await cdp.setInputValue('#admin-sender', 'Armaan');
      await cdp.setInputValue('#admin-passcode', '5511');
      await cdp.setInputValue('#admin-letter-text', 'Happy birthday Ria! You make the world sparkle ✨');

      await cdp.click('#creator-form button[type="submit"]');
      await cdp.waitForSelector('#share-result-card', { visible: true, timeoutMs: 6000 });

      const link = await cdp.evaluate(() => document.getElementById('share-link-input').value);
      assert.ok(link.includes('c=sec_'), `Link must have unguessable slug prefix c=sec_, got: ${link}`);
      assert.ok(link.includes('&k='), `Link must include encryption key param &k=, got: ${link}`);
      assert.ok(link.includes('&enc='), `Link must include ciphertext token param &enc=, got: ${link}`);
      assert.equal(link.toLowerCase().includes('ria-kapoor'), false, 'Link must not expose person name in slug');
    });

    // 4.3 Opening Encrypted Link Decrypts and Hydrates Presentation
    await runTest('TC-ENC-E2E-03: Recipient opening encrypted URL gets automatic transparent decryption', async () => {
      const customPayload = {
        name: 'Zoya Khan',
        sender: 'Tariq',
        passcode: '6633',
        letter_text: 'Dearest Zoya, happy birthday to the most wonderful star in our universe!'
      };

      const key = CelebrationCrypto.generateEncryptionKey();
      const encToken = await CelebrationCrypto.encryptPayload(customPayload, key);
      const slug = generateSecureSlug();

      const testUrl = `${baseUrl}/index.html?c=${slug}&k=${key}&enc=${encodeURIComponent(encToken)}`;
      await cdp.navigate(testUrl);
      await cdp.waitForSelector('#slide-passcode.active');

      const title = await cdp.evaluate(() => document.title);
      assert.ok(title.includes('Zoya Khan'), `Title hydrated from decrypted ciphertext: "${title}"`);

      // Incorrect passcode fails
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="0"]');

      await cdp.waitForSelector('#slide-wrong-passcode.active', { timeoutMs: 5000 });
      await cdp.click('#btn-wrong-passcode-retry');
      await cdp.waitForSelector('#slide-passcode.active');

      // Correct decrypted passcode 6633 unlocks
      await cdp.click('.key-btn[data-key="6"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="6"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="3"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="3"]');

      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 5000 });
      const surpriseActive = await cdp.hasClass('#slide-surprise', 'active');
      assert.equal(surpriseActive, true, 'Decrypted passcode 6633 successfully unlocked site');
    });

    // 4.4 Zero-Knowledge Passcode Decryption on Keypad
    await runTest('TC-ENC-E2E-04: Zero-Knowledge Passcode-Only URL decrypts on keypad entry', async () => {
      const zkPayload = {
        name: 'Kabir Varma',
        passcode: '8844',
        letter_text: 'Happy Birthday brother! To endless memories.'
      };

      const zkToken = await CelebrationCrypto.encryptPayload(zkPayload, '8844');
      const zkSlug = generateSecureSlug();

      // Notice NO &k= in URL!
      const zkUrl = `${baseUrl}/index.html?c=${zkSlug}&enc=${encodeURIComponent(zkToken)}`;
      await cdp.navigate(zkUrl);
      await cdp.waitForSelector('#slide-passcode.active');

      // Entering wrong passcode 1111 fails decryption
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="1"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="1"]');

      await cdp.waitForSelector('#slide-wrong-passcode.active', { timeoutMs: 5000 });
      await cdp.click('#btn-wrong-passcode-retry');
      await cdp.waitForSelector('#slide-passcode.active');

      // Entering exact secret passcode 8844 successfully decrypts and unlocks
      await cdp.click('.key-btn[data-key="8"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="8"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="4"]');
      await new Promise(r => setTimeout(r, 70));
      await cdp.click('.key-btn[data-key="4"]');

      await cdp.waitForSelector('#slide-surprise.active', { timeoutMs: 5000 });
      const titleAfterUnlock = await cdp.evaluate(() => document.title);
      assert.ok(titleAfterUnlock.includes('Kabir Varma'), `Title populated upon passcode decryption: "${titleAfterUnlock}"`);
    });

  } finally {
    await cdp.close();
    await server.stop();
  }

  // --- FINAL SUMMARY ---
  console.log('\n======================================================================');
  console.log('                    FINAL TEST EXECUTION SUMMARY');
  console.log('======================================================================');
  console.log(`  Total Test Assertions: ${totalTests}`);
  console.log(`  Passed:                ${passedTests}`);
  console.log(`  Failed:                ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('  ✔ ALL ENCRYPTION & ANTI-GUESSING TESTS PASSED SUCCESSFULLY!\n');
  }
}

main().catch(err => {
  console.error('\nFatal test error:', err);
  process.exit(1);
});
