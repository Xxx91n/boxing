#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Ticket 43 (spec #40): frozen pre-migration reader contract registry.
//
// The migration golden gate proves that current data stays readable by the reader
// that existed before the layout migration. That reader used to be a private
// helper inside scripts/migration-golden-guard.mjs, so editing it silently
// redefined "old reader" and weakened the proof. This module promotes it to a
// named, append-only contract:
//
//   * existing contract ids cannot be re-registered (append-only);
//   * every registered contract is deeply frozen at runtime;
//   * the rollback audit returns one comparable verdict for the gate.
//
// Pure move: the reader body below is the verbatim logic that lived in the gate.
// The gate keeps its layout comparison helpers (canon/bookmarkIds/fixtures).
//
// Ticket 46: every frozen function body is pinned by the SHA-256 of its raw
// source text. The pin is deliberately NOT normalized: any edit, including
// whitespace-only reformatting, is a drift failure. Adding a new contract id
// needs no entry here; it is pinned in memory on registration and cannot
// disturb the historical pins below.
//
// "Raw source text" is read from this module's own file rather than from
// Function.prototype.toString(): test runners load .mjs through a compiler that
// reprints function bodies (Playwright's Babel pass, for example, drops trailing
// commas), so toString() is not byte-stable across loaders. The on-disk text is.
const PINS = Object.freeze({
  'pre-adr0009': Object.freeze({
    legacyReader: '3118867cbd77d5afa628fefc49651d77bef5374a37bb94dabf1b684e6aafd1c6',
  }),
});

// #47 forbids production imports. This module is gate-side (scripts/), and the
// registry/accessor split below keeps the boundary auditable.

const MODULE_SOURCE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
const CONTRACTS = new Map();

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

// Top-level function-valued properties of a contract are its frozen bodies.
function functionBodies(contract) {
  const bodies = [];
  for (const key of Object.keys(contract)) {
    if (typeof contract[key] === 'function') bodies.push(contract[key]);
  }
  return bodies;
}

// Byte-exact slice of `function <name>(...) { ... }` from the module source.
// The brace scanner skips quotes, template literals and comments so braces in
// those contexts cannot end the body early.
function extractFunctionSource(source, functionName) {
  const header = 'function ' + functionName + '(';
  const start = source.indexOf(header);
  if (start === -1) return null;
  let depth = 0;
  let mode = 'code';
  for (let i = source.indexOf('{', start + header.length); i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') { mode = 'line'; i++; continue; }
      if (ch === '/' && next === '*') { mode = 'block'; i++; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { mode = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
    } else if (mode === 'line') {
      if (ch === '\n') mode = 'code';
    } else if (mode === 'block') {
      if (ch === '*' && next === '/') { mode = 'code'; i++; }
    } else if (ch === '\\') {
      i++; // escaped character inside a string/template literal
    } else if (ch === mode) {
      mode = 'code';
    }
  }
  return null;
}

function computeSourcePins(contract) {
  const pins = {};
  for (const fn of functionBodies(contract)) {
    const name = fn.name || '<anonymous>';
    const raw = extractFunctionSource(MODULE_SOURCE, name);
    pins[name] = sha256(raw === null ? fn.toString() : raw);
  }
  return pins;
}

// A pinned id must present exactly the source text that was frozen. Renaming the
// function is drift too: the pin is keyed by function name, so a missing name is
// reported against the pinned name rather than silently skipped.
function assertPinnedFunctionBodies(contract) {
  const pinned = PINS[contract.id];
  if (!pinned) return; // genuinely new id: no historical pin to defend yet
  for (const [functionName, expectedHash] of Object.entries(pinned)) {
    const supplied = functionBodies(contract).find((candidate) => candidate.name === functionName);
    const raw = extractFunctionSource(MODULE_SOURCE, functionName);
    if (!supplied || raw === null) {
      throw new Error(
        'frozen reader contract "' + contract.id + '" function "' + functionName +
        '" is missing or renamed: pinned source hash cannot be verified'
      );
    }
    const actualHash = sha256(raw);
    if (actualHash !== expectedHash) {
      throw new Error(
        'frozen reader contract "' + contract.id + '" function "' + functionName +
        '" body drifted: pinned ' + expectedHash + ', got ' + actualHash
      );
    }
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && 'value' in descriptor) deepFreeze(descriptor.value, seen);
  }
  return Object.freeze(value);
}

function assertContractInput(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new TypeError('frozen reader contract must be an object');
  }
  if (typeof contract.id !== 'string' || contract.id.trim() === '') {
    throw new TypeError('frozen reader contract id must be a non-empty string');
  }
  if (typeof contract.frozenSince !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(contract.frozenSince)) {
    throw new TypeError('frozen reader contract frozenSince must be an ISO date (YYYY-MM-DD)');
  }
  if (typeof contract.reader !== 'function') {
    throw new TypeError('frozen reader contract reader must be a function');
  }
}

