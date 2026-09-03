# Research Report — Round 3 · 票 16 心智模型深度调研

- 日期: 2026-09-03
- 票: 16 mental-model deep research (Blocked by: None; 状态 ready-for-agent)
- 方法: 单次串行 atomcode 调研（verbatim 提示词照发，WORKFLOW §4.3，无并行调用）；收工落盘按 prompts/16 与 handoffs/16。
- 只读票: 零源码改动（源码/manifest/测试均未触碰）；本文件为唯一新增产物。

## 1. 现有心智模型（外部调研前记录 — 必读清单摘录）

先读全 10 份必读文件（prompts/16、handoffs/16、issues/16、spec.md、WORKFLOW.md、round3-architecture-report.md、docs/CONTEXT.md、CONTEXT.md、ADR-0007、ADR-0010、ADR-0016）后记录：

1. **实现形态**: 零构建原生 ES modules。ntp/index.html 直接加载 ES module（ntp.js 入口 ~994 行编排 → render/state/storage/persist/i18n/utils/favicon + credentials/sync-engine/settings-ui/onboarding + conn-layer/popups）。round3 证据快照: render 1613 行 / conn-layer 788 / popups 433；15 个源 JS 全过 node --check；模块图无环。
2. **组合根与注入**: ntp.js 为入口编排；跨作用域依赖走 initXxxFacade(deps) 一次性注入（conn-layer/i18n/credentials/sync-engine/settings-ui/onboarding 全用此模式）；正向走 ESM import、反向经 facade 注入，禁循环 import（票 12/13 教训）。
3. **数据层**: ADR-0007 — commit(op) 统一变更入口（tldraw Store 模式）+ 模块化 handler；layout.groups 计算化不落盘；boxById O(1) 索引；DSU dirty 标记；空间哈希阈值 32（GDevelop）；tombstone 24h GC。ADR-0016 — sync 四层: port(storage.js 唯一写门面) / envelope(credentials.js PBKDF2+AES-GCM) / engine(sync-engine.js WebDAV+Gist+outbox) / presentation(settings-ui/onboarding)；outbox 字段级合并 + LWW 回落妥协已显式记录。
4. **状态**: state.js 单例 + ESM live-binding；storage 写链/防回环/onChanged 单一体严禁拆散（WORKFLOW 教训）；storage.local（A6 迁移）。
5. **治理载体**: 16 篇 ADR + docs/CONTEXT.md 领域词汇 + 根 CONTEXT.md 构建语言 + AGENTS.md 规则（SEC/CRX/BX 系列）+ CSS 双写约定 + E2E（test/tests/boxing-*.spec.ts）作为行为契约 + WORKFLOW §6 教训回放。
6. **已知滞后**（round3 报告 gap 1）: AGENTS.md 模块地图、ADR-0007、ADR-0010、docs/CONTEXT.md、DESIGN.md、根 CONTEXT.md 仍描述 round-2 前布局；根 CONTEXT.md Accent Theme 段有编码损伤（"ull"/"ccentHue" 字符丢失，属票 17 范围，本票只记录）。

小结: 现有心智模型 = "不变量驱动拆分 + 组合根门面注入 + 单写变更入口 + 派生结构不落盘 + storage 门面唯一化"。外部调研回答的问题是：这套模型离 2026 工业共识多远、还缺什么。

## 2. 对比矩阵（9 个心智模型 × 7 维度）— atomcode

图例: ★ = web_fetch 全文一手；◐ = 搜索片段级；local = 直接读码。

