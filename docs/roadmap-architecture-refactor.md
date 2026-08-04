# Architecture Refactor Roadmap

> Generated: 2026-08-05
> Method: grill-with-docs (逐题商讨) + PWM 调研 (tldraw Store/BindingUtil, React Flow Edge, Excalidraw Delta, spatial hash benchmarks, GDevelop threshold=32)
> Input: docs/architecture-audit.md (9 recommendations)
> Status: 用户已确认全部方案选择

## 决策摘要

| # | 建议 | 用户选择 | 场景化描述 |
|---|---|---|---|
| Q1 | 停止持久化 layout.groups | 方案二：computed-only + 一次性迁移 | 不存分组清单，老用户升级时读一次旧清单恢复 isParent 后丢弃 |
| Q2 | 统一 mutation API | 方案 A：commit(op) + 模块化 handlers | 所有改动走一个入口，handler 只管数据怎么改，commit 统一负责清理→DSU→存储→渲染 |
| Q3a | boxById/smallBoxById Map | 全做 | Array.find O(n) → Map.get O(1)，38 个调用点纯收益 |
| Q3b | elasticSnap 空间索引 | 全做 | 空间哈希网格，阈值 32（<32 走暴力，>=32 走网格），cell size = 最大盒子直径 |
| Q4a | 墓碑 GC | 全做 | saveLayout 后清理 >24h 的墓碑 |
| Q4b | DSU dirty flag | 全做 | __dsuBuilt 布尔值 → __dsuDirty 脏标记，只在连线变动时重建 |
| Q4c | connection props | 全做 | 连线加 props:{} 字段，migrateLayout 补老数据 |
| Q4d | viewState 清理 | 全做 | 删盒子时 delete lb.viewState |

## 工业模板参照

| 模板 | 参照点 | 来源 |
|---|---|---|
| tldraw Store | put/remove 统一入口 + sideEffects 钩子 + computedCache 派生数据不持久化 | github.com/tldraw/tldraw Store.ts |
| tldraw BindingUtil | onBeforeDelete/onAfterChange 副作用回调，删 shape 自动删 binding | tldraw.dev/sdk-features/bindings |
| React Flow Edge | { id, source, target, data, props } 结构 | reactflow.dev/api-reference/types/edge |
| Excalidraw Delta | 软删除 isDeleted + delta.applyTo 差量应用 | github.com/excalidraw/excalidraw delta.ts |
| GDevelop SpatialHashGrid | 阈值 32，cell size = 2× 平均对象尺寸，复用网格 | github.com/4ian/GDevelop PR #8289 |
| CSS-Tricks vanilla Store | commit(mutationKey, payload) + Proxy 状态监控 | css-tricks.com/build-a-state-management-system |

---

## Phase 1：架构重构（高优先级，高风险）

### 1.1 停止持久化 layout.groups（Q1 方案二）

**目标**：layout.groups 从"既持久化又运行时计算"变成"纯运行时计算"，消除跨标签页合并冲突。

**当前问题**：
- layout.groups 被 ensureGroups() 重建（派生）
- 同时被 mergeConcurrentLayout mergeByIdUnion 合并（持久化）
- dsuRebuildFromConnections Block 1 (L1417-1430) 从 groups 恢复 box.isParent
- 6 个 mutation 路径各自 prune layout.groups
- 场景 3 测试失败：取消星标后跨标签页 isParent 死灰复燃

**实施步骤**：

1. **saveLayout 改造**：保存时从持久化对象中删除 groups 字段
   ```js
   // saveLayout 中，写入存储前
   const persisted = JSON.parse(JSON.stringify(layout));
   delete persisted.groups; // 不再持久化
   await layoutStorage.set({ boxingLayout: persisted });
   ```

2. **migrateLayout 加迁移标记**：加载时检查 __groupsMigrated 标记
   ```js
   function migrateLayout(raw) {
     // ...existing migration...
     if (!raw._meta?.__groupsMigrated) {
       // 一次性迁移：从旧 layout.groups 恢复 box.isParent
       if (Array.isArray(raw.groups)) {
         for (const g of raw.groups) {
           if (!g?.parentId) continue;
           if (g.parentId.startsWith('large:')) {
             const lb = raw.boxes?.find(b => b.id === g.parentId.slice(6));
             if (lb) lb.isParent = true;
           }
           // small box 同理
         }
       }
       raw._meta = raw._meta || {};
       raw._meta.__groupsMigrated = true;
     }
     return raw;
   }
   ```

