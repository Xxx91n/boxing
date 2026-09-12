/** Boxing \u2014 boot theme (ticket 60, Wave7 zero-flash: A-013/A-014).
 * Classic blocking script (NOT type=module): runs synchronously in head, before any body
 * content can paint. Reads the paint-critical mirror key (boxingBootTheme.v1) written by
 * persist.js on the successful boxingLayout persist path, and applies theme variables +
 * dark-mode class + base font size BEFORE the first visible frame \u2014 the FART fix
 * (CSS-Tricks blocking-boot pattern; chrome.storage is always async, localStorage is the
 * sync-readable first-paint cache, Wave7 D-002 paint-critical boot mirror).
 * Constraints (spec D-002 negatives):
 *   - NOT a second layout source: only theme/darkMode/fontSize are mirrored from
 *     boxingLayout; loadSettings() re-applies authoritative values after load. The
 *     mirror never feeds loadLayout / migrate / sync / export.
 *   - Zero imports (an import would make this a module and defer it past first paint),
 *     zero chrome./browser. API access (CSP script-src self + import-graph guard B-6).
 *   - No inline script (CSP script-src self): external file only.
 *   - Mirror absent/unreadable (fresh profile / cleared localStorage) -> one-shot
 *     default-theme downgrade, corrected by loadSettings() hydration right after (AC).
 *   - Adds html.boot-pending: canvas content stays invisible until renderCanvas /
 *     _enterLargeBox complete (removed in render.js); a 4s failsafe clears it if init
 *     dies, so content is never permanently hidden. The page background is already the
 *     remembered theme color, so the hidden state never shows a wrong/default UI. */