// Append-only registration. An id may be registered exactly once; a different
// body under an existing id is therefore rejected by the same id check. Pinned
// ids additionally must present their original source text (ticket 46).
function registerContract(contract) {
  assertContractInput(contract);
  if (CONTRACTS.has(contract.id)) {
    throw new Error('frozen reader contract "' + contract.id + '" is already registered (append-only)');
  }
  assertPinnedFunctionBodies(contract);
  // Every entry carries the in-memory pins computed from its own bodies. Pinned
  // ids were just verified against PINS; a new id simply records its first pin.
  // Spread preserves arbitrary metadata (e.g. tags) while the required fields and
  // pins below win over any accidental overrides in the descriptor.
  const entry = deepFreeze({
    ...contract,
    id: contract.id,
    frozenSince: contract.frozenSince,
    reader: contract.reader,
    sourcePins: Object.freeze(computeSourcePins(contract)),
  });
  CONTRACTS.set(entry.id, entry);
  return entry;
}

function getContract(id) {
  const contract = CONTRACTS.get(id);
  if (!contract) throw new Error('unknown frozen reader contract: ' + id);
  return contract;
}

// A frozen snapshot, not a live view: a previously obtained snapshot never
// changes when a new contract id is registered.
function getRegistry() {
  const registry = Object.create(null);
  for (const [id, contract] of CONTRACTS) registry[id] = contract;
  return deepFreeze(registry);
}

function contractIds() {
  return Object.freeze([...CONTRACTS.keys()]);
}

// Rollback half of the expand/contract exercise: a reader frozen at the PREVIOUS
// contract (no schemaVersion awareness; groups optional with fallback). The point
// of the contract is that this reader keeps every user-visible object from current
// data (boxes, children, bookmarks, connections); only the runtime-only grouping
// decoration may differ, and that survives via isParent.
function legacyReader(raw) {
  if (!raw || typeof raw !== 'object' || !(raw.version >= 3)) return null; // >=3 taken as-is
  return {
    boxes: Array.isArray(raw.boxes) ? raw.boxes : [],
    connections: Array.isArray(raw.connections) ? raw.connections : [],
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    settings: raw.settings || {},
  };
}

function bookmarkIds(layout) {
  const ids = [];
  for (const box of layout.boxes || []) for (const child of box.children || []) for (const bm of child.bookmarks || []) ids.push(bm.id);
  return ids;
}

// Star truth is box.isParent (GLOSSARY "isParent"), on large and small boxes alike.
function starIds(layout) {
  const ids = [];
  const visit = (box) => {
    if (box && box.isParent === true && box.id != null) ids.push(box.id);
    for (const child of (box && box.children) || []) visit(child);
  };
  for (const box of (layout && layout.boxes) || []) visit(box);
  return ids;
}

function resolveContract(contractOrId) {
  if (typeof contractOrId === 'string') return getContract(contractOrId);
  if (contractOrId && typeof contractOrId === 'object' && typeof contractOrId.reader === 'function') return contractOrId;
  throw new TypeError('rollbackAudit expects a registered contract id or contract object');
}

// One verdict for the rollback half: did the frozen reader accept the serialized
// current layout, and did every user-visible object survive it?
function rollbackAudit(contractOrId, currentLayout) {
  const contract = resolveContract(contractOrId);
  if (!currentLayout || typeof currentLayout !== 'object') {
    throw new TypeError('rollbackAudit expects the current layout object');
  }
  const serialized = JSON.parse(JSON.stringify(currentLayout)); // storage boundary
  const previous = contract.reader(serialized);
  const acceptance = previous !== null;

  const currentBookmarkIds = bookmarkIds(currentLayout);
  const previousBookmarkIds = previous ? bookmarkIds(previous) : [];
  const previousBookmarkSet = new Set(previousBookmarkIds);
  const currentBookmarkSet = new Set(currentBookmarkIds);

  const currentStars = starIds(currentLayout);
  const previousStarSet = new Set(previous ? starIds(previous) : []);
  const lostStars = currentStars.filter((id) => !previousStarSet.has(id));

  return {
    acceptance: acceptance,
    bookmarkDiff: {
      lost: currentBookmarkIds.filter((id) => !previousBookmarkSet.has(id)),
      gained: previousBookmarkIds.filter((id) => !currentBookmarkSet.has(id)),
    },
    boxDelta: previous ? previous.boxes.length - (currentLayout.boxes || []).length : null,
    connectionDelta: previous ? previous.connections.length - (currentLayout.connections || []).length : null,
    starSurvival: {
      total: currentStars.length,
      survived: currentStars.length - lostStars.length,
      lost: lostStars,
      // The star must survive through isParent alone; runtime groups must not leak
      // into persisted large boxes (the gate's "self-contained" half).
      groupsLeaked: previous ? previous.boxes.some((box) => box && box.groups !== undefined) : false,
    },
  };
}

registerContract({
  id: 'pre-adr0009',
  frozenSince: '2026-09-12',
  reader: legacyReader,
});

export { registerContract, getContract, getRegistry, contractIds, rollbackAudit };
