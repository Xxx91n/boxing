# 104 报告 — boot-theme 早退 failsafe（B68 / A-058）

> 票: `.scratch/architecture-recovery/issues/104-boot-failsafe-b68.md` · Handoff: `handoffs/104-boot-failsafe-b68-handoff.md`
> 波次: Wave9.15 · 段②（D-006）· 镜像 GitHub #15 · 目标版本 2026.9.15
> 阻塞关系: Blocked by 96/100（均已 done，见 §2）；本票为 A-061 发行 G-A 重跑的前置之一
> atomcode 会话: `3e264b8d-66aa-4265-a5d4-d38ed297f8c0`（11m34s，exit 0）

**时序披露**: atomcode 调研于实现前启动（§1.1），实现期间在途完成；§1.2/§1.3 的 ADR/CONTEXT 回顾与工业对标在实现前完成。atomcode 结论与实现一致（其「建议①」直读修复后的 `ntp/boot-theme.js` 并确认注册顺序已正确），无冲突需改向。

## 1. 调研摘要（先于实现完成）

### 1.1 atomcode 深度调研（串行一次）

问题: 阻塞式 boot 脚本「遮罩永不解除」的工业防护与测试策略。
原始输出: `.scratch/104-atomcode/atomcode-research.md`（提示词 `prompt.md`，字节原样保留）。

结论:

1. **主流实现不用「遮蔽-解除」结构**。next-themes（源码直读 `src/script.ts`）、Astro 社区 dark-mode recipe、remix-themes 全部是「只装饰、不遮蔽」——阻塞脚本只做加法（加 class / setAttribute），构造上不存在「永久空白」这一状态变量；最坏结果是「默认主题短暂闪现」。社区对遮蔽式的实测否决见 tailwindcss discussion #3904（`<body class="hidden">` 提议被实测「仍闪白 + 永久隐藏风险」而放弃）。
2. **Boxing 属少数派（模式 E）**。其正当需求（用户显式主题包 + `chrome.storage` 异步 vs localStorage 同步首帧镜像，即 FART / CSS-Tricks blocking-boot 模式）A/D 模式满足不了，保留遮蔽式合理，但必须按 A/B 的教训改造: **(a) failsafe 武装先于一切早退路径；(b) 叠加语言无关的 CSS 定时兜底**。
3. **failsafe 选型**: 保留固定 4s `setTimeout`（render 本地 <500ms，4s 覆盖 p99 有余）；**不推荐** MutationObserver（与 setTimeout 等价但更重，其唯一增量价值——区分「render 解除」与「failsafe 解除」——测试里用差分断言即可获得）；**load 事件不可作触发条件**（任一子资源挂起即永不触发，NTP 的 favicon 走外部 https:，弱网可延迟 30s+）。
4. **测试策略**: `page.clock` install + fastForward 做确定性时间推进；**必须用差分断言**（不快进时遮罩仍在 → 快进后消失）证明「已武装」而非「碰巧没被遮蔽」；用手工 mutant 验证测试杀伤力。
5. **MV3 生命周期**: boot 脚本零 `chrome./browser.` 调用 → SW 不在场无影响；tab discard/restore 会重建文档 → failsafe 重新武装，无跨生命周期状态需维护。

失败模式矩阵（摘要）:

| 模式 | 镜像缺失 | 镜像非法 | init 崩溃 | 禁 JS | 永久空白可能 |
|---|---|---|---|---|---|
| A next-themes 装饰式 | 默认主题 | 默认主题 | 内容本就可见 | 系统主题 | **否**（构造上无遮蔽态） |
| B Astro 装饰式 + @media | defaultTheme | defaultTheme | class 已生效 | @media 接管 | **否** |
| C remix-themes SSR 预注入 | 服务端/系统 | 同 | data-theme 已在 HTML | 系统主题 | **否** |
| D 纯 CSS color-scheme | 系统主题 | 系统主题 | 不依赖 JS | ✓ | **否**（不支持显式用户主题） |
| **E Boxing 遮蔽式** | **需 failsafe 武装** | **需 failsafe** | **唯一致命场景** | 需 CSS 兜底 | **是，除非双保险** |

