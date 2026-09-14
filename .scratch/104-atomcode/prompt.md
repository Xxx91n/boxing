# 调研任务：阻塞式 boot 脚本「遮罩永不解除」故障的工业防护与测试策略

## 背景（已发生事实，不要重复推导）

- Chrome MV3 + Firefox 浏览器扩展，新标签页（NTP）为原生 ES module（无框架、无打包）。
- 首帧防闪烁：head 内经典阻塞脚本 boot-theme.js（非 module、零 import、零 chrome./browser. API）同步执行，在首帧前给 html 加 boot-pending 类遮蔽画布内容，并套用已持久化的主题变量（paint-critical 镜像 boxingBootTheme.v1，读 localStorage，同步可读）。
- 解除遮蔽：render.js 在 renderCanvas / _enterLargeBox 完成时移除 boot-pending。
- 兜底：boot-theme.js 末尾注册 setTimeout 4000ms 移除 boot-pending，若 init 崩溃未渲染则强制解除遮蔽。
- 缺陷：镜像缺失（全新 profile）或镜像非法时脚本走 early return，跳过 failsafe 注册 —— 若 init 随后崩溃，内容永久遮蔽（永久空白）。

## 需要你回答（每问给「推荐 + 理由 + 可核验来源」）

1. 工业界对「阻塞式 boot 脚本 / 无闪烁主题引导」中「遮罩永不解除（permanent blank）」这类故障的成熟防护模式是什么？请对比至少 3 种真实实现（候选：next-themes 的内联阻塞脚本、Tailwind dark-mode 内联脚本、Astro/Remix/Gatsby 的 FOUC 防护、Vercel/Shopify 主题引导、纯 CSS 方案 color-scheme + @media prefers-color-scheme 或 hidden 属性/scrollbar-gutter）。逐项说明它如何保证「即使后续 JS 失败也不会永久遮挡」，给出失败模式矩阵与推荐模式。

2. failsafe 的触发条件与时长如何选型？对比：固定 4s 定时器、与首帧/load 事件竞速、MutationObserver 看门狗、纯 CSS 兜底（如 @keyframes 动画在 N 秒后恢复 visibility 且 JS 无需参与）、以及 MV3 扩展 NTP 生命周期约束（service worker 可能不在场、页面可能被 discard/restore）。指出每种方案的失效场景（含 JS 主线程被长任务阻塞导致 setTimeout 延迟）。

3. 如何为该 failsafe 写确定性 Playwright 测试？工业上如何避免「真实等待 4 秒」造成的慢与抖动（如 fake timers / 时钟注入 / 缩短常量 / 事件竞速断言）？如何断言「早退路径确实已武装 failsafe」而非「碰巧没被遮蔽」？给出可落地的断言策略与反例（mutant）测试法。

## 输出要求

- 中文；按 3 问分节，每节先结论后论证；给出来源（实现名 + 发布方 + 年份/URL 或可定位出处）。
- 无法核验的写成「信息缺口」，不得编造。
- 最后给「对本仓库的具体建议」一节：① failsafe 注册位置的最优改法；② 测试策略推荐；③ 是否值得引入 CSS 兜底。
