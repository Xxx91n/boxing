# 13 — 弹窗/书签行 DOM 构件拆为独立模块 · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-03
- 状态: **done** — issues/13 验收 3/3 勾选; 本文件为收口用
- 分支: `ticket-13-popups-module` (独立分支, stack 于 ticket-12-conn-layer-module 之上)
- 上游依据: handoffs/13 + issues/13 + spec.md (切口三) + WORKFLOW §4.2/§6

## 交付物
| 文件 | 变化 | 内容 |
|---|---|---|
| ntp/popups.js | 新增 432 行 | renderBookmarks/showBookmarkEditPopup/showAddBookmarkPopup/onBmRowDragStart 四函数 verbatim + initPopupsFacade 门面 |
| ntp/render.js | 2023 → 1612 行 | 移除四函数; popup tracker 三件套留原地; 新增 popups import (renderBookmarks); 清理 MAX_BOOKMARKS/normalizeBookmarkUrl/loadFavicon 三个不再使用的 import |
| ntp/ntp.js | 990 → 993 行 | render import 新增 addPopupTracker/removePopupTracker; 新增 popups import (initPopupsFacade); boot 注入调用 |
| ntp/state.js | 0 改动 | MAX_BOOKMARKS 由 popups.js 直接 import; 无状态整迁 |
| test/tests/boxing-v3.spec.ts | 2 处断言迁移 | api.tabs.create 源码断言从 render.js → popups.js (票04 教训: 符号搬哪断言迁哪) |

## 本票 delta 落实
- **只搬列名函数** — 四函数 verbatim, 碰画布变换的边界函数一律不搬: popup tracker 三件套 (addPopupTracker/removePopupTracker/repositionAllPopups) 整体留 render.js, 因 repositionAllPopups 被 onBoxDragMove/pan/wheel 调用 (画布变换热路径)。
- **import 方向** — popups → i18n/state/utils/storage/favicon (正向 ESM); 反向依赖 (getLargeBox/renderInnerSurface/showBoxDeletedWarning + addPopupTracker/removePopupTracker + makeId/api/debug/debugWarn) 经 initPopupsFacade 注入, 禁 render↔popups 循环 import (与票12 conn 同款门面)。

## 验证证据
- node --check 三模块 OK; popups.js ESM 冒烟 (5 导出平价) 通过; git diff --check 干净。
- npm run build DONE_BUILD; dist 契约不变 (popups.js 进两 dist)。
- 本票 checkpoint 全绿: boxing-popup-dragselect.spec.ts (弹窗拖选不误关) + boxing-i18n-module.spec.ts (三语切换) + boxing-v3.spec.ts (源码断言迁移后 15/15)。
- npm test 397 passed / 22 failed 全属已知 flaky: 21 firefox (票15 满负载假失败签名, 全集中 firefox-extension) + 1 chromium state-sync; chromium state-sync 与 firefox accent-theme 逐项 solo 复跑全绿, 确认非本票回归。

## 给大脑的收口注意
1. render.js 头注释已更新 (ticket-13 摘除 bookmark rows/popups), 但残留 "Remaining" 清单仍含 box CRUD — 后续若拆 box CRUD 需先做符号 census。
2. popups.js 头注释已登记门面注入面 (9 依赖) 与 tracker 三件套留 render.js 的边界裁定, 后续票延续该头注释台账。
3. WORKFLOW §6 新增 2 条票13 教训 (popup 边界先看热路径调用 + 残留 facade 注入变量无害不拆)。
