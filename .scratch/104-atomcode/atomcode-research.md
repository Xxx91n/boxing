# 104 atomcode 调研输出（原始，未删改）

> 载体: `atomcode --prompt-file .scratch/104-atomcode/prompt.md --no-telemetry --dev`（headless）
> 会话: 2026-09-14 · 时长 11m34s · exit 0 · resume id `3e264b8d-66aa-4265-a5d4-d38ed297f8c0`
> 处理: 仅移除 atomcode 自身启动横幅 2 行（`[dev] auto-update disabled` / 管理员权限 warning），其余字节原样保留。
> 提示词原文: `./prompt.md`

---
我将按「research」技能驱动本次调研（该技能要求产出仓库 Markdown 文件，但本会话为只读模式，因此调研结论改为在对话内完整输出）。先加载技能，再按配额执行。**Sufficiency 预登记**：模式 = default；计划角度 = Official（next-themes/Tailwind/Astro/Playwright 官方文档与源码）+ Comparative（多实现对比）+ Criticism（已知失败模式/issue）+ Community（HN/Stack Overflow）+ Currency（2026 现状）；配额：≥4 搜索查询、≥6 次原文抓取、≥3 域名、三引擎交叉。

第一步：召回知识库 + 本地 boot 脚本现状分析 + 第一波三引擎搜索（并行）。沙箱运行时缺失，本地改用 read_file 直读；继续第二波搜索（CSS 兜底、Astro/纯 CSS 方案、Playwright 时钟细节）。现在并行：读本地 boot-theme.js + 抓取关键原文（Playwright clock 文档、next-themes 脚本源码、Tailwind 讨论、Astro 主题文档）。继续：补 CSS 兜底模式、Remix/Astro 官方实现、Playwright addInitScript 文档的原文核验。配额接近达成，补最后一轮：CSS 兜底模式原文 + Criticism 角度（loading 遮罩卡死的社区案例）。**Sufficiency Gate 自查**：searches: 9（Exa web_search ×4，Tavily ×4，AnySearch ×1）| angles: Official / Comparative / Criticism / Community / Currency 全覆盖 | full reads: 6（playwright.dev/clock、playwright.dev addInitScript、next-themes script.ts 原文、tailwindcss discussion #3904 原文、astro-tips.dev dark-mode 原文、0xda.de no-js 模式原文）| gaps: remix-themes、HN/mutant/Plaid 为摘要级证据（已在文中标注）；本地源码已直读 `ntp/boot-theme.js` 全文。

三引擎均命中一致结论，无需补搜。以下为最终报告。

---

# 调研报告：阻塞式 boot 脚本「遮罩永不解除」的工业防护与测试策略

## 执行摘要（Tl;dr）

**Confidence：高**（核心结论均有官方文档或源码原文支撑）。

1. 工业界对「无闪烁主题引导」的主流实现（next-themes、Tailwind/Astro 社区模式、remix-themes）**全部采用「只装饰、不遮蔽」结构**——阻塞脚本只做加法（加 class / 设属性），从不把内容藏在 JS 后面；因此它们**在构造上不存在永久空白故障**，也就不依赖 failsafe。真正采用「遮蔽-解除」模式的（body.hidden 提案）在社区讨论中即被实测否决（闪白 + 永久隐藏风险）。Boxing 的 boot-pending 是少数派，**必须**靠「failsafe 武装先于一切早退 + 纯 CSS 定时兜底」双保险。
2. failsafe 选型推荐：**JS setTimeout（已前移，当前代码已是 ticket 104 修复后形态）+ 纯 CSS `animation-delay + forwards` 定时解除**作为语言无关的第二道兜底；CSS 兜底值得引入，成本低、免疫「init 崩溃」这一唯一致命场景。
3. 测试用 **Playwright page.clock（install → fastForward）** 做确定性时间推进，用「**差分断言**」（不快进时遮罩仍在 → 快进后遮罩消失）证明「failsafe 已武装」而非「碰巧没被遮蔽」，并用**手工 mutant**（删注册/后移注册/改时长）验证测试的杀伤力。

---

## 第 1 问：「遮罩永不解除」的工业防护模式对比

