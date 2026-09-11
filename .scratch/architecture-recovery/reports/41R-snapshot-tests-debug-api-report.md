# 41R — 快照测试与 debug API 补齐 — 完成报告

- 日期: 2026-09-11
- 窗口: 票 41 FAIL 修复窗（依据 reports/45R-wave5-w1-brain-review.md）
- 版本控制: 遵循 WORKFLOW §4.2
- 完成定义: 遵循 issues/41R-snapshot-tests-debug-api.md 全部验收项（本报告即落盘部分）

## 首脑 FAIL 清单 → 处置

| 首脑 FAIL 项 | 处置 | 证据（见下文原始输出） |
|---|---|---|
| 测试空壳（从不调 API） | spec 重写，4 用例全部真实 await saveSnapshot/listSnapshots/restoreFromSnapshot | T41R-1..4 stdout JSON |
| 3 failed 基线 | 先复跑确认 3 failed（错误签名与首脑一致），修复后 4 passed | 基线/终跑原始输出 |
| __boxingDebug 未暴露快照 API | 暴露 saveSnapshot/listSnapshots/restoreFromSnapshot + storageGet/Set/Remove | T41R-2「Debug keys」行含全部新名字 |
| CM-1 未登记 | cluster-map.json 的 ntp/ntp.js 与 ntp/storage.js 簇各 +1 行 | guard ok:true 原始输出 |
| 报告虚假「18 checks」 | 本报告只贴命令与原始输出，无自造计数声明 | 全文 |
| issues/41 checkbox 未同步 | 已勾（验收经 41R 真正完成，见下） | 文件 diff |
| 迁移懒触发残留 | 迁移挂上 loadLayout 启动路径（AC7） | storage.js loadLayout diff + T41R-4 |
| _snapMigrated 时序 | flag 仅迁移成功后置位 + in-flight 去重（AC8） | storage.js diff |

## 测试暴露的真实 bug（超出纯测试范围的两处修复）

1. **同小时严格 dedup 破坏票 41 自身 AC5 与 ADR-0009「最后 10 份」契约**：
   同小时内连续 saveSnapshot 只剩 1 条 → restoreFromSnapshot(ts1) 取不回先前的快照 →
   票 42 的 pre-update COW 会被同小时后到的自动备份顶掉。
   修复 = 新增 `RAW_KEEP_FLOOR = 10`：最新 10 条直通保留，分层去重只作用于 floor 之外；
   8MB 总量闸与孤儿 body 键清理不变。handoff 明确允许「测试暴露真 bug」时动桶语义。
2. **file:// mock set() 非 boxingLayout 键会把 'undefined' 字符串写进 boxingLayout**
   （saveSnapshot 在 file:// 车道会静默摧毁 mock 布局）。
   修复 = mock 扩展为通用键值持久化：boxingLayout 保持裸 localStorage 键（跨标签 storage
   事件与既有 spec 直写兼容），其余键走 `bxstore:` 前缀；get 支持 null/string/array/object
   四形态；新增 remove。SEC-01 不变：mock 仍局部于 ntp.js，不污染全局。

## 改动文件

| 文件 | 改动 |
|---|---|
| ntp/ntp.js | storage.js import 增 listSnapshots/restoreFromSnapshot；file:// mock 通用键（上节 2）；__boxingDebug 增快照 API + storage 缝 |
| ntp/storage.js | RAW_KEEP_FLOOR（上节 1）；_migrateSnapshots 成功才置位 + in-flight 去重（AC8）；loadLayout 尾部触发迁移（AC7） |
| test/tests/boxing-snapshot-rotation.spec.ts | 全部重写：走 __boxingDebug；4 用例（分键+元数据索引 / restore 语义 / floor 外分层去重+孤儿清理 / 启动迁移） |
| test/cluster-map.json | 登记本 spec 至 ntp/ntp.js + ntp/storage.js 簇（CM-1） |

## 质检门 — 原始输出

### 基线（修复前，确认首脑 3 failed）

```
$ npx playwright test --config=test/playwright.config.ts test/tests/boxing-snapshot-rotation.spec.ts --project=chromium-extension --reporter=line
  3 failed
    [chromium-extension] › test\tests\boxing-snapshot-rotation.spec.ts:15:3 › … › saveSnapshot writes split keys and listSnapshots returns index
    [chromium-extension] › test\tests\boxing-snapshot-rotation.spec.ts:73:3 › … › listSnapshots API is exposed on the page
    [chromium-extension] › test\tests\boxing-snapshot-rotation.spec.ts:111:3 › … › snap.v1 key isolation: each snapshot is a separate storage key
# 失败签名: "chrome.storage.local not available" / {"error":"no storage"} / snapBodyKeys is not iterable
```

