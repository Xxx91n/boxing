# Research Report Round 5 — Ticket 23: 心智模型深度调研

- 生成: 2026-09-04
- 票: `.scratch/architecture-recovery/issues/23-mental-model-deep-research.md` (ready-for-agent, blockers: None)
- 窗口: Boxing architecture-recovery 子窗口 (票 23)
- 纪律: 只读票 — 本轮未改源码 / manifest / 测试 / 产品 README; 全程仅一次串行 atomcode 调研 (无并行); 版本控制遵循 WORKFLOW §4.2 (GitButler 独立分支, 不 push)。
- 调研证据: atomcode 单次 (12 次引擎搜索: Exa×5 + Tavily×4 + AnySearch×5; 5 角度 Official/Comparative/Criticism/Currency/Community; 11 次 web_fetch 原文 + 1 次本地 AGENTS.md 契约), 16 条来源见 §6。

## 1. 本地现状基线 (先记录, 后对比 — 本票 delta 要求)

### 1.1 当前 README 信息架构 (README.md 本轮实测)

| # | 块 | 现状 |
|---|---|---|
| 1 | 语言条 (顶部) | `README-I18N:START` 标记块, 1 行: English 加粗 + 13 个翻译链接 |
| 2 | 定位 | H1 + 一句描述 + 引语段, 含 "Think Obsidian canvas meets bookmarks" 锚句 |
| 3 | 截图 1 | HTML `<picture>` (screenshot-1-canvas.png, 1280 宽, 明暗双源) + `> [!NOTE] Replace this placeholder...` 占位 |
| 4 | TOC | 7 锚点: Features / Install / Usage / Privacy / Development / Contributing / License |
| 5 | Features | 6 段加粗导语: Infinite Canvas / Two-Level Hierarchy / Bookmark Management / Connectivity / Design & Theme / 14 Languages |
| 6 | 截图 2 | 同款 `<picture>` (screenshot-2-boxes.png) + 同款占位 NOTE |
| 7 | Install | Chrome/Edge 5 步 + Firefox 4 步 + "end users don't need Node.js" TIP |
| 8 | Usage | 10 条操作 bullet |
| 9 | Privacy | 5 条 bullet + docs/privacy-policy.md 链接 |
| 10 | Development | Prerequisites / Setup / Build 命令 + CONTRIBUTING 链接 + 完整 Quarantined tests 叙述 + 19 行治理表 (2026-09-02 基线: chromium 19/19, firefox 14/19) + expiry rule |
| 11 | Contributing / License | 各一句 + Apache-2.0 |
| 12 | 语言条 (页脚) | `README-I18N:END:FOOTER` 标记块: 13 个链接原样重复 + TRANSLATIONS.md 链接 |

实测缺口: 0 个 Markdown 图片嵌入 (截图全为 HTML `<picture>`); 2 处截图占位未替换; 语言条顶/脚两处重复; 无 demo GIF; 治理表嵌在 Development 内无独立 TOC 锚点。

### 1.2 当前本地测试进程模型 (playwright.config.ts + package.json + scripts/test-surface.mjs 实测)

