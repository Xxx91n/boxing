// Boxing — credential envelope at rest (ticket 10, architecture-recovery; relabel: ticket 63 / A-017).
//
// HONEST LABEL (ticket 63, A-017) — THIS IS OBFUSCATION-GRADE PROTECTION, NOT ENCRYPTION.
// The AES-GCM key is derived (PBKDF2) from a constant secret that SHIPS INSIDE THE EXTENSION
// SOURCE plus a per-record salt. Anyone holding Boxing's public source, or any copy of the
// packaged extension, can re-derive the key and read the envelope. There is NO user-supplied
// passphrase and NO prompt for one anywhere in this path.
//   What it DOES buy: credentials are not readable at a glance in chrome.storage.local, in a JSON
//   export, or in a WebDAV/Gist backup, and plaintext never reaches logs.
//   What it does NOT buy: protection from anyone who can read the browser profile, or who has
//   the extension itself. Treat stored credentials as recoverable by such an actor.
// Do NOT describe this as 'encrypted with a user password' in user-facing text (README, Privacy
// Policy, store listing). Honest wording: obfuscated at rest with a key that ships with the
// extension; not user-keyed encryption.
//
// Pure crypto module: no DOM, no layout reads, persistence left entirely to callers.
// ADR-0016: envelope layer of the four-layer sync/backup model.
// Moved verbatim from ntp.js (byte-exact except `export` prefixes + debugErr facade).
// Checkpoint 2: only envelope objects leave this module — plaintext never enters logs.
//
// Field-name compatibility (ADR-0017 data-compatibility obligation): callers persist these
// envelopes as settings._encWebdavPass / settings._encGistToken. The `_enc` prefix is a LEGACY
// NAME retained so already-installed profiles, exports and older builds still read back; here it
// means 'obfuscated envelope', not strong encryption. Renaming is a schema change and must never
// happen in a single release (expand/contract) — see .scratch/architecture-recovery/reports/63-report.md.

let debugErr = () => {};

// Ticket 10: inject ntp.js-scope deps (logger) into the credentials module.
export function initCredentialsFacade(deps) {
  debugErr = deps.debugErr;
}

    // ── Credential envelope at rest (Web Crypto AES-GCM — obfuscation grade, see file header) ───
    const ENC_ALGO = 'AES-GCM'; const ENC_KEY_LEN = 256;
    // BX-CRED-V2 envelope = { v:2, s, iv, d }: PBKDF2-derived AES-GCM key + per-record salt, key
    // NOT stored alongside ciphertext. The derivation input is the constant secret below, which
    // ships with the extension — hence obfuscation, not user-keyed encryption.
    // Legacy v1 format { k, iv, d } (key bundled with ciphertext) still decrypts for backward compat.
    // Plain-string values are treated as plaintext (migration from pre-envelope backups).
    // NOTE (ticket 63): the literal below is LOAD-BEARING — renaming this identifier is safe, but
    // changing the VALUE would orphan every v2 envelope already in storage, exports and backups.
    const CRED_OBFUSCATION_SECRET = 'boxing-sync-cred-v2-app-secret-2024';
    let __credDerivedKeyCache = null; // cached derived key (key derivation is the slowest step)
    function b64ToU8(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
    function u8ToB64(u8) { return btoa(String.fromCharCode(...u8)); }
    async function deriveCredKey(salt) {
      if (__credDerivedKeyCache) return __credDerivedKeyCache;
      const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(CRED_OBFUSCATION_SECRET), 'PBKDF2', false, ['deriveKey']);
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
        // v2: key derived from the shipped obfuscation secret + per-record salt.
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