### 1.2 ADR / CONTEXT 回顾（D-005 第 2 项）

服从且未改向: `docs/CONTEXT.md` §41 `zero-flash new tab`（首帧即记忆态、不得先出错误盒子）、§42 `paint-critical boot mirror`（镜像非第二 layout 真源、不进 migrate/sync/export）、§43 Wave7 settle（boot-theme.js + boxingBootTheme.v1）、ADR-0012 主题包取值表、ADR-0017 发行门禁表述（本票不宣称任何门禁达成）、BX-EXPLORE-015（catch 分类注释约定，boot-theme 现有 catch 已带 `/* silent: ... */`）。

**关键观察（非冲突，是代码向既有不变量的回归）**: `ntp/base.css:1242` 与 `ntp/boot-theme.js` 文件头均已把「a 4s failsafe clears the class if init dies（never permanently hidden）」写成**已声明的不变量**，但实现只在无早退的路径上成立。本票修复 = 让代码兼现自己的注释与 CSS 注释，**未引入新心智模型**。

**冲突: 无；revised: 0。**

### 1.3 工业对标（实现 + 测试）

- 实现: §1.1 模式 A–D 的失败模式矩阵（next-themes 源码级、tailwindcss #3904 原文级、astro-tips 原文级、0xda.de 声明层兜底原则）。
- 测试: Playwright 官方 Clock API（v1.45+）与 `addInitScript` 注入时机（"before any of its scripts were run"）原文核验；mutation testing 方法论（mutant / Plaid）用于设计本票的反例验证（§4.3）。

### 1.4 调研推荐 vs 本票范围（→ 呈报项）

调研推荐「叠加纯 CSS 定时兜底」（`html.boot-pending { animation: boot-unmask 0s linear 3s forwards }`）以覆盖「boot-theme.js 本身未执行」（404 / CSP 拦截 / 顶层抛异常）这一 JS 任何写法都救不了的盲区。**本票不落地**，理由见 §6 P-104-1。

## 2. 开工第一句复述（三项核对）

### ① 阻塞/被阻塞关系

本票 `Blocked by: 96, 100`。票 96（docs-gov dead-link / A-050）状态 `implemented-pending-ci`；票 100（calver 门禁 / A-054）状态 `done`；两者均已落盘 → **阻塞已解除**。本票自身为段②产品票，是 A-061（发行 G-A 绑最终 tip）的前置之一。

### ② 必读清单路径存在性

全部存在（含 handoff 表内的 D 账本与 plan）:

| # | 路径 | 存在 |
|---|---|---|
| 1 | `.scratch/architecture-recovery/handoffs/104-boot-failsafe-b68-handoff.md` | ✅ 1664 B |
| 2 | `.scratch/architecture-recovery/issues/104-boot-failsafe-b68.md` | ✅ 589 B |
| 3 | `.scratch/architecture-recovery/spec.md` | ✅ 2194 B |
| 4 | `.scratch/architecture-recovery/WORKFLOW.md` | ✅ 33454 B |
| 5 | `docs/adr/0017-release-data-gate.md` | ✅ 10313 B |
| 6 | `docs/CONTEXT.md` | ✅ 31755 B |
| 7 | `.scratch/architecture-recovery/decision-ledger.md` | ✅ 15314 B |
| + | `.scratch/wave9-915-release-grill/decision-ledger.md`（handoff 表） | ✅ 8990 B |
| + | `.scratch/wave9-915-release-grill/plan.md`（handoff 表） | ✅ 1775 B |

### ③ handoff 通用调研三项

①atomcode 串行深度调研（§1.1，已执行）；②回顾 `docs/adr` 与 `docs/CONTEXT.md` 现有心智模型，冲突不静默改向（§1.2，冲突 0 / revised 0）；③对标工业级实现/测试策略（§1.3）。三项均已完成，结论已写入本报告开头（§1，位于实现描述之前）。

## 3. 缺陷与修复

### 3.1 根因（P-92-1）