| 心智模型 | 边界切割依据 | 状态与跨上下文同步 | 平台 API 访问纪律 | 依赖方向机制 | 零构建/无依赖契合 | Chrome+Firefox MV3 契合 | 落地成本+工具化 |
|---|---|---|---|---|---|---|---|
| **A. MV3 上下文即边界（官方）** ★Chrome docs | 平台上下文（SW/popup/newtab/content） | storage.local/sync/session 唯一真源；onChanged=pub/sub；SW 内禁止全局变量 | SW 无 DOM/XHR/localStorage；listener 顶层同步注册 | 无显式规则（文档级建议"把代码移出 SW"） | 高（页面可原生 ESM） | 高（Chrome 官方语义；FF 事件页差异另计） | 低——规则在文档里，靠人守 |
| **B. 薄后台中继 + 纯逻辑内核** ★DHSea ★GH#203947 | 运行时能力（relay vs pure） | background 零持久状态；状态全在 storage；跨上下文消息=事件 | background=relay，逻辑在纯模块（无 DOM、时钟注入） | 纯模块不碰 browser API → 隐含单向 | **极高**——无 bundler 时 AMO 跳过源码提交门 | 高（relay 写法让 SW/事件页差异无感；双键 manifest） | 中——纯模块纪律靠自测（Node 单测）背书 |
| **C. FSD 层单向依赖** ★feature-sliced.design | 抽象层（app/pages/widgets/features/entities/shared） | model 段内聚 store；不规定 | 段内（api/model/ui/lib/config） | **严格单向向下 + 同层禁依赖（linter 强制执行）** | 中高（框架无关，但通常配 TS/打包） | 中（与扩展上下文无直接关系） | **高**——有官方 linter/CLI，7 层对单人小项目过重 |
| **D. Feature-sliced 域切片 + 门面** ★GH#203947 ◐wxt | 业务域（feature 目录）+ shared/ | storage 单模块集中、避免散键 | messaging wrapper 取代裸 sendMessage；storage 集中 | feature 目录 + shared 复用；SW 保持轻 | 中（结构可无 bundler 照搬） | 高（针对 MV3 多上下文总结） | 中——目录约定即可，无强制工具 |
| **E. 存储驱动 UI + Dispatcher（Bonjourr）** ★TECHNICAL.md | 功能域（clock/weather/背景…） | storage.sync 为源；feature(init?,update?) 双相位；updateFeature 读-改-写+eventDebounce | 设置 UI 永不直接动 feature DOM，只走 feature() 入口 | 目录分层（features/shared/utils/services）+ 文件命名 | 极高——纯 TS+CSS 无框架（Deno 构建仅为打包/多浏览器） | 高（Chrome/FF/Edge/Safari 多端） | 低——模板本身即轻量治理 |
| **F. 无构建原生 ESM** ★DHSea ★josef.dev ★web.dev ◐esmodules.com | 加载机制（页面 vs SW） | 页面 script type=module；SW 需 type:"module"（Chrome 91+）；**SW 只支持静态 import、不支持 import map** | CSP script-src 'self' → 一切本地；远程代码（含 CDN import map）被禁 | 文件即模块边界；扩展名必须写全 | **极高（本模型即零构建）** | 高（Chrome 91+/FF 108+ 页面 ESM 全支持；FF 无 SW 键兼容见下） | 低——但要手管多文件加载与浏览器差异 |
| **G. 统一变更入口/派生不持久化** ◐（本地 ADR-0007 引用 tldraw/React Flow/GDevelop） | 数据流（单写入口） | commit(op)+副作用注册；派生结构（groups/索引/DSU）不落盘 | 无 | handler 只改数据，副作用集中 | 高（纯 JS 可搬） | 中（编辑器领域心智，非扩展特有） | 中——需要先立"派生清单"不变量 |
| **H. 微状态/信号订阅** ◐nanostores HN | 数据粒度（原子 store） | atom+subscribe/computed；vanilla 可用 | 无 | 原子即边界 | 高（265B 级） | 中 | 低——但多一个依赖（违反 CRX-R-009 需特批） |
| **I. 打包框架治理（wxt/Plasmo 对照项）** ◐wxt compare/kanopylabs | entrypoint 目录（每上下文独立 bundle） | 框架约定 + 各自 messaging 封装 | 框架生成 manifest/自动路由 | 框架强约束目录 | **低**（核心就是 bundler） | 高（自动双浏览器产物） | 中——但与零构建路线冲突，仅作对照 |

