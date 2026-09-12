// Boxing — credential envelope at rest (ticket 10, architecture-recovery; relabel: ticket 63 / A-017;
// per-install key: ticket 81 / A-031).
//
// HONEST LABEL (ticket 63, A-017) — THIS IS OBFUSCATION-GRADE PROTECTION, NOT USER-KEYED ENCRYPTION.
// The AES-GCM key is derived (PBKDF2) from a PER-INSTALL RANDOM secret plus a per-record salt.
// The secret never ships with the extension and never leaves the browser profile through layout,
// exports, WebDAV/Gist backups, or snapshots. Anyone holding a copy of a Boxing JSON export or a
// WebDAV/Gist backup CANNOT re-derive the key without also reading this browser profile. There is
// NO user-supplied passphrase and NO prompt for one anywhere in this path.
//   What it DOES buy (vs the pre-81 constant secret):
//     - a JSON export, a WebDAV/Gist backup, or a chrome.storage.sync copy read in isolation
//       no longer contains (or can re-derive) the key — offline-copy attacks are dead;
//     - every install generates its own key, so one leaked profile does not unlock others.
//   What it does NOT buy (ticket 63 negatives still hold):
//     - protection from anyone who can read the browser profile (chrome.storage.local holds the
//       key right next to the ciphertext), or who has the running extension. Treat stored
//       credentials as recoverable by such an actor (W3C webcrypto#269: profile-resident keys
//       are an obfuscation boundary, not a security boundary).
// Do NOT describe this as 'encrypted with a user password' in user-facing text (README, Privacy
// Policy, store listing). Honest wording: obfuscated at rest with a per-install random key that
// stays in this browser profile; not user-keyed encryption.
//
// Pure crypto module: no DOM, no layout reads, no direct chrome.storage access (81R2) —
// persistence is left entirely to callers via the injected credKeyStore narrow port.
// ADR-0016: envelope layer of the four-layer sync/backup model.
// Moved verbatim from ntp.js (byte-exact except `export` prefixes + debugErr facade).
// Checkpoint 2: only envelope objects leave this module — plaintext never enters logs.
//
// Field-name compatibility (ADR-0017 data-compatibility obligation): callers persist these
// envelopes as settings._encWebdavPass / settings._encGistToken. The `_enc` prefix is a LEGACY
// NAME retained so already-installed profiles, exports and older builds still read back; here it
// means 'obfuscated envelope', not strong encryption. Renaming is a schema change and must never
// happen in a single release (expand/contract) — see .scratch/architecture-recovery/reports/63-report.md.
//
// Envelope version history (AWS FORBID_ENCRYPT_ALLOW_DECRYPT migration shape, ticket 81):
//   v1 {k, iv, d}  — legacy: raw key bundled with ciphertext (decrypt-only bridge).
//   v2 {v:2,s,iv,d} — constant shipped secret + per-record salt (decrypt-only bridge; the
//     literal below is LOAD-BEARING for already-installed profiles/exports until v3 migration
//     rewrites them — ticket 63 report).
//   v3 {v:3,s,iv,d} — per-install random key + per-record salt. encryptCredential ONLY
//     produces v3; decryptCredential dispatches on the version field. Older builds reading
//     a v3 envelope fail to decrypt (their constant secret cannot derive this key) —
//     downgrade safe: they return '' and the caller re-prompts, no data corruption.

let debugErr = () => {};
let credKeyStore = null; // { get(key), set(key, value) } — storage.js narrow port (81R2)

// Ticket 10: inject ntp.js-scope deps (logger) into the credentials module.
// Ticket 81R2 (A-031): credKeyStore — the storage.js narrow port for the per-install
// key (boxingCredKey.*, prefix-pinned; structurally cannot write boxingLayout). Injected
// from ntp.js init() — persistence stays with callers, leaf purity of this module restored.
// Without the store (unit probes / pre-injection calls) the module falls back to a
// per-page random session key so encrypt/decrypt roundtrips still work in one page.
export function initCredentialsFacade(deps) {
  debugErr = deps.debugErr;
  credKeyStore = deps.credKeyStore || null;
}

// ── Credential envelope at rest (Web Crypto AES-GCM — obfuscation grade, see file header) ───
const ENC_ALGO = 'AES-GCM'; const ENC_KEY_LEN = 256;
// Ticket 63: LOAD-BEARING legacy literal — decrypt-only since ticket 81. Changing this VALUE
// would orphan every v2 envelope in already-installed profiles, exports and backups that has
// not been rewritten to v3 yet. Never removed in a single release (expand/contract).
const CRED_OBFUSCATION_SECRET = 'boxing-sync-cred-v2-app-secret-2024';
// Ticket 81 (A-031): per-install key material. Stored OUTSIDE the layout object (independent
// chrome.storage.local key, reached through the storage.js cred-key narrow port — 81R2) so
// it never enters buildSyncPayload, buildExportEnvelope or snapshots. Without an injected
// store (file:// pre-init probes) the module falls back to a per-page random session key so
// roundtrips still work inside one page (SEC-01 mock stays local).
const CRED_KEY_STORE_KEY = 'boxingCredKey.v1';
const CRED_KEY_B64_LEN = 32; // 256-bit per-install key
let __credDerivedKeyCache = null; // cached derived key (key derivation is the slowest step)
let __perInstallKeyPromise = null; // memoized PIK loader — one storage read per page
let __sessionKeyB64 = null; // file:// fallback: random per-page session key