`ntp/boot-theme.js`（ticket 60）在 `root.classList.add('boot-pending')` 之后进入 `try`，并在两条早退路径 `if (!raw) return;`（镜像缺失 / 全新 profile）与 `if (!v || typeof v !== 'object') return;`（镜像非法）提前返回；而 4s failsafe 的 `setTimeout` 注册位于 IIFE **末尾**，被这两条早退跳过（catch 路径不跳过——异常后继续执行到末尾）。后果: 全新 profile 下若 init 在 `renderCanvas` 前死掉，`html.boot-pending` 永久驻留 → 画布内容**永久遮蔽**（永久空白）。

### 3.2 修复（最小改动）

把 failsafe 注册前移到 `root.classList.add('boot-pending')` 之后、`try` 之前: mask 一旦置位，任何离开该脚本的路径（早退 / parse 抛异常 / 正常流）都已武装 failsafe。failsafe 行**文本与 4s 时长保持不变**（票 92 AC2 正则锁定面不回退）；文件头注释同步注明武装顺序。

改动量: 头部注释 +2 行；`setTimeout` 块由 IIFE 末尾上移至 mask 之后（净 +5 行 / −3 行）。**仅动 `ntp/boot-theme.js`；未触碰热文件 `ntp/render.js` / `ntp/ntp.js`（test/README 热文件单 agent 约定）。**

### 3.3 未采用的可选硬化（调研建议，本票不做）

把回调包 `if (root.classList.contains('boot-pending'))` 守卫: `classList.remove` 已幂等，纯可读性收益，且会改动票 92 AC2 正则锁定的字面行 → 不采纳。

## 4. 验证锚点

### 4.1 静态门

