# 12 — perf(favicon): single-flight + SWR hydrate（工业心智模型对齐）

**What to build:** 同 host 并发加载图标只发起一轮网络探针；本地缓存条目过期但仍可用时**先渲染后后台刷新**；失败仍消极缓存。不增加扩展权限、不改存储后端。

**Blocked by:** None — can start immediately

**Status:** code-done · CI-open (全量 Playwright 绿由 CI dispatch 收口, 2026-09-04 CI-only 政策)

## Acceptance criteria

- [x] 同 host 并发 `loadFavicon` 共享同一 in-flight Promise (沙箱仿真: 3 并发 2 host 仅发起 2 组探针, 见报告 §4-S1)
- [x] hydrate 过期 hit：stale 先用 + 后台一次刷新并覆盖 (hit 7–90d / miss 90–180d 窗口内保留为 stale; 报告 §4-S3/S3b/S6)
- [x] 全失败仍写消极缓存 null（既有 90d TTL, stale 窗口延至 180d; 报告 §4-S2）
- [x] 不新增依赖；不改 manifest permissions (文件面仅 ntp/favicon.js)
- [x] `node --check ntp/favicon.js` PASS (ESM); CDN race 的 `Promise.any` 字符串仍在 `loadFavicon.toString()` 内 (boxing-search.spec.ts:91 源契约不回退); 防抖持久化路径不变, 仅改存真实 per-entry ts (报告 §4/§5)

## Notes

- 首脑 atomcode 调研已索引 `atomcode-favicon`；实施可复用或按 handoff 提示词加赛
- 明确不做: Chrome `_favicon`、IndexedDB、Cache API
