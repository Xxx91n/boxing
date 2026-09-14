# Wave9.15 整轮收口审计（2026-09-14）

> 身份: 审计 Agent · 不信报告自述 · 硬验收本机重跑

## 1. 硬验收（本机重跑）

| 门 | 结果 |
|---|---|
| node --check 源/脚本 | 全过 |
| pretest 6 门 | import-graph / migration-golden / css-balance / calver / onboarding / locale-readme **全绿** |
| contrast-guard | 8/8 PASS |
| docs-link-guard | 8 refs 0 dead |
| waiver-ledger-check | exit 0（含撤账判据） |
| docs-pointer-check | 74 pointers 0 broken |
| npm run build | **DONE_BUILD** · 2026.9.15 zip/crx/xpi |

JSON: `reports/W915-closeout-hard-acceptance.json`

## 2. 发现与处置

| ID | 发现 | 处置 |
|---|---|---|
| **PACK-01** | 发行 zip 含 **40 个 `.scratch` 文件**（SKIP 未列） | `build.mjs` SKIP 增加 `".scratch"`；重建后 chrome/firefox zip **scratch=0** |

## 3. 交叉核对

- issues 96–106 Status ↔ README W915 表：一致（96=pending-ci，其余 done / done-with-named-F）
- A 账本 A-050..A-060 = implemented；**A-061 = current（执行动作，正确）**
- release-status.md 结论仍「不可发行」— **正确**（G-B 未声明）

## 4. 三层文档

| 层 | 状态 |
|---|---|
| docs/CONTEXT.md | Wave9.15 settle 已写 |
| docs/adr/0017 | 三门合取仍 normative；G-B 用户声明 |
| 代码/守卫 | 与 docs 契约一致（contrast/calver/onboarding/locale/docs-link） |

## 5. 账本结算

- A-050..A-060: **implemented**
- A-061: **current**（发行 G-A + 等 G-B；land 后改为 pending-ci）
- 实现决策已沉淀 `docs/release-status.md` + 各 docs 门禁文件

## 6. 合并

见下方执行记录（but pull → land whole stack → push）。

## 7. 发行准备

- `docs/release-notes/2026.9.15.md`（中文 body SSOT）
- `docs/release-notes/2026.9.15.en.md`（英文对照）
- 本地 G-B 包: `dist/boxing-chrome/release/chrome/boxing-2026.9.15.zip` · `dist/boxing-firefox/release/firefox/boxing-2026.9.15.zip`

## 8. Land 与发行 G-A（执行后回写）

- but pull → but land ticket/106-innerclip-b70 --whole-stack --yes → **pushed origin/main**
- 新 tip: `8a8798c9`
- ticket/* 与 wave915-grill-settle 分支已随 land 清理
- **AI Docs Governance** run 34857433250 = success（A-050 CI F 关闭）
- **发行 G-A test.yml** run [34857433215](https://github.com/Xxx91n/boxing/actions/runs/34857433215) = **success**（data-golden + 三 OS）
- 本地 G-B 包已重建（无 .scratch）：chrome/firefox `boxing-2026.9.15.zip`