### 结论

工业界几乎不用「遮蔽-解除」结构做主题引导。成熟模式按防护强度排序：

**模式 A：装饰式阻塞脚本（decorate-only）—— next-themes（Paco Coursey，2020 至今）**
已读源码 `next-themes/src/script.ts`（github.com/pacocoursey/next-themes，commit a7eeabc3）：内联阻塞脚本在首帧前对 `document.documentElement` **只执行 add/setAttribute**，从不隐藏任何内容。关键结构保证：整段逻辑包在 `try { localStorage.getItem(...) ... } catch (e) {}` 里，镜像缺失/非法时 fall through 到 defaultTheme——**最坏结果是「默认主题短暂闪现」，不存在「内容被藏住」这个状态变量**。失败模式矩阵里它是唯一「无该故障类别」的实现。

**模式 B：装饰式 + CSS 媒体查询兜底 —— Astro 社区模式（astro-tips.dev Dark Mode recipe，Astro ^5.0）**
已读原文：`<script is:inline>` IIFE 在 head 里设 `data-theme` + `color-scheme`；同时全局 CSS 用 `:root[data-theme="dark"]` **和** `@media (prefers-color-scheme: dark)` 双通道定义变量——**JS 完全不跑时，系统主题由纯 CSS 接管**。防护逻辑与 next-themes 同构（只加 class），再叠加一层「JS 失败退化为系统主题」的声明式兜底。

**模式 C：SSR/服务端预注入 + 客户端条件补丁 —— remix-themes（sergiodxa，2021 至今）**
服务端把主题直接写进 `<html data-theme>`（首帧即正确）；`PreventFlashOnWrongTheme` 仅在服务端无主题时注入客户端补丁脚本，并渲染 `<meta name="color-scheme">`。最坏情况（客户端 JS 全挂且服务端无主题）= 系统默认主题，非空白。本仓库无 SSR，此模式不可直接复用，但其「color-scheme meta」技巧可移植。

**模式 D：纯 CSS 方案 —— color-scheme meta + prefers-color-scheme（Tailwind discussion #3904，lukewarlow 2023 回帖）**
`<meta name="color-scheme" content="dark light">` 让浏览器**首帧前的空白底色**就匹配主题（消除 pre-paint 白闪），`@media` 变量切换零 JS。只能处理「系统主题」，不能处理「用户显式选择的主题」。

**模式 E：遮蔽-解除 + failsafe —— Boxing 现行模式（社区曾有提案，被实测否决）**
tailwindcss discussion #3904（已读原文，2021）：richardtallent 提议 `<body class="hidden">` 再解除——**提问者实测反馈「隐藏再解除仍然闪白」（默认背景是白的），且这正是永久遮蔽风险的来源**；该讨论最终采纳的是 Nick-Mazuk 的装饰式方案（localStorage + head 内联脚本，不隐藏任何东西）。这条讨论是「遮蔽式为何非主流」的一手社区证据。

### 失败模式矩阵

| 模式 | 镜像缺失 | 镜像非法/parse 抛异常 | 后续 init JS 崩溃 | 主线程长任务 | 禁 JS | 永久空白可能 |
|---|---|---|---|---|---|---|
| A next-themes 装饰式 | 默认主题 | 默认主题（try/catch 吞掉） | 默认主题（类已加，内容本就可见） | 最坏闪默认主题 | 系统主题 | **否（构造上无遮蔽态）** |
| B Astro 装饰式+CSS | defaultTheme | defaultTheme | 已加的 class 生效，内容可见 | 最坏闪默认 | `@media` 接管 | **否** |
| C remix-themes | 服务端/系统主题 | 同上 | data-theme 已在 HTML | 最坏闪 | 系统主题 | **否** |
| D 纯 CSS | 系统主题 | 系统主题 | 不依赖 JS | 不依赖 JS | ✓ | **否（但不支持显式用户主题）** |
| E 遮蔽式（Boxing） | 需 failsafe 武装 | 需 failsafe | **唯一致命场景：主线程空闲但 render 永不执行** | setTimeout 同样被延迟 | 需 CSS 兜底 | **是，除非双保险** |

