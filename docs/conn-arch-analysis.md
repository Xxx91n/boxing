# Boxing 连线系统架构分析

## 问题概述

用户报告 6 个 bug（问题1-6），根因都指向同一架构问题（问题7）：连线系统数据结构和渲染机制存在根本性设计缺陷。

## 参考项目对比

### ai-api-route (D:\Aworker\ai-api-route)

使用 **ReactFlow** (`@xyflow/react`)，业界标准的节点-边图画编辑库：
- 数据模型：`nodes[]` + `edges[]`，位置存储在 node 的 `position` 字段
- 边跟随节点：节点移动时 edge 自动重新计算路径，库内部处理
- 独立渲染层：ReactFlow 维护自己的 SVG overlay，与节点 DOM 解耦
- 变换处理：pan/zoom 是 ReactFlow 的 ViewportTransform，edge/path 自动跟随
- 拖拽/连接：内置 `onConnect` 事件，redrag-style 拖拽创建边

关键代码 (`TopologyView.tsx`):
```tsx
const edges = useMemo(() => {
  // ... listPush({ source, target, animated })
}, [platforms, lanes, busyTotal]);
```
边的数据只存 source/target id，渲染交给 ReactFlow 内部，节点位置变化时 ReactFlow 自动重算边路径。

### Boxing 当前实现

使用 **LeaderLine** 库 + 自定义 DOM 查询配置：
- 数据模型：`layout.connections[]` 存 from/to tiered-key + id
- 渲染：`renderConnections()` 遍历 connections，对每条用 `resolveBoxEl(key)` 查 DOM 元素，创建 LeaderLine 实例
- 位置同步：靠 `scheduleConnRefresh` → `line.position()` 手动刷新，用 `setTimeout(0)` + 强制 reflow
- 变换处理：canvas surface 用 CSS transform 做 pan/zoom，LeaderLine 读 BCR 画线
- 拖拽/连接：`enterConnectMode` + provisionalLine/ghost div 追踪鼠标

## 根因分析 (问题7)

### 缺陷1：渲染层与数据层未解耦

LeaderLine 绑定到 DOM 元素的 BCR (getBoundingClientRect)，而画布用 CSS transform 做缩放。BCR 受 transform 影响，但 LeaderLine 内部缓存 BCR 结果，不自动响应 transform 变化。必须手动调用 `line.position()` 才重算。

- **症状**：Bug 5 (ctrl+滚轮缩放后线条不更新)
- **原因**：`scheduleConnRefresh` 时序问题，style change 在 LeaderLine 会话期外

### 缺陷2：位置计算坐标系混乱

CSS transform 缩放后，`getBoundingClientRect()` 返回的是视口坐标（已缩放），但 canvas 逻辑坐标是未缩放的。LeaderLine 画线在 viewport 坐标系，线条位置基于元素屏幕位置。当 zoom 变化，元素屏幕位置立刻变化，但 LeaderLine 不重读，必须 position() 才更新。

- **症状**：Bug 1 (虚线指向最左下角)，Bug 6 (线条出现在画布外)
- **原因**：`provisionalGhost` 定位用 `e.clientX/clientY` (视口坐标)，但 LeaderLine 用 transform 容器内的 BCR 画线，坐标系不一致

### 缺陷3：provisionalLine 实现问题

`enterConnectMode` 创建 `provisionalGhost` div 定位在 `document.body`，设为 `position:absolute; width:1px;height:1px`。创建时未设 left/top（默认 0,0 = 视口左上角），LeaderLine 立即从盒子画到 (0,0) → "虚线指向最左下角"。

- **症状**：Bug 1 (瞬间虚线指向最左下角)
- **原因**：provisionalGhost 初始无坐标，默认 (0,0) 相对 body 定位

### 缺陷4：拖拽性能问题

mousemove 时每次 `provisionalLine.position()` 触发 LeaderLine 全量重算，在画布缩放下尤其重。没有节流。

- **症状**：Bug 2 (拖拽卡顿)
- **原因**：每次 mousemove 调 LeaderLine.position() 无节流，同步重算 SVG

### 缺陷5：组/连接状态同步不一致

