# 93 本地验证原始证据（紧凑提取）

> 本文件为两份原始 Playwright 运行日志的**精简提取**（原始 164KB 日志已按临时产物纪律清理，避免入库诊断噪声）。
> 权威定谳仍为 CI（run 34773593267 / corroboration 34778641702），本文件仅供复核本地锚点。

## 1. 本地全量 e2e（CI 口径 workers=2）

命令: `npm test -- --workers=2`

汇总: **2 failed | 5 skipped | 603 passed (17.2m)**

失败明细（2 条）:

- 1) [firefox-extension] › test\tests\boxing-import-merge.spec.ts:142:3 › Ticket 44 — restore = merge + conflict copies › AC3: declining merge opens the explicit overwrite-restore confirm; taking it replaces after a pre-snapshot
  - 错误: TimeoutError: page.goto: Timeout 10000ms exceeded.
  - 栈: (n/a)
- 2) [firefox-extension] › test\tests\boxing-viewstate-sync.spec.ts:24:3 › Cross-tab per-box viewState sync (BX-DEV-111N+) › inner zoom/pan written on tab A reaches tab B via storage.onChanged
  - 错误: Error: page.goto: Test ended.
  - 栈: (n/a)

判读: 两例均为 `page.goto` 导航超时（file:// 车道），属 WORKFLOW §6 票01 记载的本地 headed 饥饿/争用家族；本地 `retries: 0`（config 票20）故直接计为 failed，CI 的 `retries: 2` 会将其收敛为 flaky。

## 2. 本地失败集复跑（仓内 ticket-15 方法）

命令: `npm run test:failed`

```
> boxing@2026.9.12 test:failed
> node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts --last-failed


Running 2 tests using 2 workers

[1/2] [firefox-extension] › test\tests\boxing-viewstate-sync.spec.ts:24:3 › Cross-tab per-box viewState sync (BX-DEV-111N+) › inner zoom/pan written on tab A reaches tab B via storage.onChanged
[2/2] [firefox-extension] › test\tests\boxing-import-merge.spec.ts:142:3 › Ticket 44 — restore = merge + conflict copies › AC3: declining merge opens the explicit overwrite-restore confirm; taking it replaces after a pre-snapshot
  2 passed (26.0s)
```

结论: **2/2 passed（26.0s，exit 0）** → 两例失败为本地争用，非产品/spec 缺陷。

## 3. skip 归属实测（逐 spec × 逐 project）

目的：回答 atomcode Q5 第②条「5 skipped 必须逐条说明原因」（skipped ≠ 通过，是审计第一问）。

命令：`npx playwright test --config=test/playwright.config.ts <spec> --project=<proj> --reporter=line`

| spec | project | skipped | passed |
|---|---|---|---|
| boxing-focus-steal | firefox-extension | **3** | 3 |
| boxing-focus-steal | chromium-extension | 0 | 6 |
| boxing-data-golden | firefox-extension | **1** | 6 |
| boxing-data-golden | chromium-extension | **1** | 6 |
| **合计** | — | **5** | 21 |

结论：5 skipped = 平台限定（firefox 原生 dblclick describe ×3，playwright#16095 家族，带 reason 字符串）+ 运输面不存在（undici 断言无适用面，`test.skip(true, …)`，双 project 各 1）。全仓仅 3 处 skip 位点，**均为 in-source 具名跳过，无失明 skip（A-008）**。与 CI 各 lane 的 5 skipped 逐数吻合。
