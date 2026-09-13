# 92 — B56 boot-pending 专项 e2e（A-046）

> 日期: 2026-09-13 · 状态: 已交付（测试代码落盘 + 静态验证；CI 锚点待 wave9 派发，见 P-92-2）
> 协议: handoff 通用调研三项（atomcode + ADR/CONTEXT 回顾 + 工业对标）全部执行于实现之前。

## 0. 开工复述（启动器要求的三确认）

1. **阻塞/被阻塞**: 本票 Blocked by: None（issue 92 + handoff 一致）；无任何票声明阻塞于 92（wave9 spec 覆盖率表 A-046=92 为叶子测试票）。
2. **必读清单 7 项全部存在并已读**: handoffs/92-boot-pending-e2e-b56-handoff.md · issues/92-boot-pending-e2e-b56.md · spec.md · WORKFLOW.md · docs/adr/0017-release-data-gate.md · docs/CONTEXT.md · decision-ledger.md；另按 handoff 补读 wave9-postrelease-grill 的 decision-ledger.md（D-001..D-010）、ga-definitive-b4f3df2.md、plan.md，以及来源报告 reports/73-report.md（P-73-1 原文）与 reports/60-report.md（机制交付面）。
3. **handoff 通用调研三项**: ① atomcode 深度调研（已做，见 §1）② ADR/CONTEXT 心智模型回顾（已做，见 §4，无冲突无 revised）③ 工业对标（已做，融入 §1/§2）。

## 1. atomcode 调研摘要（每票必做一次）

命令: `atomcode -p "在 Playwright（或同类浏览器 e2e 框架）中，如何确定性地测试『首帧无主题闪现（FOUC/flash of default theme）』这类发生在页面脚本执行极早期的视觉不变量？…"` · 会话续跑锚: `--resume 7633fddd-2d2b-4c62-ba65-46cd25186636` · ctx source: `atomcode-92`（14 节已索引）· 串行纪律: 开跑前探测在途 3 个 atomcode（票 89/90/91 窗口），等待其一退出后于本会话唯一在途。

工业结论（原文要点 + 来源核验）:

| # | 结论 | 来源 |
|---|---|---|
| 1 | `addInitScript` 在 document 创建后、**一切页面脚本与 HTML 解析之前**执行；此刻 `documentElement` 为 **null**，`observe(documentElement)` 直接抛错——必须 observe `document` 本身。 | playwright.dev Page API + microsoft/playwright#8616（维护者原话，双源核验） |
| 2 | 主闸门 = **init-script boot recorder**：解析前绑定期观察器 + 同步记录器，把「首帧不变量」转化为页内同步记账的历史日志，测试读日志不与浏览器竞速；`firstClass == expected` 才是「无闪现」的 DOM 级等价命题，`goto` 后断言终态是最常见错误写法。 | atomcode-92 §2.2/§5 |
| 3 | 归因增强 = **DOMTokenList.prototype add/remove 拦截**：能捕获同一轮脚本内「加了又删」、MutationObserver 微任务合并后看不出先后的变化；userscript/扩展工业成熟模式（@run-at document-start + 原型 patch，Dark Reader 同型）。 | atomcode-92 §2.3 · micrologics.org · Dark Reader inject/dynamic-theme |
| 4 | 像素补强 = CDP `Page.startScreencast`（仅 Chromium、必须 listener-first、帧限速可能漏单帧）——只能作旁证，不能替代 DOM 历史主闸门。 | atomcode-92 §2.5 · puppeteer#15398 |
| 5 | 机制回归防护 = e2e 断言 head 内阻塞脚本未被改成 `defer`/`async`/module——等价「主题应用早于首个 Layout」的自动化锁。 | atomcode-92 §2.6/§5.4 · sigrist.dev |

**推荐与理由（落到本票）**: 采用 2+3 组合为主闸门（跨 chromium/firefox 双车道零竞速），5 作为 AC2「不回滚 boot-theme」的源码契约锁；4/CDP 不采用——本仓库 e2e 走 Playwright 扩展/文件双车道，screencast 仅 Chromium 且漏帧特性使它给不出比 DOM 历史更强的回归信号。票 73 一次性探针的 `trace.unmask = null` 信息缺口（73-report §3.2）正对应结论 1 的 documentElement-null 陷阱，本票以「原型拦截同步捕获 + observe(document) 历史」双通道修复该缺口并入库为常驻测试。

## 2. 实现

交付物: `test/tests/boxing-boot-pending.spec.ts`（新增，唯一产品面文件改动 = 0；纯测试票）。

| # | 用例 | 断言的不变量 |
|---|---|---|
| 1 | fresh tab 首帧主题/遮罩 | 新开页（context 内第 2 个 page = 「新开标签」类比，同 file:// 源共享记忆态）：boot-pending 于 **body 解析前**挂上；同一 pre-body 微任务快照里 `<html>` 内联变量已等于记忆主题（forest: warm-50 #EDF1EC / warm-dark-50 #141C14 / accent-500 #6A9870 / accent-500-rgb 106, 152, 112 / font-size-base 14px）且 `ntp--dark` 已应用；unmask 时刻 canvas__surface 已有渲染产物（children >= 1）；class 历史中 boot-pending 呈**连续前缀**（摘除后永不复现、仅出现 1 次 add）；稳态 body 背景 = rgb(20,28,20)（forest 暗色 canvas，非 beige）、settings.theme = forest |
| 2 | 镜像缺失降级 | 全新 context（无 boxingBootTheme.v1）：仍挂遮罩、pre-body 无任何内联主题变量（默认 beige 降级）、页面完整启动并解除遮罩（无永久遮蔽 = AC5 降级路径自动化） |
| 3 | 遮罩规则行为 | boot-pending 在位时 `.canvas__surface`/`.canvas__empty`/`.inner` computed visibility = hidden，摘除恢复 visible（base.css L1244-1246 三选择器逐一实测） |
| 4 | AC2 源码契约锁 | index.html 中 boot-theme.js 为 classic 且先于 ntp.css 样式表、无 type=module/defer/async；boot-theme.js 挂 boot-pending + 镜像键 + 4000ms failsafe 字面量；render.js 摘除点恰 2 处（renderCanvas + _enterLargeBox）；base.css 三条遮罩规则在位——任一被回滚即 CI 红 |

