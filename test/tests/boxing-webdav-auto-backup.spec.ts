// Boxing — issue #125 (spec #120 T5): background WebDAV first-create auto backup.
//
// Covered here:
//   1. VM harness (runs on both projects, no page): the real background.js is loaded
//      into a Node sandbox with a fake chrome.* API and a CONTROLLED WebDAV service
//      that records every request and really enforces If-None-Match semantics.
//      Cases: empty remote created with If-None-Match: *; existing unknown file stops
//      with zero PUTs; a writer racing between GET and PUT gets 412 and is never
//      overwritten; GET/PUT network failures; unknown PUT outcome is not retried
//      blindly; missing host permission writes the #123 pending state and sends
//      nothing; a server that ignores the conditional header is not trusted; a
//      changed target after a saved baseline writes nothing; page PUT and background
//      create never interleave on the same file; credential envelope decryption
//      (v1/v3) matches ntp/credentials.js.
//   2. Static contracts: new i18n keys in all 14 locales, background source has no
//      permissions.request, and the built background ships the conditional header.
//   3. file:// UI lane: the Settings -> Sync cloud status line renders the pause
//      reason and stays separate from the local snapshot status.
//
// Known split: a real HTTPS server cannot be granted optional host permission from
// Playwright without a real user gesture, so the conditional-enforcement proof runs
// against the controlled in-process service above; the built manifests/permissions
// are asserted statically, matching the #123 lane split.

import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(ROOT_DIR, 'ntp', 'index.html')).href;
const DIST_CHROME = path.join(ROOT_DIR, 'dist', 'boxing-chrome');
const DIST_FIREFOX = path.join(ROOT_DIR, 'dist', 'boxing-firefox');

const WEBDAV_BASE = 'https://dav.boxing-test.invalid/dav/';
const WEBDAV_FILE_URL = WEBDAV_BASE + 'boxing-backup.json';

const NEW_I18N_KEYS = [
  'autoBackupCloudStatusOk',
  'autoBackupCloudStatusPaused',
  'autoBackupCloudStatusUnknown',
  'autoBackupCloudStatusError',
  'autoBackupCloudLastLabel',
  'autoBackupCloudReasonNeedPermission',
  'autoBackupCloudReasonRemoteExists',
  'autoBackupCloudReasonUnreachable',
  'autoBackupCloudReasonAuth',
  'autoBackupCloudReasonInvalidTarget',
  'autoBackupCloudReasonCredential',
  'autoBackupCloudReasonConflict',
  'autoBackupCloudReasonConditional',
  'autoBackupCloudReasonUnknownOutcome',
  'autoBackupCloudReasonTargetChanged',
  'autoBackupCloudReasonError',
  'autoBackupCloudRetryHint',
  'autoBackupCloudActionFix',
] as const;

const PLACEHOLDER_KEYS = ['autoBackupCloudStatusPaused', 'autoBackupCloudStatusError'] as const;

interface FakeWebdavOptions {
  existingBody?: string | null;
  getBehavior?: 'ok' | 'throw' | '401' | '500';
  putBehavior?: 'ok' | 'throw' | '401' | '409' | '428' | 'ignored';
  onPut?: (ctx: { files: Map<string, string>; req: Record<string, string> }) => Promise<void> | void;
  putGate?: { wait: Promise<void> };
}

function createFakeWebdav(opts: FakeWebdavOptions = {}) {
  const files = new Map<string, string>();
  if (opts.existingBody != null) files.set(WEBDAV_FILE_URL, opts.existingBody);
  const requests: Array<Record<string, string>> = [];

  async function fetchImpl(input: any, init: any = {}) {
    const url = typeof input === 'string' ? input : String(input && input.url);
    const headers = init.headers;
    const req: Record<string, string> = {
      method: String(init.method || 'GET').toUpperCase(),
      url,
      ifNoneMatch: headers && typeof headers.get === 'function' ? (headers.get('If-None-Match') || '') : '',
      ifMatch: headers && typeof headers.get === 'function' ? (headers.get('If-Match') || '') : '',
      authorization: headers && typeof headers.get === 'function' ? (headers.get('Authorization') || '') : '',
      body: typeof init.body === 'string' ? init.body : '',
    };
    requests.push(req);

    if (req.method === 'GET') {
      const behavior = opts.getBehavior || 'ok';
      if (behavior === 'throw') throw new TypeError('network down');
      if (behavior === '401') return new Response(null, { status: 401 });
      if (behavior === '500') return new Response(null, { status: 500 });
      if (files.has(url)) return new Response(files.get(url), { status: 200, headers: { ETag: '"v1"' } });
      return new Response(null, { status: 404 });
    }

    if (req.method === 'PUT') {
      if (opts.putGate) await opts.putGate.wait;
      const behavior = opts.putBehavior || 'ok';
      if (behavior === 'throw') throw new TypeError('network down');
      if (behavior === '401') return new Response(null, { status: 401 });
      if (behavior === '409') return new Response(null, { status: 409 });
      if (behavior === '428') return new Response(null, { status: 428 });
      if (behavior === 'ignored') {
        files.set(url, req.body);
        return new Response(null, { status: 200 });
      }
      if (opts.onPut) await opts.onPut({ files, req });
      if (req.ifNoneMatch === '*' && files.has(url)) {
        return new Response(null, { status: 412 });
      }
      files.set(url, req.body);
      return new Response(null, { status: 201, headers: { ETag: '"created-1"' } });
    }

    return new Response(null, { status: 405 });
  }

  return { files, requests, fetch: fetchImpl };
}

