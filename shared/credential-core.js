// Boxing — shared credential-envelope decrypt core (ticket #126 / spec #120 T7).
//
// The NTP page keeps ntp/credentials.js as the owner of encrypt/decrypt. The
// background service worker cannot import that ES module (Chrome runs a classic
// service worker), yet an unattended Gist first-create has to decrypt the saved
// _encGistToken envelope. This module carries ONLY the read/decrypt half of the
// envelope contract:
//   v1 {k, iv, d}       legacy: key bundled with ciphertext (decrypt-only bridge)
//   v2 {v:2,s,iv,d}     retired shipped secret + per-record salt (decrypt-only bridge)
//   v3 {v:3,s,iv,d}     per-install random key + per-record salt (current writer)
// It never creates or stores a key. The caller injects getPerInstallKeyB64(), and
// the background implementation only READS boxingCredKey.v1 — a missing key means
// decryption fails closed instead of generating a key the user never had.
//
// UMD-lite: importScripts() in a classic Chrome SW, dynamic import() in the
// Firefox module background, and require() in Node tests.
(function (root) {
  'use strict';

  const ENC_ALGO = 'AES-GCM';
  const ENC_KEY_LEN = 256;
  // LOAD-BEARING legacy literal (ticket 63 / 81). Must stay byte-identical to
  // ntp/credentials.js, otherwise already-exported v2 envelopes stop decrypting.
  const CRED_OBFUSCATION_SECRET = 'boxing-sync-cred-v2-app-secret-2024';

  function b64ToU8(b64) {
    return Uint8Array.from(atob(String(b64)), (c) => c.charCodeAt(0));
  }

  function resolveCrypto(env) {
    const c = (env && env.cryptoRef) || (root && root.crypto) || (typeof crypto !== 'undefined' ? crypto : null);
    if (!c || !c.subtle) throw new Error('Web Crypto unavailable');
    return c;
  }

  async function deriveKey(env, salt, mode) {
    const cryptoRef = resolveCrypto(env);
    let material;
    if (mode === 'v3') {
      if (!env || typeof env.getPerInstallKeyB64 !== 'function') {
        throw new Error('per-install credential key provider unavailable');
      }
      material = await env.getPerInstallKeyB64();
      if (typeof material !== 'string' || material.length < 40) {
        throw new Error('per-install credential key unavailable');
      }
    } else {
      material = CRED_OBFUSCATION_SECRET;
    }
    const baseKey = await cryptoRef.subtle.importKey(
      'raw', new TextEncoder().encode(material), 'PBKDF2', false, ['deriveKey']
    );
    return cryptoRef.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: ENC_ALGO, length: ENC_KEY_LEN },
      false,
      ['decrypt']
    );
  }

  async function decryptCredential(encObj, env) {
    if (!encObj) return '';
    // Plain string is a legacy plaintext credential; the caller re-encrypts on save.
    if (typeof encObj === 'string') return encObj;
    const debugErr = env && typeof env.debugErr === 'function' ? env.debugErr : null;
    try {
      const cryptoRef = resolveCrypto(env);
      if (encObj.k) {
        const rawKey = b64ToU8(encObj.k);
        const key = await cryptoRef.subtle.importKey(
          'raw', rawKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['decrypt']
        );
        const iv = b64ToU8(encObj.iv);
        const ct = b64ToU8(encObj.d);
        const dec = await cryptoRef.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
        return new TextDecoder().decode(dec);
      }
      if (encObj.v === 2 && encObj.s && encObj.iv && encObj.d) {
        const salt = b64ToU8(encObj.s);
        const key = await deriveKey(env, salt, 'v2');
        const iv = b64ToU8(encObj.iv);
        const ct = b64ToU8(encObj.d);
        const dec = await cryptoRef.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
        return new TextDecoder().decode(dec);
      }
      if (encObj.v === 3 && encObj.s && encObj.iv && encObj.d) {
        const salt = b64ToU8(encObj.s);
        const key = await deriveKey(env, salt, 'v3');
        const iv = b64ToU8(encObj.iv);
        const ct = b64ToU8(encObj.d);
        const dec = await cryptoRef.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
        return new TextDecoder().decode(dec);
      }
    } catch (e) {
      if (debugErr) debugErr('decryptCredential failed', e);
    }
    return '';
  }

  const exported = {
    CRED_OBFUSCATION_SECRET,
    decryptCredential,
  };

  if (root) root.__boxingCredentialCore = exported;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = exported;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
