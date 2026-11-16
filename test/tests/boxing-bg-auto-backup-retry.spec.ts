// Boxing — issue #130 (spec #120 T10): bounded retry, immediate off switch and
// unknown-result recovery for the background auto-backup.
//
// The real background.js runs in a Node VM with a fake chrome.* API and a controlled
// WebDAV/Gist service that records every request. Every case asserts the requests the
// server actually saw and the persisted state a worker restart would read, not the
// presence of a timer helper.
import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const WEBDAV_BASE = 'https://dav.boxing-test.invalid/dav/';
const WEBDAV_FILE_URL = WEBDAV_BASE + 'boxing-backup.json';
const GIST_FILE = 'boxing-backup.json';
const ACCOUNT = 'alice';

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
      webdavUser: ACCOUNT,
      _encWebdavPass: 'secret-pass',
      autoBackupInterval: 3600,
      lastBackupAt: 0,
      syncLevel: 'full',
      syncFileName: 'boxing-backup.json',
      ...(overrides.settings || {}),
    },
    _meta: { revision: 3, updatedAt: 1_700_000_000_000, writerId: 'seed' },
    ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'settings')),
  };
}

function seedState(overrides: Record<string, any> = {}) {
  return {
    version: 1,
    optIn: true,
    intervalSec: 3600,
    epoch: 7,
    nextScheduledAt: 0,
    updatedAt: 1_700_000_000_000,
    local: { status: 'idle', lastAttemptAt: 0, lastSuccessAt: 0, lastSnapshotTs: 0, lastError: null },
    remote: { status: 'idle', lastAttemptAt: 0, lastSuccessAt: 0, lastErrorCode: null, baseline: null },
    retry: { attempt: 0, nextAt: 0, code: null, target: '' },
    lock: null,
    ...overrides,
  };
}

function abortError() {
  const e: any = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}

function waitForAbort(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) return reject(abortError());
    signal.addEventListener('abort', () => reject(abortError()), { once: true });
  });
}

interface WebdavOptions {
  existingBody?: string | null;
  existingEtag?: string;
  getBehavior?: 'ok' | 'throw' | '401' | '503' | '423';
  getHangs?: boolean;
  retryAfter?: string;
  putBehavior?: 'ok' | '409' | '409-locked' | 'lost-response';
  putHangs?: boolean;
  /** Fixed status for every PUT (used to exercise the probe sibling). */
  putStatus?: number;
  putRetryAfter?: string;
  omitPutEtag?: boolean;
}

interface WorldOptions {
  webdav?: WebdavOptions;
  gist?: {
    enabled?: boolean;
    list?: any[];
    user?: any;
    /** Records the POST but returns nothing, like a response lost after commit. */
    postLost?: boolean;
  };
}

interface Req {
  method: string;
  url: string;
  ifMatch: string;
  ifNoneMatch: string;
  body: string;
}

