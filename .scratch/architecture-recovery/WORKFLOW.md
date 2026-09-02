# WORKFLOW.md — 架构修复全流程 (巡检 → 收口)

- 生成日期: 2026-08-31
- 生成依据: `$ask-matt` / `$to-spec` / `$to-tickets` SKILL 本体 (C:/Users/Administrator/.agents/skills/grill/engineering/) + 本仓库约束 (大脑/子窗口双轨、GitButler、atomcode 优先、多窗口人工派发) + 同目录 research-report.md (atomcode 调研)。
- 效力声明: 本文件与 skill 本体冲突时, 以 skill 本体为准。本文件只为本地固化与记忆压缩。

## §1 总览: 从巡检到收口的九环节

| # | 环节 | 入口技能 | 产出物 |
|---|------|---------|--------|
| 1 | 巡检 (找深化机会) | /improve-codebase-architecture | 候选清单 (会话内) |
| 2 | 深度调研 (成熟轮子优先, 不自研) | atomcode-research (ctx 包裹, 串行) | research-report.md + ctx 索引 |
| 3 | 隔谈明确范围 (可选) | /grill-with-docs | CONTEXT.md / ADR |
| 4 | 落 spec | /to-spec | spec.md |
| 5 | 拆票 (tracer-bullet, blockers-first) | /to-tickets | issues/NN-slug.md |
| 6 | 写 handoff 与窗口启动器 | (大脑会话) | handoffs/NN-slug.md, prompts/NN-slug.md |
| 7 | 多窗口人工派发 | 人工 | 子窗口开工 (prompts/NN-slug.md 为唯一入口) |
| 8 | 子窗口实施 | /implement (内含 /tdd) → /code-review | 代码改动 + 测试绿 |
| 9 | 收口: commit + 教训写回 | GitButler (见 §4.2) | commit + 本文件 §5 追加 |

## §2 大脑 / 子窗口 双轨分工

- 大脑窗口 (本会话): 巡检、调研、spec、拆票、handoff、启动器、跨票裁决、收口审查。不带实施。
- 子窗口: 只拿 prompts/NN-slug.md 开工; 实施遵循 /implement → /tdd → /code-review; 遇阻塞回报大脑, 不跨票动代码。
- 派发是人工动作: 大脑生成 prompts 后由人逐窗贴入启动器。无自动调度。
- 子窗口上下文在票完成后可弃 (票自包含); 大脑窗口在 to-tickets 完成前保持单一连续上下文 (ask-matt Context hygiene)。

## §3 边界处决 (phase boundaries)

按 ask-matt 五选项树: Continue → /clear → /handoff → subagent → /compact (默认)。
- 同一票内: Continue。
- 票与票之间: 子窗口整个新开, 无需 compact。
- 大脑窗口逼近 smart zone: 在阶段边界 /compact, 不中途压缩。

## §4 工程约束

### §4.1 测试与验证
- 每票实施遵循现有 Playwright 配置: `npm test` (test/playwright.config.ts); 清绿为本票 done 的必要条件。
- 拆分类票额外验收: `npm run build` 绿 + dist 产物结构与 manifest 契约不变。

### §4.2 版本控制 (唯一来源)
- 使用 GitButler (`but` CLI) 进行所有提交操作。每个子窗口对应一张票, 独立但 branch。
- 提交路径: `but diff` 确认改动 → `but commit -b <branch名> -m "<消息>" <改动id...>`。
- 不改写他人/其他窗口的提交; 不 push, 不开 PR (除非用户明确要求)。
- 提交信息: 说清变什么、为什么、关键决策。小修复 amend 进所属 commit, 不造 fixup 垃圾。
- 启动器与子窗口禁止出现 worktree / git checkout / git branch 等字样; 版本控制表述一律引用本节。

### §4.3 调研纪律
- 联网调研只允许经 ctx 包裹的 atomcode, 串行 (同会话同时在途最多 1 次)。
- 优先复用工业成熟心智模型/轮子, 不重复开发。

## §5 偏离点清单 (本地适配, 待用户确认后生效)

