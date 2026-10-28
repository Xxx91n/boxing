// Boxing — issue #57 (spec #53 D4): manual backup files sealed with a USER PASSPHRASE.
// AC coverage:
//   AC1 both export buttons can seal; the plain JSON export stays available and unchanged
//   AC2 the file is keyed on the passphrase alone, so another install opens it (fresh context)
//   AC3 the passphrase is never persisted and the UI states the loss consequence
//   AC5 real Web Crypto (no mocked cipher); format v1 parameters are pinned in the file
//   AC6 decrypt feeds the UNCHANGED validate/confirm/merge pipeline; a wrong passphrase, a
//       damaged file, an unusable format or a cancelled import change nothing
//   AC7 the structure and size caps still apply AFTER decryption — no cap is traded away for
//       a round trip, and a sealed file still clears the importer's own 5MB input gate
//   AC8 a sealed full DR package still restores the layout only; its _bodies stay unapplied
//
// LANE: file:// mock-storage lane, same harness discipline as
// boxing-dr-export-envelope.spec.ts — addInitScript BEFORE the first navigation, one goto, no
// reload. The crypto is the browser's real crypto.subtle: the point of this ticket is that a
// genuine AES-GCM open succeeds in a different install, so a mocked cipher proves nothing
// (spec #53 T3). Product-side interactions go through element.click() inside evaluate and
// values are assigned before the click, so the first-run tour overlay never wins a hit test.
import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(REPO_PATH, 'ntp', 'index.html')).href;

// The v1 file contract, restated here for the two tests that must hand the importer a file the
// UI itself cannot produce (an unknown version marker, an over-cap payload) and for the Node-side
// seal/open below. A parameter change here is a format change, not a refactor.
const V1 = { iterations: 310000, hash: 'SHA-256', saltBytes: 16, ivBytes: 12 };
const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;
const NEW_I18N_KEYS = [
  'exportEncryptLabel', 'exportEncryptHint',
  'passphraseExportTitle', 'passphraseExportBody', 'passphraseExportAction',
  'passphraseImportTitle', 'passphraseImportBody', 'passphraseImportAction',
  'passphraseFieldLabel', 'passphraseRepeatFieldLabel',
  'passphraseRequired', 'passphraseMismatch', 'passphraseWrong',
  'importEncryptedInvalid', 'exportEncryptedTooLarge',
];

function bareLayout(title) {
  return {
    version: 3.5, schemaVersion: 3, nextLargeIndex: 2,
    boxes: [{ id: 'L1', type: 'large', title, x: 40, y: 40, width: 320, height: 220, nextSmallIndex: 1, children: [] }],
    connections: [], settings: { zoomLevel: 1.0, lastSyncAt: 0 },
    _meta: { revision: 1, updatedAt: Date.now() - 60000, writerId: 'this-tab' },
  };
}

// One snap.v1 split-key snapshot (index entry + body) so a full DR package has a body to embed.
// `ts` rides in on the `seed` argument: init scripts are serialized with fn.toString(), so a
// module-scope constant would be a free variable in the page (ticket 71 N4 lesson).
const SNAP_TS = 111;
function seedStorage(seed) {
  const ts = seed.ts;
  localStorage.setItem('boxingLayout', JSON.stringify(seed.layout));
  localStorage.setItem('bxstore:snap.v1.index', JSON.stringify([{ ts, schemaVersion: 3, size: 999 }]));
  localStorage.setItem('bxstore:snap.v1.' + ts, JSON.stringify({ ts, schemaVersion: 3, data: seed.snapData }));
}

async function boot(page, seed?) {
  if (seed) await page.addInitScript(seedStorage(), seed);
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 30000 }).toBe(true);
}

// Captures the download blob text + anchor name and turns alert() into observable state.
async function armExportCapture(page) {
  await page.evaluate(() => {
    (window as any).__cap = { text: null, name: null, count: 0 };
    (window as any).__alerts = [];
    (window as any).alert = (m: any) => { (window as any).__alerts.push(String(m)); };
    const origUrl = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      (window as any).__cap.count += 1;
      blob.text().then((t) => { (window as any).__cap.text = t; });
      return origUrl(blob);
    };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download) (window as any).__cap.name = this.download;
      return origClick.apply(this, arguments as any);
    };
  });
}

