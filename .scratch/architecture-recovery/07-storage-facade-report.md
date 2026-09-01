# 07 — storage 写入门面 · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-01
- 状态: **done** — issues/07 验收 4/4 勾选, 处置结论同步写入 issues/07 (短版); 本文件为收口用完整版
- 分支: `arch-recovery-07-storage` (栈顶, anchor 于 arch-recovery-04-i18n 之上, 全链 01→02→03→05→06→04 为其祖先)
- 提交: feat `dbb0bde` (ntp/ntp.js + ntp/storage.js) + docs `14af791` (issues/07 + WORKFLOW §6)

## 交付物

| 文件 | 变化 | 内容 |
|---|---|---|
| ntp/storage.js (新, 366 行) | +365 | 写链三件套整块逐字节迁入: saveLayout 串行链 / applyExternalLayout 防回环 / registerStorageOnChanged; 随迁 mergeConcurrentLayout (票05 纯度清单认领), loadLayout+saveSnapshot+getLatestSnapshot+crashRescue, stripGroupsForPersist/gcTombstones/markDeleted/TOMBSTONE_TTL_MS; 新增 initStorageFacade (18 个跨作用域依赖一次性注入) 与 directSetBoxingLayout (SEC-08 direct 类显式出口) |
| ntp/ntp.js | 5442→5160 行 | import 门面 12 绑定 + init 注入; WebDAV 4 处 direct write → directSetBoxingLayout (注释/try-catch 原样); 未用 import 裁剪 (chain/flag/debounce 三对 + MAX_TOMBSTONES + defaultLayout); 79 个 saveLayout 调用点零改动 |

导出面 (12): initStorageFacade / registerStorageOnChanged / directSetBoxingLayout / loadLayout / saveLayout / saveLayoutDebounced / saveSnapshot / applyExternalLayout / stripGroupsForPersist / gcTombstones / markDeleted / TOMBSTONE_TTL_MS。

## 结构决策 (复核重点)

1. **注入式搬移而非参数传透/重设计**: 跨作用域函数用模块级 let 槽位 + initStorageFacade 一次性赋值, 搬移块内 0 字节改动 (WORKFLOW §6 byte-exact)。注入调用位于 layoutStorage 行后 (IIFE 最前), 早于任何门面调用, 无 TDZ (18 个依赖全为 hoisted function decl)。
2. **state.js 单例不动** (票06 契约): storageWriteChain/applyingExternalLayout/saveDebounceTimer 仍在 state.js, 门面是其**唯一写者** (ntp.js 残留 0, census 断言); 票06 state.js 头注 "tickets 07/08 import these same singletons" 兑现。
3. **门面写入面完备**: boxingLayout 写 = saveLayout 链 / directSetBoxingLayout / loadLayout 迁移写 (门面内); boxingSnapshots 写 = saveSnapshot (门面内)。ntp.js 0 处直接 layoutStorage.set; background.js 仅 bgErrLog (独立 service-worker 上下文, 无法 import NTP ESM — 记为边界, 非布局写路径)。

## 验收证据

| 验收项 | 证据 |
|---|---|
| 唯一门面, 其余只调用其方法 | census 27 符号: ntp.js 中 chain/flag/debounce 及 setter 全 0 残留; layoutStorage 仅剩 L70 声明 + dumpStorage 读 |
| 三件套原样未拆散 | 搬移脚本 19 项边界断言 + blockD verbatim 嵌入断言; export 前缀为唯一差异; 注册时点不变 (init 原 L5316 位) |
| 双标签不回环不丢写 | 脚本 9/9 (真 chrome.storage.onChanged, persistent context --load-extension, chrome-extension:// 两 NTP 标签): A→B 19ms; B→A 双箱保留; 并发写收敛 4 箱并集; revision 6→6 静止; writerId 自写拒绝 |
| npm test + build 绿 | 419 passed (6.0m, 复跑确证; 首轮 firefox accent-theme 3 项车道抖动); build DONE_BUILD, dist 双树含 storage.js; node --check ×2 + ESM import 冒烟 12 导出平价; git diff --check 干净 |

## 版本控制轨迹 (§4.2)

- 首次 commit 被拒: ntp.js 行级依赖票05 (wqq) + 票06 (yuw)。多依赖无 Hint → `but branch new arch-recovery-07-storage --anchor arch-recovery-04-i18n` (栈顶含全链, 与编辑基线一致) 后落位。教训已写回 WORKFLOW §6。
- WORKFLOW.md 曾发现票06 车道孤儿 §6 行 (未提交): 用票05 隔离法只提交本票行并原样还回 — **该孤儿行现仍在 zz 未提交区, 归票06/大脑收口处置**, 本票未代提交。

## 给大脑的收口注意

1. merge/落库顺序: 07 在 04 之上 (04→07), 其余不变; 未 push。
2. zz 未提交区遗留 (非本票): 票06 WORKFLOW 孤儿行 1 条; dev-chrome (M/D junction) + dev-firefox (A junction) 为构建 junction 噪音; .scratch 04-10 的 handoffs/prompts 及 issues 08-10 仍为未跟踪 (大脑既有状态, 未触碰)。
3. 给票08: 渲染管线 (renderCanvas 系) 仍在 ntp.js; 若迁出, **initStorageFacade 注入表需同步更新** (renderCanvas/renderInnerSurface/renderCrumbs/updateCaption/applyInnerTransform/renderConnections/syncSettingsDOM/showBoxDeletedWarning/pruneConnArrays/persistViewState/rebuildBoxMaps/markDsuDirty/ensureGroups/dsuRebuildFromConnections/getLargeBox + log 三件套)。
