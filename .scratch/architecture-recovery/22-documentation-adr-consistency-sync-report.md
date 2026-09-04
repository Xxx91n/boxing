# Ticket 22 Closure Report — Documentation and ADR consistency sync

- 日期: 2026-09-04
- 票: 22 documentation and ADR consistency sync (Blocked by: 19 ✅ 已闭环, 21 ✅ 已闭环)
- 状态: done
- 对应 handoff / issue: `.scratch/architecture-recovery/handoffs/22-…md` / `issues/22-…md`
- 载体说明: 本窗口无 ctx\_\* 工具，按启动器降级条款以内置文件读取读全必读清单（14 项全读），全部程序化校验用 Node 脚本承载（`.codex-tmp/t22-audit.mjs` / `t22-audit2.mjs`），仅蒸馏结论回传上下文。
- 范围: 纯文档票 — 零行为改动、零依赖新增、零源码/manifest/测试改动。

## §A handoff 完成定义逐项核验

| # | 完成定义 | 结果 | 证据 |
|---|---|---|---|
| 1 | Every current module appears in the module map and stale line-count claims are gone | ✅ | Node 实测 14 个 `ntp/*.js` 模块在 AGENTS.md 模块图与 docs/CONTEXT.md Project Summary 中 0 缺失；陈旧行数/行号声明全部修正（见 §B-3/§B-4） |
| 2 | Stale ADR status and old-location references are superseded or corrected | ✅ | ADR-0013 状态 Proposed→Accepted-Implemented；`ntp.js:1923`→conn-layer.js:642（历史值以 "originally" 保留）；ADR-0016 依赖方向段以票 21 机检守卫勘误取代（见 §B-2/§B-4） |
| 3 | Manifest and agent rules that no longer match the source manifest are removed or rewritten | ✅ | manifest-contract.md browserSettings 红线整段重写；AGENTS.md/CONTEXT.md 连带 browserSettings 归因句同步修正（见 §B-1） |
| 4 | All referenced paths resolve and a search finds no remaining old-location claim | ✅ | Node 路径解析 8 份文档全部引用可解析（唯一真实断链 performance-anti-patterns.md → ADR-0013 相对路径已修）；`ntp.js:\d{4}` 裸引用全仓权威文档 0 命中；字节检查 8 份文档 BOM=0 / 控制字节=0 / U+FFFD=0 / strict UTF-8 全过；`git diff --check` CLEAN |
| 5 | Closure report exists | ✅ | 本文件 |

## §B Node 程序化审计发现 → 修复对照（不接受自述一致）

### B-1 manifest 契约与源 manifest 不符（round4 点名项）
- **实测**: `manifest.json` permissions = `[storage, tabs, bookmarks, unlimitedStorage, alarms]`，**无 browserSettings**、无 optional_host_permissions；background 双声明与 gecko 块在位；版本 `2026.8.21`（calver）。
- **史据**: `git show dc623af`（2026-07-29 安全审计）— "remove unused 'browserSettings' permission from source (Chrome direct-load was warning; Firefox build auto-pushes it via build.mjs)"。
- **机检**: `build.mjs:52` Firefox tailor 注入 browserSettings；`build.mjs:56` Chrome tailor 防御性滤除；`build.mjs` A9 段将 host_permissions 移为 Chrome dist 的 optional_host_permissions。`ntp/popups.js` 的 `browser.browserSettings.openBookmarksInNewTabs` 调用带 `typeof browser` + 可选链 + try/catch 守卫（无权限安全降级）。
- **修复**: `docs/agents/manifest-contract.md` 整文件重写 — 四字段红线改为"三字段保留（service_worker+scripts 双声明、gecko）+ browserSettings 仅由 Firefox tailor 构建期注入"；BX-MANIFEST-001/003 同步改写并补 A9 事实；标题 v3.7.0+ → 2026 calver。连带修 `AGENTS.md`（契约节标题/描述、001..005→001..007、dev-load tip 的 browserSettings 归因弱化为 "older checkouts"）与根 `CONTEXT.md`（L3/L24 两处 "Chrome 拒载因 browserSettings" 归因改正）。

### B-2 ADR-0016 与票 21 实测 import 图矛盾（round4 点名项）
- **实测**: `scripts/import-graph-guard.mjs` exit 0，`{ok:true, modules:14, edges:48, violations:[]}`；feature 级兄弟 import（settings-ui/onboarding/sync-engine → render 等）为守卫白名单内的合法边。
- **修复**: ADR-0016 "模块间依赖方向" 段重写为与守卫一致的边描述 + 2026-09-04 勘误注记（"本节文字与守卫冲突时，以守卫实测为准"，指向 21 报告 §B 与 `test/cluster-map.json`）；"现 L958-2118" → "拆分前 L958-2118" 历史化并补现址说明；Consequences "~1.1k 行" → "994 行（2026-09-04 实测）"。

