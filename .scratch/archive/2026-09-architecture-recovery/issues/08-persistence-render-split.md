# 08 — 持久化与渲染分离

**What to build:** 布局持久化 (load/save/debounce/migration) 抽为独立模块, 建立在 07 的门面之上; canvas 渲染与 DOM 操作主内聚抽为渲染模块。ntp.js 瘦身为入口编排: init → state → storage → render 的组装。现有性能优化 (viewport culling / grid hash / SVG line pool / rAF 与 debounce 纪律, ADR-0004/0013) 原样保留在渲染模块内。

**Blocked by:** 07

**Status:** done (2026-09-01, ticket 08 agent)

- [x] 保存路径 (含 debounced 与直接两类, AGENTS.md SEC-08 清单) 全部经持久化模块 — persist.js (250 行) 收口 tab-view 持久化家族 (currentViewSnapshot/persistViewState/pushTabViewHistory/loadFallbackTabView/saveLargeBoxViewState/scheduleLargeBoxViewStatePersist(80ms throttle)/flushPendingViewStatePersist) + THEME_PACKS/applyTheme + loadSettings; boxingLayout 写路径 SEC-08 审计: ntp/render/state/utils/i18n 零 chrome.storage.set 直写 (ntp.js 仅剩 file:// mock 自身即该车道 storage 后端), 全部经 storage.js 门面 (saveLayout/saveLayoutDebounced/directSetBoxingLayout 三类调用点分类原样)
- [x] 渲染模块内聚 canvas/DOM 操作; ADR-0004/0013 所述各项优化存在且经测试验证生效 — render.js (2775 行) 整块逐字节搬移: updateSvgLine viewport culling (CONN_VP_MARGIN=60) + LOD stroke (z>=0.8→1.5 / z>=0.5→1 / else 0.75, L521) + SVG line pool (acquireLineEl/recycleLineEl, LINE_POOL_CAP) + grid hash (buildSpatialGrid/querySpatialNearby) + rAF scheduleConnRefresh + O(1) connById 全部随块保留; conn/DSU/zoom/pan 车道 76/76 实测生效
- [x] 拖拽/缩放/pan 热路径的跟手感无回归 (现有相关测试通过即可) — boxing-connections + boxing-conn-dsu + boxing-conn-delete-action + boxing-zoom-dblclick + boxing-innerclip-pan 5 spec 76 passed (chromium-extension, workers=2)
- [x] `npm test` + `npm run build` 绿 — npm test 419 passed (5.0m, chromium+firefox 双 project, 复跑确证); npm run build DONE_BUILD ×N (每批次后), dist 双树含 persist.js + render.js, ntp.css/CSS dual-write validator 不受影响

---

## 处置结论 (子窗口 → 大脑, 2026-09-01)

1. **交付物**: ntp/persist.js (250 行, 12 export + initPersistFacade 注入 3 依赖 debugWarn/darkModeBtn/getLargeBox) + ntp/render.js (2775 行, 107 export + initRenderFacade 注入 28 依赖 = 15 DOM ref + 4 logger + makeId/updateCaption/openConfirmModal/rebuildBoxMaps/getLargeBox 消费函数 + enterAndLocateSmallBox/appEl/headerBar/headerPinBtn/api + setHeaderPinned 经 state setter); ntp.js 5160→2207 行 (-57%), 头部 import 7 模块 + init() 编排 (loadLayout→loadSettings→initSizeObserver→facade 注入→事件绑定→registerStorageOnChanged→视图恢复)。search/settings-modal/webdav/onboarding/openBookmarkUrl/键盘/上下文菜单留在 ntp.js (票 10 范围)。
2. **结构决策** (atomcode 调研裁决, ctx source: atomcode): (a) 全部跨作用域依赖走 init 注入 facade, 不混用双向 import — facade 把 ESM 求值期 TDZ 风险降为零 (esdiscuss/Bryan Braun 机制级佐证), 与既有 5 模块模式一致; (b) 渲染主内聚整块一次搬移不再切两刀 — Fowler strangler-fig 沿既有缝切, 调用图证实渲染管线/交互 handler/CRUD 已双向咬合 (applyCanvasTransform 12 区块、renderConnections 8 区块), 分层留作后续独立票; (c) 零漂移主闸门 = 字符级对账 (逆变换 export 前缀后逐字节 diff, 搬移脚本内置, 2 批次全过); (d) Node ESM 冒烟用最小 globalThis shim, 顶层副作用不延迟化 (21 处 window.__x 契约保持 verbatim)。
3. **搬移脚本自验** (两批次同款 10 层): marker 唯一性 + 边界行断言 → 逐字节切片组装 → export 前缀 107 处唯一命中 → 逆变换对账 (失败即 fail) → 括号深度感知的顶层语句扫描 (carve-out 求值期语句) → 空行守恒折叠 (只折叠 pristine 不存在的空行串) → 残余引用机械校验 (residue∩movedDeclSet ⊆ import 清单) → 写后回滚快照 → node --check → ESM 冒烟。首轮落盘后经 chrome-extension:// 活体探针逮出 3 个静态检查盲区 (import 漏 initPersistFacade/initRenderFacade、state 多变量导出只抓首名致 canvasPanY/innerPanY 漏 import、setProvisionalGhost 漏), 全部根因修复于脚本+产物。
4. **验证证据**: 活体探针 (persistent context + load-extension + chrome-extension://ntp/index.html) 零 console error + __boxingDebug/_boxingAddLargeBox/__boxingSaveLargeBoxViewState 钩子全活; 热路径 5 spec 76/76; npm test 419 passed 复跑确证 (首轮 5 失败: 4×tabs-API 源码断言未随迁已迁 + 1×chromium launch 超时环境抖动复跑绿); build DONE_BUILD dist 双树双新模块; git diff --check clean; 双标签不回环验证未重复 (写链三件套逐字节未动, 票07 证据链承继)。
5. **版本控制 (§4.2)**: branch `arch-recovery-08-persist-render` (anchor arch-recovery-07-storage 之上, 栈顶), commit `kry` (batch1 persist.js) → `msl` (batch2 render.js + 断言随迁)。未 push。docs 收口 (本文件勾选 + WORKFLOW §6) 另行提交同分支。
6. **给 09/10 的接口提示**: ntp.js 2207 行残余 = init/事件绑定/搜索/settings/webdav/onboarding/openBookmarkUrl; initRenderFacade 注入表 28 项在 ntp.js L370-373, 票 10 拆 settings-ui 时若迁移 syncSettingsDOM/openConfirmModal/updateCaption 需同步缩表; boxing-v3.spec.ts 源码断言现分属 ntp.js/render.js 两文件 (ticket 08 注释标记), 票 09 薄化 AGENTS.md 时 BX-DEV-017/018 等渲染规则可改指向 render.js。
