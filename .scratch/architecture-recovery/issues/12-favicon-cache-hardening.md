# 12 — perf(favicon): single-flight + SWR hydrate（工业心智模型对齐）

**What to build:** 同 host 并发加载图标只发起一轮网络探针；本地缓存条目过期但仍可用时**先渲染后后台刷新**；失败仍消极缓存。不增加扩展权限、不改存储后端。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance criteria

- [ ] 同 host 并发 `loadFavicon` 共享同一 in-flight Promise
- [ ] hydrate 过期 hit：stale 先用 + 后台一次刷新并覆盖
- [ ] 全失败仍写消极缓存 null（既有 TTL）
- [ ] 不新增依赖；不改 manifest permissions
- [ ] `node --check ntp/favicon.js`；现有 CDN race / 防抖持久化不回退

## Notes

- 首脑 atomcode 调研已索引 `atomcode-favicon`；实施可复用或按 handoff 提示词加赛
- 明确不做: Chrome `_favicon`、IndexedDB、Cache API
