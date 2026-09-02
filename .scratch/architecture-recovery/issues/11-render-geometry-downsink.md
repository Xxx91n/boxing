# 11 — render.js 纯几何/索引函数下沉 utils

**What to build:** 把 render.js 中无 DOM 依赖的纯几何/索引计算整组搬到 utils.js 并导出, render.js 改为 import 引用。切口候选: DSU (dsuFind/dsuMake/dsuUnion)、clampCanvasPan、zoomAtPoint 数学部分、boxMidPoint。行为零变化, 画布全部交互如常。

**Blocked by:** None — can start immediately

**Status:** done (ticket 11 closed 2026-09-02)

- [x] 目标函数从 render.js 移除并在 utils.js 中原样导出 (verbatim 搬移, 十层自验)
- [x] render.js 通过 import 消费, 无重复定义
- [x] npm test 全绿 (372 passed, 22.8m, exit 0) + npm run build 绿 (A7/A8 validator 过) + dist 契约不变 (两 dist utils 含声明+导出, render 无声明仅 import, manifest v3 不变)

## 处置结论 (票11实施窗口, 2026-09-02)

六候选纯度定谳 (任务书 delta: 非纯就地放弃并记偏离):

| 候选 | 裁定 | 证据 |
|---|---|---|
| zoomAtPoint | **下沉 utils.js (唯一实施项)** | 全参数传值, 无闭包状态; container.getBoundingClientRect() 经参数传入, 与 utils 既有 screenToWorld 同款模式 (utils 纯度惯例: 参数传 DOM 读取可接受); MIN_ZOOM/MAX_ZOOM 本就在 utils |
| dsuFind/dsuMake/dsuUnion | 放弃 (非纯) | 闭包引用 state.js 全局可变 Map (boxGroupId/groupMembers); 搬移需 utils 反向 import state, 违反 spec 依赖方向 (utils 被所有层引用, 不得引用上层) |
| clampCanvasPan | 放弃 (非纯) | 读 render 模块级缓存 canvasContainerSize + canvasContainer.clientWidth (DOM); 且 utils.js L5 头注释已显式登记其纯度豁免 (票05 审计结论) |
| boxMidPoint | 放弃 (非纯) | 经 getLargeBox/getSmallBox 查全局 boxById/smallBoxById 状态, 且依赖 render 本地 TITLE_BAR_H |

实施与验证: zoomAtPoint 整函数 10 行 verbatim 搬移 (唯一改动 = decl 去 export 前缀), utils.js 头注释追加票11登记; 十层自验全绿 (marker 唯一/边界/缝合/逐字节/精确 census/round-trip/node --check/ESM 冒烟 + 540 点黄金平价 vs 原数学); render.js 2775→2764 行, utils.js 229→241 行; 无跨模块消费者破坏面 (clampCanvasPan 虽被 ntp.js 消费但本票放弃不动, 零爆炸半径)。