### B-3 ADR-0013 状态与实现脱节（round4 点名项）
- **实测**: Phase 1 已落地 — `buildSpatialGrid`(utils.js:43)/`querySpatialNearby`(导出于 utils.js:240)/`elasticSnap` 第 7 参可选预建网格(utils.js:89-95)；`moveGroupTogether`(conn-layer.js:642) 每调用构建一次网格(conn-layer.js:668/702，源内 "ADR-0013 BX-PERF-001" 注释 L640/667/701)。Phase 2 亦落地 — `__linePool`(conn-layer.js:23, "ADR-0013 BX-PERF-002" 注释, LINE_POOL_CAP 封顶)。
- **修复**: 整文件重写 — Status "Proposed — not yet implemented" → "Accepted — implemented"；新增 Implementation Status 节记录落地位置与**实现形态偏差**（原草案的持久化 `__spatialGrid`/`__spatialGridDirty` 未落地，实态为每调用重建，多标签失效性因此天然成立）；`ntp.js:1923` → "originally ntp/ntp.js:1923; after the module split conn-layer.js L642"；历史草案节明确标注 superseded。

### B-4 编码损伤修复（保留 Unicode 原义，不引入替换字符）
- **实测（字节级）**: ADR-0013 — BOM(EF BB BF) + 0x1b@333 + 0x08@4532 + 0x1b@4712（首字母被吃: `lasticSnap`/`uildSpatialGrid`）；performance-anti-patterns.md — 0x07@411 + 0x08@1101 + 0x08@1121 + 0x07@1779（`pplyExternalLayout`/`oxMidPoint`×2/`ddEventListener`），另有 4 处无控制字节的缺字（`enderCanvas`×3、`emoveEventListener`）与断链 `(docs/adr/0013-…)`（自 docs/agents/ 相对解析不存在）。
- **修复**: 两文件整文件重写（Node fs.writeFileSync，UTF-8 无 BOM，LF）— 恢复全部被吃首字母；`ntp.js:3960` → "originally ntp/ntp.js:3960; … lives in ntp/storage.js"；断链改 `../adr/0013-…`；A2 行 "to fixed" 补正 "now fixed"。
- **连带**: docs/CONTEXT.md 两处 "chrome.storage.local limit 5MB" 与同文件 L88/AGENTS.md SEC-08 的 A6 事实（storage.local + unlimitedStorage）自相矛盾 — 补 quota superseded 注记（Q5=C 决议本身不变）。

### B-5 AGENTS.md 陈旧计数
- **实测**: manifest 版本 `2026.8.21`（calver）；`test/tests/` 实际 33 个 spec 文件（31 `boxing-*` + `data-recovery.spec.ts` + `extension-test.spec.ts`，`ls` 实证）。
- **修复**: "Current extension | Boxing v3.7.0" → "Boxing (manifest version 2026.8.21, calver)"；"29 specs total" → "33 spec files (31 boxing-*, plus data-recovery/extension-test)"；pretest import-graph guard 门禁写进测试节。

### B-6 无需改动项（审计通过，防误伤说明）
- `docs/DESIGN.md`: 路径解析 9/9、无陈旧模式、字节干净（票 17 已清）— 零改动。
- 模块图完整性: AGENTS.md 模块图与 docs/CONTEXT.md Project Summary 均已含全部 14 模块（票 17 已补 conn-layer/popups 等）— 本票零改动。
- ADR-0016 的历史行数（原始 6055 行、拆分前 2207 行）为决策时快照，按票 17 政策保留（已带历史标记）。

## §C 机检验证汇总（全部 Node 实测，非自述）

1. 字节检查: 8 份权威文档 BOM=0、控制字节=0、U+FFFD=0、TextDecoder strict UTF-8 全过（初轮 U+FFFD 命中经查为 shell 转义伪影，String.fromCharCode(0xFFFD) 复测为 0）。
2. 旧位置搜索: `ntp.js:\d{4}` 裸引用（剔除 "originally …" 历史标注）0 命中；"not yet implemented" 0 命中；`现 L\d+` / `~1.1k` / `v3.7.0` / `29 specs` 0 命中。
3. 路径解析: 8 份文档 md-link + code-path 全量解析，唯一真实断链已修；其余未解析项均为外部 URL / glob / 占位符记法（`boxing-*.spec.ts`、`_locales/<lang>/…`、`dist/boxing-{chrome,firefox}/`）。
4. 模块图: 14 个 `ntp/*.js` 在两处权威模块图 0 缺失。
5. 守卫门禁: `node scripts/import-graph-guard.mjs` exit 0（14 模块 / 48 边 / 0 违规）。
6. 测试断言兼容: `boxing-build-pipeline.spec.ts` 对 AGENTS.md 的两个内容断言字符串（`BX-MANIFEST-004b`、`stale`）逐一确认原样在位。
7. `git diff --check` CLEAN（LF 保持，无 CRLF 引入）。

## §D 版本控制（WORKFLOW §4.2）

- GitButler 独立分支 `ticket-22-doc-adr-consistency`，`but diff` 认领本票 8 个文件（7 修复 + 本报告）后 `but commit`；不 push、不开 PR。
- 并行窗改动（`.scratch/**` 其他票报告、`dev-chrome` 删除等）未认领、未触碰。

## §E 偏离与诚实声明

1. handoff "Suggested skills" 列出 `$neat-freak` / `$handoff` — 两名均不在本窗口可用 skill 目录（Skill 工具仅可调用在列 skill），按降级条款未调用，以本报告代收口交接。
2. 纯文档票未跑满额 Playwright 车道（票 15 教训：markdown-only 票满车道假失败，`--last-failed` 收敛即可；本票额外以字符串断言直查代替，见 §C-6）。
3. ADR-0013 历史草案节与历史行数按 ADR 不可变记录惯例保留并显式标注 superseded/historical，未做 bulk rewrite（16 ADR grandfathered 政策不变）。
