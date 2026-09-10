# 12 — favicon single-flight + SWR hydrate · 实施报告

> 日期: 2026-09-10 · 窗口: 12-favicon-cache-hardening · 票: issues/12-favicon-cache-hardening.md
> 基线: 43-wave4-investigation P4 · spec.md Wave4 票 12 · handoff 12

## 1. 结论

票 12 代码完成 (code-done), 全量 Playwright 绿由 CI dispatch 收口 (CI-only 政策)。文件面仅 `ntp/favicon.js` (+ 本票 issue 勾选与本报告)。零新依赖、零权限变更、零存储后端变更。已按 WORKFLOW §4.2 提交至本票独立分支 `ticket-12-favicon-swr` (代码 commit `kow`; 未推送、未开 PR)。

## 2. 实现

### 2.1 single-flight (票面 delta ①)

- 新增 `const inflight = new Map()` — host → `Promise<string|null>`。竞态探针体为 `loadFavicon` 内的 inline async IIFE: 首个同 host 调用创建任务并登记, 后续调用 `inflight.get(host)` 直接 join, 网络探针数与新域名数成正比而非与 img 数成正比。
- **failure Forget**: `task.then(forget, forget)`, 且 `forget` 校验 `inflight.get(host) === task` 再删 (防误删后继任务)。探针体内部 try/catch 保证 Promise 永不 reject (resolve `null` 即消极缓存), 等待者不会被失败挂死。
- host 键沿用 `new URL(url).hostname`, 与 atomcode 结论一致 (per-host 资源, 用全 URL 做键会造成同站多键)。
- 3s 整体超时沿用既有 per-token `probe` 超时 (Promise.any 下最快者胜, 慢者被弃)。

### 2.2 SWR hydrate (票面 delta ②)

- 内存缓存条目从 `url|null` 升级为 `{ url, ts }` — persist 原先给全部条目盖 `now` 戳 (注释自认近似), 使每次防抖落盘都把全部 TTL 重置; 真实 ts 是 hydrate 判 stale 的前提, 也顺带修正了 TTL 语义。localStorage JSON 形状 `{host:{url,ts}}` 与键 `boxingFaviconCache.v1` 不变, 无迁移。
- `loadFaviconCacheFromStorage`: 过期不再直接丢弃 — fresh 窗口 (hit 7d / miss 90d) 之外、SWR 天花板 (hit 90d / miss 180d) 之内的条目保留为 stale 并立即可渲染; 超过天花板才丢 (懒重竞)。 malformed 条目 (url 非 string 且非 null) 一并过滤。
- `loadFavicon(img, url, opts)`: 命中即 paint (fresh 或 stale 都先画)。若 `Date.now()-ts > favFreshTtl(url)` 且 `!inflight.has(host)` → fire-and-forget 自重入 `loadFavicon(img, url, { background: true })`, 该重入跳过缓存检查直接进 single-flight 段: 后台恰好一次刷新, 结果覆盖缓存 **并** 重画本 img (成功换 url / 全败转 display:none)。`inflight.has` 守卫保证同 host 多张 stale img 也只有一轮刷新。
- 既有不变量全保持: URL 字符串元数据 (无 blob)、4-CDN `Promise.any` 竞速 + 会话锁 winner + 直连 `/favicon.ico` 兜底、400ms 防抖持久化、2000 条上限 (trim 改按真实 ts 降序, 比原插入序近似更准)、消极缓存 null。

### 2.3 关键决策与约束

- **竞态代码不抽 helper**: `boxing-search.spec.ts:91` 是源契约测试, 断言 `__boxingDebug.loadFavicon.toString().includes("Promise.any")`。若按常见写法把探针体抽成 `raceFavicon(host)`, 该字符串离开 `loadFavicon` 即打破既有测试 (票 04 教训: 断言跟着符号走, 但本票文件面仅 favicon.js, 不动 test)。故探针体留作 `loadFavicon` 内 inline IIFE, 源契约原样绿。
- 第三参 `opts` 为向后兼容的可选参数, 全部既有调用点 (`popups.js` 等经门面) 传 `(img, url)` 不受影响。
- 未改的语义: `raceCDN` 会话锁、`getFaviconUrl`、`isValidPublicUrl`、B10 竞速、B-class catch 注释风格 (BX-EXPLORE-015)。

## 3. 调研 (atomcode)

