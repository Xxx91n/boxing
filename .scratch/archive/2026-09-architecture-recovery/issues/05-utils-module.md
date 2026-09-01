# 05 — 纯工具函数抽离

**What to build:** ntp.js 中无副作用的纯工具函数 (按 02 票调用图清单, 如 URL 校验以外的纯函数) 抽为 utils ES module; ntp.js import 消费。

**Blocked by:** 03

**Status:** done (2026-09-01, ticket 05 agent)

- [x] utils 模块只含纯函数, 无 storage/DOM 副作用 — ntp/utils.js (228 行): 15 常量 (CANVAS_GRID/INNER_GRID/RESIZE_SNAP/LARGE_DEF_W+H/SMALL_DEF_W+H/LARGE_MIN_W+H/SMALL_MIN_W+H/ZOOM_STEPS/MIN_ZOOM+MAX_ZOOM/SPATIAL_THRESHOLD) + 15 函数 (snapCanvas/snapInner/rectsOverlap/clampToEdge/elasticSnap/buildSpatialGrid/querySpatialNearby/hexToRgbTriplet/defaultLayout/migrateLayout/mergeById/largeKey/smallKey/normalizeBookmarkUrl/screenToWorld), 全部逐字节搬移。副作用抽查 (剥注释/字符串后扫 storage/localStorage/document/chrome/browser/i18n(/fetch(/window(/addEventListener 等 12 类标记): NONE。migrateLayout 纯度确认 (仅操作传入 raw 对象, 无 storage 访问 — callgraph ⚠ 已解除)
- [x] 所有原调用点改为 import — ntp.js 头部单条 import 28 符号 (与 utils.js export 对称, 逐名验证无 redeclare/无未用); rectsOverlap 仅 elasticSnap 消费 (已随迁同模块), clampToEdge 全库零调用点 (死代码, 保留 export 于 utils 供后续票), 二者不进 ntp.js import。30-2=28 后 node --check + build + 冒烟 (empty-state+memory, 24 passed) 复验
- [x] `npm test` + `npm run build` 绿 — build DONE_BUILD ×4 (每批次后), dist 双树含 utils.js + import 链完整; npm test exit 0 / 357 passed (27m, chromium-extension, 与票04 i18n 并行改动同树合跑)

## 处置结论 (子窗口 → 大脑, 2026-09-01)

1. **交付物**: 分支 arch-recovery-05-utils (锚定于 03 之上), 提交 1caf04e(批次1 几何/吸附) → 9eb086c(批次2 layout-data) → 67e47be(批次3 杂项) → nyx(import 收窄); ntp.js 5951→5745 行 (-206), utils.js 228 行。每批次独立 build+smoke+commit (小步)。
2. **纯度排除清单** (报告候选但未入 utils, 供 06/07/08 认领): makeId+idSequence (读会话态 writerId+自持计数器 → 票06 state); mergeConcurrentLayout (读 layout 同一性+clearedTombstones+debug → 票07 storage 门面); clampCanvasPan/clampInnerPan (读实时 DOM 容器+尺寸缓存态 → 票08 pan); isSafeExtUrl/ensureHttpsUrl/AUD_PRIVATE_HOST_RE (URL 校验按本票范围除外 + window.__boxingIsSafeExtUrl 导出契约留入口); MAX_LARGE_BOXES/MAX_SMALL_BOXES/MAX_BOOKMARKS (报告已归票06)。
3. **debug/log 系统裁决: 保留入口** (报告 §7.2-2 的两选项之一)。不能逐字节搬: __logLevel 在 ?debug URL 解析器 (5 处) 与 __boxingDebug API (2 处) 被赋值, __logRing 被 exportLog/clearLog 直改 — 抽出必须改 setLogLevel/getLogRing 接口面 = 独立票的工作量, 非 05 的机械搬移范围。且其模块级 chrome.storage.local.get + onChanged 监听属存储副作用, 进 utils 违反纯函数验收。建议后续随票06 或单开 debug-module 票 (接口改造点: __logLevel 赋值 ×7、__logRing 触点 ×3、__bgErrLogCache ×1)。
4. **版本控制 (§4.2)**: 4 commit 全部 hunk 级验证后落分支 (与票04 同窗并行同文件 — 票04 的 i18n 改动始终留在 zz 未被我卷入; 票04 落树后我用 hunk 隔离法收窄 import 并临时摘/还其 import 行, 还原后 node --check 验证)。未 push。
5. **教训**: 见 WORKFLOW §6 票05 两行 (blank-run 剖面对照 + 并行同窗 hunk 级提交纪律)。