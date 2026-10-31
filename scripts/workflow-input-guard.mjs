#!/usr/bin/env node
// CI workflow input guard (ticket 76 / spec D1, finding V-01), extended by
// ticket 77 / spec D2 (finding V-02) with "uses pinned to commit SHA" and
// "explicit workflow permissions", and by ticket 78 / spec D3 (finding V-03)
// with "release signing uses lockfile tools only" (npm ci first, then
// crx3/web-ext via npx --no-install or node_modules/.bin; no npx --yes).
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
//   - No `run:` block may use `npx --yes`, and any job calling crx3/web-ext
//     must run `npm ci` first and invoke the tools via `npx --no-install` or
//     the local node_modules/.bin (spec D3). Signing steps must never pull
//     un-pinned tool versions from the registry.
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

// Tools that release signing must source from the lockfile (spec D3).
const LOCKFILE_TOOLS = ['crx3', 'web-ext'];
const LOCKFILE_TOOL_PATTERN = LOCKFILE_TOOLS.join('|');

/**
 * Verify spec D3 contracts: no `npx --yes` anywhere in a run block, and any
 * job that calls crx3/web-ext must have run `npm ci` in an earlier step and
 * must invoke the tools via `npx --no-install` or the local node_modules/.bin
 * — never a bare `npx <tool>` that would fall back to downloading an
 * un-pinned version from the registry at signing time.
 *
 * @param {object} doc - Parsed workflow YAML document.
 * @param {string} base - Workflow base name for violation messages.
 * @returns {string[]} Violation messages (empty when the contract holds).
 */

/**
 * Split a run block into shell command segments. Backslash-continued lines
 * are joined first because the shell treats them as a single command
 * (otherwise `npx \` + `--yes crx3@2.0.0` would hide both halves from the
 * per-segment checks).
 */
function splitRunSegments(run) {
  const joined = [];
  let cur = "";
  for (const line of run.split(/\r?\n/)) {
    const continued = /(?<!\\)\\\s*$/.test(line);
    const cleaned = continued ? line.replace(/\\\s*$/, "") : line;
    cur = cur ? `${cur}${cleaned}` : cleaned;
    if (continued) continue; // backslash continuation
    joined.push(cur);
    cur = "";
  }
  if (cur) joined.push(cur);
  return joined.flatMap((line) => line.split(/\s*(?:&&|\|\||;|\|)\s*/));
}

/**
 * Strip leading environment assignments (FOO=1 BAR="x" CMD ...) and common
 * shell wrappers (if, then, else, elif, fi, time, sudo, env, command, !) so
 * the remainder starts with the real command. Wrappers may chain (command
 * command npx, if ! npx) and env assignments may precede them (FOO=1 command
 * npx), so stripping repeats until nothing changes.
 */
