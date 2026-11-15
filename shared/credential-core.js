// Boxing — shared credential-envelope crypto core (tickets 63, 81, 125).
//
// HONEST LABEL: obfuscation-grade protection, not user-keyed encryption. See the
// long-form threat model in ntp/credentials.js; that module owns persistence and
// the per-install key store, this module owns ONLY the envelope algorithm.
//
// One copy of the legacy literals and the v1/v2/v3 decrypt bridges, shared by the
// NTP page (ntp/credentials.js) and the background service worker (background.js).
// Loading follows shared/snapshot-core.js: classic script via <script src> /
// importScripts('shared/credential-core.js'), dynamic import() in the Firefox module
// background, and CommonJS require() for unit tests.
//
// Envelope version history (AWS FORBID_ENCRYPT_ALLOW_DECRYPT migration shape):
//   v1 {k, iv, d}  — legacy raw key bundled with ciphertext (decrypt-only bridge).
//   v2 {v:2,s,iv,d} — constant shipped secret + per-record salt (decrypt-only bridge;
//     the literal below is LOAD-BEARING for already-installed profiles/exports until
//     v3 migration rewrites them — ticket 63 report).
//   v3 {v:3,s,iv,d} — per-install random key + per-record salt. encrypt() ONLY
//     produces v3; decrypt() dispatches on the version field.
(function (root) {
  'use strict';

  const CRED_KEY_STORE_KEY = 'boxingCredKey.v1';
  const ENC_ALGO = 'AES-GCM';
  const ENC_KEY_LEN = 256;
  const CRED_OBFUSCATION_SECRET = 'boxing-sync-cred-v2-app-secret-2024';

  function b64ToU8(b64) { return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); }
  function u8ToB64(u8) { return btoa(String.fromCharCode(...u8)); }

  function subtleCrypto() {
    const c = root && root.crypto ? root.crypto : (typeof crypto !== 'undefined' ? crypto : null);
    return c && c.subtle ? c.subtle : null;
  }

  // deps.getPerInstallKeyB64: async () => string (per-install key or session fallback).
  // deps.onError: optional logger; plaintext never enters the error path.
  function createCredentialCore(deps) {
    const options = deps || {};
    const getPerInstallKeyB64 = typeof options.getPerInstallKeyB64 === 'function' ? options.getPerInstallKeyB64 : null;
    const onError = typeof options.onError === 'function' ? options.onError : null;
    // Caches keyed by salt: v3 and the v2 legacy bridge are different derivations.
    let v3Cache = null;
    let legacyCache = null;

    async function deriveCredKey(salt, mode) {
      const subtle = subtleCrypto();
      if (!subtle) return null;
      if (mode === 'v3') {
        if (v3Cache && v3Cache.saltB64 === u8ToB64(salt)) return v3Cache.key;
        const pikB64 = getPerInstallKeyB64 ? await getPerInstallKeyB64() : '';
        if (!pikB64) return null;
        const baseKey = await subtle.importKey('raw', new TextEncoder().encode(pikB64), 'PBKDF2', false, ['deriveKey']);
        const key = await subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
          baseKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['encrypt', 'decrypt']);
        v3Cache = { saltB64: u8ToB64(salt), key };
        return key;
      }
      if (legacyCache) return legacyCache;
      const baseKey = await subtle.importKey('raw', new TextEncoder().encode(CRED_OBFUSCATION_SECRET), 'PBKDF2', false, ['deriveKey']);
      const key = await subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        baseKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['decrypt']);
      legacyCache = key;
      return key;
    }

    async function encrypt(plaintext) {
      if (!plaintext) return null;
      try {
        const subtle = subtleCrypto();
        if (!subtle) return null;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveCredKey(salt, 'v3');
        if (!key) return null;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = await subtle.encrypt({ name: ENC_ALGO, iv }, key, new TextEncoder().encode(plaintext));
        return { v: 3, s: u8ToB64(salt), iv: u8ToB64(iv), d: u8ToB64(new Uint8Array(enc)) };
      } catch (e) {
        if (onError) onError(e);
        return null;
      }
    }

    async function decrypt(encObj) {
      if (!encObj) return '';
      if (typeof encObj === 'string') return encObj;
      try {
        const subtle = subtleCrypto();
        if (!subtle) return '';
        if (encObj.k) {
          const rawKey = b64ToU8(encObj.k);
          const key = await subtle.importKey('raw', rawKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['decrypt']);
          const dec = await subtle.decrypt({ name: ENC_ALGO, iv: b64ToU8(encObj.iv) }, key, b64ToU8(encObj.d));
          return new TextDecoder().decode(dec);
        }
        if ((encObj.v === 2 || encObj.v === 3) && encObj.s && encObj.iv && encObj.d) {
          const key = await deriveCredKey(b64ToU8(encObj.s), encObj.v === 3 ? 'v3' : 'v2');
          if (!key) return '';
          const dec = await subtle.decrypt({ name: ENC_ALGO, iv: b64ToU8(encObj.iv) }, key, b64ToU8(encObj.d));
          return new TextDecoder().decode(dec);
        }
      } catch (e) {
        if (onError) onError(e);
      }
      return '';
    }

    return { encrypt, decrypt };
  }

  const exported = {
    CRED_KEY_STORE_KEY,
    CRED_OBFUSCATION_SECRET,
    createCredentialCore,
  };
  if (root) root.__boxingCredentialCore = exported;
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = exported;
  }
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