| # | 原 skill 流程 | 本地适配 | 理由 |
|---|--------------|---------|------|
| D1 | /to-spec → 发布到 issue tracker | 发布为本地文件 spec.md | tracker 是本地文件制, 见 to-tickets local 分支 |
| D2 | 实施由 /implement 在同窗口或新会话自动进行 | 多窗口人工派发, 子窗口以 prompts/NN-slug.md 启动 | 用户约束: 大脑/子窗口双轨 |
| D3 | 提交用 git | 全部走 GitButler but CLI (§4.2) | 用户约束 + 多窗口并行避免互相干扰 |
| D4 | 调研用 /research (后台 agent 写 md) | 用 atomcode 联网深度调研, 报告 ctx 索引 | 用户约束: atomcode 优先 + 成熟轮子优先 |
| D5 | to-tickets 步骤 4 "Quiz the user" 逐票确认 | 大脑生成全部产出物后由用户对整包过目 | 减少回合; 用户拥有否决权 |
| D6 | 调研报告路径按用户占位符 {架构报告路径} | 固化为 research-report.md (同目录) | 占位符未指定, 取就近路径 |

## §6 教训回放 (爆炸写回, 不许随会话蒸发)

新教训追加到本表, 注明日期与来源票号。

| 日期 | 来源 | 教训 |
|------|------|------|
| 2026-08-31 | 历史 (AGENTS.md / ADR-0013) | BX-DEV/A1-A5 禁令是伤疤立法 — 结构缺位时规则代理隔离; 拆分落地后应大面积失效 |
| 2026-08-31 | 调研 | ntp.js file:// mock 在 ESM 下因 CORS 失效; 拆首票时必须先处理或接受该调试路径断裂 |
| 2026-08-31 | 调研 | storage 写链/防回环/onChanged 是单一体, 严禁拆散到多模块; 拆散即引入竞态 |
| 2026-08-31 | 票01 | 物理双击必然派发 click(1)→click(2)→dblclick; 两击目标不同时 dblclick 落最近公共祖先 (W3C)。同一物理双击只允许一次副作用: 创建入口共享时间+位置冷却, CTA 只桥接不加 detail 守卫 (工具栏连点要保活)。教训名 BX-DEV-112D |
| 2026-08-31 | 票01 | 本地 8 核跑默认 workers 会饿死 8 个 headed 浏览器 — 失败名单逐轮轮换且 solo 全绿即此症状, 先降 workers 再怀疑代码 (已固化 workers: 4) |
| 2026-08-31 | 票01 | Firefox persistent context 原生输入 (mouse.dblclick/locator.click) 会挂起 — playwright #16095, 环境性, Firefox 车道用 @quarantine 标签排除; 测试就绪信号要轮询它实际调用的函数, 不能只轮询 __boxingDebug (init 作用域暴露会晚于顶层) |
| 2026-08-31 | 票01 | mock 数据版本字段写字符串 "3.7.0" 会在数值比较中静默为 false 并清空迁移结果 — 数值比较字段一律写数字 |
| 2026-08-31 | 票03 | ESM 化后 file:// mock 的 CORS 失效是 chromium 独有且可解: `<script type="module">` 在 chromium file:// 默认被 CORS 封锁 (origin 'null', probe 实证), `--allow-file-access-from-files` 启动参数解封; firefox 同目录 file:// module 原生放行无需 pref。file:// 调试/测试车道因此保活 (spec 方案 a), 两个 playwright 配置的 chromium 项目均已加 flag — 04-08 票沿用, 勿再当阻塞 |
| 2026-08-31 | 票03 | 抽模块前先认 favicon 块的真实边界: 票02 报告 §5 记 favicon 桶仅 1 符号 (probe) 是漏报, 真块 = IIFE 结束 `})();` 之后的 L5949-6094 尾段 (FAVICON_SOURCES/fastestCDN/getFaviconUrl/raceCDN/isValidPublicUrl/faviconCache/TTL/loadFavicon), 自包含仅 export loadFavicon; 搬移用 node 脚本逐字节切 (marker 唯一性 + head 以 `})();` 结尾两条前置断言), 禁止手抄 |
| 2026-09-01 | 票05 | 逐字节切函数时, 删除区两侧空行会并成新空行串并污染 diff: 搬移脚本须记录每行 origin 行号, 只折叠 "pristine 中不存在的空行串" (且 \n{3,} 正则 = ≥2 连续空行, 别按 3 空行数 — off-by-one 两次踩中); 纯度审计假阳性三源: 对象字面量键名/正则字面量字符($)/同行多声明, 依赖逐函数人读源码定谳 |
| 2026-09-01 | 票05 | 与票04 并行同改 ntp.js: 提交前必须 `but diff <file>` 逐 hunk 认领, 整文件 id 会把并行窗的未提交改动卷进自己 commit; hunk 与他人纠缠时用隔离法 (暂摘他人行→提交自己 hunk→原样还回→node --check)。纯度排除清单已写入 issues/05 供 06/07/08 认领 (makeId→06, mergeConcurrentLayout→07, clamp*Pan→08) |
| 2026-09-01 | 票04 | chromium file:// 下 `--allow-file-access-from-files` 只解封 module 脚本加载, `fetch(_locales/**)` 仍被 CORS 阻断 (相对/绝对路径 probe 均 Failed to fetch) — 票03 教训的边界勘误: "file:// 车道保活" 不含运行时 fetch。i18n/任何 fetch 型测试须用 fetch stub (page.addInitScript 服务磁盘真实文件字节) 或仅断言 fallback 路径; 真实 locale 渲染验证走扩展上下文 (chrome-extension://) |
| 2026-09-01 | 票04 | IIFE 内块抽 ESM 模块的注入面三处逐点 probe 后再动手: i18n 块仅 api/debug/debugErr 各 1 处跨作用域引用 (rename 后 assert 0 残留), 块外对 i18nStore/I18N_FALLBACK 0 引用、对 currentLang/SUPPORTED_LANGS 全只读 → 状态可 module-private + export let live-binding, 116 处 i18n() 调用点零改动。搬移脚本内置 5 层自验 (marker 唯一 / indent round-trip / rename 计数 / 写后内容断言 / node --check) 失败自动回滚快照 — 与票05 的空行折叠教训互补: i18n 块整段搬移无需空行处理 |
| 2026-09-01 | 票04 | 源码断言型测试 (readFileSync + toContain) 是拆票共享门禁: 符号搬去哪, 断言必须同步迁去哪, 否则并行窗互相卡绿。票05 搬 clampToEdge/migrateLayout 后未及迁移断言, 04 车道代迁 (issues/04 处置结论注明归属) — 06-08 票动手前先 grep test 里旧符号名 |
| 2026-09-01 | 票07 | ESM 门面注入式搬移 (跨作用域 let + init 一次性注入) 让整块逐字节搬移成为可能: 搬移块内 0 改动, 注入表 18 函数赋值, ESM import 冒烟 (export 平价) 先于浏览器验证; but 提交依赖多分支 (05+06) 时 anchor 到栈顶 (含全链) 而非逐个 stack; 双标签不回环验证必须走真扩展上下文 (chrome-extension:// + 真 storage.onChanged), file:// 车道手动 nudge 证明不了 |
| 2026-09-01 | 票08 | 静态自验全绿 ≠ 运行时正确: 10 层自验 (含 node --check + ESM 冒烟) 全过的落盘仍被 chrome-extension:// 活体探针逮出 3 个盲区 — state.js `export let a=x, b=y` 多变量导出只抓首名致 canvasPanY/innerPanY 漏 import (ReferenceError 静默于 catch)、initXxxFacade 本身不在 movedDeclSet 致 import 漏、ESM live-binding 读取依赖 (provisionalGhost) 漏。教训: 机械清单要含 "门面函数自身" 与 "多变量导出的每个名字", 且落盘后必须活体探针 (persistent context + 真扩展上下文) 才算验证 |
| 2026-09-01 | 票08 | 注入时序 TDZ: facade 注入调用点必须在它依赖的所有 IIFE 顶层 const (DOM ref) 声明之后 — appEl/headerPinBtn/headerBar 在 L1361 而 facade 调用被插在 L355, `Cannot access 'appEl' before initialization` 求值即炸。搬移脚本插桩 anchor 不能按 "第一个语义合理位点" 挑, 要按依赖声明序挑; 求值期即调用注入函数的语句 (如 pin 监听块的 updateAutohideUI()) 是注入点下界的硬约束 |
| 2026-09-01 | 票08 | IIFE 历史缩进漂移岛 (ensureGroups 零缩进 / enterAndLocateSmallBox 单空格) 让 "2 空格缩进 = IIFE 顶层" 启发式失效: decl 计数与 carve-out 扫描都要用括号深度跟踪 (depth==1) 判定真顶层, 文本缩进只作辅助; `const world = f(a, canvasContainer, ...)` 实参被朴素逗号分割误判为多变量声明会污染 decl 集 — 逗号分割必须括号深度感知 |
| 2026-09-01 | 票09 | AGENTS.md 薄化的悬空引用面大多在文件外: 全文复读残余文件只覆盖自身, 真断点藏在 (a) readFileSync 断言 AGENTS.md 内容的 spec (boxing-build-pipeline 断言 BX-MANIFEST-004b/stale 字符串), (b) CONTEXT.md 级 "See AGENTS.md <规则ID>" 交叉指针 (CONTEXT.md:70 指向已删 BX-EXPLORE-005), (c) 冻结块内陈旧事实 (ntp.js ~3.3k 行数、node --check 根路径)。收尾检查点 = 复读残余 + grep 规则ID全仓引用 + 跑内容断言 spec, 三件套缺一不可 |
| 2026-09-01 | 票06 | 闭包状态收敛的机械改写禁用整文件字符级 lexer (注释撇号 box's / 除法vs正则歧义制造幻影字符串污染带, 状态错一处全文件错位): 用线级扫描 (引号/模板/正则同线闭合 + 跨行 carry) + 语义断言门 (位点计数/导出平价/裸写残留/Node ESM 冒烟) 兜底; 声明行守卫必须只护 decl 头 (首个顶层 `;` 之前), `const ci = clamp(...); innerPanX = ci.x;` 这类 decl-tail 混合行漏改会以 Assignment to constant variable 在运行时炸出, 语法检查拦不住 |
| 2026-09-01 | 票10 | init() 巨体内区域拆分模式: 嵌套函数声明整体上移模块顶层 + init-time 语句 (监听器/水合/初始化调用) 收进 bindXxx() 由 init() 原位调用 — 函数声明提升让 bind 内调用模块级 helper 无时序风险, bind 调用点即原语句块位置 (行为时序平价); 共用 DOM refs 单点声明在 entry 再注入, 双模块各自 getElementById 会 fork 元素 null-ness |
| 2026-09-01 | 票10 | facade 注入解耦红利实证: entry 级函数 (openConfirmModal/openSettingsModal/updateCaption) 移入新模块后, 下游 render.js 的 initRenderFacade 28 项注入表零改动 — entry 改 import 来源即可; 跨模块挪动函数时优先改 entry import 而非缩下游注入表 |
| 2026-09-01 | 票10 | 标识符机械审计的正则字面量掩码必须跟踪字符类状态: 字符类内 / (如 /[\\/]/g) 会提前闭合掩码使后续正则内容泄漏成假阳性 (票05 假阳性第四源); 多变量声明列表 (let resp, result) / 匿名 function 参数 / 无括号箭头参数 (c =>) 也要机械收集, 否则全成未知标识符噪音 |
| 2026-09-01 | 票10 | chrome.runtime.onInstalled 只在 SW 上下文可靠触发且 NTP 页可能不在场: NTP 消费 install/update 走 storage 信号桥 (SW 写 boxingInstallSignal → 门面 consumeInstallSignal 读+删), file:// mock 车道无信号时保留 legacy 判定保 file:// 测试绿; SW 侧非 layout 小键 (bgErrLog/boxingInstallSignal) 是 storage 只经门面不变量的合法例外 (门面是页面上下文写链, 不适用 SW) |
| 2026-09-02 | 票11 | 下沉候选纯度定谳先查目标模块既有惯例再裁: utils.js 头注释已登记纯度豁免清单 (票05), screenToWorld 以参数传 container+getBoundingClientRect 即视为可接受的 utils 纯度模式 — zoomAtPoint 整函数照此 verbatim 下沉, 免造数学部分拆半的畸形切面; 六候选五个非纯 (DSU 闭包 state Map / clampCanvasPan 缓存+DOM / boxMidPoint 全局索引), 机械名单必须逐一实测而非按名推断 |
| 2026-09-02 | 票11 | 十层自验脚本的断言自身也要过审: 三轮假失败全来自断言写错 (splice 缝合断言方向反了 / 三连空行全局检查未做 pristine 增量对比 / census 漏数头注释字样与正则未转义锚), 每条断言先想清 "正确状态长什么样" 再落笔, PRE-WRITE 拦截层保证失败零副作用 |
| 2026-09-01 | 票10 | GitButler: commit 报 "N changes could not be applied: ... depends on <branch> (<commit>)" = 新分支未 stack 进依赖链 (建分支默认独立); 恢复 = but move <branch> --above <栈顶分支名> 后原样重试, 错误信息自带完整依赖清单; 每票开工时若依赖前票文件, 先 stack 再提交 |
| 2026-09-02 | 票14 | quarantine 车道治理: 主 config 只有 firefox 项目带 grepInvert — chromium 主车道实际已在跑全部 @quarantine tag (票01 修复后回归), 治理对象是 firefox 排除面 (基线 2026-09-02: 5 失败/19, chromium 全绿); "挂引用" 要 rg 全部命中含 2 个 config 注释块, 不能只扫 test() 标签 |
| 2026-09-02 | 票14 | CI 每日定时单车道 job: schedule 触发的是整个 workflow 的所有 job, 往已有 test.yml 塞 schedule 会连带每日跑全量三 OS 矩阵 — 新建独立 quarantine.yml (continue-on-error: true + xvfb-run headed) 才是 "只巡逻 quarantine 车道" 的干净做法 |
| 2026-09-02 | 票15 | 纯文档票 (markdown only) 也会被满负载 firefox 车道整批假失败 (37/419, 全集中 firefox-extension, chromium 全绿): `--last-failed` 重跑 36 绿, 残余 hover 时序项单跑 1 绿 (auto-expand 60vs80 抖动) — 完成定义的 "超时项单跑必绿为准" 实操路径 = last-failed 批跑收敛 + 残余 solo 终验, 两轮内可收口; 文档票无需 npm run build (无 dist 契约面) |
| 2026-09-02 | 票12 | conn 图层与 render.js 双向引用 (conn 调 commit/getLargeBox/getSmallBox, render/ntp/settings-ui 调 conn 函数) — 反向用 initConnFacade 注入 render.js 函数 + DOM/log 依赖, 正向走 ESM import, 禁 render↔conn 循环 import (live-binding 可跑但违反分层) |
| 2026-09-02 | 票12 | 状态整迁边界先做符号 census 定谳: 三调度状态 (__linePool/__connRefreshRAF/__dsuDirty) 只被 conn 函数读写 → 干净模块私有整迁; 数据 Map (connLines/connById/groupStar) 仍被 render.js mutationHandlers + ntp.js 临时连线胶水直读 → 留 state.js (票06 singleton), 状态整迁约束只及三调度状态不及数据 Map |
| 2026-09-02 | 票12 | 多非连续块 verbatim 搬移的 splice 索引陷阱: 替换 header/import 块行数必须与原行数严格一致, 否则后续固定索引 splice 全错位 (render.js 写成 double import 报 Unexpected reserved word); 修复 = 每个 splice 前断言边界行 + 行数平价 |
| 2026-09-02 | 票13 | popup 拆分定边界先看"谁被画布变换热路径调用": repositionAllPopups 被 onBoxDragMove/pan/wheel 调用 → tracker 三件套 (add/remove/reposition) 整体留 render.js, 只搬 renderBookmarks/edit/add + drag 四函数; popups → render 反向依赖 (getLargeBox/renderInnerSurface/showBoxDeletedWarning + add/removePopupTracker) 走 initPopupsFacade 注入, 正向 render `import { renderBookmarks }` 消费, 禁循环 import — 与票12 conn 同款门面 |
| 2026-09-02 | 票13 | 搬移后源文件残留"注入但已不用"的 facade 变量无害不拆: render.js 的 debugWarn/debugSampled 搬走后仅剩声明+赋值 0 读取, 但 initRenderFacade 注入面是稳定契约, 删变量要连带改 ntp.js 注入调用 — 拆分类票纪律"只搬列名函数", 残留注入变量留原地不动, 不追偿 |
| 2026-09-03 | 票13 | "page.goto 卡 domcontentloaded + URL 停 about:blank + 零 console" 判别先看 commit 是否 fired: DEBUG=pw:api 实测 `browserType.launch succeeded +22s` — Firefox 有头启动本身吃 ~22s 耗尽 30s 默认预算, 卡在启动/导航 commit 阶段而非页面内容; 判别硬证据 = pw:api 时间线 (launch 时长 + commit 是否 fired) + A/B 裸 goto (无任何 test stub) 同签名偶发卡死 + atomcode 多源 (playwright#12182/#21179/#31050 Windows 有头冷启动脆弱)。test 脚本仅放大 (无 retries、fullyParallel、冷启动立即 goto), 根因是本机内存/资源限制。修复 = 该 spec `test.setTimeout(120_000)` 提预算, firefox 车道 4/4 绿 × 4 轮含冷启动轮。教训: 判断 test-vs-environment 必须用 log 定位 (launch 时长/commit 事件), 不许按现象幻觉推理 |