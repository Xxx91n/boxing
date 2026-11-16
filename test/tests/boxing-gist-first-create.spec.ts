// Boxing — tickets #126 / #128 (#120 T7/T8): Gist auto-backup first create,
// existing-target safe pause, and the single background write queue.
//
// Coverage split:
//   1. Shared protocol core: first-create and manual-write planning, parsing.
//   2. Background VM lane: the real background.js classic-SW path, with controlled
//      Gist API responses, real v3 credential envelopes, and a real snapshot write.
//      Covers confirmed creation, existing-target pause, account change, missing
//      permission, lost POST response, repeated-run dedup, manual PATCH, two
//      concurrent manual clicks, and the no-PATCH guarantee for existing Gists.
//   3. file:// NTP lane: paused/pending status badge + localized reason + Gist id
//      mirroring into the normal settings field.
//   4. Real built Chrome extension lane: the shipped optional-host-permission build
//      must pause with zero network and persist pending permission; a test build with
//      the host permission pre-granted must create exactly one Gist through the real
//      service worker, with a sanitized body and no token in logs/snapshots.

import { expect, test, chromium, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'url';
import { dismissOnboarding } from '../helpers/onboarding';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.join(ROOT_DIR, 'ntp', 'index.html')).href;
const DIST_CHROME = path.join(ROOT_DIR, 'dist', 'boxing-chrome');
const DIST_FIREFOX = path.join(ROOT_DIR, 'dist', 'boxing-firefox');

const TOKEN = 'ghp_spec_token_126_secret';
const PIK = 'c3BlYy1wZXItaW5zdGFsbC1rZXktMjAyNi0xMS0xNi0wMDAwMDAwMDAwMDA=';
const GIST_FILE = 'boxing-backup.json';

function b64(u8: Uint8Array): string {
  return Buffer.from(u8).toString('base64');
}

async function encryptV3(plaintext: string, pikB64: string): Promise<any> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pikB64), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { v: 3, s: b64(salt), iv: b64(iv), d: b64(new Uint8Array(ct)) };
}

function loadUmd(rel: string, extra: Record<string, any> = {}): any {
  const sandbox: any = {
    module: { exports: {} },
    exports: {},
    console,
    crypto,
    atob,
    btoa,
    TextEncoder,
    TextDecoder,
    ...extra,
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8'), sandbox, { filename: rel });
  return sandbox.module.exports;
}

function seedLayout(envelope: any, overrides: Record<string, any> = {}) {
  return {
    version: 3.5,
    schemaVersion: 3,
    nextLargeIndex: 2,
    boxes: [
      {
        id: 'L1',
        type: 'large',
        title: 'Alpha',
        x: 0,
        y: 0,
        width: 320,
        height: 220,
        nextSmallIndex: 1,
        children: [
          {
            id: 'S1',
            type: 'small',
            title: 'Links',
            x: 10,
            y: 10,
            width: 140,
            height: 90,
            bookmarks: [{ id: 'b1', title: 'Example', url: 'https://example.com/' }],
          },
        ],
      },
    ],
    connections: [],
    settings: {
      selectedLanguage: 'en',
      onboardingCompleted: true,
      syncProvider: 'gist',
      syncFileName: GIST_FILE,
      syncLevel: 'full',
      autoBackupInterval: 3600,
      _encGistToken: envelope,
      ...overrides,
    },
    _meta: { revision: 5, updatedAt: 1_700_000_000_000, writerId: 'seed' },
  };
}

function activeState(remote?: any) {
  return {
    version: 1,
    optIn: true,
    intervalSec: 3600,
    epoch: 1,
    nextScheduledAt: 0,
    updatedAt: 0,
    local: {
      status: 'idle',
      lastAttemptAt: 0,
      lastSuccessAt: 0,
      lastSnapshotTs: 0,
      lastError: null,
    },
    remote: remote || undefined,
    lock: null,
  };
}

function jsonResponse(status: number, body: any): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiUser(id = 42, login = 'spec-user') {
  return jsonResponse(200, { login, id });
}

function isGistListCall(call: BgCall) {
  return call.method === 'GET' && call.url.includes('/gists?');
}

function gistCreated(id = 'abc12345', fileName = GIST_FILE) {
  return jsonResponse(201, {
    id,
    files: { [fileName]: { filename: fileName, size: 123 } },
    owner: { login: 'spec-user', id: 42 },
    created_at: '2026-11-16T00:00:00Z',
    updated_at: '2026-11-16T00:00:00Z',
  });
}

interface BgCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

function clone<T>(v: T): T {
  if (v === undefined) return v;
  return JSON.parse(JSON.stringify(v));
}

async function makeBgSandbox(opts: {
  store: Record<string, any>;
  grantPermission?: boolean;
  containsThrows?: boolean;
  fetchImpl: (call: BgCall) => Response | Promise<Response>;
}) {
  const store = opts.store;
  const calls: BgCall[] = [];
  const permissionRequests: any[] = [];
  let badgeText = '';
  let onAlarmHandler: any = null;
  let onInstalledHandler: any = null;
  let onStartupHandler: any = null;

  const chromeMock = {
    storage: {
      local: {
        get(keys: any, cb?: (res: any) => void) {
          const out: Record<string, any> = {};
          if (keys == null) {
            for (const [k, v] of Object.entries(store)) out[k] = clone(v);
          } else if (typeof keys === 'string') {
            if (keys in store) out[keys] = clone(store[keys]);
          } else if (Array.isArray(keys)) {
            for (const k of keys) if (k in store) out[k] = clone(store[k]);
          } else {
            for (const [k, d] of Object.entries(keys)) out[k] = k in store ? clone(store[k]) : d;
          }
          if (typeof cb === 'function') { cb(out); return undefined; }
          return Promise.resolve(out);
        },
        set(obj: Record<string, any>, cb?: () => void) {
          if (store.__failAutoBackupStateWrite && Object.prototype.hasOwnProperty.call(obj, 'autoBackupState')) {
            store.__failAutoBackupStateWrite = false;
            const err = new Error('simulated autoBackupState write failure');
            if (typeof cb === 'function') {
              (chromeMock.runtime as any).lastError = { message: err.message };
              cb();
              (chromeMock.runtime as any).lastError = null;
              return undefined;
            }
            return Promise.reject(err);
          }
          for (const [k, v] of Object.entries(obj)) store[k] = clone(v);
          if (typeof cb === 'function') { cb(); return undefined; }
          return Promise.resolve();
        },
        remove(keys: string | string[], cb?: () => void) {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
          if (typeof cb === 'function') { cb(); return undefined; }
          return Promise.resolve();
        },
      },
      sync: { get: (_k: any, cb?: (r: any) => void) => { if (cb) cb({}); } },
    },
    alarms: {
      get: (_n: string, cb?: (a: any) => void) => { if (cb) cb(null); return Promise.resolve(null); },
      create: (_n: string, _info: any, cb?: () => void) => { if (cb) cb(); return Promise.resolve(); },
      clear: (_n: string, cb?: (b: boolean) => void) => { if (cb) cb(true); return Promise.resolve(true); },
      onAlarm: { addListener: (fn: any) => { onAlarmHandler = fn; } },
    },
    action: {
      setBadgeText: (info: any) => { badgeText = info && info.text ? info.text : ''; return Promise.resolve(); },
      setBadgeBackgroundColor: () => Promise.resolve(),
      onClicked: { addListener: () => {} },
    },
    runtime: {
      id: 'spec-ext-id',
      getURL: (p: string) => 'chrome-extension://spec-ext-id/' + p,
      onInstalled: { addListener: (fn: any) => { onInstalledHandler = fn; } },
      onStartup: { addListener: (fn: any) => { onStartupHandler = fn; } },
      onMessage: { addListener: () => {} },
      lastError: null,
    },
    permissions: {
      contains: (_details: any, cb?: (granted: boolean) => void) => {
        if (opts.containsThrows) {
          if (cb) {
            (chromeMock.runtime as any).lastError = { message: 'contains failed' };
            cb(false);
            (chromeMock.runtime as any).lastError = null;
            return undefined;
          }
          return Promise.reject(new Error('contains failed'));
        }
        const granted = opts.grantPermission !== false;
        if (cb) { cb(granted); return undefined; }
        return Promise.resolve(granted);
      },
      request: (details: any, cb?: (granted: boolean) => void) => {
        permissionRequests.push(details);
        if (cb) { cb(false); return undefined; }
        return Promise.resolve(false);
      },
    },
  };

  const fetchMock = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const headers: Record<string, string> = {};
    if (init && init.headers) {
      if (typeof init.headers.entries === 'function') {
        for (const [k, v] of init.headers.entries()) headers[k] = String(v);
      } else {
        for (const [k, v] of Object.entries(init.headers)) headers[k] = String(v);
      }
    }
    const call: BgCall = {
      url: String(url),
      method: (init && init.method) || 'GET',
      headers,
      body: init && typeof init.body === 'string' ? init.body : null,
    };
    calls.push(call);
    return opts.fetchImpl(call);
  };

  const sandbox: any = {
    chrome: chromeMock,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Error, Set, Map,
    WeakSet, WeakMap, URL, Promise, structuredClone,
    setTimeout, clearTimeout, atob, btoa, TextEncoder, TextDecoder,
    Headers, Response, Request, AbortController, crypto,
    fetch: fetchMock,
    importScripts: (relPath: string) => {
      const code = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
      vm.runInContext(code, sandbox, { filename: relPath });
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT_DIR, 'background.js'), 'utf8'), sandbox, { filename: 'background.js' });

  return {
    bg: sandbox.__boxingBgAutoBackup,
    store,
    calls,
    permissionRequests,
    getBadge: () => badgeText,
    failNextAutoBackupStateWrite: () => { store.__failAutoBackupStateWrite = true; },
    onAlarmHandler,
    onInstalledHandler,
    onStartupHandler,
  };
}

