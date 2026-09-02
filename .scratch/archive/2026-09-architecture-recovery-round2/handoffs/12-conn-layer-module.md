# Handoff — 票 12 conn 图层整组拆为独立模块

## 任务

把连接线图层整组拆出 render.js: 线池获取/回收、连线渲染、SVG 线更新, 连同 __linePool/__connRefreshRAF/__dsuDirty 调度状态与视口 culling/LOD (ADR-0004) 和网格哈希 (ADR-0013) 一起搬迁。状态不得跨模块共享。

## 阻塞
Blocked by: 11 — render.js 纯几何/索引函数下沉 utils (同文件串行纪律, 且几何下沉后 conn 引用的数学函数从 utils 取)

## 本票专属 delta

- 状态整迁硬约束: __linePool/__connRefreshRAF/__dsuDirty 必须与 acquireLineEl/recycleLineEl/renderConnections/updateSvgLine 同迁; 发现任一被 render.js 其余代码直接读写则整组改 facade 注入, 禁跨模块裸共享
- 性能不变量 ADR-0004/0013 是验收项不是建议
- 检查点: 拆完先跑 boxing-zoom + boxing-conn 系 spec, 再手测拖拽/缩放/pan

## 相关 ADR

- docs/adr/0004-viewport-culling-and-lod-for-conn-lines.md
- docs/adr/0013-performance-optimization-grid-hash.md

## 完成定义
- issue 验收清单全勾; npm test 全绿 (本机满负载抖动: 超时项单跑必绿为准); 拆分类票另需 npm run build 绿 + dist 契约不变 (WORKFLOW §4.1)。
- 版本控制遵循 WORKFLOW §4.2。
- 验收勾稽与新教训写回本票 issue 文件与 WORKFLOW §6。

## 建议 skills
/implement → /code-review; 联网调研若必须, 走 ctx 包裹 atomcode 串行。
