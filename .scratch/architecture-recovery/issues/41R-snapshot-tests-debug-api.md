# 41R — 快照分键修复窗：重写测试 + 暴露 debug API + 门禁登记

**What to build:** 在票 41 生产代码（已存在 snap.v1 分键/轮转/迁移）基础上补齐验收半边：__boxingDebug 暴露快照 API；重写 Playwright 真正调用 saveSnapshot/listSnapshots/restoreFromSnapshot；补 boxingSnapshots[] 迁移用例；登记 cluster-map；修正迁移懒触发/flag 时序；报告与实跑一致。

**Blocked by:** None — can start immediately（基于已有 41 代码，不重做分键）

**Status:** ready-for-agent

## 首脑复核结论（必须先读）

见 reports/45R-wave5-w1-brain-review.md 票 41 节。生产代码 AC1–3 基本 PASS；测试/报告/门禁 FAIL。

## 验收

- [ ] ntp.js __boxingDebug 增加 saveSnapshot / listSnapshots / restoreFromSnapshot（或等价 async 包装）
- [ ] 重写 test/tests/boxing-snapshot-rotation.spec.ts：走 __boxingDebug；真正 await saveSnapshot() ≥2 次；listSnapshots 断言条数与键隔离；restoreFromSnapshot 返回可迁移数据
- [ ] 新增用例：seed storage 旧键 boxingSnapshots[] → 触发迁移 → 断言分键存在且 monolith 被 remove
- [ ] test/cluster-map.json 登记 boxing-snapshot-rotation.spec.ts（CM-1）
- [ ] import-graph-guard 或等价门禁 ok:true
- [ ] npx playwright test --config=test/playwright.config.ts test/tests/boxing-snapshot-rotation.spec.ts --project=chromium-extension 全部 passed
- [ ] 迁移在 loadLayout 路径触发（或文档证明为何可懒触发且升级路径安全）
- [ ] _snapMigrated 仅在迁移成功后置位
- [ ] 报告只写实跑命令+真实输出；禁止无产物的「N checks passed」
- [ ] issues/41R 的 AC checkbox 与 Status 同步

## 禁止

- 禁止再用 window.chrome.storage.local 作为 file:// 主 seam（SEC-01 mock 不污染全局）
- 禁止空壳断言（toBeDefined on 空数组 / 未调用的 API 名）
- 禁止虚假验证声明

## Out of scope

- 42/43/45 功能票
- 改轮转桶算法语义（P2 可另票）