test.describe('Ticket #126 — Gist first-create protocol core', () => {
  test('first-create plan: create / existing / account change / pending / target change', () => {
    const gistCore = loadUmd('shared/gist-backup-core.js');
    const settings = { syncProvider: 'gist', syncFileName: GIST_FILE };
    const cloud = { account: { login: 'a', id: 1 }, baseline: null, pendingCreate: null };
    const base = { settings, cloud, account: { login: 'a', id: 1 }, tokenPresent: true, permission: { ok: true } };

    expect(gistCore.planGistFirstCreate(base)).toEqual({ action: 'create', fileName: GIST_FILE });
    expect(gistCore.planGistFirstCreate({ ...base, settings: { ...settings, gistId: 'deadbeef' } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistTargetNeedsReview' });
    // A non-empty but unparseable saved id is untrusted, not "no target".
    expect(gistCore.planGistFirstCreate({ ...base, settings: { ...settings, gistId: 'https://gist.github.com/x' } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistTargetNeedsReview' });
    expect(gistCore.planGistFirstCreate({ ...base, account: { login: 'b', id: 2 } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistAccountChanged' });
    expect(gistCore.planGistFirstCreate({ ...base, cloud: { ...cloud, pendingCreate: { provider: 'gist', fileName: GIST_FILE } } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistResultUnknown' });

    const baseline = {
      provider: 'gist', gistId: 'abc12345', fileName: GIST_FILE, ownerLogin: 'a', ownerId: 1,
    };
    expect(gistCore.planGistFirstCreate({ ...base, cloud: { ...cloud, baseline } }))
      .toMatchObject({ action: 'update-not-enabled', reasonCode: 'gistUpdateNotEnabled' });
    expect(gistCore.planGistFirstCreate({ ...base, settings: { ...settings, gistId: 'abc12345' }, cloud: { ...cloud, baseline } }))
      .toMatchObject({ action: 'update-not-enabled', reasonCode: 'gistUpdateNotEnabled' });
    expect(gistCore.planGistFirstCreate({ ...base, settings: { ...settings, syncFileName: 'other.json' }, cloud: { ...cloud, baseline } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistTargetNeedsReview' });
    expect(gistCore.planGistFirstCreate({ ...base, tokenPresent: false }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistTokenMissing' });
    expect(gistCore.planGistFirstCreate({ ...base, permission: { ok: false } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistPermissionMissing' });
  });

  test('manual Gist plan: post / patch / blocked target / pending / size', () => {
    const gistCore = loadUmd('shared/gist-backup-core.js');
    const settings = { syncProvider: 'gist', syncFileName: GIST_FILE };
    const cloud = { pendingCreate: null, baseline: null };
    const base = { settings, cloud, tokenPresent: true, permission: { ok: true } };

    expect(gistCore.planManualGistWrite(base)).toEqual({ action: 'post', fileName: GIST_FILE });
    expect(gistCore.planManualGistWrite({ ...base, gistId: 'abc12345' }))
      .toEqual({ action: 'patch', gistId: 'abc12345', fileName: GIST_FILE });
    expect(gistCore.planManualGistWrite({ ...base, gistId: 'https://gist.github.com/x' }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistTargetNeedsReview' });
    expect(gistCore.planManualGistWrite({ ...base, cloud: { ...cloud, pendingCreate: { provider: 'gist', fileName: GIST_FILE } } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistResultUnknown' });
    // A pending POST that knows its Gist id can be confirmed with a GET instead of
    // staying locked forever.
    expect(gistCore.planManualGistWrite({
      ...base,
      cloud: { ...cloud, pendingCreate: { provider: 'gist', fileName: GIST_FILE, gistId: 'abc12345' } },
    })).toEqual({ action: 'confirm-pending', gistId: 'abc12345', fileName: GIST_FILE });
    // A queued request that names another Gist must not PATCH the pending one.
    expect(gistCore.planManualGistWrite({
      ...base,
      gistId: 'deadbeef',
      cloud: { ...cloud, pendingCreate: { provider: 'gist', fileName: GIST_FILE, gistId: 'abc12345' } },
    })).toMatchObject({ action: 'pause', reasonCode: 'gistPendingTargetChanged' });
    expect(gistCore.planManualGistWrite({ ...base, tokenPresent: false }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistTokenMissing' });
    expect(gistCore.planManualGistWrite({ ...base, permission: { ok: false } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistPermissionMissing' });
    expect(gistCore.planManualGistWrite({ ...base, payloadTooLarge: true }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistPayloadTooLarge' });

    const baseline = { provider: 'gist', gistId: 'abcdef12', fileName: GIST_FILE, ownerLogin: 'a', ownerId: 1 };
    // A second click that arrives after the first create must PATCH the new Gist,
    // never POST a duplicate.
    expect(gistCore.planManualGistWrite({ ...base, cloud: { ...cloud, baseline } }))
      .toEqual({ action: 'patch', gistId: 'abcdef12', fileName: GIST_FILE });
    // A manual write must not silently move the known target or append a second
    // file with a different name.
    expect(gistCore.planManualGistWrite({ ...base, gistId: 'deadbeef', cloud: { ...cloud, baseline } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistTargetNeedsReview' });
    expect(gistCore.planManualGistWrite({ ...base, fileName: 'other.json', cloud: { ...cloud, baseline } }))
      .toMatchObject({ action: 'pause', reasonCode: 'gistTargetNeedsReview' });
    expect(gistCore.buildGistUpdateBody(GIST_FILE, '{"a":1}'))
      .toEqual({ files: { [GIST_FILE]: { content: '{"a":1}' } } });
  });

  test('Gist response parsing only accepts an id plus the expected file', () => {
    const gistCore = loadUmd('shared/gist-backup-core.js');
    const good = gistCore.parseGistResponse({
      id: 'ABCDEF12',
      files: { [GIST_FILE]: { size: 12 } },
      owner: { login: 'spec-user', id: 42 },
      created_at: '2026-11-16T00:00:00Z',
      updated_at: '2026-11-16T01:00:00Z',
    }, GIST_FILE);
    expect(good).toMatchObject({
      gistId: 'abcdef12',
      fileName: GIST_FILE,
      ownerLogin: 'spec-user',
      ownerId: 42,
      fileSize: 12,
    });
    expect(gistCore.parseGistResponse({ id: 'abcdef12' }, GIST_FILE)).toBeNull();
    expect(gistCore.parseGistResponse({ id: 'not-a-gist', files: { [GIST_FILE]: {} } }, GIST_FILE)).toBeNull();
    expect(gistCore.findGistWithFile([{ id: 'feedface', files: { [GIST_FILE]: {} } }], GIST_FILE))
      .toMatchObject({ gistId: 'feedface' });
    expect(gistCore.findGistWithFile([{ id: 'feedface', files: { 'other.json': {} } }], GIST_FILE)).toBeNull();
    expect(gistCore.findGistWithFile([], GIST_FILE)).toBeNull();
    expect(gistCore.classifyGistFailure(401)).toMatchObject({ kind: 'definitive' });
    expect(gistCore.classifyGistFailure(403)).toMatchObject({ kind: 'definitive' });
    expect(gistCore.classifyGistFailure(500)).toMatchObject({ kind: 'unknown', reasonCode: 'gistResultUnknown' });
    expect(gistCore.buildGistCreateBody(GIST_FILE, '{"a":1}')).toEqual({
      description: 'Boxing extension backup',
      public: false,
      files: { [GIST_FILE]: { content: '{"a":1}' } },
    });
  });

  test('background and NTP copies keep the same credential secret, API origin, and default file name', () => {
    const credentialCore = fs.readFileSync(path.join(ROOT_DIR, 'shared', 'credential-core.js'), 'utf8');
    // Ticket #125 moved the one legacy literal into the shared core; #126 reuses it.
    expect(credentialCore).toContain("const CRED_OBFUSCATION_SECRET = 'boxing-sync-cred-v2-app-secret-2024'");

    const backgroundSrc = fs.readFileSync(path.join(ROOT_DIR, 'background.js'), 'utf8');
    const syncEngineSrc = fs.readFileSync(path.join(ROOT_DIR, 'ntp', 'sync-engine.js'), 'utf8');
    expect(backgroundSrc).toContain("'https://api.github.com/*'");
    expect(syncEngineSrc).toContain("'https://api.github.com/*'");

    const gistCoreSrc = fs.readFileSync(path.join(ROOT_DIR, 'shared', 'gist-backup-core.js'), 'utf8');
    const snapshotCoreSrc = fs.readFileSync(path.join(ROOT_DIR, 'shared', 'snapshot-core.js'), 'utf8');
    const defaultFileMatch = /DEFAULT_GIST_FILE_NAME = '([^']+)'/.exec(gistCoreSrc);
    expect(defaultFileMatch).not.toBeNull();
    expect(snapshotCoreSrc).toContain("REMOTE_DEFAULT_GIST_FILE = '" + defaultFileMatch![1] + "'");
  });

  test('shared credential decrypt reads v3 envelopes and fails closed without the install key', async () => {
    const credCore = loadUmd('shared/credential-core.js');
    const env = await encryptV3('hello-gist', PIK);
    const okCore = credCore.createCredentialCore({ getPerInstallKeyB64: async () => PIK });
    expect(await okCore.decrypt(env)).toBe('hello-gist');
    const missingCore = credCore.createCredentialCore({ getPerInstallKeyB64: async () => { throw new Error('missing'); } });
    expect(await missingCore.decrypt(env)).toBe('');
    expect(await credCore.createCredentialCore({}).decrypt('plain-token')).toBe('plain-token');
  });
});

test.describe('Ticket #126 — background Gist first-create VM lane', () => {
  test.setTimeout(60_000);

  async function baseStore(overrides: Record<string, any> = {}, stateRemote?: any) {
    const env = await encryptV3(TOKEN, PIK);
    return {
      boxingLayout: seedLayout(env, overrides),
      'boxingCredKey.v1': PIK,
      autoBackupState: activeState(stateRemote),
    };
  }

  test('confirmed POST records the real Gist id/owner/file baseline and never leaks the token', async () => {
    const store = await baseStore();
    const beforeLayout = JSON.stringify(store.boxingLayout);
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) return gistCreated();
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls.map((c) => c.method + ' ' + new URL(c.url).pathname)).toEqual(['GET /user', 'GET /gists', 'POST /gists']);
    expect(sandbox.permissionRequests).toEqual([]);
    expect(sandbox.getBadge()).toBe('');

    const post = sandbox.calls.find((c) => c.method === 'POST')!;
    expect(post.headers.authorization).toBe('Bearer ' + TOKEN);
    expect(post.headers.accept).toBe('application/vnd.github+json');
    expect(post.body).toBeTruthy();
    expect(post.body).not.toContain(TOKEN);
    const body = JSON.parse(post.body!);
    expect(body.public).toBe(false);
    expect(Object.keys(body.files)).toEqual([GIST_FILE]);
    const content = JSON.parse(body.files[GIST_FILE].content);
    expect(content.settings.syncProvider).toBe('gist');
    expect(content.settings._encGistToken).toBeUndefined();
    expect(content.settings.gistId).toBeUndefined();
    expect(content.boxes[0].title).toBe('Alpha');

    const state = sandbox.store.autoBackupState;
    expect(state.remote.status).toBe('ok');
    expect(state.remote.baseline).toMatchObject({
      service: 'gist',
      gistId: 'abc12345',
      ownerLogin: 'spec-user',
      ownerId: 42,
      fileName: GIST_FILE,
    });
    expect(state.remote.lastSuccessAt).toBeGreaterThan(0);
    expect(state.remote.pendingCreate).toBeNull();
    expect(state.remote.account).toMatchObject({ login: 'spec-user', id: 42 });
    expect(JSON.stringify(state)).not.toContain(TOKEN);

    // Background never writes boxingLayout.
    expect(JSON.stringify(sandbox.store.boxingLayout)).toBe(beforeLayout);

    // Snapshot body is the #122 allowlist shape, not the raw layout.
    const snapKeys = Object.keys(sandbox.store).filter((k) => k.startsWith('snap.v1.') && k !== 'snap.v1.index');
    expect(snapKeys).toHaveLength(1);
    const snapJson = JSON.stringify(sandbox.store[snapKeys[0]]);
    expect(snapJson).not.toContain(TOKEN);
    expect(snapJson).not.toContain('_encGistToken');
    expect(snapJson).not.toContain(PIK);

    // Second alarm run must not POST a second Gist after a confirmed baseline.
    const firstSuccessAt = state.remote.lastSuccessAt;
    const res2 = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res2.ok).toBe(true);
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    const state2 = sandbox.store.autoBackupState;
    expect(state2.remote.status).toBe('paused');
    expect(state2.remote.lastErrorCode).toBe('gistUpdateNotEnabled');
    expect(state2.remote.baseline.gistId).toBe('abc12345');
    expect(state2.remote.lastSuccessAt).toBe(firstSuccessAt);
  });

  test('a later permission revocation pauses with no API call and keeps the real success time', async () => {
    const store = await baseStore();
    const first = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) return gistCreated();
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    await first.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    const successAt = first.store.autoBackupState.remote.lastSuccessAt;
    expect(successAt).toBeGreaterThan(0);

    const revoked = await makeBgSandbox({
      store,
      grantPermission: false,
      fetchImpl: () => { throw new Error('network must not be touched after revocation'); },
    });
    await revoked.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(revoked.calls).toEqual([]);
    expect(revoked.store.autoBackupState.remote.status).toBe('paused');
    expect(revoked.store.autoBackupState.remote.lastErrorCode).toBe('gistPermissionMissing');
    expect(revoked.store.autoBackupState.remote.lastSuccessAt).toBe(successAt);
    expect(revoked.store.gistPendingPermission).toMatchObject({ needed: true, origin: 'https://api.github.com/*' });
  });

  test('reconfiguring the interval preserves the cloud baseline and pending marker', async () => {
    const store = await baseStore({ syncProvider: 'local' }, {
      provider: 'gist',
      status: 'unknown',
      lastAttemptAt: 5,
      lastSuccessAt: 9,
      lastError: null,
      lastErrorCode: 'gistResultUnknown',
      account: { login: 'spec-user', id: 42 },
      baseline: {
        service: 'gist',
        gistId: 'abc12345',
        fileName: GIST_FILE,
        ownerLogin: 'spec-user',
        ownerId: 42,
        createdAt: 9,
        updatedAt: 9,
        verifiedAt: 9,
      },
      pendingCreate: {
        provider: 'gist',
        fileName: GIST_FILE,
        description: 'Boxing extension backup',
        startedAt: 5,
        accountLogin: 'spec-user',
        accountId: 42,
        gistId: '',
      },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: () => { throw new Error('provider is local; no network expected'); },
    });

    await sandbox.bg.configureBackgroundAutoBackup({ optIn: true, intervalSec: 86400 });
    let state = sandbox.store.autoBackupState;
    expect(state.optIn).toBe(true);
    expect(state.remote.baseline.gistId).toBe('abc12345');
    expect(state.remote.pendingCreate).toBeTruthy();
    expect(state.remote.account).toMatchObject({ login: 'spec-user', id: 42 });

    await sandbox.bg.configureBackgroundAutoBackup({ optIn: false, intervalSec: 0 });
    state = sandbox.store.autoBackupState;
    expect(state.optIn).toBe(false);
    expect(state.remote.baseline.gistId).toBe('abc12345');
    expect(state.remote.pendingCreate).toBeTruthy();
    expect(sandbox.calls).toEqual([]);
  });

  test('manual PATCH goes through the worker queue and refreshes the baseline', async () => {
    const baseline = {
      service: 'gist', gistId: 'abc12345', fileName: GIST_FILE,
      ownerLogin: 'spec-user', ownerId: 42,
      createdAt: 1, updatedAt: 1, verifiedAt: 1,
    };
    const store = await baseStore({ gistId: 'abc12345' }, {
      provider: 'gist', status: 'paused', lastAttemptAt: 5, lastSuccessAt: 9,
      lastErrorCode: 'gistUpdateNotEnabled', account: { login: 'spec-user', id: 42 }, baseline, pendingCreate: null,
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (call.method === 'PATCH' && call.url.endsWith('/gists/abc12345')) {
          return jsonResponse(200, {
            id: 'abc12345',
            files: { [GIST_FILE]: { filename: GIST_FILE, size: 321 } },
            owner: { login: 'spec-user', id: 42 },
            created_at: '2026-11-16T00:00:00Z',
            updated_at: '2026-11-16T01:00:00Z',
          });
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({
      gistId: 'abc12345', fileName: GIST_FILE, content: '{"a":1}',
    });
    expect(res).toMatchObject({ success: true, gistId: 'abc12345', created: false });
    expect(sandbox.calls.map((c) => c.method + ' ' + new URL(c.url).pathname)).toEqual(['GET /user', 'PATCH /gists/abc12345']);
    expect(sandbox.calls[1].body).toBe(JSON.stringify({ files: { [GIST_FILE]: { content: '{"a":1}' } } }));
    expect(sandbox.calls[1].body).not.toContain(TOKEN);

    const state = sandbox.store.autoBackupState;
    expect(state.remote.baseline.updatedAt).toBe(Date.parse('2026-11-16T01:00:00Z'));
    expect(state.remote.baseline.verifiedAt).toBeGreaterThan(0);
    // A manual write is not an unattended success: the automatic paused state and
    // its reason stay exactly as they were.
    expect(state.remote.lastSuccessAt).toBe(9);
    expect(state.remote.status).toBe('paused');
    expect(state.remote.lastErrorCode).toBe('gistUpdateNotEnabled');
  });

  test('two manual creates share the queue and POST only once', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) return gistCreated();
        if (call.method === 'PATCH' && call.url.endsWith('/gists/abc12345')) {
          return jsonResponse(200, {
            id: 'abc12345',
            files: { [GIST_FILE]: { filename: GIST_FILE, size: 12 } },
            owner: { login: 'spec-user', id: 42 },
            created_at: '2026-11-16T00:00:00Z',
            updated_at: '2026-11-16T00:00:10Z',
          });
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const [first, second] = await Promise.all([
      sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":1}' }),
      sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":2}' }),
    ]);
    expect(first).toMatchObject({ success: true, created: true });
    expect(second).toMatchObject({ success: true, created: false });
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(sandbox.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    const state = sandbox.store.autoBackupState;
    expect(state.remote.baseline.gistId).toBe('abc12345');
    expect(state.remote.pendingCreate).toBeNull();
  });

  test('a lost manual POST keeps a pending marker and blocks a second POST', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) throw new TypeError('network lost');
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const first = await sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":1}' });
    expect(first).toMatchObject({ success: false, resultUnknown: true, reasonCode: 'gistResultUnknown' });
    const state = sandbox.store.autoBackupState;
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.pendingCreate).toMatchObject({ provider: 'gist', fileName: GIST_FILE });
    expect(state.remote.lastSuccessAt).toBe(0);

    const second = await sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":2}' });
    expect(second).toMatchObject({ success: false, reasonCode: 'gistResultUnknown' });
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  test('a pending create or an oversized body sends no manual request', async () => {
    const store = await baseStore({}, {
      provider: 'gist', status: 'unknown', pendingCreate: { provider: 'gist', fileName: GIST_FILE },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: () => { throw new Error('network must not be touched'); },
    });
    const blocked = await sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":1}' });
    expect(blocked).toMatchObject({ success: false, reasonCode: 'gistResultUnknown' });
    expect(sandbox.calls).toEqual([]);

    const tooLarge = await sandbox.bg.enqueueManualGistWrite({
      fileName: GIST_FILE, content: 'x'.repeat(2 * 1024 * 1024 + 1),
    });
    expect(tooLarge).toMatchObject({ success: false, reasonCode: 'gistPayloadTooLarge' });
    expect(sandbox.calls).toEqual([]);
  });

  test('a pending create with a known Gist id is confirmed by GET, then PATCHed', async () => {
    const store = await baseStore({}, {
      provider: 'gist', status: 'unknown', lastAttemptAt: 7, lastSuccessAt: 0,
      lastErrorCode: 'gistResultUnknown', account: { login: 'spec-user', id: 42 },
      baseline: null,
      pendingCreate: {
        provider: 'gist', fileName: GIST_FILE, description: 'Boxing extension backup',
        startedAt: 7, accountLogin: 'spec-user', accountId: 42, gistId: 'abc12345',
      },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (call.method === 'GET' && call.url.endsWith('/gists/abc12345')) {
          return jsonResponse(200, {
            id: 'abc12345',
            files: { [GIST_FILE]: { filename: GIST_FILE, size: 1 } },
            owner: { login: 'spec-user', id: 42 },
            created_at: '2026-11-16T00:00:00Z',
            updated_at: '2026-11-16T00:00:00Z',
          });
        }
        if (call.method === 'PATCH' && call.url.endsWith('/gists/abc12345')) {
          return jsonResponse(200, {
            id: 'abc12345',
            files: { [GIST_FILE]: { filename: GIST_FILE, size: 9 } },
            owner: { login: 'spec-user', id: 42 },
            created_at: '2026-11-16T00:00:00Z',
            updated_at: '2026-11-16T02:00:00Z',
          });
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":2}' });
    expect(res).toMatchObject({ success: true, gistId: 'abc12345', created: false });
    expect(sandbox.calls.map((c) => c.method + ' ' + new URL(c.url).pathname)).toEqual([
      'GET /user', 'GET /gists/abc12345', 'PATCH /gists/abc12345',
    ]);
    const state = sandbox.store.autoBackupState;
    expect(state.remote.pendingCreate).toBeNull();
    expect(state.remote.baseline.gistId).toBe('abc12345');
    // The unknown result is resolved by the GET + PATCH, so the paused/unknown
    // status and reason must not stick.
    expect(state.remote.status).toBe('idle');
    expect(state.remote.lastErrorCode).toBeNull();
  });

  test('a pending Gist that no longer exists clears the marker and pauses', async () => {
    const store = await baseStore({}, {
      provider: 'gist', status: 'unknown', lastAttemptAt: 7, lastSuccessAt: 0,
      lastErrorCode: 'gistResultUnknown', account: { login: 'spec-user', id: 42 },
      baseline: null,
      pendingCreate: {
        provider: 'gist', fileName: GIST_FILE, description: 'Boxing extension backup',
        startedAt: 7, accountLogin: 'spec-user', accountId: 42, gistId: 'abc12345',
      },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (call.method === 'GET' && call.url.endsWith('/gists/abc12345')) return jsonResponse(404, {});
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":1}' });
    expect(res).toMatchObject({ success: false, reasonCode: 'gistTargetNeedsReview' });
    expect(sandbox.calls.map((c) => c.method + ' ' + new URL(c.url).pathname)).toEqual([
      'GET /user', 'GET /gists/abc12345',
    ]);
    const state = sandbox.store.autoBackupState;
    expect(state.remote.pendingCreate).toBeNull();
    expect(state.remote.baseline).toBeNull();
    expect(state.remote.status).toBe('paused');
    expect(state.remote.lastErrorCode).toBe('gistTargetNeedsReview');
  });

  test('a pending Gist with a different explicit id pauses without a PATCH', async () => {
    const store = await baseStore({}, {
      provider: 'gist', status: 'unknown', lastAttemptAt: 7, lastSuccessAt: 0,
      lastErrorCode: 'gistResultUnknown', account: { login: 'spec-user', id: 42 },
      baseline: null,
      pendingCreate: {
        provider: 'gist', fileName: GIST_FILE, description: 'Boxing extension backup',
        startedAt: 7, accountLogin: 'spec-user', accountId: 42, gistId: 'abc12345',
      },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: () => { throw new Error('network must not be touched'); },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({
      gistId: 'deadbeef', fileName: GIST_FILE, content: '{"a":1}',
    });
    expect(res).toMatchObject({ success: false, reasonCode: 'gistPendingTargetChanged' });
    expect(sandbox.calls).toEqual([]);
    const state = sandbox.store.autoBackupState;
    // The first POST's target must stay recoverable.
    expect(state.remote.pendingCreate.gistId).toBe('abc12345');
    expect(state.remote.status).toBe('unknown');
  });

  test('a pending Gist keeps its marker when the file name changed', async () => {
    const store = await baseStore({}, {
      provider: 'gist', status: 'unknown', lastAttemptAt: 7, lastSuccessAt: 0,
      lastErrorCode: 'gistResultUnknown', account: { login: 'spec-user', id: 42 },
      baseline: null,
      pendingCreate: {
        provider: 'gist', fileName: 'old.json', description: 'Boxing extension backup',
        startedAt: 7, accountLogin: 'spec-user', accountId: 42, gistId: 'abc12345',
      },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":1}' });
    expect(res).toMatchObject({ success: false, reasonCode: 'gistPendingFileNameChanged' });
    expect(sandbox.calls.map((c) => c.method)).toEqual(['GET']);
    const state = sandbox.store.autoBackupState;
    // Switching the name back must still be able to confirm this known Gist.
    expect(state.remote.pendingCreate.gistId).toBe('abc12345');
    expect(state.remote.pendingCreate.fileName).toBe('old.json');
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('gistPendingFileNameChanged');
  });

  test('a pending Gist without the expected file keeps the marker unconfirmed', async () => {
    const store = await baseStore({}, {
      provider: 'gist', status: 'unknown', lastAttemptAt: 7, lastSuccessAt: 0,
      lastErrorCode: 'gistResultUnknown', account: { login: 'spec-user', id: 42 },
      baseline: null,
      pendingCreate: {
        provider: 'gist', fileName: GIST_FILE, description: 'Boxing extension backup',
        startedAt: 7, accountLogin: 'spec-user', accountId: 42, gistId: 'abc12345',
      },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (call.method === 'GET' && call.url.endsWith('/gists/abc12345')) {
          return jsonResponse(200, {
            id: 'abc12345',
            files: { 'other.json': { filename: 'other.json', size: 1 } },
            owner: { login: 'spec-user', id: 42 },
          });
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":1}' });
    expect(res).toMatchObject({ success: false, resultUnknown: true, reasonCode: 'gistPendingFileMissing' });
    const state = sandbox.store.autoBackupState;
    expect(state.remote.pendingCreate.gistId).toBe('abc12345');
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('gistPendingFileMissing');
  });

  test('a token from another GitHub account pauses before any write', async () => {
    const baseline = {
      service: 'gist', gistId: 'abc12345', fileName: GIST_FILE,
      ownerLogin: 'spec-user', ownerId: 42,
      createdAt: 1, updatedAt: 1, verifiedAt: 1,
    };
    const store = await baseStore({ gistId: 'abc12345' }, {
      provider: 'gist', status: 'paused', lastSuccessAt: 9,
      lastErrorCode: 'gistUpdateNotEnabled', account: { login: 'spec-user', id: 42 },
      baseline, pendingCreate: null,
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser(99, 'other-user');
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({ gistId: 'abc12345', fileName: GIST_FILE, content: '{"a":1}' });
    expect(res).toMatchObject({ success: false, reasonCode: 'gistAccountChanged' });
    expect(sandbox.calls.map((c) => c.method)).toEqual(['GET']);
    expect(sandbox.store.autoBackupState.remote.baseline.gistId).toBe('abc12345');
  });

  test('an own-Gist listing over the page cap pauses with a dedicated reason', async () => {
    const store = await baseStore();
    const pageWithNext = () => new Response('[]', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        link: '<https://api.github.com/gists?per_page=100&page=2>; rel="next"',
      },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return pageWithNext();
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({ fileName: GIST_FILE, content: '{"a":1}' });
    expect(res).toMatchObject({ success: false, reasonCode: 'gistListTooMany' });
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(sandbox.calls.filter(isGistListCall)).toHaveLength(3);
  });

  test('a failed manual PATCH records the unknown result without moving success time', async () => {
    const baseline = {
      service: 'gist', gistId: 'abc12345', fileName: GIST_FILE,
      ownerLogin: 'spec-user', ownerId: 42,
      createdAt: 1, updatedAt: 1, verifiedAt: 1,
    };
    const store = await baseStore({ gistId: 'abc12345' }, {
      provider: 'gist', status: 'paused', lastSuccessAt: 9,
      lastErrorCode: 'gistUpdateNotEnabled', account: { login: 'spec-user', id: 42 },
      baseline, pendingCreate: null,
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (call.method === 'PATCH' && call.url.endsWith('/gists/abc12345')) return jsonResponse(500, {});
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    const res = await sandbox.bg.enqueueManualGistWrite({ gistId: 'abc12345', fileName: GIST_FILE, content: '{"a":1}' });
    expect(res).toMatchObject({ success: false, resultUnknown: true, reasonCode: 'gistResultUnknown' });
    const state = sandbox.store.autoBackupState;
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('gistResultUnknown');
    expect(state.remote.lastSuccessAt).toBe(9);
  });

  test('an existing trusted Gist stays untouched by unattended runs after local edits', async () => {
    const baseline = {
      service: 'gist', gistId: 'abc12345', fileName: GIST_FILE,
      ownerLogin: 'spec-user', ownerId: 42,
      createdAt: 1, updatedAt: 1, verifiedAt: 1,
    };
    const store = await baseStore({ gistId: 'abc12345' }, {
      provider: 'gist', status: 'ok', lastAttemptAt: 5, lastSuccessAt: 9,
      lastErrorCode: null, account: { login: 'spec-user', id: 42 }, baseline, pendingCreate: null,
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });

    for (const title of ['Edited once', 'Edited twice']) {
      sandbox.store.boxingLayout.boxes[0].title = title;
      const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
      expect(res.ok).toBe(true);
    }
    expect(sandbox.calls.filter((c) => c.method === 'PATCH' || c.method === 'POST')).toHaveLength(0);
    const state = sandbox.store.autoBackupState;
    expect(state.remote.status).toBe('paused');
    expect(state.remote.lastErrorCode).toBe('gistUpdateNotEnabled');
    expect(state.remote.lastSuccessAt).toBe(9);
    expect(state.remote.baseline.gistId).toBe('abc12345');
  });

  test('saved Gist id without a trusted baseline pauses before any POST', async () => {
    const store = await baseStore({ gistId: 'deadbeef' });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(sandbox.store.autoBackupState.remote.status).toBe('paused');
    expect(sandbox.store.autoBackupState.remote.lastErrorCode).toBe('gistTargetNeedsReview');
    expect(sandbox.store.autoBackupState.remote.lastSuccessAt).toBe(0);
  });

  test('an untracked Gist with the target file name pauses without POST', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) {
          return jsonResponse(200, [{
            id: 'feedface',
            files: { [GIST_FILE]: { filename: GIST_FILE, size: 10 } },
            owner: { login: 'spec-user', id: 42 },
          }]);
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(sandbox.store.autoBackupState.remote.status).toBe('paused');
    expect(sandbox.store.autoBackupState.remote.lastErrorCode).toBe('gistUnknownExisting');
    expect(sandbox.store.autoBackupState.remote.lastSuccessAt).toBe(0);
  });

  test('a failed account Gist list check pauses without POST', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) throw new TypeError('list unavailable');
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(sandbox.store.autoBackupState.remote.status).toBe('paused');
    expect(sandbox.store.autoBackupState.remote.lastErrorCode).toBe('gistCheckFailed');
  });

  test('token account change pauses without POST or layout writes', async () => {
    const store = await baseStore({}, {
      provider: 'gist', status: 'idle', account: { login: 'old-user', id: 1 },
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser(42, 'new-user');
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(sandbox.store.autoBackupState.remote.status).toBe('paused');
    expect(sandbox.store.autoBackupState.remote.lastErrorCode).toBe('gistAccountChanged');
    expect(sandbox.store.autoBackupState.remote.account).toMatchObject({ login: 'old-user', id: 1 });
  });

  test('missing host permission pauses with zero API calls and records pending permission', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      grantPermission: false,
      fetchImpl: () => { throw new Error('network must not be touched without permission'); },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls).toEqual([]);
    expect(sandbox.permissionRequests).toEqual([]);
    expect(sandbox.store.gistPendingPermission).toMatchObject({
      needed: true,
      origin: 'https://api.github.com/*',
      source: 'background',
    });
    expect(sandbox.store.autoBackupState.remote.status).toBe('paused');
    expect(sandbox.store.autoBackupState.remote.lastErrorCode).toBe('gistPermissionMissing');
    expect(sandbox.getBadge()).toBe('!');
  });

  test('permissions.contains throwing fails closed with no API call', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      containsThrows: true,
      fetchImpl: () => { throw new Error('network must not be touched when permission check fails'); },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls).toEqual([]);
    expect(sandbox.store.autoBackupState.remote.lastErrorCode).toBe('gistPermissionMissing');
  });

  test('lost POST response stays pending and a later run never sends a second POST', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) throw new TypeError('network lost');
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    const state = sandbox.store.autoBackupState;
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('gistResultUnknown');
    expect(state.remote.pendingCreate).toMatchObject({ provider: 'gist', fileName: GIST_FILE });
    expect(state.remote.lastSuccessAt).toBe(0);
    expect(sandbox.getBadge()).toBe('!');

    await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(sandbox.store.autoBackupState.remote.status).toBe('unknown');
    expect(sandbox.store.autoBackupState.remote.baseline).toBeNull();
  });

  test('2xx with an unusable body is pending, never a success', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) return jsonResponse(201, { id: 'abc12345' });
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    const state = sandbox.store.autoBackupState;
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastSuccessAt).toBe(0);
    expect(state.remote.baseline).toBeNull();
    expect(state.remote.pendingCreate.gistId).toBe('abc12345');
  });

  test('HTTP 200 with a complete body is still unknown, never a success', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) {
          return jsonResponse(200, {
            id: 'abc12345',
            files: { [GIST_FILE]: { filename: GIST_FILE, size: 123 } },
            owner: { login: 'spec-user', id: 42 },
            created_at: '2026-11-16T00:00:00Z',
            updated_at: '2026-11-16T00:00:00Z',
          });
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    const state = sandbox.store.autoBackupState;
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('gistResultUnknown');
    expect(state.remote.lastSuccessAt).toBe(0);
    expect(state.remote.baseline).toBeNull();
    expect(state.remote.pendingCreate).toBeTruthy();
  });

  test('a failed result write keeps the pending marker from storage', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) {
          sandbox.failNextAutoBackupStateWrite();
          return gistCreated();
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    const state = sandbox.store.autoBackupState;
    expect(state.remote.pendingCreate).toBeTruthy();
    expect(state.remote.lastSuccessAt).toBe(0);
    expect(state.remote.baseline).toBeNull();
    expect(state.remote.lastErrorCode).toBe('internal-error');
  });

  test('WebDAV settlement preserves an unconfirmed Gist create marker', async () => {
    const store = await baseStore({}, {
      provider: 'gist',
      // Reconfiguring the interval can reset the status to idle while keeping the
      // unconfirmed marker; the WebDAV run must not erase it.
      status: 'idle',
      generation: 3,
      lastAttemptAt: 1,
      lastSuccessAt: 0,
      lastErrorCode: 'gistResultUnknown',
      account: { login: 'spec-user', id: 42 },
      baseline: null,
      pendingCreate: {
        provider: 'gist',
        fileName: GIST_FILE,
        description: 'Boxing extension backup',
        startedAt: 1,
        accountLogin: 'spec-user',
        accountId: 42,
        gistId: '',
      },
    });
    store.boxingLayout = seedLayout(null, {
      syncProvider: 'webdav',
      webdavUrl: 'https://dav.example.com/boxing/',
      webdavUser: '',
      _encWebdavPass: 'plain-webdav-pass',
      _encGistToken: undefined,
    });
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.includes('dav.example.com')) {
          return new Response('', { status: 404 });
        }
        if (call.method === 'PUT' && call.url.includes('dav.example.com')) {
          return new Response('', { status: 201, headers: { etag: '"etag-1"' } });
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const outcome = await sandbox.bg.runBackgroundWebDAVAutoBackup({
      state: sandbox.store.autoBackupState,
      layout: sandbox.store.boxingLayout,
      epoch: 1,
      trigger: 'test',
    });
    expect(outcome.remote.status).toBe('ok');
    expect(outcome.remote.provider).toBe('webdav');
    expect(outcome.remote.generation).toBe(3);
    expect(outcome.remote.pendingCreate).toBeTruthy();
    expect(outcome.remote.pendingCreate.fileName).toBe(GIST_FILE);
  });

  test('a reset during the POST discards the stale success write', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        if (call.method === 'POST' && call.url.endsWith('/gists')) {
          // Simulate credential deletion/reset while the POST is in flight.
          const cur = sandbox.store.autoBackupState;
          sandbox.store.autoBackupState = {
            ...cur,
            remote: { ...cur.remote, generation: (Number(cur.remote.generation) || 0) + 1 },
          };
          return gistCreated();
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.store.autoBackupState.remote.generation).toBe(1);
    expect(sandbox.store.autoBackupState.remote.baseline).toBeNull();
    expect(sandbox.store.autoBackupState.remote.lastSuccessAt).toBe(0);
  });

  test('a provider switch during the list check cancels before POST', async () => {
    const store = await baseStore();
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) {
          sandbox.store.boxingLayout.settings.syncProvider = 'local';
          return jsonResponse(200, []);
        }
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(sandbox.store.autoBackupState.remote.baseline).toBeNull();
    expect(sandbox.store.autoBackupState.remote.status).not.toBe('ok');
  });

  test('a payload over the request cap pauses as too large without POST', async () => {
    const store = await baseStore();
    store.boxingLayout.boxes[0].title = 'X'.repeat(2_200_000);
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: (call) => {
        if (call.method === 'GET' && call.url.endsWith('/user')) return apiUser();
        if (isGistListCall(call)) return jsonResponse(200, []);
        throw new Error('unexpected call ' + call.method + ' ' + call.url);
      },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(false);
    expect(sandbox.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(sandbox.store.autoBackupState.remote.status).toBe('paused');
    expect(sandbox.store.autoBackupState.remote.lastErrorCode).toBe('gistPayloadTooLarge');
    expect(sandbox.store.autoBackupState.remote.lastSuccessAt).toBe(0);
  });

  test('missing token pauses without network and keeps local snapshot success independent', async () => {
    const env = await encryptV3(TOKEN, PIK);
    const layout = seedLayout(env);
    delete layout.settings._encGistToken;
    const store = {
      boxingLayout: layout,
      'boxingCredKey.v1': PIK,
      autoBackupState: activeState(),
    };
    const sandbox = await makeBgSandbox({
      store,
      fetchImpl: () => { throw new Error('network must not be touched without a token'); },
    });
    const res = await sandbox.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
    expect(res.ok).toBe(true);
    expect(sandbox.calls).toEqual([]);
    const state = sandbox.store.autoBackupState;
    expect(state.local.status).toBe('ok');
    expect(state.local.lastSuccessAt).toBeGreaterThan(0);
    expect(state.remote.status).toBe('paused');
    expect(state.remote.lastErrorCode).toBe('gistTokenMissing');
    expect(state.remote.lastSuccessAt).toBe(0);
  });
});

async function bootFileNtp(page: Page) {
  await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout))).toBe(true);
  await dismissOnboarding(page);
}

async function openSyncTab(page: Page) {
  await page.evaluate(() => document.getElementById('settings-btn')?.click());
  await expect(page.locator('#settings-modal')).toBeVisible();
  await page.evaluate(() => {
    (document.querySelector('.settings-nav__item[data-tab="sync"]') as HTMLElement | null)?.click();
  });
  await expect(page.locator('#tab-sync')).toBeVisible();
}

test.describe('Ticket #126 — NTP Gist auto-backup status', () => {
  test.setTimeout(60_000);

  test('paused and unknown remote results appear in the remote status line', async ({ page }) => {
    await bootFileNtp(page);
    await page.evaluate(async (state) => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncProvider = 'gist';
      dbg.layout.settings.autoBackupInterval = 3600;
      dbg.layout.settings._encGistToken = 'plain-token';
      await dbg.saveLayout();
      const providerSelect = document.getElementById('sync-provider') as HTMLSelectElement | null;
      if (providerSelect) providerSelect.value = 'gist';
      await dbg.storageSet({ autoBackupState: state });
      await (window as any).__boxingRefreshLocalAutoBackupUi(state);
    }, {
      ...activeState({
        provider: 'gist',
        status: 'paused',
        lastErrorCode: 'gistTargetNeedsReview',
      }),
    });

    await openSyncTab(page);
    await expect(page.locator('#auto-backup-remote-status')).toBeVisible();
    await expect(page.locator('#auto-backup-remote-status')).toContainText('Cloud backup paused');
    await expect(page.locator('#auto-backup-remote-status')).toContainText('Gist target or file name');
    await expect(page.locator('#local-auto-backup-error')).toBeHidden();

    await page.evaluate(async () => {
      const state = {
        ...(window as any).__boxingSnapshotCore.defaultAutoBackupState(),
        optIn: true,
        intervalSec: 3600,
        epoch: 1,
        local: { status: 'ok', lastAttemptAt: 1, lastSuccessAt: 1, lastSnapshotTs: 1, lastError: null },
        remote: {
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: 2,
          lastSuccessAt: 0,
          lastErrorCode: 'gistResultUnknown',
          account: null,
          baseline: null,
          pendingCreate: { provider: 'gist', fileName: 'boxing-backup.json' },
        },
      };
      await (window as any).__boxingRefreshLocalAutoBackupUi(state);
    });
    await expect(page.locator('#auto-backup-remote-status')).toBeVisible();
    await expect(page.locator('#auto-backup-remote-status')).toContainText('Cloud backup result unknown');
    await expect(page.locator('#local-auto-backup-error')).toBeHidden();

    // A confirmed cloud success must not show the generic paused copy.
    await page.evaluate(async () => {
      const state = {
        ...(window as any).__boxingSnapshotCore.defaultAutoBackupState(),
        optIn: true,
        intervalSec: 3600,
        epoch: 1,
        local: { status: 'ok', lastAttemptAt: 1, lastSuccessAt: 1, lastSnapshotTs: 1, lastError: null },
        remote: {
          provider: 'gist',
          status: 'ok',
          lastAttemptAt: 3,
          lastSuccessAt: 3,
          lastErrorCode: null,
          account: { login: 'spec-user', id: 42 },
          baseline: null,
          pendingCreate: null,
        },
      };
      await (window as any).__boxingRefreshLocalAutoBackupUi(state);
    });
    await expect(page.locator('#auto-backup-remote-status')).toContainText('Cloud backup saved');
    await expect(page.locator('#local-auto-backup-error')).toBeHidden();
  });

  test('manual Gist backup refuses to race a pending background create', async ({ page }) => {
    await bootFileNtp(page);
    const result = await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      const core = (window as any).__boxingSnapshotCore;
      dbg.layout.settings.syncProvider = 'gist';
      dbg.layout.settings.syncFileName = 'boxing-backup.json';
      await dbg.saveLayout();
      const tokenInput = document.getElementById('gist-token') as HTMLInputElement | null;
      if (tokenInput) tokenInput.value = 'ghp_manual_token';
      const state = core.defaultAutoBackupState();
      state.remote = {
        ...state.remote,
        provider: 'gist',
        status: 'unknown',
        generation: 0,
        pendingCreate: { provider: 'gist', fileName: 'boxing-backup.json' },
      };
      await dbg.storageSet({ autoBackupState: state });

      const realFetch = window.fetch;
      let fetchCount = 0;
      (window as any).fetch = function (..._args: any[]) {
        fetchCount++;
        return Promise.reject(new Error('manual Gist backup must not fetch while a background create is pending'));
      };
      let message = '';
      try {
        await (window as any).__bxSync.backupToGist();
      } catch (e: any) {
        message = String(e?.message || e);
      } finally {
        window.fetch = realFetch;
      }
      return { fetchCount, message };
    });
    expect(result.fetchCount).toBe(0);
    expect(result.message).toContain('no confirmed result');
  });

  test('manual Gist backup uses a strict coordination read before any network write', () => {
    const storageSrc = fs.readFileSync(path.join(ROOT_DIR, 'ntp', 'storage.js'), 'utf8');
    const start = storageSrc.indexOf('export async function getAutoBackupStateStrict');
    expect(start).toBeGreaterThan(-1);
    const block = storageSrc.slice(start, start + 320);
    // The strict variant must not swallow a storage read failure into a default state.
    expect(block).not.toContain('catch');
    expect(block).toContain('layoutStorage.get');
    const syncSrc = fs.readFileSync(path.join(ROOT_DIR, 'ntp', 'sync-engine.js'), 'utf8');
    expect(syncSrc).toContain('getAutoBackupStateStrict()');
    expect(syncSrc).toContain("gistPrecheckError('Could not read auto-backup state')");
    // Ticket #128: a real extension must route the manual write through the worker
    // queue, and the direct PATCH fallback must sit after that gate.
    expect(syncSrc).toContain("type: 'gist-write'");
    // The extension path must let the background recover a known pending id;
    // only the file:// fallback keeps the hard stop.
    expect(syncSrc).toContain('remote.pendingCreate && !hasExtensionRuntime()');
    const extensionGate = syncSrc.indexOf('if (hasExtensionRuntime())');
    const directPatch = syncSrc.indexOf("method: 'PATCH'");
    expect(extensionGate).toBeGreaterThan(-1);
    expect(directPatch).toBeGreaterThan(extensionGate);
  });

  test('a background-created Gist id is mirrored into the normal settings field', async ({ page }) => {
    await bootFileNtp(page);
    await page.evaluate(async () => {
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.syncProvider = 'gist';
      dbg.layout.settings.autoBackupInterval = 3600;
      dbg.layout.settings._encGistToken = 'plain-token';
      delete dbg.layout.settings.gistId;
      await dbg.saveLayout();
      const providerSelect = document.getElementById('sync-provider') as HTMLSelectElement | null;
      if (providerSelect) providerSelect.value = 'gist';
      const state = {
        ...(window as any).__boxingSnapshotCore.defaultAutoBackupState(),
        optIn: true,
        intervalSec: 3600,
        epoch: 1,
        remote: {
          provider: 'gist',
          status: 'ok',
          lastAttemptAt: 10,
          lastSuccessAt: 10,
          lastErrorCode: null,
          account: { login: 'spec-user', id: 42 },
          baseline: {
            service: 'gist',
            gistId: 'abc12345',
            fileName: 'boxing-backup.json',
            ownerLogin: 'spec-user',
            ownerId: 42,
            createdAt: 10,
            updatedAt: 10,
            verifiedAt: 10,
          },
          pendingCreate: null,
        },
      };
      await dbg.storageSet({ autoBackupState: state });
      await (window as any).__boxingRefreshLocalAutoBackupUi(state);
    });
    await openSyncTab(page);
    expect(await page.locator('#gist-id').inputValue()).toBe('abc12345');
    expect(await page.evaluate(() => (window as any).__boxingDebug.layout.settings.gistId)).toBe('abc12345');
  });
});

test.describe('Ticket #126 — built manifests and shared modules', () => {
  test('Chrome/Firefox build boundaries and shared cores are packaged', () => {
    const chromeManifestPath = path.join(DIST_CHROME, 'manifest.json');
    const firefoxManifestPath = path.join(DIST_FIREFOX, 'manifest.json');
    test.skip(!fs.existsSync(chromeManifestPath) || !fs.existsSync(firefoxManifestPath), 'dist builds missing - CI builds first');

    const chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf8'));
    expect(chromeManifest.optional_host_permissions || []).toContain('https://*/*');
    expect(chromeManifest.host_permissions || []).not.toContain('https://*/*');
    expect(chromeManifest.permissions || []).not.toContain('notifications');

    const ffManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));
    expect(ffManifest.host_permissions || []).toContain('https://*/*');
    expect(ffManifest.permissions || []).not.toContain('notifications');

    for (const dist of [DIST_CHROME, DIST_FIREFOX]) {
      for (const rel of ['shared/credential-core.js', 'shared/gist-backup-core.js', 'shared/snapshot-core.js']) {
        expect(fs.existsSync(path.join(dist, rel)), rel + ' missing from ' + dist).toBe(true);
      }
    }
    const bgCode = fs.readFileSync(path.join(DIST_CHROME, 'background.js'), 'utf8');
    expect(bgCode).toContain("importScripts('shared/credential-core.js')");
    expect(bgCode).toContain("importScripts('shared/gist-backup-core.js')");
    // The background must never call permissions.request (D5).
    expect(bgCode).not.toMatch(/permissions\.request\s*\(/);
  });
});

function copyDir(src: string, dst: string) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === 'release') continue; // packaged zips/crx are not needed to load the extension
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function makeGrantedChromeBuild(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-126-build-'));
  copyDir(DIST_CHROME, tmp);
  const manifestPath = path.join(tmp, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const optional = Array.isArray(manifest.optional_host_permissions) ? manifest.optional_host_permissions : [];
  manifest.optional_host_permissions = optional.filter((p: string) => p !== 'https://*/*');
  manifest.host_permissions = Array.from(new Set([...(manifest.host_permissions || []), 'https://*/*']));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return tmp;
}

async function launchExtension(extensionPath: string) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-126-profile-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [
      '--load-extension=' + extensionPath,
      '--disable-extensions-except=' + extensionPath,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  return { ctx, profile };
}

async function seedRealExtension(ctx: any, token: string) {
  const page = await ctx.newPage();
  await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug?.saveLayout)), { timeout: 30000 }).toBe(true);
  await dismissOnboarding(page);
  await expect.poll(() => page.evaluate(() => typeof (window as any).__boxingEncryptCredential === 'function'), { timeout: 30000 }).toBe(true);
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));

  await page.evaluate(async (plain: string) => {
    const dbg = (window as any).__boxingDebug;
    const enc = await (window as any).__boxingEncryptCredential(plain);
    dbg.layout.settings.syncProvider = 'gist';
    dbg.layout.settings.syncFileName = 'boxing-backup.json';
    dbg.layout.settings.syncLevel = 'full';
    dbg.layout.settings.autoBackupInterval = 3600;
    dbg.layout.settings._encGistToken = enc;
    await dbg.saveLayout();
  }, token);

  await sw.evaluate(async (state: any) => {
    await chrome.storage.local.set({ autoBackupState: state });
  }, activeState());

  await page.close();
  return sw;
}

test.describe('Ticket #126 — real Chrome extension', () => {
  test.setTimeout(180_000);

  test('shipped build with optional host permission pauses without any GitHub request', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-extension', 'real extension lane');
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')), 'dist/boxing-chrome not built');

    const { ctx, profile } = await launchExtension(DIST_CHROME);
    const apiRequests: string[] = [];
    ctx.on('request', (req: any) => {
      if (req.url().startsWith('https://api.github.com/')) apiRequests.push(req.url());
    });
    try {
      const sw = await seedRealExtension(ctx, TOKEN);
      const run = await sw.evaluate(async () => {
        const bg = (self as any).__boxingBgAutoBackup;
        const res = await bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
        const all = await chrome.storage.local.get(null);
        const badge = await chrome.action.getBadgeText({});
        return { res, state: all.autoBackupState, pending: all.gistPendingPermission, badge };
      });
      expect(run.res.ok).toBe(true);
      expect(apiRequests).toEqual([]);
      expect(run.state.remote.status).toBe('paused');
      expect(run.state.remote.lastErrorCode).toBe('gistPermissionMissing');
      expect(run.pending).toMatchObject({ needed: true, origin: 'https://api.github.com/*' });
      expect(run.badge).toBe('!');
    } finally {
      await ctx.close().catch(() => {});
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });

  test('pre-granted test build creates exactly one Gist through the real service worker', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-extension', 'real extension lane');
    test.skip(!fs.existsSync(path.join(DIST_CHROME, 'manifest.json')), 'dist/boxing-chrome not built');

    const testBuild = makeGrantedChromeBuild();
    const { ctx, profile } = await launchExtension(testBuild);
    const apiCalls: BgCall[] = [];
    await ctx.route('https://api.github.com/**', async (route: any) => {
      const req = route.request();
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers())) headers[k] = String(v);
      apiCalls.push({
        url: req.url(),
        method: req.method(),
        headers,
        body: req.postData() || null,
      });
      if (req.method() === 'GET' && req.url().endsWith('/user')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ login: 'spec-user', id: 42 }) });
        return;
      }
      if (req.method() === 'GET' && req.url().includes('/gists?per_page=')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      if (req.method() === 'POST' && req.url().endsWith('/gists')) {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'abc12345',
            files: { [GIST_FILE]: { filename: GIST_FILE, size: 123 } },
            owner: { login: 'spec-user', id: 42 },
            created_at: '2026-11-16T00:00:00Z',
            updated_at: '2026-11-16T00:00:00Z',
          }),
        });
        return;
      }
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });

    try {
      const sw = await seedRealExtension(ctx, TOKEN);
      const run = await sw.evaluate(async () => {
        const bg = (self as any).__boxingBgAutoBackup;
        const res = await bg.runBackgroundLocalAutoBackup({ trigger: 'alarm', forceImmediate: true });
        const all = await chrome.storage.local.get(null);
        const snapKeys = Object.keys(all).filter((k) => k.startsWith('snap.v1.') && k !== 'snap.v1.index');
        return {
          res,
          state: all.autoBackupState,
          layout: all.boxingLayout,
          snapJson: snapKeys.map((k) => JSON.stringify(all[k])).join('\n'),
          badge: await chrome.action.getBadgeText({}),
        };
      });

      expect(run.res.ok).toBe(true);
      expect(apiCalls.filter((c) => c.method === 'POST')).toHaveLength(1);
      expect(apiCalls.filter((c) => c.method === 'GET' && c.url.endsWith('/user'))).toHaveLength(1);
      expect(apiCalls.filter((c) => c.method === 'GET' && c.url.includes('/gists?per_page='))).toHaveLength(1);
      const post = apiCalls.find((c) => c.method === 'POST')!;
      expect(post.headers.authorization || post.headers.Authorization).toContain(TOKEN);
      expect(post.body).not.toContain(TOKEN);
      const body = JSON.parse(post.body!);
      expect(Object.keys(body.files)).toEqual([GIST_FILE]);
      expect(JSON.parse(body.files[GIST_FILE].content).settings._encGistToken).toBeUndefined();

      expect(run.state.remote.status).toBe('ok');
      expect(run.state.remote.baseline).toMatchObject({
        service: 'gist',
        gistId: 'abc12345',
        ownerLogin: 'spec-user',
        ownerId: 42,
        fileName: GIST_FILE,
      });
      expect(run.state.remote.lastSuccessAt).toBeGreaterThan(0);
      expect(run.badge).toBe('');
      expect(run.snapJson).not.toContain(TOKEN);
      expect(run.snapJson).not.toContain('_encGistToken');
      // Background did not mutate the layout (the NTP page is closed).
      expect(run.layout.settings.gistId).toBeFalsy();
    } finally {
      await ctx.close().catch(() => {});
      fs.rmSync(profile, { recursive: true, force: true });
      fs.rmSync(testBuild, { recursive: true, force: true });
    }
  });
});
