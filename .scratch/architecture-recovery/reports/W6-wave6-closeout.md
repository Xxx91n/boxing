# Wave6 整轮收口报告

> 日期: 2026-09-12 · 首脑

## 1. 交叉核对（reports × README）

| 矛盾 | 处置 |
|---|---|
| W1 表写 52 PASS-with-violation，补测节写 52 PASS | **以补测为准**：T52-b 为测试缺陷（persistView≠saveLayout），修复后 5/5；违规 V6-52-1（hunk 归属）仍记录 |
| W1/W2 均写 G-A 未满足、G-B open | 一致，维持 |
| 48 caveat「CI pending」 | 维持：land 后以 main test.yml 定谳 |
| 51/54/59 issue 未勾 vs 报告 done | 维持 process caveat；代码实物在分支 |

## 2. 终跑 verify-build（留证）

```
node .github/scripts/build.mjs          → EXIT:0 DONE_BUILD（zip/crx/xpi 双浏览器）
node scripts/css-balance-guard.mjs      → OK exit 0
node scripts/import-graph-guard.mjs     → violations: []
node scripts/migration-golden-guard.mjs → 28/28
node scripts/waiver-ledger-check.mjs    → OK 2 rows
```

Playwright 补测（前轮）: time-machine+import-merge+data-recovery **12 passed**；T52 **5/5**；data-golden gate4 flaky（基线家族）

## 3. 三层文档一致性

| 层 | 状态 |
|---|---|
| CONTEXT.md | **补 3 词条**：Time Machine 一键回滚+pre-restore、导出信封/完整包、A10 CSS 门禁；既有 urlOpenMode/snap.v1/legacy reader 对齐 |
| ADR-0009 | 票51 修订（信封+RPO/RTO）在盘 |
| ADR-0017 | 票56 RA-1..6 具名在盘 |
| 代码 | settings-ui/storage/utils/sync-engine 锚点与 CONTEXT 一致 |

## 4. 账本结算

| ID | 状态 |
|---|---|
| A-001..A-008, A-010, A-011 | **implemented** |
| A-009 | **deferred**（G-B 待用户实机） |
| stale | 无 |

实现摘要已沉淀 docs/；账本随 .scratch 归档。
