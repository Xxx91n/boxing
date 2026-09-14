#!/usr/bin/env node
// Ticket 100 (architecture-recovery) - A-054 / B64: calver 版本面一致性门禁。
//
// 被检面(任一不一致即 exit 1):
//   1. manifest.json version            2. manifest.json version_name
//   3. package.json version             4. package-lock.json version + 根包 version
//   5. docs/release-notes/<ver>.md      6. CHANGELOG.md 的 ## [<ver>] 小节
//   7. ntp/index.html 静态版本脚注      8. 单调性: 不得低于已发行最高版本
//
// 为什么 CalVer 必须非零填充 (2026.9.15, 不能写 2026.09.15) - 三方硬约束:
//   - Chrome Web Store: 1-4 个 0..65535 整数, 非零整数不得以 0 开头 (032 非法)
//     https://developer.chrome.com/docs/extensions/reference/manifest/version
//   - AMO: 版本串须匹配 (0|[1-9][0-9]{0,8}) 逐段形式, 同样禁前导零
//     https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/version
//   - npm/semver: package.json.version 须可解析为 semver, 数字标识符禁前导零
//   前导零一处出现即同时踩三条, 因此按硬错误处理, 不做风格提示。
//
// 为什么 release-notes 文件名是硬依赖: .github/workflows/build.yml 以
//   body_path: docs/release-notes/<version>.md
// 作为 GitHub Release 正文 SSOT, 文件缺失即发行步骤失败。
//
// 接入: package.json 的 pretest (CI 主 lane, 与 import-graph-guard /
// migration-golden-guard / css-balance-guard 同一阻断纪律)。
// pre-commit 可选: 本仓库 .git/hooks/pre-commit 由 GitButler 托管, 它会在提交前
// 链式调用 .git/hooks/pre-commit-user; 需要本地拦截时把本脚本挂到后者即可,
// 不要覆盖 GitButler 的钩子本体。CI 侧 pretest 是权威门禁。
//
// Usage: node scripts/calver-guard.mjs [--json]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NL = String.fromCharCode(10);

const NOTES_DIR = "docs/release-notes";
const CHANGELOG_REL = "CHANGELOG.md";
const FOOTER_REL = "ntp/index.html";
const FOOTER_PREFIX = "Boxing v";
const FIXTURE_VERSION = "2026.9.15";
const BASE_TAGS = ["v2026.9.9", "v2026.9.10", "v2026.9.11", "v2026.9.12"];

// 文档面(不阻断, 仅提示): 只收“纯当前口径”文档 —— 这两处的版本号只应等于当前版本。
// 刻意排除 docs/store-publishing-plan.md 与 docs/store-assets/STORE-COPY.md:
// 前者含历史 grill 决策行 (发行号 2026.9.12), 后者含区间写法 (2026.9.12+),
// 二者天然携带旧版本号, 纳入扫描只会产生常驻噪声, 反而训练人忽略告警。
const ADVISORY_DOCS = [
  "AGENTS.md",
  "docs/publishing-guide.md",
];

// YYYY.M.D, 月/日非零填充。刻意不用尾部锚点: 用匹配长度 == 串长判定全匹配。
const CALVER_RE = /^([1-9][0-9]{3}).(0|[1-9][0-9]?).(0|[1-9][0-9]?)/;
const CALVER_SCAN_RE = /(?:^|[^0-9.])([1-9][0-9]{3}.(?:0|[1-9][0-9]?).(?:0|[1-9][0-9]?))(?![0-9])/g;

function calverParts(v) {
  if (typeof v !== "string" || v.length === 0) return null;
  const m = CALVER_RE.exec(v);
  if (!m || m[0].length !== v.length) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return [y, mo, d];
}

