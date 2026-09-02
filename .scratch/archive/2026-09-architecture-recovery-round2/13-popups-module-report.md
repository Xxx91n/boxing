# 13 — 弹窗/书签行 DOM 构件拆为独立模块 · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-03
- 状态: **done (复核修复后)** — issues/13 验收 4/4 勾选; 本文件为收口用
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
| test/tests/boxing-i18n-module.spec.ts | +test.setTimeout(120_000) | 复核修复: Firefox 有头冷启动吃 ~22s, 提预算 (见下) |

## 本票 delta 落实
- **只搬列名函数** — 四函数 verbatim, 碰画布变换的边界函数一律不搬: popup tracker 三件套 (addPopupTracker/removePopupTracker/repositionAllPopups) 整体留 render.js, 因 repositionAllPopups 被 onBoxDragMove/pan/wheel 调用 (画布变换热路径)。
- **import 方向** — popups → i18n/state/utils/storage/favicon (正向 ESM); 反向依赖 (getLargeBox/renderInnerSurface/showBoxDeletedWarning + addPopupTracker/removePopupTracker + makeId/api/debug/debugWarn) 经 initPopupsFacade 注入, 禁 render↔popups 循环 import (与票12 conn 同款门面)。

## 验证证据
- node --check 三模块 OK; popups.js ESM 冒烟 (5 导出平价) 通过; git diff --check 干净。
- npm run build DONE_BUILD; dist 契约不变 (popups.js 进两 dist)。
- 本票 checkpoint 全绿: boxing-popup-dragselect.spec.ts (弹窗拖选不误关) + boxing-i18n-module.spec.ts (三语切换) + boxing-v3.spec.ts (源码断言迁移后 15/15)。
- npm test 397 passed / 22 failed 全属已知 flaky: 21 firefox (票15 满负载假失败签名, 全集中 firefox-extension) + 1 chromium state-sync; chromium state-sync 与 firefox accent-theme 逐项 solo 复跑全绿, 确认非本票回归。

## 复核不通过项修复 (Firefox i18n checkpoint)

**主脑复核:** Firefox i18n checkpoint 单跑未独立复现绿 (page.goto 超时 / 浏览器被关闭)。**已修复并验证绿。**

**判别结论 (log 定位, 非现象推理):** test 脚本只放大, 根因是本机环境内存/资源限制, 非本票代码或断言回归。

硬证据:
1. `DEBUG=pw:api` 时间线: `browserType.launch succeeded +22s` — Firefox 有头启动本身吃 ~22s, 几乎耗尽 30s 默认测试预算; 随后 `page.goto` 卡在 `navigating → domcontentloaded`, `commit` 事件始终未 fire, URL 停 `about:blank`、零 console — 启动/导航 commit 层卡死, 非页面内容或断言失败。
2. A/B 裸 goto (不装任何 fetch stub、不跑断言) 也 2/3 轮偶发卡死 (`about:blank` + 零 console) — 与 i18n 测试脚本、本票改动无关。
3. atomcode 多源判定: playwright#12182 (Windows 资源过载 → workers:1/fullyParallel:false 修复)、#21179 (Windows 容器首次连接超时)、#31050 (Windows stuck at about:blank) — 与本机 8 线程 + fullyParallel + 有头 Firefox 冷启动组合同签名; 本机内存 74.7% 占用、3.9GB 空闲、另有 7 个 msedgewebview2 进程。

修复: `boxing-i18n-module.spec.ts` 加 `test.setTimeout(120_000)` (注释记录 launch +22s 依据)。修复后 Firefox 车道单跑 **4/4 绿 × 4 轮** (32s / 53s / 2.2m 冷启动 / 16s); 其中 2.2m 冷启动轮在默认 30s 预算下必挂、提预算后必绿 — 确定性证明。

## 给大脑的收口注意
1. render.js 头注释已更新 (ticket-13 摘除 bookmark rows/popups), 但残留 "Remaining" 清单仍含 box CRUD — 后续若拆 box CRUD 需先做符号 census。
2. popups.js 头注释已登记门面注入面 (9 依赖) 与 tracker 三件套留 render.js 的边界裁定, 后续票延续该头注释台账。
3. WORKFLOW §6 新增 3 条票13 教训 (popup 边界先看热路径调用 + 残留 facade 注入变量无害不拆 + 判断 test-vs-environment 须用 launch 时长/commit 事件 log 定位)。
4. **遗留环境治理待主脑裁决** (不在票13 代码交付面内): 若要求"不靠提预算、在本机环境自然绿", 需 CI/本机 worker 治理 (workers:1 + fullyParallel:false, 或 firefox 项目单独 workers:2 + retries:1), 属 ticket 15 quarantine 治理范畴, 建议另立环境治理票。
