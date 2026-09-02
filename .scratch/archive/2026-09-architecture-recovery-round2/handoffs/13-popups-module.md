# Handoff — 票 13 弹窗/书签行 DOM 构件拆为独立模块

## 任务

把 render.js 中与画布变换不变量无关的弹窗与书签行 DOM 构件拆出: showBookmarkEditPopup/showAddBookmarkPopup/renderBookmarks 及其 drag handlers。不碰画布变换代码。

## 阻塞
Blocked by: 12 — conn 图层整组拆为独立模块 (同文件串行纪律)

## 本票专属 delta

- 只搬列表内函数; 涉及画布变换的边界函数一律不碰
- import 方向: popups → i18n/state, 反向禁止
- 检查点: 书签增删改 + 弹窗开关/拖拽 + 三语切换手测 (参考一期票 04 三语验收)

## 相关 ADR

- 无

## 完成定义
- issue 验收清单全勾; npm test 全绿 (本机满负载抖动: 超时项单跑必绿为准); 拆分类票另需 npm run build 绿 + dist 契约不变 (WORKFLOW §4.1)。
- 版本控制遵循 WORKFLOW §4.2。
- 验收勾稽与新教训写回本票 issue 文件与 WORKFLOW §6。

## 建议 skills
/implement → /code-review; 联网调研若必须, 走 ctx 包裹 atomcode 串行。
