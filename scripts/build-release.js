#!/usr/bin/env node
// Boxing — local release builder (cross-platform: Windows/Linux/macOS).
// Thin wrapper around .github/scripts/build.mjs — the canonical builder.
// Produces release artifacts under dist/:
//   dist/boxing-chrome/release/chrome/   { boxing/, boxing-<ver>.zip, boxing-<ver>.crx }
//   dist/boxing-firefox/release/firefox/  { boxing/, boxing-<ver>.zip, boxing-<ver>.xpi }
// Usage:  node scripts/build-release.js [--version 3.7.10]
const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
let versionOverride = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--version' && args[i + 1]) { versionOverride = args[++i]; }
}
const env = { ...process.env };
if (versionOverride) env.BOXING_BUILD_VERSION = versionOverride;
const script = path.resolve(__dirname, '..', '.github', 'scripts', 'build.mjs');
const result = spawnSync(process.execPath, [script], { stdio: 'inherit', env, cwd: path.resolve(__dirname, '..') });
process.exit(result.status || 0);