3. **mergeConcurrentLayout 改造**：不再合并 groups
   ```js
   // 删除: groups: mergeByIdUnion(localValue.groups, remoteValue.groups, "parentId"),
   // groups 变成运行时 ensureGroups() 的返回值，不参与合并
   ```

4. **dsuRebuildFromConnections Block 1 (L1417-1430) 改造**：
   - 迁移完成后 layout.groups 不再存在（运行时 computed）
   - Block 1 从"读 layout.groups 恢复 isParent"改为"读 box.isParent 恢复 groupStar"
   - Block 2 (L1433-1439) 从"读 layout.groups union members"改为"纯从 connections 重建 DSU"

5. **所有 mutation 路径删除 layout.groups prune 代码**：
   - removeConnection L995-999
   - _execDeleteLargeBox L3439-3444
   - _execDeleteSmallBox L3556-3561
   - toggleStarMark (通过 ensureGroups 间接)

6. **ensureGroups 返回值**：变成纯运行时函数，返回 runtimeGroups，不写入 layout.groups
   ```js
   function ensureGroups() {
     dsuRebuildFromConnections();
     const gs = [];
     // ... 从 box.isParent + DSU 构建 ...
     runtimeGroups = gs; // 运行时变量，不写入 layout
     return gs;
   }
   ```

**风险**：
- 老用户升级：一次性迁移标记保护，__groupsMigrated=true 后不再读旧 groups
- 场景 2 测试（已有标签页继承星标）：依赖 Block 1 恢复 isParent → 迁移后 box.isParent 已是持久化事实来源，Block 1 改为读 box.isParent 直接恢复 groupStar
- 场景 3 测试（取消星标跨标签页清除）：不再合并 groups → 墓碑 + box.isParent=false 作为唯一事实 → 测试应通过

**验证**：
- 运行 boxing-star-sync-audit.spec.ts 3 个场景
- 新增测试：老数据迁移（groups 存在 → isParent 恢复 → groups 丢弃）
- 运行完整测试套件

### 1.2 统一 mutation API：commit(op) + 模块化 handlers（Q2 方案 A）

**目标**：6 个独立 mutation 函数收拢为一个 commit 入口，handler 只管数据修改，commit 统一负责清理。

**设计**（参照 tldraw Store.put/remove + sideEffects 模式）：

```js
// ── mutation handlers ─────────────────────────────────
const mutationHandlers = {
  addConn(state, { from, to }) {
    const id = 'conn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const conn = { id, from, to, props: {} };
    state.connections.push(conn);
    return { connId: id, affectedBoxKeys: [from, to] };
  },

  removeConn(state, { connId }) {
    const conn = state.connections.find(c => c.id === connId);
    state.connections = state.connections.filter(c => c.id !== connId);
    return { tombstoneIds: [connId], affectedBoxKeys: conn ? [conn.from, conn.to] : [] };
  },

  toggleStar(state, { parentId }) {
    const box = getBoxByKey(parentId);
    if (box.isParent) {
      box.isParent = false;
      return { tombstoneIds: [parentId], starChanged: true };
    } else {
      box.isParent = true;
      return { clearedTombstoneKeys: [parentId], starChanged: true };
    }
  },

  deleteLargeBox(state, { id }) {
    // ... mark children/bookmarks/conns for tombstone ...
    // ... filter arrays ...
    return { tombstoneIds: [...], viewStateClear: [id] };
  },

  deleteSmallBox(state, { largeId, smallId }) {
    // ... similar ...
    return { tombstoneIds: [...], viewStateClear: [smallId] };
  },

  applyExternal(state, { incoming }) {
    // merge + rebuild
    return { isExternal: true };
  }
};

// ── unified commit ────────────────────────────────────
function commit(op, payload) {
  const handler = mutationHandlers[op];
  if (!handler) throw new Error('Unknown mutation: ' + op);

  const result = handler(layout, payload);

  // 统一清理（参照 tldraw sideEffects）
  if (result.tombstoneIds) markDeleted(...result.tombstoneIds);
  if (result.clearedTombstoneKeys) result.clearedTombstoneKeys.forEach(k => {
    if (layout._meta?.deleted?.[k]) delete layout._meta.deleted[k];
    clearedTombstones.add(k);
  });

  // 清理运行时索引
  pruneConnIndices();

  // 重建 DSU（dirty flag 控制）
  __dsuDirty = true;
  ensureGroups(); // 内部检查 dirty flag

  // 清理 viewState
  if (result.viewStateClear) {
    for (const id of result.viewStateClear) {
      const lb = boxById.get(id);
      if (lb) delete lb.viewState;
    }
  }

  // 持久化 + 渲染
  if (!result.isExternal) saveLayoutDebounced();
  renderConnections();
}
```

