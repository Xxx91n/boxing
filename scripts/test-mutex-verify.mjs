#!/usr/bin/env node
/**
 * Ticket 25 (architecture-recovery): programmatic verification gate for scripts/test-mutex.mjs.
 *
 * Verifies (externally observable behavior, no self-reported pass):
 * 1. Dry run prints target command and leaves no lock behind.
 * 2. A second concurrent process is rejected immediately (exit 75) with a
 *    diagnostic that names the holding PID.
 * 3. A lock whose holder PID is dead is detected stale and recovered.
 * 4. Wait mode (--wait) blocks until the first process releases, then runs.
 * 5. CI bypass ignores a held lock and executes the target directly.
 */
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const mutexScript = path.join(root, 'scripts', 'test-mutex.mjs');
const testLockDir = path.join(root, '.test-mutex-verify-' + process.pid);
const probeScript = path.join(os.tmpdir(), 'boxing-mutex-probe-' + process.pid + '.mjs');
const markerFile = path.join(os.tmpdir(), 'boxing-mutex-marker-' + process.pid + '.txt');

function clean() {
  if (existsSync(testLockDir)) rmSync(testLockDir, { recursive: true, force: true });
  if (existsSync(probeScript)) rmSync(probeScript, { force: true });
  if (existsSync(markerFile)) rmSync(markerFile, { force: true });
}

clean();

try {
  console.log('[mutex-verify] 1. Testing dry run...');
  const r1 = spawnSync(process.execPath, [mutexScript], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TEST_MUTEX_DRY_RUN: '1', TEST_MUTEX_DIR: testLockDir, CI: '' }
  });
  assert.strictEqual(r1.status, 0, 'dry-run should exit 0');
  assert(r1.stdout.includes('test-surface.mjs'), 'dry-run should target test-surface.mjs by default');
  assert(!existsSync(testLockDir), 'dry-run should not leave lock directory');
  console.log('  PASS: dry run operates cleanly');

  console.log('[mutex-verify] 2. Testing collision rejection (exit 75)...');
  mkdirSync(testLockDir);
  writeFileSync(path.join(testLockDir, 'lock.json'), JSON.stringify({
    pid: process.pid,
    createdAt: Date.now(),
    command: 'primary-holder'
  }), 'utf8');

  const r2 = spawnSync(process.execPath, [mutexScript, 'changed'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TEST_MUTEX_DIR: testLockDir, CI: '', TEST_MUTEX_DRY_RUN: '' }
  });
  assert.strictEqual(r2.status, 75, 'second concurrent process must be rejected with 75 (EX_TEMPFAIL)');
  assert(r2.stderr.includes('PID ' + process.pid), 'error message must name the holding PID');
  assert(r2.stderr.includes('concurrent test execution is disabled'), 'must explain mutual exclusion');
  console.log('  PASS: second concurrent process rejected immediately with status 75');

  console.log('[mutex-verify] 3. Testing dead PID stale lock recovery...');
  writeFileSync(path.join(testLockDir, 'lock.json'), JSON.stringify({
    pid: 99999999,
    createdAt: Date.now() - 10000,
    command: 'dead-holder'
  }), 'utf8');

  const moduleUrl = pathToFileURL(path.join(root, 'scripts', 'test-mutex.mjs')).href;
  const { isLockStale, acquireLock, releaseLock, readLockInfo } = await import(moduleUrl);
  const staleCheck = isLockStale(testLockDir);
  assert.strictEqual(staleCheck.stale, true, 'dead PID must be marked stale');

  const acq = acquireLock(testLockDir, { test: 'stale-recover' });
  assert.strictEqual(acq.ok, true, 'stale lock should be acquired cleanly');
  assert.strictEqual(acq.recovered, true, 'acquire should report recovered=true');

  const lockInfo = readLockInfo(testLockDir);
  assert.strictEqual(lockInfo.pid, process.pid, 'new holder PID must be process.pid');

  const busyAcq = acquireLock(testLockDir);
  assert.strictEqual(busyAcq.ok, false, 'second acquire while held must fail');
  assert.strictEqual(busyAcq.busy, true, 'second acquire must report busy');

  releaseLock(testLockDir);
  assert(!existsSync(testLockDir), 'lock directory must be deleted on release');
  console.log('  PASS: dead PID stale lock recovered and released');

  // Probe payload: writes marker, exits 0. Real execution target for tests 4/5.
  const probeLines = [
    "import { writeFileSync } from 'node:fs';",
    "writeFileSync(process.argv[2], 'probe-ran');",
    "",
  ];
  const writeProbe = () => writeFileSync(probeScript, probeLines.join(String.fromCharCode(10)), 'utf8');

  console.log('[mutex-verify] 4. Testing wait mode blocking until release...');
  clean();
  writeProbe();
  mkdirSync(testLockDir);
  writeFileSync(path.join(testLockDir, 'lock.json'), JSON.stringify({
    pid: process.pid,
    createdAt: Date.now(),
    command: 'primary-holder'
  }), 'utf8');

  const waitPromise = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [mutexScript, '--wait', probeScript, markerFile], {
      cwd: root,
      env: { ...process.env, TEST_MUTEX_DIR: testLockDir, CI: '', TEST_MUTEX_POLL_MS: '150' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => out += d);
    let released = false;
    const releaseTimer = setTimeout(() => {
      released = true;
      rmSync(testLockDir, { recursive: true, force: true });
    }, 1000);
    const earlyCheck = setTimeout(() => {
      if (!released && existsSync(markerFile)) {
        clearTimeout(releaseTimer);
        reject(new Error('wait child executed before lock release'));
      }
    }, 500);
    child.on('close', code => {
      clearTimeout(releaseTimer);
      clearTimeout(earlyCheck);
      if (code === 0) resolve(out);
      else reject(new Error('wait child exited with ' + code + ': ' + out));
    });
  });

  await waitPromise;
  assert(existsSync(markerFile), 'target must run after lock release');
  assert(!existsSync(testLockDir), 'lock must be released after target completes');
  console.log('  PASS: process waited and succeeded once lock was freed');

  console.log('[mutex-verify] 5. Testing CI bypass ignores a held lock...');
  clean();
  writeProbe();
  mkdirSync(testLockDir);
  writeFileSync(path.join(testLockDir, 'lock.json'), JSON.stringify({
    pid: process.pid,
    createdAt: Date.now(),
    command: 'primary-holder'
  }), 'utf8');

  const rCI = spawnSync(process.execPath, [mutexScript, probeScript, markerFile], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TEST_MUTEX_DIR: testLockDir, CI: 'true' }
  });
  assert.strictEqual(rCI.status, 0, 'CI bypass must execute target successfully');
  assert(existsSync(markerFile), 'CI bypass target must have run');
  assert(existsSync(testLockDir), 'CI bypass must not touch the held lock directory');
  console.log('  PASS: CI bypass executes directly without acquiring the local mutex');

  console.log('\n[mutex-verify] ALL 5 PROGRAMMATIC TESTS PASSED VERIFIED.');
} finally {
  clean();
}