function cmpCalver(a, b) {
  const pa = calverParts(a);
  const pb = calverParts(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

function readJsonRel(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { missing: true, rel: rel };
  try {
    return { value: JSON.parse(fs.readFileSync(abs, "utf8")), rel: rel };
  } catch (e) {
    return { error: String(e && e.message), rel: rel };
  }
}

function readTextRel(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { missing: true, rel: rel };
  return { text: fs.readFileSync(abs, "utf8"), rel: rel };
}

function readTags(root) {
  try {
    const out = execFileSync("git", ["tag", "--list"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split(NL).map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    return null;
  }
}

function findCalvers(text) {
  const out = [];
  CALVER_SCAN_RE.lastIndex = 0;
  let m;
  while ((m = CALVER_SCAN_RE.exec(text)) !== null) {
    const v = m[1];
    if (calverParts(v) && out.indexOf(v) < 0) out.push(v);
  }
  return out;
}

export function checkVersionSurface(root, tags) {
  const errors = [];
  const warnings = [];
  const fail = (code, msg) => errors.push({ code: code, msg: msg });

  const mf = readJsonRel(root, "manifest.json");
  if (mf.missing || mf.error) {
    fail("BX-CALVER-000", "无法解析 manifest.json: " + (mf.missing ? "文件缺失" : mf.error));
    return { errors: errors, warnings: warnings, version: null };
  }
  const version = mf.value && mf.value.version;
  const versionName = mf.value && mf.value.version_name;

  // 1. 格式
  if (!calverParts(version)) {
    fail("BX-CALVER-001", "manifest.version 不是合法 CalVer (YYYY.M.D, 非零填充): " + JSON.stringify(version) + " - 前导零会同时违反 CWS/AMO/semver");
  }

  // 2. version_name
  if (typeof versionName !== "string" || versionName.length === 0) {
    fail("BX-CALVER-002", "manifest.version_name 缺失; 商店展示面与更新面会分裂");
  } else if (versionName !== version) {
    fail("BX-CALVER-003", "manifest.version_name (" + versionName + ") != manifest.version (" + version + ")");
  }

  // 3. package.json
  const pk = readJsonRel(root, "package.json");
  if (pk.missing || pk.error) {
    fail("BX-CALVER-004", "无法解析 package.json: " + (pk.missing ? "文件缺失" : pk.error));
  } else if (pk.value.version !== version) {
    fail("BX-CALVER-005", "package.json version (" + pk.value.version + ") != manifest.version (" + version + ")");
  }

  // 4. package-lock.json
  const lk = readJsonRel(root, "package-lock.json");
  if (lk.missing || lk.error) {
    fail("BX-CALVER-006", "无法解析 package-lock.json: " + (lk.missing ? "文件缺失" : lk.error));
  } else {
    if (lk.value.version !== version) {
      fail("BX-CALVER-007", "package-lock.json version (" + lk.value.version + ") != manifest.version (" + version + ")");
    }
    const selfEntry = lk.value.packages && lk.value.packages[""];
    if (selfEntry && selfEntry.version !== version) {
      fail("BX-CALVER-008", "package-lock.json 根包 version (" + selfEntry.version + ") != manifest.version (" + version + ")");
    }
  }

  // 5. release-notes 文件名 (build.yml body_path 硬依赖)
  const notesRel = NOTES_DIR + "/" + version + ".md";
  if (!fs.existsSync(path.join(root, notesRel))) {
    fail("BX-CALVER-009", "缺少 " + notesRel + " - build.yml 以该文件为 Release body_path, 缺失即发行失败");
  }

  // 6. CHANGELOG 小节
  const cl = readTextRel(root, CHANGELOG_REL);
  const heading = "## [" + version + "]";
  if (cl.missing) {
    fail("BX-CALVER-010", CHANGELOG_REL + " 缺失");
  } else if (cl.text.indexOf(heading) < 0) {
    fail("BX-CALVER-011", CHANGELOG_REL + " 缺少小节标题 " + heading);
  }

  // 7. ntp 静态版本脚注
  const ft = readTextRel(root, FOOTER_REL);
  if (ft.missing) {
    fail("BX-CALVER-012", FOOTER_REL + " 缺失");
  } else if (ft.text.indexOf(FOOTER_PREFIX + version) < 0) {
    fail("BX-CALVER-013", FOOTER_REL + " 缺少静态版本脚注 " + FOOTER_PREFIX + version);
  }

  // 8. 单调性: 不得回退/重发已发行版本号 (ADR-0017: 2026.9.12 持有不热修)
  if (Array.isArray(tags)) {
    const released = tags
      .map((t) => (t.charAt(0) === "v" ? t.slice(1) : null))
      .filter((v) => calverParts(v));
    if (released.length > 0) {
      released.sort(cmpCalver);
      const highest = released[released.length - 1];
      if (cmpCalver(version, highest) < 0) {
        fail("BX-CALVER-014", "manifest.version (" + version + ") 低于已发行最高版本 " + highest + " - 版本号不可回退或重发旧号");
      }
    }
  }

  // 文档面: 仅提示
  for (const rel of ADVISORY_DOCS) {
    const doc = readTextRel(root, rel);
    if (doc.missing) continue;
    const found = findCalvers(doc.text).filter((v) => v !== version);
    if (found.length > 0) {
      warnings.push({ code: "BX-CALVER-W", msg: rel + " 提到非当前版本号 " + found.join(", ") + " (当前 " + version + ") - 文档口径漂移, 不阻断" });
    }
  }

  return { errors: errors, warnings: warnings, version: version };
}

function buildFixture(dir, v, opts) {
  const o = opts || {};
  const pick = (k) => (o[k] === undefined ? v : o[k]);
  fs.mkdirSync(path.join(dir, "docs", "release-notes"), { recursive: true });
  fs.mkdirSync(path.join(dir, "ntp"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ version: v, version_name: pick("versionName") }, null, 2) + NL
  );
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fixture", version: pick("pkgVersion") }, null, 2) + NL);
  fs.writeFileSync(
    path.join(dir, "package-lock.json"),
    JSON.stringify({ name: "fixture", version: pick("lockVersion"), packages: { "": { name: "fixture", version: pick("lockSelfVersion") } } }, null, 2) + NL
  );
  if (o.notes !== false) {
    fs.writeFileSync(path.join(dir, "docs", "release-notes", v + ".md"), "# Fixture " + v + NL);
  }
  fs.writeFileSync(
    path.join(dir, "CHANGELOG.md"),
    "# Changelog" + NL + NL + "## [" + pick("changelogVersion") + "] - 2026-09-15" + NL + NL + "- fixture" + NL
  );
  fs.writeFileSync(
    path.join(dir, "ntp", "index.html"),
    "<div>" + NL + "<p class=" + String.fromCharCode(34) + "modal__version" + String.fromCharCode(34) + ">" + FOOTER_PREFIX + pick("footerVersion") + "</p>" + NL + "</div>" + NL
  );
}

function selfCheck() {
  const failures = [];
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "boxing-calver-guard-"));
  const cases = [
    { name: "positive: 八面一致", v: FIXTURE_VERSION, opts: {}, expect: [] },
    { name: "positive: 版本等于已发行最高 tag 不得误报", v: FIXTURE_VERSION, opts: {}, tags: ["v2026.9.15"], expect: [] },
    { name: "negative: version_name 漂移", v: FIXTURE_VERSION, opts: { versionName: "2026.9.14" }, expect: ["BX-CALVER-003"] },
    { name: "negative: version_name 缺失", v: FIXTURE_VERSION, opts: { versionName: "" }, expect: ["BX-CALVER-002"] },
    { name: "negative: package.json 漂移", v: FIXTURE_VERSION, opts: { pkgVersion: "2026.9.14" }, expect: ["BX-CALVER-005"] },
    { name: "negative: package-lock root 漂移", v: FIXTURE_VERSION, opts: { lockVersion: "2026.9.14" }, expect: ["BX-CALVER-007"] },
    { name: "negative: package-lock 根包 漂移", v: FIXTURE_VERSION, opts: { lockSelfVersion: "2026.9.14" }, expect: ["BX-CALVER-008"] },
    { name: "negative: release-notes 文件缺失", v: FIXTURE_VERSION, opts: { notes: false }, expect: ["BX-CALVER-009"] },
    { name: "negative: CHANGELOG 小节缺失", v: FIXTURE_VERSION, opts: { changelogVersion: "2026.9.14" }, expect: ["BX-CALVER-011"] },
    { name: "negative: ntp 脚注漂移", v: FIXTURE_VERSION, opts: { footerVersion: "2026.9.14" }, expect: ["BX-CALVER-013"] },
    { name: "negative: 非 CalVer (semver 3.7.8)", v: "3.7.8", opts: {}, expect: ["BX-CALVER-001"] },
    { name: "negative: 前导零 2026.09.15", v: "2026.09.15", opts: {}, expect: ["BX-CALVER-001"] },
    { name: "negative: 回退到已发行版本号", v: "2026.9.11", opts: {}, tags: ["v2026.9.12"], expect: ["BX-CALVER-014"] },
  ];
  try {
    cases.forEach((c, i) => {
      const dir = path.join(base, "case-" + i);
      buildFixture(dir, c.v, c.opts);
      const r = checkVersionSurface(dir, c.tags || BASE_TAGS);
      const codes = r.errors.map((e) => e.code);
      const missing = c.expect.filter((code) => codes.indexOf(code) < 0);
      if (missing.length > 0) {
        failures.push("self-check [" + c.name + "]: 期望错误码 " + missing.join(",") + " 未出现 (实际: " + (codes.join(",") || "无") + ")");
      }
      if (c.expect.length === 0 && r.errors.length > 0) {
        failures.push("self-check [" + c.name + "]: 期望零错误, 实际 " + codes.join(","));
      }
    });
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
    } catch (e) {
      /* 临时目录清理失败不影响门禁结论 */
    }
  }
  return failures;
}