function seedLayout(overrides: Record<string, any> = {}) {
  return {
    version: 3.5,
    schemaVersion: 3,
    boxes: [
      {
        id: 'L1',
        type: 'large',
        title: 'Work',
        x: 10,
        y: 20,
        width: 320,
        height: 220,
        nextSmallIndex: 2,
        children: [
          {
            id: 'S1',
            type: 'small',
            title: 'Docs',
            x: 10,
            y: 10,
            width: 140,
            height: 90,
            bookmarks: [{ id: 'b1', title: 'Example', url: 'https://example.com/' }],
          },
        ],
      },
    ],
    nextLargeIndex: 2,
    connections: [],
    settings: {
      onboardingCompleted: true,
      syncProvider: 'webdav',
      webdavUrl: WEBDAV_BASE,
      webdavUser: 'alice',
      _encWebdavPass: 'secret-pass',
      autoBackupInterval: 3600,
      lastBackupAt: 0,
      syncLevel: 'full',
      syncFileName: 'boxing-backup.json',
      ...(overrides.settings || {}),
    },
    _meta: { revision: 3, updatedAt: 1700000000000, writerId: 'seed' },
    ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'settings')),
  };
}

function seedAutoBackupState(overrides: Record<string, any> = {}) {
  return {
    version: 1,
    optIn: true,
    intervalSec: 3600,
    epoch: 7,
    nextScheduledAt: 0,
    updatedAt: 1700000000000,
    local: { status: 'idle', lastAttemptAt: 0, lastSuccessAt: 0, lastSnapshotTs: 0, lastError: null },
    remote: { status: 'idle', lastAttemptAt: 0, lastSuccessAt: 0, lastErrorCode: null, baseline: null },
    lock: null,
    ...overrides,
  };
}

interface SandboxOptions {
  store?: Record<string, any>;
  webdav?: ReturnType<typeof createFakeWebdav>;
  permissionGranted?: boolean;
  permissionThrows?: boolean;
}

function createSandbox(opts: SandboxOptions = {}) {
  const store: Record<string, any> = Object.assign(
    {
      boxingLayout: seedLayout(),
      autoBackupState: seedAutoBackupState(),
    },
    opts.store || {},
  );
  const webdav = opts.webdav || createFakeWebdav();
  let onMessageHandler: ((msg: any, sender: any, sendResponse: any) => any) | null = null;
  let onAlarmHandler: ((alarm: any) => void) | null = null;
  const permissionCalls: any[] = [];
  // Ticket #129: the toolbar badge is part of the observable surface, so every
  // setBadgeText call is recorded in order.
  const badgeCalls: string[] = [];

  const chromeMock = {
    storage: {
      local: {
        get: (keys: any, cb?: (res: any) => void) => {
          const out: Record<string, any> = {};
          if (keys == null) Object.assign(out, structuredClone(store));
          else if (typeof keys === 'string') { if (keys in store) out[keys] = structuredClone(store[keys]); }
          else if (Array.isArray(keys)) { for (const k of keys) if (k in store) out[k] = structuredClone(store[k]); }
          else { for (const [k, d] of Object.entries(keys)) out[k] = k in store ? structuredClone(store[k]) : structuredClone(d); }
          if (typeof cb === 'function') { cb(out); return undefined; }
          return Promise.resolve(out);
        },
        set: (obj: Record<string, any>, cb?: () => void) => {
          for (const [k, v] of Object.entries(obj)) store[k] = structuredClone(v);
          if (typeof cb === 'function') { cb(); return undefined; }
          return Promise.resolve();
        },
        remove: (keys: string | string[], cb?: () => void) => {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
          if (typeof cb === 'function') { cb(); return undefined; }
          return Promise.resolve();
        },
      },
      sync: { get: (_k: any, cb?: (r: any) => void) => { cb && cb({}); } },
    },
    alarms: {
      get: (_n: string, cb?: (a: any) => void) => { cb && cb(null); return Promise.resolve(null); },
      create: () => Promise.resolve(),
      clear: (_n: string, cb?: (b: boolean) => void) => { cb && cb(true); return Promise.resolve(true); },
      onAlarm: { addListener: (fn: any) => { onAlarmHandler = fn; } },
    },
    action: {
      setBadgeText: (details: any) => { badgeCalls.push(details && details.text ? details.text : ''); return Promise.resolve(); },
      setBadgeBackgroundColor: () => Promise.resolve(),
    },
    permissions: {
      contains: (details: any, cb?: (granted: boolean) => void) => {
        permissionCalls.push(details);
        const granted = opts.permissionGranted !== false;
        if (opts.permissionThrows) throw new Error('permissions.contains unavailable');
        if (typeof cb === 'function') { cb(granted); return undefined; }
        return Promise.resolve(granted);
      },
    },
    runtime: {
      id: 'spec-ext-id',
      getURL: (p: string) => 'chrome-extension://spec-ext-id/' + p,
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      onMessage: { addListener: (fn: any) => { onMessageHandler = fn; } },
      lastError: null,
    },
  };

  const sandbox: any = {
    chrome: chromeMock,
    fetch: webdav.fetch,
    Headers,
    Response,
    crypto: require('crypto').webcrypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    atob: (s: string) => Buffer.from(String(s), 'base64').toString('binary'),
    btoa: (s: string) => Buffer.from(String(s), 'binary').toString('base64'),
    structuredClone,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Error, Set, Map, WeakSet, WeakMap, URL, Promise,
    importScripts: (relPath: string) => {
      const code = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
      vm.runInContext(code, sandbox, { filename: relPath });
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT_DIR, 'background.js'), 'utf8'), sandbox, { filename: 'background.js' });

  function sendMessage(msg: any): Promise<any> {
    return new Promise((resolve) => {
      const ret = onMessageHandler!(msg, { id: 'spec-ext-id', url: 'chrome-extension://spec-ext-id/ntp/index.html' }, (resp: any) => resolve(resp));
      if (ret && typeof ret.then === 'function') ret.then(resolve, () => resolve({ success: false }));
    });
  }

  return {
    store,
    webdav,
    sandbox,
    sendMessage,
    bg: sandbox.__boxingBgAutoBackup,
    get onAlarmHandler() { return onAlarmHandler; },
    permissionCalls,
    badgeCalls,
  };
}

