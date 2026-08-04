# BX-144 Bug 修复总结与规则固化

## Bug 描述

删除连接到父盒子 A 的子盒子 B 时，A 的父盒子星标状态丢失。

## 根因分析

### 触发路径
1. 用户 star A（设为父盒子）
2. 用户 unstar A（取消父盒子）— `toggleStarMark` unstar 路径调用 `markDeleted("large:A")`，写入墓碑
3. 用户重新 star A — star 路径 `delete layout._meta.deleted["large:A"]` 清理本地墓碑
4. 用户连接 A-B
5. 用户删除 B — `_execDeleteLargeBox(B)` 调用 `dsuRebuildFromConnections()`
6. A 的 isParent 被清除 → 星标丢失

### 真正的 bug 在哪里

`saveLayout()` 是异步的。在 step 3 star 路径清理了本地 `_meta.deleted` 后，`saveLayout()` 内部执行：

```js
const remote = stored.boxingLayout;  // 旧存储版本，含墓碑 {large:A: t}
layout = mergeConcurrentLayout(layout, remote);
```

`mergeConcurrentLayout` 中墓碑合并：
```js
const localDeleted = localValue._meta?.deleted || {};   // {} (已清理)
const remoteDeleted = remoteValue._meta?.deleted || {}; // {large:A: t}
const deleted = { ...remoteDeleted, ...localDeleted };  // {large:A: t} ← 墓碑复活！
```

**JS 对象 spread 无法区分"local 显式清理了 key"和"local 从未有该 key"** — 两种情况下 `localDeleted[key]` 都是 undefined，spread 结果都从 remote 继承。

墓碑复活后，下次 `dsuRebuildFromConnections` L1434-1438 检测到墓碑：
```js
if (b.isParent && __tdel[largeKey(b.id)]) b.isParent = false;
```
→ A 的 isParent 被清除 → 星标丢失。

## 修复方法

引入 in-memory `clearedTombstones` Set（per-tab，不持久化，不跨 tab 传播）：

1. `toggleStarMark` star 路径：`clearedTombstones.add(parentId)` + `delete layout._meta.deleted[parentId]`
2. `mergeConcurrentLayout`：当 `localValue === layout`（saveLayout 自己的合并路径）时，用 `clearedTombstones` 过滤掉 remote 复活的墓碑
3. 不写入 `_meta`，不持久化，不跨 tab 传播 — 纯 per-tab 内存状态

## 原则

### P1: 墓碑语义不可复用
墓碑是为"物理删除"设计的（删除盒子/连线/书签），不是为"逻辑状态翻转"设计的。把 `markDeleted(parentId)` 用在 unstar 路径是语义混淆 — unstar 不是删除，是状态翻转。

### P2: JS spread 无法表达"显式删除"
`{...a, ...b}` 只能做并集覆盖，不能表达"b 显式删除了某个 key"。需要独立的 ledger（Set/Map）来记录显式清理动作。

### P3: per-tab 决策状态不可跨 tab 传播
"本 tab 决定清除某个墓碑"是本 tab 的决策，不是全局事实。如果跨 tab 传播（写入 _meta、持久化到 storage），其他 tab 的旧墓碑会通过合并复活。per-tab 状态必须留在内存中。

## 教训

1. **不要把删除语义复用到状态翻转** — unstar ≠ delete。如果 unstar 需要阻止跨 tab 复活，应使用专门的状态翻转机制，而不是墓碑。
2. **异步合并中的 spread 有盲区** — 任何"显式清理"操作都需要独立的 ledger，不能依赖 spread 合并的覆盖语义。
3. **测试必须覆盖 star-unstar-star 循环** — 单次 star → delete child 不会触发 bug，必须经过 unstar → star 循环让墓碑写入存储后再清理才会暴露。
4. **per-tab 状态与持久化状态的边界** — `groupStar`（Set）、`clearedTombstones`（Set）是 per-tab 内存状态；`layout.boxes`、`layout.connections`、`layout.groups`、`layout._meta.deleted` 是持久化状态。不可混淆。

## 固化规则

### R1: 墓碑仅用于物理删除
`markDeleted()` 只能用于删除盒子/连线/书签/组。不得用于状态翻转（star/unstar、expand/collapse、pin/unpin）。

### R2: 状态翻转用字段值，不用墓碑
star/unstar 通过 `box.isParent = true/false` + `groupStar.add/delete` 表达。跨 tab 同步依赖 `mergeById` 的 local-wins 语义（local 最新写入胜出）。

### R3: 显式清理需要 ledger
任何"清理 _meta.deleted 中的 key"的操作，必须在 in-memory Set 中记录，用于 `mergeConcurrentLayout` 过滤 remote 复活的墓碑。该 Set 不持久化、不跨 tab 传播。

### R4: per-tab 状态边界
- `groupStar`（Set）：per-tab，从 `box.isParent` 重建
- `clearedTombstones`（Set）：per-tab，不持久化
- `boxGroupId`（Map）：per-tab，DSU 内部状态
- `groupMembers`（Map）：per-tab，DSU 内部状态
- `layout._meta.deleted`（Object）：持久化，跨 tab 合并
- `layout.boxes/connections/groups`（Array）：持久化，跨 tab 合并