镜像种子路径经源码确认: saveLayout 成功 → storage.js:735-739 mirrorWriter → persist.js persistBootThemeMirror → localStorage `boxingBootTheme.v1`（file:// mock 车道与真扩展同源语义）。断言值与票 73 §3.2 实测值逐项一致（含对照组判别力：beige #F1EEE8/#A08060 vs forest #EDF1EC/#6A9870）。

## 3. AC 对照（issues/92）

| AC | 判定 | 锚点 |
|---|---|---|
| e2e 覆盖首帧主题/遮罩行为 | 勾（代码+静态验证交付；运行时绿以 wave9 CI 为准，见 P-92-2） | test/tests/boxing-boot-pending.spec.ts 用例 1/2/3；pre-body 快照 + 同步拦截双通道 |
| 不回滚 boot-theme 实现 | 勾（本票零生产代码改动；回滚将触发用例 4 源码契约红 + 用例 1/2/3 行为红） | 锚点复述: boot-theme.js L25/L120 · render.js L382/L710 · base.css L1244-1246 · index.html L11(script)<L13(css) —— 全部在位且被用例 4 冻结 |
| reports/92-report.md | 勾 | 本文件 |

**静态验证锚点（本机 CI-only 政策，零本地运行/零构建产物）**: `node --experimental-strip-types --check test/tests/boxing-boot-pending.spec.ts` exit 0 · `git diff --check` clean · 文件字节无 BOM UTF-8/LF · 选择器实测存在性 grep 锚点（index.html:60 `.canvas__empty`、:73 `class="inner"`、:2 `<html lang="en">` 无初始 class → classHistory 首条必为 boot-theme 的 add）。

## 4. D-005 协议第 2 项：ADR / CONTEXT 回顾

服从且未改向: docs/CONTEXT.md `zero-flash new tab`（§41）、`paint-critical boot mirror`（§42，镜像非第二 layout 真源、不进 migrate/sync/export —— 用例 1 仅在 localStorage 层验证镜像，不触碰 layout 真源）、Wave7 settle（§43）、ADR-0017（G-A 门禁表述——本票不宣称任何门禁达成）、ADR-0012（主题包取值表，用例 1 的期望值即其 light/dark 档位）。**冲突: 无；revised: 0。**

## 5. 呈报项（本票不自行落地）

| ID | 内容 | 理由 |
|---|---|---|
| **P-92-1** | boot-theme.js `if (!raw) return;` 早退路径跳过尾部 `setTimeout(4000)` failsafe —— 镜像缺失（全新 profile）时若 init 在 renderCanvas 前死掉，内容将**永久遮蔽**（catch 路径不跳过，仅 !raw / !v 两处早退）。建议另票：把 failsafe 注册移到早退之前，并为该路径补 e2e（可用 route/断点法，或 debug 钩子）。 | 属产品代码修复，超出本票「专项 e2e」范围；WORKFLOW §2 子窗口不跨票动代码。现状经用例 2 证明「正常启动路径无永久遮蔽」，异常路径仅有静态锚点。 |
| **P-92-2** | 运行时绿锚点 = wave9 CI 验证 run（test.yml 本 spec 用例 1-4 双车道全绿）后回填本报告 + issue 勾选备注。 | CI-only 政策禁止本地跑 Playwright；WORKFLOW §4.2 与 handoff 禁止未明令 push——派发由大脑窗口执行。 |
| **P-92-3** | 并行台账整写踩踏：本票 hunk 隔离提交过程中（WORKFLOW §6 票 05/83 场景复现），一个并行窗口以陈旧缓冲整写 decision-ledger.md，同时抹掉了票 91 的 A-045 行与票 92 的 A-046 行未提交编辑。票 92 处置：先落自己一行并单独成 commit，随后把票 91 的 A-045 implemented 行**逐字还回**工作树（文本 = 本票隔离前 but diff 所捕获原文）。建议大脑在 §6 记一条「共享账本禁整文件重写，改行必须即时 hunk 级认领提交」。 | 竞态属流程性风险，非本票缺陷；票 91 若再次整写会再次抹行，需其窗口自查。 |

## 6. 禁止项自查

未宣称 2026.9.12/9.15 三门达成 · 未代签 G-B · 未动豁免台账/N 桶 · 未 push/tag/force-push · 未改 boot-theme/render/base.css 任何一行（AC2 由测试锁而非实现变更满足）。

## 7. 版本控制（WORKFLOW §4.2）

`but diff` 逐 hunk 认领后 `but commit -b wave9-ticket92-boot-pending-e2e`——本票文件集: test/tests/boxing-boot-pending.spec.ts · reports/92-report.md · issues/92 AC 勾选 · decision-ledger.md A-046 行。并行窗口（票 89/90/91 在途改动: ntp/storage.js、sync-engine.js、utils.js、boxing-auto-expand.spec.ts、decision-ledger.md 他票 hunk）一律不卷入。