function readRemote(env: ReturnType<typeof createSandbox>) {
  return env.sandbox.__boxingSnapshotCore.normalizeAutoBackupState(env.store.autoBackupState).remote;
}

test.describe('Ticket #125 — background WebDAV first-create auto backup (controlled service)', () => {
  test.setTimeout(90_000);

  test('empty remote is created with If-None-Match: * and bound to a trusted baseline; later cycles never rewrite it', async () => {
    const webdav = createFakeWebdav();
    const env = createSandbox({ webdav });
    const layoutBefore = JSON.stringify(env.store.boxingLayout);

    const res = await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const puts = webdav.requests.filter((r) => r.method === 'PUT');
    const gets = webdav.requests.filter((r) => r.method === 'GET');

    expect(res.ok).toBe(true);
    expect(gets).toHaveLength(1);
    expect(puts).toHaveLength(1);
    expect(puts[0].ifNoneMatch, 'the controlled service really received the create-only condition').toBe('*');
    expect(puts[0].authorization).toBe('Basic ' + Buffer.from('alice:secret-pass').toString('base64'));

    // The created body is readable JSON with only allowlisted boxing data.
    const body = JSON.parse(webdav.files.get(WEBDAV_FILE_URL)!);
    expect(Array.isArray(body.boxes)).toBe(true);
    expect(body.boxes[0].title).toBe('Work');
    expect(JSON.stringify(body)).not.toContain('secret-pass');
    expect(JSON.stringify(body)).not.toContain('alice');

    const remote = readRemote(env);
    expect(remote.status).toBe('ok');
    expect(remote.lastErrorCode).toBeNull();
    expect(remote.lastSuccessAt).toBeGreaterThan(0);
    expect(remote.baseline).toMatchObject({
      service: 'webdav',
      fileUrl: WEBDAV_FILE_URL,
      account: 'alice',
    });

    // Local snapshot happened too, and the layout was never rewritten.
    const local = env.sandbox.__boxingSnapshotCore.normalizeAutoBackupState(env.store.autoBackupState).local;
    expect(local.status).toBe('ok');
    expect(local.lastSuccessAt).toBeGreaterThan(0);
    expect(JSON.stringify(env.store.boxingLayout)).toBe(layoutBefore);

    // T5 boundary: an unchanged known target is not updated on the next cycle.
    const putCountBefore = webdav.requests.length;
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(webdav.requests.filter((r) => r.method === 'PUT')).toHaveLength(1);
    expect(webdav.requests.length).toBe(putCountBefore);
    expect(readRemote(env).status).toBe('ok');
  });

  test('an existing remote file without a trusted baseline stops with zero PUTs and keeps the file', async () => {
    const original = JSON.stringify({ version: 3.5, boxes: [{ id: 'FOREIGN', title: 'Other device' }] });
    const webdav = createFakeWebdav({ existingBody: original });
    const env = createSandbox({ webdav });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });

    expect(webdav.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
    expect(webdav.files.get(WEBDAV_FILE_URL)).toBe(original);
    const remote = readRemote(env);
    expect(remote.status).toBe('paused');
    expect(remote.lastErrorCode).toBe('remote-exists-untrusted');
    expect(remote.baseline).toBeNull();
    expect(remote.lastSuccessAt).toBe(0);
    // Cloud failure is independent from the local snapshot result.
    expect(env.sandbox.__boxingSnapshotCore.normalizeAutoBackupState(env.store.autoBackupState).local.status).toBe('ok');
  });

  test('a writer racing between GET and PUT gets 412 and is never overwritten', async () => {
    const racer = JSON.stringify({ version: 3.5, boxes: [{ id: 'RACER', title: 'Concurrent' }] });
    const webdav = createFakeWebdav({
      onPut: async ({ files, req }) => {
        if (req.ifNoneMatch === '*' && !files.has(WEBDAV_FILE_URL)) files.set(WEBDAV_FILE_URL, racer);
      },
    });
    const env = createSandbox({ webdav });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });

    const puts = webdav.requests.filter((r) => r.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].ifNoneMatch).toBe('*');
    expect(webdav.files.get(WEBDAV_FILE_URL)).toBe(racer);
    const remote = readRemote(env);
    expect(remote.status).toBe('paused');
    expect(remote.lastErrorCode).toBe('remote-exists-unknown');
    expect(remote.baseline).toBeNull();
  });

  test('GET network failure pauses without any PUT; PUT network failure records an unknown outcome that is not retried blindly', async () => {
    const getFail = createSandbox({ webdav: createFakeWebdav({ getBehavior: 'throw' }) });
    await getFail.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(getFail.webdav.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
    expect(readRemote(getFail)).toMatchObject({ status: 'error', lastErrorCode: 'remote-unreachable' });

    const putFailWebdav = createFakeWebdav({ putBehavior: 'throw' });
    const putFail = createSandbox({ webdav: putFailWebdav });
    await putFail.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const afterFail = readRemote(putFail);
    expect(afterFail.status).toBe('unknown');
    expect(afterFail.lastErrorCode).toBe('unknown-outcome');
    expect(afterFail.lastSuccessAt).toBe(0);

    // A later cycle must not send another PUT while the outcome is unknown.
    const requestCount = putFailWebdav.requests.length;
    await putFail.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(putFailWebdav.requests.length).toBe(requestCount);

    // The user explicitly re-enables: the file committed after all, so the re-check
    // finds it and stops. Nothing is overwritten either way.
    putFailWebdav.files.set(WEBDAV_FILE_URL, JSON.stringify({ version: 3.5, boxes: [] }));
    await putFail.bg.configureBackgroundAutoBackup({ optIn: true, intervalSec: 3600 });
    const afterReconfigure = readRemote(putFail);
    expect(afterReconfigure.status).toBe('paused');
    expect(afterReconfigure.lastErrorCode).toBe('remote-exists-untrusted');
    expect(putFailWebdav.requests.filter((r) => r.method === 'PUT')).toHaveLength(1);
  });

  test('missing host permission writes the #123 pending state, sends nothing, and never prompts', async () => {
    const webdav = createFakeWebdav();
    const env = createSandbox({ webdav, permissionGranted: false });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });

    expect(webdav.requests).toHaveLength(0);
    const remote = readRemote(env);
    expect(remote.status).toBe('paused');
    expect(remote.lastErrorCode).toBe('need-permission');
    expect(env.store.webdavPendingPermission).toMatchObject({
      needed: true,
      origin: 'https://dav.boxing-test.invalid/*',
      source: 'background',
      reason: 'missing-permission',
    });
    expect(Object.prototype.hasOwnProperty.call(env.sandbox.chrome.permissions, 'request')).toBe(false);
  });

  test('a server that ignores create-only semantics is not trusted (200 instead of 201 stops automatic upload)', async () => {
    const webdav = createFakeWebdav({ putBehavior: 'ignored' });
    const env = createSandbox({ webdav });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });

    const remote = readRemote(env);
    expect(remote.status).toBe('paused');
    expect(remote.lastErrorCode).toBe('conditional-unsupported');
    expect(remote.baseline).toBeNull();
    expect(remote.lastSuccessAt).toBe(0);
  });

  test('auth rejection pauses; a changed WebDAV target after a saved baseline writes nothing', async () => {
    const authEnv = createSandbox({ webdav: createFakeWebdav({ getBehavior: '401' }) });
    await authEnv.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(authEnv.webdav.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
    expect(readRemote(authEnv)).toMatchObject({ status: 'paused', lastErrorCode: 'auth-failed' });

    const changedWebdav = createFakeWebdav();
    const changedEnv = createSandbox({
      webdav: changedWebdav,
      store: {
        boxingLayout: seedLayout({ settings: { webdavUrl: 'https://dav.boxing-test.invalid/other/' } }),
        autoBackupState: seedAutoBackupState({
          remote: {
            status: 'ok',
            lastAttemptAt: 1,
            lastSuccessAt: 1,
            lastErrorCode: null,
            baseline: { service: 'webdav', fileUrl: WEBDAV_FILE_URL, account: 'alice', createdAt: 1, etag: '"v1"' },
          },
        }),
      },
    });
    await changedEnv.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(changedWebdav.requests).toHaveLength(0);
    expect(readRemote(changedEnv)).toMatchObject({ status: 'paused', lastErrorCode: 'target-changed' });
  });

  test('payload honors syncLevel and never carries credential or account fields', async () => {
    const env = createSandbox();
    const full = JSON.parse(env.bg.buildWebDAVBackupBody(seedLayout()));
    expect(full.settings.webdavUrl).toBeUndefined();
    expect(full.settings.webdavUser).toBeUndefined();
    expect(full.settings._encWebdavPass).toBeUndefined();

    const boxesOnly = JSON.parse(env.bg.buildWebDAVBackupBody(seedLayout({ settings: { syncLevel: 'boxesOnly' } })));
    expect(boxesOnly.settings).toBeNull();
    expect(boxesOnly.boxes.length).toBe(1);

    const settingsOnly = JSON.parse(env.bg.buildWebDAVBackupBody(seedLayout({ settings: { syncLevel: 'settingsOnly' } })));
    expect(settingsOnly.boxes).toEqual([]);
    expect(settingsOnly.connections).toEqual([]);
    expect(JSON.stringify(settingsOnly)).not.toContain('secret-pass');
  });

  test('an unsafe or invalid saved address pauses with zero network requests', async () => {
    const webdav = createFakeWebdav();
    const env = createSandbox({
      webdav,
      store: {
        boxingLayout: seedLayout({ settings: { webdavUrl: 'https://dav.boxing-test.invalid/dav/?token=1' } }),
      },
    });
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(webdav.requests).toHaveLength(0);
    expect(readRemote(env)).toMatchObject({ status: 'paused', lastErrorCode: 'invalid-target' });
  });

  test('a confirmed create keeps its baseline when the state epoch changes mid-flight for the same target', async () => {
    let releasePut!: () => void;
    const gate = { wait: new Promise<void>((resolve) => { releasePut = resolve; }) };
    const webdav = createFakeWebdav({ putGate: gate });
    const env = createSandbox({ webdav });

    const run = env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    await expect.poll(() => webdav.requests.some((r) => r.method === 'PUT')).toBe(true);
    // Simulate another context bumping the epoch while the PUT is in flight.
    env.store.autoBackupState = { ...env.store.autoBackupState, epoch: 99, updatedAt: Date.now() };
    releasePut();
    await run;

    const remote = readRemote(env);
    expect(remote.status).toBe('ok');
    expect(remote.baseline).toMatchObject({ service: 'webdav', fileUrl: WEBDAV_FILE_URL, account: 'alice' });
    expect(remote.lastSuccessAt).toBeGreaterThan(0);
    const settled = env.sandbox.__boxingSnapshotCore.normalizeAutoBackupState(env.store.autoBackupState);
    expect(settled.epoch).toBe(99);
    expect(settled.lock).toBeNull();
  });

  test('manual page PUT and the background create never interleave on the same file', async () => {
    let releasePut!: () => void;
    const gate = { wait: new Promise<void>((resolve) => { releasePut = resolve; }) };
    const webdav = createFakeWebdav({ putGate: gate });
    const env = createSandbox({ webdav });

    const bgRun = env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    await expect.poll(() => webdav.requests.some((r) => r.method === 'PUT')).toBe(true);

    let manualDone = false;
    const manual = env.sendMessage({
      type: 'webdav-put',
      url: WEBDAV_FILE_URL,
      user: 'alice',
      pass: 'secret-pass',
      body: JSON.stringify({ version: 3.5, boxes: [] }),
    }).then((r) => { manualDone = true; return r; });

    await new Promise((r) => setTimeout(r, 150));
    expect(manualDone, 'manual PUT must wait behind the in-flight background create').toBe(false);

    releasePut();
    await bgRun;
    const manualResp = await manual;
    expect(manualResp.success).toBe(true);
    const putOrder = webdav.requests.filter((r) => r.method === 'PUT').map((r) => r.ifNoneMatch === '*' ? 'auto-create' : 'manual-put');
    expect(putOrder).toEqual(['auto-create', 'manual-put']);
  });

  test('background credential decryption matches the v1/v3 envelopes used by ntp/credentials.js', async () => {
    const env = createSandbox();
    const plain = 'p@ssw0rd-\u4e2d\u6587';

    // v1: raw key bundled with the ciphertext.
    const v1KeyBytes = require('crypto').randomBytes(32);
    const v1Iv = require('crypto').randomBytes(12);
    const cipher1 = require('crypto').createCipheriv('aes-256-gcm', v1KeyBytes, v1Iv);
    const ct1 = Buffer.concat([cipher1.update(plain, 'utf8'), cipher1.final(), cipher1.getAuthTag()]);
    const v1Env = {
      k: v1KeyBytes.toString('base64'),
      iv: v1Iv.toString('base64'),
      d: ct1.toString('base64'),
    };
    expect(await env.bg.decryptCredential(v1Env)).toBe(plain);

    // v3: per-install key from storage.local + per-record salt.
    const pikB64 = require('crypto').randomBytes(32).toString('base64');
    env.store['boxingCredKey.v1'] = pikB64;
    const salt = require('crypto').randomBytes(16);
    const derived = require('crypto').pbkdf2Sync(Buffer.from(pikB64, 'utf8'), salt, 100000, 32, 'sha256');
    const v3Iv = require('crypto').randomBytes(12);
    const cipher3 = require('crypto').createCipheriv('aes-256-gcm', derived, v3Iv);
    const ct3 = Buffer.concat([cipher3.update(plain, 'utf8'), cipher3.final(), cipher3.getAuthTag()]);
    const v3Env = {
      v: 3,
      s: salt.toString('base64'),
      iv: v3Iv.toString('base64'),
      d: ct3.toString('base64'),
    };
    expect(await env.bg.decryptCredential(v3Env)).toBe(plain);
    expect(await env.bg.decryptCredential({ v: 3, s: 'bad', iv: 'bad', d: 'bad' })).toBe('');

    // v2 legacy bridge: two records with different per-record salts must each use
    // their own derived key (the cache is keyed by salt, not "first salt wins").
    const nodeCrypto = require('crypto');
    const legacySecret = env.sandbox.__boxingCredentialCore.CRED_OBFUSCATION_SECRET;
    const v2Envelope = (text: string) => {
      const salt = nodeCrypto.randomBytes(16);
      const derivedV2 = nodeCrypto.pbkdf2Sync(Buffer.from(legacySecret, 'utf8'), salt, 100000, 32, 'sha256');
      const iv = nodeCrypto.randomBytes(12);
      const cipher = nodeCrypto.createCipheriv('aes-256-gcm', derivedV2, iv);
      const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()]);
      return { v: 2, s: salt.toString('base64'), iv: iv.toString('base64'), d: ct.toString('base64') };
    };
    expect(await env.bg.decryptCredential(v2Envelope('first-v2'))).toBe('first-v2');
    expect(await env.bg.decryptCredential(v2Envelope('second-v2'))).toBe('second-v2');
  });
});