### 推荐模式

Boxing 有 A/D 满足不了的正当需求（用户显式主题包 + `chrome.storage` 异步 vs localStorage 同步的首帧镜像，即 FART/CSS-Tricks blocking-boot 模式），**保留模式 E 是合理的，但必须按 A/B 的教训改造**：遮蔽态的存在本身就是负债，所以（a）failsafe 武装必须先于一切早退路径——**当前 `ntp/boot-theme.js`（ticket 104 / B68）已做到**：第 26 行加 mask，第 32 行注册 setTimeout，第 33 行才进 try/早退，文件头注释明确记录了修复动机；（b）叠加纯 CSS 定时兜底（见第 2 问），使「JS 彻底不跑/脚本文件 404/CSP 拦截」也有语言无关的解除通道。

---

## 第 2 问：failsafe 触发条件与时长选型

### 结论

推荐：**保留固定 4s setTimeout（位置已正确），叠加纯 CSS animation 兜底，时长取 3s < 4s**（CSS 层略早于 JS 层，作为更快的最后防线；亦可同值，见下论证）。不推荐 MutationObserver 看门狗；load 事件竞速只可作辅助信号。

### 各方案失效场景分析

**① 固定 4s 定时器（现行）**
- 失效场景 1：主线程被长任务阻塞 —— setTimeout 回调按 HTML 规范排队到任务队列，4s 定时器可能 6s、10s 才触发（渲染进程活着且卡死时）。**但注意：这种场景下 render 也被卡住，用户看到的是「延迟解除」而非「永不解除」，且解除后 render 若仍活着会继续画**。
- 失效场景 2：定时器注册代码本身未执行（脚本 404 / CSP script-src 拦截 / `documentElement` 引用前抛异常）—— 这是纯 JS 方案的盲区，只有 CSS 兜底能覆盖。
- 失效场景 3：定时器被节流 —— Chrome 对**隐藏页**有 timer 节流（后台标签最小 1 次/分钟）；NTP 打开时通常在前台，风险低，但 discard 后 restore 的标签若以隐藏态恢复，4s 可能被拉长。**MV3 生命周期利好**：tab discard/restore 会重建整个 NTP 文档，boot 脚本重跑、failsafe 重新武装，无需处理跨 discard 的定时器存续；service worker 不在场也不影响（boot 脚本零 chrome.* API，已满足）。
- 失效场景 4：双重解除竞态（render 先解、4s 后又 remove 一次）—— `classList.remove` 幂等，无害；但若 render 之后用户在 4s 内做了依赖「无 boot-pending」的 transition，二次 remove 仍幂等，安全。

**② 与首帧/load 事件竞速**
- 思路：failsafe 挂在 `window.addEventListener('load', …, {once:true})` + 定时器中先到者。
- 失效场景：**load 永不触发**——任一子资源（字体、favicon、WebDAV 预检）挂起即卡死；NTP 的 favicon 请求外部 https: 域（CSP `img-src https:`），弱网/被墙时 load 可延迟 30s+。load 只能当「提前解除」的加速器，**不能当 failsafe 的触发条件**。首帧信号更不可靠：boot 脚本执行时 `requestAnimationFrame` 可用，但「首帧已画」恰是 render 成功的后果，用它解除与 render 自己解除重复，对故障场景无增益。

**③ MutationObserver 看门狗**
- 思路：观察 `<html>` 的 class 变化，若 N 秒内未看到 boot-pending 移除则强制移除。
- 判定：**与 setTimeout 等价但更重**——观察者回调同样走微任务/任务队列，长任务下同样延迟；它多出来的价值只有「区分『render 移除』与『failsafe 移除』」，而这个区分在测试里用 Playwright clock + 差分断言就能拿到，不值得在生产代码里加一个 observer 实例。**不推荐**。