| 门 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check ntp/boot-theme.js` | exit 0 |
| 四门 pretest | `npm run pretest` | exit 0（import-graph 15 模块/48 边/0 违规；migration-golden 28/28；css-balance OK；calver 8 面一致 version=2026.9.15） |
| 空白/行尾 | `git diff --check` | 干净（LF，无 CRLF/BOM） |

### 4.2 focused 实测（双车道）

命令: `node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts test/tests/boxing-boot-pending.spec.ts --project=<proj> --reporter=line`

| 车道 | 结果 |
|---|---|
| chromium-extension | **7 passed (16.3s)**，exit 0 |
| firefox-extension | **7 passed (33.4s)**，exit 0 |

7 例 = 票 92 既有 4 例（含「fresh tab first frame 零闪现」与 AC2 源码契约）+ 本票新增 3 例（2 行为 + 1 源码契约）。既有 4 例全绿 → **AC3「零闪现路径不回退」实测成立**。

### 4.3 反例（mutant）验证 — M2

把 `ntp/boot-theme.js` 临时还原为修复前形态（`git show HEAD:ntp/boot-theme.js`），跑 `-g "B68"`:

- 结果: **3 failed，exit 1** —— 两条早退路径用例均以 `Timeout 10000ms exceeded while waiting on the predicate`（遮罩永不解除）失败，源码契约用例失败。
- 还原: sha256 `52c45d6fed4e982533da0a201cef722302072db0e725b28b6da1d3e93cc236d0` 前后一致（变异体 `4f0f4512…` 已清除）；还原后复跑 `-g "B68"` **3 passed，exit 0**。

→ 证明新用例**非空洞**: 它精确杀死 P-92-1 缺陷；且差分断言（先断言 +600ms 时仍遮蔽，再断言 failsafe 后解除）排除了「碰巧没被遮蔽」的假阳性（调研 §3 反例警示）。

### 4.4 全量套件实测（WORKFLOW §4.1 必要条件）

命令: `node scripts/test-mutex.mjs full --workers=2 --reporter=line`（CI 口径 workers=2，票 93 先例）

| 项 | 结果 |
|---|---|
| 全量 | **609 passed / 2 failed / 5 skipped（13.0m）**，exit 1 |
| 失败名单 | 均 `boxing-accent-theme.spec.ts` × firefox-extension（`:16` theme button click applies CSS variables；`:32` theme button persists theme in layout.settings） |
| 收敛复跑 | `--last-failed` → **2 passed（11.2s），exit 0**（同码同宿主秒级翻转） |

**失败定谳（环境性，非本票引入）—— 五条独立证据腿:**

1. **日志定位**（票 13 教训: 用 log 定谳，不按现象推断）: `:16` 失败于 `resetBoxing` 第 11 行 `page.reload` 导航超时——**发生在任何主题 / boot 断言之前**；`:32` 为 teardown `browserContext.close` 超时，伴 Firefox juggler `NS_ERROR_FAILURE … removeProgressListener` 与 `connector for namespace "page" … is disposed`。
2. **同 spec 对照**: 同车道同轮次下 `boxing-accent-theme` 另 3 例（graphite / pure / beige，`:47` `:62` `:77`）全绿。
3. **同码翻转**: `--last-failed` 复跑 2/2 绿（11.2s），代码未变（`git diff` 空）。
4. **签名吻合既有 host-incident 家族**: 与票 93 本地证据（2 例 firefox file:// `page.goto` 导航超时）、票 31 记载「仅 accent-theme 启动超时受害」（`WORKFLOW.md` §6 · 2026-09-06 行）逐字同类。
5. **无因果机制**: 本票 diff 对 `ntp/boot-theme.js` 的唯一行为差量是同步 IIFE 内一处 `setTimeout` 注册位置前移（零 I/O、零 import、零网络、无新增 DOM 变更）；`boxing-accent-theme` 的失败点（`page.reload` 导航 / context teardown）在该脚本语义之外。

5 skipped = 既有基线（firefox 原生 dblclick 平台限定 ×3 + undici 断言无适用面 ×2），与票 93 §3 逐条账目一致。

→ 结论: 全量套件对本票改动**无产品面回归**；2 例为宿主饱和环境事件（登记处置见 §6 P-104-4）。

## 5. AC 对照

| AC | 判定 | 证据 |
|---|---|---|
| 早退路径有 failsafe | ✅ | §3.2 修复；§4.1 语法/静态门；§4.3 mutant 杀死旧形态；§4.4 全量套件无产品面回归 |
| 相关 e2e 或书面否证 | ✅ | §4.2 新增 3 例 e2e（2 行为 + 1 源码契约），双车道 7/7；§4.3 mutant 验证杀伤力 |
| 零闪现路径不回退 | ✅ | §4.2 票 92 既有 4 例双车道全绿（含首帧记忆态断言）；§4.4 全量 609 绿；failsafe 行文本/时长未变（AC2 正则面不回退） |

无 F/N 项需具名。

## 6. 呈报项（本票不自行落地）

| ID | 内容 | 理由 |
|---|---|---|
| **P-104-1** | **纯 CSS 定时兜底**（调研推荐）: 给 `html.boot-pending` 加 `animation: boot-unmask 0s linear 3s forwards` + `@keyframes`，与 JS 4s 定时器构成双通道，覆盖「boot-theme.js 本身未执行」（文件 404 / CSP 拦截 / 顶层抛异常）这一 JS 任何写法都救不了的盲区。 | ① A-058 规范化需求为「早退 failsafe」，CSS 兜底属另一故障类（脚本未执行 ≠ 早退跳过注册）；② `ntp/ntp.css` 为 ADR-0011 gitignored 构建产物（`git ls-files ntp/` 无 ntp.css），落地须 `npm run build` 重新生成，与 2026-09-04 CI-only 构建政策冲突；③ 需配套断言（禁用 JS 定时器通道 + CSS 时间线断言；`page.clock` 对 CSS 动画时间线的加速官方未承诺）。建议另票。 |
| **P-104-2** | **测试时间推进改用 `page.clock`**（调研推荐）: 现用例以真实 ~4.6s 等待验证 failsafe；调研推荐 context 级 `clock.install()` + `fastForward('04:00')` 做确定性推进。 | 未采纳原因: `clock.install()` 会覆写 `setTimeout` 等原生定义并影响**真实 ntp.js init 路径**，而本票用例的差分断言依赖「页面自身 boot 已完成」这一前置；改用 clock 需改为调研 §3 的 sabotager 注入式设计（杀 render 而非等 render 完成），属测试架构变更，超出本票范围。现设计已满足「差分 + mutant 杀伤」两条硬要求。 |
| **P-104-3** | **NTP bfcache/预渲染下 boot 脚本重跑**（调研信息缺口 3）: 无公开规范保证，建议补一条 cold start + back/forward e2e。 | 调研信息缺口；与本票缺陷无关。 |
| **P-104-4** | **accent-theme × firefox 2 例环境性失败是否登记 host-incident**（§4.4）: 建议大脑在 CI 上复核该 2 例后，按 `docs/testing-governance.md` §Host-environment incident register 规则裁定是否新增登记行。 | 该登记表的**行消解判据是 CI 绿**（非本地实测），本窗口未获 push 明令、无 CI 锚点，无法满足登记/消解条件；且属治理文件变更，超出 A-058 范围。登记表现有 3 行为 `boxing-state-sync`（2026-09-05 事件，Due 2026-10-06），本票未触碰。 |

## 7. 禁止项自查

未宣称 2026.9.12/9.15 三门（G-A∧G-B∧G-C）达成 · 未代签 G-B · 未动豁免台账 / N 桶 · 未对数据完整性面豁免 · 未 push / tag / force-push · 未热修 2026.9.12 · 未用 run 34808080000 冒充本波 land 后发行 G-A · 未对已推送 main 换 root · 未引入任何 npm 依赖（CRX-R-009） · 未触碰热文件 render.js/ntp.js。

## 8. 版本控制（WORKFLOW §4.2）

分支: `ticket/104-boot-failsafe-b68`（本窗口专属）。
本票文件集: `ntp/boot-theme.js` · `test/tests/boxing-boot-pending.spec.ts` · `.scratch/104-atomcode/prompt.md` · `.scratch/104-atomcode/atomcode-research.md` · `.scratch/architecture-recovery/reports/104-report.md` · `.scratch/architecture-recovery/issues/104-boot-failsafe-b68.md`（AC 勾选） · `.scratch/architecture-recovery/decision-ledger.md`（仅 A-058 行）。
流程: `but diff` 逐 hunk 认领 → `but commit -b ticket/104-boot-failsafe-b68 -m "<消息>" <改动 id...>`。
并行窗口保护: 共享账本 `decision-ledger.md` 禁整文件重写，A-058 行单独 hunk 认领即时提交（P-92-3 教训）；其他窗口在途分支（`ticket/96-docsgov-deadlink`、`ticket/100-calver-guard`、`wave915-grill-settle`）一律不卷入。

## 9. 完成定义核对（handoff）

| 项 | 状态 |
|---|---|
| AC 全勾或具名 F/N | ✅ §5（无 F/N） |
| 附 CI/实测锚点 | ✅ §4（focused 双车道 7/7 + mutant 杀 3/3 + 全量 609 passed；CI 复跑归大脑窗口——本窗口未获 push 明令） |
| 账本状态更新 | ✅ decision-ledger A-058 current → implemented |
| 报告落盘 | ✅ 本文件 |
| 版本控制遵循 WORKFLOW §4.2 | ✅ §8 |
| 未对已推送 main 换 root | ✅ |

## 10. 大脑窗口交接（本窗口无权限执行）

| 项 | 内容 | 阻塞原因 |
|---|---|---|
| ① CI 复跑 | 对本票 tip 派发 `test.yml`，取得 G-A 面证据 | 未获 push 明令（handoff 禁止未明令 push） |
| ② GitHub #15 镜像评论 | 只读核验: #15 = `W915 P2: B68 boot-theme 早退路径 failsafe`，state OPEN，label `bug`，**0 评论**。按 D-002 约定评论须含 run URL + 实施证据指针 | 无 CI run URL（待 ①）；外部动作归大脑 |
| ③ 账本/报告 CI 绿后回填 | A-058 行已记 implemented（实测锚点）；CI 绿后可追加 run URL | 待 ① |