async function readExport(page) {
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__cap?.text)), { timeout: 15000 }).toBe(true);
  return page.evaluate(() => ({ text: (window as any).__cap.text, name: (window as any).__cap.name }));
}

const click = (page, selector: string) => page.evaluate((s) => { document.querySelector(s)?.click(); }, selector);
const titles = (page) => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map((b: any) => b.title));
const confirmOpen = (page) => page.evaluate(() => !document.getElementById('confirm-modal')!.hidden);
const alerts = (page) => page.evaluate(() => (((window as any).__alerts || []) as string[]).join('|'));
const downloadCount = (page) => page.evaluate(() => (window as any).__cap.count);
const confirmAction = (page) => click(page, '#confirm-delete-btn');

async function passphraseDialogState(page) {
  return page.evaluate(() => {
    const modal = document.getElementById('passphrase-modal')!;
    const error = document.getElementById('passphrase-error')!;
    const repeat = document.getElementById('passphrase-repeat-input')!;
    return {
      open: !modal.hidden,
      repeatVisible: !repeat.hidden,
      errorShown: !error.hidden,
      errorText: error.textContent || '',
      values: [(document.getElementById('passphrase-input') as HTMLInputElement).value, repeat.value],
    };
  });
}

// Types into the dialog and submits it. A rejected typing keeps the dialog open by design, so
// callers assert on passphraseDialogState() afterwards instead of waiting for it to disappear.
async function typePassphrase(page, passphrase: string, repeat: string | null, useEnter = false) {
  await expect.poll(() => page.evaluate(() => !document.getElementById('passphrase-modal')!.hidden), { timeout: 15000 }).toBe(true);
  await page.evaluate((input) => {
    (document.getElementById('passphrase-input') as HTMLInputElement).value = input.passphrase;
    if (input.repeat !== null) (document.getElementById('passphrase-repeat-input') as HTMLInputElement).value = input.repeat;
    if (input.useEnter) {
      document.getElementById('passphrase-input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else {
      document.getElementById('passphrase-action-btn')!.click();
    }
  }, { passphrase, repeat, useEnter });
}

async function setEncryptOption(page, on: boolean) {
  await page.evaluate((value) => {
    const cb = document.getElementById('export-encrypt-cb') as HTMLInputElement;
    cb.checked = value;
  }, on);
}

// The export gesture a user performs: (optionally) tick the box, click a button, answer the
// dialog. cancel:true walks away from the dialog; encrypt:false is the untouched plain path.
async function exportFile(page, opts: { encrypt?: boolean; passphrase?: string; repeat?: string; full?: boolean; cancel?: boolean; useEnter?: boolean } = {}) {
  await armExportCapture(page);
  const encrypt = opts.encrypt !== false;
  await setEncryptOption(page, encrypt);
  await click(page, opts.full ? '#export-full-dr-btn' : '#export-data-btn');
  if (!encrypt) return readExport(page);
  await expect.poll(() => page.evaluate(() => !document.getElementById('passphrase-modal')!.hidden), { timeout: 15000 }).toBe(true);
  if (opts.cancel) {
    await click(page, '#passphrase-cancel-btn');
    await expect.poll(() => page.evaluate(() => document.getElementById('passphrase-modal')!.hidden), { timeout: 5000 }).toBe(true);
    return { text: null, name: null };
  }
  await typePassphrase(page, opts.passphrase || '', opts.repeat === undefined ? opts.passphrase : opts.repeat, Boolean(opts.useEnter));
  return readExport(page);
}

async function runImport(page, name: string, data: any) {
  const chooserPromise = page.waitForEvent('filechooser');
  await click(page, '#settings-btn');
  await click(page, '#import-data-btn');
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)),
  });
}

function b64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function unb64(text: string) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Node-side v1 seal/open. Used only to build files the product UI cannot produce, and to read
// back what the browser sealed — the passphrases here are test fixtures, never user data.
async function nodeKey(passphrase: string, salt: Uint8Array, usage: 'encrypt' | 'decrypt') {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: V1.iterations, hash: V1.hash },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}
async function seal(innerJson: string, passphrase: string, overrides: Record<string, any> = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(V1.saltBytes));
  const iv = crypto.getRandomValues(new Uint8Array(V1.ivBytes));
  const key = await nodeKey(passphrase, salt, 'encrypt');
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(innerJson));
  return Object.assign({
    boxingBackup: 1,
    kdf: { name: 'PBKDF2', hash: V1.hash, iterations: V1.iterations, salt: b64(salt) },
    cipher: { name: 'AES-GCM', iv: b64(iv) },
    payload: b64(new Uint8Array(sealed)),
  }, overrides);
}
async function openSealed(sealed: any, passphrase: string) {
  const key = await nodeKey(passphrase, unb64(sealed.kdf.salt), 'decrypt');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.cipher.iv) as BufferSource }, key, unb64(sealed.payload) as BufferSource);
  return new TextDecoder().decode(plain);
}

