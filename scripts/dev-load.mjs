#!/usr/bin/env node
/**
 * Boxing dev-load: cross-platform browser extension launcher.
 *
 * Auto-discovers project root, detects OS, finds the browser binary,
 * builds dist/ if stale, and launches the browser with the correct
 * dist/boxing-chrome or dist/boxing-firefox loaded as unpacked extension.
 *
 * Usage:
 *   node scripts/dev-load.mjs [chrome|firefox] [--url=URL] [--no-build]
 *
 * No hardcoded paths — all discovery is relative to this script's location.
 */

import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// ── Parse args ──
const args = process.argv.slice(2);
let browser = 'chrome'; // default
let startUrl = '';
let skipBuild = false;

for (const arg of args) {
  if (arg === 'chrome' || arg === 'firefox') browser = arg;
  else if (arg.startsWith('--url=')) startUrl = arg.slice(6);
  else if (arg === '--no-build') skipBuild = true;
}

// ── Resolve dist directory ──
const distDir = browser === 'firefox'
  ? join(projectRoot, 'dist', 'boxing-firefox')
  : join(projectRoot, 'dist', 'boxing-chrome');

if (!existsSync(distDir) || !existsSync(join(distDir, 'manifest.json'))) {
  if (skipBuild) {
    console.error(`[dev-load] dist not found: ${distDir}\nRun 'node .github/scripts/build.mjs' first.`);
    process.exit(1);
  }
  console.log('[dev-load] dist not found or stale — building...');
  execSync('node .github/scripts/build.mjs', { cwd: projectRoot, stdio: 'inherit' });
}

// ── Find browser binary (no hardcoded paths) ──
function findBinary(target) {
  const plat = platform();
  const candidates = [];

  if (target === 'firefox') {
    if (plat === 'win32') {
      candidates.push(
        'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
        'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
      );
    } else if (plat === 'darwin') {
      candidates.push('/Applications/Firefox.app/Contents/MacOS/firefox');
    } else {
      candidates.push('/usr/bin/firefox', '/usr/local/bin/firefox', '/snap/bin/firefox');
    }
  } else {
    // chrome / chromium
    if (plat === 'win32') {
      candidates.push(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        'C:\\Users\\' + (process.env.USERNAME || 'user') + '\\AppData\\Local\\Chromium\\Application\\chrome.exe',
      );
    } else if (plat === 'darwin') {
      candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium');
    } else {
      candidates.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium');
    }
  }

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fallback: try 'which'/'where'
  const cmd = plat === 'win32' ? 'where' : 'which';
  const name = target === 'firefox' ? 'firefox' : 'google-chrome';
  try {
    const found = execSync(`${cmd} ${name}`, { encoding: 'utf8' }).trim().split('\n')[0];
    if (found && existsSync(found)) return found;
  } catch {}

  return null;
}

const binary = findBinary(browser);
if (!binary) {
  console.error(`[dev-load] Could not find ${browser} binary. Pass it via BROWSER_PATH env var.`);
  process.exit(1);
}

console.log(`[dev-load] Browser: ${browser} -> ${binary}`);
console.log(`[dev-load] Extension dir: ${distDir}`);

// ── Launch ──
const { spawn } = await import('child_process');
const plat = platform();

if (browser === 'firefox') {
  // Firefox: use --temporary-addon via about:debugging or web-ext run
  // Simplest: launch with -profile and -foreground
  const profileDir = join(projectRoot, '.dev-profile-firefox');
  const ffArgs = ['-foreground', '-profile', profileDir, '-url', startUrl || 'about:blank'];
  if (startUrl) ffArgs.push(startUrl);
  spawn(binary, ffArgs, { stdio: 'inherit', detached: false });
  console.log('[dev-load] Firefox launched. Load the extension via about:debugging → This Firefox → Load Temporary Add-on → select manifest.json in:');
  console.log(`  ${join(distDir, 'manifest.json')}`);
} else {
  // Chrome/Chromium: --load-extension flag
  const profileDir = join(projectRoot, '.dev-profile-chrome');
  const chromeArgs = [
    `--load-extension=${distDir}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
  ];
  if (startUrl) chromeArgs.push(startUrl);
  else chromeArgs.push('about:blank');

  spawn(binary, chromeArgs, { stdio: 'inherit', detached: false });
  console.log(`[dev-load] Chrome launched with --load-extension=${distDir}`);
}