function stripShellPrefixes(segment) {
  let cmd = segment.trim();
  const envRe = /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]*)\s+)+/;
  const wrapperRe = /^(?:(?:if|then|else|elif|fi|time|sudo|env|command|!|\{|do|while|until)\s+|\(\s*)+/;
  let changed = true;
  while (changed) {
    changed = false;
    if (envRe.test(cmd)) {
      cmd = cmd.replace(envRe, "");
      changed = true;
    }
    if (wrapperRe.test(cmd)) {
      cmd = cmd.replace(wrapperRe, "");
      changed = true;
    }
  }
  return cmd;
}

/**
 * Return the shell verb of a command segment after stripping environment
 * assignments and common leading keywords. Used to decide whether a segment
 * really invokes a release tool instead of merely mentioning it (e.g.
 * `echo crx3`).
 */
function segmentVerb(segment) {
  return stripShellPrefixes(segment).split(/\s+/)[0] || "";
}

function checkLockfileTools(doc, base) {
  const violations = [];
  for (const [jobName, job] of Object.entries(doc.jobs || {})) {
    if (!job || !Array.isArray(job.steps)) continue;
    const steps = job.steps;
    let ciIdx = -1;
    let firstToolIdx = -1;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step || typeof step.run !== 'string') continue;
      const name = step.name || `<unnamed step ${i + 1}>`;
      // Inspect each shell command segment so a permitted `npx --no-install
      // <tool>` cannot mask a later bare `npx <tool>`, alternate options
      // (e.g. `npx -y crx3`) cannot hide the tool name, `npm exec
      // --package=<tool>` cannot bypass the npx-only filter, and
      // informational text (e.g. `echo crx3`) cannot count as an invocation.
      const segments = splitRunSegments(step.run);
      let toolInvoked = false;
      for (const segment of segments) {
        if (!segment.trim()) continue;
        const verb = segmentVerb(segment);
        if (verb === "npx") {
          // -y is the short form of --yes; both must never appear anywhere
          // among npx's own options, not just the first one (spec D3).
          // Parse from the prefix-stripped command so `command npx`, `if
          // npx`, `FOO=1 npx` and indented if/else blocks behave alike.
          const stripped = stripShellPrefixes(segment);
          const afterNpx = stripped.replace(/^npx\s+/, "");
          const optZoneMatch = afterNpx.match(/^(?:-\S+(?:\s+|$))*/);
          const optZone = optZoneMatch ? optZoneMatch[0] : "";
          if (/(?:^|\s)(?:--yes|-y)(?=\s|$)/.test(optZone)) {
            violations.push(`${base} :: ${name} :: "npx --yes" / "npx -y" used (spec D3: lockfile tools only, no registry download)`);
          }
          // A bare `npx <tool>` (without --no-install) would fall back to a
          // registry fetch; the tool must come from the lockfile's .bin.
          if (new RegExp(`\\b(${LOCKFILE_TOOL_PATTERN})\\b`).test(segment)) {
            toolInvoked = true;
            if (!/\bnpx\s+--no-install\b/.test(segment)) {
              violations.push(`${base} :: ${name} :: invokes crx3/web-ext without "npx --no-install" (spec D3: lockfile tools only)`);
            }
          }
        } else if (verb === "npm") {
          // npm exec (alias: npm x) always resolves/installs packages from
          // the registry; a crx3/web-ext package there can never be the
          // lockfile's audited version (spec D3).
          if (/\bnpm\s+(?:exec|x)\b/.test(segment) && new RegExp(`\\b(${LOCKFILE_TOOL_PATTERN})\\b`).test(segment)) {
            violations.push(`${base} :: ${name} :: uses "npm exec" with crx3/web-ext (spec D3: lockfile tools only, no registry download)`);
            toolInvoked = true;
          }
        } else if (/^node_modules\/\.bin\/(?:crx3|web-ext)$/.test(verb) || verb === "crx3" || verb === "web-ext") {
          // Local binary invocation (node_modules/.bin or PATH) is allowed.
          toolInvoked = true;
        }
        if (verb === "npm" && /\bnpm\s+ci\b/.test(segment) && ciIdx === -1) ciIdx = i;
      }
      if (toolInvoked && firstToolIdx === -1) firstToolIdx = i;
    }
    // npm ci must run strictly before any crx3/web-ext invocation (spec D3);
    // a run block doing both (ciIdx === firstToolIdx) still violates it.
    if (firstToolIdx !== -1 && (ciIdx === -1 || ciIdx >= firstToolIdx)) {
      violations.push(`${base} :: job "${jobName}" calls crx3/web-ext without a strictly preceding "npm ci" step (spec D3: locked deps first)`);
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
  violations.push(...checkLockfileTools(doc, base));
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
    'every workflow declares explicit permissions at top level and per job (never write-all)',
    'no npx --yes in any run: block; crx3/web-ext jobs run npm ci first and invoke tools via npx --no-install or node_modules/.bin (spec D3)'
  ],
  violations
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
