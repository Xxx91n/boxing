// Boxing — credential envelope at rest (ticket 10, architecture-recovery; relabel: ticket 63;
// per-install key: ticket 81).
//
// HONEST LABEL (ticket 63) — THIS IS OBFUSCATION-GRADE PROTECTION, NOT USER-KEYED ENCRYPTION.
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
// Envelope layer of the four-layer sync/backup model.
// Moved verbatim from ntp.js (byte-exact except `export` prefixes + debugErr facade).
// Checkpoint 2: only envelope objects leave this module — plaintext never enters logs.
//
// Field-name compatibility obligation: callers persist these
// envelopes as settings._encWebdavPass / settings._encGistToken. The `_enc` prefix is a LEGACY
// NAME retained so already-installed profiles, exports and older builds still read back; here it
// means 'obfuscated envelope', not strong encryption. Renaming is a schema change and must never
// happen in a single release (expand/contract): the legacy name must be read back by older builds.
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
// Ticket 81R2: credKeyStore — the storage.js narrow port for the per-install
// key (boxingCredKey.*, prefix-pinned; structurally cannot write boxingLayout). Injected
// from ntp.js init() — persistence stays with callers, leaf purity of this module restored.
// Without the store (unit probes / pre-injection calls) the module falls back to a
// per-page random session key so encrypt/decrypt roundtrips still work in one page.
export function initCredentialsFacade(deps) {
  debugErr = deps.debugErr;
  credKeyStore = deps.credKeyStore || null;
}

// ── Credential envelope at rest (Web Crypto AES-GCM — obfuscation grade, see file header) ───
// Ticket #125 (spec #120 T5): the envelope algorithm itself lives in
// shared/credential-core.js so the background worker decrypts with the SAME code
// path as this page. This module owns persistence (per-install key) only; the
// legacy v1/v2 bridges and the per-record salt handling are shared verbatim.
// Ticket 81: per-install key material. Stored OUTSIDE the layout object (independent
// chrome.storage.local key, reached through the storage.js cred-key narrow port — 81R2) so
// it never enters buildSyncPayload, buildExportEnvelope or snapshots. Without an injected
// store (file:// pre-init probes) the module falls back to a per-page random session key so
// roundtrips still work inside one page (SEC-01 mock stays local).
const CRED_KEY_STORE_KEY = 'boxingCredKey.v1';
const CRED_KEY_B64_LEN = 32; // 256-bit per-install key
let __perInstallKeyPromise = null; // memoized PIK loader — one storage read per page
let __sessionKeyB64 = null; // file:// fallback: random per-page session key
let __credentialCoreInstance = null;

function b64ToU8(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
function u8ToB64(u8) { return btoa(String.fromCharCode(...u8)); }
function getCredentialCoreModule() {
  const core = typeof globalThis !== 'undefined' ? globalThis.__boxingCredentialCore : null;
  if (!core || typeof core.createCredentialCore !== 'function') {
    throw new Error('__boxingCredentialCore is not loaded (include shared/credential-core.js before ntp.js)');
  }
  return core;
}

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

function credentialCore() {
  if (!__credentialCoreInstance) {
    __credentialCoreInstance = getCredentialCoreModule().createCredentialCore({
      getPerInstallKeyB64,
      onError: (e) => debugErr('credential crypto failed', e),
    });
  }
  return __credentialCoreInstance;
}

export async function encryptCredential(plaintext) {
  if (!plaintext) return null;
  try {
    return await credentialCore().encrypt(plaintext);
  } catch (e) { debugErr('encryptCredential failed', e); return null; }
}
export async function decryptCredential(encObj) {
  if (!encObj) return '';
  // Plain-string (legacy plaintext backup) → return as-is; caller re-encrypts on save.
  if (typeof encObj === 'string') return encObj;
  try {
    return await credentialCore().decrypt(encObj);
  } catch (e) { debugErr('decryptCredential failed', e); return ''; }
}
// BX-CRED-V3 (ticket 81): expose to __boxingDebug for tests.
window.__boxingEncryptCredential = encryptCredential;
window.__boxingDecryptCredential = decryptCredential;
window.__boxingPerInstallKeyInfo = perInstallKeyInfo;