test.describe('Issue #57 — passphrase-protected manual backups', () => {

  test('locale contract + real-key guard: 14 locales and the en fallback carry every new key', () => {
    const localesDir = path.join(REPO_PATH, '_locales');
    const langs = fs.readdirSync(localesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(langs.length).toBe(14);
    const i18nSrc = fs.readFileSync(path.join(REPO_PATH, 'ntp', 'i18n.js'), 'utf8');
    for (const key of NEW_I18N_KEYS) {
      expect(i18nSrc, `I18N_FALLBACK.${key} missing`).toContain(`I18N_FALLBACK.${key} = `);
      for (const lang of langs) {
        const msgs = JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'messages.json'), 'utf8'));
        expect(msgs[key], `Missing key "${key}" in _locales/${lang}/messages.json`).toBeDefined();
        expect(typeof msgs[key].message).toBe('string');
        expect(msgs[key].message.length).toBeGreaterThan(0);
      }
    }
    // No placeholder is passed on these strings; a stray $1$ would render literally.
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en', 'messages.json'), 'utf8'));
    for (const key of NEW_I18N_KEYS) expect(en[key].message, `unexpected placeholder in ${key}`).not.toContain('$1$');
  });

  test('AC1: unchecked keeps the plain envelope export exactly as ticket 51 shipped it', async ({ browser }) => {
    test.setTimeout(60000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, { layout: bareLayout('Plain Root'), snapData: bareLayout('Seeded Snap'), ts: SNAP_TS });

    const cap = await exportFile(page, { encrypt: false });
    expect(cap.name).toMatch(/^boxing-backup-\d{8}\.json$/);
    const env = JSON.parse(cap.text!);
    expect(env.boxingBackup).toBeUndefined();
    expect(env.meta.fullPackage).toBe(false);
    expect(env.layout.boxes[0].title).toBe('Plain Root');
    expect((await passphraseDialogState(page)).open).toBe(false);
    // the honest warning is on the surface before the user ever types
    expect(await page.textContent('#exportEncryptHint')).toMatch(/never stores/i);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('AC3+AC5: a sealed file is format v1, hides the content, persists no passphrase', async ({ browser }) => {
    test.setTimeout(60000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, { layout: bareLayout('机密 Root 密码'), snapData: bareLayout('Seeded Snap'), ts: SNAP_TS });

    const cap = await exportFile(page, { passphrase: 'correct horse battery' });
    expect(cap.name).toMatch(/^boxing-backup-\d{8}\.json$/);
    expect(Buffer.byteLength(cap.text!, 'utf8')).toBeLessThanOrEqual(MAX_BACKUP_FILE_BYTES);
    const file = JSON.parse(cap.text!);
    expect(file.boxingBackup).toBe(1);
    expect(file.kdf.name).toBe('PBKDF2');
    expect(file.kdf.hash).toBe(V1.hash);
    expect(file.kdf.iterations).toBe(V1.iterations);
    expect(file.cipher.name).toBe('AES-GCM');
    expect(unb64(file.kdf.salt)).toHaveLength(V1.saltBytes);
    expect(unb64(file.cipher.iv)).toHaveLength(V1.ivBytes);
    expect(typeof file.payload).toBe('string');
    // content protection: nothing of the payload survives into the file bytes
    expect(cap.text).not.toContain('机密 Root 密码');
    expect(cap.text).not.toContain('Seeded Snap');
    expect(cap.text).not.toContain('snap.v1');
    // AC3: no passphrase — and no derived material — reaches storage or the layout
    const persisted = await page.evaluate(() => ({
      local: Object.keys(localStorage).map((k) => localStorage.getItem(k) || '').join('|'),
      settings: JSON.stringify((window as any).__boxingDebug.layout.settings || {}),
      fields: [(document.getElementById('passphrase-input') as HTMLInputElement).value,
        (document.getElementById('passphrase-repeat-input') as HTMLInputElement).value],
    }));
    expect(persisted.local).not.toContain('correct horse battery');
    expect(persisted.settings).not.toContain('correct horse battery');
    expect(persisted.fields).toEqual(['', '']);
    // the sealed file the browser wrote really opens (proves the UI's cipher, not a stub)
    expect(JSON.parse(await openSealed(file, 'correct horse battery')).layout.boxes[0].title).toBe('机密 Root 密码');
    expect(errors).toEqual([]);
    await context.close();
  });

  test('AC1+AC6: cancelling or mismatching the dialog produces no file and no change', async ({ browser }) => {
    test.setTimeout(60000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, { layout: bareLayout('Untouched Root'), snapData: bareLayout('Seeded Snap'), ts: SNAP_TS });
    await armExportCapture(page);

    // cancel -> the dialog closes, nothing is downloaded
    const cancelled = await exportFile(page, { passphrase: 'irrelevant', cancel: true });
    expect(cancelled).toEqual({ text: null, name: null });
    expect((await passphraseDialogState(page)).open).toBe(false);
    expect(await downloadCount(page)).toBe(0);

    // two different typings -> inline error, dialog stays open, still nothing downloaded
    await click(page, '#export-data-btn');
    await typePassphrase(page, 'first-typing', 'second-typing');
    const state = await passphraseDialogState(page);
    expect(state.open).toBe(true);
    expect(state.repeatVisible).toBe(true);
    expect(state.errorShown).toBe(true);
    expect(state.errorText).toMatch(/do not match/i);
    expect(await downloadCount(page)).toBe(0);

    // empty submit is rejected the same way, and Escape walks away clearing both fields
    await page.evaluate(() => { (document.getElementById('passphrase-input') as HTMLInputElement).value = ''; });
    await click(page, '#passphrase-action-btn');
    expect((await passphraseDialogState(page)).errorText).toMatch(/type a passphrase/i);
    await page.evaluate(() => document.getElementById('passphrase-input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    const after = await passphraseDialogState(page);
    expect(after.open).toBe(false);
    expect(after.values).toEqual(['', '']);
    expect(await downloadCount(page)).toBe(0);

    // Enter works from either field, so the confirmation box is not a dead end
    await click(page, '#export-data-btn');
    await expect.poll(() => page.evaluate(() => !document.getElementById('passphrase-modal')!.hidden), { timeout: 15000 }).toBe(true);
    await page.evaluate(() => {
      (document.getElementById('passphrase-input') as HTMLInputElement).value = 'typed-once';
      (document.getElementById('passphrase-repeat-input') as HTMLInputElement).value = 'typed-once';
      document.getElementById('passphrase-repeat-input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    const cap = await readExport(page);
    expect(JSON.parse(cap.text).boxingBackup).toBe(1);
    expect(await titles(page)).toEqual(['Untouched Root']);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('AC2+AC6: another install opens the file, and the merge confirm still gates the write', async ({ browser }) => {
    test.setTimeout(150000);
    // Install A seals the file and is then thrown away — no origin data, no origin key.
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await boot(pageA, { layout: bareLayout('Sealed From A'), snapData: bareLayout('Snap A'), ts: SNAP_TS });
    const sealedText = (await exportFile(pageA, { passphrase: 'open sesame 会话', useEnter: true })).text;
    expect(JSON.parse(sealedText!).boxingBackup).toBe(1);
    await contextA.close();

    // Install B: a different profile, empty canvas -> replace-empty, no confirm needed.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    const errorsB: string[] = [];
    pageB.on('pageerror', (e) => errorsB.push(String(e)));
    await boot(pageB);
    await armExportCapture(pageB);
    await runImport(pageB, 'boxing-backup-20261028.json', sealedText!);
    await typePassphrase(pageB, 'open sesame 会话', null);
    await expect.poll(() => titles(pageB), { timeout: 20000 }).toEqual(['Sealed From A']);
    expect((await passphraseDialogState(pageB)).open).toBe(false);
    expect(await confirmOpen(pageB)).toBe(false);
    expect(errorsB).toEqual([]);
    await contextB.close();

    // Install C: same bytes onto a NON-empty canvas. A wrong guess changes nothing and does not
    // reach the confirm; the right one still has to pass the existing merge gate.
    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();
    const errorsC: string[] = [];
    pageC.on('pageerror', (e) => errorsC.push(String(e)));
    await boot(pageC, { layout: bareLayout('Local Kept'), snapData: bareLayout('Snap C'), ts: SNAP_TS });
    await armExportCapture(pageC);
    await runImport(pageC, 'sealed.json', sealedText!);
    await typePassphrase(pageC, 'wrong on purpose', null);
    expect((await passphraseDialogState(pageC)).errorText).toMatch(/wrong passphrase|damaged/i);
    expect(await confirmOpen(pageC)).toBe(false);
    expect(await titles(pageC)).toEqual(['Local Kept']);
    await typePassphrase(pageC, 'open sesame 会话', null);
    await expect.poll(() => confirmOpen(pageC), { timeout: 20000 }).toBe(true);
    await confirmAction(pageC);
    await expect.poll(() => titles(pageC), { timeout: 20000 }).toEqual(expect.arrayContaining(['Local Kept', 'Sealed From A']));
    expect(errorsC).toEqual([]);
    await contextC.close();
  });

  test('AC6: a damaged payload and an unusable format change nothing; the user can walk away', async ({ browser }) => {
    test.setTimeout(90000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, { layout: bareLayout('Still Mine'), snapData: bareLayout('Snap'), ts: SNAP_TS });
    const cap = await exportFile(page, { passphrase: 'seal-me' });
    const good = JSON.parse(cap.text!);

    // one flipped base64 character in the payload -> the AES-GCM open fails (still < 5MB file)
    const damaged = JSON.parse(cap.text!);
    const at = Math.floor(damaged.payload.length / 2);
    damaged.payload = damaged.payload.slice(0, at) + (damaged.payload[at] === 'A' ? 'B' : 'A') + damaged.payload.slice(at + 1);
    await runImport(page, 'damaged.json', damaged);
    await typePassphrase(page, 'seal-me', null);
    expect((await passphraseDialogState(page)).errorShown).toBe(true);
    expect(await alerts(page)).toBe('');
    expect(await titles(page)).toEqual(['Still Mine']);

    // walking away mid-dialog is a plain abort: no alert, no change
    await click(page, '#passphrase-cancel-btn');
    expect((await passphraseDialogState(page)).open).toBe(false);
    expect(await titles(page)).toEqual(['Still Mine']);

    // an unknown version says so once instead of asking for the passphrase forever
    await runImport(page, 'future.json', { ...good, boxingBackup: 2 });
    await expect.poll(() => alerts(page), { timeout: 20000 }).toContain('cannot open this passphrase file');
    expect((await passphraseDialogState(page)).open).toBe(false);
    expect(await titles(page)).toEqual(['Still Mine']);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('AC7: decryption does not relax the structure or size caps', async ({ browser }) => {
    test.setTimeout(150000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, { layout: bareLayout('Guarded Root'), snapData: bareLayout('Snap'), ts: SNAP_TS });
    await armExportCapture(page);

    // structurally invalid layout, correctly sealed -> the existing structure checks reject it
    const badShape = await seal(JSON.stringify({ version: 3.5, boxes: [{ id: 'L1', x: 'not-a-number', y: 0 }] }), 'cap-check');
    await runImport(page, 'bad-shape.json', badShape);
    await typePassphrase(page, 'cap-check', null);
    await expect.poll(() => alerts(page), { timeout: 25000 }).toMatch(/invalid data format|import failed/i);
    expect(await titles(page)).toEqual(['Guarded Root']);
    expect(await downloadCount(page)).toBe(0);

    // over the 2,000,000-char SEC-06 payload cap while staying inside the 5MB file gate
    const huge = JSON.stringify({ version: 3.5, boxes: [], pad: 'x'.repeat(2000001) });
    expect(Buffer.byteLength(huge, 'utf8')).toBeLessThan(MAX_BACKUP_FILE_BYTES);
    await runImport(page, 'huge.json', await seal(huge, 'cap-check'));
    await typePassphrase(page, 'cap-check', null);
    await expect.poll(() => alerts(page), { timeout: 30000 }).toMatch(/invalid data format|import failed/i);
    expect(await titles(page)).toEqual(['Guarded Root']);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('AC7: sealing refuses instead of downgrading when the sealed file would exceed the gate', async ({ browser }) => {
    test.setTimeout(120000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // The bound itself comes from the module under test — the AC is about that public input
    // boundary, so restating the number here would let the test and the code drift together.
    const { maxInnerBytes } = await import(pathToFileURL(path.join(REPO_PATH, 'ntp', 'backup-crypto.js')).href);
    // A layout that serializes PAST the sealed bound but still inside the plain 5MB cap, with
    // no snapshot bodies left to trim. The only way "under" would be a plain fallback, which
    // would hand out exactly the content the user just asked to protect.
    const big = bareLayout('Too Fat To Seal');
    (big.boxes[0] as any).children = [{
      id: 'S1', title: 'bulk', x: 0, y: 0,
      bookmarks: Array.from({ length: 10000 }, (_, i) => ({
        id: 'B' + i, title: 'bookmark-' + i + '-' + 'x'.repeat(280), url: 'https://example.test/' + i,
      })),
    }];
    await boot(page, { layout: big, snapData: bareLayout('Snap'), ts: SNAP_TS });
    await armExportCapture(page);

    await setEncryptOption(page, true);
    await click(page, '#export-data-btn');
    await typePassphrase(page, 'refuse-me', 'refuse-me');
    await expect.poll(() => alerts(page), { timeout: 30000 }).toMatch(/too large to encrypt/i);
    expect(await downloadCount(page)).toBe(0);
    expect((await passphraseDialogState(page)).open).toBe(false);

    // the plain path over the SAME data still exports: the tighter bound applies to sealing only
    await setEncryptOption(page, false);
    await click(page, '#export-data-btn');
    const plain = await readExport(page);
    const bytes = Buffer.byteLength(plain.text!, 'utf8');
    expect(bytes).toBeGreaterThan(maxInnerBytes());
    expect(bytes).toBeLessThanOrEqual(MAX_BACKUP_FILE_BYTES);
    expect(JSON.parse(plain.text!).boxes[0].children[0].bookmarks).toHaveLength(10000);

    // and the importer still gates a SEALED file by its own size: too big is rejected before
    // the dialog ever opens, so no passphrase can be traded for an unimportable payload
    const overGate = await seal(JSON.stringify({ version: 3.5, boxes: [], pad: 'y'.repeat(4500000) }), 'over-gate');
    expect(Buffer.byteLength(JSON.stringify(overGate), 'utf8')).toBeGreaterThan(MAX_BACKUP_FILE_BYTES);
    await runImport(page, 'over-gate.json', overGate);
    await expect.poll(() => alerts(page), { timeout: 20000 }).toMatch(/too large/i);
    expect((await passphraseDialogState(page)).open).toBe(false);
    expect(await titles(page)).toEqual(['Too Fat To Seal']);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('AC8: a sealed full DR package restores the layout only, never the archived bodies', async ({ browser }) => {
    test.setTimeout(120000);
    const source = await browser.newContext();
    const pageA = await source.newPage();
    await boot(pageA, { layout: bareLayout('Full Package Root'), snapData: bareLayout('Historic Snap Body'), ts: SNAP_TS });
    const cap = await exportFile(pageA, { passphrase: 'full-package', full: true });
    const env = JSON.parse(await openSealed(JSON.parse(cap.text!), 'full-package'));
    expect(env.meta.fullPackage).toBe(true);
    expect(env._bodies.snapshots[0].data.boxes[0].title).toBe('Historic Snap Body');
    await source.close();

    const target = await browser.newContext();
    const pageB = await target.newPage();
    await boot(pageB);
    await runImport(pageB, 'sealed-full.json', cap.text!);
    await typePassphrase(pageB, 'full-package', null);
    await expect.poll(() => titles(pageB), { timeout: 20000 }).toEqual(['Full Package Root']);
    const after = await pageB.evaluate(() => ({
      index: JSON.parse(localStorage.getItem('bxstore:snap.v1.index') || '[]') as any[],
      titles: (window as any).__boxingDebug.layout.boxes.map((b: any) => b.title),
    }));
    // the exported snapshot body (ts=SNAP_TS) is not replayed into the target install
    expect(after.index.some((e) => e.ts === SNAP_TS)).toBe(false);
    expect(after.titles).not.toContain('Historic Snap Body');
    // and the target still gets its own pre-restore safety copy (existing import semantics)
    expect(after.index.length).toBeGreaterThanOrEqual(1);
    await target.close();
  });
});
