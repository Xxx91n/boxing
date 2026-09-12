# Wave6 W1 首脑复核报告（票 48–54）

> 日期: 2026-09-12 · 方法: 不信报告自述；守卫实跑 + 源码锚点 grep + Playwright 实跑 + issue 勾选 + but 分支落位
> 红线: G-A/G-B 未齐 → **仍不可 tag / 不可宣称可发行**

## 0. 分支落位（but status 实测）

| 票 | 分支 | 提交形态 |
|---|---|---|
| 48 | ticket/48-ci-residual-red-clear | fix + docs |
| 49 | ticket/49-g-b-manual-golden-path | docs only（G-B 待人工） |
| 50 | t50-dr-time-machine-rollback-ui（stacked on t51） | feat + docs |
| 51 | t51-dr-export-envelope-rpo | feat ynu + 卷入 t52 hunk（违规） |
| 52 | ticket-52-url-open-mode-sametab-default | test+docs；源码 hunk 在 t51 a714de8 |
| 53 | ticket/53-css-brace-balance-gate | feat + docs |
| 54 | ticket/54-data-golden-blocking | ci + docs（已 push origin） |

## 1. 声明 → 证据 → 结论

### 48 — PASS-with-caveats
- 豁免 checker 实跑: scripts/waiver-ledger-check.mjs exit 0（2 行字段齐、未过期、never-quarantine 清）
- issue 7/7 勾选；#9 未关闭（A-007）
- caveat: main 全量 test.yml 未在本复核定谳 → G-A 仍 open

### 49 — PASS 交付面 / G-B 未满足
- evidence/49-g-b-manual-golden-path/ 齐（checklist/execution-card/writeback/chrome+firefox）
- 不宣称 G-B 完成；用户实机待回传

### 50 — PASS
- 锚点: settings-ui performSnapshotRollback + storage replaceLayoutFromRestored
- 首脑实跑 boxing-time-machine-rollback.spec.ts → **3 passed (7.1s)**
- issue 4/4 勾选

### 51 — PASS-with-process-caveat
- 代码锚点: buildExportEnvelope / fullPackage / readDrBodies / unwrapExportEnvelope 在盘
- ADR-0009 含 RPO/RTO（grep 计数 10）+ 票51 修订节；ADR-0017 有交叉
- **process: issue 0/6 勾选，Status 仍 ready-for-agent**

### 52 — PASS-with-violation
- index.html sameTab selected 置前；ntp.js 仅显式 newTab 才新标签；utils migrate 默认展开
- **违规 V6-52-1: t51 a714de8 卷走 t52 源码 hunk**

### 53 — PASS
- node scripts/css-balance-guard.mjs → exit 0（6 源 + 负向自检）
- build.mjs --css-only → A8.0 ntp.css 产物 64402B
- node --check 相关 .mjs 全过；issue 3/3

### 54 — PASS-with-process-caveat
- test.yml 无 continue-on-error、无 BOXING_EXCLUDE_GREP；data-golden job 保留
- **process: issue 0/3 勾选**；分支已 push origin

## 2. 守卫/构建总表（首脑实跑）

| 门 | 结果 |
|---|---|
| css-balance-guard | exit 0 |
| migration-golden-guard | 28/28 ok |
| waiver-ledger-check | exit 0 |
| build --css-only | ntp.css 64402B |
| node --check storage/settings-ui/utils/sync-engine + mjs | 全过 |
| time-machine Playwright | 3 passed |

## 3. 过程违规（不追认）

| ID | 级别 | 描述 |
|---|---|---|
| V6-51-1 | P1 | 报告完成但 issue AC 0/6 |
| V6-54-1 | P1 | 报告完成但 issue AC 0/3 |
| V6-52-1 | P1 | t51 文件级提交卷走 t52 源码 hunk（a714de8） |
| V6-54-push | NOTE | t54 已 push origin |
| V6-48-ci | NOTE | G-A 未在 main 全量定谳 |

## 4. A-xxx 覆盖

全部 A-001..A-011 均有实现/交付证据；弱化项：A-006/008/010 对应 51/54 票面未关账；A-009 G-B 本体仍缺（预期内）。无功能跑偏。

## 5. Frontier

- 用户: 按 evidence/49 执行 G-B → 满足 G-B
- 首脑派发: land 48/50/51/52/53/54 后 main test.yml 定谳 G-A
- 卫生: 51/54 issue 勾选（返工窗或用户授权）
- P2: 55–59 不占带宽
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
