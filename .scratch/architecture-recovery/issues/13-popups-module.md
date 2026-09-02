# 13 — 弹窗/书签行 DOM 构件拆为独立模块

**What to build:** 把 render.js 中与画布变换不变量无关的弹窗与书签行 DOM 构件拆出: showBookmarkEditPopup/showAddBookmarkPopup/renderBookmarks 及其 drag handlers。不碰画布变换代码。

**Blocked by:** 12 — conn 图层整组拆为独立模块 (同文件串行纪律)

**Status:** done (2026-09-02, 首脑复核前)

- [x] 上述函数在新模块, render.js 经 import/facade 消费 — renderBookmarks/showBookmarkEditPopup/showAddBookmarkPopup/onBmRowDragStart 搬至 ntp/popups.js (verbatim), render.js `import { renderBookmarks } from './popups.js'` 消费, 反向依赖 (getLargeBox/renderInnerSurface/showBoxDeletedWarning/add+removePopupTracker + makeId/api/debug/debugWarn) 经 initPopupsFacade 注入; popup tracker 三件套留 render.js (repositionAllPopups 是 box-drag/pan/zoom 热路径)
- [x] 书签增删改、弹窗开关/拖拽行为手测无损, i18n 文本正常 — boxing-popup-dragselect.spec.ts + boxing-i18n-module.spec.ts (三语切换 checkpoint) + boxing-v3.spec.ts (api.tabs.create 断言迁至 popups.js) 全绿
- [x] npm test 全绿 + build 绿 — `npm run build` DONE_BUILD, dist 契约不变 (popups.js 入两 dist); 全量 397 passed, 22 失败全为满负载 firefox 车道 + 1 chromium state-sync (票15 记录的假失败签名), 逐项 solo 复跑全绿
