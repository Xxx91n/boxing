# Report — 09 双击新建先渲染后落盘

- 日期: 2026-09-10
- 票面: issues/09-create-render-decouple.md · handoff: handoffs/09-create-render-decouple.md · 调查: 43-2026-09-12-wave4-investigation.md P1
- 版本控制: 遵循 WORKFLOW §4.2（本票改动已在独立票分支落为提交；不推送、不开 PR）。

## 声明 → 证据 → 结论

- 声明（P1）: 双击新建大盒子间歇失效，之后"冒出一堆"。
- 证据: ntp/render.js 中 addLargeBoxAt / addLargeBox 在 `layout.boxes.push(newBox)` 之后、
  `renderCanvas()` 之前调用 `await saveLayout()`；saveLayout 本体（storage.js，未改）将写入
  排入串行的 storageWriteChain 并 await 整条链。链上任一在途慢写（配额、跨标签合并、
  fallback 快照）都会把"本次点击的新盒子 DOM"压在链尾；而 push 已同步完成，后续双击照常
  mutate + 被 cooldown 之外的新位置放行，于是反馈丢失、堆积、最后一次性刷出。
- 结论: 根因即「await 落盘挡在渲染前」。修复 = mutate → 同步 render → fire-and-forget 落盘。

## 改动

1. ntp/render.js · addLargeBoxAt: 删除 `await saveLayout()`；`renderCanvas()` + BX-DEV-140d
   focus sink 之后 `void saveLayout()`（fire-and-forget，写入仍走同一串行链，链本体未动）。
2. ntp/render.js · addLargeBox: 同上。
3. ntp/render.js · addSmallBoxAt: 原为 `saveLayout(); renderInnerSurface(lb);`（未 await 但
   排在渲染前），调整为 `renderInnerSurface(lb); void saveLayout();` 对齐 delta 的时序表述。
4. 新增 test/tests/boxing-create-render-decouple.spec.ts（3 个用例，见下）。
5. 本报告。

未做: 不改 ntp/storage.js；不动 addSmallBox（工具栏连点路径，本就不 await，不在三入口范围）；
  不引入 saveLayoutDebounced（其 120ms 定时器无 unload flush，创建属关键数据路径，选择
  fire-and-forget saveLayout —— AC 明确允许两选项中的后者；写链内部本就串行排队，不会并发互踩）。

## 测试

新 spec: boxing-create-render-decouple.spec.ts
- 用例1（AC5+AC3）: 空白双击 → `.large-box` 计数 +1；不同位置再双击 → 再 +1；DOM 计数与
  `__boxingDebug.layout.boxes.length` 一致；随后 expect.poll 验证 fire-and-forget 落盘最终
  抵达（file:// mock 车道经 localStorage 的 boxingLayout 键观测）。
- 用例2（AC4）: 同一任务内连发两个同坐标 dblclick（必落入 350ms/12px cooldown 窗口）→
  仅 1 个盒子，cooldown/markCreate 抑制不回归。
- 用例3（AC1+AC2）: 源码契约——render.js 全文不再含 `await saveLayout`；三个创建入口体内
  render 调用先于 `void saveLayout();`（挂靠 boxing-v3.spec.ts:52 的源码契约先例）。
- 车道说明: 与 data-recovery/boxing-v3 同惯例，box 创建双击用合成事件（native dblclick 在
  firefox 持久上下文停摆，playwright#16095 类，票 27 结论）。

本机验证（按 2026-09-04 CI-only 构建政策，测试运行留 CI）:
- `node --check ntp/render.js` 与 `node --check ntp/ntp.js` 绿（票面 AC6 的语法项）。
- 行尾检查干净（LF，无 BOM）。
- codegraph sync: 增量索引已跑（报 Already up to date）。

## 验收对照

| AC | 状态 | 证据 |
|---|---|---|
| 创建入口 mutate 后立即 render，无 await 挡在 render 前 | code-done | 改动1-3；用例3 源码契约 |
| fire-and-forget 落盘；写链本体未改 | code-done | storage.js 零 diff；void saveLayout |
| 连续双击不同位置：可见反馈与 layout.boxes 一致 | code-done CI-open | 用例1 |
| cooldown / markCreate / focus sink 不回归 | code-done CI-open | 用例2 + focus sink 语句原样保留 |
| Playwright 扩展上下文双击 +1 / +1 | CI-open | 用例1/2 待 CI run 作证 |
| node --check 绿；focus-steal/工具栏连点不回归 | node --check 绿；回归项 CI-open | 用例2 + 既有 boxing-focus-steal.spec.ts |

## 残留风险

- fire-and-forget 后，创建即秒关标签页的窗口内，链排队理论上可能来不及落 storage.local；
  与修复前相比 await 也只保证"入链完成"而非落盘原子性（链体 await 的是自己那一格，关标签
  仍可能被截），实际风险面基本不变，且 loadLayout/onChanged 合并链会带上 revision。如 CI 或
  用户实测出现创建丢失，再评估 unload flush。
- addSmallBox（工具栏小盒路径）仍是 save-then-render 的旧顺序（未 await，行为等价），
  未列入本票三入口，留作后续顺手统一。
- 用例2 依赖同任务连发保证 cooldown 命中；若未来 dblclick 处理器改异步派发需复核。

## 教训（供 §6 回收登记）

- 乐观更新的最小正确形态: mutate 与 render 之间不得存在任何 await；持久化只入链不等待，
  串行写链本身即可保证最终一致——"先渲染后落盘"不需要新机制，只需删掉一个 await。
- file:// mock 车道的 storage.set 是同步实现，"门控存储写以证明渲染先行"的 sharp 断言在
  该车道不成立；用源码契约 + 同任务连发的行为断言替代，成本更低且跨车道确定。