function b64ToU8(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
function u8ToB64(u8) { return btoa(String.fromCharCode(...u8)); }

// per-install key: generate once, persist via the injected credKeyStore (storage.js
// narrow port), memoize in-page. Concurrent callers share one promise (single-flight);
// a missing/rejected store falls back to a session key so the file:// lane keeps working.
async function getPerInstallKeyB64() {
  if (__perInstallKeyPromise) return __perInstallKeyPromise;
  __perInstallKeyPromise = (async () => {
    if (credKeyStore && typeof credKeyStore.get === 'function' && typeof credKeyStore.set === 'function') {
      try {
        const got = await credKeyStore.get(CRED_KEY_STORE_KEY);
        const existing = got && got[CRED_KEY_STORE_KEY];
        if (typeof existing === 'string' && existing.length >= 40) return existing;
        const fresh = u8ToB64(crypto.getRandomValues(new Uint8Array(CRED_KEY_B64_LEN)));
        await credKeyStore.set(CRED_KEY_STORE_KEY, fresh);
        return fresh;
      } catch (e) { debugErr('per-install key store failed — falling back to session key', e); }
    }
    // no store injected yet: per-page random session key (never persisted).
    if (!__sessionKeyB64) __sessionKeyB64 = u8ToB64(crypto.getRandomValues(new Uint8Array(CRED_KEY_B64_LEN)));
    return __sessionKeyB64;
  })();
  return __perInstallKeyPromise;
}

// Debug/test seam (ticket 81): expose the per-install key presence + source for the
// cred regression lane without leaking the key material itself.
export function perInstallKeyInfo() {
  return {
    storeKey: CRED_KEY_STORE_KEY,
    injected: Boolean(credKeyStore),
    hasPromise: Boolean(__perInstallKeyPromise),
    sessionFallback: __sessionKeyB64 !== null,
  };
}

async function deriveCredKey(salt, mode) {
  if (mode === 'v3') {
    if (__credDerivedKeyCache && __credDerivedKeyCache.saltB64 === u8ToB64(salt)) return __credDerivedKeyCache.key;
    const pikB64 = await getPerInstallKeyB64();
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pikB64), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      baseKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['encrypt', 'decrypt']);
    __credDerivedKeyCache = { saltB64: u8ToB64(salt), key }; // cache: per-record salt, refreshed on salt change
    return key;
  }
  // v2 legacy bridge: constant secret (ticket 63 literal) — decrypt-only.
  if (__credDerivedKeyCache && __credDerivedKeyCache.legacy) return __credDerivedKeyCache.key;
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(CRED_OBFUSCATION_SECRET), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey, { name: ENC_ALGO, length: ENC_KEY_LEN }, false, ['encrypt', 'decrypt']);
  __credDerivedKeyCache = { legacy: true, key };
  return key;
}
export async function encryptCredential(plaintext) {
  if (!plaintext) return null;
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveCredKey(salt, 'v3'); // ticket 81: every write lands as v3 (FORBID_ENCRYPT_ALLOW_DECRYPT)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: ENC_ALGO, iv }, key, new TextEncoder().encode(plaintext));
    return { v: 3, s: u8ToB64(salt), iv: u8ToB64(iv), d: u8ToB64(new Uint8Array(enc)) };
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
    // v2 legacy bridge: key derived from the retired shipped constant (decrypt-only).
    if (encObj.v === 2 && encObj.s && encObj.iv && encObj.d) {
      const salt = b64ToU8(encObj.s);
      const key = await deriveCredKey(salt, 'v2');
      const iv = b64ToU8(encObj.iv); const ct = b64ToU8(encObj.d);
      const dec = await crypto.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
      return new TextDecoder().decode(dec);
    }
    // v3: per-install random key + per-record salt (ticket 81).
    if (encObj.v === 3 && encObj.s && encObj.iv && encObj.d) {
      const salt = b64ToU8(encObj.s);
      const key = await deriveCredKey(salt, 'v3');
      const iv = b64ToU8(encObj.iv); const ct = b64ToU8(encObj.d);
      const dec = await crypto.subtle.decrypt({ name: ENC_ALGO, iv }, key, ct);
      return new TextDecoder().decode(dec);
    }
  } catch (e) { debugErr('decryptCredential failed', e); }
  return '';
}
// BX-CRED-V3 (ticket 81): expose to __boxingDebug for tests.
window.__boxingEncryptCredential = encryptCredential;
window.__boxingDecryptCredential = decryptCredential;
window.__boxingPerInstallKeyInfo = perInstallKeyInfo;
