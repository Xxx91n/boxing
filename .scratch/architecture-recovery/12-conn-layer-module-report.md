# 12 — conn 图层整组拆为独立模块 · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-02
- 状态: **done** — issues/12 验收 4/4 勾选; 本文件为收口用
- 分支: `ticket-12-conn-layer-module` (独立分支, 依赖已合入的 ticket-11)
- 上游依据: handoffs/12 + issues/12 + spec.md (切口二) + WORKFLOW §4.2/§6

## 交付物
| 文件 | 变化 | 内容 |
|---|---|---|
| ntp/conn-layer.js | 新增 788 行 | conn 图层整组 verbatim (线池/渲染/SVG 更新 + culling/LOD + DSU + group drag + connect-mode) + 三调度状态模块私有 + initConnFacade |
| ntp/render.js | 2764 → 2023 行 | 移除 7 个非连续 conn 块; 状态 import 缩减; 新增 conn-layer import (14 函数) |
| ntp/state.js | 145 → 137 行 | 移除 MAX_CONNECTIONS/LINE_POOL_CAP/__linePool/__dsuDirty/__connRefreshRAF/setDsuDirty/setConnRefreshRAF |
| ntp/ntp.js | 990 → 992 行 | render import 拆分 + conn-layer import + initConnFacade 注入 |
| ntp/settings-ui.js | 331 → 332 行 | import 拆分 (4 conn 函数转 conn-layer) |
| ntp/storage.js | 0 改动 | conn 依赖走 initStorageFacade; connIdx/boxConnIdx 数据 Map 留 state.js |

## 反向依赖解耦
conn 函数调 commit/getLargeBox/getSmallBox/getInnerSurfaceContent (render/ntp), 经 initConnFacade 注入; 正向 render/ntp/settings-ui → conn 走 ESM import。无 render↔conn 循环 import。

## 状态整迁裁定
三调度状态 (__linePool/__connRefreshRAF/__dsuDirty) 符号 census 确认仅 conn 函数读写 → 模块私有整迁。数据 Map (connLines/connById/groupStar 等) 仍被 render.js mutationHandlers + ntp.js 临时连线胶水直读 → 留 state.js (票06 singleton), 状态整迁约束只及三调度状态。

## 验证证据
- node --check 10 模块 OK; ESM 冒烟 (conn 46 / render 62 exports 全解析; getBoxByTieredKey 正确留 render); byte-exact 块比对通过; git diff --check 干净。
- npm run build DONE_BUILD; dist 契约不变 (conn-layer 含 conn 函数+facade, render 仅 import, state 无调度状态)。
- boxing-conn/zoom 系 89/89 chromium 全绿 (拖拽/缩放/pan/culling/connect-mode 活体探针)。
- npm test 408 passed / 11 failed 全属已知 flaky: chromium onboarding 单跑 4/4 绿; firefox conn-delete-action 2/2 单跑绿 + auto-expand page.goto networkidle (firefox file:// 抖动)。

## 给大脑的收口注意
1. 票13 (popups) 前瞻: renderBookmarks/showBookmarkEditPopup/showAddBookmarkPopup 仍在 render.js 内, 弹窗拖拽 handler 与 __popupTrackers 同域, 可整块拆出; 不碰 conn-layer。
2. conn-layer.js 头注释已登记状态/纯度边界, 后续票延续该头注释台账。
3. WORKFLOW §6 新增 3 条票12 教训。
