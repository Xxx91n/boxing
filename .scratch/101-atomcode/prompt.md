# 调研任务：e2e 测试中「引导/全屏遮罩 fire-and-forget 关闭」竞态的工业治理与共享 helper 设计

## 背景（已发生事实，不要重复推导）

- Chrome MV3 + Firefox 浏览器扩展，新标签页（NTP）为原生 ES module（无框架、无打包）。
- 首次运行显示引导遮罩 #onboarding-overlay，它带 .modal-overlay：position:fixed; inset:0; z-index:100; aria-modal=true，非 inert，会赢得命中测试（hit test），拦截真实指针输入（page.hover / page.click）。
- 页面 init() 在末尾（initOnboarding）才决定是否显示该遮罩；init() 被一个在 file:// 车道必然失败的 i18n fetch 拖慢；loadLayout() 在 init() 内会覆盖 layout.settings，把 onboardingCompleted 还原。
- 约 10+ 个 Playwright spec 在各自 resetBoxing/skipOnboarding 里用 fire-and-forget 方式关闭遮罩：page.evaluate(() => { try { window.__boxingDebug?.skipOnboarding?.(); } catch(_){} }) —— ①不等 init() 收口 ②不等遮罩确实 hidden ③无后置断言。结果：遮罩在 init() 后重显，拦截后续 hover/click，表现为 expect.poll 超时（如 Expected rgba(196,168,130,0.12) / Received rgba(0,0,0,0)）。
- 另一类同源反模式：fill 后固定 sleep 200ms 即读 DOM 类名（search spec）。
- 仓库已有单点硬化范例（仅 1 个 spec）：waitForInitComplete（用 ?debug=1 + 轮询 log ring 里的 init complete 标记）+ 幂等 dismissOnboarding（expect.poll 里反复调用直到 overlay.hidden===true）+ elementFromPoint 命中断言 + goto domcontentloaded。
- 目标：抽公共 helper（test/helpers/onboarding.ts）统一治理全部调用点；helper 内禁用任意 delay，须用事件/条件等待；验收 = 全部调用点替换 + 每处本地 --repeat >= 20 次 + 连续 2 个全量 CI run 无同签名复发。

## 需要你回答（每问给「推荐 + 理由 + 可核验来源」）

1. 工业界对「e2e 中首运引导/全屏 modal 遮罩拦截真实指针输入」导致 flaky 的成熟治理模式是什么？请对比至少 3 种真实做法：Playwright 官方 page.addLocatorHandler、显式三段式（等 app init 完成 -> 幂等关闭 -> 断言确实 hidden）、预置已完成引导的 storage（storageState / fixture / addInitScript 种 storage）绕过引导、以及 force:true 绕过 actionability 的取舍。逐项给出失败模式矩阵（含各自失效场景）与推荐模式。

2. 把该治理抽成共享 test helper 的工业做法：契约如何设计（幂等、无任意 delay、以条件/事件等待代替 sleep、失败即具名报错）；放置位置与 Playwright 的依赖注入方式（自定义 fixture vs 纯函数）；如何保证 helper 自身不引入新 flaky、且被所有调用点一致使用。

3. 如何为「deflake 完成」给出可审计证据？工业上对 flaky 的量化判据（repeat 次数与置信度、CI 连续绿灯数、signature 比对），如何区分「真修好」与「碰巧没复现」；以及「修绿」相对「稳定 skip + 立票」的取舍边界（何时 skip 才是合法出口）。

4. 固定等待（fixed sleep，如 200ms 后读 DOM）在工业界的替代方案有哪些（自动重试断言 expect.poll/toPass、事件驱动、locator 自动等待、deterministic clock），各自的适用边界与反例。

## 输出要求

- 中文；按 4 问分节，每节先结论后论证；给出来源（实现/文档名 + 发布方 + 年份/URL 或可定位出处）。
- 无法核验的写成「信息缺口」，不得编造。
- 最后给「对本仓库的具体建议」一节：① helper 的推荐接口签名与实现要点；② 调用点替换的推荐做法（含需要保留 force:true 的例外）；③ deflake 验收证据链的推荐形态。
