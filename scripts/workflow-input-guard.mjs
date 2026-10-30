#!/usr/bin/env node
// CI workflow input guard (ticket 76 / spec D1, finding V-01).
//
// First block of the CI hardening chain; later tickets extend this guard
// (e.g. "uses: pinned to commit SHA" belongs to spec D2).
//
// Contract checked here:
//   - No `run:` block may interpolate a workflow_dispatch input expression
//     (`${{ github.event.inputs.* }}` or its `${{ inputs.* }}` shorthand).
//     Dispatch inputs must enter scripts only via `env:`, where they are read
//     as quoted variables and validated (see build.yml "Get version" step).
//
// Usage: node scripts/workflow-input-guard.mjs [--file extra.yml ...]
// Exit 0 when the contract holds, exit 1 with named violations otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

// `${{ github.event.inputs.version }}` and the `${{ inputs.version }}` shorthand.
const DISPATCH_INPUT_RE = /\$\{\{\s*(?:github\.event\.inputs|inputs)\./;

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

function checkWorkflow(file) {
  const text = fs.readFileSync(file, 'utf8');
  const doc = yaml.load(text);
  const violations = [];
  for (const { stepName, run } of collectRunScripts(doc)) {
    if (DISPATCH_INPUT_RE.test(run)) {
      violations.push(`${path.basename(file)} :: ${stepName} :: run block interpolates a dispatch input expression`);
    }
  }
  return { file: path.basename(file), violations };
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
  contract: 'no dispatch input expression (${{ github.event.inputs.* }} / ${{ inputs.* }}) inside any run: block',
  violations
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
