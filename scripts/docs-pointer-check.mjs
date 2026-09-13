#!/usr/bin/env node
/**
 * docs-pointer-check.mjs - key-pointer resolvability checker (ticket 85 / A-035).
 *
 * Scope: the newcomer entry chain only. Verifies that every relative pointer in
 * those documents resolves to an existing file, and, when a heading fragment is
 * present, to an existing heading.
 *
 * NOT A GATE: deliberately not wired into pretest and must not be added to any
 * required CI job. Ticket 85 is bound by A-035 (D-007 R7): it must not block
 * G-A or G-B and must not extend ADR-0017.
 *
 * Usage: node scripts/docs-pointer-check.mjs
 * Exit:  0 = every key pointer resolves, 1 = at least one broken pointer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ENTRIES = [
  'README.md',
  'CONTRIBUTING.md',
  'CONTEXT.md',
  'AGENTS.md',
  'docs/START-HERE.md',
  'docs/index.md',
  'docs/CONTEXT.md',
  'docs/agents/README.md',
  'docs/testing-governance.md',
];

// Markdown link scanner. Hand-written on purpose: the file avoids every
// backslash so no escaping layer can corrupt the patterns in transit.
function extractLinks(content) {
  const links = [];
  let i = 0;
  while (i < content.length) {
    const open = content.indexOf('[', i);
    if (open === -1) break;
    const mid = content.indexOf('](', open);
    if (mid === -1) break;
    const close = content.indexOf(')', mid);
    if (close === -1) break;
    const text = content.slice(open + 1, mid);
    const target = content.slice(mid + 2, close).trim();
    if (text.indexOf(']') === -1 && target.indexOf('(') === -1) links.push({ text: text, target: target });
    i = close + 1;
  }
  return links;
}

function headingText(line) {
  let n = 0;
  while (n < line.length && line.charAt(n) === '#') n++;
  if (n === 0 || n > 6) return null;
  if (line.charAt(n) !== ' ') return null;
  return line.slice(n + 1).trim();
}

function headingSlug(text) {
  const t = text.toLowerCase();
  let s = '';
  for (let i = 0; i < t.length; i++) {
    const c = t.charAt(i);
    const code = t.charCodeAt(i);
    const isWord =
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 95 ||
      code === 45 ||
      (code >= 0x4e00 && code <= 0x9fa5);
    if (isWord) s += c;
    else if (c === ' ' || code === 9) s += '-';
  }
  let r = '';
  for (let i = 0; i < s.length; i++) {
    if (s.charAt(i) === '-' && (r.length === 0 || r.charAt(r.length - 1) === '-')) continue;
    r += s.charAt(i);
  }
  while (r.length > 0 && r.charAt(r.length - 1) === '-') r = r.slice(0, -1);
  return r;
}

function headingsOf(content) {
  const set = new Set();
  const parts = content.split(String.fromCharCode(10));
  for (let i = 0; i < parts.length; i++) {
    let line = parts[i];
    if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
    const h = headingText(line);
    if (h !== null) set.add(headingSlug(h));
  }
  return set;
}

function isExternal(raw) {
  return raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0 ||
    raw.indexOf('mailto:') === 0 || raw.indexOf('tel:') === 0;
}

function endsWithMd(p) {
  return p.length > 3 && p.slice(-3).toLowerCase() === ".md";
}

function checkEntry(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return { rel: rel, missingFile: true, checked: 0, broken: [] };
  const content = fs.readFileSync(abs, 'utf8');
  const dir = path.dirname(abs);
  const ownHeadings = headingsOf(content);
  const broken = [];
  let checked = 0;

  for (const link of extractLinks(content)) {
    const raw = link.target;
    if (raw === '') continue;
    if (isExternal(raw)) continue;

    if (raw.charAt(0) === '#') {
      checked++;
      if (!ownHeadings.has(headingSlug(raw.slice(1)))) {
        broken.push(raw + '  (heading not found)  <- [' + link.text + ']');
      }
      continue;
    }

    const hashAt = raw.indexOf('#');
    const targetPath = hashAt === -1 ? raw : raw.slice(0, hashAt);
    const fragment = hashAt === -1 ? '' : raw.slice(hashAt + 1);
    if (targetPath === '') { checked++; continue; }

    checked++;
    const resolved = path.resolve(dir, targetPath);
    if (!fs.existsSync(resolved)) {
      broken.push(raw + '  (file not found)  <- [' + link.text + ']');
      continue;
    }
    if (fragment !== "" && endsWithMd(targetPath)) {
      const targetHeadings = headingsOf(fs.readFileSync(resolved, 'utf8'));
      if (!targetHeadings.has(headingSlug(fragment))) {
        broken.push(raw + '  (heading not found)  <- [' + link.text + ']');
      }
    }
  }
  return { rel: rel, missingFile: false, checked: checked, broken: broken };
}

const results = ENTRIES.map(checkEntry);
let totalChecked = 0;
let totalBroken = 0;

for (const r of results) {
  totalChecked += r.checked;
  totalBroken += r.broken.length;
  const status = r.missingFile ? 'MISSING' : r.broken.length === 0 ? 'OK     ' : 'BROKEN ';
  console.log(status + '  ' + r.rel + '  pointers=' + r.checked + '  broken=' + r.broken.length);
  for (const b of r.broken) console.log('           - ' + b);
}

// Machine-absolute path scan (Wave9 W9-P4 / D-005#7): public entry docs must not
// hardcode host paths such as D:\... or D:/... (portable repo-root wording only).
function findMachinePaths(content, rel) {
  const hits = [];
  const parts = content.split(String.fromCharCode(10));
  const re = /(?:^|[\s(\'"`[])([A-Za-z]:[\\/](?![\\/])[^\s)\]'"`<>]*)/g;
  for (let i = 0; i < parts.length; i++) {
    let line = parts[i];
    if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
    // Skip pure URLs (https://...) — drive-letter pattern will not match those.
    const m = line.match(re);
    if (m) {
      for (const x of m) {
        // Allow Windows drive references that are clearly not user home clones? Deny all in entry docs.
        hits.push(rel + ':' + (i + 1) + ': ' + x);
      }
    }
  }
  return hits;
}

const pathHits = [];
for (const rel of ENTRIES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  pathHits.push(...findMachinePaths(fs.readFileSync(abs, 'utf8'), rel));
}

console.log('');
if (totalBroken > 0 || pathHits.length > 0) {
  if (pathHits.length > 0) {
    console.log('machine-path scan: FAILED - ' + pathHits.length + ' absolute host path(s):');
    for (const h of pathHits) console.log('           - ' + h);
  }
  console.log('docs-pointer-check: FAILED - broken=' + totalBroken + ' machinePaths=' + pathHits.length + ' of ' + totalChecked + ' pointers.');
  process.exit(1);
}
console.log('docs-pointer-check: PASSED - ' + totalChecked + ' key pointers resolve across ' + results.length + ' entry documents; 0 machine paths.');