- 入口 `npm test` = pretest (`scripts/import-graph-guard.mjs` 机检) → `playwright test --config=test/playwright.config.ts`。
- 进程内 worker 上限: 本地 4 / CI 2 (显式 policy, 票 20; 8 线程主机默认全核 = 8 个 headed 浏览器饿死, 票 01 证据)。
- `fullyParallel: true`, `headless: false`, retries CI 2 / 本地 0。
- 双车道 projects: `chromium-extension` (--load-extension=repo root; `--allow-file-access-from-files` 保 file:// mock 车道) 与 `firefox-extension` (grepInvert `/@quarantine/`, `-no-remote`)。
- Changed-surface 选择器 `npm run test:changed` = `scripts/test-surface.mjs`: 文件级 spec-cluster 映射 (消费 `test/cluster-map.json`), 保守回退全量 (test/ 与 .github/ 与 package(.lock) 变更、mapping 缺失/损坏、未映射叶子、闭包 ≥ minimumFullSuiteSpecs 一律全量), 支持 TEST_SURFACE_DRY_RUN=1 与参数透传。**非默认验证路径。**
- Quarantine 车道 `npm run test:quarantine` (独立 config + grep @quarantine); `test:failed` = `--last-failed`。
- **无跨进程互斥**: 第二个代理窗口并发跑 `npm test` 可无阻碍启动; 多窗口 × 4 workers × headed 浏览器可超订主机。

### 1.3 当前依赖边界模型

- 14 个原生 ES 模块: ntp.js (entry, 994 行, 只做编排) → render / state / storage / persist / i18n / utils / favicon / credentials / sync-engine / settings-ui / onboarding / conn-layer / popups。
- 机检门禁: `scripts/import-graph-guard.mjs` (规则 B-1..B-8, pretest); 实测 48 边、0 循环、0 barrel、0 background import (round5-architecture-report 证据快照)。
- 分层: ADR-0016 四层 (port = storage.js 写门面唯一持久化通道; envelope = credentials.js; engine = sync-engine.js; presentation = settings-ui.js + onboarding.js)。feature 级兄弟 import 现为约定接受 — 票 26 待机检白名单固化或 ADR-0016 errata。
- 零运行时依赖; devDependencies 仅 web-ext / @playwright/test / crx3; SW 侧非 layout 小键 (bgErrLog, boxingInstallSignal) 为已记录例外。

## 2. 外部证据对比矩阵 (atomcode 调研; 来源见 §6)

### 矩阵 A: 无限画布产品定位 (光谱: 工具 → 平台 → 知识组织)

| 项 | 核心定位 | 形态 | 许可证/成本 | 关键批评 |
|---|---|---|---|---|
| Excalidraw | 绘图工具 | React 组件库 | MIT (Excalidraw+ 商业层) | 绘图为主、知识组织弱; npm 包强制依赖 react/react-dom |
| tldraw | 画布引擎/SDK | React SDK + @tldraw/sync | 非纯 MIT: 生产商用需 license key | 商用授权费; 与零依赖冲突 |
| Miro | 团队协作工作流平台 | SaaS | 商用 | 视觉过载、简单场景贵 |
| Obsidian Canvas | 知识组织层 (卡片-引用-连接) | 核心插件, .canvas 开放 JSON | 免费 | 无协作; ≥40-50 个嵌入卡片大画布卡顿 (论坛 2026 仍多帖); 2026 报告卡 3.5/5 |
| FigJam / Freeform | 协作白板 / Apple 生态 | SaaS / 原生 | 商用 | 参照项 |

**判定**: Boxing 的"层级书签画布"落在知识组织层一极; Obsidian Canvas 心智模型 (卡片-引用-连接 + 开放 JSON) 是最近定位锚; 其性能批评恰好反证本仓既有 DOM+SVG 路线与性能红线 (BX-PERF 系列, ADR-0013) 是差异化资产。

### 矩阵 B: README 信息架构

| 模型 | 结构 | 受众分层 | 关键原则 |
|---|---|---|---|
| makeareadme (GitHub 社区规范) | Name→Description→Badges→Visuals→Installation→Usage→Support→Roadmap→Contributing→Authors→License→Status | 单层 | "太长好过太短"; 太长 → 外链文档而非删内容 |
| archbee / Utrecht 指南 | 摘要→Quick Start→choose-your-path (Users/Developers/Contributors) | 三层 | 定义术语、copy-paste 命令、License 必备 |
| tldraw / Excalidraw 实战 | 一句话定位→视觉高亮→Quick Start→采用者名录 (social proof)→社区→License | 单层 + 强视觉 | "Who's using" 是强信号 |
| Boxing 现状 | 三层分离: human README / agent AGENTS.md / history docs; README 承载治理表与 i18n | 三层 (含 AI 代理层) | 结构漂移有机检/CI 守卫 |

### 矩阵 C: 本地测试进程治理

| 模型 | 进程治理要点 | 与本仓相关的陷阱 |
|---|---|---|
| Playwright 官方 (扩展) | launchPersistentContext + --disable-extensions-except + 动态取 extensionId; headless 需 channel | MV3 SW 30s 空闲挂起: 同一 Worker 句柄跨重启存活, in-flight evaluate 抛 "Service worker restarted" |
| Chrome 官方 E2E 指南 | 断言基于用户可见行为; 内部状态走 worker.evaluate | 不对 SW 内存变量断言 |
| 社区实践 (TestDino 等) | mock 单测 + Playwright 集成 + 跨浏览器矩阵 + CI | 经 chrome.storage 断言状态而非 SW 全局; onboarding 页抢焦点 (waitForEvent('page')) |
| Mozilla 阵营 | web-ext 启动 + WebDriver 调试端口 | Playwright 原生不支持 Firefox add-on (CDP 不通用) — 本仓 firefox 车道以 persistent context 加载扩展并保持 -no-remote |
| Boxing 现状 | persistent context 双车道 + worker 上限 4/2 + import-graph pretest + changed-surface 选择器 | **缺跨进程互斥** |

### 矩阵 D: 依赖边界心智模型 (MV3 硬约束)

| 边界 | 约束 (官方) | 心智模型 | 零依赖含义 |
|---|---|---|---|
| Service worker | 无 DOM; 30s 连续 / 5min 异步窗口 (w3c#1014: 超限静默截断、无错误信号); setTimeout 随 SW 终止消失 | SW = 事件处理器, 非常驻进程; 状态进 storage | 长任务/状态走 storage + 事件驱动 (connect/onDisconnect); 不用内存定时器 |
| 存储分层 | local 10MB (unlimitedStorage 可扩) / sync 100KB 总 · 8KB/项 · 512 项 · 120 写/min / session 10MB | 写门面唯一通道: 大对象 local、设置级 sync、临时 session | 布局走 local + 防抖 (本仓 SEC-08 已符合) |
| CSP/远程代码 | MV3 禁 eval 与 remotely hosted code | 一切代码进包 | 零依赖天然满足 CSP, 免审核负担 |
| 内容脚本世界 | 隔离世界, API 面最小 | 最小消息面 | 纯 ESM 模块边界即可, 无需消息框架 |
| ESM 支持 | SW 官方支持 "type":"module"; Chrome 148+ 支持标准 browser.* | 跨浏览器 polyfill 需求消退 | 零依赖 + 原生 ESM 于 2026 完全成立 |
| 零依赖 vs 打包 | HN 反方论点 (依赖树网络往返) 对网站成立、对扩展不成立 (整包进 zip) | 小型扩展 bundler = overkill | Indie Hackers 实证: 零依赖扩展 24h 内过审 |

## 3. 缺口清单 (missing pieces)

**调研自认缺口 (置信边界)**:
1. 内容脚本侧原生 ESM 支持矩阵无官方原文 — 不影响本仓 (无内容脚本)。
2. 调研对本仓模块边界的核验基于 AGENTS.md 契约级 — 本窗口已对 13 项本地必读完成实测, 已缓解。
3. Firefox MV3 background 差异 (保留 background page 模型) 与 Playwright Firefox 车道坑位未深挖 — 归票 27 (quarantine 收敛) 证据范围。
4. 零依赖审核加分证据为单源 (Indie Hackers)。
5. tldraw license 细节为摘要级 — 本仓已排除 tldraw 嵌入, 不相关。

**本地 → 外部差距 (票 24-27 待办锚点)**:
6. README 视觉未完成: 2 处 `<picture>` + 2 处占位 NOTE → 票 24 用 docs/store-assets/screenshots/ 实拍 PNG (5 张) 替换。
7. 语言条顶/脚重复 → 票 24 只留顶部 (spec.md 决策)。
8. 无 demo GIF/视频 (tldraw/excalidraw 实战显示强视觉是惯例) → 票 24 可选项。
9. quarantine 治理表无独立 TOC 锚点 → 票 24 立独立小节 (票 27 收口时同步更新该表)。
10. 测试跨进程互斥缺失 → 票 25 (见 §5.3)。
11. `test:changed` 非默认验证路径 → 票 25 标准化。
12. feature 级兄弟 import 无机检白名单 → 票 26。
13. Firefox quarantine 残余 5 失败 (14/19) → 票 27。

## 4. 排除: 属于过度设计的心智模型 (对零依赖原生 ESM 扩展)

| # | 排除模型 | 理由 (证据) |
|---|---|---|
| 1 | React/JSX + bundler 管线 (Vite/Webpack/Rollup) | 违反零依赖; MV3 CSP 已禁远程代码, bundle 只剩审核负担 (40KB+ 框架代码拖慢审核, Indie Hackers); 社区共识小型扩展 bundler 是 overkill |
| 2 | 内嵌 tldraw / @excalidraw/excalidraw 作画布 | 两者皆 React SDK, 与零依赖硬冲突; tldraw 商用需 license key; 本场景是卡片-引用关系而非绘图 |
| 3 | CRDT 实时协作 (Yjs/Automerge) + WebSocket 同步服务 | 单用户书签域无多人需求; storage.local + WebDAV/Gist 已覆盖跨设备; MV3 SW 生命周期使长连接成本极高 |
| 4 | WebGPU/WASM 渲染引擎 | 卡片+连接场景 2D canvas/DOM 官方优化清单 (分层/预渲染/脏矩形/整数坐标/rAF) 完全够用; Obsidian 卡顿源于 DOM 卡片渲染而非缺 GPU |
| 5 | 微前端 / module federation / monorepo 多包 | 单扩展单页面, 原生 ESM 模块边界已是正确抽象; monorepo 只增加进程治理复杂度 (round5 报告 non-goals) |
| 6 | 状态机库 (XState) / Redux / DI 容器 | 原生 store + 事件 + 写门面足够; 额外抽象层加大 MV3 调试难度 |
| 7 | 为内容脚本 ESM 专门引入构建 | 本仓无内容脚本; SW 侧官方已支持 ESM |
| 8 | 远程配置/CDN 热更新/远程托管库 | MV3 政策明文禁止 |
| 9 | 测试侧: 分布式 sharding、coverage 选择、引入新测试 runner | spec.md 明文 non-goals; test-surface.mjs 保守回退模型已覆盖 changed-surface 需求; 当前规模 (33 spec, <200 盒子) 下属负性过剩 |

## 5. 最终推荐 (唯一)

**最小工业心智模型 = 「Obsidian Canvas 式知识组织层 (产品定位) × makeareadme 单骨架三层文档 (README IA) × Playwright persistent context + 进程内 worker 上限 + 跨进程文件锁互斥 (测试治理) × MV3 原生 ESM + 写门面分层 (依赖边界)」** — 四层全部是本仓已实现约九成的工业成熟模型; 增量改动收敛于 README IA 清理与零依赖 mutex wrapper, 均不做架构重写。

### 5.1 产品定位
采用"知识组织层": 画布是书签关系的可视化, 不是绘图工具。差异化 = 书签域整合 (新标签页画布 + 两级盒嵌套 + 连线分组) + 本地优先 + 零依赖 (审核友好)。现有 README 锚句 "Think Obsidian canvas meets bookmarks" 获外部证据直接验证 — 保留并升格为一句话定位句。

### 5.2 README 信息架构 (供票 24 执行)
按 makeareadme 单骨架, 吸收 tldraw/excalidraw 强视觉实践:
1. 顶部语言条保留 (`README-I18N:START` 块), **删除页脚重复块** (TRANSLATIONS.md 链接并入顶部条末尾或 Contributing)。
2. 节序: 一句话定位 → 实拍截图 (替换两处占位; 5 张 PNG 取 2-3 张; 可保留 `<picture>` 明暗适配但必须移除占位 NOTE) → Features (保留 6 段加粗导语) → Install → Usage → Privacy → Development → **Quarantine 治理表独立小节** (TOC 增锚点) → Contributing → License。
3. "太长好过太短": 不为压缩而删内容; 超长治理细节外链 docs/agents 或治理票。
4. 保持三层文档分离 (human README / AGENTS.md / docs/history) — 先于外部模型的既有前沿实践。
5. 可选增强 (不阻塞收口): CI badge; 后续用户量可信时加 Who's-using 社会证明节。

### 5.3 本地测试进程治理 (供票 25 执行)
定型为「单实例上限 (跨进程) → worker 上限 (进程内) → changed-surface (范围)」三层治理:
1. **跨进程互斥**: 零依赖 Node wrapper (如 scripts/test-mutex.mjs) 挂在 npm test / test:changed 入口: 用 `fs.mkdirSync(lockDir)` 抢锁 (全平台原子, 优于 open 'wx'), 锁内写 PID+时间戳; stale 锁判定 (持锁 PID 存活探测 + 超时覆盖); 第二进程遇锁立即失败退出 (报错指明持锁者), 不排队等待; 进程退出 finally 释放锁目录。CI (`process.env.CI`) 跳过 — GitHub runner 天然单 job。
2. **进程内 worker 上限**: 保持本地 4 / CI 2 显式 policy 不变 (外部证据支持 "explicit policy, not ad hoc flag" 路线)。
3. **changed-surface 成默认**: `test:changed` (test-surface.mjs) 成为默认本地验证命令; wrapper 组合 mutex + 选择器 (test-surface 已有保守全量回退, 小闭包跑小、大变更跑全); `npm test` 全量保留给收口/发布前终验。test-surface.mjs 选择逻辑不动 (spec.md 决策: wrapper 只加进程级协调)。
4. **断言纪律** (吸收外部证据为守则, 不新增机制): 状态断言走用户可见行为 + chrome.storage, 不依赖 SW 内存变量 (MV3 SW 30s 挂起使 in-flight evaluate 可能抛 "Service worker restarted"); onboarding 类 spec 注意页焦点抢占 (waitForEvent('page'))。
5. **mutex 验收**: 按 spec.md — 门禁测试观察 "第一进程持锁期间第二并发进程不能启动"。

### 5.4 依赖边界 (供票 26 执行 + 现状确认)
维持 MV3 原生 ESM + 写门面分层 (外部证据: 零依赖 + 原生 ESM 于 2026 完全成立; SW ESM 官方支持; browser.* 统一在望):
1. 保留 14 模块、import-graph-guard (B-1..B-8) pretest 门禁、ADR-0016 四层、storage 写门面唯一通道 — 与工业模型正确形态一致, 不重构。
2. 票 26 选**机检白名单** (而非 ADR-0016 errata): 把现存 feature 级兄弟边登记进 guard 白名单表 — 与守卫既有 B 规则机检路线一致。
3. 不引入任何新运行时依赖; 不做 browser.* 统一迁移 (无现实痛点, Chrome 148 适配仍在推进, 待 Firefox 车道有实际需要再评估)。

## 6. 来源清单 (atomcode, 16 条)

| # | 来源 | 类型 | 贡献 |
|---|---|---|---|
| 1 | developer.chrome.com — Content scripts | Official | 隔离世界、API 面、CSP、注入方式 |
| 2 | developer.chrome.com — Improve extension security | Official | SW type:module、MV3 CSP、禁 remotely hosted code (过度设计判定依据) |
| 3 | developer.chrome.com — chrome.storage | Official | local 10MB / sync 100KB·8KB·512 项 / session 10MB 配额 |
| 4 | web.dev — Canvas performance | Official | 零依赖优化清单: 预渲染/批量/分层/脏矩形/整数坐标/rAF |
| 5 | MDN — Build a cross-browser extension (2026-08-25 更新) | Official | Chrome 148+ browser.*; Firefox 保留 background page 差异 |
| 6 | playwright.dev — Chrome extensions | Official | persistent context fixture、extensionId 动态获取、SW 挂起句柄存活语义 |
| 7 | w3c/webextensions #1014 (2026-05) | Official/Criticism | MV3 SW 30s/5min 限制、静默截断无错误信号 — 进程治理核心证据 |
| 8 | makeareadme.com | Community | README 节结构、"太长好过太短"、License 必备 |
| 9 | github.com/tldraw/tldraw README | Official/Comparative | 定位、采用者名录、商用 license key (非纯 MIT) |
| 10 | github.com/excalidraw/excalidraw README | Official/Comparative | MIT、绘图定位、npm 强制依赖 react |
| 11 | 本地 AGENTS.md (D:/Aworker/crx/boxing) | 一手项目约束 | 零构建 ESM 管线、SEC 系列、storage 门面、Playwright 治理、i18n 14 语言 |
| 12 | Startupik — tldraw vs Excalidraw vs Miro (2026-07) | Comparative | 三产品定位矩阵 |
| 13 | practicalpkm — 2026 Obsidian Report Card (2026-03) | Criticism/Currency | Canvas 3.5/5 |
| 14 | Obsidian Forum — Canvas is very laggy (2026-01) | Criticism/Community | 大画布卡顿、CPU 占用实证 |
| 15 | Indie Hackers — zero-dependency extension | Community | 零依赖 24h 过审、React bundle 拖慢审核 |
| 16 | HN — ES Modules Are Terrible (2021) | Criticism/Community | 反方论点及其边界: 依赖树论证只对网站成立 |

置信声明: 核心结论 (MV3 ESM / SW 生命周期 / 存储配额 / Playwright 官方路线 / 零依赖正当性) 为双源以上交叉验证; 产品定位光谱与 Obsidian 性能批评为社区多源但摘要级; 自认缺口见 §3。

## 7. 下游票执行指针 (一句话)

- **票 24 (README)**: 按 §5.2 执行; 验收 = 0 占位 + 0 语言条重复 + 治理表有 TOC 锚点; 验证走路径解析/链接检查/`git diff --check` (spec.md)。
- **票 25 (mutex)**: 按 §5.3 执行; 验收 = 第二并发进程持锁期间不能启动 (spec.md 门禁); test-surface 选择逻辑不动。
- **票 26 (白名单)**: 按 §5.4.2 执行; 验收 = guard 在当前图绿 + 故意禁边上红。
- **票 27 (quarantine)**: 按既有 repair-or-retire 规则; 收口时同步更新 README 治理表基线行。
