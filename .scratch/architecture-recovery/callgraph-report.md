# ntp.js 调用图扫描报告 (ticket 02)

- 生成: `node tools/callgraph-scan.mjs` (无头可重跑, 零依赖)
- 源文件: `D:\Aworker\crx\boxing\ntp\ntp.js` — 6056 行, 309023 bytes
- 方法: 正则 + 行级 strip (注释/字符串) + 花括号深度; 顶层符号 = IIFE 内 depth-2 声明 + IIFE 外 depth-0 声明。不做完整 AST (handoff 02 明示允许)。
- 上游: research-report.md 结论 1 — 拆分前先扫描, 否则机械搬移炸 ReferenceError。

## 1. 顶层符号清单

共 321 个顶层符号 (function 167 / const-let-var 154), 按 50 个注释分节区块归属:

| 区块 | 行段 | 符号数 | function 符号 (var 符号省略, 见脚本输出) |
|---|---|---|---|
| cross-browser API | 5-46 | 2 |  (+2 var) |
| constants | 47-75 | 15 | isSafeExtUrl (+14 var) |
| log system (BX-AUD-05) | 76-143 | 14 | __logFmt, __logPush, debugSampled, debug, debugErr, debugWarn, debugInfo (+7 var) |
| i18n store | 249-502 | 7 | loadI18nStore, i18n, applyI18n (+4 var) |
| DOM refs | 503-583 | 54 | refreshContainerSizes, initSizeObserver (+52 var) |
| state | 584-636 | 28 | makeId (+27 var) |
| storage | 637-657 | 1 | loadLayout |
| ADR-0009: Versioned snapshots + crash rescue | 658-958 | 24 | saveSnapshot, getLatestSnapshot, crashRescue, currentViewSnapshot, persistViewState, pushTabViewHistory, loadFallbackTabView, saveLargeBoxViewState, scheduleLargeBoxViewStatePersist, flushPendingViewStatePersist, mergeById, mergeConcurrentLayout +5 more (+7 var) |
| Accent Theme Manager (ADR-0012) | 959-1142 | 6 | hexToRgbTriplet, applyTheme, defaultLayout, migrateLayout, loadSettings (+1 var) |
| box index maps (ADR-0007 Phase 1.3: O(1) lookups) | 1143-1157 | 3 | rebuildBoxMaps (+2 var) |
| helpers | 1158-1230 | 25 | getLargeBox, acquireLineEl, recycleLineEl, ensureConnArrays, pruneConnArrays, findConn (+19 var) |
| ADR-0007 Phase 1.2: unified commit(op) (tldraw Store put/rem | 1231-1474 | 14 | getBoxByTieredKey, commit, addConnection, removeConnection, getConnDeleteTrigger, deleteConnById, setConnDeleteAction, onConnLinePointerDown, onConnLineDblClick, onConnLineKeydown, applyConnDeleteKeydoc (+3 var) |
| END INVARIANT | 1485-1752 | 15 | disposeAllConns, addEdgeAnchors, getConnSvg, boxMidPoint, connSvgForConn, connSvgVisibleRect, updateSvgLine, renderConnections, scheduleConnRefresh, refreshConnsForBox, refreshConnsForBoxSync, refreshAllConns (+3 var) |
| Star-mark / group drag | 1753-1868 | 9 | dsuFind, dsuMake, dsuUnion, dsuReset, markDsuDirty, dsuRebuildFromConnections, dsuGroupMembers, ensureGroups (+1 var) |
| Tiered keys for cross-level connections (BX-DEV-137+) | 1869-2025 | 8 | largeKey, smallKey, resolveBoxEl, allValidKeys, getGroupByParent, toggleStarMark, addMember, moveGroupTogether |
| active-connect mode (drag from edge anchor to target box) | 2026-2232 | 14 | enterConnectMode, exitConnectMode, getSmallBox, snapCanvas, snapInner, rectsOverlap, clampToEdge, clampCanvasPan, clampInnerPan, buildSpatialGrid, querySpatialNearby, elasticSnap +1 more (+1 var) |
| Obsidian-style zoom & pan | 2233-2276 | 7 | applyCanvasTransform, applyInnerTransform, zoomAtPoint, zoomStep (+3 var) |
| Header Pin: two-position strategy (v3.7.2) | 2277-2459 | 4 | updateAutohideUI, renderCanvas, setBodyExpandHeight, createLargeBoxEl |
| render inner (small boxes inside a large box) | 2632-2836 | 8 | enterLargeBox, _enterLargeBox, exitToCanvas, renderCrumbs, ensureInnerSurfaceContent, renderInnerSurface, createSmallBoxEl (+1 var) |
| auto-expand button | 2859-3304 | 7 | renderBookmarks, addPopupTracker, removePopupTracker, repositionAllPopups, showBookmarkEditPopup, showAddBookmarkPopup (+1 var) |
| Manual Drag (real-time, no jump) | 3305-3566 | 5 | onBmRowDragStart, onBoxDragStart, onBoxDragVisHide, onBoxDragMove, onBoxDragEnd |
| Canvas Pan (left-drag empty area) | 3567-3712 | 9 | onCanvasPanStart, onCanvasPanMove, onCanvasPanEnd, onCanvasPanVisHide, onInnerPanStart, onInnerPanMove, onInnerPanEnd, onInnerPanVisHide (+1 var) |
| Ctrl+scroll zoom | 3713-3757 | 2 | onCanvasWheel, onInnerWheel |
| resize | 3758-3814 | 1 | onResizeStart |
| create / delete | 3815-4101 | 13 | addLargeBoxAt, addLargeBox, updateInnerCaption, deleteLargeBox, _execDeleteLargeBox, validateCurrentBox, showBoxDeletedWarning, addSmallBox, addSmallBoxAt, deleteSmallBox, _execDeleteSmallBox, syncSettingsDOM +1 more |
| settings modal | 4102-4133 | 2 | openSettingsModal, closeSettingsModal |
| confirm modal (in-page, replaces browser confirm()) | 4134-4150 | 3 | openConfirmModal, closeConfirmModal (+1 var) |
| search / caption | 4151-4376 | 9 | updateCaption, runSearch, renderSearchResults, hideSearchResults, clearSearchHighlight, applySearchHighlight, openSearchHit, enterAndLocateSmallBox, openBookmarkUrl |
| context menu (right-click → back) | 4377-4384 | 1 | onContextMenu |
| keyboard | 4385-4425 | 1 | onKeyDown |
| dblclick create (also single-click two-quick for new boxes) | 4426-4486 | 4 | onCanvasClick, onCanvasDblClick, onInnerClick, onInnerDblClick |
| window resize → refresh canvas transform | 4487-4511 | 1 | normalizeBookmarkUrl |
| BX-ONBOARDING: first-run guided tour | 5822-6056 | 5 | probe (+4 var) |

## 2. 被引用最多的符号 (跨区块引用次数 top 40)

| 符号 | kind | 定义行 | 定义区块 | 跨区块引用次数 | 覆盖区块数 |
|---|---|---|---|---|---|
| `layout` | var | 585 | state | 312 | 27 |
| `i18n` | function | 464 | i18n store | 133 | 15 |
| `debug` | function | 139 | log system (BX-AUD-05) | 110 | 22 |
| `innerZoom` | var | 599 | state | 62 | 17 |
| `currentLargeBoxId` | var | 597 | state | 53 | 13 |
| `saveLayout` | function | 918 | ADR-0009: Versioned snapshots + crash re | 52 | 21 |
| `dragState` | var | 604 | state | 46 | 2 |
| `debugErr` | function | 140 | log system (BX-AUD-05) | 43 | 12 |
| `canvasZoom` | var | 598 | state | 43 | 15 |
| `getLargeBox` | function | 1159 | helpers | 38 | 13 |
| `connLines` | var | 1171 | helpers | 31 | 10 |
| `innerPanX` | var | 602 | state | 31 | 10 |
| `panState` | var | 608 | state | 29 | 3 |
| `canvasContainer` | var | 507 | DOM refs | 24 | 9 |
| `innerCanvas` | var | 522 | DOM refs | 22 | 9 |
| `debugWarn` | function | 141 | log system (BX-AUD-05) | 21 | 8 |
| `innerSurface` | var | 515 | DOM refs | 21 | 7 |
| `refreshAllConns` | function | 1751 | END INVARIANT | 21 | 6 |
| `writerId` | var | 626 | state | 20 | 3 |
| `headerPinBtn` | var | 2273 | Obsidian-style zoom & pan | 20 | 1 |
| `headerPinned` | var | 618 | state | 19 | 6 |
| `api` | var | 6 | cross-browser API | 18 | 5 |
| `largeKey` | function | 1873 | Tiered keys for cross-level connections  | 18 | 6 |
| `LARGE_DEF_W` | var | 51 | constants | 18 | 8 |
| `provisionalLine` | var | 1202 | helpers | 17 | 2 |
| `canvasPanX` | var | 601 | state | 16 | 8 |
| `canvasSurface` | var | 509 | DOM refs | 16 | 7 |
| `applyInnerTransform` | function | 2244 | Obsidian-style zoom & pan | 16 | 12 |
| `renderCanvas` | function | 2332 | Header Pin: two-position strategy (v3.7. | 15 | 8 |
| `layoutStorage` | var | 45 | cross-browser API | 15 | 5 |
| `applyCanvasTransform` | function | 2234 | Obsidian-style zoom & pan | 14 | 9 |
| `smallKey` | function | 1874 | Tiered keys for cross-level connections  | 13 | 6 |
| `SMALL_DEF_W` | var | 52 | constants | 13 | 7 |
| `searchInput` | var | 544 | DOM refs | 12 | 3 |
| `$` | var | 504 | DOM refs | 11 | 5 |
| `getGroupByParent` | function | 1900 | Tiered keys for cross-level connections  | 11 | 5 |
| `renderConnections` | function | 1649 | END INVARIANT | 11 | 8 |
| `getSmallBox` | function | 2089 | active-connect mode (drag from edge anch | 11 | 6 |
| `boxConnIdx` | var | 1175 | helpers | 11 | 2 |
| `canvasConnSvg` | var | 1199 | helpers | 11 | 2 |

## 3. 跨区块隐式依赖边 (引用次数 ≥5 的边)

区块 = 注释分节头; 边方向 = 符号定义区块 → 引用发生区块。这是"机械搬移会炸"的依赖面:

| 定义区块 | 被引用区块 | 次数 |
|---|---|---|
| state | BX-DEV-SYNC: WebDAV two-way sync (replaces bl | 104 |
| state | create / delete | 72 |
| state | ADR-0009: Versioned snapshots + crash rescue | 67 |
| helpers | END INVARIANT | 59 |
| state | Manual Drag (real-time, no jump) | 53 |
| DOM refs | create / delete | 40 |
| state | Encrypted credential storage (Web Crypto AES- | 38 |
| state | Canvas Pan (left-drag empty area) | 36 |
| i18n store | Encrypted credential storage (Web Crypto AES- | 34 |
| DOM refs | render inner (small boxes inside a large box) | 32 |
| state | search / caption | 31 |
| Obsidian-style zoom & pan | Header Pin: two-position strategy (v3.7.2) | 31 |
| state | BX-AUD-05: diagnostics UI surface (Settings > | 30 |
| state | keyboard | 28 |
| DOM refs | Settings tab switching | 28 |
| log system (BX-AUD-05) | Encrypted credential storage (Web Crypto AES- | 27 |
| helpers | Star-mark / group drag | 26 |
| DOM refs | header auto-hide ON by default: fullscreen im | 26 |
| DOM refs | search / caption | 26 |
| log system (BX-AUD-05) | ADR-0009: Versioned snapshots + crash rescue | 24 |
| log system (BX-AUD-05) | create / delete | 23 |
| helpers | active-connect mode (drag from edge anchor to | 23 |
| log system (BX-AUD-05) | BX-DEV-SYNC: WebDAV two-way sync (replaces bl | 22 |
| constants | create / delete | 22 |
| state | Settings tab switching | 21 |
| log system (BX-AUD-05) | Enhanced debug system (v3.6.5+) | 20 |
| Tiered keys for cross-level connections (BX-D | Manual Drag (real-time, no jump) | 19 |
| state | Accent Theme Manager (ADR-0012) | 18 |
| state | render inner (small boxes inside a large box) | 18 |
| i18n store | auto-expand button | 18 |
| active-connect mode (drag from edge anchor to | create / delete | 16 |
| state | Enhanced debug system (v3.6.5+) | 15 |
| state | Header Pin: two-position strategy (v3.7.2) | 15 |
| state | header auto-hide ON by default: fullscreen im | 15 |
| state | Auto-backup scheduler | 15 |
| i18n store | BX-DEV-SYNC: WebDAV two-way sync (replaces bl | 15 |
| helpers | ADR-0007 Phase 1.2: unified commit(op) (tldra | 14 |
| state | END INVARIANT | 14 |
| state | Ctrl+scroll zoom | 14 |
| helpers | auto-expand button | 13 |
| DOM refs | Header Pin: two-position strategy (v3.7.2) | 13 |
| state | resize | 12 |
| DOM refs | BX-AUD-05: diagnostics UI surface (Settings > | 12 |
| constants | active-connect mode (drag from edge anchor to | 12 |
| DOM refs | Obsidian-style zoom & pan | 11 |
| log system (BX-AUD-05) | Auto-backup scheduler | 10 |
| log system (BX-AUD-05) | BX-AUD-05: diagnostics UI surface (Settings > | 10 |
| helpers | header auto-hide ON by default: fullscreen im | 10 |
| state | helpers | 10 |
| state | ADR-0007 Phase 1.2: unified commit(op) (tldra | 10 |
| ADR-0009: Versioned snapshots + crash rescue | Settings tab switching | 10 |
| i18n store | Header Pin: two-position strategy (v3.7.2) | 10 |
| DOM refs | active-connect mode (drag from edge anchor to | 10 |
| DOM refs | Canvas Pan (left-drag empty area) | 10 |
| DOM refs | init | 10 |
| helpers | Manual Drag (real-time, no jump) | 9 |
| state | Star-mark / group drag | 9 |
| ADR-0009: Versioned snapshots + crash rescue | Enhanced debug system (v3.6.5+) | 9 |
| ADR-0009: Versioned snapshots + crash rescue | BX-DEV-SYNC: WebDAV two-way sync (replaces bl | 9 |
| i18n store | create / delete | 9 |

## 4. 高风险符号点名 (跨区块引用 ≥3 个区块 — 拆分时必须显式 import/export 或注入)

共 79 个符号横跨 ≥3 个区块。其中被 3 个以上目标领域需要的符号是拆票 03-08 的接口设计输入。

- **`layout`** (var, L585, 拟属 state 模块 (票06)): 跨 27 区块 / 312 次引用 → Enhanced debug system (v3.6.5+ | storage | ADR-0009: Versioned snapshots  | Accent Theme Manager (ADR-0012 | box index maps (ADR-0007 Phase | helpers | ADR-0007 Phase 1.2: unified co | END INVARIANT | Star-mark / group drag | Tiered keys for cross-level co | Header Pin: two-position strat | render inner (small boxes insi | auto-expand button | Manual Drag (real-time, no jum | Ctrl+scroll zoom | create / delete | settings modal | search / caption | keyboard | init | header auto-hide ON by default | Settings tab switching | Encrypted credential storage ( | BX-DEV-SYNC: WebDAV two-way sy | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf | BX-ONBOARDING: first-run guide
- **`i18n`** (function, L464, 拟属 i18n 模块 (票04)): 跨 15 区块 / 133 次引用 → Header Pin: two-position strat | pin button (lock box position) | auto-expand button (hover vs a | render inner (small boxes insi | pin button | auto-expand button | create / delete | confirm modal (in-page, replac | search / caption | init | Encrypted credential storage ( | BX-DEV-SYNC: WebDAV two-way sy | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf | BX-ONBOARDING: first-run guide
- **`debug`** (function, L139, 拟属 debug/log 模块 (spec 未单独拆票, 随 utils 或保留入口)): 跨 22 区块 / 110 次引用 → Enhanced debug system (v3.6.5+ | Debug Address System | i18n store | ADR-0009: Versioned snapshots  | ADR-0007 Phase 1.2: unified co | Tiered keys for cross-level co | active-connect mode (drag from | Header Pin: two-position strat | auto-expand button (hover vs a | render inner (small boxes insi | auto-expand button | create / delete | settings modal | search / caption | dblclick create (also single-c | window resize → refresh canvas | header auto-hide ON by default | Encrypted credential storage ( | BX-DEV-SYNC: WebDAV two-way sy | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf | BX-ONBOARDING: first-run guide
- **`innerZoom`** (var, L599, 拟属 state 模块 (票06)): 跨 17 区块 / 62 次引用 → Enhanced debug system (v3.6.5+ | ADR-0009: Versioned snapshots  | Accent Theme Manager (ADR-0012 | END INVARIANT | active-connect mode (drag from | Obsidian-style zoom & pan | render inner (small boxes insi | Manual Drag (real-time, no jum | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | resize | create / delete | search / caption | keyboard | header auto-hide ON by default | Settings tab switching | BX-AUD-05: diagnostics UI surf
- **`currentLargeBoxId`** (var, L597, 拟属 state 模块 (票06)): 跨 13 区块 / 53 次引用 → Enhanced debug system (v3.6.5+ | ADR-0009: Versioned snapshots  | Header Pin: two-position strat | render inner (small boxes insi | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | create / delete | search / caption | context menu (right-click → ba | keyboard | Settings tab switching | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf
- **`saveLayout`** (function, L918, 拟属 storage 门面 (票07)): 跨 21 区块 / 52 次引用 → Enhanced debug system (v3.6.5+ | ADR-0007 Phase 1.2: unified co | active-connect mode (drag from | Header Pin: two-position strat | pin button (lock box position) | auto-expand button (hover vs a | render inner (small boxes insi | pin button | auto-expand button | Manual Drag (real-time, no jum | Ctrl+scroll zoom | resize | create / delete | keyboard | header auto-hide ON by default | Settings tab switching | Encrypted credential storage ( | BX-DEV-SYNC: WebDAV two-way sy | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf | BX-ONBOARDING: first-run guide
- **`debugErr`** (function, L140, 拟属 debug/log 模块 (spec 未单独拆票, 随 utils 或保留入口)): 跨 12 区块 / 43 次引用 → cross-browser API | i18n store | storage | ADR-0009: Versioned snapshots  | ADR-0007 Phase 1.2: unified co | Header Pin: two-position strat | create / delete | Encrypted credential storage ( | BX-DEV-SYNC: WebDAV two-way sy | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf | BX-ONBOARDING: first-run guide
- **`canvasZoom`** (var, L598, 拟属 state 模块 (票06)): 跨 15 区块 / 43 次引用 → Enhanced debug system (v3.6.5+ | ADR-0009: Versioned snapshots  | Accent Theme Manager (ADR-0012 | END INVARIANT | active-connect mode (drag from | Obsidian-style zoom & pan | Manual Drag (real-time, no jum | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | resize | create / delete | keyboard | header auto-hide ON by default | Settings tab switching | BX-AUD-05: diagnostics UI surf
- **`getLargeBox`** (function, L1159, 拟属 state 模块 (票06)): 跨 13 区块 / 38 次引用 → Enhanced debug system (v3.6.5+ | ADR-0009: Versioned snapshots  | ADR-0007 Phase 1.2: unified co | END INVARIANT | Tiered keys for cross-level co | render inner (small boxes insi | auto-expand button | Manual Drag (real-time, no jum | resize | create / delete | search / caption | Settings tab switching | BX-AUD-05: diagnostics UI surf
- **`connLines`** (var, L1171, 拟属 state 模块 (票06)): 跨 10 区块 / 31 次引用 → Enhanced debug system (v3.6.5+ | ADR-0007 Phase 1.2: unified co | END INVARIANT | Header Pin: two-position strat | auto-expand button (hover vs a | auto-expand button | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | resize | header auto-hide ON by default
- **`innerPanX`** (var, L602, 拟属 state 模块 (票06)): 跨 10 区块 / 31 次引用 → ADR-0009: Versioned snapshots  | END INVARIANT | render inner (small boxes insi | Manual Drag (real-time, no jum | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | create / delete | search / caption | keyboard | BX-AUD-05: diagnostics UI surf
- **`panState`** (var, L608, 拟属 state 模块 (票06)): 跨 3 区块 / 29 次引用 → Canvas Pan (left-drag empty ar | create / delete | BX-AUD-05: diagnostics UI surf
- **`canvasContainer`** (var, L507, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 9 区块 / 24 次引用 → Tiered keys for cross-level co | active-connect mode (drag from | Header Pin: two-position strat | render inner (small boxes insi | Manual Drag (real-time, no jum | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | create / delete | header auto-hide ON by default
- **`innerCanvas`** (var, L522, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 9 区块 / 22 次引用 → Tiered keys for cross-level co | active-connect mode (drag from | Header Pin: two-position strat | Manual Drag (real-time, no jum | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | create / delete | search / caption | header auto-hide ON by default
- **`debugWarn`** (function, L141, 拟属 debug/log 模块 (spec 未单独拆票, 随 utils 或保留入口)): 跨 8 区块 / 21 次引用 → Enhanced debug system (v3.6.5+ | ADR-0009: Versioned snapshots  | auto-expand button | create / delete | settings modal | BX-DEV-SYNC: WebDAV two-way sy | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf
- **`innerSurface`** (var, L515, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 7 区块 / 21 次引用 → Tiered keys for cross-level co | active-connect mode (drag from | render inner (small boxes insi | Manual Drag (real-time, no jum | Canvas Pan (left-drag empty ar | search / caption | header auto-hide ON by default
- **`refreshAllConns`** (function, L1751, 拟属 未归类 (人工判读)): 跨 6 区块 / 21 次引用 → Header Pin: two-position strat | auto-expand button (hover vs a | auto-expand button | Ctrl+scroll zoom | resize | header auto-hide ON by default
- **`writerId`** (var, L626, 拟属 state 模块 (票06)): 跨 3 区块 / 20 次引用 → ADR-0009: Versioned snapshots  | create / delete | BX-DEV-SYNC: WebDAV two-way sy
- **`headerPinned`** (var, L618, 拟属 state 模块 (票06)): 跨 6 区块 / 19 次引用 → Enhanced debug system (v3.6.5+ | ADR-0009: Versioned snapshots  | Accent Theme Manager (ADR-0012 | Header Pin: two-position strat | init | BX-AUD-05: diagnostics UI surf
- **`api`** (var, L6, 拟属 未归类 (人工判读)): 跨 5 区块 / 18 次引用 → Enhanced debug system (v3.6.5+ | i18n store | storage | auto-expand button | BX-AUD-05: diagnostics UI surf
- **`largeKey`** (function, L1873, 拟属 utils 模块 (票05)): 跨 6 区块 / 18 次引用 → Enhanced debug system (v3.6.5+ | ADR-0007 Phase 1.2: unified co | Star-mark / group drag | Header Pin: two-position strat | auto-expand button (hover vs a | Manual Drag (real-time, no jum
- **`LARGE_DEF_W`** (var, L51, 拟属 utils 模块 (票05)): 跨 8 区块 / 18 次引用 → Accent Theme Manager (ADR-0012 | END INVARIANT | Tiered keys for cross-level co | active-connect mode (drag from | Header Pin: two-position strat | Manual Drag (real-time, no jum | resize | create / delete
- **`canvasPanX`** (var, L601, 拟属 state 模块 (票06)): 跨 8 区块 / 16 次引用 → ADR-0009: Versioned snapshots  | END INVARIANT | Manual Drag (real-time, no jum | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | create / delete | keyboard | BX-AUD-05: diagnostics UI surf
- **`canvasSurface`** (var, L509, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 7 区块 / 16 次引用 → END INVARIANT | active-connect mode (drag from | Obsidian-style zoom & pan | Header Pin: two-position strat | Canvas Pan (left-drag empty ar | create / delete | header auto-hide ON by default
- **`applyInnerTransform`** (function, L2244, 拟属 render 模块 (票08)): 跨 12 区块 / 16 次引用 → Header Pin: two-position strat | render inner (small boxes insi | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | create / delete | search / caption | keyboard | window resize → refresh canvas | header auto-hide ON by default | Settings tab switching | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf
- **`renderCanvas`** (function, L2332, 拟属 render 模块 (票08)): 跨 8 区块 / 15 次引用 → Enhanced debug system (v3.6.5+ | render inner (small boxes insi | create / delete | Settings tab switching | BX-DEV-SYNC: WebDAV two-way sy | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf | BX-ONBOARDING: first-run guide
- **`layoutStorage`** (var, L45, 拟属 storage 门面 (票07)): 跨 5 区块 / 15 次引用 → Enhanced debug system (v3.6.5+ | storage | ADR-0009: Versioned snapshots  | BX-DEV-SYNC: WebDAV two-way sy | BX-AUD-05: diagnostics UI surf
- **`applyCanvasTransform`** (function, L2234, 拟属 render 模块 (票08)): 跨 9 区块 / 14 次引用 → Header Pin: two-position strat | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | keyboard | window resize → refresh canvas | header auto-hide ON by default | Settings tab switching | Auto-backup scheduler | BX-AUD-05: diagnostics UI surf
- **`smallKey`** (function, L1874, 拟属 utils 模块 (票05)): 跨 6 区块 / 13 次引用 → Enhanced debug system (v3.6.5+ | ADR-0007 Phase 1.2: unified co | Star-mark / group drag | render inner (small boxes insi | auto-expand button | Manual Drag (real-time, no jum
- **`SMALL_DEF_W`** (var, L52, 拟属 utils 模块 (票05)): 跨 7 区块 / 13 次引用 → Accent Theme Manager (ADR-0012 | END INVARIANT | Tiered keys for cross-level co | render inner (small boxes insi | Manual Drag (real-time, no jum | resize | create / delete
- **`searchInput`** (var, L544, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 3 区块 / 12 次引用 → search / caption | keyboard | init
- **`$`** (var, L504, 拟属 未归类 (人工判读)): 跨 5 区块 / 11 次引用 → constants | Obsidian-style zoom & pan | window resize → refresh canvas | BX-DEV-SYNC: WebDAV two-way sy | BX-ONBOARDING: first-run guide
- **`getGroupByParent`** (function, L1900, 拟属 未归类 (人工判读)): 跨 5 区块 / 11 次引用 → Enhanced debug system (v3.6.5+ | ADR-0007 Phase 1.2: unified co | auto-expand button (hover vs a | auto-expand button | Manual Drag (real-time, no jum
- **`renderConnections`** (function, L1649, 拟属 render 模块 (票08)): 跨 8 区块 / 11 次引用 → Enhanced debug system (v3.6.5+ | ADR-0007 Phase 1.2: unified co | active-connect mode (drag from | Header Pin: two-position strat | render inner (small boxes insi | Manual Drag (real-time, no jum | create / delete | Settings tab switching
- **`getSmallBox`** (function, L2089, 拟属 state 模块 (票06)): 跨 6 区块 / 11 次引用 → ADR-0007 Phase 1.2: unified co | END INVARIANT | Tiered keys for cross-level co | Manual Drag (real-time, no jum | resize | search / caption
- **`groupStar`** (var, L1195, 拟属 state 模块 (票06)): 跨 4 区块 / 10 次引用 → Enhanced debug system (v3.6.5+ | ADR-0007 Phase 1.2: unified co | Star-mark / group drag | Tiered keys for cross-level co
- **`ensureConnArrays`** (function, L1205, 拟属 state 模块 (票06)): 跨 6 区块 / 10 次引用 → ADR-0007 Phase 1.2: unified co | END INVARIANT | Star-mark / group drag | Tiered keys for cross-level co | Header Pin: two-position strat | Settings tab switching
- **`updateCaption`** (function, L4152, 拟属 render 模块 (票08)): 跨 7 区块 / 10 次引用 → Header Pin: two-position strat | render inner (small boxes insi | create / delete | init | Settings tab switching | Auto-backup scheduler | BX-ONBOARDING: first-run guide
- **`exitToCanvas`** (function, L2697, 拟属 render 模块 (票08)): 跨 7 区块 / 10 次引用 → create / delete | settings modal | search / caption | context menu (right-click → ba | keyboard | init | Auto-backup scheduler
- **`renderInnerSurface`** (function, L2735, 拟属 render 模块 (票08)): 跨 4 区块 / 10 次引用 → auto-expand button | Manual Drag (real-time, no jum | create / delete | Settings tab switching
- **`connById`** (var, L1172, 拟属 state 模块 (票06)): 跨 3 区块 / 9 次引用 → Enhanced debug system (v3.6.5+ | ADR-0007 Phase 1.2: unified co | END INVARIANT
- **`migrateLayout`** (function, L1059, 拟属 utils 模块 (票05)): 跨 6 区块 / 9 次引用 → Enhanced debug system (v3.6.5+ | storage | ADR-0009: Versioned snapshots  | create / delete | BX-DEV-SYNC: WebDAV two-way sy | Auto-backup scheduler
- **`zoomSlider`** (var, L560, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 3 区块 / 9 次引用 → Obsidian-style zoom & pan | create / delete | Settings tab switching
- **`enterLargeBox`** (function, L2633, 拟属 render 模块 (票08)): 跨 6 区块 / 8 次引用 → Enhanced debug system (v3.6.5+ | auto-expand button (hover vs a | settings modal | search / caption | dblclick create (also single-c | BX-AUD-05: diagnostics UI surf
- **`persistViewState`** (function, L720, 拟属 未归类 (人工判读)): 跨 4 区块 / 8 次引用 → Enhanced debug system (v3.6.5+ | render inner (small boxes insi | Canvas Pan (left-drag empty ar | BX-AUD-05: diagnostics UI surf
- **`saveLargeBoxViewState`** (function, L758, 拟属 未归类 (人工判读)): 跨 4 区块 / 8 次引用 → Enhanced debug system (v3.6.5+ | render inner (small boxes insi | Canvas Pan (left-drag empty ar | search / caption
- **`elasticSnap`** (function, L2187, 拟属 utils 模块 (票05)): 跨 3 区块 / 8 次引用 → Tiered keys for cross-level co | Manual Drag (real-time, no jum | create / delete
- **`CANVAS_GRID`** (var, L48, 拟属 utils 模块 (票05)): 跨 4 区块 / 8 次引用 → Tiered keys for cross-level co | active-connect mode (drag from | Manual Drag (real-time, no jum | create / delete
- **`INNER_GRID`** (var, L49, 拟属 utils 模块 (票05)): 跨 4 区块 / 8 次引用 → Tiered keys for cross-level co | active-connect mode (drag from | Manual Drag (real-time, no jum | create / delete
- **`langSelect`** (var, L552, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 3 区块 / 8 次引用 → create / delete | Settings tab switching | BX-ONBOARDING: first-run guide
- **`settingsModal`** (var, L550, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 3 区块 / 8 次引用 → settings modal | keyboard | header auto-hide ON by default
- **`disposeAllConns`** (function, L1486, 拟属 render 模块 (票08)): 跨 5 区块 / 7 次引用 → Enhanced debug system (v3.6.5+ | Header Pin: two-position strat | render inner (small boxes insi | create / delete | Settings tab switching
- **`normalizeBookmarkUrl`** (function, L4489, 拟属 utils 模块 (票05)): 跨 3 区块 / 7 次引用 → Enhanced debug system (v3.6.5+ | auto-expand button | Auto-backup scheduler
- **`innerSurfaceContent`** (var, L2723, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 3 区块 / 7 次引用 → END INVARIANT | active-connect mode (drag from | header auto-hide ON by default
- **`captionEl`** (var, L543, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 3 区块 / 7 次引用 → create / delete | search / caption | init
- **`commit`** (function, L1329, 拟属 storage 门面 (票07)): 跨 4 区块 / 6 次引用 → Enhanced debug system (v3.6.5+ | Tiered keys for cross-level co | create / delete | BX-ONBOARDING: first-run guide
- **`stripGroupsForPersist`** (function, L886, 拟属 storage 门面 (票07)): 跨 3 区块 / 6 次引用 → Enhanced debug system (v3.6.5+ | storage | BX-DEV-SYNC: WebDAV two-way sy
- **`snapCanvas`** (function, L2093, 拟属 utils 模块 (票05)): 跨 3 区块 / 6 次引用 → Tiered keys for cross-level co | Manual Drag (real-time, no jum | create / delete
- **`snapInner`** (function, L2094, 拟属 utils 模块 (票05)): 跨 3 区块 / 6 次引用 → Tiered keys for cross-level co | Manual Drag (real-time, no jum | create / delete
- **`zoomSliderVal`** (var, L561, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 3 区块 / 6 次引用 → Obsidian-style zoom & pan | create / delete | Settings tab switching
- **`showBoxDeletedWarning`** (function, L3911, 拟属 render 模块 (票08)): 跨 3 区块 / 6 次引用 → render inner (small boxes insi | auto-expand button | Manual Drag (real-time, no jum
- **`ensureGroups`** (function, L1843, 拟属 state 模块 (票06)): 跨 5 区块 / 5 次引用 → Enhanced debug system (v3.6.5+ | storage | ADR-0007 Phase 1.2: unified co | Tiered keys for cross-level co | create / delete
- **`smallBoxById`** (var, L1145, 拟属 state 模块 (票06)): 跨 3 区块 / 5 次引用 → ADR-0007 Phase 1.2: unified co | active-connect mode (drag from | create / delete
- **`repositionAllPopups`** (function, L3063, 拟属 render 模块 (票08)): 跨 3 区块 / 5 次引用 → Manual Drag (real-time, no jum | Canvas Pan (left-drag empty ar | Ctrl+scroll zoom
- **`rebuildBoxMaps`** (function, L1147, 拟属 state 模块 (票06)): 跨 4 区块 / 4 次引用 → storage | ADR-0007 Phase 1.2: unified co | END INVARIANT | create / delete
- **`boxById`** (var, L1144, 拟属 state 模块 (票06)): 跨 3 区块 / 4 次引用 → helpers | ADR-0007 Phase 1.2: unified co | create / delete
- **`saveLayoutDebounced`** (function, L951, 拟属 storage 门面 (票07)): 跨 3 区块 / 4 次引用 → ADR-0007 Phase 1.2: unified co | create / delete | Settings tab switching
- **`updateAutohideUI`** (function, L2281, 拟属 render 模块 (票08)): 跨 3 区块 / 4 次引用 → render inner (small boxes insi | Settings tab switching | BX-ONBOARDING: first-run guide
- **`clampCanvasPan`** (function, L2108, 拟属 utils 模块 (票05)): 跨 3 区块 / 4 次引用 → Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | keyboard
- **`clampInnerPan`** (function, L2124, 拟属 utils 模块 (票05)): 跨 3 区块 / 4 次引用 → Canvas Pan (left-drag empty ar | Ctrl+scroll zoom | keyboard
- **`MAX_LARGE_BOXES`** (var, L55, 拟属 state 模块 (票06)): 跨 3 区块 / 4 次引用 → create / delete | header auto-hide ON by default | Auto-backup scheduler
- **`toggleStarMark`** (function, L1910, 拟属 render 模块 (票08)): 跨 3 区块 / 3 次引用 → Enhanced debug system (v3.6.5+ | auto-expand button (hover vs a | auto-expand button
- **`_execDeleteLargeBox`** (function, L3889, 拟属 render 模块 (票08)): 跨 3 区块 / 3 次引用 → Enhanced debug system (v3.6.5+ | settings modal | confirm modal (in-page, replac
- **`currentLang`** (var, L440, 拟属 i18n 模块 (票04)): 跨 3 区块 / 3 次引用 → Enhanced debug system (v3.6.5+ | BX-AUD-05: diagnostics UI surf | BX-ONBOARDING: first-run guide
- **`markDsuDirty`** (function, L1795, 拟属 state 模块 (票06)): 跨 3 区块 / 3 次引用 → storage | ADR-0007 Phase 1.2: unified co | create / delete
- **`loadI18nStore`** (function, L444, 拟属 i18n 模块 (票04)): 跨 3 区块 / 3 次引用 → Accent Theme Manager (ADR-0012 | Settings tab switching | BX-ONBOARDING: first-run guide
- **`backBtn`** (var, L546, 拟属 DOM refs (入口注入层, 票06 state 或入口模块)): 跨 3 区块 / 3 次引用 → Header Pin: two-position strat | render inner (small boxes insi | init
- **`setBodyExpandHeight`** (function, L2379, 拟属 render 模块 (票08)): 跨 3 区块 / 3 次引用 → auto-expand button (hover vs a | render inner (small boxes insi | auto-expand button
- **`addSmallBox`** (function, L3931, 拟属 render 模块 (票08)): 跨 3 区块 / 3 次引用 → render inner (small boxes insi | settings modal | header auto-hide ON by default

## 5. 按领域分区建议 (对齐 spec.md strangler 顺序)

| 领域 | 符号数 | 代表符号 |
|---|---|---|
| 未归类 (人工判读) | 28 | api, $, $$, lastClickTime, lastClickTarget, lastDragEndTime, lastEnterLargeBoxAt, lastDragEndId, currentViewSnapshot, persistViewState +18 |
| storage 门面 (票07) | 21 | layoutStorage, TAB_VIEW_KEY, LAST_ACTIVE_VIEW_KEY, TAB_VIEW_HISTORY_KEY, MAX_TAB_VIEW_HISTORY, loadLayout, MAX_SNAPSHOTS, MAX_SNAPSHOT_BYTES, MAX_SNAPSHOTS_TOTAL_BYTES, saveSnapshot +11 |
| utils 模块 (票05) | 36 | CANVAS_GRID, INNER_GRID, RESIZE_SNAP, LARGE_DEF_W, SMALL_DEF_W, LARGE_MIN_W, SMALL_MIN_W, ZOOM_STEPS, MIN_ZOOM, DEBUG +26 |
| state 模块 (票06) | 67 | MAX_LARGE_BOXES, MAX_SMALL_BOXES, MAX_BOOKMARKS, __sizeObserver, layout, currentLargeBoxId, canvasZoom, innerZoom, canvasPanX, innerPanX +57 |
| debug/log 模块 (spec 未单独拆票, 随 utils 或保留入口) | 14 | LOG_ERROR, LOG_RING_MAX, __logLevel, __logRing, __bgErrLogCache, __logSampleSlot, __logFmt, __logPush, LOG_DEBUG_SAMPLE_RATE, debugSampled +4 |
| i18n 模块 (票04) | 7 | i18nStore, I18N_FALLBACK, currentLang, SUPPORTED_LANGS, loadI18nStore, i18n, applyI18n |
| DOM refs (入口注入层, 票06 state 或入口模块) | 53 | canvasContainer, canvasSurface, canvasEmpty, canvasZoomOut, canvasZoomIn, canvasZoomVal, canvasZoomCtrl, innerSurface, innerZoomOut, innerZoomIn +43 |
| render 模块 (票08) | 94 | refreshContainerSizes, initSizeObserver, applyTheme, acquireLineEl, recycleLineEl, getConnDeleteTrigger, deleteConnById, setConnDeleteAction, onConnLinePointerDown, onConnLineDblClick +84 |
| favicon 模块 (票03) | 1 | probe |

未归类符号是分区边界人工判读清单, 见脚本输出第 5 节全量名单。

## 6. 与拆票 (04-08) 验收项对照

| 票 | 验收项 | 本报告对应物 |
|---|---|---|
| 04 i18n | i18n 字典/fallback/i18nStore 抽出 | §5 i18n 桶 + §1 区块 6 (L249-502): `i18nStore` `I18N_FALLBACK`(L251, 全量字典) `currentLang` `SUPPORTED_LANGS` `loadI18nStore`(L444) `i18n()`(L464) `applyI18n`(L491); I18N_FALLBACK 单字面量占 L251-439 (~190 行) |
| 05 utils | 只含纯函数, 无 storage/DOM 副作用 | §5 utils 桶: `isSafeExtUrl`(L64, 引用 AUD_PRIVATE_HOST_RE) `makeId`(L628) `hexToRgbTriplet`(L1025) `defaultLayout`(L1052) `migrateLayout`(L1059, ⚠引用 storage 键, 迁移时须确认纯度) `mergeById`(L821) `mergeConcurrentLayout`(L828) `snapCanvas/snapInner/rectsOverlap/clampToEdge/clampCanvasPan/clampInnerPan`(L2093-2141) `screenToWorld`(L2225) `largeKey/smallKey`(L1873) |
| 06 state | 共享可变状态单点持有 | §5 state 桶 (~40 符号): 核心为 `layout`(L585) 及索引 Map 族 `boxById/smallBoxById/connById/connLines/connIdx/boxConnIdx/boxGroupId/groupMembers/groupStar/groupIdx`(L1144-1201) + 视图状态 `canvasZoom/innerZoom/canvasPan*/innerPan*/dragState/resizeState/panState`(L598-608) + 写链标志 `storageWriteChain/applyingExternalLayout`(L632-633, ⚠票07 同需) |
| 07 storage 门面 | 写链+防回环+onChanged 不拆散 | §1 区块 8-9 (L637-958): `saveLayout`(L918) `saveLayoutDebounced`(L951) `applyExternalLayout`(L4021) `commit`(L1231) `markDeleted/gcTombstones/stripGroupsForPersist`(L886-910) + 标志对 `storageWriteChain/applyingExternalLayout`(L632-633); `layoutStorage`(L45) + api.storage 12 处调用面 |
| 08 持久化+渲染 | 保存路径全走持久化模块; 渲染内聚 | 保存路径 = 票07 门面之上 (见上); 渲染 = §5 render 桶 (最大桶): renderCanvas(L2332) createLargeBoxEl(L2404) createSmallBoxEl(L2786) renderInnerSurface(L2735) renderBookmarks(L2937) drag/pan/wheel 族 (L3305-3757) conn SVG 族 (L1486-1751) |

## 7. 风险热点结论 (供票 04-08 引用)

### 7.1 高风险 (handoff 定义: 跨领域引用 ≥3 处)

共 30 个符号被 ≥3 个领域引用 (领域 = 拆分目标模块)。这些符号是票 04-08 的公共接口设计输入 — 搬移时必须显式 import/export 或由入口注入, 任何遗漏都会在 ESM 下炸 ReferenceError:

| 符号 | kind | 定义行 | 拟属 | 跨领域数 | 引用次数 | 引用领域 |
|---|---|---|---|---|---|---|
| `layout` | var | 585 | state 模块 (票06) | 5 | 312 | unclassified, storage, utils, state, render |
| `debug` | function | 139 | debug/log 模块 (spec 未单独拆票, 随 utils 或保留入口) | 5 | 110 | unclassified, i18n, storage, render, utils |
| `innerZoom` | var | 599 | state 模块 (票06) | 4 | 62 | unclassified, storage, utils, render |
| `debugErr` | function | 140 | debug/log 模块 (spec 未单独拆票, 随 utils 或保留入口) | 4 | 43 | unclassified, i18n, storage, render |
| `canvasZoom` | var | 598 | state 模块 (票06) | 4 | 43 | unclassified, storage, utils, render |
| `getLargeBox` | function | 1159 | state 模块 (票06) | 4 | 38 | unclassified, storage, render, utils |
| `headerPinned` | var | 618 | state 模块 (票06) | 4 | 19 | unclassified, storage, utils, render |
| `api` | var | 6 | 未归类 (人工判读) | 4 | 18 | unclassified, i18n, storage, render |
| `groupStar` | var | 1195 | state 模块 (票06) | 4 | 10 | unclassified, render, state, utils |
| `ensureConnArrays` | function | 1205 | state 模块 (票06) | 4 | 10 | render, state, utils, unclassified |
| `ensureGroups` | function | 1843 | state 模块 (票06) | 4 | 5 | unclassified, storage, render, utils |
| `currentLargeBoxId` | var | 597 | state 模块 (票06) | 3 | 53 | unclassified, storage, render |
| `saveLayout` | function | 918 | storage 门面 (票07) | 3 | 52 | unclassified, render, utils |
| `innerPanX` | var | 602 | state 模块 (票06) | 3 | 31 | storage, render, unclassified |
| `canvasContainer` | var | 507 | DOM refs (入口注入层, 票06 state 或入口模块) | 3 | 24 | utils, render, unclassified |
| `innerCanvas` | var | 522 | DOM refs (入口注入层, 票06 state 或入口模块) | 3 | 22 | utils, render, unclassified |
| `debugWarn` | function | 141 | debug/log 模块 (spec 未单独拆票, 随 utils 或保留入口) | 3 | 21 | unclassified, storage, render |
| `innerSurface` | var | 515 | DOM refs (入口注入层, 票06 state 或入口模块) | 3 | 21 | utils, render, unclassified |
| `writerId` | var | 626 | state 模块 (票06) | 3 | 20 | storage, render, unclassified |
| `largeKey` | function | 1873 | utils 模块 (票05) | 3 | 18 | unclassified, render, state |
| `canvasPanX` | var | 601 | state 模块 (票06) | 3 | 16 | storage, render, unclassified |
| `canvasSurface` | var | 509 | DOM refs (入口注入层, 票06 state 或入口模块) | 3 | 16 | render, utils, unclassified |
| `applyInnerTransform` | function | 2244 | render 模块 (票08) | 3 | 16 | render, utils, unclassified |
| `applyCanvasTransform` | function | 2234 | render 模块 (票08) | 3 | 14 | render, utils, unclassified |
| `smallKey` | function | 1874 | utils 模块 (票05) | 3 | 13 | unclassified, render, state |
| `$` | var | 504 | 未归类 (人工判读) | 3 | 11 | utils, render, unclassified |
| `renderConnections` | function | 1649 | render 模块 (票08) | 3 | 11 | unclassified, render, utils |
| `migrateLayout` | function | 1059 | utils 模块 (票05) | 3 | 9 | unclassified, storage, render |
| `innerSurfaceContent` | var | 2723 | DOM refs (入口注入层, 票06 state 或入口模块) | 3 | 7 | render, utils, unclassified |
| `commit` | function | 1329 | storage 门面 (票07) | 3 | 6 | unclassified, utils, render |

### 7.2 结构性结论

1. **`layout` 是全域引力中心** (跨 27 区块 / 312 次, 引用面覆盖 state/storage/render/sync 全部领域) — 票06 state 模块必须最先收敛它, 且票07/08 的持久化与渲染都依赖其引用稳定性 (ESM live binding 下传引用即可, 但严禁解构成局部副本)。
2. **`debug`/`debugErr`/`debugWarn`/`debugInfo` 横切全部领域** (debug 本体跨 22 区块/110 次) — 日志系统虽小但被全量函数引用; 建议随 utils (票05) 先行抽出, 否则每张票都要临时 extern 它。
3. **`i18n()` 是 render/sync/onboarding 的强制依赖** (跨 15 区块/133 次) — 票04 抽出 i18n 时, 所有消费模块只 import `i18n` 单函数即可, 接口面最小; 但 `I18N_FALLBACK` 字面量 (L251-439, ~190 行) 必须与 store 同模块, 防止 fallback 与字典漂移。
4. **conn/group 子系统 (L1161-2232) 内聚但与 render 相互咬合** — DSU/group 函数 (拟属 state) 被 render 与 drag 双向调用; 票08 渲染模块要么整体吸收 conn SVG 渲染 (connSvgForConn/updateSvgLine/getConnSvg), 要么把 conn 几何留 render、conn 数据操作 (commit/addConnection/removeConnection) 留 storage/state 层。
5. **favicon 块 (L5910-6056) 是唯一 IIFE 外的顶层代码** — 与文件主体零共享状态 (仅依赖自身 Map + storage + i18n 无关), 天然符合票03 先行拆出的排序; 但 `loadFavicon` 被 render/renderBookmarks 调用, 拆出时 render 侧需 import。
6. **settings/init 区 (L4102-5909, ~1800 行) 含 WebDAV 同步 + 加密凭据 + 诊断 + onboarding**, spec 未单独立票 — 若票08 渲染主内聚时整块落入入口编排, 入口仍会 ~2000 行; 建议在票08 或其后补票中至少把 sync/backup 抽为独立模块 (WORKFLOW §6 已警示 storage 写链不可拆散, sync 层只调用 saveLayout 门面即可)。
7. **window.* 全局导出共 21 处** (`__boxingIsSafeExtUrl` `__boxingDebug` `__bxSync` `_boxingOpenSettings` 等) — 是诊断脚本与 file:// mock 的隐式契约; 拆分时这些导出必须保留在入口模块, 且 file:// mock 兼容性按 spec 首票决议处理。

