/**
 * ==============================================================================
 * Birthday Celebration Cryptographic Utility (crypto-util.js)
 * High-Entropy Anti-Guessing Slugs & AES-256-GCM Payload Encryption
 * Works seamlessly in Browser (window.crypto.subtle) and Node.js (globalThis.crypto.subtle)
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.CelebrationCrypto = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function getSubtle() {
    if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto.subtle;
    return null;
  }

  // Convert Uint8Array to Hex string
  function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  // Convert Hex string to Uint8Array
  function hexToBytes(hex) {
    const cleanHex = hex.trim();
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // Convert Uint8Array to URL-safe Base64
  function bytesToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = (typeof btoa !== 'undefined')
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Convert URL-safe Base64 to Uint8Array
  function base64UrlToBytes(base64url) {
    let b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    const binary = (typeof atob !== 'undefined')
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Generate a cryptographically secure, high-entropy unguessable slug
   * Format: sec_<32 hex chars> (128 bits of entropy)
   * Possibilities: 2^128 = 3.4 x 10^38 combinations — impossible to guess.
   * @param {string} [prefix='sec']
   * @returns {string}
   */
  function generateSecureSlug(prefix = 'sec') {
    const randomBytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < 16; i++) randomBytes[i] = Math.floor(Math.random() * 256);
    }
    return `${prefix}_${bytesToHex(randomBytes)}`;
  }

  /**
   * Generate random 256-bit encryption key (32 bytes as 64-char hex)
   * @returns {string}
   */
  function generateEncryptionKey() {
    const keyBytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(keyBytes);
    } else {
      for (let i = 0; i < 32; i++) keyBytes[i] = Math.floor(Math.random() * 256);
    }
    return bytesToHex(keyBytes);
  }

  /**
   * Derive AES-GCM 256-bit key from secret (passphrase or key) and salt using PBKDF2
   */
  async function deriveAesKey(secret, saltBytes) {
    const subtle = getSubtle();
    if (!subtle) throw new Error('Web Crypto subtle is not available');

    const enc = new TextEncoder();
    const rawSecret = enc.encode(String(secret));
    const baseKey = await subtle.importKey(
      'raw',
      rawSecret,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a JSON celebration payload with AES-256-GCM
   * @param {Object|string} payload 
   * @param {string} secretKey (Passcode or 256-bit random key)
   * @returns {Promise<string>} Token in format "enc_v1.<salt_b64>.<iv_b64>.<cipher_b64>"
   */
  async function encryptPayload(payload, secretKey) {
    const subtle = getSubtle();
    if (!subtle) throw new Error('Web Crypto subtle is not available in this environment');

    const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const enc = new TextEncoder();
    const plainBytes = enc.encode(jsonStr);

    const salt = new Uint8Array(16);
    const iv = new Uint8Array(12);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(salt);
      crypto.getRandomValues(iv);
    } else {
      for (let i = 0; i < 16; i++) salt[i] = Math.floor(Math.random() * 256);
      for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
    }

    const key = await deriveAesKey(secretKey, salt);
    const cipherBuffer = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plainBytes
    );

    const cipherBytes = new Uint8Array(cipherBuffer);
    const saltB64 = bytesToBase64Url(salt);
    const ivB64 = bytesToBase64Url(iv);
    const cipherB64 = bytesToBase64Url(cipherBytes);

    return `enc_v1.${saltB64}.${ivB64}.${cipherB64}`;
  }

  /**
   * Decrypt an encrypted token with AES-256-GCM
   * @param {string} token "enc_v1.<salt_b64>.<iv_b64>.<cipher_b64>"
   * @param {string} secretKey (Passcode or 256-bit random key)
   * @returns {Promise<Object>} Decrypted JSON object
   */
  async function decryptPayload(token, secretKey) {
    const subtle = getSubtle();
    if (!subtle) throw new Error('Web Crypto subtle is not available in this environment');
    if (typeof token !== 'string' || !token.startsWith('enc_v1.')) {
      throw new Error('Invalid encrypted token format');
    }

    const parts = token.split('.');
    if (parts.length !== 4) {
      throw new Error('Malformed encrypted token');
    }

    const salt = base64UrlToBytes(parts[1]);
    const iv = base64UrlToBytes(parts[2]);
    const cipherBytes = base64UrlToBytes(parts[3]);

    const key = await deriveAesKey(secretKey, salt);
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(plainBuffer);
    return JSON.parse(jsonStr);
  }

  /**
   * Check if a token is encrypted with enc_v1 format
   * @param {string} token
   * @returns {boolean}
   */
  function isEncryptedToken(token) {
    return typeof token === 'string' && token.startsWith('enc_v1.');
  }

  return {
    generateSecureSlug,
    generateEncryptionKey,
    encryptPayload,
    decryptPayload,
    isEncryptedToken,
    bytesToHex,
    hexToBytes,
    bytesToBase64Url,
    base64UrlToBytes
  };
});
