import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ════════════════════════════════════════════════════════════════════════════
// Ticket 92 (Wave9, A-046, B56): boot-pending 专项 e2e — zero-flash regression guard.
// Automates the report 73 P-73-1 recommendation: a fresh tab whose first frame must
// already carry the remembered theme, canvas content masked by html.boot-pending
// until renderCanvas confirms the remembered state, unmasked exactly at that point.
// Harness per atomcode-92 (Playwright FOUC-invariant research, 2026-09-13):
//   - addInitScript runs before any page script, but documentElement is still null
//     then (playwright#8616) — the MutationObserver therefore binds `document`.
//     This is the miss in 73 s one-off probe (trace.unmask = null, 73-report section 3.2).
//   - DOMTokenList add/remove interception gives the synchronous attribution point:
//     the boot vars micro-snapshot is taken right after boot-theme.js evaluates,
//     before <body> parses — the only Node-side-race-free witness of the first frame.
// AC2 guard: section 4 locks the boot-theme mechanism in source (head classic script
// order, mask rule, both unmask sites, 4s failsafe) so a rollback cannot pass CI.
// This spec touches NO production code — it must never "delete boot-pending to fix
// the test" (forbidden by reports/73 section 2 checkpoint).
// Ticket 104 (Wave9.15, A-058, B68) added the second describe block below together
// with the production fix it locks (boot-theme.js: failsafe armed before early return).
// ════════════════════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '..', '..');
const NTP_URL = pathToFileURL(path.resolve(ROOT, 'ntp', 'index.html')).href;
const BOOT_MIRROR_KEY = 'boxingBootTheme.v1';

type BootSnap = {
  bodyPresent: boolean;
  bootPending: boolean;
  dark: boolean;
  vars: Record<string, string>;
  canvasChildren: number;
};
type BootTrace = {
  add: { op: string; t: number } | null;
  addSnapshot: BootSnap | null;
  remove: { op: string; t: number; snap: BootSnap } | null;
  ops: Array<{ op: string; t: number; snap?: BootSnap }>;
  classHistory: Array<{ old: string | null; now: string }>;
  observerError: string | null;
};

function bootRecorderInitScript(): void {
  if (window !== window.top) return;
  const trace: any = { add: null, addSnapshot: null, remove: null, ops: [], classHistory: [], observerError: null };
  (window as any).__bootTrace = trace;
  const VARS = ['--color-warm-50', '--color-warm-dark-50', '--color-accent-500', '--color-accent-dark-500', '--accent-500-rgb', '--font-size-base'];
  function snap(): any {
    const root = document.documentElement;
    const cs = root ? getComputedStyle(root) : null;
    const surface = document.querySelector('.canvas__surface');
    const vars: any = {};
    for (const name of VARS) vars[name] = cs ? cs.getPropertyValue(name).trim() : '';
    return {
      bodyPresent: Boolean(document.body),
      bootPending: root ? root.classList.contains('boot-pending') : false,
      dark: root ? root.classList.contains('ntp--dark') : false,
      vars,
      canvasChildren: surface ? surface.children.length : -1,
    };
  }
  // (a) synchronous attribution: boot-theme adds and render.js removes the mask token
  // via html.classList — intercept at the prototype so both moments are recorded the
  // instant they happen, and take the boot-vars witness right after boot-theme.js
  // finishes evaluating (the microtask checkpoint before <body> parsing continues).
  for (const op of ['add', 'remove'] as const) {
    const orig = DOMTokenList.prototype[op];
    DOMTokenList.prototype[op] = function (...tokens: string[]) {
      const root = document.documentElement;
      const isHtmlClassList = Boolean(root) && this === root.classList;
      const hits = isHtmlClassList && tokens.indexOf('boot-pending') !== -1;
      const res = (orig as any).apply(this, tokens);
      if (hits) {
        const entry: any = { op, t: performance.now() };
        trace.ops.push(entry);
        if (op === 'add' && !trace.add) {
          trace.add = entry;
          Promise.resolve().then(() => { if (!trace.addSnapshot) trace.addSnapshot = snap(); });
        } else if (op === 'remove' && !trace.remove) {
          entry.snap = snap();
          trace.remove = entry;
        }
      }
      return res;
    };
  }
  // (b) full class history — bind `document`: at init-script time documentElement is
  // null, so observing it would throw and miss the whole window (playwright#8616).
  try {
    const mo = new MutationObserver((muts) => {
      const root = document.documentElement;
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'class' && root && m.target === root) {
          trace.classHistory.push({ old: m.oldValue, now: root.className });
        }
      }
    });
    mo.observe(document, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, childList: true, subtree: true });
  } catch (e) {
    trace.observerError = String(e);
  }
}

