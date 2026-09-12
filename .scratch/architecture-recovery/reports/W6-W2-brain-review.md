# Wave6 W2 首脑复核报告（票 55–59）

> 日期: 2026-09-12 · 方法: 守卫实跑 + 源码锚点 + ref 实测 + issue 勾选；不信报告自述
> 红线: G-A/G-B 未齐 → 仍禁 tag / 禁宣称可发行

## 0. 分支落位

| 票 | 分支 | 形态 |
|---|---|---|
| 55 | t55-conflict-copy-resolve-ui | docs only（deferred） |
| 56 | ticket-56-…（docs commit c44d085） | 纯设计+ADR/CONTEXT |
| 57 | ticket/57-adr-0017-review | 日历检查点 docs |
| 58 | ticket/58-local-main-ref-align | ref 对齐 docs |
| 59 | ticket/59-sync-engine-empty-cred-no-write | fix sync-engine |

## 1. 声明 → 证据 → 结论

### 55 冲突 UI deferred — PASS
- issue 4/4 勾；Status=deferred
- 锚点实测: settings-ui data-conflict-row + storage archiveConflictLayouts/listConflictArchives 在盘
- 零产品代码（符合 A-003 deferred / A-010 P2 可见）

### 56 legacyReader 设计升格 — PASS
- issue 4/4；零源码（符合 AC「可不在本波落地代码」）
- ADR-0017 L46 含 RA-1..RA-6 具名清单 + never-quarantine 口径
- CONTEXT.md 含 frozen legacy reader 词条
- guard legacyReader 仍在 migration-golden-guard.mjs:52；migration 28/28 绿

### 57 ADR-0017 日历 — PASS（未到期分支）
- issue 仅勾「未到期则保持 open」1/4 — 正确
- 今日 2026-09-12 < 2026-10-12；ADR Review 未提前改
- 票保持 open，待到期窗回填三项

### 58 main ref 对齐 — PASS-with-note
- 首脑实测: git rev-parse main=origin/main=ffa55f8；left-right count 0/0
- issue 4/4；报告记录 be0d6b8→ffa55f8
- NOTE: 报告载明使用 git update-ref（CAS），非 but 写命令 — 见违规

### 59 空凭据冗余写 — PASS-with-process-caveat
- 代码锚点: sync-engine.js L767-816 urlChanged/userChanged no-change guard + flushUnsavedCredentials 四路变化守卫
- node --check sync-engine OK；import-graph 0 violations；migration-golden 28/28
- ticket-51 pre-restore 快照行未破坏（grep 仍在）
- process: issue 0/4 未勾；测试证据 deferred 到 CI

## 2. 守卫总表（本波实跑）

| 门 | 结果 |
|---|---|
| node --check ntp/sync-engine.js | 0 |
| import-graph-guard | 0 violations |
| migration-golden-guard | 28/28 |
| main...origin/main | 0 / 0 |

## 3. 过程违规（不追认）

| ID | 级别 | 描述 |
|---|---|---|
| V6-59-1 | P1 | 报告完成但 issue AC 0/4 未勾、Status 仍 ready-for-agent |
| V6-58-git | NOTE | 58 用 git update-ref 移动 main ref（非 but）；结果已核验正确，边界需你裁定是否追认 |

## 4. A-xxx 覆盖

| A-xxx | 票 | 证据 |
|---|---|---|
| A-003 | 55 | deferred 明确 + 冲突数据面已由 44/51 落地 |
| A-008 | 57 | 日历基线快照写明豁免到期先于复核日 |
| A-010 | 55,56,57,58,59 | 全立票；56/58/59 有实物；57 未到期正确 open |

无功能跑偏。56 落地接线、55 实施 UI 仍 deferred。

## 5. Frontier

Wave6 票 48–59 均已首脑复核（W1+W2）。

- 用户: G-B 实机（49）
- 首脑派发: land 全栈 → main test.yml 定谳 G-A（48 修绿+豁免+53/54 门禁）
- 卫生返工窗（无源码）: 51 / 54 / 59 issue 关账勾选
- 日历: 57 @ 2026-10-12；豁免台账 @ 2026-09-19
- 56 后续票: legacy-reader-frozen.mjs 接线（非本波）
- 55 后续票: 冲突 UI 实施（deferred）
- 禁止: tag / 宣称可发行 / close #9

---

## 补测轮次（首脑，2026-09-12 · 回应「未构建未测试」）

### 构建与守卫

| 项 | 结果 |
|---|---|
| node .github/scripts/build.mjs | **BUILD_EXIT=0** DONE_BUILD；chrome+firefox zip/crx/xpi 产出 |
| css-balance-guard | exit 0 |
| import-graph-guard | 0 violations |
| migration-golden-guard | 28/28 |
| waiver-ledger-check | exit 0 |

### Playwright 实跑（chromium-extension, workers=1）

| 套件 | 结果 |
|---|---|
| time-machine-rollback + import-merge + data-recovery | **12 passed (1.2m)** |
| settings-persist 全量 | 首轮 **T52-b failed**；修复后 **T52-a..e 5 passed (49.2s)** |
| data-golden 全量 | **gate 4 failed**（跨页 revision 3 vs 4）；solo 曾绿 → **flaky**（state-sync 家族，非本波引入）；5 passed + 1 skip |

### T52-b 缺陷定谳（测试缺陷，非产品缺陷）

- 现象: 点击 bm-row 后 URL 仍为 file:///.../index.html
- 根因: spec 调 `__boxingDebug.persistView()` — 只写 view-state，**不写 boxingLayout**；reload 后种子书签丢失，`.bm-row` 不存在，click 空操作
- 产品面: `openBookmarkUrl` 仅显式 newTab 开新标签，sameTab 走 location.href — **逻辑正确**
- 修复: 改为 `saveLayout()` + reload 后 `boxes.length>0` + `renderCanvas()`；复跑 **5/5 绿**

### 复核结论修订

| 票 | 修订后 |
|---|---|
| 52 | **PASS**（含 T52-b 测试缺陷修复后 5/5） |
| 48/50/51/53/54/55/56/57/58/59 | 维持原裁决；59 测试证据以本补测 data 面 12 passed + golden 除 gate4 外绿为辅证 |
| G-A | **仍未满足**（main 未 land；gate4 flaky 属基线家族） |

### 残留

- data-golden gate 4 跨页 flaky — 建议并入 48 残红/状态同步治理或另票
- 51/54/59 issue 关账仍未做