**迁移策略**：
- addConnection/removeConnection/toggleStarMark/_execDeleteLargeBox/_execDeleteSmallBox 保留为薄包装，内部调 commit
- 调用方不需要改（API 兼容）
- 逐步将直接调用替换为 commit 调用

**模块化收益**：
- 以后加新功能（如连线加颜色）：在 mutationHandlers 加一个 case + 注册一个 sideEffect
- 不需要碰现有代码

**验证**：
- 全部 167 个现有测试通过
- 新增测试：commit 统一清理验证

### 1.3 boxById / smallBoxById Map（Q3a）

**目标**：Array.find O(n) → Map.get O(1)。

**实施**：
```js
const boxById = new Map();       // largeBoxId -> box object
const smallBoxById = new Map();  // smallKey -> small box object

function rebuildBoxMaps() {
  boxById.clear();
  smallBoxById.clear();
  for (const lb of layout.boxes) {
    boxById.set(lb.id, lb);
    for (const sb of (lb.children || [])) {
      smallBoxById.set(smallKey(lb.id, sb.id), sb);
    }
  }
}

function getLargeBox(id) {
  return boxById.get(id) || null;
}

function getSmallBox(largeId, smallId) {
  return smallBoxById.get(smallKey(largeId, smallId)) || null;
}
```

- 在 loadLayout / applyExternalLayout / renderCanvas 后调用 rebuildBoxMaps
- 在 addLargeBox / deleteLargeBox / addSmallBox / deleteSmallBox 后增量更新
- 38 个 getLargeBox 调用点 + 12 个 getSmallBox 调用点自动受益

**验证**：
- 现有测试全部通过（行为不变，只是查找方式变了）

---

## Phase 2：性能优化（中优先级，中风险）

### 2.1 elasticSnap 空间哈希网格（Q3b）

**目标**：O(50n²) → O(n) 均摊（n >= 32 时）。

**设计**（参照 GDevelop SpatialHashGrid + 0fps.net 空间哈希）：

```js
const SPATIAL_THRESHOLD = 32;  // GDevelop 基准：<32 暴力更快
let spatialGrid = null;
let spatialCellSize = 0;

function buildSpatialGrid(boxes) {
  if (boxes.length < SPATIAL_THRESHOLD) return null;
  // cell size = 2× 最大盒子尺寸（GDevelop 实践）
  let maxW = 0, maxH = 0;
  for (const b of boxes) { maxW = Math.max(maxW, b.w||LARGE_DEF_W); maxH = Math.max(maxH, b.h||LARGE_DEF_H); }
  spatialCellSize = Math.max(maxW, maxH) * 2;
  spatialGrid = new Map(); // cellKey -> Set<box>
  for (const b of boxes) {
    const x0 = Math.floor(b.x / spatialCellSize);
    const y0 = Math.floor(b.y / spatialCellSize);
    const x1 = Math.floor((b.x + (b.w||LARGE_DEF_W)) / spatialCellSize);
    const y1 = Math.floor((b.y + (b.h||LARGE_DEF_H)) / spatialCellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = cx * 100000 + cy;
        if (!spatialGrid.has(key)) spatialGrid.set(key, []);
        spatialGrid.get(key).push(b);
      }
    }
  }
  return spatialGrid;
}

function queryNearby(x, y, w, h) {
  if (!spatialGrid) return null; // 暴力模式
  const result = [];
  const x0 = Math.floor(x / spatialCellSize) - 1;
  const y0 = Math.floor(y / spatialCellSize) - 1;
  const x1 = Math.floor((x + w) / spatialCellSize) + 1;
  const y1 = Math.floor((y + h) / spatialCellSize) + 1;
  const seen = new Set();
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const bucket = spatialGrid.get(cx * 100000 + cy);
      if (!bucket) continue;
      for (const b of bucket) {
        if (!seen.has(b.id)) { seen.add(b.id); result.push(b); }
      }
    }
  }
  return result;
}
```

- elasticSnap 入口：if others.length >= 32, buildSpatialGrid(others)，queryNearby 替代 others.some
- moveGroupTogether：组内成员碰撞也用 queryNearby
- 门槛 32 以下走原始暴力路径（GDevelop 基准验证）

**验证**：
- 碰撞行为回归测试（盒子位置不变）
- 性能基准：30 盒子拖动帧率 vs 100 盒子拖动帧率