async function seedBootRecorder(context: BrowserContext): Promise<void> {
  await context.addInitScript(bootRecorderInitScript);
}

async function traceOf(page: Page): Promise<BootTrace> {
  return await page.evaluate(() => (window as any).__bootTrace);
}

test.describe('B56: boot-pending zero-flash e2e (ticket 92 / A-046)', () => {
  // Firefox headed launch alone eats ~22s on this host (WORKFLOW section 6 tickets 15/13);
  // two full boots + a reload need headroom.
  test.setTimeout(120000);

  test('fresh tab first frame: remembered theme on <html> before body, canvas unmasked only after render', async ({ browser }) => {
    const ctx = await browser.newContext();
    await seedBootRecorder(ctx);
    const p1 = await ctx.newPage();
    await p1.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await p1.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await p1.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => p1.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 15000 }).toBe(true);
    await p1.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
    // Memory state: forest pack + dark mode + one large box (so unmask witnesses rendered content).
    await p1.evaluate(async () => {
      (window as any)._boxingAddLargeBox();
      const dbg = (window as any).__boxingDebug;
      dbg.layout.settings.theme = 'forest';
      dbg.layout.settings.darkMode = true;
      await dbg.saveLayout();
    });
    // Mirror rides the successful persist path only — never drifts ahead of the layout.
    await expect.poll(() => p1.evaluate((key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const m = JSON.parse(raw);
      return [m.theme, m.darkMode, m.fontSize].join('|');
    }, BOOT_MIRROR_KEY), { timeout: 10000 }).toBe('forest|true|14');

    // The fresh tab: full boot re-runs against the shared file:// origin state.
    const p2 = await ctx.newPage();
    await p2.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => p2.evaluate(() => Boolean((window as any).__bootTrace && (window as any).__bootTrace.remove)), { timeout: 15000 }).toBe(true);
    const t = await traceOf(p2);
    expect(t.observerError).toBeNull();
    expect(t.add, 'boot-theme must mask the canvas at head time').not.toBeNull();
    const s = t.addSnapshot as BootSnap;
    expect(s.bodyPresent, 'witness must precede body parsing (first frame)').toBe(false);
    expect(s.bootPending).toBe(true);
    expect(s.dark, 'ntp--dark applied at first frame').toBe(true);
    // forest light warm-50 / accent-500 and forest dark warm-50 — never the beige defaults
    expect(s.vars['--color-warm-50']).toBe('#EDF1EC');
    expect(s.vars['--color-warm-dark-50']).toBe('#141C14');
    expect(s.vars['--color-accent-500']).toBe('#6A9870');
    expect(s.vars['--accent-500-rgb']).toBe('106, 152, 112');
    expect(s.vars['--font-size-base']).toBe('14px');
    const r = t.remove as BootTrace['remove'];
    expect(r!.snap.bootPending).toBe(false);
    expect(r!.snap.canvasChildren, 'unmask happens after renderCanvas produced content').toBeGreaterThanOrEqual(1);
    expect(r!.t).toBeGreaterThan((t.add as { t: number }).t);
    // Mask appears once and only as a prefix of the class history — never re-added after unmask.
    expect(t.classHistory.length).toBeGreaterThan(0);
    expect(t.classHistory[0].now).toContain('boot-pending');
    const firstCleared = t.classHistory.findIndex((h) => !h.now.includes('boot-pending'));
    expect(firstCleared).toBeGreaterThanOrEqual(0);
    expect(t.classHistory.slice(firstCleared).every((h) => !h.now.includes('boot-pending'))).toBe(true);
    expect(t.ops.filter((o) => o.op === 'add').length).toBe(1);
    // Steady state is the remembered theme: canvas bg = forest dark warm-50, not beige.
    await expect.poll(() => p2.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      theme: (window as any).__boxingDebug.layout.settings.theme,
      cls: document.documentElement.className,
    })), { timeout: 5000 }).toEqual({ bg: 'rgb(20, 28, 20)', theme: 'forest', cls: expect.stringContaining('ntp--dark') });
    await ctx.close();
  });

  test('no boot mirror: default-theme downgrade still masks and unmasks (never permanently hidden)', async ({ browser }) => {
    const ctx = await browser.newContext();
    await seedBootRecorder(ctx);
    const page = await ctx.newPage();
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__bootTrace && (window as any).__bootTrace.remove)), { timeout: 15000 }).toBe(true);
    const t = await traceOf(page);
    expect(t.add).not.toBeNull();
    const s = t.addSnapshot as BootSnap;
    expect(s.bootPending).toBe(true);
    expect(s.bodyPresent).toBe(false);
    // Fresh profile: boot theme adds NO inline vars, letting the stylesheet beige default stand.
    expect(s.vars['--color-warm-50']).toBe('');
    expect(s.vars['--color-accent-500']).toBe('');
    expect(s.dark).toBe(false);
    const dbg = await page.evaluate(() => Boolean((window as any).__boxingDebug));
    expect(dbg, 'page fully boots despite the missing mirror').toBe(true);
    await ctx.close();
  });

  test('mask rule behavior: boot-pending hides canvas surfaces, removing it restores them', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 15000 }).toBe(true);
    await page.evaluate(() => (window as any).__boxingDebug.skipOnboarding());
    await page.evaluate(async () => {
      (window as any)._boxingAddLargeBox();
      await (window as any).__boxingDebug.saveLayout();
    });
    const id = await page.evaluate(() => (window as any).__boxingDebug.layout.boxes[0].id);
    const read = async () => await page.evaluate(() => {
      const q = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        return el ? getComputedStyle(el).visibility : 'absent';
      };
      return { surface: q('.canvas__surface'), empty: q('.canvas__empty'), inner: q('.inner') };
    });
    const before = await read();
    expect(before.surface).toBe('visible');
    await page.evaluate(() => document.documentElement.classList.add('boot-pending'));
    const during = await read();
    expect(during.surface).toBe('hidden');
    expect(during.empty).toBe('hidden');
    await page.evaluate(() => document.documentElement.classList.remove('boot-pending'));
    expect((await read()).surface).toBe('visible');
    // .inner only exists once inside a large box — enter, re-mask, verify, clean up.
    await page.evaluate((boxId: string) => (window as any).__boxingDebug.enterLargeBox(boxId), id);
    await expect.poll(() => page.evaluate(() => {
      const el = document.querySelector('.inner') as HTMLElement | null;
      return el ? getComputedStyle(el).visibility : 'absent';
    }), { timeout: 5000 }).toBe('visible');
    await page.evaluate(() => document.documentElement.classList.add('boot-pending'));
    expect((await read()).inner).toBe('hidden');
    await page.evaluate(() => document.documentElement.classList.remove('boot-pending'));
    expect((await read()).inner).toBe('visible');
    await page.evaluate(() => (window as any).__boxingDebug.exitToCanvas && (window as any).__boxingDebug.exitToCanvas());
    await ctx.close();
  });

  test('AC2 source contract: boot-theme mechanism is in place and cannot roll back silently', async () => {
    const html = fs.readFileSync(path.join(ROOT, 'ntp', 'index.html'), 'utf8');
    const bootScript = html.indexOf('<script src="boot-theme.js">');
    const stylesheet = html.indexOf('<link rel="stylesheet" href="ntp.css">');
    expect(bootScript, 'classic blocking boot script must stay in index.html').toBeGreaterThanOrEqual(0);
    expect(bootScript, 'boot script must precede the stylesheet').toBeLessThan(stylesheet);
    const tag = html.slice(bootScript, html.indexOf('>', bootScript) + 1);
    expect(tag).not.toContain('type="module"');
    expect(tag).not.toContain('defer');
    expect(tag).not.toContain('async');
    const boot = fs.readFileSync(path.join(ROOT, 'ntp', 'boot-theme.js'), 'utf8');
    expect(boot).toContain("root.classList.add('boot-pending')");
    expect(boot).toContain("'boxingBootTheme.v1'");
    expect(boot).toMatch(/setTimeout\(function \(\) \{ root\.classList\.remove\('boot-pending'\); \}, 4000\)/);
    const render = fs.readFileSync(path.join(ROOT, 'ntp', 'render.js'), 'utf8');
    expect(render.match(/classList\.remove\('boot-pending'\)/g)?.length, 'renderCanvas + _enterLargeBox unmask sites').toBe(2);
    const css = fs.readFileSync(path.join(ROOT, 'ntp', 'base.css'), 'utf8');
    expect(css).toContain('html.boot-pending .canvas__surface,');
    expect(css).toContain('html.boot-pending .canvas__empty,');
    expect(css).toContain('html.boot-pending .inner {');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Ticket 104 (Wave9.15, A-058, B68): boot-theme early-return failsafe.
// P-92-1 found that the two early returns in boot-theme.js (mirror missing / mirror
// malformed) skipped the trailing 4s failsafe registration: a fresh profile whose init
// died before renderCanvas left html.boot-pending on <html> forever (permanent blank).
// The fix arms the timer right after the mask is added, so every exit path carries it.
//
// Both tests below are mutants against the pre-104 code:
//   - the behavioural test times out on the old ordering (the mask never lifts);
//   - the source contract fails on the old ordering (timer sits after the returns).
// The probe re-loads the PRODUCTION file through a same-directory <script src> (the CSP
// is script-src 'self', so an inline injection would be blocked; the static head tag in
// index.html proves the same URL is allowed), and only AFTER the real page finished its
// own boot — so the only actor that can lift the mask is the failsafe under test.
// ══════════════════════════════════════════════════════════════════════════

const BOOT_FAILSAFE_MS = 4000;
const BOOT_TIMER_SRC = "setTimeout(function () { root.classList.remove('boot-pending'); }, 4000)";

test.describe('B68: boot-theme early-return failsafe (ticket 104 / A-058)', () => {
  test.setTimeout(120000);

  async function bootThenWaitForDebug(page: Page): Promise<void> {
    await page.goto(NTP_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__boxingDebug)), { timeout: 15000 }).toBe(true);
    // render.js has unmasked by now — a mask present after this can only come from the probe.
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('boot-pending')), { timeout: 10000 }).toBe(false);
  }

  async function injectBootTheme(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'boot-theme.js'; // same directory as index.html -> CSP script-src 'self'
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('probe: boot-theme.js failed to load'));
      document.head.appendChild(s);
    }));
  }

  const masked = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('boot-pending'));

  for (const [label, seed] of [
    ['no mirror (fresh profile)', 'remove'],
    ['malformed mirror (non-object JSON)', 'malformed'],
  ] as const) {
    test(`early-return path — ${label}: mask is added, then lifted by the 4s failsafe`, async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await bootThenWaitForDebug(page);
      await page.evaluate(({ key, mode }: { key: string; mode: string }) => {
        localStorage.removeItem(key);
        // '123' parses to a number -> typeof !== 'object' -> early return #2.
        if (mode === 'malformed') localStorage.setItem(key, '123');
      }, { key: BOOT_MIRROR_KEY, mode: seed });
      await injectBootTheme(page);
      // boot-theme.js is synchronous: by onload the mask is already on <html>.
      expect(await masked(page), 'probe must mask the canvas like the real head script').toBe(true);
      // Nothing else can lift the mask now (render.js already ran), so still masked
      // shortly after proves the later lift is the failsafe, not a stray unmask.
      await page.waitForTimeout(600);
      expect(await masked(page), 'mask must survive until the failsafe fires (no stray unmask)').toBe(true);
      await expect.poll(() => masked(page), {
        timeout: BOOT_FAILSAFE_MS + 6000,
        message: 'failsafe must lift the mask on the early-return path (P-92-1 regression)',
      }).toBe(false);
      await ctx.close();
    });
  }

  test('source contract: the failsafe is armed before every early return', async () => {
    const boot = fs.readFileSync(path.join(ROOT, 'ntp', 'boot-theme.js'), 'utf8');
    const timerIdx = boot.indexOf(BOOT_TIMER_SRC);
    expect(timerIdx, 'boot-theme.js must register the 4s failsafe').toBeGreaterThanOrEqual(0);
    const earlyReturns = [...boot.matchAll(/\breturn;/g)].map((m) => m.index as number);
    expect(earlyReturns.length, 'boot-theme.js early-return sites (P-92-1)').toBeGreaterThanOrEqual(2);
    for (const idx of earlyReturns) {
      expect(timerIdx, 'the failsafe must be armed before every early return (ticket 104 / B68)').toBeLessThan(idx);
    }
    expect(boot.split("root.classList.remove('boot-pending')").length - 1,
      'exactly one failsafe registration (no duplicated timer)').toBe(1);
    expect(boot.indexOf("classList.add('boot-pending')"), 'mask added before the failsafe').toBeLessThan(timerIdx);
  });
});
