#!/usr/bin/env node
// Guard: .npmrc min-release-age (ticket #79, spec #75 D4) is only honored by
// npm >= 11.10.0. Older npm silently warns and ignores the key, leaving
// developer installs without the 7-day supply-chain filter. Refuse to install
// with an unsupported npm instead of silently skipping the protection.
//
// This guard deliberately does not pick a future Node line (Q5 remains an open
// product decision); it enforces the npm floor required for the ticket's own
// setting to take effect. package.json engines now mirrors npm 11.10.0's own
// Node requirement (^20.17.0 || >=22.9.0) so the declared floor and the guard
// cannot disagree (CodeRabbit PR #94 review round 2).
import { execSync } from "node:child_process";

const MIN = [11, 10, 0];

function parseVersion(raw) {
  const m = String(raw).trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isAtLeast(v, min) {
  for (let i = 0; i < 3; i += 1) {
    if (v[i] > min[i]) return true;
    if (v[i] < min[i]) return false;
  }
  return true;
}

// npm_execpath points at the npm instance that started this install; a bare
// `npm --version` through PATH can resolve a different version (e.g. when npm
// was invoked by absolute path). Ask the active instance for its own version.
const npmEntry = process.env.npm_execpath;
let raw;
try {
  raw = execSync(`node "${npmEntry}" --version`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
} catch {
  console.error("[guard] cannot detect npm version; refusing install while min-release-age protection is unverifiable");
  process.exit(1);
}

const version = parseVersion(raw);
if (!version) {
  console.error(`[guard] unrecognized npm version "${raw}"; refusing install while min-release-age protection is unverifiable`);
  process.exit(1);
}

if (!isAtLeast(version, MIN)) {
  console.error(
    `[guard] npm ${raw} ignores .npmrc "min-release-age=7" (requires npm >= ${MIN.join(".")}). ` +
      "Use a supported toolchain (Node ^20.17.0 || >=22.9.0, e.g. the repository's .nvmrc Node 24) " +
      "or upgrade npm on the current Node to keep the 7-day release-age protection."
  );
  process.exit(1);
}

console.log(`[guard] npm ${raw} supports min-release-age (>= ${MIN.join(".")}); 7-day release-age protection active`);