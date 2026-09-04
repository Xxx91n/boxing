#!/usr/bin/env node
/**
 * Ticket 25 (architecture-recovery): zero-dependency local test-process mutex.
 *
 * Implements a cross-process lock around local test execution so parallel
 * agent windows cannot launch overlapping headed browser suites and starve the
 * host (round 5 spec §Implementation Decisions, report §5.3, ticket 01 lesson).
 *
 * Design:
 * - Mutex mechanism: atomic directory creation via fs.mkdirSync(lockDir).
 *   Works atomically across Windows, macOS, and Linux without platform locks.
 * - Lock payload: pid, ppid, createdAt, command, host, argv written inside.
 * - Stale lock recovery:
 *     1. If the recorded PID is no longer running (process.kill(pid, 0) fails
 *        with ESRCH), the previous holder died uncleanly -> lock stolen.
 *     2. If the lock directory is older than TEST_MUTEX_STALE_MS (default: 30 min,
 *        matching workflow timeout), it is considered abandoned -> lock stolen.
 * - Concurrency policy:
 *     1. Default non-blocking mode: second process is observably rejected immediately
 *        with exit code 75 (EX_TEMPFAIL / lock busy) and actionable error diagnostics
 *        naming the holder PID, age, and lock path.
 *     2. Blocking mode (TEST_MUTEX_WAIT=1 / --wait / -w): process polls every
 *        TEST_MUTEX_POLL_MS (default 500ms) up to TEST_MUTEX_TIMEOUT_MS (default 300s).
 * - CI bypass:
 *     When process.env.CI is truthy, the mutex is bypassed entirely because
 *     GitHub Actions runners allocate dedicated single-job VMs where cross-process
 *     oversubscription does not exist.
 * - Dry run:
 *     TEST_MUTEX_DRY_RUN=1 prints the wrapped command and exit-status behavior
 *     without spawning the target or acquiring a lingering lock.
 * - Signal hygiene:
 *     SIGINT / SIGTERM / SIGHUP / uncaughtException / exit hooks remove the lockDir.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
export const DEFAULT_LOCK_DIR = path.join(root, '.test-mutex');

const STALE_MS = Number(process.env.TEST_MUTEX_STALE_MS) || 30 * 60 * 1000;
const WAIT_TIMEOUT_MS = Number(process.env.TEST_MUTEX_TIMEOUT_MS) || 300 * 1000;
const POLL_INTERVAL_MS = Number(process.env.TEST_MUTEX_POLL_MS) || 500;

export function isPidAlive(pid) {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means process exists but belongs to another user (still alive).
    // ESRCH means process does not exist.
    return err && err.code === 'EPERM';
  }
}

export function readLockInfo(lockDir = DEFAULT_LOCK_DIR) {
  const metaFile = path.join(lockDir, 'lock.json');
  try {
    const raw = readFileSync(metaFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    try {
      const st = statSync(lockDir);
      return { createdAt: st.mtimeMs, pid: null, fallback: true };
    } catch {
      return null;
    }
  }
}

export function isLockStale(lockDir = DEFAULT_LOCK_DIR, maxAgeMs = STALE_MS) {
  if (!existsSync(lockDir)) return false;
  const info = readLockInfo(lockDir);
  const now = Date.now();
  const age = info && info.createdAt ? now - Number(info.createdAt) : maxAgeMs + 1;
  if (age > maxAgeMs) {
    return { stale: true, reason: 'age ' + Math.round(age / 1000) + 's exceeds ' + Math.round(maxAgeMs / 1000) + 's', info };
  }
  if (info && typeof info.pid === 'number' && !isPidAlive(info.pid)) {
    return { stale: true, reason: 'holding PID ' + info.pid + ' is dead', info };
  }
  return { stale: false, age, info };
}

export function forceReleaseLock(lockDir = DEFAULT_LOCK_DIR) {
  try {
    rmSync(lockDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(lockDir = DEFAULT_LOCK_DIR, meta = {}) {
  try {
    mkdirSync(lockDir);
    const payload = {
      pid: process.pid,
      ppid: process.ppid,
      createdAt: Date.now(),
      createdAtIso: new Date().toISOString(),
      argv: process.argv.slice(2),
      ...meta,
    };
    try {
      writeFileSync(path.join(lockDir, 'lock.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
    } catch {
      // metadata write failure is non-fatal; directory existence holds the lock
    }
    return { ok: true, payload };
  } catch (err) {
    if (err && (err.code === 'EEXIST' || err.code === 'EACCES')) {
      const check = isLockStale(lockDir);
      if (check.stale) {
        forceReleaseLock(lockDir);
        try {
          mkdirSync(lockDir);
          const payload = {
            pid: process.pid,
            ppid: process.ppid,
            createdAt: Date.now(),
            createdAtIso: new Date().toISOString(),
            recoveredFrom: check.info || null,
            staleReason: check.reason,
            ...meta,
          };
          writeFileSync(path.join(lockDir, 'lock.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
          return { ok: true, payload, recovered: true };
        } catch {
          return { ok: false, busy: true, err };
        }
      }
      return { ok: false, busy: true, info: check.info, age: check.age };
    }
    return { ok: false, err };
  }
}

export function acquireLockWithWait(lockDir = DEFAULT_LOCK_DIR, meta = {}, timeoutMs = WAIT_TIMEOUT_MS, pollMs = POLL_INTERVAL_MS) {
  const start = Date.now();
  while (true) {
    const res = acquireLock(lockDir, meta);
    if (res.ok) return res;
    if (!res.busy) return res;
    if (Date.now() - start >= timeoutMs) {
      return { ok: false, timedOut: true, timeoutMs, info: res.info };
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pollMs);
  }
}

export function releaseLock(lockDir = DEFAULT_LOCK_DIR) {
  const info = readLockInfo(lockDir);
  // Only the owner process (or dead owner) should release.
  if (info && typeof info.pid === 'number' && info.pid !== process.pid) {
    if (isPidAlive(info.pid)) return false;
  }
  return forceReleaseLock(lockDir);
}

// CLI execution path
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isDirectExecution) {
  let rawArgs = process.argv.slice(2);
  const lockDir = process.env.TEST_MUTEX_DIR ? path.resolve(process.env.TEST_MUTEX_DIR) : DEFAULT_LOCK_DIR;

  // Flags parsed by wrapper before forwarding:
  //   --wait / -w -> block until lock free
  //   --no-wait   -> reject immediately if busy (default)
  let waitMode = process.env.TEST_MUTEX_WAIT === '1';
  const commandArgs = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--wait' || a === '-w') {
      waitMode = true;
    } else if (a === '--no-wait') {
      waitMode = false;
    } else {
      commandArgs.push(a);
    }
  }

  // Determine sub-command to execute.
  // Default target is changed-surface runner: node scripts/test-surface.mjs
  // If arguments start with "all" or "full", invokes full suite: npx playwright test --config=test/playwright.config.ts
  // Otherwise if first argument is a command/script, executes it; else forwards args to test-surface.mjs.
  let spawnCmd;
  let spawnArgs;

  if (commandArgs.length === 0) {
    spawnCmd = process.execPath;
    spawnArgs = [path.join(root, 'scripts', 'test-surface.mjs')];
  } else if (commandArgs[0] === 'full' || commandArgs[0] === 'all') {
    spawnCmd = 'npx';
    spawnArgs = ['playwright', 'test', '--config=test/playwright.config.ts', ...commandArgs.slice(1)];
  } else if (commandArgs[0] === 'changed') {
    spawnCmd = process.execPath;
    spawnArgs = [path.join(root, 'scripts', 'test-surface.mjs'), ...commandArgs.slice(1)];
  } else if (commandArgs[0].endsWith('.mjs') || commandArgs[0].endsWith('.js')) {
    spawnCmd = process.execPath;
    spawnArgs = [...commandArgs];
  } else if (commandArgs[0] === 'playwright') {
    spawnCmd = 'npx';
    spawnArgs = [...commandArgs];
  } else {
    // Default pass-through to test-surface (e.g. node scripts/test-mutex.mjs -- --project=chromium-extension)
    spawnCmd = process.execPath;
    spawnArgs = [path.join(root, 'scripts', 'test-surface.mjs'), ...commandArgs];
  }

  if (process.env.TEST_MUTEX_DRY_RUN === '1') {
    console.log('[test-mutex:dry-run] lockDir=' + lockDir + ' wait=' + waitMode + ' cmd=' + spawnCmd + ' args=' + spawnArgs.join(' '));
    process.exit(0);
  }

  // CI bypass
  if (process.env.CI) {
    const result = spawnSync(spawnCmd, spawnArgs, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32' && spawnCmd === 'npx',
    });
    process.exit(result.status ?? 1);
  }

  // Acquire lock
  const meta = {
    command: spawnCmd,
    subArgs: spawnArgs,
    startedAt: new Date().toISOString(),
  };

  const acquired = waitMode
    ? acquireLockWithWait(lockDir, meta)
    : acquireLock(lockDir, meta);

  if (!acquired.ok) {
    if (acquired.timedOut) {
      console.error('[test-mutex] error: timed out waiting for test lock after ' + (acquired.timeoutMs / 1000) + 's');
    } else if (acquired.busy) {
      const holder = acquired.info;
      const pidStr = holder && holder.pid ? ('PID ' + holder.pid) : 'another process';
      const ageStr = acquired.age ? (' (held for ' + Math.round(acquired.age / 1000) + 's)') : '';
      console.error('[test-mutex] error: test process lock is currently held by ' + pidStr + ageStr + '.');
      console.error('[test-mutex] concurrent test execution is disabled to protect host resources.');
      console.error('[test-mutex] lock directory: ' + lockDir);
      console.error('[test-mutex] to wait for the lock: rerun with --wait, or pass TEST_MUTEX_WAIT=1');
      console.error('[test-mutex] to force clear a stale lock: node -e "require(\'fs\').rmSync(\'' + lockDir.replace(/\\/g, '/') + '\', {recursive:true,force:true})"');
    } else {
      console.error('[test-mutex] error acquiring lock: ' + (acquired.err?.message || 'unknown error'));
    }
    process.exit(75); // EX_TEMPFAIL
  }

  if (acquired.recovered) {
    console.log('[test-mutex] recovered stale lock (' + acquired.payload.staleReason + ')');
  }

  let released = false;
  function cleanup() {
    if (released) return;
    released = true;
    releaseLock(lockDir);
  }

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  if (process.platform !== 'win32') {
    process.on('SIGHUP', () => { cleanup(); process.exit(129); });
  }

  try {
    const result = spawnSync(spawnCmd, spawnArgs, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32' && spawnCmd === 'npx',
    });
    cleanup();
    process.exit(result.status ?? 1);
  } catch (err) {
    cleanup();
    console.error('[test-mutex] execution error: ' + err.message);
    process.exit(1);
  }
}
