# 12 — perf(favicon): single-flight + SWR hydrate（工业心智模型对齐）

> 版本: 2026.9.12 · 优先级: P2 · 分支建议: `12-favicon-cache-hardening`
> 调研: atomcode（ctx source=atomcode-favicon）· 状态: ready-for-agent

## Problem

书签图标要既省 IO 又省流量。现有实现已接近工业模型，仍缺 in-flight 去重与 SWR，冷启动/并发会重复打网络。

## 现状（已对齐，勿回退）

- `ntp/favicon.js`: 4 CDN `Promise.any` 竞速 + 会话锁 winner
- host 为 key；Map + localStorage；hit 7d / miss 90d；2000 上限；防抖持久化
- 只存 URL 字符串（正确：不存 blob/base64）

## Fix（调研推荐的最小增量）

1. **single-flight**: `const inflight = new Map()` — `loadFavicon` 同 host 并发共享同一 Promise；失败广播后 `inflight.delete(host)`。
2. **SWR hydrate**: `loadFaviconCacheFromStorage` 不再丢弃过期 hit——标记 `stale`，内存仍可用；首次使用 stale 时后台刷新一次（防抖/idle），成功则覆盖。
3. **整体超时**已由 probe 3s 覆盖；保持。
4. **不做**: IndexedDB、Cache API、改存储后端、加 `favicon` permission / `_favicon` API（扩权+FF 无；单独立项再议）。

## Acceptance

- [ ] 同 host 两次并发 `loadFavicon` 只发起一轮网络探针（可通过 debug 日志或 mock Image 断言）。
- [ ] localStorage 条目超过 hit TTL 但未超 miss 窗口时：先渲染旧 URL，后台完成一次刷新。
- [ ] 失败仍写消极缓存 null + 90d。
- [ ] `node --check ntp/favicon.js`。
- [ ] 不新增 npm 依赖；不改 manifest permissions。

## Out of scope

- Chrome `_favicon` permission
- 隐私开关（外部 CDN 泄露域名）— 可另开票
- 图标尺寸/主题
