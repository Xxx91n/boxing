# Closure Report — 26 Feature-layer sibling import whitelist

- 票号: 26 (Round 5)
- 阻塞来源: 23 — Mental model deep research (已完成)
- 完成日期: 2026-09-05
- 子窗口执行; GitButler 独立分支; 未 push、未开 PR。

## 取舍

按 handoff 的 "whitelist or ADR errata" 二选一, 本票采取**双管齐下**:
1. ADR-0016 增补 **§勘误-26** 显式登记 9 条 feature→feature 兄弟 import 为合法边, 与 §勘误-22 "以守卫为准" 原则保持同款裁决语义。
2. `scripts/import-graph-guard.mjs` 新增规则 **B-9** (pretest 门禁, 零新依赖) — 任何不在这 9 条白名单内的 feature→feature 兄弟 import 立即被 `pretest` 拒掉, 退出码非零。

## 当前 Feature-to-Feature 兄弟 Import 枚举 (基线, 来自本票开窗时实测)

| from | to | 调用语句 | 用途 |
|---|---|---|---|
| onboarding.js | render.js | L12: `import { renderCanvas, updateAutohideUI } from './render.js';` | 安装/更新信号触发 tour |
| onboarding.js | settings-ui.js | L13: `import { openSettingsModal } from './settings-ui.js';` | 引导末段开放设置 |
| render.js | persist.js | L24: `import { persistViewState, saveLargeBoxViewState, scheduleLargeBoxViewStatePersist } from './persist.js';` | 视图状态持久化 |
| render.js | conn-layer.js | L25: `import { addEdgeAnchors, disposeAllConns, dsuRebuildFromConnections, ensureConnArrays, ensureGroups, getGroupByParent, markDsuDirty, moveGroupTogether, refreshAllConns, refreshConnsForBox, refreshConnsForBoxSync, renderConnections, scheduleConnRefresh, toggleStarMark } from './conn-layer.js';` | 画布热路径驱动连接层 |
| render.js | popups.js | L26: `import { renderBookmarks } from './popups.js';` | 画布渲染同步弹出层 |
| settings-ui.js | persist.js | L13: `import { applyTheme } from './persist.js';` | 主题切换 |
| settings-ui.js | render.js | L14: `import { getLargeBox, renderInnerSurface, renderCrumbs, renderCanvas, updateAutohideUI, applyCanvasTransform, applyInnerTransform, exitToCanvas, _execDeleteLargeBox, _execDeleteSmallBox } from './render.js';` | 主题/画布变更的入口渲染回放 |
| settings-ui.js | conn-layer.js | L15: `import { disposeAllConns, ensureConnArrays, applyConnDeleteKeydoc, renderConnections } from './conn-layer.js';` | 删除快捷键 / 删除按钮 |
| sync-engine.js | render.js | L14: `import { renderCanvas } from './render.js';` | 远端 merge 完成后调 renderCanvas 重绘 |

共 9 条 feature→feature 兄弟 import (实测, 已落地 B-9 白名单)。

## 守卫自证

### 1. 当前图 (clean)
```bash
$ node scripts/import-graph-guard.mjs
{
  "ok": true,
  "modules": 14,
  "edges": 48,
  "violations": []
}
```
Exit code: 0。跨 14 模块 48 边 0 违规。

### 2. 故意引入未授权 feature→feature 兄弟 import (B-9 拒绝)
在 `ntp/conn-layer.js` 顶部插入 `import { syncEngineProbe } from './sync-engine.js';`:
```bash
$ node scripts/import-graph-guard.mjs
{
  "ok": false,
  "modules": 14,
  "edges": 49,
  "violations": [
    {
      "rule": "B-2",
      "file": "ntp/conn-layer.js",
      "line": 0,
      "message": "import cycle: conn-layer.js -> sync-engine.js -> render.js -> conn-layer.js"
    },
    {
      "rule": "B-9",
      "file": "ntp/conn-layer.js",
      "line": 0,
      "message": "unaccepted feature-to-feature sibling import: sync-engine.js (whitelist ADR-0016 §errata-26)"
    }
  ]
}
```
Exit code: 1。同时被 B-2 (循环) + B-9 (未在白名单) 双向拒绝; 验证后**完整回滚** (Node `fs.writeFileSync` 用 pre-snapshot 字节写回, 不经 `apply_patch` / `git checkout`)。

### 3. 语法 + 端到端检查
- `node --check scripts/import-graph-guard.mjs` exit 0。
- `npm run pretest` (= `node scripts/import-graph-guard.mjs`) exit 0。
- `test/cluster-map.json` 未改动 — B-9 是 B-1..B-8 之外的新规则, 与 CM-1..3 互不影响, 仍 33/33 spec 覆盖。

## 文件改动清单

| 路径 | 改动 | 备注 |
|---|---|---|
| `scripts/import-graph-guard.mjs` | +57 行 (B-9 块 + 9 条白名单) | 零新依赖 |
| `docs/adr/0016-sync-backup-engine-layering.md` | 末尾追加 §勘误-26 (决策 + 表) | 文字与守卫同步, 冲突时仍以守卫为准 |
| `.scratch/architecture-recovery/26-feature-layer-import-whitelist-report.md` | 新增本报告 | 收口 |

未修改: `test/cluster-map.json` (无 CM 规则变更), `package.json` (`pretest` 已挂 B-1..B-8, B-9 复用同一钩子)。

## 后续增边契约

增 feature→feature 兄弟 import 必须两步:
1. 改 `scripts/import-graph-guard.mjs` 中 `acceptedFeatureSiblingEdges` 数组, 加 `'from.js->to.js'`。
2. 在 ADR-0016 §勘误-26 表中加一行说明用途。

否则 `npm run pretest` 红。违反者按 "B-9 unaccepted feature-to-feature sibling import" 拦截, 与 B-1..B-8 同等机检强度。

## WORKFLOW §4.2 版本控制

本票子窗口在 GitButler 独立分支 (`ticket-26-feature-layer-import-whitelist`) 上操作, 仅 commit 本票改动; 不 push、不开 PR; 不动其他分支/工作区。
