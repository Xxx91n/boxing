# Wave 5 W2 首脑对抗性复核 — 42 / 43 / 45

> 日期: 2026-09-11 · 方法: 不信自述；Node/guard 实跑 + Playwright 实跑 + 源码抽查 + 子代理 general-4/6
> 前置: W1 已 land（40/41R/47）；本波三票均在各自分支，**未 land**

## 总览

| 票 | 报告自述 | 首脑裁决 | 关键实证 |
|---|---|---|---|
| 42 COW | Implemented + AC 全勾 done | **FAIL** | T42-1 实跑 **1 failed**（snapCount=0）；产品代码序正确，验收测试被 unload flush 击穿 |
| 43 fork | Implemented | **FAIL** | data-recovery fork 用例 **1 failed**（archiveKeys=0）；issue Status 仍 ready-for-agent 与报告矛盾 |
| 45 golden | Implemented + CI evidence | **PASS-with-caveats** | fixtures 真实；guard 28/28；migration-golden **4 passed**；gate2 与 t42 碰撞已红 |

---

## 42 — 声明 → 证据 → 结论

| 声明/AC | 证据 | 结论 |
|---|---|---|
| bg 先 snapshot 再写 signal | storage.js/background 代码序 takePreUpdateSnapshot → boxingInstallSignal | PASS |
| NTP consume → ensure → loadLayout | ntp.js:827–832 | PASS |
| ensure/needsMigration/take 存在 | rg 命中 | PASS |
| node --check + import-graph-guard + golden guard | 全绿 | PASS |
| AC3 单测 pre-update 快照存在 | **T42-1 snapCount:0 → FAILED** | **FAIL** |
| AC4 无信号不回归 | T42-3 passed | PASS |
| issue 勾 done | 报告自陈「本地未跑」仍全勾 | **过程违规** |

**根因（子代理 general-4 插桩证实）**：seed→reload 时旧页 `pagehide`→`flushPendingViewStatePersist`→`saveLayout()` 把内存态（已迁移）写回 storage；新页 `ensurePreUpdateSnapshot` 见 `needsMigration=false` → 不拍快照。产品序正确，**测试 harness 未中和 unload flush**。

**裁决: FAIL** → 重发 **42R**

---

## 43 — 声明 → 证据 → 结论

| 声明/AC | 证据 | 结论 |
|---|---|---|
| archiveCorruptMain / CORRUPT_PREFIX / listCorruptArchives | storage.js 存在 | PASS |
| isPlausibleLayout | utils.js:196–201 | PASS |
| loadLayout 先归档再 crashRescue | storage.js:87–125 | PASS |
| refreshDataHealth + HTML + 14 locale | settings-ui / index.html / 14/14 | PASS |
| node --check + guard | 绿 | PASS |
| AC4 Playwright fork 用例 | **archiveKeys.length 0 → FAILED** | **FAIL** |
| issue Status/checkbox | 仍 `ready-for-agent` 全未勾，与报告 Implemented 矛盾 | **过程违规** |

**根因假设（与 42 同类）**：spec 模式 boot→setItem(corrupt)→reload；旧页 beforeunload `saveLayout` 用内存**合法** layout 覆盖刚注入的损坏主键 → 新页 never sees corrupt → 不归档。需 43R 用中和 flush / 非 NTP seed 验证。

**根因（子代理 general-5 深挖，升级为产品 P0）**：
1. E2E：boot→setItem(corrupt)→reload 时旧页 `saveLayout` 用内存合法 layout 覆盖损坏 seed。
2. **产品**：`saveLayout`（storage.js ~L491–501）读 stored 后 `migrateLayout` **无 isPlausibleLayout**，非法载荷静默降级 default 写回，**不写归档键** —— 违反「禁止无归档覆盖」（fork 只守 boot 读路径）。
3. 报告 §5「缺 version 可通过」与 `isPlausibleLayout` 代码矛盾。

**裁决: FAIL（含产品写路径 P0）** → 重发 **43R**（必须改 saveLayout，不得只改测试）

---

## 45 — 声明 → 证据 → 结论（子代理 general-6）

| 声明/AC | 证据 | 结论 |
|---|---|---|
| golden fixture 入库 | v1 / legacy-groups / legacy-v2，含真实 boxes/bookmarks | PASS |
| pretest + CI 阻断 | pretest 双 guard；migration-golden 4 passed | PASS |
| rollback expand/contract | 5 个 rollback 检查，但是**同文件 mock legacyReader** | WEAK PASS |
| cluster-map | 两 spec 已登记 | PASS |
| CI data-golden job success | run 34578668227 该 job success（workflow 整体 failure 为 baseline） | PASS |
| gate2 `bg not.toContain boxingLayout` | t42 合法**读** boxingLayout → 当前树 gate2 **FAIL** | **P1 碰撞** |
| 报告 SHA ba1e7e9 | dangling；分支 tip 实为 e614852 | **账本失真** |

**裁决: PASS-with-caveats** — 票本体可合并；**2026-09-18 flip 前必须 45R 修 gate2**。

---

## 过程违规（不追认）

| ID | 级别 | 内容 |
|---|---|---|
| **V5-42-1 P0** | 虚假关闭 | 报告「本地未跑」+ issue 全勾 done；T42-1 实跑红 |
| **V5-43-1 P0** | 状态矛盾 | 报告 Implemented vs issue ready-for-agent 未勾 |
| **V5-43-2 P0** | 未绿跑 | fork 用例实跑红，报告称 CI-only 未附 CI run |
| **V5-45-1 NOTE** | 账本 | ba1e7e9 dangling；真实 tip e614852 |
| **V5-45-2 NOTE** | 碰撞未预警 | gate2 与 t42 background 读路径必然冲突 |
| 通用 | CI-only | 三票均未提供完整 green CI run 链接作为 close-out |

---

## Frontier（重算）

```
FAIL → 必须返工后才解锁后续:
  42R  测试 harness 中和 unload flush + T42-1 绿 + 勾 AC 有证据
  43R  saveLayout 防无归档覆盖 + fork 用例绿 + issue 同步

PASS-with-caveats（可并行推进，flip 前修）:
  45R  gate2 改为写调用扫描（禁子串）；账本 SHA 纠正

W3 解锁: 43R 真 PASS → 44
W4 解锁: 42R + 45 完成 → 46（并应吸收 v2 一跳 gap 与 gate2 结论）

下一波可开工:
  立即并行: 42R · 43R · 45R
```