test.describe('Ticket #125 — static contracts', () => {
  test('17 cloud-status keys exist in all 14 locales with aligned placeholders', async () => {
    const locales = fs.readdirSync(path.join(ROOT_DIR, '_locales'));
    expect(locales.length).toBe(14);
    const en = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, '_locales', 'en', 'messages.json'), 'utf8'));
    for (const key of NEW_I18N_KEYS) {
      expect(en[key], `en missing ${key}`).toBeDefined();
    }
    for (const locale of locales) {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, '_locales', locale, 'messages.json'), 'utf8'));
      for (const key of NEW_I18N_KEYS) {
        expect(data[key], `${locale} missing ${key}`).toBeDefined();
      }
      for (const key of PLACEHOLDER_KEYS) {
        expect(data[key].placeholders?.reason?.content, `${locale} ${key} placeholder`).toBe('$1');
      }
    }
  });

  test('background source never requests host permission and the built worker carries the create-only header', async () => {
    const bgSrc = fs.readFileSync(path.join(ROOT_DIR, 'background.js'), 'utf8');
    const pageSrc = fs.readFileSync(path.join(ROOT_DIR, 'ntp', 'index.html'), 'utf8');
    expect(bgSrc).not.toMatch(/permissions\.request/);
    expect(bgSrc).toContain("'If-None-Match': '*'");
    expect(bgSrc).not.toContain('notifications');
    // One credential-envelope implementation shared by page and worker.
    expect(bgSrc).toContain("importScripts('shared/credential-core.js')");
    expect(pageSrc).toContain('src="../shared/credential-core.js"');

    for (const dist of [DIST_CHROME, DIST_FIREFOX]) {
      const builtPath = path.join(dist, 'background.js');
      test.skip(!fs.existsSync(builtPath), `${dist} not built - run npm run build first`);
      const built = fs.readFileSync(builtPath, 'utf8');
      expect(built).toContain("'If-None-Match': '*'");
      expect(built).not.toMatch(/permissions\.request/);
      expect(fs.existsSync(path.join(dist, 'shared', 'credential-core.js')), `${dist} ships shared/credential-core.js`).toBe(true);
    }
  });
});