## 3. 关键分点结论（关键结论均 ≥2 独立信源）— atomcode

1. **MV3 的"SW 易失性"把存储提升为架构主轴**（Chrome 官方迁移文档 + extension.js + dev.to MV3 + slhck 多源）：SW 空闲 ~30s 即终止、不得依赖全局变量、状态必须走 storage；newtab 页 + SW 都应把 storage 当"数据库 + 事件总线"双层用。
2. **Firefox 无扩展 service worker，"双键 background"是跨浏览器事实标准**（DHSea 一手 + MDN + extension.js 三方一致）：FF 忽略 background.service_worker 读 scripts 数组跑事件页；2026 新增硬约束——AMO 要求数据收集声明键（Nov 2025 起），strict_min_version 有叠加地板（双键 121、数据声明 140）。Boxing manifest 已精确采用双键模式（strict_min 112 + 数据声明键的组合待复核，见 G6）。
3. **无 bundler 是被低估的治理红利而非裸奔**（DHSea + josef.dev + extension.js + web.dev）：代码即交付 → 自动跳过 AMO 源码提交审核门；SW 要 import 必须 type:"module"（Chrome 91+，静态 import only，import map 在 SW 不可用）；扩展 CSP 'self' 把 CDN import map 方案直接判死（chrome RHC 文档 + latchkey + SO 三源）。**Boxing 的"零构建 + script-src 'self'"是主动且合规的架构决策，不是缺工具。**
4. **"纯逻辑内核 + 薄后台"让测试与跨端移植同时变便宜**（DHSea + GH#203947）：逻辑模块无 DOM、时钟作参数 → 同一份代码跑 Node 测试/SW/事件页；与 Boxing 现状同构。
5. **治理模板两极：FSD 全量 vs Bonjourr 轻量**（FSD 官方 + dev.to 批评面 + Bonjourr TECHNICAL.md）：FSD 有官方 linter 但 7 层对单人小项目过重；Bonjourr（业界最大 vanilla 新标签页开源项目）实证 per-feature init/update dispatcher + 声明式设置接线 + storage 门面。**对单人 vanilla 项目，Bonjourr 模板 ROI 显著高于 FSD 全量；双方在"设置/存储必须走门面"上收敛。**
6. **跨上下文消息必须封装，但页面内聚型扩展的消息面可以极小**（GH#203947 + wxt#643 + webext-bridge/WXT docs + 本地读码）：Boxing 消息面已被有意压到最小（boxing-auto-backup-trigger + 安装信号键，sendToBackground 双适配）——消息治理需求应由"跨上下文功能数量"驱动，而非先验添加。

## 4. Boxing 适配判断（atomcode 直接读码 × §1 本地记录交叉）

### 4.1 现状盘点

| 维度 | Boxing 现状 | 对齐的业界模板 |
|---|---|---|
| 无框架/零构建 ESM | index.html 单 module 入口；CSP script-src 'self'；6055 行 IIFE → 994 行编排 + 11 ESM | F + B |
| 模块图 | state/utils/i18n/favicon=纯叶；storage.js=唯一写门面（census: ntp/ 下 0 直写）；persist=持久化+主题；render=渲染主内聚；credentials/sync-engine/settings-ui/onboarding=ADR-0016 四层 | D + C 轻量版 + E services 分层 |
| 状态 | state.js 单例 + live-binding，写全走 set*()（92 导出） | H 思想同构（手工 atom） |
| 变更入口 | commit(op) 统一入口+副作用注册；groups 计算化不落盘；DSU/tombstone/空间网格=派生结构（ADR-0007） | G（且落地早于大多数工业项目） |
| 跨作用域依赖 | init*Facade(deps) 一次性注入，TDZ 归零 | B 的依赖注入变体 |
| 跨浏览器 | manifest 双键 background、gecko id、data_collection none；dev 双树 | B/F 官方建议形态 |
| 测试 | Playwright 扩展车道 + file:// mock 车道；419 全绿；window.__boxing* 契约保留 | B 的 Node 单测被双车道 E2E 替代，更强 |

