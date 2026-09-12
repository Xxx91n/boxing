# 65 — 统一用户可见版本串（P2）实施报告

- 覆盖 A-xxx: **A-019**（D-004#5 版本串 v3.7.8/v3.1 → 统一用户可见版本串）
- 阻塞: None (can start immediately)
- 范围: 主路径 `ntp/ntp.js` 注释与 debug 串（严格按启动器 delta；不动其他票文件）
- 版本控制: 遵循 WORKFLOW §4.2（GitButler `but` CLI；不 push、不开 PR）
- 完成定义: 遵循 handoff 内完成定义（AC 全勾 + 报告落盘 + 验证命令结果可复核）

## 一、必读清单读毕

prompts/65、handoffs/65、issues/65、spec.md（Wave7 节）、decision-ledger.md（A-019）、WORKFLOW.md §4.1/§4.2/§4.4、AGENTS.md（Boxing 特化段 + SEC 系列）、docs/CONTEXT.md、docs/adr/0017-release-data-gate.md、wave7-flash-grill/decision-ledger.md（D-004#5 原文）。

## 二、现状盘点（用户可见版本串）

| # | 位置 | 改前 | 性质 |
|---|---|---|---|
| 1 | ntp/ntp.js L1054 `debug(...)` | `init complete v3.7.8` | **用户可见**：DEBUG 开启时进控制台，用户抄进 issue |
| 2 | ntp/ntp.js L1 文件头 | `NTP core v3.1` | 过期 SemVer；与 calver 体系并存，构成"第五套版本号"观感 |
| 3 | ntp/ntp.js L203/L446 | `(v3.6.5+)` / `(v3.7.2)` | 段内特性出处标注（历史 SemVer），非扩展版本 |
| 4 | ntp/index.html L341 | `Boxing v2026.9.12` | 静态 calver 兜底（票 08） |
| 5 | ntp/settings-ui.js L256-264 | 运行时 `version_name || version` | 票 08 已落地的对齐范式 |
| 6 | manifest.json L6/L51 | `2026.9.12` / `version_name 2026.9.12` | 唯一写入方 |

## 三、对齐策略（不引入第五套版本号）

**一写三读**：

1. **唯一写入方** — `manifest.json` 的 `version` + `version_name`（calver）；`.github/scripts/build.mjs` 在构建期用 `BOXING_BUILD_VERSION` 同时覆盖两字段（票 08 已修复）。
2. **读方 A** — `ntp/index.html` 静态文案，仅作 file:// mock lane 兜底。
3. **读方 B** — `ntp/settings-ui.js` 运行时覆盖设置页脚。
4. **读方 C（本票新增）** — `ntp/ntp.js` 的 `__boxingVersion()` 运行时读取，供 `init complete` 日志使用。

**取值优先级**：`manifest.version_name || manifest.version`（与票 08 完全一致）。
**硬约束**：ntp.js 内不再出现任何版本字面量；`v3.6.5+` / `v3.7.2` 作为**特性历史出处**保留，并在文件头显式声明"非扩展版本"，历史明细在 docs/history/boxing-changelog.md。
**SEC-01**：只读 `globalThis.chrome?.runtime?.getManifest?.()`，不定义任何全局；file:// mock lane 无 chrome API 时降级为 `Boxing v(manifest unavailable)`。

## 四、改动

`ntp/ntp.js`（+22 / -2）：

1. L1 去掉 `v3.1`；L3-L8 新增对齐策略注释块（含 ADR-0017 事故复盘对准确版本号的硬要求）。
2. L209-L223 新增 `__boxingVersion()`，catch 按 BX-EXPLORE-015 B 类注释。
3. L1075 `debug('init complete v3.7.8', ...)` → `debug('init complete ' + __boxingVersion(), ...)`。

## 五、验证（结果可复核）

| 命令 / 手段 | 结果 |
|---|---|
| `node --check ntp/ntp.js` | exit 0（SYNTAX_OK） |
| `npm run pretest`（import-graph + migration-golden + css-balance） | import-graph ok / 14 modules / 48 edges / 0 violations；golden 28/28；css-balance OK |
| `git diff --check` | clean（无 CR/LF 与空白问题） |
| `npm run test:changed` | **384 passed / 5 skipped / 0 failed**（chromium-extension，10.1m） |
| `__boxingVersion()` 行为矩阵（真实源码抽取 + 桩化 chrome） | C1 双字段→`Boxing v2026.9.12`；C2 仅 version→`Boxing v2026.9.12`；C3 无 getManifest→降级串；C4 无 chrome API→降级串；C5 getManifest 抛错→降级串 |
| 残留扫描 `ntp/ntp.js` | `v3.7.8` / `core v3.1` 零命中 |

## 六、未覆盖（有意为之）

- `background.js` L67 `v3.7.10` 注释、`ntp/base.css` L889 `v3.7.3`、`ntp/settings.css` L947 `v3.6.2`：均为**特性出处/审计标注**，非用户可见版本串，且不在本票 delta（主路径 ntp/ntp.js）。
- `docs/history/*`、`.codex-tmp/*`、`dist/`：历史层与他人临时产物，禁改。
- `ntp/ntp.css` 为构建产物（ADR-0011），不编辑。

## 七、调研

本票无新增调研问题，复用 Wave7 已索引 atomcode 结论：D-004#5（版本串 P2 立票）与 ADR-0017（事故复盘要求准确版本号）。未新增 atomcode 调用。

## 八、遗留

- `codegraph sync`（BX-EXPLORE-003）待 CLI 可用后执行；本窗口探测到的 CLI 可用性见下节备注。
