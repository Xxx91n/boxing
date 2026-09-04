#!/usr/bin/env node
/**
 * Ticket 20 (architecture-recovery): changed-surface test selection.
 *
 * Minimal model approved by ticket 19 research (research-report-round4.md §5):
 * file-level spec-cluster mapping + native Playwright filtering, with the full
 * suite as the conservative fallback. Zero new dependencies.
 *
 * The mapping file test/cluster-map.json is owned by ticket 21 (import graph
 * guard + spec cluster mapping); this selector only consumes it. Schema:
 * { specDirectory, fallback: { minimumFullSuiteSpecs }, clusters:
 *   { "<repo-relative module>": ["<spec file>", ...] } }
 *
 * Conservative rules — any of these means the FULL suite, never a silent skip:
 * - test/, .github/, or package(.lock).json changes;
 * - the mapping file is missing or malformed;
 * - a changed file maps to no cluster (ambiguous closure: ntp.css,
 *   background.js, manifest.json, index.html, ...);
 * - the union of matched specs reaches minimumFullSuiteSpecs (a closure that
 *   already touches half the suite runs the full suite — selecting it has no
 *   benefit and reintroduces entry-like ambiguity);
 * - failure history (--last-failed) is never used for selection.
 *
 * Local web-ext junction pointers (dev-chrome, dev-firefox) are ignored:
 * they are local dev conveniences re-created by npm run dev:* in parallel
 * windows and are never consumed by tests (EXTENSION_PATH resolves to the
 * repo root), so they carry no closure semantics.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const mappingPath = path.join(root, 'test', 'cluster-map.json');
const fullArgs = ['playwright', 'test', '--config=test/playwright.config.ts'];

function gitFiles(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const DEV_POINTERS = new Set(['dev-chrome', 'dev-firefox']);

function changedFiles() {
  const files = new Set([
    ...gitFiles(['diff', '--name-only']),
    ...gitFiles(['diff', '--cached', '--name-only']),
  ]);
  const base = process.env.GITHUB_BASE_SHA;
  if (base) {
    for (const file of gitFiles(['diff', '--name-only', `${base}...HEAD`])) files.add(file);
  }
  if (!files.size) {
    // Local post-commit verification: compare against the previous commit.
    for (const file of gitFiles(['diff', '--name-only', 'HEAD^', 'HEAD'])) files.add(file);
  }
  return [...files].filter((file) => !DEV_POINTERS.has(file));
}

function full(reason, files) {
  console.log(`[test-surface] full-suite fallback: ${reason}`);
  if (files && files.length) console.log(`[test-surface] changed files: ${files.join(', ')}`);
  return fullArgs;
}

function isFullSuiteTrigger(file) {
  return (
    file === 'package.json' ||
    file === 'package-lock.json' ||
    file.startsWith('.github/') ||
    file.startsWith('test/')
  );
}

function loadMapping() {
  if (!existsSync(mappingPath)) {
    return { error: 'test/cluster-map.json is missing (ticket 21 not landed yet)' };
  }
  try {
    const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
    const { specDirectory, fallback, clusters } = mapping ?? {};
    if (typeof specDirectory !== 'string' || !specDirectory) {
      return { error: 'mapping is missing specDirectory' };
    }
    if (!clusters || typeof clusters !== 'object' || Array.isArray(clusters)) {
      return { error: 'mapping has no clusters object' };
    }
    for (const [module, specs] of Object.entries(clusters)) {
      if (typeof module !== 'string' || !Array.isArray(specs)) {
        return { error: `cluster "${module}" does not match the {module: spec[]} schema` };
      }
      if (specs.some((spec) => typeof spec !== 'string')) {
        return { error: `cluster "${module}" contains a non-string spec` };
      }
    }
    const minimum = Number(fallback?.minimumFullSuiteSpecs);
    return {
      specDirectory,
      clusters,
      minimum: Number.isFinite(minimum) ? minimum : 0,
    };
  } catch (error) {
    return { error: `invalid mapping JSON (${error.message})` };
  }
}

function select(files, mapping) {
  const { error, specDirectory, clusters, minimum } = mapping;
  if (error) return full(error, files);
  if (!files.length) return full('no changed-file baseline is available', files);

  const specs = new Set();
  for (const file of files) {
    if (isFullSuiteTrigger(file)) {
      return full(`configuration/test change requires the full suite (${file})`, files);
    }
    const cluster = clusters[file];
    if (!cluster) {
      return full(`unmapped leaf: ${file} (ambiguous closure -> full suite)`, files);
    }
    for (const spec of cluster) specs.add(`${specDirectory}/${spec}`);
  }
  if (!specs.size) return full('matched clusters declare no specs', files);
  if (minimum > 0 && specs.size >= minimum) {
    return full(
      `matched ${specs.size} spec(s) >= minimumFullSuiteSpecs=${minimum} (closure already spans half the suite -> full suite)`,
      files,
    );
  }
  const sorted = [...specs].sort();
  console.log(`[test-surface] bounded subset (${sorted.length} spec(s)): ${sorted.join(', ')}`);
  return [...fullArgs, ...sorted];
}

const files = changedFiles();
// Pass-through: extra CLI args after the npm `--` separator (e.g.
// `npm run test:changed -- --project=chromium-extension`) reach Playwright
// unchanged; the selection itself is never influenced by them.
const passthrough = process.argv.slice(2);
const args = [...select(files, loadMapping()), ...passthrough];
if (process.env.TEST_SURFACE_DRY_RUN === '1') {
  console.log(`npx ${args.join(' ')}`);
  process.exit(0);
}
const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
