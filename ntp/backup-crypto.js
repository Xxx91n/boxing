// Boxing — passphrase-protected backup FILES (issue #57, spec #53 D4).
//
// This is NOT ./credentials.js and must never borrow from it. That module obfuscates SYNC
// SECRETS at rest with a per-install key that stays inside this browser profile; everything
// here is keyed solely on a passphrase the user types, so no storage, no install key and no
// session secret is reachable from this module (zero imports). The two consequences the UI
// states verbatim: a lost passphrase means the file is unreadable forever, and a decrypted
// backup never carries usable WebDAV/Gist credentials — a new install re-types them.
//
// Envelope v1 — versioned, with every parameter pinned to the version so a file is always
// decoded with the parameters it was written with (expand/contract: a future v2 adds a
// version number, never changes v1's meaning). The parameter values are this ticket's
// technical choice under spec #53 N2, which deliberately left them unfixed; they are not a
// user-confirmed spec item.
//   { boxingBackup: 1,
//     kdf:     { name:'PBKDF2', hash:'SHA-256', iterations:310000, salt:<b64, 16 B> },
//     cipher:  { name:'AES-GCM', iv:<b64, 12 B> },
//     payload: <b64 AES-GCM ciphertext of the plain backup file text> }
// The key is PBKDF2 over the NFC-normalized UTF-8 of the passphrase (see deriveFileKey).
// AES-GCM authenticates the payload, so a wrong passphrase or a flipped byte fails the open
// instead of yielding garbage — the importer keeps its "failure changes no data" guarantee
// without a second checksum field. The iteration count is the PBKDF2-SHA-256 range that
// costs a few hundred ms in-browser (real cost against offline guessing) while staying under
// the point where a new-tab interaction feels broken; salt and iv are per-file random.
//
// Pure module: no DOM, no storage, no layout. The backup file is the system boundary — every
// value read back out of a file is validated (version, parameter names, parameter lengths,
// payload bounds) before a single crypto primitive runs.

const FORMAT_VERSION = 1;
const KDF_ITERATIONS = 310000;
const KDF_HASH = 'SHA-256';
const SALT_BYTES = 16;
const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const KEY_BITS = 256;

// Upper bound for the FILE a passphrase export produces, so the encrypted round trip stays
// inside the importer's own input gate instead of trading one limit for another.
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_PASSPHRASE_CHARS = 1024;

// Error codes the UI branches on: only PASSPHRASE is public (the importer retries on it),
// because anything else means the envelope itself is unreadable and retrying cannot help.
const BACKUP_ERROR_FORMAT = 'backup_format';
export const BACKUP_ERROR_PASSPHRASE = 'backup_passphrase';

function formatError(message) {
  const error = new Error(message);
  error.code = BACKUP_ERROR_FORMAT;
  return error;
}

function passphraseError() {
  const error = new Error('passphrase backup could not be opened');
  error.code = BACKUP_ERROR_PASSPHRASE;
  return error;
}

// Chunked: the payload is megabytes, and String.fromCharCode(...bytes) throws RangeError
// once the argument list gets that long.
function u8ToB64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToU8(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function utf8ByteLength(text) {
  return new TextEncoder().encode(text).length;
}

function isBase64(text) {
  return typeof text === 'string' && text.length > 0 && text.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(text);
}

// Base64 whose decoded length is exactly `expectedBytes` and which re-encodes to the same
// string — non-canonical spellings of the same bytes have no business in a written file.
function readFixedBase64(text, expectedBytes, label) {
  if (!isBase64(text)) throw formatError(`${label} is not base64`);
  const bytes = b64ToU8(text);
  if (bytes.length !== expectedBytes || u8ToB64(bytes) !== text) throw formatError(`${label} has the wrong length`);
  return bytes;
}

function requirePassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length === 0) throw formatError('a passphrase is required');
  if (passphrase.length > MAX_PASSPHRASE_CHARS) throw formatError('passphrase exceeds the input bound');
}

