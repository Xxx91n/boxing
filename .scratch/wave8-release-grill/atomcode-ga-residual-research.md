# atomcode 深度调研 — G-A 残红分桶（run 34686760142）

> 日期: 2026-09-12 · 协议: D-005 · 串行一次一个 · 不修源码
> 必须回顾: decision-ledger 全部 current · docs/adr · CONTEXT.md · 工业心智模型
> 冲突处置: 禁止静默改向；冲突则 revised 旧 D-xxx + 新 D-xxx 呈报

## 0. 输入锚点

| 源 | 值 |
|---|---|
| 调查 run | **34686760142**（main，票 66 提交） |
| 结论 | failure：data-golden + ubuntu + macos + windows **全红** |
| 规模 | data-golden: 1 failed / 1 flaky；三 OS 主测各 ~36–37 failed / ~507–508 passed / 1 flaky / 5 skipped |
| 既有豁免基线 | run **34626507101**（票 48）：三 OS 已 failure；**data-golden 当时 success** |
| 中间 run | **34672647167**（票 59）：data-golden **failure** + 三 OS failure |
| 台账 | WORKFLOW §G-A：仅 2 条 active（auto-expand chromium、zoom-dblclick firefox） |
| never-quarantine 正则 | `data-golden|migration-golden|update-cow|snapshot-rotation|state-sync|data-recovery|import-merge|webdav|sync-ui|boxing-sync` |
| 候选包 | build 34689649760 **success**（2026.9.12, amo_sign=true, make_release=false） |

## 1. 已回顾的 current 决策（账本，无冲突预检）

| ID | 要点 | 与本调研 |
|---|---|---|
| W8 D-001 | 三轨 A→B→C | 本调研属轨 A |
| W8 D-002 | 发行号 2026.9.12，新 build，闪现进本版 | **无冲突**；G-A 红则 tag 仍禁 |
| W8 D-003 | G4/G5 基线 v2026.9.11 | 无冲突 |
| W8 D-004 | build 授权 amo_sign=true | 无冲突；包已绿 |
| W8 D-005 | 先分桶再决定修/豁免 | 本报告即交付物 |
| W7 A-008 | 修绿优先；数据完整性永不豁免；禁 waiver-first/永久豁免/Skip 失明 | **推荐必须服从** |
| W7 A-009 | G-B ready-for-human | 无冲突 |
| W7 D-002/D-003 | 零闪现不解耦记忆；闪现不设 G-D | 无冲突（但见 §4 假设 H1） |
| ADR-0017 | 可发行 = G-A∧G-B∧G-C | G-A 红 = 不可 tag |

**结论：本调研推荐与全部 current 决策对齐，无需 revised、无需新 D-xxx 改向。** 若后续要对「豁免名单」或「never-quarantine 家族」扩权，才走 revised。

## 2. 失败面分桶（unique 标题，双浏览器交叉后约 19 用例面）

### 桶 N — never-quarantine（禁豁免，只能修或退役）

| # | 用例面 | 签名摘要 | 为何 NQ |
|---|---|---|---|
| N1 | `boxing-data-golden` gate4 跨页 revision 收敛 | `settle2._meta.revision` ≠ `settle1._meta.revision`（spec L230） | 正则命中 `data-golden`；专用 job 亦红 |
| N2 | `boxing-state-sync` 双标签并发创建收敛 | concurrent creation converges without losing either | 正则命中 `state-sync` |
| N3 | `boxing-dr-export-envelope` AC4 WebDAV cloud-newer pull | pull snapshots diverged | 正则命中 `webdav` |
| N4 | `boxing-dr-export-envelope` AC1/AC2 导出信封/全量包 | 导出结构断言 | 数据容灾面（票 51/ADR-0009/0016）；精神等同 data-recovery/import-merge 家族，**建议升格 NQ**（见 §5 待拍板） |

### 桶 B — broken 签名（三 OS / 双浏览器一致失败，按台账规则不得豁免）

| # | 用例面 | 备注 |
|---|---|---|
| B1 | `conn-delete-action` 4 模式 persist across reload ×2 browsers | ctrl/shift/dbl/select+delete；`connCount` 期望 0 |
| B2 | `innerclip` 3 + `innerclip-pan` 1 | 视觉/裁剪契约 |
| B3 | `search` 2 | 大盒标题过滤 / 清空高亮 |
| B4 | `star-sync-audit` Scenario 1 | 跨标签 isParent 收敛（偏数据，**建议 NQ 评估**） |
| B5 | `zoom-arrow` 1 | 进大盒后箭头尺寸 |
| B6 | `empty-state` Bug5-dark | **票 48 曾作为 broken 修绿**，本 run 再现 → **回归嫌疑** |
| B7 | `popup-dragselect` 1 | 编辑弹层拖选 |
| B8 | `auto-expand` | 台账已有 active 豁免（chromium）；本 run firefox 面亦见 |

### 桶 F — flaky（同代码有时绿）

| # | 用例面 | 证据 |
|---|---|---|
| F1 | data-golden gate4 firefox | 三 OS 均记 **1 flaky**（与失败并存）→ 符合「同代码不同结果」 |
| F2 | auto-expand 60 vs 80 抖动 | 台账签名「expand height 60」历史 |

## 3. 工业心智模型（重点对照）

