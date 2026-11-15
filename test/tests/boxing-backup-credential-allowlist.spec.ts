// Boxing — ticket 122 (spec #120 T2): explicit field allowlist protection for backups,
// exports, Time Machine snapshots, SW pre-update COW snapshots, and log/error redaction.
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dismissOnboarding } from '../helpers/onboarding';
import {
  ALLOWED_AUTO_TITLE_RULE_KEYS,
  ALLOWED_BACKUP_BOOKMARK_KEYS,
  ALLOWED_BACKUP_CONN_KEYS,
  ALLOWED_BACKUP_CONN_PROPS_KEYS,
  ALLOWED_BACKUP_LARGE_BOX_KEYS,
  ALLOWED_BACKUP_META_KEYS,
  ALLOWED_BACKUP_SETTINGS_KEYS,
  ALLOWED_BACKUP_SMALL_BOX_KEYS,
  ALLOWED_BACKUP_TOP_LEVEL_KEYS,
  ALLOWED_BACKUP_VIEW_STATE_KEYS,
  redactSensitiveLogText,
  redactUrlForLog,
  sanitizeConflictArchiveForExport,
  sanitizeCorruptArchiveForExport,
  sanitizeDrBodiesForExport,
  sanitizeDrIndexRowsForExport,
  sanitizeLayoutForBackup,
  sanitizeSettingsForBackup,
  sanitizeSnapshotArchiveForExport,
} from '../../ntp/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_PATH = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(REPO_PATH, 'ntp', 'index.html')).href;

const SPEC_PASS = process.env.BOXING_SPEC_WEBDAV_PASS || 'spec-pass-v122';
const SPEC_TOKEN = process.env.BOXING_SPEC_GIST_TOKEN || 'ghp_specTokenForIssue122Test';
const SPEC_USER = process.env.BOXING_SPEC_WEBDAV_USER || 'spec-user-122';
const SPEC_WEBDAV_URL = process.env.BOXING_SPEC_WEBDAV_URL || 'https://webdav.invalid/dav/';
const SNAP_TS = 1700000001000;
const CONFLICT_TS = 1700000002000;
const CORRUPT_TS = 1700000003000;

const FORBIDDEN_SNIPPETS = [
  '_encWebdavPass',
  '_encGistToken',
  'webdavUrl',
  'webdavUser',
  'webdavAllowPrivateHost',
  'gistId',
  'boxingCredKey',
  'extraSecret',
  'injectedTopField',
  'injectedMetaField',
  'injectedBoxSecret',
  'injectedVsSecret',
  'injectedSmallSecret',
  'injectedBmSecret',
  'injectedConnSecret',
  'injectedRuleSecret',
  'injectedPropKey',
  'runtimePerf',
  SPEC_PASS,
  SPEC_TOKEN,
];

function loadBackgroundHarness(initialStorage: Record<string, any> = {}) {
  const store: Record<string, any> = structuredClone(initialStorage);
  let onInstalledListener: ((details: any) => Promise<void> | void) | null = null;
  const mockChrome = {
    storage: {
      local: {
        get: (keys: any, cb?: (r: any) => void) => {
          const read = () => {
            if (keys == null) return structuredClone(store);
            if (typeof keys === 'string') return { [keys]: keys in store ? structuredClone(store[keys]) : undefined };
            if (Array.isArray(keys)) {
              const res: Record<string, any> = {};
              for (const k of keys) res[k] = k in store ? structuredClone(store[k]) : undefined;
              return res;
            }
            const res: Record<string, any> = {};
            for (const [k, defVal] of Object.entries(keys)) {
              res[k] = k in store && store[k] !== undefined ? structuredClone(store[k]) : defVal;
            }
            return res;
          };
          const out = read();
          if (typeof cb === 'function') { cb(out); return undefined; }
          return Promise.resolve(out);
        },
        set: (items: Record<string, any>, cb?: () => void) => {
          for (const [k, v] of Object.entries(items)) store[k] = structuredClone(v);
          if (typeof cb === 'function') { cb(); return undefined; }
          return Promise.resolve();
        },
        remove: (keys: string | string[]) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) delete store[k];
          return Promise.resolve();
        },
      },
      sync: { get: (_k: any, cb?: (r: any) => void) => { cb && cb({}); } },
    },
    alarms: { onAlarm: { addListener: () => {} } },
    runtime: {
      id: 'spec-ext-id',
      getURL: (p: string) => 'chrome-extension://spec-ext-id/' + (p || ''),
      onMessage: { addListener: () => {} },
      onInstalled: {
        addListener: (fn: (details: any) => Promise<void> | void) => { onInstalledListener = fn; },
      },
      lastError: null,
    },
  };
  const sandbox: any = {
    chrome: mockChrome,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date,
    Math,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    Set,
    Map,
    URL,
    Headers,
    TextDecoder,
    Promise,
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const bgCode = fs.readFileSync(path.join(REPO_PATH, 'background.js'), 'utf8');
  vm.runInNewContext(bgCode, sandbox, { filename: 'background.js' });
  return {
    sandbox,
    store,
    triggerOnInstalled: async (details: any) => {
      if (!onInstalledListener) throw new Error('onInstalled listener not registered');
      await onInstalledListener(details);
    },
  };
}

