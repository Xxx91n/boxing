# Report — 61 README 发行声明收窄（P1）

- 日期: 2026-09-12
- 身份: 实施票 61 子窗口（覆盖 A-015）
- 必读清单: 全部读毕（handoffs/61 · issues/61 · spec.md Wave7 · decision-ledger.md A-015 · WORKFLOW.md §4.2/§4.4 · AGENTS.md · docs/CONTEXT.md · docs/adr/0017 · .scratch/wave7-flash-grill/decision-ledger.md）
- 调研: 无新增调研问题，复用已索引事实源并逐项实测（不幻觉）:
  - GitHub Releases 权威状态: `gh release list` → **v2026.9.11 Latest**（2026-09-09T17:45:30Z, isPrerelease=false, isDraft=false）+ v2026.9.9 首公开发布
  - 发行包内版本: run 34384723535 三 OS 日志 `BOXING_BUILD_VERSION: 2026.9.11`；build.mjs L64 注入 dist manifest → 包内 manifest version = 2026.9.11
  - tag v2026.9.11 = f2ab29c（main 祖先链确认，`git branch --contains` 含 main）；v2026.9.9..v2026.9.11 实际变更 = 8 commits（`git log`）+ diff --stat（build.yml/store-listings/manifest description）
  - 现状违规面（grep 实测）: README L27 徽章 ready-to-use · L32 extension_version 2026.9.12 徽章 · L79 IMPORTANT "Ready-to-use packages are published" · docs/i18n/README.hi.md L68 同类 TIP
  - CHANGELOG 现状: 顶部 [2026.9.12] "Store-readiness release" 宣称 + 无 v2026.9.11 条目（止于 [2026.9.9]）

## 改动（本票 delta: 主路径 README.md + docs/history/CHANGELOG*）

| 文件 | 改动 |
|---|---|
| README.md | ① Install 徽章 "Install — ready-to-use packages" → "Latest published release: v2026.9.11"（shields 文案 Latest_published-v2026.9.11）② extension_version-2026.9.12 徽章 → latest_published_release-v2026.9.11 徽章，链接指向 tag v2026.9.11，alt 注明 "newer builds ship only after the G-A/G-B/G-C release gate" ③ IMPORTANT 块收窄: "Latest published release: v2026.9.11 (published 2026-09-09)"，明确 These are the only packages this README describes as published；newer builds (including current main) are not released yet — ship only after passing the release gate (G-A/G-B/G-C) per ADR-0017；candidates stay draft/pre-release until then；删除指向 .scratch 验证报告的悬空链接 |
| CHANGELOG.md | ① [2026.9.12] → [Unreleased]，去 "Store-readiness release" 宣称与 "Version strings unified to 2026.9.12" 条目，头部声明 Not released yet + ADR-0017 门禁语义 + latest published = v2026.9.11 ② 新增 [2026.9.11] - 2026-09-09 真实条目（素材 = gh release view v2026.9.11 body + tag f2ab29c 的 git log/diff --stat）: manifest description 缩到 131 字符（Edge/Chrome 132 上限）、品牌图标由 build 管线再生（白体 logo-light-theme + macOS setup-python）、AMO+Edge 商店文案包、amo_sign 输入 |
| docs/i18n/README.hi.md | L68 TIP "Ready-to-use packages are published" → "Latest published release: v2026.9.11"，同步门禁语义（README 主路径改动的宣称收窄不完整的残留面，全仓一致） |

## i18n README 同步策略（handoff 要求在报告说明）

扫描 14 份 docs/i18n/README.* 副本: 仅 README.hi.md 含 "Ready-to-use packages are published" 宣称（其余 13 份 0 命中，其安装区不含 ready-to-use 类表述），已同步修复。策略: 只修含违规宣称的副本，不批量重写 13 份干净副本（避免无关 diff 与翻译漂移）；后续版本发布时由 README 主路径 → i18n 副本的同步票统一治理。

## AC 核验（issues/61 五项）

- [x] Install/徽章区改为 Latest published release: v2026.9.11 — README 两徽章 + hi.md TIP 均改为真实表述（5 处 "Latest published...v2026.9.11" 命中）
- [x] 说明后续构建须过 G-A/G-B/G-C 后发布；候选保持 draft/pre-release 语义 — README IMPORTANT 块 + CHANGELOG [Unreleased] 头部均含
- [x] CHANGELOG 补 v2026.9.11 条目 — `## [2026.9.11] - 2026-09-09`（顺序 Unreleased < 2026.9.11 < 2026.9.9）
- [x] 全文不得出现「2026.9.12 / main 包 ready-to-use」类宣称 — grep 实测: "ready-to-use|ready to use" 0 matches；"2026.9.12" 在 README/CHANGELOG/i18n README 0 matches（CHANGELOG 正文未提及 2026.9.12 版本串；AGENTS.md/代码内 2026.9.12 不属 README 面与本票 delta）
- [x] 与 ADR-0017 一致性自检（下节）

## ADR-0017 一致性自检

- README/CHANGELOG 现在只陈述已发布事实（v2026.9.11），并写明 G-A∧G-B∧G-C 合取后才 ship — 与 ADR-0017「任一未满足禁止 tag/禁止宣称可发行，唯一合法表述为不可发行」一致。
- "candidates stay draft/pre-release until then" 对应 ADR-0017 灰度条款（可信测试者/自托管 zip canary、unlisted canary）。
- 未修改 ADR-0017、WORKFLOW.md 或任何门禁定义（D-003 负向约束遵守: 不扩 ADR-0017 合取）。
- [Unreleased] 头部链接 ADR-0017，未宣称任何新包 ready-to-use。

## 验证（结果可复核）

- `grep -rniE "ready-to-use|ready to use" README.md CHANGELOG.md docs/i18n/README.* docs/history/boxing-changelog.md` → 0 matches
- `grep -rnE "2026\.9\.12" README.md CHANGELOG.md docs/i18n/README.*` → 0 matches
- `git diff --check README.md CHANGELOG.md docs/i18n/README.hi.md` → clean（无空白/换行残留）
- `git diff --stat` → CHANGELOG.md +28/-5 · README.md +17/-7 · docs/i18n/README.hi.md +2/-2
- 纯文档票（markdown only）: 无 dist 契约面，`npm run build` 不适用（票15 先例）; 本机 CI-only 构建政策禁止本地构建/测试运行，验证以 grep/diff 命令结果为准。
- 边界: 未动 docs/CONTEXT.md（他人会话改动，git status 显示 M）、未动 docs/history/boxing-changelog.md（v3.3..v3.6.6 历史账本，本票 delta 的 CHANGELOG 指根目录 Keep-a-Changelog 主账本 CHANGELOG.md，无 v2026.9.11 条目缺口在主账本）、未改写他人提交、未 push。

## 版本控制

遵循 WORKFLOW §4.2: `but diff` 确认改动 → `but commit -b <branch> -m "<msg>" <id...>`（只选本票 3 文件），不 push、不开 PR。
