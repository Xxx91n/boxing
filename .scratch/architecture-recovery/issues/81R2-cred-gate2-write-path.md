# 81R2: data-golden gate2 — credentials PIK 写路径合规

**Covers A-xxx:** A-031, A-025

**What to build:** 修复 data-golden gate 2「single write path」对 ntp/credentials.js `api.storage.local.set(obj)` 的违规，使 gate2 绿；不回滚 PIK 设计；不破坏 credentials 叶子不变量与 81R 的 B-6 窄白名单。

**Blocked by:** None (can start immediately)

**Status:** done (81R2 闭环; gate2+cred 回归实测绿, 见 reports/81-report.md 返工轮次 81R2 节)

## Acceptance criteria

- [x] 已复核 W8-W2-brain-review.md §0 gate2 失败签名与 71-report §6.1 / 81-report 返工节
- [x] `npx playwright test --project=chromium-extension -g "gate 2"` 全绿
- [x] `node scripts/import-graph-guard.mjs` 仍 exit 0
- [x] `node --check ntp/credentials.js ntp/storage.js` exit 0
- [x] 报告**追加**写入 reports/81-report.md「返工轮次 81R2」，不覆盖原记录

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff
- 推荐方向（可偏离但须论证）：1) storage.js 暴露非 layout 键写入门供 credentials 使用；或 2) gate2 允许 credentials.js 仅写 `boxingCredKey.*` 的窄例外并钉死形状；禁止全局削弱 gate2