1. **broken vs flaky 分界（本仓台账已写、Datadog 7 天 / ICSE 2020）**  
   全签名一致失败 = broken，**不得豁免**。本次 B1–B7 双浏览器×三 OS 一致 → 按规则 **禁止写入豁免台账**。
2. **修绿优先，豁免是 queue 不是 graveyard（GitLab）**  
   现行台账仅 2 条 active，与「约 19 个失败面」严重不匹配——不能用 2 条豁免把 37 红说成 G-A 绿。
3. **never-quarantine（本仓 + 数据完整性工业惯例）**  
   data-golden / state-sync / webdav/export 红 = **发行阻断**，与 ADR-0017「数据完整性永不豁免」一致。
4. **CI 绿是必要不充分（ADR-0017 事故课）**  
   即便豁免合法，G-B 人工黄金路径仍独立。
5. **测试套件「全 OS 一致大面积红」工业解读**  
   通常不是 37 个独立真 bug，而是 **1–2 个根因**（就绪时序、遮罩、storage mock、迁移契约）放大。应用根因假说驱动，而不是逐条 waiver。

## 4. 根因假说（未定谳，供后续调查票）

| ID | 假说 | 支持 | 反对/缺口 |
|---|---|---|---|
| **H1** | **票 60 `html.boot-pending` 遮罩/时序** 改变首帧可见性与 init 节拍，e2e 在 unmask 前取样 | boot-theme 在 head 阻塞；4s failsafe；render 两处 remove；失败面含大量「可见性/尺寸/过滤」 | 基线 34626507101 **早于** 闪现 land 已三 OS 红；故 H1 只能解释**增量**，不能解释全部存量 |
| **H2** | 存量 broken 面（票 48 只修了 6 面中的 4 项，且 Bug5-dark 再现） | 票 48 文本自述；Bug5-dark 回归 | 需对照 34626507101 失败标题列表做集合差 |
| **H3** | data-golden gate4 flaky 家族（B45）升级为稳定红 | 专用 job 从 success→failure；revision 收敛竞态 | flaky 与 failed 并存，需单跑分界 |
| **H4** | 票 66 `RUNTIME_ONLY_SETTING_RE` 净化/同步面意外影响 e2e | 同步/导出面同时红 | 票 66 自述「还原对照无因果」——**未独立复核** |

**推荐调查顺序：集合差（34626507101 vs 34686760142）→ H1 时序（本地复现 innerclip/search/zoom-arrow）→ H3 单跑 gate4 → H4 还原实验复核。**

## 5. 推荐（供拍板）

### 立即裁定（不改 ADR-0017，不扩门禁）

1. **G-A 当前不成立。** 在 N 桶清零或退役、B 桶 broken 修绿之前，**禁止**把 37 红用「2 条 active 豁免」折算成绿。与 D-002 发行号 2026.9.12 **兼容**：包可以继续做 G-B 手顺，但 **tag 仍锁**。
2. **禁止**为 N1–N3（及建议的 N4/star-sync）写豁免行；`waiver-ledger-check.mjs` 正则会 exit≠0。
3. **禁止**把 B 桶 broken 写入豁免（台账规则 L98）。
4. 候选包 build 34689649760 **保留**作 G-B 取证；**G-A 治理与 G-B 人工可并行**（D-003 精神：门禁纯度 + 不互相当人质）。

### 建议立票（实施波，非本 grill 动手）

| 票 | 内容 | 优先级 |
|---|---|---|
| **T-GA1** | 集合差 + 根因定谳（H1–H4）；输出分桶终表 | **P0** |
| **T-GA2** | N 桶修绿：data-golden gate4、state-sync 并发、dr-export WebDAV | **P0** |
| **T-GA3** | B 桶 broken 修绿：conn-delete、innerclip、search、zoom-arrow、Bug5-dark 回归 | **P1** |
| **T-GA4** | （若 H1 成立）boot-pending 与 e2e 就绪契约对齐（**不回滚零闪现**，改测试等待或 unmask 时序） | **P1** |
| **T-GA5** | 既有 2 条 active 豁免到期复查；auto-expand/zoom-dblclick 单跑 | **P2** |

### 与 current 决策关系

- **无 revised。** D-001..D-005、A-008、ADR-0017 全部被推荐 **服从**，不是改写。
- 若你拍板「允许对 N4/star-sync 写豁免」或「G-A 在 G-B 后补」→ 才生成 **新 D-006** 并可能 **revised D-001/D-002 的发行路径表述**。

## 6. 信息缺口

- 34626507101 的逐条失败标题未与本次做程序化集合差（下一步调查票第一刀）。
- H4 票 66 还原对照未在本调研重跑。
- 本地 `npm test` 未在本调研会话重跑（时间成本高；应归属实施票）。

## 7. 覆盖自评

- current 账本: W8 D-001..D-005 + 关键 A-xxx/ADR 已回顾 ✓
- ADR/CONTEXT: ADR-0017/0009/0016 + never-quarantine/WORKFLOW §G-A ✓
- 工业模型: broken/flaky、queue-not-graveyard、NQ、必要不充分、根因优先 ✓
- 推荐+理由 ✓ · 冲突: **无** · temp: `.codex-tmp/ci-34686760142.log`（调查用，完成后可删）
