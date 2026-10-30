#!/usr/bin/env node
// CI workflow input guard (ticket 76 / spec D1, finding V-01), extended by
// ticket 77 / spec D2 (finding V-02) with "uses pinned to commit SHA" and
// "explicit workflow permissions".
//
// Contracts checked here:
//   - No `run:` block may interpolate a workflow_dispatch input expression
//     (`${{ github.event.inputs.* }}` or its `${{ inputs.* }}` shorthand).
//     Dispatch inputs must enter scripts only via `env:`, where they are read
//     as quoted variables and validated (see build.yml "Get version" step).
//   - Every remote `uses:` reference (step-level and reusable-workflow
//     job-level) must be pinned to a full 40-char commit SHA. Mutable tags are
//     the default supply-chain attack surface (spec D2); local actions
//     (./.github/...) and docker:// refs are not remote tags.
//   - Every workflow must declare explicit permissions (top-level and any
//     job-level override) and must not use the blanket `write-all` scope
//     (spec D2). An empty permissions map is GitHub's explicit deny-all and
//     is allowed.
//
// Usage: node scripts/workflow-input-guard.mjs [--file extra.yml ...]
// Exit 0 when the contracts hold, exit 1 with named violations otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

// Any reference to a workflow_dispatch input inside an expression, regardless
// of dot/bracket indexing, surrounding functions, or casing:
//   ${{ github.event.inputs.version }}      (dot)
//   ${{ inputs['version'] }}                (bracket)
//   ${{ format('{0}', inputs.version) }}    (function-wrapped)
//   ${{ fromJSON(github.event.inputs.obj).field }}
//   ${{ Inputs.version }}                   (context names are case-insensitive)
const INPUT_REF_RE = /(?:github\.event\.)?inputs(?![A-Za-z0-9_])/i;

// A pinned `uses:` reference must carry the full, immutable 40-char commit
// SHA (GitHub resolves abbreviations, so the guard requires the complete
// value to keep the pin explicit and reviewable).
const FULL_SHA_RE = /^[0-9a-f]{40}$/;

// Extract `${{ ... }}` expressions, skipping `}}` inside single-quoted
// string literals (e.g. format('{{ {0} }}', ...)) and `''` escapes.
function extractExpressions(run) {
  const exprs = [];
  let i = 0;
  while (i < run.length) {
    const start = run.indexOf('${{', i);
    if (start === -1) break;
    let j = start + 3;
    let inStr = false;
    let end = -1;
    while (j < run.length) {
      const c = run[j];
      if (inStr) {
        if (c === "'") {
          if (run[j + 1] === "'") { j += 2; continue; }
          inStr = false;
        }
      } else if (c === "'") {
        inStr = true;
      } else if (c === '}' && run[j + 1] === '}') {
        end = j + 2;
        break;
      }
      j++;
    }
    exprs.push(end === -1 ? run.slice(start) : run.slice(start, end));
    if (end === -1) break;
    i = end;
  }
  return exprs;
}

// Drop single-quoted string literals (with '' escapes) before testing, but
// keep bracketed property names such as github.event['inputs']['version'].
function withoutStringLiterals(expr) {
  return expr.replace(/'(?:''|[^'])*'/g, (literal, offset, source) => {
    const before = source.slice(0, offset).trimEnd();
    const after = source.slice(offset + literal.length).trimStart();
    return before.endsWith('[') && after.startsWith(']') ? literal : "''";
  });
}

function findInputRefs(run) {
  const hits = [];
  for (const expr of extractExpressions(run)) {
    if (INPUT_REF_RE.test(withoutStringLiterals(expr))) hits.push(expr);
  }
  return hits;
}

function collectRunScripts(doc) {
  const scripts = [];
  for (const job of Object.values(doc.jobs || {})) {
    if (!job || !Array.isArray(job.steps)) continue;
    for (const step of job.steps) {
      if (step && typeof step.run === 'string') {
        scripts.push({ stepName: step.name || '<unnamed>', run: step.run });
      }
    }
  }
  return scripts;
}

/**
 * Collect every `uses:` reference in a workflow document. Reusable-workflow
 * jobs reference another workflow through a job-level `uses:` key and have no
 * `steps`; step-level references are collected as before. Each entry carries
 * a display name for violation messages.
 *
 * @param {object} doc - Parsed workflow YAML document.
 * @returns {Array<{stepName: string, uses: string}>} Reference list.
 */