**④ 纯 CSS 兜底（推荐引入）**
```css
html.boot-pending {
  visibility: hidden; /* 现行遮蔽声明所在规则 */
  animation: boot-unmask 0s linear 3s forwards;
}
@keyframes boot-unmask { to { visibility: visible; } }
```
- 机制：`visibility` 可参与动画（离散插值），`animation-delay: 3s` + `fill-mode: forwards` 使「类存在 3 秒后强制可见」成为**纯声明式行为**；JS 提前移除类则动画随之取消，两道机制天然互斥。
- 它覆盖的正是 JS 定时器的盲区：boot-theme.js 文件 404、CSP 拦截、脚本顶层抛异常、init 崩溃后主线程空闲（CSS 动画时间线独立于 JS 任务队列）。诚实声明局限：若主线程被**活的长任务**占死，动画结束后的样式落地也要等主线程空出一次——但这与方案①的失效场景重叠，不新增弱点；且该场景下主线程是「忙」不是「死」，忙完必画。
- 双保险时长关系：CSS 3s 略早于 JS 4s，保证「JS 定时器也失效」时仍有解除；JS 定时器保留是因为它能在 render 死但 CSS 未生效的边缘（如 `visibility` 动画被未来重构误删）时兜底，且便于测试注入。
- 来源支撑：该模式与 Tailwind discussion #3904 中 meta color-scheme「让默认态本身正确」的思路同源（把兜底下沉到声明层）；与 0xda.de（2025-04，已读原文）的 `<noscript><style>` 覆盖模式同理——「JS 不可达时的行为必须由非 JS 声明保证」。

**⑤ MV3 扩展 NTP 生命周期专项**
- boot 脚本零 `chrome./browser.` 调用（源码已核实），SW 不在场无影响。
- discard/restore：文档重建 → 脚本重跑 → failsafe 重新武装，无跨生命周期状态要维护。
- storage.local（A6）只在持久化路径用，首帧镜像走 localStorage（同步可读），不引入异步竞态。
- 唯一 MV3 特有注意点：NTP 文档也可能被 **bfcache/预渲染**影响（Chrome 的 NTP 替换一般不进 bfcache，无需处理；信息缺口：无公开规范保证，建议 E2E 实测一次 cold start + back/forward）。

### 时长选型
4s（JS）+ 3s（CSS）：4s 已是现行值，覆盖冷启动 + 慢模块加载的 p99 绰绰有余（本地 ES module、无网络依赖，render 通常 <500ms）；CSS 取 3s 保证它是真正的最后防线而非重复警报。若团队偏好单一真相源，两者同取 4s 亦可接受——差的只是「JS 文件本身加载失败」这一极端场景多遮 1 秒。

---

## 第 3 问：确定性 Playwright 测试策略

### 结论

用 **`page.clock`（Playwright 官方 Clock API，v1.45+，2024-06）** 替代真实等待：`install()` 必须在页面脚本运行前（对扩展持久上下文即 context 级 install，再开 NTP 页），`fastForward('04:00')` 会让到期的 setTimeout **立即**触发（官方文档原文：「All the timers due will fire once immediately, as in the real browser」）。用**差分断言**证明「武装」而非「碰巧没被遮蔽」，用**手工 mutant** 验证测试杀伤力。真实等待 4s 是反模式：慢 + 与测试超时赛跑 + CI 抖动。

### 核心机制（已读 playwright.dev/docs/clock 与 /docs/api/class-page 原文）
- `page.clock` 覆写 `Date/setTimeout/setInterval/requestAnimationFrame/performance` 等，`install()` **必须在任何其他 clock 调用且在页面脚本运行前**（文档 warning 原文：install 的覆写会替换原生定义，乱序调用产生未定义行为）。
- `fastForward('04:00')`：时间直接推进，所有到期定时器立即各触发一次。
- `addInitScript`（官方文档原文）：「evaluated after the document was created but **before any of its scripts were run**」——用于在 boot-theme.js 之前埋探针/破坏 init，是实现「确定性崩溃注入」的正道。

### 可落地断言策略（三段式）