function createWorld(opts: WorldOptions = {}) {
  const wd = opts.webdav || {};
  const files = new Map<string, string>();
  const etags = new Map<string, string>();
  if (wd.existingBody != null) {
    files.set(WEBDAV_FILE_URL, wd.existingBody);
    etags.set(WEBDAV_FILE_URL, wd.existingEtag || '"v1"');
  }
  const requests: Req[] = [];
  const gistCalls: Req[] = [];
  const gists = [...(opts.gist && Array.isArray(opts.gist.list) ? opts.gist.list : [])];
  let putCount = 0;
  let etagSeq = 1;

  function headerOf(headers: any, name: string): string {
    if (!headers) return '';
    if (typeof headers.get === 'function') return headers.get(name) || '';
    return String(headers[name] || headers[name.toLowerCase()] || '');
  }

  async function fetchImpl(input: any, init: any = {}) {
    const url = typeof input === 'string' ? input : String(input && input.url);
    const method = String((init && init.method) || 'GET').toUpperCase();
    const req: Req = {
      method,
      url,
      ifMatch: headerOf(init.headers, 'If-Match'),
      ifNoneMatch: headerOf(init.headers, 'If-None-Match'),
      body: typeof init.body === 'string' ? init.body : '',
    };

    if (url.startsWith('https://api.github.com')) {
      gistCalls.push(req);
      if (method === 'GET' && /\/user$/.test(url)) {
        return new Response(JSON.stringify(opts.gist?.user || { login: 'spec-user', id: 42 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'GET' && url.includes('/gists?')) {
        return new Response(JSON.stringify(gists), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'POST' && /\/gists$/.test(url)) {
        if (opts.gist?.postLost) {
          await waitForAbort(init.signal);
        }
        return new Response(JSON.stringify({ id: 'newgist01', files: {} }), { status: 201 });
      }
      return new Response(null, { status: 404 });
    }

    requests.push(req);

    if (method === 'GET') {
      if (wd.getHangs) await waitForAbort(init.signal);
      if (wd.getBehavior === 'throw') throw new TypeError('network down');
      if (wd.getBehavior === '401') return new Response(null, { status: 401 });
      if (wd.getBehavior === '423') return new Response(null, { status: 423 });
      if (wd.getBehavior === '503') {
        const headers: Record<string, string> = {};
        if (wd.retryAfter) headers['Retry-After'] = wd.retryAfter;
        return new Response(null, { status: 503, headers });
      }
      if (files.has(url)) {
        return new Response(files.get(url), {
          status: 200,
          headers: { ETag: etags.get(url) || '"v1"' },
        });
      }
      return new Response(null, { status: 404 });
    }

    if (method === 'DELETE') {
      files.delete(url);
      etags.delete(url);
      return new Response(null, { status: 204 });
    }

    if (method === 'PUT') {
      putCount += 1;
      if (wd.putHangs) await waitForAbort(init.signal);
      if (wd.putBehavior === 'lost-response') {
        // The server really commits the bytes, then the response never arrives. This is
        // the exact case where an abort must NOT be read as "the server rolled back".
        files.set(url, req.body);
        etags.set(url, '"lost-1"');
        await waitForAbort(init.signal);
      }
      if (wd.putStatus) {
        const headers: Record<string, string> = {};
        if (wd.putRetryAfter) headers['Retry-After'] = wd.putRetryAfter;
        return new Response(null, { status: wd.putStatus, headers });
      }
      if (wd.putBehavior === '409') return new Response(null, { status: 409 });
      if (wd.putBehavior === '409-locked') return new Response(null, { status: 423 });
      if (req.ifNoneMatch === '*' && files.has(url)) return new Response(null, { status: 412 });
      if (req.ifMatch && (etags.get(url) || '"v1"') !== req.ifMatch) {
        return new Response(null, { status: 412 });
      }
      const existed = files.has(url);
      files.set(url, req.body);
      const nextEtag = existed ? '"updated-' + (++etagSeq) + '"' : '"created-1"';
      etags.set(url, nextEtag);
      return new Response(null, {
        status: existed ? 204 : 201,
        headers: wd.omitPutEtag ? {} : { ETag: nextEtag },
      });
    }

    return new Response(null, { status: 405 });
  }

  return {
    files,
    etags,
    requests,
    gistCalls,
    gists,
    fetch: fetchImpl,
    get putCount() { return putCount; },
  };
}

function createSandbox(options: {
  world: ReturnType<typeof createWorld>;
  layout?: any;
  state?: any;
  permissionGranted?: boolean;
}) {
  const store: Record<string, any> = {
    boxingLayout: options.layout || seedLayout(),
    autoBackupState: options.state || seedState(),
  };
  let onAlarm: ((alarm: any) => void) | null = null;
  const alarmCreateCalls: Array<{ name: string; info: any }> = [];
  const alarmClearCalls: string[] = [];
  const alarms = new Map<string, any>();
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
      get: (name: string) => Promise.resolve(alarms.get(name) || null),
      create: (name: string, info: any) => {
        alarmCreateCalls.push({ name, info });
        alarms.set(name, { name, ...info });
        return Promise.resolve();
      },
      clear: (name: string) => {
        alarmClearCalls.push(name);
        alarms.delete(name);
        return Promise.resolve(true);
      },
      onAlarm: { addListener: (fn: any) => { onAlarm = fn; } },
    },
    action: {
      setBadgeText: (details: any) => {
        badgeCalls.push(details && details.text ? details.text : '');
        return Promise.resolve();
      },
      setBadgeBackgroundColor: () => Promise.resolve(),
    },
    permissions: {
      contains: (details: any, cb?: (granted: boolean) => void) => {
        const granted = options.permissionGranted !== false;
        if (typeof cb === 'function') { cb(granted); return undefined; }
        return Promise.resolve(granted);
      },
    },
    runtime: {
      id: 'spec-ext-id',
      getURL: (p: string) => 'chrome-extension://spec-ext-id/' + p,
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      onMessage: { addListener: () => {} },
      lastError: null,
    },
  };

  const sandbox: any = {
    chrome: chromeMock,
    fetch: options.world.fetch,
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
    Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Error, Set, Map,
    WeakSet, WeakMap, URL, Promise, TypeError, DOMException,
    importScripts: (relPath: string) => {
      const code = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
      vm.runInContext(code, sandbox, { filename: relPath });
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT_DIR, 'background.js'), 'utf8'), sandbox, {
    filename: 'background.js',
  });

  return {
    store,
    sandbox,
    bg: sandbox.__boxingBgAutoBackup,
    get onAlarm() { return onAlarm; },
    alarmCreateCalls,
    alarmClearCalls,
    badges: badgeCalls,
    readState() {
      return sandbox.__boxingSnapshotCore.normalizeAutoBackupState(store.autoBackupState);
    },
  };
}

function minutesFrom(deltaMs: number) {
  return deltaMs / 60000;
}

test.describe('Ticket #130 — bounded retry and off switch (controlled service)', () => {
  test.setTimeout(90_000);

  test('network-only failure retries after about 5 / 15 / 60 minutes and then waits for the normal cycle', async () => {
    const world = createWorld({ webdav: { getBehavior: 'throw' } });
    const env = createSandbox({ world });

    const before = Date.now();
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const afterFirst = env.readState();
    expect(afterFirst.remote.lastErrorCode).toBe('remote-unreachable');
    expect(afterFirst.retry.attempt).toBe(1);
    // Jitter is +/-10% of the base delay, so the plan lands between 4.5 and 5.5 min.
    expect(minutesFrom(afterFirst.retry.nextAt - before)).toBeGreaterThan(4.3);
    expect(minutesFrom(afterFirst.retry.nextAt - before)).toBeLessThan(5.7);
    expect(env.alarmCreateCalls.some((c) => c.name === 'boxing-auto-backup-retry')).toBe(true);

    // A retry alarm that fires too early sends nothing.
    const requestsBeforeEarly = world.requests.length;
    const early = await env.bg.runBackgroundLocalAutoBackup({ trigger: 'retry' });
    expect(early.skipped).toBe(true);
    expect(early.reason).toBe('retry-not-due');
    expect(world.requests.length).toBe(requestsBeforeEarly);

    // Second failure, 15 minutes after that failure.
    let state = env.readState();
    env.store.autoBackupState = {
      ...env.store.autoBackupState,
      retry: { ...state.retry, nextAt: Date.now() - 1000 },
    };
    const secondBefore = Date.now();
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'retry' });
    state = env.readState();
    expect(state.retry.attempt).toBe(2);
    expect(minutesFrom(state.retry.nextAt - secondBefore)).toBeGreaterThan(13);
    expect(minutesFrom(state.retry.nextAt - secondBefore)).toBeLessThan(17);

    // Third failure, 60 minutes after that failure.
    env.store.autoBackupState = {
      ...env.store.autoBackupState,
      retry: { ...env.readState().retry, nextAt: Date.now() - 1000 },
    };
    const thirdBefore = Date.now();
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'retry' });
    state = env.readState();
    expect(state.retry.attempt).toBe(3);
    expect(minutesFrom(state.retry.nextAt - thirdBefore)).toBeGreaterThan(52);
    expect(minutesFrom(state.retry.nextAt - thirdBefore)).toBeLessThan(68);

    // A fourth failure is the last one: no plan, only the user's normal cycle remains.
    env.store.autoBackupState = {
      ...env.store.autoBackupState,
      retry: { ...env.readState().retry, nextAt: Date.now() - 1000 },
    };
    const fourthBefore = Date.now();
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'retry' });
    state = env.readState();
    expect(state.retry.attempt).toBe(0);
    expect(state.retry.nextAt).toBe(0);
    expect(state.retry.code).toBeNull();
    expect(minutesFrom(state.nextScheduledAt - fourthBefore)).toBeGreaterThan(59);
    expect(minutesFrom(state.nextScheduledAt - fourthBefore)).toBeLessThan(61);
    // Exactly four network attempts in total: the first run plus three extra ones.
    expect(world.requests.filter((r) => r.method === 'GET').length).toBe(4);
  });

  test('Retry-After is never undercut by the fixed delay', async () => {
    const world = createWorld({ webdav: { getBehavior: '503', retryAfter: '900' } });
    const env = createSandbox({ world });

    const before = Date.now();
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    expect(state.remote.status).toBe('error');
    expect(state.retry.attempt).toBe(1);
    expect(state.retry.nextAt - before).toBeGreaterThanOrEqual(900_000);
  });

  test('auth failure and a conflicting create never plan a retry', async () => {
    const authWorld = createWorld({ webdav: { getBehavior: '401' } });
    const authEnv = createSandbox({ world: authWorld });
    await authEnv.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    let state = authEnv.readState();
    expect(state.remote.lastErrorCode).toBe('auth-failed');
    expect(state.retry.nextAt).toBe(0);
    expect(authEnv.alarmCreateCalls.filter((c) => c.name === 'boxing-auto-backup-retry')).toHaveLength(0);

    const conflictWorld = createWorld({ webdav: { putBehavior: '409' } });
    const conflictEnv = createSandbox({ world: conflictWorld });
    await conflictEnv.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    state = conflictEnv.readState();
    expect(state.remote.lastErrorCode).toBe('create-conflict');
    expect(state.retry.nextAt).toBe(0);
  });

  test('a locked remote file pauses instead of burning retries', async () => {
    const world = createWorld({ webdav: { putBehavior: '409-locked' } });
    const env = createSandbox({ world });
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    expect(state.remote.lastErrorCode).toBe('remote-locked');
    expect(state.retry.nextAt).toBe(0);
  });

  test('the attempt counter survives a worker restart', async () => {
    const target = 'webdav|' + WEBDAV_FILE_URL + '|' + ACCOUNT;
    const world = createWorld({ webdav: { getBehavior: 'throw' } });
    const env = createSandbox({
      world,
      state: seedState({
        retry: {
          attempt: 2,
          nextAt: Date.now() - 1000,
          code: 'remote-unreachable',
          target,
        },
      }),
    });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'retry' });
    const state = env.readState();
    // A fresh worker read the persisted counter and continued at 3, not 1.
    expect(state.retry.attempt).toBe(3);
    expect(state.retry.target).toBe(target);
  });

  test('turning auto-backup off aborts a committed-but-unanswered PUT without waiting for it', async () => {
    const world = createWorld({ webdav: { putBehavior: 'lost-response' } });
    const env = createSandbox({ world });

    const running = env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    // Wait until the PUT has reached the service (the bytes are already stored).
    await expect.poll(() => world.files.has(WEBDAV_FILE_URL), { timeout: 5000 }).toBe(true);

    const stopPromise = env.bg.configureBackgroundAutoBackup({ optIn: false, intervalSec: 0 });
    const stopResult = await Promise.race([
      stopPromise,
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 3000)),
    ]);
    expect(stopResult, 'the off switch must not wait behind the upload').not.toBe('timeout');

    await running;
    const state = env.readState();
    expect(state.optIn).toBe(false);
    expect(state.nextScheduledAt).toBe(0);
    expect(state.local.status).toBe('cancelled');
    expect(env.alarmClearCalls).toContain('boxing-auto-backup');
    expect(env.alarmClearCalls).toContain('boxing-auto-backup-retry');
    // The request may have reached the server, so the honest record is "unknown",
    // never "cancelled" and never a fake success.
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('unknown-outcome');
    // The bytes really are on the server; nothing pretends they were rolled back.
    expect(world.files.has(WEBDAV_FILE_URL)).toBe(true);
  });

  test('turning auto-backup off before a write sends nothing and records a plain cancellation', async () => {
    const world = createWorld({ webdav: { getHangs: true } });
    const env = createSandbox({ world });

    const running = env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    await expect.poll(() => world.requests.some((r) => r.method === 'GET'), { timeout: 5000 }).toBe(true);

    const stopPromise = env.bg.configureBackgroundAutoBackup({ optIn: false, intervalSec: 0 });
    const stopResult = await Promise.race([
      stopPromise,
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 3000)),
    ]);
    expect(stopResult).not.toBe('timeout');

    await running;
    const state = env.readState();
    expect(state.optIn).toBe(false);
    expect(state.local.status).toBe('cancelled');
    expect(world.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
    // Nothing was written, so the previous cloud record is untouched.
    expect(state.remote.status).toBe('idle');
    expect(state.remote.lastErrorCode).toBeNull();
  });

  test('an unknown result is re-checked: identical remote bytes are confirmed as success', async () => {
    const env0 = createSandbox({ world: createWorld() });
    const body = env0.bg.buildWebDAVBackupBody(env0.store.boxingLayout);

    const world = createWorld({ webdav: { existingBody: body, existingEtag: '"v9"' } });
    const env = createSandbox({
      world,
      state: seedState({
        remote: {
          provider: 'webdav',
          status: 'unknown',
          lastAttemptAt: 1,
          lastSuccessAt: 0,
          lastErrorCode: 'unknown-outcome',
          baseline: {
            service: 'webdav',
            fileUrl: WEBDAV_FILE_URL,
            account: ACCOUNT,
            createdAt: 1,
            etag: '"v8"',
            version: '"v8"',
            verifiedAt: 1,
            conditionalVerifiedAt: 1,
          },
        },
      }),
    });

    const res = await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(res.remote.status).toBe('ok');
    expect(world.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
    const state = env.readState();
    expect(state.remote.status).toBe('ok');
    expect(state.remote.lastSuccessAt).toBeGreaterThan(0);
    expect(state.remote.lastErrorCode).toBeNull();
  });

  test('an unknown result with different remote bytes stays paused and sends nothing', async () => {
    const world = createWorld({
      webdav: { existingBody: JSON.stringify({ version: 3.5, boxes: [{ id: 'OTHER' }] }), existingEtag: '"v9"' },
    });
    const env = createSandbox({
      world,
      state: seedState({
        remote: {
          provider: 'webdav',
          status: 'unknown',
          lastAttemptAt: 1,
          lastSuccessAt: 0,
          lastErrorCode: 'unknown-outcome',
          baseline: {
            service: 'webdav',
            fileUrl: WEBDAV_FILE_URL,
            account: ACCOUNT,
            createdAt: 1,
            etag: '"v8"',
            version: '"v8"',
            verifiedAt: 1,
            conditionalVerifiedAt: 1,
          },
        },
      }),
    });

    const res = await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(res.remote.status).toBe('unknown');
    expect(world.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
    const state = env.readState();
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('unknown-outcome');
  });

  test('an unknown first create whose file is really absent is released and created', async () => {
    const world = createWorld();
    const env = createSandbox({
      world,
      state: seedState({
        remote: {
          provider: 'webdav',
          status: 'unknown',
          lastAttemptAt: 1,
          lastSuccessAt: 0,
          lastErrorCode: 'unknown-outcome',
          baseline: null,
        },
      }),
    });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    // The re-check found no file, so the earlier create never landed. The hold is
    // released and exactly one create is attempted.
    expect(state.remote.status).toBe('ok');
    expect(world.requests.filter((r) => r.method === 'PUT')).toHaveLength(1);
    expect(state.remote.baseline).toMatchObject({ service: 'webdav', fileUrl: WEBDAV_FILE_URL });
  });

  test('a local snapshot success never hides the cloud failure', async () => {
    const world = createWorld({ webdav: { getBehavior: 'throw' } });
    const env = createSandbox({ world });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    expect(state.local.status).toBe('ok');
    expect(state.local.lastSuccessAt).toBeGreaterThan(0);
    expect(state.remote.status).toBe('error');
    expect(state.remote.lastSuccessAt).toBe(0);
  });

  test('an interrupted Gist create is confirmed from the real list instead of creating a copy', async () => {
    const list = [
      {
        id: 'abcdef123456',
        files: { [GIST_FILE]: { filename: GIST_FILE, size: 200 } },
        owner: { login: 'spec-user', id: 42 },
        created_at: '2026-11-16T00:00:00Z',
        updated_at: '2026-11-16T00:05:00Z',
      },
    ];
    const world = createWorld({ gist: { list } });
    const env = createSandbox({
      world,
      layout: seedLayout({
        settings: {
          syncProvider: 'gist',
          _encGistToken: 'spec-token',
          gistId: '',
          syncFileName: GIST_FILE,
        },
      }),
      state: seedState({
        remote: {
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: 1,
          lastSuccessAt: 0,
          lastErrorCode: 'gistResultUnknown',
          account: { login: 'spec-user', id: 42 },
          baseline: null,
          pendingCreate: {
            provider: 'gist',
            fileName: GIST_FILE,
            description: 'Boxing backup',
            startedAt: 1_700_000_000_000,
            accountLogin: 'spec-user',
            accountId: 42,
            gistId: '',
          },
        },
      }),
    });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    expect(state.remote.status).toBe('ok');
    expect(state.remote.baseline?.gistId).toBe('abcdef123456');
    expect(state.remote.pendingCreate).toBeNull();
    // The list was read; no second Gist was created.
    expect(world.gistCalls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(world.gistCalls.some((c) => c.method === 'GET' && c.url.includes('/gists?'))).toBe(true);
  });

  test('a same-named Gist that predates the interrupted POST is not counted as success', async () => {
    const list = [
      {
        id: 'abcdef123456',
        files: { [GIST_FILE]: { filename: GIST_FILE, size: 200 } },
        owner: { login: 'spec-user', id: 42 },
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2020-01-01T00:00:00Z',
      },
    ];
    const world = createWorld({ gist: { list } });
    const env = createSandbox({
      world,
      layout: seedLayout({
        settings: {
          syncProvider: 'gist',
          _encGistToken: 'spec-token',
          gistId: '',
          syncFileName: GIST_FILE,
        },
      }),
      state: seedState({
        remote: {
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: 1,
          lastSuccessAt: 0,
          lastErrorCode: 'gistResultUnknown',
          account: { login: 'spec-user', id: 42 },
          baseline: null,
          pendingCreate: {
            provider: 'gist',
            fileName: GIST_FILE,
            description: 'Boxing backup',
            startedAt: 1_700_000_000_000,
            accountLogin: 'spec-user',
            accountId: 42,
            gistId: '',
          },
        },
      }),
    });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    // An old file with the same name is not the result of this POST; the hold stays.
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('gistResultUnknown');
    expect(world.gistCalls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  test('a same-named Gist created just before the POST started is not confirmed either', async () => {
    const startedAt = Date.now();
    const list = [
      {
        id: 'abcdef123456',
        files: { [GIST_FILE]: { filename: GIST_FILE, size: 200 } },
        owner: { login: 'spec-user', id: 42 },
        created_at: new Date(startedAt - 120_000).toISOString(),
        updated_at: new Date(startedAt - 120_000).toISOString(),
      },
    ];
    const world = createWorld({ gist: { list } });
    const env = createSandbox({
      world,
      layout: seedLayout({
        settings: {
          syncProvider: 'gist',
          _encGistToken: 'spec-token',
          gistId: '',
          syncFileName: GIST_FILE,
        },
      }),
      state: seedState({
        remote: {
          provider: 'gist',
          status: 'unknown',
          lastAttemptAt: 1,
          lastSuccessAt: 0,
          lastErrorCode: 'gistResultUnknown',
          account: { login: 'spec-user', id: 42 },
          baseline: null,
          pendingCreate: {
            provider: 'gist',
            fileName: GIST_FILE,
            description: 'Boxing backup',
            startedAt,
            accountLogin: 'spec-user',
            accountId: 42,
            gistId: '',
          },
        },
      }),
    });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('gistResultUnknown');
    expect(world.gistCalls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  test('a locked remote read pauses instead of planning retries', async () => {
    const world = createWorld({ webdav: { getBehavior: '423' } });
    const env = createSandbox({ world });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    expect(state.remote.lastErrorCode).toBe('remote-locked');
    expect(state.retry.nextAt).toBe(0);
    expect(world.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
  });

  test('a probe sibling that answers 503 keeps the server Retry-After', async () => {
    const env = createSandbox({
      world: createWorld({
        webdav: { existingBody: '{"boxes":[]}', etag: '"v1"', putStatus: 503, putRetryAfter: '1800' },
      }),
      state: seedState({
        remote: {
          provider: 'webdav',
          status: 'idle',
          lastAttemptAt: 1,
          lastSuccessAt: 1000,
          lastErrorCode: null,
          baseline: {
            service: 'webdav', fileUrl: WEBDAV_FILE_URL, account: ACCOUNT,
            createdAt: 1, etag: '"v1"', version: '"v1"', verifiedAt: 1, conditionalVerifiedAt: 0,
          },
        },
      }),
    });

    const before = Date.now();
    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const state = env.readState();
    expect(state.remote.lastErrorCode).toBe('update-failed');
    expect(state.retry.attempt).toBe(1);
    expect(state.retry.nextAt - before).toBeGreaterThanOrEqual(1_800_000);
    expect(state.remote.notBeforeAt - before).toBeGreaterThanOrEqual(1_800_000);
  });

  test('the ordinary alarm also waits for the server Retry-After window', async () => {
    const world = createWorld({ webdav: { getBehavior: '503', retryAfter: '7200' } });
    const env = createSandbox({ world });

    await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    const first = env.readState();
    expect(first.remote.notBeforeAt).toBeGreaterThan(Date.now() + 7_000_000);

    const requestsBefore = world.requests.length;
    const second = await env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe('server-wait');
    expect(world.requests.length).toBe(requestsBefore);
  });

  test('a stopped automatic result keeps a newer manual WebDAV baseline', async () => {
    const world = createWorld({ webdav: { putBehavior: 'lost-response' } });
    const env = createSandbox({ world });
    const running = env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    await expect.poll(() => world.files.has(WEBDAV_FILE_URL), { timeout: 5000 }).toBe(true);

    // A manual sync commits and advances the trusted version while the auto PUT hangs.
    env.store.autoBackupState = {
      ...env.store.autoBackupState,
      remote: {
        provider: 'webdav',
        status: 'ok',
        lastAttemptAt: 5,
        lastSuccessAt: Date.now(),
        lastErrorCode: null,
        baseline: {
          service: 'webdav', fileUrl: WEBDAV_FILE_URL, account: ACCOUNT,
          createdAt: 1, etag: '"manual-9"', version: '"manual-9"', verifiedAt: 1, conditionalVerifiedAt: 1,
        },
      },
    };
    await env.bg.configureBackgroundAutoBackup({ optIn: false, intervalSec: 0 });
    await running;

    const state = env.readState();
    expect(state.remote.baseline?.version).toBe('"manual-9"');
    expect(state.remote.status).toBe('unknown');
    expect(state.remote.lastErrorCode).toBe('unknown-outcome');
  });

  test('a queued enable cannot override a later disable', async () => {
    const world = createWorld({ webdav: { putHangs: true } });
    const env = createSandbox({ world });
    const running = env.bg.runBackgroundLocalAutoBackup({ trigger: 'alarm' });
    await expect.poll(() => world.requests.some((r) => r.method === 'PUT'), { timeout: 5000 }).toBe(true);

    const enabling = env.bg.configureBackgroundAutoBackup({ optIn: true, intervalSec: 3600 });
    await env.bg.configureBackgroundAutoBackup({ optIn: false, intervalSec: 0 });
    const enableResult = await enabling;
    await running;

    const state = env.readState();
    expect(enableResult.stale).toBe(true);
    expect(state.optIn).toBe(false);
    expect(state.nextScheduledAt).toBe(0);
  });
});