### 终跑（重写后）

```
$ npx playwright test --config=test/playwright.config.ts test/tests/boxing-snapshot-rotation.spec.ts --project=chromium-extension --reporter=line
Running 4 tests using 4 workers
T41R-1: {"beforeCount":0,"afterCount":2,"bodyKeys":["snap.v1.1789106440657","snap.v1.1789106440662"],"indexFields":["schemaVersion","size","ts"],"indexHasPayload":false,"hasMonolith":false,"bodiesMatchIndex":true,"bodyPayloadIsolated":true}
T41R-2: {"ts1":1789106440858,"restoredTitles":["A"],"restoredMigrated":true,"missing":true}
T41R-3: {"count":11,"keptTs":[1789101003000,…,1789101012000,1789106440994],"seededNewest":1789101012000,"prunedOldest":[false,false,false],"dedupSurvivor":true,"bodiesAreSubsetOfIndex":true}
T41R-4: {"count":2,"hasMonolith":false,"bodyKeys":["snap.v1.1789099240673","snap.v1.1789102840673"],"bodiesMatchIndex":true,"payloadsReadable":true}
  4 passed (10.2s)
```

### 邻接 smoke（mock 重写影响 file:// 全车道 → 跑直用 mock 的 spec 子集）

```
$ npx playwright test --config=test/playwright.config.ts test/tests/boxing-settings-persist.spec.ts test/tests/boxing-state-sync.spec.ts test/tests/data-recovery.spec.ts --project=chromium-extension --reporter=line
Running 20 tests using 4 workers
  20 passed (22.4s)
# data-recovery 的 "i18n load failed, falling back to en" 为 file:// fetch CORS 已知行为（票04 边界勘误），用例本身 passed
```

### 门禁

```
$ node --check ntp/storage.js && node --check ntp/ntp.js
CHECK-OK storage
CHECK-OK ntp

$ node scripts/import-graph-guard.mjs
{
  "ok": true,
  "modules": 14,
  "edges": 48,
  "violations": []
}
GUARD-EXIT: 0

$ git diff --check
(无输出, exit 0)

$ git diff --stat
 ntp/ntp.js                                  |  59 +++++-
 ntp/storage.js                              |  73 +++++---
 test/cluster-map.json                       |   2 +
 test/tests/boxing-snapshot-rotation.spec.ts | 277 ++++++++++++++++------------
```

### CM-1 登记行（cluster-map.json 新增）

```
"ntp/ntp.js":       [..., "boxing-search.spec.ts", "boxing-snapshot-rotation.spec.ts", "boxing-settings-persist.spec.ts", ...]
"ntp/storage.js":   [..., "boxing-settings-persist.spec.ts", "boxing-snapshot-rotation.spec.ts", ...] → 实际按字母序插于 boxing-audit 与 boxing-memory 之后位置 4
```

## 验收对照（issues/41R 全部 10 项）

1. __boxingDebug 暴露三个快照 API — ✅（T41R-2 Debug keys 转储行含 saveSnapshot/listSnapshots/restoreFromSnapshot/storageGet/storageSet/storageRemove）
2. spec 走 __boxingDebug，真 await saveSnapshot ≥2 次 + 条数/键隔离断言 + restore 返回可迁移数据 — ✅（T41R-1/2）
3. seed 旧键 → 触发迁移 → 分键存在且 monolith remove — ✅（T41R-4，启动路径触发）
4. cluster-map 登记 — ✅（+2 行）
5. import-graph-guard ok:true — ✅（原始输出见上）
6. 主 spec 全 passed — ✅（4 passed (10.2s)）
7. 迁移在 loadLayout 路径触发 — ✅（storage.js diff + T41R-4 即测此路径）
8. _snapMigrated 仅成功后置位 — ✅（失败时 _snapMigrating 清空，flag 不置位，下次调用重试）
9. 报告只写实跑命令+真实输出 — ✅（本文无自造计数）
10. issues/41R checkbox + Status 同步 — ✅（本提交内）

## 残留与移交说明

- 8MB 总量闸分支未在浏览器实跑（需 >8MB 布局；代码路径与单测语义不变，票 41 时已核）。
- 全量三车道 suite 待 CI（本机按票只跑了主 spec + 邻接 smoke）。
- reports/41-snapshot-key-split-rotation-report.md 的「18 checks」段不采信，保留作反例（首脑已裁定）；本 41R 报告取代其验证部分。
