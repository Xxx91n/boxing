# 09 — fix(create): 双击新建大盒子先渲染后落盘

> 版本: 2026.9.12 · 优先级: P0 · 分支建议: `09-create-render-decouple`
> 状态: ready-for-agent

## Problem

大盒子画布双击新建间歇性「无反馈」，之后进入小盒子再返回时冒出多枚新建大盒子。
用户日志路径不存在；源码时序已足够立案。

## Root cause

`ntp/render.js` `addLargeBoxAt` / `addLargeBox`（工具栏）:

```
layout.boxes.push(newBox);
boxById.set(...);
await saveLayout();   // 串行 storage 写链 —— UI 被 I/O 卡住
renderCanvas();
```

数据已变更但 DOM 不刷新；写链排队/慢时用户连续双击会堆出多枚不可见盒子，直到下一次全量 `renderCanvas`（enter/exit/external）。

## Fix (ponytail)

1. push + `boxById.set` 后 **立即** `renderCanvas()` + focus sink（保持 BX-DEV-140d）。
2. 用 `saveLayoutDebounced()` 落盘（与拖拽同模型；SEC-08 允许 create 类 critical 用 direct，但 **不得** 用 direct 阻塞渲染）。若必须保证崩溃前落盘，可 `void saveLayout()`  fire-and-forget，但仍不得 `await` 在 render 之前。
3. 同步改 `addSmallBoxAt`（`render.js` ~L1570）——同病。
4. 保留 `isWithinCreateCooldown` / `markCreate`（BX-DEV-112D）语义不变。
5. **不要** 改写 `saveLayout` 写链本体或 `applyExternalLayout`。

## Acceptance

- [ ] `addLargeBoxAt` / `addLargeBox` / `addSmallBoxAt` 均为 mutate → render → save（无 `await saveLayout` 挡在 render 前）。
- [ ] 新建后同 tick 内 `canvasSurface` / inner surface children 增加。
- [ ] 连续双击不同位置：可见反馈与数据一致，无「静默堆积」。
- [ ] Playwright: 扩展上下文双击空白画布 → `.large-box` 计数 +1；再双击 +1。可挂 `boxing-empty-state-buttons.spec.ts` 或新 `boxing-create-render.spec.ts`。
- [ ] `node --check ntp/render.js` 绿。
- [ ] 不回归 focus-steal（`boxing-focus-steal.spec.ts`）与 cooldown（工具栏连点）。

## Out of scope

- 写链/merge/sync 算法
- 日志系统
- 冷却参数调优