结论（atomcode 原文）：**Boxing 与矩阵中 A/B/D/E/F/G 五类模型高度匹配；它已经是"按不变量拆分 + 门面化 + 单写入口"的工业主流子集，不需要更换心智模型，只需要补齐治理闭环。**

### 4.2 还缺什么（缺口分级，按性价比）— atomcode G1-G6

| # | 缺口 | 对标 | 为什么缺（本地证据） | 建议（保持零构建/无依赖） |
|---|---|---|---|---|
| G1 | **依赖方向没有机器守卫** | FSD linter | 规则散在 ADR-0007/0016 注释与约定里；只有恢复期一次性 tools/callgraph-scan.mjs，非 CI 常驻 | 把现有 Node ESM 冒烟扩展成 **import-graph 断言 spec**（ntp/*.js 禁 import background.js；storage.js 不被 utils/i18n/favicon 反向依赖；settings-ui 只许经门面白名单 import storage 导出），挂进 npm test。FSD 五条规则只取两条，~1 天 |
| G2 | **background 与 NTP 的共享纯逻辑无显式策略** | B（纯模块双端可跑） | background.js 是 classic script，与页面两套上下文；mergeLayoutFields/LWW/isSafeExtUrl 等只活在页面侧 | 落一条 ADR：未来 SW 需复用领域逻辑 → 选项① 拆 shared-core/ 纯函数目录 + importScripts 守卫；选项② background 升 type:module（Chrome 91+）但 FF 走 scripts 数组需两份入口。先记录决策，别现在改 |
| G3 | **消息面"恰好最小"未被记录成决策** | D（messaging wrapper） | sendToBackground 双适配已存在；alarms 双保险（页面建 alarm + SW 回送 + setInterval fallback）已在码内 | 不需要 wrapper 代码；落一条 ADR 记录"消息面=storage.onChanged + boxing-auto-backup-trigger + 安装信号，三类即全部，新增前需评审"，防裸 sendMessage 蔓延 |
| G4 | **导出面过大（state 92 exports）无分面** | H/nanostores | 写路径靠 set*() 命名 + ESM 只读绑定强制——约定有效但命名级 | 不建议拆 state.js（破坏 live-binding 整体性与 419 测试）；若未来出现多 UI 各自订阅子状态，再引入手写 ~30 行 subscribe/computed，届时才评估是否破 CRX-R-009 |
| G5 | **缺"新模块落位检查表"** | E（Bonjourr 约定固化） | 规则表已全，但"新 feature 往哪放、谁可 import 谁"仍需人脑查 ADR | 把 G1 断言 + 10 行"模块落位决策树"写进 docs/DESIGN.md 或 ADR-0016 附录，让新代码默认动作是查表 |
| G6 | **manifest 版本地板与 AMO 2026 新规对齐未复核** | B 的 Currency 部分 | strict_min_version 112 但 manifest 已含 data_collection_permissions；DHSea 报 FF<140 会报 KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION | 若 AMO 发布以该键为准，评估升 121（双键生效）/140（lint 零警告）；若想保 112-120 用户，需用 addons-linter 实测"低地板+数据声明键"是否被容忍（本票只读未跑） |

## 5. 最终推荐（单一结论）

**最优组合 = 保持"零构建 ESM 页面内核 + storage 门面 + commit(op) + 薄后台"主干不动，把治理从注释/ADR 提升为"三层切片 FSD 语法 + 两条机器守卫 + 决策记录"。**

- **保留（内核不动）**: storage-as-truth（A）、薄后台/纯逻辑（B）、dispatcher 思想（E，init*Facade 已超越）、零构建 ESM（F）、commit(op)（G）。
- **补齐（按性价比）**: G1 import-graph 断言（机器守卫，最小可行）→ G2/G3 两条决策 ADR（防漂移）→ G5 模块落位决策树。
- **治理语法（FSD 的 1/3 切片，非全量）**: 层序 shared-leaf（state/utils/i18n/favicon）→ facade（storage/persist）→ feature（render/conn-layer/popups/settings/sync/onboarding/credentials）→ entry（ntp.js）；规则=只许向下一层 import、门面只许经白名单导出被消费。**不做** slices/segments 物理目录改造（现有文件已是切片）、**不做**公共 barrel（会破坏 file:// mock 车道与 verbatim 移植零 diff——Boxing 用导出计数断言替代 barrel 是合理的）。
- **明确不引入（防回潮）**: bundler/wxt/Plasmo（CRX-R-011 与零构建红利冲突）、import maps/CDN（CSP 'self' + RHC 禁令下无意义）、TypeScript/框架（CRX-R-009/010）、nanostores 等依赖（除非 G4 触发）。

**最小下一步**（回应 issues/16 "recommends the smallest next step"）: 把现有 Node ESM 冒烟（storage 恰 12 导出 / state 92 导出）扩展成 **import-graph 断言 spec 并挂进 npm test**——FSD 两条规则（单向向下 + 门面白名单）的最小机械化子集，~1 天，零新依赖。可作为票 17（documentation consistency sync, blocked by 16）的伴生项或后续小票。

## 6. 来源清单（atomcode；★=web_fetch 全读，◐=片段级）

| # | 标题/来源 | URL | 角度 | 日期 |
|---|---|---|---|---|
| ★1 | My first Firefox add-on was a manifest change（DHSea） | dev.to/dhseadev/my-first-firefox-add-on-was-a-manifest-change-1k00 | Community+Currency | 2026-08-30 |
| ★2 | GitHub Community Discussion #203947: MV3 大型扩展结构最佳实践 | github.com/orgs/community/discussions/203947 | Community | 2026-08-04 |
| ★3 | Chrome for Developers: Migrate to a service worker | developer.chrome.com/docs/extensions/develop/migrate/to-service-workers | Official | 2023 页 |
| ★4 | Bonjourr docs/TECHNICAL.md | github.com/victrme/Bonjourr | Official(项目)+Community | 近期 |
| ★5 | Feature-Sliced Design Overview | feature-sliced.design/docs/get-started/overview | Official | — |
| ★6 | Extension.js docs: Manifest V3 | extension.js.org/docs/concepts/manifest-v3 | Official(工具)+Criticism | — |
| ★7 | Using ES Modules in your Browser Extension's SW（josef.dev） | josef.dev/posts/using-es-modules-in-your-browser-extensions-service-worker | Community | 2022-06-15 |
| ★8 | web.dev: ES modules in service workers | web.dev/articles/es-modules-in-sw | Official | 2021（仍权威） |
| ★9 | Chrome: Override Chrome pages | developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages | Official | — |
| ★10 | Show HN: Flowtide | news.ycombinator.com/item?id=42237258 | Community | 2024-11-25 |
| ◐11 | chrome.storage API 参考 | developer.chrome.com | Official | 2026-05 |
| ◐12 | MDN: Build a cross-browser extension | developer.mozilla.org | Official | 2026-08 |
| ◐13 | esmodules.com: Import Maps / Browser support | esmodules.com/import-maps | Official+Currency | 2026-07/08 |
| ◐14 | web-features explorer: import maps | web-platform-dx.github.io | Official | — |
| ◐15 | Chrome: Deal with remote hosted code | developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code | Official | — |
| ◐16 | Latchkey: MV3 CSP rejects 'unsafe-eval' | latchkey.dev | Criticism | 2026-06 |
| ◐17 | Stack Overflow（import map × 扩展 CSP 三源之一，行未完整取回，仅片段） | — | Criticism | — |
| ◐18 | dev.to: MV3 engineering/isolated contexts（arbabyousaf） | dev.to/arbabyousaf | Community | 2026-08 |
| ◐19 | nanostores GitHub + HN tiny signals + pkgpulse 2026 | github.com/nanostores/nanostores 等 | Community+Comparative | 2024-2026 |
| ◐20 | FSD Review（dev.to algoorgoal）/ codecentric FSD | dev.to/algoorgoal 等 | Criticism+Comparative | 2024 |
| ◐21 | dev.to notearthian: Local vs Sync vs Session | dev.to/notearthian | Comparative | 2025-12 |
| ◐22 | wxt compare / kanopylabs wxt-vs-plasmo-vs-extension-js | wxt.dev/guide/resources/compare 等 | Comparative | 2025-2026 |
| ◐23 | WXT messaging / webext-bridge / wxt#643 | wxt.dev/guide/essentials/messaging、npm webext-bridge | Official+Community | 2024-2025 |
| ◐24 | startpagehq: 9 Best New Tab Extensions 2026 | startpagehq | Community | 2026 |

**本地代码证据**（atomcode 直接读码，非网络源）: manifest.json（双键 background/gecko/权限集）、ntp/index.html（CSP+单 module 入口）、ntp/ntp.js 头部 import 图与编排注释、ntp/state.js 与 storage.js 导出面、docs/adr/0007 与 0016、docs/architecture-recovery-summary-2026-09.md（6055→994+11 ESM、门面 census、注入模式）、AGENTS.md（CRX-R-*）、background.js + sync-engine.js（alarms 双监听与消息回送）、test/ 双车道配置、docs/DESIGN.md 与 docs/adr/0008（三层 token）。

**Sufficiency Gate**（atomcode 自报）: searches 25（Exa 9 / Tavily 8 / AnySearch 8，2 次 Exa 429 重试后成功 1 空结果）| angles: Official/Comparative/Criticism/Currency/Community 全五类 | full reads: 10 次 web_fetch（另 +1 次 tavily_extract 级片段核验）覆盖 9 个独立域名 | 关键结论双源已验证。

## 7. 信息缺口（诚实声明，atomcode §6）

1. tldraw/React Flow/Excalidraw/GDevelop 官方一手文档未在本次抓取——G 模型行业参照来自 Boxing ADR-0007 本地引用 + 二手文；若写进对外文档建议补抓 tldraw store/binding 官方页。
2. WXT/Plasmo 仅 snippet 级（compare 页/kanopylabs/reddit），未全读目录约定文档——与零构建路线正交，仅作对照，结论不受影响。
3. chrome.alarms 在"扩展页面上下文"的官方可用性页未抓——Boxing sync-engine 页面侧 onAlarm + setInterval fallback + background 镜像监听是双保险设计；若要在 ADR 断言"页面可用 alarms"需先核官方参考页。
4. Firefox strict_min_version 与 data_collection_permissions 的 lint 交叉行为：DHSea 报 140 为干净地板，但 Boxing 112 + 该键组合未实测（可用 npx addons-linter 本地验证，本票只读未跑）。
5. TC39 signals 提案 2026 状态未做权威核验（矩阵 H 行仅 nanostores/HN/pkgpulse 佐证）——因建议"不引入依赖"，该缺口不影响主结论。
6. 本窗口补充: 来源清单 ◐17 一行在报告撰写时未从索引完整取回（仅知其为结论 3 中"RHC + latchkey + SO"三源的 SO 片段级来源），已如实标注，不影响结论双源性。

## 8. 完成定义对照（handoffs/16）

- [x] 报告落盘于 D:/Aworker/crx/boxing/.scratch/architecture-recovery/research-report-round3.md（本文件）。
- [x] 含对比矩阵（§2）、缺口清单（§4.2）、唯一最终推荐 + 来源（§5/§6）。
- [x] 零源码改动；无并行 atomcode 调用（全程单次串行）。
- [x] 现有心智模型先于外部调研记录（§1，回应 issues/16 复选框 1）。
- [x] 版本控制遵循 WORKFLOW §4.2（GitButler，独立票分支，不 push）。