### 2.2 墓碑 GC（Q4a）

```js
// saveLayout 成功后
function gcTombstones() {
  if (!layout._meta?.deleted) return;
  const cutoff = Date.now() - 86400000; // 24h
  for (const [key, ts] of Object.entries(layout._meta.deleted)) {
    if (Number(ts) < cutoff) delete layout._meta.deleted[key];
  }
}
```

- 在 saveLayout 的 storageWriteChain.then 中调用
- 无行为变化，只减少持久化数据体积

### 2.3 DSU dirty flag（Q4b）

```js
let __dsuDirty = true;  // 替代 __dsuBuilt

function dsuRebuildFromConnections() {
  if (!__dsuDirty) return; // 干净的，跳过
  dsuReset();
  for (const c of layout.connections) { if (c.from && c.to) dsuUnion(c.from, c.to); }
  // ... Block 1-3 (改造后) ...
  __dsuDirty = false;
}

// 连线变动时
function addConnection(from, to) { ...; __dsuDirty = true; }
function removeConnection(connId) { ...; __dsuDirty = true; }

// getGroupByParent
function getGroupByParent(parentId) {
  if (__dsuDirty) dsuRebuildFromConnections();
  // ...
}
```

---

## Phase 3：模块化（低优先级，低风险）

### 3.1 connection 加 props 字段（Q4c）

```js
// addConnection 中
const conn = { id, from, to, props: {} };

// migrateLayout 中
for (const c of (raw.connections || [])) {
  if (!c.props) c.props = {};
}
```

### 3.2 viewState 清理（Q4d）

在 commit handler 的 deleteLargeBox / deleteSmallBox 中：
```js
// deleteLargeBox handler 返回
return { ..., viewStateClear: [id] };

// commit 统一处理
if (result.viewStateClear) {
  for (const id of result.viewStateClear) {
    const lb = boxById.get(id);
    if (lb) delete lb.viewState;
  }
}
```

### 3.3 key format 文档

已在 CONTEXT.md 中完成（large:L1, small:L1:S1 格式已文档化）。

---

## 实施顺序与依赖

```
Phase 1.3 (boxById Map)     ← 无依赖，可独立先做
    ↓
Phase 1.1 (groups 迁移)     ← 依赖 boxById (替代 find)
    ↓
Phase 1.2 (commit API)      ← 依赖 1.1 (groups 不再需要 prune)
    ↓
Phase 2.3 (DSU dirty flag)  ← 依赖 1.2 (commit 统一设 dirty)
Phase 2.2 (墓碑 GC)         ← 依赖 1.2 (commit 统一调 GC)
    ↓
Phase 2.1 (空间索引)        ← 依赖 boxById (网格引用 box 对象)
    ↓
Phase 3 (全部)              ← 依赖 Phase 1.2 (commit handler 中加 props/viewState 清理)
```

## 验收标准

| 阶段 | 验收项 | 验证方式 |
|---|---|---|
| Phase 1 | layout.groups 不出现在持久化数据中 | 存储快照检查 |
| Phase 1 | 老用户升级不丢星标 | 迁移测试 |
| Phase 1 | 场景 1/2/3 测试全通过 | boxing-star-sync-audit.spec.ts |
| Phase 1 | commit(op) 统一入口 | 源码检查：无直接 markDeleted/dsuRebuild 散落调用 |
| Phase 1 | boxById.get O(1) | 源码检查：getLargeBox/getSmallBox 用 Map |
| Phase 2 | 100 盒子拖动 >=30fps | Playwright 性能测试 |
| Phase 2 | 墓碑 <24h 自动清理 | 存储体积检查 |
| Phase 2 | DSU 不在 mousemove 中重建 | 性能 profile |
| Phase 3 | connection 有 props 字段 | 数据结构检查 |
| Phase 3 | 删盒子后 viewState 清理 | 内存检查 |
| 全部 | 167 个现有测试全通过 | npx playwright test --reporter=line |

## 风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| groups 迁移标记遗漏老用户 | 低 | 星标丢失 | migrateLayout 兜底 + 迁移测试 |
| commit API 行为变化 | 中 | 渲染/存储异常 | 薄包装兼容 + 全量测试 |
| 空间索引碰撞行为变化 | 中 | 盒子位置偏移 | 阈值 32 以下走原路径 + 回归测试 |
| boxById Map 失效 | 低 | 查找返回 null | rebuildBoxMaps 在所有加载点调用 |
| DSU dirty flag 漏设 | 中 | 组内成员不移动 | commit 统一设 dirty + 测试 |
