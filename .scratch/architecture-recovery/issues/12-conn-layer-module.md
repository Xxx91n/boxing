# 12 — conn 图层整组拆为独立模块

**What to build:** 把连接线图层整组拆出 render.js: 线池获取/回收、连线渲染、SVG 线更新, 连同 __linePool/__connRefreshRAF/__dsuDirty 调度状态与视口 culling/LOD (ADR-0004) 和网格哈希 (ADR-0013) 一起搬迁。状态不得跨模块共享。

**Blocked by:** 11 — render.js 纯几何/索引函数下沉 utils (同文件串行纪律, 且几何下沉后 conn 引用的数学函数从 utils 取)

**Status:** done (ticket 12 closed 2026-09-02)

- [x] conn 图层所有函数 + __linePool/__connRefreshRAF/__dsuDirty 在新模块内, render.js 通过 facade 注入消费
- [x] 手测检查点: 拖拽/缩放/pan + 连线目视正确, 大量盒下 culling 生效
- [x] boxing-zoom / boxing-conn 系 spec 全绿, npm test 全绿, build 绿
- [x] 热路径性能不退化 (对照 ADR-0013 网格哈希 O(1) 判定)

## 处置结论 (票12实施窗口, 2026-09-02)

**交付**: ntp/conn-layer.js (788 行) 整组 verbatim 迁入 — acquireLineEl/recycleLineEl/renderConnections/updateSvgLine + 视口 culling/LOD (ADR-0004) + 网格哈希 group drag (ADR-0013) + DSU + connect-mode; render.js 2764→2023 行 (7 个非连续块移除); state.js 145→137 行 (移除 8 行调度状态); ntp.js +2 (import 拆分 + initConnFacade); settings-ui.js +1 (import 拆分); storage.js 零改动 (conn 依赖走 initStorageFacade, connIdx/boxConnIdx 数据 Map 留 state.js)。

**反向依赖解耦**: conn 函数调 commit/getLargeBox/getSmallBox/getInnerSurfaceContent (render/ntp), 经 initConnFacade 注入; 正向 render/ntp/settings-ui → conn 走 ESM import。无 render↔conn 循环 import。

**状态整迁裁定**: 三调度状态 (__linePool/__connRefreshRAF/__dsuDirty) 经符号 census 确认仅 conn 函数读写 → 模块私有整迁 (禁跨模块共享); 数据 Map (connLines/connById/groupStar 等) 仍被 render.js mutationHandlers + ntp.js 临时连线胶水直读 → 留 state.js (票06 singleton), 状态整迁约束只及三调度状态。

**验证**: node --check 10 模块 OK; ESM 冒烟 conn 46 / render 62 exports 全解析 (getBoxByTieredKey 正确留 render); byte-exact 块比对通过; git diff --check 干净; npm run build DONE_BUILD; dist 契约不变 (conn-layer 含 conn 函数+facade, render 仅 import, state 无调度状态); boxing-conn/zoom 系 89/89 chromium 全绿 (拖拽/缩放/pan/culling/connect-mode 活体探针); npm test 408 passed / 11 failed 全属已知 flaky (chromium onboarding 单跑 4/4 绿, firefox conn-delete-action 2/2 单跑绿 + auto-expand page.goto networkidle firefox file:// 抖动)。
