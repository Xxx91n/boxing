# Spec — 架构恢复二期 (2026-09): render.js 深度化 + 治理补强

依据: .scratch/brain-round2-ticket-proposals.md (brain 窗口调研裁决); 联网证据: ctx source=atomcode-arch-maturity。

## Problem Statement

一期把 6055 行 ntp.js 拆成入口 + 11 模块后, 剩余三个治理缺口: (1) render.js 2774 行内部仍有业界公认的未拆边界; (2) quarantine 车道缺修复时限与 CI 日常巡查; (3) ADR 模板缺 Consequences/复核小节。不解决, render.js 继续积累规则记忆税, 隔离测试无人认领, ADR 决策无后果记录。

## Solution

按业界先例 (excalidraw PR#9285 / tldraw 分层 / minware quarantine 30 天规则 / MADR 4.0) 做三组补强: render.js 三条不变量切口二期拆分; quarantine 车道治理; ADR Consequences 补强。零构建、纯 ESM、不引新依赖。

## User Stories

1. 作为维护者, 我希望几何/索引纯函数集中在 utils 层, 以便单测无需 DOM 环境。
2. 作为维护者, 我希望 conn 图层 (线池+视口剔除+LOD+网格哈希) 整体在独立模块, 以便性能不变量 (ADR-0004/0013) 有单一落点。
3. 作为维护者, 我希望弹窗/书签行 DOM 构件与画布变换代码分离, 以便改弹窗不碰渲染不变量。
4. 作为维护者, 我希望每个被隔离测试挂 ticket 号与退役时限, 以便隔离区不变成无底洞。
5. 作为维护者, 我希望 CI 每日巡查 quarantine 车道, 以便 flaky 回归被发现。
6. 作为维护者, 我希望新 ADR 记录后果与复核日期, 以便未来评审有据。
7. 作为维护者, 我希望画布变换不变量与 DOM 事件绑定保持共处 (业界共识), 以免为拆而拆制造隐性耦合。

## Implementation Decisions

- 拆分边界只走三条切口: 纯几何/索引下沉 utils.js; conn 图层整组 (含渲染调度状态) 入新模块; 弹窗/书签行 DOM 构件入新模块。按行数拆分被否决 (Charemza moving-part / paulrberg LOC-is-discovery)。
- conn 图层拆分必须连同渲染调度状态整体搬迁, 禁止状态跨模块共享。
- 拆分沿用一期模式: verbatim 搬移 + facade 注入 + 十层自验脚本 (WORKFLOW §6), 禁手写差异。
- quarantine 治理不引新框架: 只在既有 @quarantine 标签上加 ticket 引用 + README 登记时限; CI job 用独立 quarantine config。
- ADR 治理为一次性文档更新, 无代码。
- 依赖方向: utils 被所有层引用; popups 不被 render 核心依赖; 不加 lint 规则 (YAGNI)。

## Testing Decisions

- 好测试标准: 只测外部可观察行为, 不测内部函数名。
- 几何下沉不新增单测框架 (YAGNI; 现有 Playwright seam 已够)。
- conn 票验收含手测点: 拖拽/缩放/pan + culling 目视 + boxing-zoom/conn 系 spec 绿。
- quarantine 票验收: 车道独立可跑 + 每 tag 有引用; CI job 或记录为手验项。
- 先验模式沿 WORKFLOW §4.1: npm test 全绿 + 拆分类票 build 绿 + dist 契约不变。

## Out of Scope

按行数的任意再拆分; DI 库/构建工具; sync outbox / revision vector; undo (ADR-0018); LWW 替换; 差异化叙事/发布管道 (产品侧)。

## Further Notes

渲染调度与 conn 图层同迁为已裁决项; 一期 backlog 8 条与本 spec 互不阻塞, 由用户另行圈点。