test.describe('Ticket #125 — Settings cloud status line (file:// lane)', () => {
  async function bootWithState(page: Page, state: Record<string, any>) {
    await page.addInitScript((seed) => {
      localStorage.setItem('boxingLayout', JSON.stringify(seed.layout));
      localStorage.setItem('bxstore:autoBackupState', JSON.stringify(seed.autoState));
    }, {
      layout: seedLayout({ settings: { onboardingCompleted: true, syncProvider: 'webdav' } }),
      autoState: state,
    });
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    await dismissOnboarding(page);
    await page.evaluate(() => document.getElementById('settings-btn')?.click());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.evaluate(() => {
      (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click();
    });
    await expect(page.locator('#tab-sync')).toBeVisible();
  }

  test('background fileUrl derivation matches the page resolver for the same inputs', async ({ page }) => {
    await bootWithState(page, seedAutoBackupState());
    const cases = [
      { base: 'https://dav.example.test/dav', name: '' },
      { base: 'https://dav.example.test/dav/', name: 'my backup.json' },
      { base: 'https://dav.example.test/dav/custom.json', name: '' },
      { base: 'https://dav.example.test/dav/', name: 'nested/name.json' },
      { base: 'https://dav.example.test/dav/', name: '备份.json' },
    ];
    const env = createSandbox();
    for (const c of cases) {
      const pageUrl = await page.evaluate(({ base, name }) => {
        const dbg = (window as any).__boxingDebug;
        dbg.layout.settings.syncFileName = name;
        return (window as any).__bxSync.resolveWebDAVFileUrl(base).fileUrl;
      }, c);
      const bgRes = env.bg.resolveWebDAVFileUrl({ webdavUrl: c.base, syncFileName: c.name });
      expect(bgRes.fileUrl, `background derivation for ${c.base} / ${c.name}`).toBe(pageUrl);
    }
  });

  test('paused cloud state renders its own reason line next to, not instead of, the local status', async ({ page }) => {
    await bootWithState(page, seedAutoBackupState({
      local: { status: 'ok', lastAttemptAt: 5, lastSuccessAt: 5, lastSnapshotTs: 5, lastError: null },
      remote: { status: 'paused', lastAttemptAt: 6, lastSuccessAt: 0, lastErrorCode: 'remote-exists-untrusted', baseline: null },
    }));
    const line = page.locator('#auto-backup-remote-status');
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute('data-state', 'paused');
    await expect(line).toContainText(/already exists|not verified|存在/i);
    await expect(page.locator('#local-auto-backup-status-text')).toHaveAttribute('data-state', 'active');
  });

  test('unknown outcome and off states render correctly', async ({ page }) => {
    await bootWithState(page, seedAutoBackupState({
      remote: { status: 'unknown', lastAttemptAt: 6, lastSuccessAt: 0, lastErrorCode: 'unknown-outcome', baseline: null },
    }));
    const line = page.locator('#auto-backup-remote-status');
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute('data-state', 'unknown');
    await expect(line).toContainText(/unknown|未知/i);

    // A confirmed cloud success shows its own timestamp label.
    await page.evaluate(() => {
      (window as any).__boxingRefreshLocalAutoBackupUi({
        version: 1,
        optIn: true,
        intervalSec: 3600,
        epoch: 8,
        nextScheduledAt: 0,
        updatedAt: 1,
        local: { status: 'ok', lastAttemptAt: 1, lastSuccessAt: 1, lastSnapshotTs: 1, lastError: null },
        remote: { status: 'ok', lastAttemptAt: 2, lastSuccessAt: 2, lastErrorCode: null, baseline: null },
        lock: null,
      });
    });
    await expect(line).toHaveAttribute('data-state', 'ok');
    await expect(line).toContainText(/cloud|云端|雲端/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ticket #129 (#120 T9): a failed cloud upload keeps the local history, both
// success times stay separate, and the user can see and clear the real state.
// ─────────────────────────────────────────────────────────────────────────────

function stateOf(env: ReturnType<typeof createSandbox>) {
  return env.sandbox.__boxingSnapshotCore.normalizeAutoBackupState(env.store.autoBackupState);
}

function snapKeys(env: ReturnType<typeof createSandbox>) {
  return Object.keys(env.store).filter((k) => k.startsWith('snap.v1.') && k !== 'snap.v1.index');
}

test.describe('Ticket #129 — cloud failure, snapshot history, and pending state (VM)', () => {
  test.setTimeout(90_000);

  test('a rejected upload leaves a real local snapshot, keeps the cloud failure, and shows the badge', async () => {
    const env = createSandbox({ webdav: createFakeWebdav({ getBehavior: '401' }) });

    const res = await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = stateOf(env);

    // Local lane succeeded on its own.
    expect(res.ok).toBe(true);
    expect(state.local.status).toBe('ok');
    expect(state.local.lastSuccessAt).toBeGreaterThan(0);
    expect(state.local.lastSnapshotTs).toBe(state.local.lastSuccessAt);
    expect(snapKeys(env).length).toBe(1);

    // Cloud lane failed and was never rewritten as a success.
    expect(state.remote.status).toBe('paused');
    expect(state.remote.lastErrorCode).toBe('auth-failed');
    expect(state.remote.lastSuccessAt).toBe(0);
    expect(env.badgeCalls[env.badgeCalls.length - 1]).toBe('!');
  });

  test('an oversize snapshot keeps the previous local success and never clears the cloud failure', async () => {
    const env = createSandbox({ webdav: createFakeWebdav({ getBehavior: '401' }) });
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const first = stateOf(env);
    expect(first.local.status).toBe('ok');
    const localSuccessAt = first.local.lastSuccessAt;

    // Second cycle with a layout that exceeds the 2 MiB single-snapshot cap.
    const huge = seedLayout();
    huge.boxes[0].children[0].bookmarks[0].title = 'x'.repeat(2 * 1024 * 1024 + 1024);
    env.store.boxingLayout = huge;
    const prevState = env.store.autoBackupState;
    prevState.nextScheduledAt = 0;

    const res = await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = stateOf(env);

    expect(res.ok).toBe(false);
    expect(state.local.status).toBe('error');
    // A failed snapshot is not a new local success.
    expect(state.local.lastSuccessAt).toBe(localSuccessAt);
    expect(state.local.lastSnapshotTs).toBe(first.local.lastSnapshotTs);
    // The cloud failure survives the local failure.
    expect(state.remote.lastErrorCode).toBe('auth-failed');
    expect(state.remote.lastSuccessAt).toBe(0);
    expect(env.badgeCalls[env.badgeCalls.length - 1]).toBe('!');
  });

  test('a paused cloud state survives a background restart and restores the badge on reconcile', async () => {
    const paused = seedAutoBackupState({
      remote: {
        provider: 'webdav',
        status: 'paused',
        lastAttemptAt: 11,
        lastSuccessAt: 0,
        lastErrorCode: 'remote-exists-untrusted',
        baseline: null,
      },
    });
    const env = createSandbox({ store: { autoBackupState: paused }, webdav: createFakeWebdav() });

    // A fresh worker reads the same store: the pause and its code are still there.
    expect(readRemote(env)).toMatchObject({
      status: 'paused',
      lastErrorCode: 'remote-exists-untrusted',
    });

    await env.bg.reconcileAutoBackupSchedule({ runCatchup: false });
    expect(env.badgeCalls[env.badgeCalls.length - 1], 'pending cloud problem re-lights the badge after restart').toBe('!');

    // Resolving it clears the badge on the next reconcile.
    const okState = seedAutoBackupState({ remote: { status: 'ok', lastSuccessAt: 12, lastErrorCode: null, baseline: null } });
    env.store.autoBackupState = okState;
    await env.bg.reconcileAutoBackupSchedule({ runCatchup: false });
    expect(env.badgeCalls[env.badgeCalls.length - 1]).toBe('');
  });

  test('a changed target pauses, keeps the old baseline, and never rewrites the provider', async () => {
    const env = createSandbox({
      store: {
        autoBackupState: seedAutoBackupState({
          remote: {
            provider: 'webdav',
            status: 'ok',
            lastSuccessAt: 1700000000000,
            lastErrorCode: null,
            baseline: { service: 'webdav', fileUrl: WEBDAV_FILE_URL, account: 'alice', createdAt: 1, etag: '"v1"' },
          },
        }),
      },
      webdav: createFakeWebdav(),
    });
    env.store.boxingLayout.settings.webdavUrl = WEBDAV_BASE + 'other/';

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const remote = readRemote(env);

    expect(remote.status).toBe('paused');
    expect(remote.lastErrorCode).toBe('target-changed');
    expect(remote.baseline && remote.baseline.fileUrl).toBe(WEBDAV_FILE_URL);
    expect(env.store.boxingLayout.settings.syncProvider).toBe('webdav');
    expect(env.webdav.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
  });

  test('a WebDAV pause never inherits a Gist success timestamp', async () => {
    const env = createSandbox({
      store: {
        autoBackupState: seedAutoBackupState({
          remote: {
            provider: 'gist',
            status: 'ok',
            lastSuccessAt: 1700000000000,
            lastErrorCode: null,
            baseline: { service: 'gist', gistId: 'abcdef', fileName: 'boxing-backup.json', ownerLogin: 'alice', ownerId: '1' },
          },
        }),
      },
      webdav: createFakeWebdav({ getBehavior: '401' }),
    });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const remote = readRemote(env);

    expect(remote.provider).toBe('webdav');
    expect(remote.lastErrorCode).toBe('auth-failed');
    expect(remote.lastSuccessAt, 'the Gist success time does not belong to this target').toBe(0);
    expect(env.store.boxingLayout.settings.syncProvider).toBe('webdav');
  });

  test('a Gist baseline is not mistaken for a WebDAV file, so the file is re-checked and created', async () => {
    const env = createSandbox({
      store: {
        autoBackupState: seedAutoBackupState({
          remote: {
            provider: 'gist',
            status: 'ok',
            lastSuccessAt: 1700000000000,
            lastErrorCode: null,
            baseline: { service: 'gist', gistId: 'abcdef', fileName: 'boxing-backup.json', ownerLogin: 'alice', ownerId: '1' },
          },
        }),
      },
    });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const remote = readRemote(env);

    expect(remote.provider).toBe('webdav');
    expect(remote.status).toBe('ok');
    expect(remote.lastErrorCode).toBeNull();
    expect(remote.lastSuccessAt).toBeGreaterThan(1700000000000);
    expect(remote.baseline && remote.baseline.service).toBe('webdav');
    expect(env.webdav.requests.filter((r) => r.method === 'PUT')).toHaveLength(1);
  });
});

test.describe('Ticket #129 — cloud status line, manual entry, and its own success time (file:// lane)', () => {
  async function bootCloudState(page: Page, opts: { provider?: string; lastBackupAt?: number; autoState: Record<string, any> }) {
    await page.addInitScript((seed) => {
      localStorage.setItem('boxingLayout', JSON.stringify(seed.layout));
      localStorage.setItem('bxstore:autoBackupState', JSON.stringify(seed.autoState));
    }, {
      layout: seedLayout({
        settings: {
          onboardingCompleted: true,
          syncProvider: opts.provider || 'webdav',
          webdavUrl: WEBDAV_BASE,
          webdavUser: 'alice',
          lastBackupAt: opts.lastBackupAt || 0,
        },
      }),
      autoState: opts.autoState,
    });
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    await dismissOnboarding(page);
    await page.evaluate(() => document.getElementById('settings-btn')?.click());
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.evaluate(() => {
      (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click();
    });
    await expect(page.locator('#tab-sync')).toBeVisible();
  }

  test('a paused cloud line shows its reason, its own last success time, and a manual entry', async ({ page }) => {
    await bootCloudState(page, {
      autoState: seedAutoBackupState({
        local: { status: 'ok', lastAttemptAt: 5, lastSuccessAt: 1800000000000, lastSnapshotTs: 1800000000000, lastError: null },
        remote: {
          provider: 'webdav',
          status: 'paused',
          lastAttemptAt: 6,
          lastSuccessAt: 1700000000000,
          lastErrorCode: 'auth-failed',
          baseline: null,
        },
      }),
    });

    const line = page.locator('#auto-backup-remote-status');
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute('data-state', 'paused');
    await expect(line).toContainText(/rejected|password|密碼|密码/i);
    await expect(line).toContainText(/Last cloud backup|上次云端备份|上次雲端備份/i);

    // The remote-zone timestamp is the cloud one, never the newer local snapshot.
    const shown = await page.evaluate(() => ({
      remoteZone: document.getElementById('last-backup-time-value')?.textContent || '',
      expected: new Date(1700000000000).toLocaleString(),
      localOnly: new Date(1800000000000).toLocaleString(),
    }));
    expect(shown.remoteZone).toBe(shown.expected);
    expect(shown.remoteZone).not.toBe(shown.localOnly);

    // A rejected password is fixed at the stored-credential field.
    const action = page.locator('#auto-backup-remote-action');
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('data-action', 'credentials');
    await action.click();
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('webdav-pass');
  });

  test('a changed target does not pass an old timestamp off as the new target success', async ({ page }) => {
    await bootCloudState(page, {
      lastBackupAt: 1700000000000,
      autoState: seedAutoBackupState({
        remote: {
          provider: 'webdav',
          status: 'paused',
          lastAttemptAt: 6,
          lastSuccessAt: 1700000000000,
          lastErrorCode: 'target-changed',
          baseline: null,
        },
      }),
    });

    const shown = await page.evaluate(() => ({
      remoteZone: document.getElementById('last-backup-time-value')?.textContent || '',
      never: document.getElementById('local-auto-backup-last-at')?.textContent || '',
      line: document.getElementById('auto-backup-remote-status')?.textContent || '',
    }));
    // Same "never" copy as the untouched local line, and no stale cloud timestamp.
    expect(shown.remoteZone).toBe(shown.never);
    expect(shown.line).not.toContain('2023');
  });

  test('switching provider keeps the old record but does not lend its time or action to the new target', async ({ page }) => {
    await bootCloudState(page, {
      provider: 'gist',
      autoState: seedAutoBackupState({
        remote: {
          provider: 'webdav',
          status: 'paused',
          lastAttemptAt: 6,
          lastSuccessAt: 1700000000000,
          lastErrorCode: 'auth-failed',
          baseline: null,
        },
      }),
    });

    const line = page.locator('#auto-backup-remote-status');
    await expect(line).toBeVisible();
    await expect(line).not.toContainText(/Last cloud backup|上次云端备份|上次雲端備份/i);
    await expect(page.locator('#auto-backup-remote-action')).toBeHidden();
  });

  test('switching to Local keeps the failed cloud line visible but offers no action and sends nothing', async ({ page }) => {
    const requests: string[] = [];
    const downloads: number[] = [];
    page.on('request', (r) => { if (/^https?:/i.test(r.url())) requests.push(r.url()); });
    page.on('download', () => { downloads.push(1); });

    await bootCloudState(page, {
      provider: 'local',
      autoState: seedAutoBackupState({
        remote: {
          provider: 'webdav',
          status: 'paused',
          lastAttemptAt: 6,
          lastSuccessAt: 0,
          lastErrorCode: 'remote-exists-untrusted',
          baseline: null,
        },
      }),
    });

    const line = page.locator('#auto-backup-remote-status');
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute('data-state', 'paused');
    await expect(page.locator('#auto-backup-remote-action')).toBeHidden();
    await expect(page.locator('#remote-backup-zone')).toBeHidden();
    expect(requests).toEqual([]);
    expect(downloads).toEqual([]);
    expect(await page.evaluate(() => (window as any).__boxingDebug.layout.settings.syncProvider)).toBe('local');
  });

  test('a failed manual upload still leaves a Time Machine snapshot and keeps lastBackupAt untouched', async ({ page }) => {
    await page.route('https://dav.boxing-test.invalid/**', (route) => route.fulfill({ status: 401, body: '' }));
    await page.addInitScript((seed) => {
      localStorage.setItem('boxingLayout', JSON.stringify(seed));
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, cb: (resp: any) => void) => {
            (window as any).__bgMsgs = ((window as any).__bgMsgs || []).concat(msg && msg.type);
            cb({ success: false, error: 'Unauthorized' });
          },
          getURL: (p: string) => p,
          lastError: null,
        },
      };
    }, seedLayout({
      settings: { onboardingCompleted: true, syncProvider: 'webdav', webdavUrl: WEBDAV_BASE, webdavUser: 'alice', lastBackupAt: 1700000000000 },
    }));

    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug))).toBe(true);
    await dismissOnboarding(page);

    const out = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const before = (await dbg.listSnapshots()).length;
      let err: string | null = null;
      try {
        await (window as any).__bxSync.performBackup({ userInitiated: true, source: 'manual' });
      } catch (e: any) {
        err = String((e && e.message) || e);
      }
      return {
        before,
        after: (await dbg.listSnapshots()).length,
        lastBackupAt: dbg.layout.settings.lastBackupAt,
        err,
      };
    });

    expect(out.err, 'the failure is still reported to the Sync Now button').toBeTruthy();
    expect(out.after, 'a failed upload still leaves one recoverable snapshot').toBe(out.before + 1);
    expect(out.lastBackupAt, 'a failed upload is not a remote success').toBe(1700000000000);
  });

  test('the new manual-entry label exists in all 14 locales', () => {
    const key = 'autoBackupCloudActionFix';
    const locales = fs.readdirSync(path.join(ROOT_DIR, '_locales'));
    expect(locales.length).toBe(14);
    const en = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, '_locales', 'en', 'messages.json'), 'utf8'));
    expect(en[key]?.message).toBeTruthy();
    for (const loc of locales) {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, '_locales', loc, 'messages.json'), 'utf8'));
      expect(data[key]?.message, `${loc} is missing ${key}`).toBeTruthy();
      if (loc !== 'en') {
        expect(data[key].message, `${loc} must translate ${key}`).not.toBe(en[key].message);
      }
    }
  });
});
