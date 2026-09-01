// Boxing — encrypted credential envelope (ticket 10, architecture-recovery).
// PBKDF2+AES-GCM (BX-CRED-V2): the key is derived from a constant app secret + per-record salt,
// so the key is NEVER stored alongside ciphertext. Pure crypto module: no DOM, no layout reads,
// persistence left entirely to callers. ADR-0016: envelope layer of the four-layer sync/backup
// model. Moved verbatim from ntp.js (byte-exact except `export` prefixes + debugErr facade).
// Checkpoint 2: only ciphertext envelopes leave this module — plaintext never enters logs.

let debugErr = () => {};

// Ticket 10: inject ntp.js-scope deps (logger) into the credentials module.
export function initCredentialsFacade(deps) {
  debugErr = deps.debugErr;
}

    // ── Encrypted credential storage (Web Crypto AES-GCM) ───
    const ENC_ALGO = 'AES-GCM'; const ENC_KEY_LEN = 256;
    // BX-CRED-V2: PBKDF2-derived key + AES-GCM. Format = { v:2, s, iv, d } — key derived from a
    // constant app secret + per-record salt so the key is NOT stored alongside ciphertext.
    // Legacy v1 format { k, iv, d } (key bundled with ciphertext) still decrypts for backward compat.
    // Plain-string values are treated as plaintext (migration from pre-encryption backups).
    const CRED_APP_SECRET = 'boxing-sync-cred-v2-app-secret-2024';
    let __credDerivedKeyCache = null; // cached derived key (key derivation is the slowest step)
    function b64ToU8(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
    function u8ToB64(u8) { return btoa(String.fromCharCode(...u8)); }
    async function deriveCredKey(salt) {
      if (__credDerivedKeyCache) return __credDerivedKeyCache;
      const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(CRED_APP_SECRET), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        baseKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['encrypt', 'decrypt']);
      __credDerivedKeyCache = key; // cache: salt is constant across records (per-app) for V2
      return key;
    }
    export async function encryptCredential(plaintext) {
      if (!plaintext) return null;
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        __credDerivedKeyCache = null; // refresh per-salt derivation
        const key = await deriveCredKey(salt);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = await crypto.subtle.encrypt({ name: ENC_ALGO, iv }, key, new TextEncoder().encode(plaintext));
        return { v: 2, s: u8ToB64(salt), iv: u8ToB64(iv), d: u8ToB64(new Uint8Array(enc)) };
      } catch (e) { debugErr('encryptCredential failed', e); return null; }
    }
    export async function decryptCredential(encObj) {
      if (!encObj) return '';
      // Plain-string (legacy plaintext backup) → return as-is; caller re-encrypts on save.
      if (typeof encObj === 'string') return encObj;
      try {
        // Legacy v1: key bundled with ciphertext.
        if (encObj.k) {
          const rawKey = b64ToU8(encObj.k);
          const key = await crypto.subtle.importKey('raw', rawKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['decrypt']);
          const iv = b64ToU8(encObj.iv); const ct = b64ToU8(encObj.d);
          const dec = await crypto.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
          return new TextDecoder().decode(dec);
        }
        // v2: key derived from app secret + per-record salt.
        if (encObj.v === 2 && encObj.s && encObj.iv && encObj.d) {
          const salt = b64ToU8(encObj.s);
          __credDerivedKeyCache = null;
          const key = await deriveCredKey(salt);
          const iv = b64ToU8(encObj.iv); const ct = b64ToU8(encObj.d);
          const dec = await crypto.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
          return new TextDecoder().decode(dec);
        }
      } catch (e) { debugErr('decryptCredential failed', e); }
      return '';
    }
    // BX-CRED-V2: expose to __boxingDebug for tests.
    window.__boxingEncryptCredential = encryptCredential;
    window.__boxingDecryptCredential = decryptCredential;