function buildDirtyLayout() {
  return {
    version: 3.5,
    schemaVersion: 3,
    nextLargeIndex: 3,
    boxingCredKey: 'SHOULD_NEVER_EXPORT_TOP',
    __perfStats: { bootedAt: 123 },
    injectedTopField: 'extraSecret',
    groups: [{ id: 'g1', name: 'runtime-only' }],
    boxes: [
      {
        id: 'L1',
        type: 'large',
        title: 'Work',
        x: 48,
        y: 96,
        width: 360,
        height: 260,
        nextSmallIndex: 2,
        collapseHover: false,
        pinned: true,
        isParent: false,
        injectedBoxSecret: 'nope',
        groups: ['stale'],
        viewState: {
          innerZoom: 1.25,
          innerPanX: 12,
          innerPanY: -8,
          updatedAt: 1700000000100,
          injectedVsSecret: 999,
          badNaN: Number.NaN,
        },
        children: [
          {
            id: 'S1',
            type: 'small',
            title: 'Docs',
            x: 16,
            y: 32,
            width: 240,
            height: 200,
            pinned: false,
            collapseHover: true,
            isParent: false,
            injectedSmallSecret: 'nope-small',
            bookmarks: [
              {
                id: 'B1',
                title: 'Example',
                url: 'https://example.com/docs',
                injectedBmSecret: 'bm-secret',
              },
            ],
          },
        ],
      },
    ],
    connections: [
      {
        id: 'C1',
        from: 'large:L1',
        to: 'small:L1:S1',
        source: 'L1',
        target: 'S1',
        createdAt: 1700000000200,
        props: { injectedPropKey: 'bad' },
        injectedConnSecret: 'conn-secret',
      },
    ],
    settings: {
      selectedLanguage: 'zh_CN',
      rememberLastPos: true,
      zoomLevel: 1.1,
      darkMode: true,
      fontSize: 15,
      squareCorners: false,
      autoBackupInterval: 3600,
      lastBackupAt: 1700000000050,
      headerPinned: false,
      syncProvider: 'webdav',
      urlOpenMode: 'newTab',
      connDeleteAction: 'confirm',
      theme: 'ocean',
      autoTitleEnabled: true,
      autoTitleRules: [
        { pattern: 'https://example.com/*', type: 'contains', injectedRuleSecret: 'drop-me' },
        { pattern: 'only-pattern' },
      ],
      lastSettingsTab: 'sync',
      onboardingCompleted: true,
      syncLevel: 'full',
      syncFileName: 'custom-boxing.json',
      lastSyncAt: 1700000000090,
      lastKnownBoxCountBaseline: 1,
      webdavUrl: 'https://' + SPEC_USER + ':' + SPEC_PASS + '@webdav.invalid/dav?tok=abc#frag',
      webdavUser: SPEC_USER,
      webdavAllowPrivateHost: true,
      _encWebdavPass: { v: 3, s: 'salt==', iv: 'iv==', d: 'cipher==' },
      gistId: 'abcdef1234567890',
      _encGistToken: { k: 'v1-key', iv: 'v1-iv', d: 'v1-data' },
      boxingCredKey: 'SHOULD_NEVER_EXPORT_SETTINGS',
      extraSecret: SPEC_PASS,
    },
    _meta: {
      revision: 7,
      updatedAt: 1700000000300,
      writerId: 'tab-writer-1',
      baseRevision: 6,
      __groupsMigrated: true,
      deleted: { 'bm:B9': 1700000000010, badEntry: 'not-a-number' },
      injectedMetaField: 'bad-meta',
    },
  };
}

async function openBackupPassphraseDecrypted(sealedText: string, passphrase: string) {
  const env = JSON.parse(sealedText);
  const b64ToBytes = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'));
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const aesKey = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(env.kdf.salt), iterations: env.kdf.iterations, hash: env.kdf.hash },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(env.cipher.iv) },
    aesKey,
    b64ToBytes(env.payload),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

async function bootCleanPage(page: Page, opts: { mockNetwork?: boolean } = {}) {
  if (opts.mockNetwork) {
    await page.addInitScript(() => {
      const w = window as any;
      w.__bgCalls = [];
      w.__fetchCalls = [];
      w.chrome = {
        runtime: {
          sendMessage: (msg: any, cb: (r: any) => void) => {
            w.__bgCalls.push(JSON.parse(JSON.stringify(msg)));
            if (msg.type === 'webdav-test') return cb && cb({ success: false, status: 401, ok: false, error: 'Bearer ghp_leakedInError401' });
            if (msg.type === 'webdav-get') return cb && cb({ success: true, status: 404, ok: false, body: null });
            if (msg.type === 'webdav-put') return cb && cb({ success: true, status: 201, ok: true });
            if (msg.type === 'webdav-delete') return cb && cb({ success: true, status: 204, ok: true });
            return cb && cb({ success: true, status: 200, ok: true });
          },
          getURL: (p: string) => p,
          lastError: null,
        },
      };
      const origFetch = window.fetch.bind(window);
      window.fetch = (input: any, init?: any) => {
        const u = typeof input === 'string' ? input : (input && input.url) || '';
        if (u.includes('api.github.com/gists')) {
          w.__fetchCalls.push({ url: u, method: init?.method, body: init?.body });
          return Promise.resolve(new Response(JSON.stringify({ id: 'deadbeef123456' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        return origFetch(input, init);
      };
    });
  }
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as any).__boxingDebug?.sanitizeLayoutForBackup)
    && typeof (window as any).__boxingEncryptCredential === 'function'
    && typeof (window as any).__boxingDecryptCredential === 'function'
    && Boolean((window as any).__bxSync?.buildSyncPayload),
  ), { timeout: 15000 }).toBe(true);
  await dismissOnboarding(page);
}

async function armDownloadCapture(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    if (!w.__cap122Armed) {
      w.__cap122Armed = true;
      const origCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob: Blob) => {
        blob.text().then((t) => { w.__cap122.text = t; w.__cap122.count += 1; });
        return origCreate(blob);
      };
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        if (this.download) w.__cap122.name = this.download;
        return origClick.apply(this, arguments as any);
      };
    }
    w.__cap122 = { text: null, name: null, count: 0 };
  });
}

async function readCapturedDownload(page: Page) {
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__cap122?.text)), { timeout: 10000 }).toBe(true);
  return page.evaluate(() => ({ name: (window as any).__cap122.name as string, text: (window as any).__cap122.text as string }));
}

function assertCleanSerialized(serialized: string, contextLabel: string) {
  for (const snippet of FORBIDDEN_SNIPPETS) {
    expect(serialized, `${contextLabel} leaked forbidden snippet "${snippet}"`).not.toContain(snippet);
  }
}