function collectUses(doc) {
  const refs = [];
  for (const [jobName, job] of Object.entries(doc.jobs || {})) {
    if (!job || typeof job !== 'object') continue;
    if (typeof job.uses === 'string') {
      refs.push({ stepName: `job ${jobName}`, uses: job.uses });
    }
    if (Array.isArray(job.steps)) {
      for (const step of job.steps) {
        if (step && typeof step.uses === 'string') {
          refs.push({ stepName: step.name || '<unnamed>', uses: step.uses });
        }
      }
    }
  }
  return refs;
}

/**
 * Verify that every remote `uses:` reference (step-level and job-level) is
 * pinned to a full 40-char commit SHA. Local actions (`./`) and container
 * images (`docker://`) are not remote mutable tags and are exempt.
 *
 * @param {object} doc - Parsed workflow YAML document.
 * @param {string} base - Workflow base name for violation messages.
 * @returns {string[]} Violation messages (empty when the contract holds).
 */
function checkUsesPinned(doc, base) {
  const violations = [];
  for (const { stepName, uses } of collectUses(doc)) {
    // Local actions and container images are not remote mutable tags.
    if (uses.startsWith('.') || uses.startsWith('docker://')) continue;
    const at = uses.lastIndexOf('@');
    if (at === -1 || at === uses.length - 1) {
      violations.push(`${base} :: ${stepName} :: uses "${uses}" is not pinned to a commit SHA`);
      continue;
    }
    if (!FULL_SHA_RE.test(uses.slice(at + 1))) {
      violations.push(`${base} :: ${stepName} :: uses "${uses}" is not pinned to a full 40-char commit SHA`);
    }
  }
  return violations;
}

/**
 * Verify that the workflow declares explicit permissions and that neither the
 * workflow nor any job uses the blanket `write-all` scope. A top-level
 * `permissions: {}` map is allowed as GitHub's explicit deny-all
 * configuration; job-level overrides are inspected because they can
 * re-expand the default scope.
 *
 * @param {object} doc - Parsed workflow YAML document.
 * @param {string} base - Workflow base name for violation messages.
 * @returns {string[]} Violation messages (empty when the contract holds).
 */
function checkPermissions(doc, base) {
  const violations = [];
  const perms = doc.permissions;
  if (perms === undefined || perms === null) {
    violations.push(`${base} :: workflow has no explicit top-level permissions block`);
  } else if (typeof perms === 'string' && perms === 'write-all') {
    violations.push(`${base} :: workflow uses the blanket "write-all" permissions scope`);
  }
  for (const [jobName, job] of Object.entries(doc.jobs || {})) {
    if (!job || typeof job !== 'object') continue;
    const jobPerms = job.permissions;
    if (jobPerms === undefined || jobPerms === null) continue;
    if (typeof jobPerms === 'string' && jobPerms === 'write-all') {
      violations.push(`${base} :: job "${jobName}" uses the blanket "write-all" permissions scope`);
    }
  }
  return violations;
}

/**
 * Run every guard contract against a single workflow file.
 *
 * @param {string} file - Absolute path to the workflow YAML file.
 * @returns {{file: string, violations: string[]}} Per-file report.
 */
function checkWorkflow(file) {
  const text = fs.readFileSync(file, 'utf8');
  const doc = yaml.load(text);
  const base = path.basename(file);
  const violations = [];
  for (const { stepName, run } of collectRunScripts(doc)) {
    const hits = findInputRefs(run);
    if (hits.length) {
      violations.push(`${base} :: ${stepName} :: run block interpolates a dispatch input expression (${hits.join(', ')})`);
    }
  }
  violations.push(...checkUsesPinned(doc, base));
  violations.push(...checkPermissions(doc, base));
  return { file: base, violations };
}

const extraFiles = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) extraFiles.push(path.resolve(args[++i]));
}

const workflowFiles = fs
  .readdirSync(WORKFLOWS_DIR)
  .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  .map(f => path.join(WORKFLOWS_DIR, f));

const reports = [...workflowFiles, ...extraFiles].map(checkWorkflow);
const violations = reports.flatMap(r => r.violations);

const report = {
  ok: violations.length === 0,
  checked: reports.map(r => r.file),
  contracts: [
    'no dispatch input expression (${{ github.event.inputs.* }} / ${{ inputs.* }}) inside any run: block',
    'every remote uses: reference (step-level and reusable-workflow job-level) pinned to a full 40-char commit SHA',
    'every workflow declares explicit permissions at top level and per job (never write-all)'
  ],
  violations
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