async function deriveFileKey(passphrase, salt, usage) {
  // NFC-normalized before derivation, and pinned to v1: macOS and mobile keyboards hand the
  // same visible passphrase as different byte sequences (NFC vs NFD), which would otherwise
  // seal a file shut on the very next typing of it.
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: KDF_HASH },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    [usage],
  );
}

// Detection happens on the ALREADY PARSED file content: a top-level numeric `boxingBackup`
// means "passphrase file", whatever its version, so an unknown version reports honestly
// instead of falling through as an invalid plain backup.
export function isPassphraseBackupFile(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && typeof value.boxingBackup === 'number';
}

function readEnvelope(value) {
  if (!isPassphraseBackupFile(value)) throw formatError('not a passphrase backup file');
  if (value.boxingBackup !== FORMAT_VERSION) throw formatError(`unsupported passphrase backup format v${value.boxingBackup}`);
  const kdf = value.kdf;
  if (!kdf || typeof kdf !== 'object') throw formatError('missing kdf parameters');
  if (kdf.name !== 'PBKDF2' || kdf.hash !== KDF_HASH || kdf.iterations !== KDF_ITERATIONS) {
    throw formatError('kdf parameters do not match format v1');
  }
  if (value.cipher == null || typeof value.cipher !== 'object' || value.cipher.name !== 'AES-GCM') {
    throw formatError('cipher does not match format v1');
  }
  const salt = readFixedBase64(kdf.salt, SALT_BYTES, 'kdf.salt');
  const iv = readFixedBase64(value.cipher.iv, IV_BYTES, 'cipher.iv');
  if (!isBase64(value.payload)) throw formatError('payload is not base64');
  const payload = b64ToU8(value.payload);
  if (payload.length < GCM_TAG_BYTES) throw formatError('payload is truncated');
  if (payload.length > MAX_BACKUP_FILE_BYTES) throw formatError('payload exceeds the import bound');
  return { salt, iv, payload };
}

// One builder for both the written file and the size estimate: the bound in maxInnerBytes()
// is only trustworthy while the header it measures is the header encryptBackupFile writes.
function buildEnvelope(salt, iv, payloadBytes) {
  return {
    boxingBackup: FORMAT_VERSION,
    kdf: { name: 'PBKDF2', hash: KDF_HASH, iterations: KDF_ITERATIONS, salt: u8ToB64(salt) },
    cipher: { name: 'AES-GCM', iv: u8ToB64(iv) },
    payload: u8ToB64(payloadBytes),
  };
}

// Longest plain backup text that still fits MAX_BACKUP_FILE_BYTES once sealed and base64'd.
// Fixed-length zero salt/iv encode to exactly the same character counts as random ones, so the
// header length is the real one without spending a key derivation.
export function maxInnerBytes() {
  const overhead = JSON.stringify(buildEnvelope(new Uint8Array(SALT_BYTES), new Uint8Array(IV_BYTES), new Uint8Array(0))).length;
  const usable = MAX_BACKUP_FILE_BYTES - overhead;
  return Math.floor(usable / 4) * 3 - GCM_TAG_BYTES;
}

export async function encryptBackupFile(innerJson, passphrase) {
  requirePassphrase(passphrase);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveFileKey(passphrase, salt, 'encrypt');
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(innerJson));
  return buildEnvelope(salt, iv, new Uint8Array(sealed));
}

export async function decryptBackupFile(value, passphrase) {
  const envelope = readEnvelope(value);
  requirePassphrase(passphrase);
  const key = await deriveFileKey(passphrase, envelope.salt, 'decrypt');
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv }, key, envelope.payload);
  } catch (e) {
    // Only the AES-GCM open is attributed to the passphrase. A key-derivation or engine
    // failure is NOT evidence about the user's typing, and the caller loops on this code —
    // reporting those as PASSPHRASE would trap the dialog on a file that can never open.
    throw passphraseError();
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch (e) {
    throw formatError('payload is not UTF-8 text');
  }
}