(function () {
  'use strict';
  var KEY = 'boxingBootTheme.v1';
  var root = document.documentElement;
  root.classList.add('boot-pending');
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return; // fresh profile: default beige theme is already correct
    var v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return;
    applyPack(v.theme);
    if (v.darkMode) root.classList.add('ntp--dark');
    if (typeof v.fontSize === 'number' && v.fontSize >= 11 && v.fontSize <= 20) {
      root.style.setProperty('--font-size-base', v.fontSize + 'px');
    }
  } catch (e) {
    /* silent: mirror parse failed \u2014 loadSettings() re-applies authoritative values */
  }
  function applyPack(themeKey) {
    // ADR-0012 five curated theme packs, inlined verbatim from persist.js THEME_PACKS.
    // Keep in sync with ntp/persist.js THEME_PACKS \u2014 edit both together.
    var PACKS = {
      beige: {
        light: {
          warm: { '50': '#F1EEE8', '100': '#EEE9E1', '150': '#EBE5DB', '200': '#E0D8CB', '300': '#ECE8E0', '700': '#A89F92', '800': '#7B7167', '850': '#3B342C', '900': '#2A2520' },
          accent: { '300': '#B89878', '500': '#A08060', '600': '#6E5540' }
        },
        dark: {
          warm: { '50': '#1C1814', '100': '#242019', '150': '#27231C', '200': '#2C2820', '300': '#322E25', '700': '#928878', '800': '#A89E8E', '850': '#C4B89E', '900': '#D8D0C0' },
          accent: { '300': '#C4A882', '500': '#BFA075', '600': '#D4B88C' }
        }
      },
      graphite: {
        light: {
          warm: { '50': '#E8E8E8', '100': '#DEDEDE', '150': '#D6D6D6', '200': '#CCCCCC', '300': '#DCDCDC', '700': '#9A9A9A', '800': '#6E6E6E', '850': '#3A3A3A', '900': '#282828' },
          accent: { '300': '#787878', '500': '#5C5C5C', '600': '#3A3A3A' }
        },
        dark: {
          warm: { '50': '#1A1A1A', '100': '#222222', '150': '#262626', '200': '#2A2A2A', '300': '#303030', '700': '#909090', '800': '#A8A8A8', '850': '#C0C0C0', '900': '#D4D4D4' },
          accent: { '300': '#A8A8A8', '500': '#989898', '600': '#B8B8B8' }
        }
      },
      coastal: {
        light: {
          warm: { '50': '#EDF2F3', '100': '#E6EDF0', '150': '#DFE8EC', '200': '#CDDDE4', '300': '#E4EDF2', '700': '#7A99A8', '800': '#5A7B8C', '850': '#2E4452', '900': '#1E2E38' },
          accent: { '300': '#7EAAB8', '500': '#5A8A9A', '600': '#3E6A7A' }
        },
        dark: {
          warm: { '50': '#141C20', '100': '#1A242A', '150': '#1E2830', '200': '#242E36', '300': '#28343C', '700': '#8AAAB8', '800': '#A0C0CE', '850': '#BED8E4', '900': '#D4E8F0' },
          accent: { '300': '#A8C8D8', '500': '#92B4C8', '600': '#C0DCEC' }
        }
      },
      forest: {
        light: {
          warm: { '50': '#EDF1EC', '100': '#E6EBE2', '150': '#DFE6DB', '200': '#CDD9C8', '300': '#E2E9DF', '700': '#7A9478', '800': '#5A7458', '850': '#2E3E2C', '900': '#1E2E1C' },
          accent: { '300': '#88BA8A', '500': '#6A9870', '600': '#4A7850' }
        },
        dark: {
          warm: { '50': '#141C14', '100': '#1A2418', '150': '#1E2820', '200': '#242E28', '300': '#28342C', '700': '#88A88C', '800': '#A0C8A4', '850': '#BED8C2', '900': '#D4E8D8' },
          accent: { '300': '#A8C8AC', '500': '#92B496', '600': '#C0DCC4' }
        }
      },
      pure: {
        light: {
          warm: { '50': '#F8F8F8', '100': '#F4F4F4', '150': '#F0F0F0', '200': '#E4E4E4', '300': '#E8E8E8', '700': '#A0A0A0', '800': '#747474', '850': '#3A3A3A', '900': '#1E1E1E' },
          accent: { '300': '#888888', '500': '#777777', '600': '#555555' }
        },
        dark: {
          warm: { '50': '#1A1A1A', '100': '#222222', '150': '#262626', '200': '#2C2C2C', '300': '#303030', '700': '#909090', '800': '#AAAAAA', '850': '#C4C4C4', '900': '#D4D4D4' },
          accent: { '300': '#AAAAAA', '500': '#999999', '600': '#CCCCCC' }
        }
      }
    };
    var pack = PACKS[themeKey] || PACKS.beige;
    setVars(pack.light.warm, pack.dark.warm, '--color-warm-');
    setVars(pack.light.accent, pack.dark.accent, '--color-accent-');
    setRgb(pack.light.accent['500'], '--accent-500-rgb');
    setRgb(pack.dark.accent['500'], '--accent-dark-500-rgb');
  }
  function setVars(light, dark, prefix) {
    for (var tier in light) {
      if (!Object.prototype.hasOwnProperty.call(light, tier)) continue;
      if (root.style.getPropertyValue(prefix + tier) !== light[tier]) root.style.setProperty(prefix + tier, light[tier]);
      if (root.style.getPropertyValue(prefix + 'dark-' + tier) !== dark[tier]) root.style.setProperty(prefix + 'dark-' + tier, dark[tier]);
    }
  }
  function setRgb(hex, name) {
    var triplet = hexToRgbTriplet(hex);
    if (root.style.getPropertyValue(name) !== triplet) root.style.setProperty(name, triplet);
  }
  // Same format as ntp/utils.js hexToRgbTriplet (persist.js applyTheme parity).
  function hexToRgbTriplet(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + ', ' + g + ', ' + b;
  }
  // Failsafe: if ntp.js init never completes (crash before first render), unmask
  // content after 4s so the page is never permanently blank.
  setTimeout(function () { root.classList.remove('boot-pending'); }, 4000);
})();