function main() {
  const asJson = process.argv.slice(2).indexOf("--json") >= 0;
  const selfFailures = selfCheck();
  const result = checkVersionSurface(ROOT, readTags(ROOT));
  const failed = selfFailures.length > 0 || result.errors.length > 0;

  if (asJson) {
    process.stdout.write(JSON.stringify({ ok: !failed, version: result.version, selfCheckFailures: selfFailures, errors: result.errors, warnings: result.warnings }, null, 2) + NL);
    process.exit(failed ? 1 : 0);
  }

  if (selfFailures.length > 0) {
    console.error("[calver-guard] 负向自检失败 (门禁自身失职, 视同构建失败):");
    selfFailures.forEach((f) => console.error("  - " + f));
  } else {
    console.log("[calver-guard] 负向自检: 13 例通过 (2 正例 + 11 反例)");
  }
  result.warnings.forEach((w) => console.warn("[calver-guard] WARN " + w.code + " " + w.msg));
  if (result.errors.length > 0) {
    console.error("[calver-guard] 版本面一致性校验失败 (version=" + result.version + "):");
    result.errors.forEach((e) => console.error("  " + e.code + " " + e.msg));
  } else {
    console.log("[calver-guard] OK version=" + result.version + " (manifest version/version_name, package.json, package-lock x2, release-notes, CHANGELOG, ntp 脚注, 单调性 共 8 面一致)");
  }
  process.exit(failed ? 1 : 0);
}

main();
