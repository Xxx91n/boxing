# Wave 5 W2 返工轮首脑复核 — 42R / 43R / 45R

> 日期: 2026-09-11 · 方法: 不信返工自述；工作区实跑 + 源码抽查 + guard
> 前置: 首轮 W2 复核 reports/W2-wave5-brain-review.md（42/43 FAIL，45 residual）

## 总览

| 票 | 返工声称 | 首脑实跑 | 裁决 |
|---|---|---|---|
| 42R | T42-1 绿 + 3 passed | **T42-1 snapCount=1 / 3 passed (5.5s)** | **PASS** |
| 43R | saveLayout 防覆盖 + 5 passed | **5 passed (19.0s)**；saveLayout 含 archive+plausible | **PASS** |
| 45R | gate2 写路径扫描 | **6 passed + 1 skipped**；migration 4 passed；guard 28/28 | **PASS** |

---

## 42R — 声明 → 证据 → 结论

| 声明 | 证据 | 结论 |
|---|---|---|
| 基线 1 failed 已贴 | 报告 §7 有 T42-1 snapCount:0 | PASS |
| 根因 = credentials flush unload 写回 | 报告插桩；非 viewState 路线 | PASS（记录） |
| harness 中和 flushCredentials | spec 内 seed 后置 null | PASS |
| 产品 COW 序未改 | 本窗 delta 仅 harness | PASS |
| **3 passed 绿跑** | 首脑实跑：T42-1 snapCount:1, snapKeepsLegacyShape:true；**3 passed** | **PASS** |
| 邻道 41 无干扰 | 报告 7 passed；未重跑全套但 42 独立绿 | PASS-with-note |

**裁决: PASS**（分支 ticket-42R-cow-test-harness-fix @ vqm；待 land）

---

## 43R — 声明 → 证据 → 结论

| 声明 | 证据 | 结论 |
|---|---|---|
| 基线 archiveKeys=0 已贴 | 报告与首脑一致 | PASS |
| **saveLayout 先 archive 再 merge** | storage.js L494–506：`!isPlausibleLayout → archiveCorruptMain`；remote=null | **PASS（产品 P0 已修）** |
| legacy 写路径顺序 | 报告称合法分支才写回 | PASS（loadHasFork true） |
| harness addInitScript 无 reload | 报告 | PASS |
| **data-recovery 5 passed** | 首脑实跑 **5 passed (19.0s)** | **PASS** |
| issue 状态 done | 报告称已同步 | PASS |
| 报告 §5 勘误 | 已划掉错误 isPlausible 表述 | PASS |

**裁决: PASS**（产品+测试双修成立；分支 ticket-43 @ vuv；待 land）

---

## 45R — 声明 → 证据 → 结论

| 声明 | 证据 | 结论 |
|---|---|---|
| gate2 改 scanBackgroundWrites | spec 含 scanBackgroundWrites；not.toContain 仅存于**注释禁令说明** | PASS |
| t42 合法读放行 | data-golden 6 passed（含 gate2） | PASS |
| gate2b 自测 | gate2b 存在 | PASS |
| SHA 账本纠正 | 报告 Branch 行更新 | PASS |
| **migration-golden 4 passed** | 首脑实跑 | PASS |
| **data-golden 6 passed 1 skipped** | 首脑实跑 (11.1s) | PASS |
| golden guard 28/28 | 首脑实跑 | PASS |
| import-graph-guard ok | violations:[] | PASS |

**裁决: PASS**（flip 前置条件已满足；分支 ci/data-golden-gates @ ovx/vrp；待 land）

---

## 账本维度

| 票 | 报告 A/验收 ID | 核对 |
|---|---|---|
| 42R | 基线/根因/harness/绿跑/门禁 | 全有实物或已贴输出 |
| 43R | 8 验收项（产品 fork + E2E + 状态） | saveLayout 防覆盖 + 5 passed 实证 |
| 45R | gate2 语义 + CI 34603576542 + 账本 | 本地实跑等价绿；主 lane 终证仍待合入后 CI |

无缺失/弱化/跑偏需另列。

---

## 过程违规（本轮）

| ID | 内容 |
|---|---|
| 无新增 P0 | 返工窗均先基线再改、贴 passed 行、追加不覆盖 |
| NOTE | 43 报告曾提及并行 42R untracked probe 导致 CM-1 红——当前工作区 untracked=[] 已消失 |
| NOTE | 45 主 lane 11 failed 仍为 W1/W2 前 baseline，非本三票引入；发行门禁未解除 |

---

## Frontier（返工轮后重算）

```
DONE-CODE (待 land 到 main):
  40 · 41/41R · 47          (W1 已 land)
  42R · 43R · 45R           (W2 返工绿，待 land)

W3 立即可开工:
  44  导入/WebDAV 合并+冲突副本   (Blocked by 43 — 43R 已绿)

W4 等 42R+45 land 后:
  46  发行门禁 ADR-0017 + 检查单

红线: 全量 CI 绿 + 人工 zip 黄金路径 + Pages 200 前禁止 tag / 禁止宣称可发行
```