Groups 数据在 `layout.groups`，connections 在 `layout.connections`。toggleStarMark 修改 groups，同时 addConnection 会自动 join group。但 groupIdx 缓存失效时机不一致，每次 toggleStarMark 都需要 clear+rebuild。

- **症状**：Bug 3 (连接后线条不更新)，Bug 4 (无法取消父标记)
- **原因**：cache 一致性靠手动维护，容易漏掉某个变更路径

### 缺陷6：线条不被画布 clipping

LeaderLine 在独立的 SVG overlay 层画线，该 SVG 不被 canvasSurface 的 overflow 限制。线条可以延伸到画布可视区域之外（标题栏、UI 遮挡区）。

- **症状**：Bug 6 (线条出现在画布外)
- **原因**：LeaderLine 的 SVG layer 不受 canvas 容器 overflow:hidden 约束

## 针对 Bug 1-6 的具体根因

| Bug | 根因 | 所属缺陷 |
|-----|------|----------|
| 1 — 虚线指向左下角 | provisionalGhost 初始 (0,0) 坐标 | 缺陷2+3 |
| 2 — 拖拽卡顿 | mousemove 无节流 + LeaderLine 同步重算 | 缺陷4 |
| 3 — 连接后不更新 | connIdx 缓存旧目标，scheduleConnRefresh 时序 | 缺陷1+5 |
| 4 — 无法取消父标记 | groupIdx 缓存 stale，toggleStarMark 路径不一致 | 缺陷5 |
| 5 — 缩放不同步 | setTimeout(0) vs rAF 时序，style commit 前读 BCR | 缺陷1 |
| 6 — 线条溢出画布 | LeaderLine SVG 不受 canvas overflow 限制 | 缺陷6 |
| 7 — 结构问题 | 上述全部 | 综合 |

## 重构方案（解耦设计）

### 核心原则：数据层 + 渲染层分离

参考 ReactFlow 架构，但用纯 JS 实现（Boxing 无 React 构建链）：

1. **位置数据在数据层**：box.x/y/width/height + canvas zoom/pan 作为唯一动画原
2. **连线位置计算是纯函数**：`computeLineGeo(from-box, to-box, canvasState)` 返回 SVG 路径坐标
3. **渲染是数据驱动的**：数据变化 → 批量重算所有受影响线条 → 批量更新 SVG path

### 具体改造

1. 替换 LeaderLine 为自绘 SVG
2. 在 canvasSurface 内部维护单个 `<svg class="conn-layer">` overlay
3. 用 box 的逻辑坐标 (x,y,w,h) + canvas zoom/pan 直接计算连线端点，不依赖 BCR
4. mousedown 到 diryConns，mouseup 时扩展连线目标
5. 缩放/平移时自动重算（因为坐标是纯函数）

### 优势

- 无 BCR 读取 → 不依赖 transform commit 时序
- 线条被 canvas clipping → 不溢出画布
- 无第三方库 → 完全可控
- 性能更好：纯函数运算 + 批量 SVG path 更新

### 数据结构优化

从：
```
layout.connections = [{id, from, to, createdAd}]
layout.groups = [{parentId, members}]
```

到（统一图模型）：
```
layout.graph = {
  edges: Map<edgeId, {from, to, createdAt}>,
  groups: Map<parentId, {members: Set<memberId>}>
}
```

- O(1) 边查询（Map key）
- O(1) 组查询
- 成员关系用 Set 避免 dedup 问题
- 内存：快速添加/删除无需 filter 重建数组

## 实施路径

1. 先写新 SVG 连线渲染模块（不替换旧代码）
2. 新建 connLayer SVG 在 canvasSurface 内
3. 实现 `computeMidPoint(box, side)` → 结合 canvas zoom/pan 算屏幕坐标
4. 实现 drag-create：mousedown 启动 ghost line，mousemove 更新 SVG path，mouseup 连接
5. 全面替换 LeaderLine 调用
6. 迁移 connectMode/provisionalLine/ghost 到新模块
7. 重构 group/model 用 Map
8. 修复 toggleStarMark 缓存一致性
9. 验证 6 个 bug 全部解决
10. 跑全测试套件
