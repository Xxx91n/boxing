# 43 — Wave4 调查：2026.9.12 体验四痛点（创建卡死/全选/打开默认/图标缓存）

> 日期: 2026-09-10 · 角色: 架构首脑（调查/拆票，不实施业务代码）
> 基线: main 仍 a60754b；01–08 已 code-done 待合并（见 README Wave3）
> 调研: atomcode favicon 心智模型（已 ctx 索引，source=atomcode-favicon）
> 日志: `C:\Users\Administrator\下载\boxing-log-2026-09-10T13-58-24.log` **盘上不存在**（ENOTFOUND）。本票以源码时序根因立案，日志仅作复现补充。

## 声明 → 证据 → 结论

### P1 双击新建大盒子间歇失效，之后冒出一堆

| 声明 | 证据 | 结论 |
|---|---|---|
| 创建链路把**视觉反馈绑在 storage I/O 之后** | `ntp/render.js` `addLargeBoxAt`: push → `await saveLayout()` → `renderCanvas()` | 根因候选 #1（强） |
| `saveLayout` 是串行写链，可能堆积 | `ntp/storage.js` L244+: `storageWriteChain.then(...)` 内 get+merge+set；多连点时链排队 | 与「双击没反应」时间窗吻合 |
| 数据已入内存但 DOM 未刷 | push/`boxById.set` 在 await **之前**；render 在 await **之后** | 「之后回来冒出一堆」= 迟到的 `renderCanvas`/`exitToCanvas` 全量重建 |
| 冷却只挡同点连击 | `CREATE_COOLDOWN_MS=350` + 12px（BX-DEV-112D） | 不解释「不同位置也无反馈」 |
| 同步覆盖可叠加 | `applyExternalLayout` 跨 tab/sync 会 `setLayout(merge)`+`renderCanvas` | 次要竞态；主因仍是 render 与 save 耦合 |

**修复方向（ponytail）**: 创建路径改为 **先 render 后防抖 save**（与拖拽 `saveLayoutDebounced` 同模型）；`await saveLayout()` 不再阻塞 UI。不重写写链。

### P2 点击盒子名应全选

| 声明 | 证据 | 结论 |
|---|---|---|
| 点 title 只 focus，不选中 | `ntp/render.js` large L427 / small L813: `mousedown → preventDefault + focus()` | 光标默认落点，非全选 |
| crumb 标题甚至不 focus | L674: 仅 `stopPropagation+preventDefault` | 行为不一致 |
| 已有 Selection 先例 | `test/tests/boxing-focus-steal.spec.ts` `range.selectNodeContents` | 测试缝现成 |

**修复方向**: `focus()` 后 `getSelection().selectAllChildren(el)` 或 `execCommand('selectAll')`；large/small/crumb 三处对齐。保留 SEC-03 paste 纯文本。

### P3 书签默认「当前标签页」

| 声明 | 证据 | 结论 |
|---|---|---|
| 默认硬编码 newTab | `ntp/utils.js` defaultLayout `urlOpenMode:'newTab'`；`ntp.js` L623 `\|\| 'newTab'`；`settings-ui.js` L35/L139；`popups.js` 注释 | 多点默认 |
| 老数据可能已把 newTab 写进 storage | migrateLayout `{...defaults.settings, ...raw.settings}` | 只改 default 不够，需一次性迁移或「未显式选择」判定 |

**修复方向**: 默认改 `sameTab`；migrate 时若 `raw.settings.urlOpenMode` 缺失 → sameTab；若已是 newTab **保留**（尊重已选）。settings UI 同步改 fallback 字符串。

### P4 favicon 缓存心智模型（atomcode）

现有 `ntp/favicon.js`: 4-CDN Promise.any 竞速 + 会话锁 winner + host 键 Map + localStorage 7d hit / 90d miss + 2000 上限 + 防抖持久化。调研结论：**骨架正确**。

| 工业模型 | 现状 | 缺口 |
|---|---|---|
| 元数据-only（URL 字符串，不存 blob） | ✅ | — |
| host 作 key | ✅ | — |
| 消极缓存 miss | ✅ null+90d | — |
| single-flight in-flight dedupe | ❌ | 并发同 host 会重复探针 |
| SWR（过期仍先用，后台刷新） | 部分 | hydrate 过期即丢 → 冷启动重打网络 |
| Chrome `_favicon` 零流量首选 | ❌ | 需 `favicon` permission；FF 无此 API |
| Cache API / IDB blob | 调研否决 | MV3 SW 非网络代理；structured clone 不值 |

**修复方向（ponytail，不加依赖）**: ① `Map<host,Promise>` single-flight；② hydrate 保留过期 hit 为 stale 并立即渲染 + 后台一次刷新（SWR）；③ 不引入 IDB/Cache API；④ `_favicon` permission 列为可选后续（本票不做，避免扩权）。

## 波次拆票

| 票 | 主题 | 优先级 | Blocked by |
|---|---|---|---|
| 09 | 创建先 render 后 save（P1） | P0 | None — can start immediately |
| 10 | 标题点击全选（P2） | P1 | **09 — create-render-decouple**（同改 render 模块） |
| 11 | urlOpenMode 默认 sameTab + 迁移（P3） | P1 | None — can start immediately |
| 12 | favicon single-flight + SWR hydrate（P4） | P2 | None — can start immediately |

四票文件面：09=render 创建管线；10=render title 监听；11=utils/settings/popups/ntp 默认；12=favicon.js。
**并行波次（与 issues/README 一致）**: W4-1 = 09/11/12；W4-2 = 10（Blocked by 09，禁止与 09 并行改 render）。

## 版本控制

WORKFLOW §4.2：GitButler；每票独立 branch；不 push 不开 PR。