- **未重跑 atomcode** — 复用 ctx 已索引的 `atomcode-favicon` 首脑调研 (含对比矩阵与七方案证据), 符合 handoff 「优先复用」与 §4.3 串行纪律; 无需加赛即已覆盖 single-flight/SWR 落地细节。
- **采纳**的结论: `Map<host,Promise>` 标准单飞 + 失败广播 Forget; host 作键; URL 字符串元数据缓存正确; SWR 三层语义 (fresh/stale 窗口/硬过期); 否决 IndexedDB blob、Service Worker Cache API、Chrome `_favicon` 权限 (后者留作明确不做, 避免扩权且 Firefox 无此 API); localStorage 同步写须防抖合并 (既有 400ms 防抖保留)。
- **修正/简化**: ① 调研建议的「每次 NTP 只重验证可见区 top-N + 其余排队 idle」预算器不引入 — 本票 stale 刷新由 render 逐 img 触发天然只覆盖在场书签, 且 `inflight.has` 守卫已把风暴收敛为每 host 一轮, top-N 调度属于过度工程 (ponytail)。② 调研的「7d–90d SWR 窗口」与「24–72h 消极层」参数不照搬 — 本实现把既有 7d/90d fresh 窗口当作 hit/miss 两档的 first tier 不动, stale 天花板取 hit=90d (对齐 web.dev stale 窗口上限) / miss=180d (对齐调研硬过期 >180d 才完全回源), 保持既有 TTL 心智不变形。

## 4. 验证 (本机, CI-only 政策下不跑本地套件)

- `node --check` (ESM 语义, 经 .mjs 副本): PASS; `git diff --check`: 干净, LF 保持, 无 BOM。
- 沙箱行为仿真 (Node vm + stub Image/localStorage/URL, 21 条断言全过):
  - S1 冷缓存同 host 并发: 3 调用 2 host 仅 2 组探针 (14 张图而非 23); 两 img 共享同一 winner; settle 后 `inflight` 清空; 后续 fresh 命中零网络。
  - S2 全失败: 写消极缓存 null + hidden; 第二次调用零网络; 2nd 命中不重探针。
  - S3/S3b hydrate 的 10d 旧 hit: 同步先画 stale → 同 tick 起一轮后台刷新 (race4+tokens5) → 成功则覆盖缓存+重画新 url, 失败则覆盖为 null+隐藏 (两分支都验); 落盘 JSON 含真实 ts。
  - S6 同 host 两张 stale img: 仅一轮后台刷新 (9 图非 18)。
  - S4 天花板: hit>90d 丢弃 / miss>180d 丢弃 / miss 91d 保留 / malformed 丢弃 / fresh 保留。
- 既有源契约 `Promise.any` 字符串仍在 `loadFavicon` 体内 (构造性保证, 无需改 spec)。
- 全量 Playwright (chromium 车道 `boxing-search.spec.ts` 等) 待 CI dispatch 收口 — 2026-09-04 CI-only build 政策, 本机不运行。

## 5. 验收映射

| 验收项 | 状态 | 证据 |
|---|---|---|
| 同 host 并发共享 in-flight | ✅ | §4-S1 + commit kow |
| hydrate 过期 hit: stale 先用 + 后台一次刷新并覆盖 | ✅ | §4-S3/S3b/S6 |
| 全失败仍写消极缓存 null (既有 TTL) | ✅ | §4-S2 |
| 不新增依赖; 不改 manifest permissions | ✅ | 文件面仅 favicon.js |
| node --check; CDN race/防抖持久化不回退 | ✅ | §4; CI 全量绿收口 |

## 6. 风险与遗留

- stale 刷新失败会把既有可用旧 url 覆盖为 null (隐藏图标) — 与「消极缓存 + 到期再试」模型一致 (下一次 90d fresh 窗口后再入 stale 重试), 属票面「全失败仍写消极缓存 null」的自然延伸; 如需「失败保旧值」需引入 stale/fresh 双值缓存, 超出本票范围。
- background 重画使用调用时刻的 img 引用; 若 render 已重建 DOM, 对脱离节点的 img 赋值 src 无副作用 (浏览器已停止请求非在场图)。
- `boxing-search.spec.ts` 的源契约只约束 `Promise.any` 字样; 若未来把探针抽为独立函数, 须按票 04 教训同步迁断言。

## 7. 版本控制

遵循 WORKFLOW §4.2: 本票独立分支 `ticket-12-favicon-swr`, 代码 commit `kow`, 本报告与 issue 勾选随后同分支落盘; 未推送、未开 PR。与并行窗口 (09/10/11) 文件面零交集 (favicon.js 历史上仅票 03 动过), 提交时逐文件 id 认领, 未卷入他窗未提交改动。