**断言 1（武装证明，差分法）——早退路径 + failsafe 联动**：
1. `context.clock.install()`（在创建任何页之前，扩展测试用 BrowserContext 级 clock）。
2. `context.addInitScript` 注入 sabotager：删除/抛错使 `renderCanvas` 永不完成（如 `Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { get(){ throw ... } })`，或按仓库注入点选 render.js 内部依赖）——**不破坏 boot-theme.js 本身**。
3. 清空 localStorage（无镜像）→ 打开 NTP → **不快进**，断言 `html.boot-pending` 仍在（证明遮罩没被「碰巧」解除——render 路径死了、也没别的东西解除它）。
4. `page.clock.fastForward('04:00')` → 断言 `boot-pending` 移除。第 3+4 步合起来才证明「early return 前已武装」。

**断言 2（正常路径不靠 failsafe）**：不注入 sabotager，正常打开 NTP，**不快进**，短超时内断言 boot-pending 已移除（render 自己解的）；再 fastForward 4s 断言状态不变（无二次副作用）。

**断言 3（CSS 兜底，若采纳第 2 问建议）**：注入 `page.addStyleTag` 前置 sabotager + **禁用 JS 定时器**（addInitScript 里 `window.setTimeout = () => 0`——注意这也会杀掉 init 内部定时器，恰好模拟「JS 定时器通道全灭」）→ 真实等待 ~3.2s（CSS 动画无法被 page.clock 加速的话——信息缺口：page.clock 覆写 `requestAnimationFrame`/`performance`，但对 CSS 动画时间线的控制文档未承诺，建议此测试用 3s 真实等待并接受其较慢，或 `page.clock.runFor` 实测验证是否加速）。断言 3s 后可见。

### 反例（mutant）测试法
工业依据：mutation testing 的存活变异 = 断言薄弱信号（mutant gem 文档、Plaid Engineering 博客，2024/2026，摘要级）。本仓库按 CRX-R-009 不引依赖，用**手工 mutant 清单**（临时改源码跑测试，须失败；恢复后须通过）：

| Mutant | 预期 |
|---|---|
| M1：删掉第 32 行 setTimeout 注册 | 断言 1 第 4 步失败（快进后仍遮蔽）→ 测试杀死 |
| M2：把 setTimeout 注册移回 try 之后的早退后面（复现 ticket 104 旧缺陷） | 同上 |
| M3：4000 → 400000 | 断言 1 第 4 步失败（fastForward 4s 未解除）→ 杀死时长回归 |
| M4：early return 前 `root.classList.remove('boot-pending')`（空操作化 failsafe） | 断言 1 第 3 步失败（遮罩提前消失）→ 杀死「差分」前置条件 |
| M5（CSS 兜底）：删 `@keyframes boot-unmask` | 断言 3 失败 |

反例警示（要避免的假测试）：只断言「最终 boot-pending 不存在」而不做差分——M2（注册后移）在**有镜像的正常 profile** 下测试仍绿，因为 render 先解除了；这正是「碰巧没被遮蔽」的典型假阳性，也是第 3 步「不快进时遮罩仍在」必须存在的原因。

### 慢/抖动规避要点
- 禁止 `waitForTimeout(4000)`。
- clock install 的顺序陷阱（官方 warning）：install 必须先于页面任何脚本，扩展持久上下文里要在 context 创建后、NTP 页打开前 install。
- `fastForward` 触发的回调在页面内执行，断言用 `expect(locator)` 自动重试等待，不要手动 poll。

---

## 完整来源清单

