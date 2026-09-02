# Handoff — 票 11 render.js 纯几何/索引函数下沉 utils

## 任务

把 render.js 中无 DOM 依赖的纯几何/索引计算整组搬到 utils.js 并导出, render.js 改为 import 引用。切口候选: DSU (dsuFind/dsuMake/dsuUnion)、clampCanvasPan、zoomAtPoint 数学部分、boxMidPoint。行为零变化, 画布全部交互如常。

## 阻塞
Blocked by: None — can start immediately

## 本票专属 delta

- 切口头名单位置: render.js 内 dsuFind/dsuMake/dsuUnion/clampCanvasPan/zoomAtPoint/boxMidPoint 实测命中后逐一核对, 名单外一律不搬
- 搬移办法 verbatim + 十层自验, 与一期票 05 (utils) 同款
- 若发现候选函数实际有 DOM/state 依赖 (非纯), 就地放弃该函数并在报告中记偏离

## 相关 ADR

- 无

## 完成定义
- issue 验收清单全勾; npm test 全绿 (本机满负载抖动: 超时项单跑必绿为准); 拆分类票另需 npm run build 绿 + dist 契约不变 (WORKFLOW §4.1)。
- 版本控制遵循 WORKFLOW §4.2。
- 验收勾稽与新教训写回本票 issue 文件与 WORKFLOW §6。

## 建议 skills
/implement → /code-review; 联网调研若必须, 走 ctx 包裹 atomcode 串行。