test.describe('Ticket 122 (#120 T2) — Backup & Snapshot Credential Allowlist Protection', () => {
  test('pure allowlist strips v1/v2/v3 creds, targets, runtime/unknown keys and stays 1:1 with background SW helper', () => {
    const dirty = buildDirtyLayout();
    const clean = sanitizeLayoutForBackup(dirty);
    const serialized = JSON.stringify(clean);

    assertCleanSerialized(serialized, 'sanitizeLayoutForBackup');

    // Every exported key stays strictly inside the frozen allowlist at each tier.
    expect(Object.keys(clean).every((k) => ALLOWED_BACKUP_TOP_LEVEL_KEYS.includes(k))).toBe(true);
    expect(Object.keys(clean.settings).every((k) => ALLOWED_BACKUP_SETTINGS_KEYS.includes(k))).toBe(true);
    expect(Object.keys(clean._meta).every((k) => ALLOWED_BACKUP_META_KEYS.includes(k))).toBe(true);
    expect(clean._meta.deleted).toEqual({ 'bm:B9': 1700000000010 });
    expect(clean.settings.darkMode).toBe('dark');
    expect(clean.settings.autoTitleRules).toEqual([{ pattern: 'https://example.com/*', type: 'contains' }]);
    expect(Object.keys(clean.settings.autoTitleRules[0]).every((k) => ALLOWED_AUTO_TITLE_RULE_KEYS.includes(k))).toBe(true);

    const lb = clean.boxes[0];
    expect(Object.keys(lb).every((k) => ALLOWED_BACKUP_LARGE_BOX_KEYS.includes(k))).toBe(true);
    expect(Object.keys(lb.viewState).every((k) => ALLOWED_BACKUP_VIEW_STATE_KEYS.includes(k))).toBe(true);
    expect(lb.viewState.badNaN).toBeUndefined();
    const sb = lb.children[0];
    expect(Object.keys(sb).every((k) => ALLOWED_BACKUP_SMALL_BOX_KEYS.includes(k))).toBe(true);
    expect(Object.keys(sb.bookmarks[0]).every((k) => ALLOWED_BACKUP_BOOKMARK_KEYS.includes(k))).toBe(true);
    const conn = clean.connections[0];
    expect(Object.keys(conn).every((k) => ALLOWED_BACKUP_CONN_KEYS.includes(k))).toBe(true);
    // Keep empty {} props object so migrateLayout does not treat it as needing backfill.
    expect(conn.props).toEqual({});
    expect(ALLOWED_BACKUP_CONN_PROPS_KEYS).toEqual([]);

    // Plaintext string credentials + settings=null / settings=undefined cases.
    const cleanSettingsFromPlain = sanitizeSettingsForBackup({
      _encWebdavPass: 'plain-pass',
      _encGistToken: { v: 2, s: 's', iv: 'i', d: 'd' },
      webdavUrl: SPEC_WEBDAV_URL,
      gistId: '123456',
      syncLevel: 'full',
    });
    expect(cleanSettingsFromPlain).toEqual({ syncLevel: 'full' });

    const boxesOnly = sanitizeLayoutForBackup({ ...dirty, settings: null });
    expect(boxesOnly.settings).toBeNull();

    const legacyPreUpdate = {
      version: 3.5,
      schemaVersion: 1,
      boxes: [{ id: 'L1', type: 'large', title: 'legacy', x: 0, y: 0, width: 320, height: 220, children: [] }],
      nextLargeIndex: 2,
      connections: [{ id: 'C1', from: 'large:L1', to: 'large:L1', createdAt: 123 }],
      groups: [{ parentId: 'large:L1' }],
      extraPreUpdateCred: SPEC_PASS,
    };
    const cleanLegacy = sanitizeLayoutForBackup(legacyPreUpdate);
    expect('settings' in cleanLegacy).toBe(false);
    expect(cleanLegacy.boxes[0].isParent).toBeUndefined();
    expect('groups' in cleanLegacy).toBe(false);
    expect('extraPreUpdateCred' in cleanLegacy).toBe(false);

    // Background SW self-contained helper matches ntp/utils.js 1:1.
    const { sandbox } = loadBackgroundHarness();
    const swSanitize = sandbox.__boxingSwSanitizeLayoutForBackup;
    expect(typeof swSanitize).toBe('function');
    expect(JSON.parse(JSON.stringify(swSanitize(dirty)))).toEqual(clean);
    expect(JSON.parse(JSON.stringify(swSanitize(legacyPreUpdate)))).toEqual(cleanLegacy);
    expect(JSON.parse(JSON.stringify(swSanitize({ ...dirty, settings: null })))).toEqual(boxesOnly);

    // Non-object / array-corrupted top-level layout must fail closed to {} (never return raw payload).
    const arrayCorrupt = [{ settings: { _encGistToken: { v: 2, d: SPEC_TOKEN }, extra: SPEC_PASS } }];
    expect(sanitizeLayoutForBackup(arrayCorrupt)).toEqual({});
    expect(JSON.parse(JSON.stringify(swSanitize(arrayCorrupt)))).toEqual({});
    expect(sanitizeLayoutForBackup('raw-secret-' + SPEC_PASS)).toEqual({});
    expect(JSON.parse(JSON.stringify(swSanitize('raw-secret-' + SPEC_PASS)))).toEqual({});
    expect(sanitizeLayoutForBackup(null)).toEqual({});
    expect(JSON.parse(JSON.stringify(swSanitize(null)))).toEqual({});

    // DR archive + index sanitizers strip/redact credentials cleanly.
    const drBodies = sanitizeDrBodiesForExport({
      snapshots: [{ ts: SNAP_TS, schemaVersion: 3, reason: 'manual', data: dirty, extraBodyKey: 'drop' }],
      conflicts: [{ ts: CONFLICT_TS, reason: 'sync', side: 'cloud', size: 100, boxes: 1, raw: dirty, extra: 'drop' }],
      corrupt: [{
        ts: CORRUPT_TS,
        error: 'Failed https://' + SPEC_USER + ':' + SPEC_PASS + '@webdav.invalid/dav?tok=secret Bearer ' + SPEC_TOKEN,
        size: 88,
        raw: JSON.stringify(dirty),
        extraCorrupt: 'drop',
      }],
    });
    assertCleanSerialized(JSON.stringify(drBodies), 'sanitizeDrBodiesForExport');
    expect(drBodies.corrupt[0].error).toContain('***:***@webdav.invalid/dav?***');
    expect(drBodies.corrupt[0].error).toContain('Bearer [REDACTED]');

    const drIdx = sanitizeDrIndexRowsForExport('corrupt', [
      { ts: CORRUPT_TS, error: 'Basic YWxpY2U6c2VjcmV0 at https://u:p@h.test/?q=1', size: 12, truncated: false, rawLeak: 'drop' },
    ]);
    assertCleanSerialized(JSON.stringify(drIdx), 'sanitizeDrIndexRowsForExport');
    expect(drIdx[0].error).toContain('Basic [REDACTED]');
    expect(drIdx[0].error).toContain('https://***:***@h.test/?***');
    expect(drIdx[0].rawLeak).toBeUndefined();

    // Non-JSON broken raw string in corrupt archive & array raw in conflict archive must fail closed.
    const brokenCorrupt = sanitizeCorruptArchiveForExport({
      ts: CORRUPT_TS,
      error: 'SyntaxError',
      raw: '{"settings":{"_encWebdavPass":{"v":3},"extraSecret":"' + SPEC_PASS + '"',
    });
    expect(brokenCorrupt.raw).toBe('[REDACTED_CORRUPT_RAW]');

    const arrayConflict = sanitizeConflictArchiveForExport({
      ts: CONFLICT_TS,
      reason: 'sync',
      side: 'cloud',
      size: 40,
      boxes: 0,
      raw: [{ _encWebdavPass: { v: 3 }, extraSecret: SPEC_PASS }],
    });
    expect(arrayConflict.raw).toEqual([]);

    // URL and log text redaction unit edge cases (including commas, semicolons, and parentheses inside query/hash).
    expect(redactUrlForLog('https://alice:secret@dav.example.com/root?token=123#frag')).toBe('https://***:***@dav.example.com/root?***#***');
    const redactedMixed = redactSensitiveLogText(
      'Authorization: Basic dXNlcjpwYXNz {"url":"https://u:p@h.test/p?k=v#h","boxingCredKey.v1":"secret-pik","_encGistToken":{"v":3}}',
    );
    expect(redactedMixed).toContain('Basic [REDACTED]');
    expect(redactedMixed).toContain('"url":"https://***:***@h.test/p?***#***"');
    expect(redactedMixed).toContain('"boxingCredKey.v1":"[REDACTED]"');
    expect(redactedMixed).toContain('"_encGistToken":"[REDACTED]"');

    const redactedPunctQuery = redactSensitiveLogText(
      'err1=https://dav.example/x?labels=a,b&access_token=' + SPEC_TOKEN +
      ' err2=https://dav.example/x?a=1;token=' + SPEC_PASS +
      ' err3=(https://u:p@dav.example/x?q=(1,2);z=3&token=' + SPEC_TOKEN + '#frag,a;b(c))',
    );
    expect(redactedPunctQuery).not.toContain(SPEC_TOKEN);
    expect(redactedPunctQuery).not.toContain(SPEC_PASS);
    expect(redactedPunctQuery).not.toContain('u:p@');
    expect(redactedPunctQuery).not.toContain('access_token=');
    expect(redactedPunctQuery).not.toContain('frag,a');
    expect(redactedPunctQuery).toContain('err1=https://dav.example/x?***');
    expect(redactedPunctQuery).toContain('err2=https://dav.example/x?***');
    expect(redactedPunctQuery).toContain('err3=(https://***:***@dav.example/x?***#***)');
  });

  test('SW takePreUpdateSnapshot strips credentials/groups while preserving legacy shape and bgErr redacts logs', async () => {
    const dirty = buildDirtyLayout();
    const harness1 = loadBackgroundHarness({ boxingLayout: dirty });
    await harness1.triggerOnInstalled({ reason: 'update', previousVersion: '2026.10.0' });
    const idx1 = harness1.store['snap.v1.index'];
    expect(Array.isArray(idx1) && idx1.length === 1).toBe(true);
    const snap1 = harness1.store['snap.v1.' + idx1[0].ts];
    assertCleanSerialized(JSON.stringify(snap1), 'SW pre-update snapshot');
    expect(snap1.data.boxes[0].title).toBe('Work');

    // Legacy shape (no settings, isParent undefined) stays unmigrated per Ticket 42.
    const legacy = {
      version: 3.5,
      schemaVersion: 1,
      boxes: [{ id: 'L1', type: 'large', title: 'legacy', x: 0, y: 0, width: 320, height: 220, children: [] }],
      nextLargeIndex: 2,
      connections: [{ id: 'C1', from: 'large:L1', to: 'large:L1', createdAt: 123 }],
      groups: [{ parentId: 'large:L1' }],
      extraCred: SPEC_PASS,
    };
    const harness2 = loadBackgroundHarness({ boxingLayout: legacy });
    await harness2.triggerOnInstalled({ reason: 'update', previousVersion: '2026.9.0' });
    const idx2 = harness2.store['snap.v1.index'];
    const snap2 = harness2.store['snap.v1.' + idx2[0].ts];
    expect(snap2.data.settings).toBeUndefined();
    expect(snap2.data.boxes[0].isParent).toBeUndefined();
    expect(snap2.data.groups).toBeUndefined();
    expect(snap2.data.extraCred).toBeUndefined();

    // Array-corrupted boxingLayout in storage must NOT be written into pre-update snapshot.
    const harnessArray = loadBackgroundHarness({
      boxingLayout: [{ settings: { _encGistToken: { v: 2, d: SPEC_TOKEN }, extra: SPEC_PASS } }],
    });
    await harnessArray.triggerOnInstalled({ reason: 'update', previousVersion: '2026.10.0' });
    expect(harnessArray.store['snap.v1.index']).toBeUndefined();
    assertCleanSerialized(
      JSON.stringify(Object.entries(harnessArray.store).filter(([k]) => k.startsWith('snap.v1.'))),
      'SW corrupt-array snapshot guard',
    );

    // Trigger bgErr directly with sensitive payload (including punctuation in query) and verify bgErrLog redacts it.
    harness1.sandbox.bgErr(
      'PUT failed url=https://u:p@dav.example/f?labels=a,b;q=(1)&tok=' + SPEC_PASS + '#h,1 Bearer ' + SPEC_TOKEN + ' {"_encWebdavPass":{"v":3}}',
    );
    const bgLogText = JSON.stringify(harness1.store.bgErrLog);
    expect(bgLogText).not.toContain('u:p@');
    expect(bgLogText).not.toContain('tok=');
    expect(bgLogText).not.toContain(SPEC_PASS);
    expect(bgLogText).not.toContain(SPEC_TOKEN);
    expect(bgLogText).toContain('Bearer [REDACTED]');
    expect(bgLogText).toContain('https://***:***@dav.example/f?***#***');
  });

  test('sync payloads, WebDAV/Gist pushes, local backup, plain/DR/conflict/sealed exports strip creds without mutating storage archives', async ({ page }) => {
    test.setTimeout(60000);
    await bootCleanPage(page, { mockNetwork: true });

    // Seed live encrypted credentials + dirty runtime/unknown fields + dirty historical DR archives.
    await page.evaluate(async (seed) => {
      const dbg = (window as any).__boxingDebug;
      const enc = (window as any).__boxingEncryptCredential;
      dbg.layout.boxes = [
        {
          id: 'L1',
          type: 'large',
          title: 'SafeBox',
          x: 24,
          y: 24,
          width: 320,
          height: 220,
          nextSmallIndex: 2,
          injectedBoxSecret: 'drop-box',
          children: [
            {
              id: 'S1',
              type: 'small',
              title: 'Child',
              x: 16,
              y: 16,
              width: 240,
              height: 200,
              injectedSmallSecret: 'drop-small',
              bookmarks: [{ id: 'B1', title: 'Site', url: 'https://example.com', injectedBmSecret: 'drop-bm' }],
            },
          ],
        },
      ];
      dbg.layout.nextLargeIndex = 2;
      dbg.layout.connections = [{ id: 'C1', from: 'large:L1', to: 'small:L1:S1', createdAt: 100, props: { injectedPropKey: 'bad' } }];
      dbg.layout.injectedTopField = 'extraSecret';
      dbg.layout.groups = [{ id: 'runtime-g' }];
      dbg.layout.settings.syncProvider = 'webdav';
      dbg.layout.settings.syncLevel = 'full';
      dbg.layout.settings.syncFileName = 'sync-clean.json';
      dbg.layout.settings.webdavUrl = seed.webdavUrl;
      dbg.layout.settings.webdavUser = seed.webdavUser;
      dbg.layout.settings.webdavAllowPrivateHost = true;
      dbg.layout.settings._encWebdavPass = await enc(seed.pass);
      dbg.layout.settings.gistId = 'abcdef1234567890';
      dbg.layout.settings._encGistToken = await enc(seed.token);
      dbg.layout.settings.extraSecret = seed.pass;
      dbg.layout.settings.autoTitleRules = [{ pattern: 'https://example.com', type: 'contains', injectedRuleSecret: 'drop-rule' }];
      dbg.layout._meta.updatedAt = Date.now() + 50000;
      dbg.layout._meta.injectedMetaField = 'drop-meta';

      // Set live form inputs so WebDAV & Gist actions have decrypted secrets in memory.
      const wdPassEl = document.getElementById('webdav-pass') as HTMLInputElement | null;
      const wdUrlEl = document.getElementById('webdav-url') as HTMLInputElement | null;
      const wdUserEl = document.getElementById('webdav-user') as HTMLInputElement | null;
      const gistTokEl = document.getElementById('gist-token') as HTMLInputElement | null;
      const gistIdEl = document.getElementById('gist-id') as HTMLInputElement | null;
      if (wdUrlEl) wdUrlEl.value = seed.webdavUrl;
      if (wdUserEl) wdUserEl.value = seed.webdavUser;
      if (wdPassEl) wdPassEl.value = seed.pass;
      if (gistTokEl) gistTokEl.value = seed.token;
      if (gistIdEl) gistIdEl.value = 'abcdef1234567890';

      await dbg.saveLayout();

      // Seed dirty historical snapshot, conflict archive, and corrupt archive directly in storage.
      const dirtySnapData = {
        version: 3.5,
        schemaVersion: 3,
        nextLargeIndex: 2,
        boxes: [{ id: 'L1', type: 'large', title: 'HistSnap', x: 0, y: 0, width: 320, height: 220, children: [] }],
        connections: [],
        injectedTopField: 'extraSecret',
        settings: {
          syncProvider: 'webdav',
          webdavUrl: seed.webdavUrl,
          webdavUser: seed.webdavUser,
          _encWebdavPass: { v: 2, s: 'old', iv: 'old', d: 'old' },
          _encGistToken: { k: 'v1k', iv: 'v1iv', d: 'v1d' },
          gistId: 'histgist999',
          extraSecret: seed.pass,
        },
      };
      const dirtyConflictEntry = {
        ts: seed.conflictTs,
        reason: 'webdav-field-conflict',
        side: 'local',
        size: 512,
        boxes: 1,
        extraArchiveField: 'drop-archive',
        raw: dirtySnapData,
      };
      const dirtyCorruptEntry = {
        ts: seed.corruptTs,
        error: 'Bad JSON near https://bob:' + seed.pass + '@dav.example/x?k=1 Bearer ' + seed.token,
        size: 300,
        raw: JSON.stringify(dirtySnapData),
      };
      await dbg.storageSet({
        'snap.v1.index': [{ ts: seed.snapTs, schemaVersion: 3, size: 400, leakedIdxKey: 'drop' }],
        ['snap.v1.' + seed.snapTs]: { ts: seed.snapTs, schemaVersion: 3, data: dirtySnapData },
        'boxingLayout.conflict.index': [{ ts: seed.conflictTs, reason: 'webdav-field-conflict', side: 'local', size: 512, boxes: 1 }],
        ['boxingLayout.conflict.' + seed.conflictTs]: dirtyConflictEntry,
        'boxingLayout.corrupt.index': [{ ts: seed.corruptTs, error: dirtyCorruptEntry.error, size: 300, truncated: false }],
        ['boxingLayout.corrupt.' + seed.corruptTs]: dirtyCorruptEntry,
      });
    }, {
      webdavUrl: SPEC_WEBDAV_URL,
      webdavUser: SPEC_USER,
      pass: SPEC_PASS,
      token: SPEC_TOKEN,
      snapTs: SNAP_TS,
      conflictTs: CONFLICT_TS,
      corruptTs: CORRUPT_TS,
    });

    // Snapshot raw seeded storage strings to assert non-mutation after DR/conflict exports.
    const rawArchiveBefore = await page.evaluate(async ({ snapTs, conflictTs, corruptTs }) => {
      const dbg = (window as any).__boxingDebug;
      const got = await dbg.storageGet([
        'snap.v1.' + snapTs,
        'boxingLayout.conflict.' + conflictTs,
        'boxingLayout.corrupt.' + corruptTs,
      ]);
      return JSON.stringify(got);
    }, { snapTs: SNAP_TS, conflictTs: CONFLICT_TS, corruptTs: CORRUPT_TS });

    // 1. buildSyncPayload across full / settingsOnly / boxesOnly
    const syncPayloads = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      const out: Record<string, any> = {};
      for (const lvl of ['full', 'settingsOnly', 'boxesOnly']) {
        dbg.layout.settings.syncLevel = lvl;
        out[lvl] = dbg.buildSyncPayload();
      }
      dbg.layout.settings.syncLevel = 'full';
      return out;
    });
    assertCleanSerialized(JSON.stringify(syncPayloads), 'buildSyncPayload all modes');
    expect(syncPayloads.full.boxes.length).toBe(1);
    expect(syncPayloads.full.connections[0].props).toEqual({});
    expect(syncPayloads.settingsOnly.boxes).toEqual([]);
    expect(syncPayloads.settingsOnly.connections).toEqual([]);
    expect(syncPayloads.boxesOnly.settings).toBeNull();

    // 2. backupToWebDAV, syncWithWebDAV push, and backupToGist transmit only sanitized payloads
    await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const bxSync = (window as any).__bxSync;
      await dbg.backupWebDAV();
      await dbg.syncWebDAV();
      await bxSync.backupToGist();
    });

    const netResult = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const bgPuts = ((window as any).__bgCalls || []).filter((c: any) => c.type === 'webdav-put');
      const fetchCalls = (window as any).__fetchCalls || [];
      const syncBase = await dbg.storageGet('boxingLayout.syncBase');
      const liveMain = await dbg.storageGet('boxingLayout');
      return {
        bgPuts,
        fetchCalls,
        syncBase,
        liveSettings: dbg.layout.settings,
        storedSettings: liveMain?.boxingLayout?.settings,
      };
    });

    expect(netResult.bgPuts.length).toBe(2); // backupToWebDAV + syncWithWebDAV
    for (const put of netResult.bgPuts) {
      assertCleanSerialized(put.body, 'WebDAV PUT payload');
    }
    expect(netResult.fetchCalls.length).toBe(1);
    const gistOuter = JSON.parse(netResult.fetchCalls[0].body);
    const gistFileName = Object.keys(gistOuter.files)[0];
    assertCleanSerialized(gistOuter.files[gistFileName].content, 'Gist backup content');
    assertCleanSerialized(JSON.stringify(netResult.syncBase), 'stored syncBase');

    // Local runtime & stored boxingLayout STILL preserve valid credentials + remote config!
    expect(netResult.liveSettings.webdavUrl).toBe(SPEC_WEBDAV_URL);
    expect(netResult.liveSettings.webdavUser).toBe(SPEC_USER);
    expect(netResult.liveSettings._encWebdavPass?.v).toBe(3);
    expect(netResult.liveSettings._encGistToken?.v).toBe(3);
    expect(netResult.storedSettings.webdavUrl).toBe(SPEC_WEBDAV_URL);
    expect(netResult.storedSettings._encWebdavPass?.v).toBe(3);

    // 3. backupToLocal download is clean
    await armDownloadCapture(page);
    await page.evaluate(() => { (window as any).__bxSync.backupToLocal(); });
    const localBackupDl = await readCapturedDownload(page);
    assertCleanSerialized(localBackupDl.text, 'backupToLocal download');

    // 4. Plain export envelope (#export-data-btn)
    await armDownloadCapture(page);
    await page.evaluate(() => { document.getElementById('export-data-btn')?.click(); });
    const plainExport = await readCapturedDownload(page);
    assertCleanSerialized(plainExport.text, 'plain export envelope');
    const plainEnv = JSON.parse(plainExport.text);
    expect(plainEnv.meta.snapshots[0].leakedIdxKey).toBeUndefined();
    expect(plainEnv.meta.corrupt[0].error).toContain('Bearer [REDACTED]');

    // 5. Full DR package export (#export-full-dr-btn)
    await armDownloadCapture(page);
    await page.evaluate(() => { document.getElementById('export-full-dr-btn')?.click(); });
    const fullDrExport = await readCapturedDownload(page);
    assertCleanSerialized(fullDrExport.text, 'full DR package export');
    const fullDr = JSON.parse(fullDrExport.text);
    expect(fullDr.meta.fullPackage).toBe(true);
    expect(fullDr._bodies.snapshots[0].data.boxes[0].title).toBe('HistSnap');
    expect(fullDr._bodies.conflicts[0].extraArchiveField).toBeUndefined();
    expect(fullDr._bodies.corrupt[0].error).toContain('Bearer [REDACTED]');

    // 6. Export conflict copy (.data-conflict-export-btn)
    await page.evaluate(() => {
      document.getElementById('settings-btn')?.click();
      (document.querySelector('.settings-nav__item[data-tab="data"]') as HTMLElement | null)?.click();
    });
    await expect.poll(() => page.locator('#data-conflict-list .data-conflict-export-btn').count(), { timeout: 10000 }).toBeGreaterThan(0);
    await armDownloadCapture(page);
    await page.evaluate(() => {
      (document.querySelector('#data-conflict-list .data-conflict-export-btn') as HTMLElement | null)?.click();
    });
    const conflictExport = await readCapturedDownload(page);
    expect(conflictExport.name).toBe(`boxing-conflict-${CONFLICT_TS}.json`);
    assertCleanSerialized(conflictExport.text, 'exportConflictCopy download');

    // Underlying storage archives MUST remain unmutated (read-only export sanitization).
    const rawArchiveAfter = await page.evaluate(async ({ snapTs, conflictTs, corruptTs }) => {
      const dbg = (window as any).__boxingDebug;
      const got = await dbg.storageGet([
        'snap.v1.' + snapTs,
        'boxingLayout.conflict.' + conflictTs,
        'boxingLayout.corrupt.' + corruptTs,
      ]);
      return JSON.stringify(got);
    }, { snapTs: SNAP_TS, conflictTs: CONFLICT_TS, corruptTs: CORRUPT_TS });
    expect(rawArchiveAfter).toBe(rawArchiveBefore);

    // 7. Passphrase-sealed Full DR export (#export-encrypt-cb) directly from Data tab
    await armDownloadCapture(page);
    await page.evaluate(() => {
      (document.getElementById('export-encrypt-cb') as HTMLInputElement).checked = true;
      document.getElementById('export-full-dr-btn')?.click();
    });
    await expect.poll(() => page.evaluate(() => !document.getElementById('passphrase-modal')?.hidden), { timeout: 10000 }).toBe(true);
    const SEAL_PASS = 'correct-horse-122';
    await page.evaluate((p) => {
      (document.getElementById('passphrase-input') as HTMLInputElement).value = p;
      (document.getElementById('passphrase-repeat-input') as HTMLInputElement).value = p;
      document.getElementById('passphrase-action-btn')?.click();
    }, SEAL_PASS);
    const sealedExport = await readCapturedDownload(page);
    const decryptedDr = await openBackupPassphraseDecrypted(sealedExport.text, SEAL_PASS);
    assertCleanSerialized(JSON.stringify(decryptedDr), 'decrypted passphrase DR export');
    expect(decryptedDr.meta.fullPackage).toBe(true);
    expect(decryptedDr._bodies.snapshots[0].data.boxes[0].title).toBe('HistSnap');
  });

  test('Time Machine snapshot sanitization, active-cred rollback preservation, Ticket 99 non-resurrection, and log redaction', async ({ page }) => {
    test.setTimeout(50000);
    await bootCleanPage(page, { mockNetwork: true });

    // Seed local layout with creds and create a new Time Machine snapshot (v122 sanitized).
    const setup = await page.evaluate(async (seed) => {
      const dbg = (window as any).__boxingDebug;
      const enc = (window as any).__boxingEncryptCredential;
      dbg.layout.boxes = [
        { id: 'L1', type: 'large', title: 'Point A', x: 0, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [] },
      ];
      dbg.layout.nextLargeIndex = 2;
      dbg.layout.settings.syncProvider = 'webdav';
      dbg.layout.settings.webdavUrl = seed.webdavUrl;
      dbg.layout.settings.webdavUser = seed.webdavUser;
      dbg.layout.settings.webdavAllowPrivateHost = true;
      dbg.layout.settings._encWebdavPass = await enc(seed.pass);
      dbg.layout.settings.gistId = 'gist123456';
      dbg.layout.settings._encGistToken = await enc(seed.token);
      dbg.layout.settings.extraSecret = seed.pass;
      const wdUrlEl = document.getElementById('webdav-url') as HTMLInputElement | null;
      const wdUserEl = document.getElementById('webdav-user') as HTMLInputElement | null;
      const gistIdEl = document.getElementById('gist-id') as HTMLInputElement | null;
      if (wdUrlEl) wdUrlEl.value = seed.webdavUrl;
      if (wdUserEl) wdUserEl.value = seed.webdavUser;
      if (gistIdEl) gistIdEl.value = 'gist123456';
      await dbg.saveLayout();

      const snapTsA = await dbg.saveSnapshot('manual');
      const snapAStored = await dbg.storageGet('snap.v1.' + snapTsA);

      // Mutate canvas to Point B.
      dbg.layout.boxes.push({
        id: 'L2', type: 'large', title: 'Point B', x: 400, y: 0, width: 320, height: 220, nextSmallIndex: 1, children: [],
      });
      await dbg.saveLayout();

      return { snapTsA, snapAJson: JSON.stringify(snapAStored) };
    }, { webdavUrl: SPEC_WEBDAV_URL, webdavUser: SPEC_USER, pass: SPEC_PASS, token: SPEC_TOKEN });

    assertCleanSerialized(setup.snapAJson, 'saveSnapshot body');

    // Roll back to sanitized snapshot A via Time Machine UI — active local creds MUST survive!
    await page.evaluate(() => {
      document.getElementById('settings-btn')?.click();
      (document.querySelector('.settings-nav__item[data-tab="data"]') as HTMLElement | null)?.click();
    });
    await expect.poll(() => page.locator(`.data-snapshot-rollback-btn[data-ts="${setup.snapTsA}"]`).count(), { timeout: 10000 }).toBe(1);
    await page.evaluate((ts) => {
      const btn = document.querySelector(`.data-snapshot-rollback-btn[data-ts="${ts}"]`);
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }, setup.snapTsA);
    await expect.poll(() => page.evaluate(() => !document.getElementById('confirm-modal')?.hidden), { timeout: 5000 }).toBe(true);
    await page.evaluate(() => { document.getElementById('confirm-delete-btn')?.click(); });

    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map((b: any) => b.title)), { timeout: 10000 }).toEqual(['Point A']);
    const afterFirstRollback = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const dec = (window as any).__boxingDecryptCredential;
      return {
        restoredPassPlain: await dec(dbg.layout.settings._encWebdavPass),
        restoredTokenPlain: await dec(dbg.layout.settings._encGistToken),
        restoredWebdavUrl: dbg.layout.settings.webdavUrl,
        restoredWebdavUser: dbg.layout.settings.webdavUser,
        restoredAllowPrivate: dbg.layout.settings.webdavAllowPrivateHost,
        restoredGistId: dbg.layout.settings.gistId,
      };
    });
    expect(afterFirstRollback.restoredPassPlain).toBe(SPEC_PASS);
    expect(afterFirstRollback.restoredTokenPlain).toBe(SPEC_TOKEN);
    expect(afterFirstRollback.restoredWebdavUrl).toBe(SPEC_WEBDAV_URL);
    expect(afterFirstRollback.restoredWebdavUser).toBe(SPEC_USER);
    expect(afterFirstRollback.restoredAllowPrivate).toBe(true);
    expect(afterFirstRollback.restoredGistId).toBe('gist123456');

    // Ticket 99 non-resurrection: explicitly delete creds, then restore an OLD legacy snapshot with creds.
    const oldTs = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const ts = Date.now() - 60000;
      await dbg.storageSet({
        'snap.v1.index': [{ ts, schemaVersion: 3, size: 300 }],
        ['snap.v1.' + ts]: {
          ts,
          schemaVersion: 3,
          data: {
            version: 3.5,
            schemaVersion: 3,
            nextLargeIndex: 2,
            boxes: [{ id: 'L9', type: 'large', title: 'Old Snap', x: 0, y: 0, width: 320, height: 220, children: [] }],
            connections: [],
            settings: {
              syncProvider: 'webdav',
              _encWebdavPass: { v: 2, s: 's', iv: 'iv', d: 'cipher' },
              _encGistToken: { k: 'k', iv: 'iv', d: 'cipher' },
            },
          },
        },
      });
      await (window as any).__boxingDeleteSyncCredentials();
      document.getElementById('settings-btn')?.click();
      (document.querySelector('.settings-nav__item[data-tab="data"]') as HTMLElement | null)?.click();
      return ts;
    });
    await expect.poll(() => page.locator(`.data-snapshot-rollback-btn[data-ts="${oldTs}"]`).count(), { timeout: 10000 }).toBe(1);
    await page.evaluate((ts) => {
      const btn = document.querySelector(`.data-snapshot-rollback-btn[data-ts="${ts}"]`);
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }, oldTs);
    await expect.poll(() => page.evaluate(() => !document.getElementById('confirm-modal')?.hidden), { timeout: 5000 }).toBe(true);
    await page.evaluate(() => { document.getElementById('confirm-delete-btn')?.click(); });
    await expect.poll(() => page.evaluate(() => (window as any).__boxingDebug.layout.boxes.map((b: any) => b.title)), { timeout: 10000 }).toEqual(['Old Snap']);

    const phase2 = await page.evaluate(() => {
      const dbg = (window as any).__boxingDebug;
      return {
        encPass: dbg.layout.settings._encWebdavPass,
        encToken: dbg.layout.settings._encGistToken,
      };
    });
    expect(phase2.encPass).toBeUndefined();
    expect(phase2.encToken).toBeUndefined();

    // Single-credential non-resurrection: if only Gist token exists (WebDAV pass deleted),
    // rolling back to a legacy snapshot carrying both must NOT resurrect _encWebdavPass.
    const partialRes = await page.evaluate(async (seed) => {
      const dbg = (window as any).__boxingDebug;
      const enc = (window as any).__boxingEncryptCredential;
      dbg.layout.settings._encGistToken = await enc(seed.token);
      delete dbg.layout.settings._encWebdavPass;
      const legacyBothTs = Date.now() - 30000;
      await dbg.storageSet({
        ['snap.v1.' + legacyBothTs]: {
          ts: legacyBothTs,
          schemaVersion: 3,
          data: {
            version: 3.5,
            schemaVersion: 3,
            nextLargeIndex: 2,
            boxes: [{ id: 'L9', type: 'large', title: 'Old Snap', x: 0, y: 0, width: 320, height: 220, children: [] }],
            connections: [],
            settings: {
              syncProvider: 'gist',
              _encWebdavPass: { v: 2, s: 's', iv: 'iv', d: 'cipher' },
              _encGistToken: { k: 'k', iv: 'iv', d: 'cipher' },
            },
          },
        },
      });
      const rec = await dbg.restoreFromSnapshot(legacyBothTs);
      return {
        encPass: rec?.settings?._encWebdavPass,
        encToken: rec?.settings?._encGistToken,
      };
    }, { token: SPEC_TOKEN });
    expect(partialRes.encPass).toBeUndefined();
    expect(partialRes.encToken).toBeTruthy();

    // Cross-destination isolation: legacy snapshot with historical WebDAV URL/user (no pass) or Gist ID (no token)
    // must NOT inherit live _encWebdavPass / _encGistToken from the current destination.
    const crossDestRes = await page.evaluate(async (seed) => {
      const dbg = (window as any).__boxingDebug;
      const enc = (window as any).__boxingEncryptCredential;
      dbg.layout.settings.webdavUrl = 'https://current.webdav.invalid/dav';
      dbg.layout.settings.webdavUser = 'current-user';
      dbg.layout.settings.webdavAllowPrivateHost = true;
      dbg.layout.settings._encWebdavPass = await enc(seed.pass);
      dbg.layout.settings.gistId = 'current-gist-id';
      dbg.layout.settings._encGistToken = await enc(seed.token);
      const legacyDestTs = Date.now() - 20000;
      await dbg.storageSet({
        ['snap.v1.' + legacyDestTs]: {
          ts: legacyDestTs,
          schemaVersion: 3,
          data: {
            version: 3.5,
            schemaVersion: 3,
            nextLargeIndex: 2,
            boxes: [{ id: 'L9', type: 'large', title: 'Legacy Dest', x: 0, y: 0, width: 320, height: 220, children: [] }],
            connections: [],
            settings: {
              syncProvider: 'webdav',
              webdavUrl: 'https://legacy-other.invalid/dav',
              webdavUser: 'legacy-user',
              gistId: 'legacy-gist-id',
            },
          },
        },
      });
      const rec = await dbg.restoreFromSnapshot(legacyDestTs);
      return {
        webdavUrl: rec?.settings?.webdavUrl,
        webdavUser: rec?.settings?.webdavUser,
        encPass: rec?.settings?._encWebdavPass,
        allowPrivate: rec?.settings?.webdavAllowPrivateHost,
        gistId: rec?.settings?.gistId,
        encToken: rec?.settings?._encGistToken,
      };
    }, { pass: SPEC_PASS, token: SPEC_TOKEN });
    expect(crossDestRes.webdavUrl).toBe('https://legacy-other.invalid/dav');
    expect(crossDestRes.webdavUser).toBe('legacy-user');
    expect(crossDestRes.encPass).toBeUndefined();
    expect(crossDestRes.allowPrivate).toBe(false);
    expect(crossDestRes.gistId).toBe('legacy-gist-id');
    expect(crossDestRes.encToken).toBeUndefined();

    // Log redaction E2E: run testWebDAV with embedded-auth URL + punctuation query/hash and inspect exportLog().
    const logText = await page.evaluate(async (seed) => {
      const dbg = (window as any).__boxingDebug;
      dbg.setWebDAVConfig(
        'https://' + seed.user + ':' + seed.pass + '@webdav.invalid/dav?labels=a,b;q=(1)&tok=secret123#secHash,1;2(3)',
        seed.user,
        seed.pass,
      );
      try { await dbg.testWebDAV(); } catch (_) {}
      dbg.layout.settings.webdavUrl = '';
      return dbg.exportLog();
    }, { user: SPEC_USER, pass: SPEC_PASS });
    expect(logText).not.toContain(SPEC_PASS);
    expect(logText).not.toContain('tok=secret123');
    expect(logText).not.toContain('secHash');
    expect(logText).toContain('***:***@webdav.invalid/dav?***#***');
  });
});