| # | 来源 | 发布方/作者 | 角度 | 本轮取证深度 | 贡献 |
|---|---|---|---|---|---|
| 1 | [next-themes src/script.ts](https://github.com/pacocoursey/next-themes/blob/a7eeabc3/next-themes/src/script.ts) | pacocoursey（2020– ） | Official/源码 | **原文已读** | 装饰式模式 A 的构造性证明 |
| 2 | [next-themes README "The Flash"](https://github.com/pacocoursey/next-themes/blob/master/next-themes/README.md) | 同上 | Official | 搜索摘要级 | 「No noflick.js required」声明 |
| 3 | [tailwindcss discussion #3904](https://github.com/tailwindlabs/tailwindcss/discussions/3904) | tailwindlabs 社区（2021，lukewarlow 2023 回帖） | Community/Criticism | **原文已读** | 遮蔽式被实测否决 + color-scheme meta 技巧 |
| 4 | [astro-tips.dev dark-mode recipe](https://astro-tips.dev/recipes/dark-mode) | Astro Tips（Astro ^5.0） | Official/Community | **原文已读** | 模式 B：inline + @media 兜底 |
| 5 | [remix-themes (npm)](https://www.npmjs.com/package/remix-themes) | sergiodxa | Official | 搜索摘要级 | 模式 C：SSR 预注入 + color-scheme meta |
| 6 | [Playwright Clock 文档](https://playwright.dev/docs/clock) | Microsoft（v1.45+，2024） | Official | **原文已读** | install/fastForward 语义与顺序警告 |
| 7 | [Playwright page.addInitScript](https://playwright.dev/docs/api/class-page#page-add-init-script) | Microsoft | Official | **原文已读** | 「before any of its scripts were run」注入时机 |
| 8 | [Hiding elements that require JS without JS](https://0xda.de/blog/2025/04/hiding-elements-that-require-javascript-without-javascript) | 0xdade（2025-04-05） | Community | **原文已读** | noscript/声明层兜底原则 |
| 9 | [Stop Using a Loading Spinner (HN)](https://news.ycombinator.com/item?id=31231477) | HN 社区（2017/2022 重议） | Community/Criticism | 搜索摘要级 | 「spinner 永转」是公认故障类别 |
| 10 | [mutant (Ruby mutation testing)](https://github.com/mbj/mutant) / Plaid Engineering mutation testing 博客 | mbj / Plaid（2024+） | Official/方法论 | 搜索摘要级 | mutant/存活变异 = 断言薄弱的依据 |
| 11 | 本地 `ntp/boot-theme.js`（本仓库，ticket 60/104 注释） | 本仓库 | — | **全文直读** | 现状核实：failsafe 已先于早退注册 |

## 信息缺口
1. remix-themes 与 HN/mutant 来源仅有搜索摘要级证据（未开原文），结论方向与已读来源一致，风险低。
2. `page.clock` 是否加速 **CSS 动画时间线**（对比 JS 定时器）官方文档未承诺——断言 3 建议实测 `runFor` 对 CSS animation 的效果，若无效则该条用例接受 ~3s 真实等待。
3. Chrome NTP 替换页在 **bfcache/预渲染**下的 boot 脚本重跑行为无公开规范保证，建议 E2E 补一条 back/forward 用例。

---

## 对本仓库的具体建议

**① failsafe 注册位置的最优改法：已经到位，无需改动核心结构。**
已直读当前 `ntp/boot-theme.js`：mask 加入（L26）→ setTimeout 注册（L32）→ try/早退（L33+），文件头注释明确记录 ticket 104/B68 将注册前移。任务背景描述的「早退跳过 failsafe」是修复前状态。可选硬化（非必须）：把回调包一层 `if (root.classList.contains('boot-pending'))` 使语义更明确（幂等性已由 classList.remove 保证，纯可读性收益）。

**② 测试策略推荐（按第 3 问三段式落地）**
新增 `test/tests/boxing-boot-failsafe.spec.ts`：context 级 `clock.install()` + `addInitScript` 注入 render sabotager + 差分断言（不快进遮罩仍在 / fastForward 后消失）+ M1–M5 手工 mutant 清单作为验收标准（每个 mutant 必须被现有断言杀死）。复用现有 mutex 测试通道（`npm run test:changed`），无需新依赖。

**③ 是否值得引入 CSS 兜底：值得，成本低、收益确定。**
在 ntp/ntp.css（构建产物路径遵循 ADR-0011，源码侧按 css-dual-write 规范检查是否需要配对选择器——此规则作用于 `html` 根元素，通常不涉及 .large-box/.small-box 配对）给 `html.boot-pending` 加 `animation: boot-unmask 0s linear 3s forwards` + keyframes，与 JS 4s 定时器形成双通道，覆盖「boot 脚本本身未执行」这一 JS 任何写法都救不了的盲区。唯一成本是补断言 3 的测试。

继续此会话，运行：atomcode -p "…" --resume 3e264b8d-66aa-4265-a5d4-d38ed297f8c0
