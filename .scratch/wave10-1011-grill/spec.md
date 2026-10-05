# Wave 2026.10.11 — 实施规格（spec）

> **权威上游**：`decision-ledger.md` D-001..D-006（全 current）。本文件是实施契约的规范化转写；语义冲突时**以账本为准**。
> **配套**：`implementation-plan.md`（P-xx 序列）· `handoffs/next-round.md`。
> **版本假设**：目标 calver `2026.10.11`（账本标题内嵌约定；用户未显式确认，发布前需复核一次）。
> **生成**：2026-10-04 grill 收口整理。

## S-01 Release→Pages 部署修复 — 落实 D-001

**目标**：用户本人发布 Release 后 demo-deploy 自动完成 tag 上下文部署，无需手动 dispatch。

**需求**：
1. `gh api` 对 `github-pages` environment 新增放行策略 `{"name":"v*","type":"tag"}`。
2. 删除三条 branch 型死条目：`refs/tags/v*`、`v*`、`v2026.9.20`；保留 `main`、`gh-pages`。
3. workflow 文件零改动；`release:[published]` 直连链与 deploy 尾部 `pages-gc-verify --mode=deploy-tail`（≤180s version.json 新鲜度断言）保持不动。

**事实锚点**（账本 F1）：根因=environment 自定义放行全部为 branch 型条目、对 tag ref 永不匹配（GitHub 2023-08 安全加固的刻意行为）；user-published release 事件确实点火（run 35702698416，deploy job ~4s 0-step 被拦）；main dispatch 成功（35704498181）。

**负向约束**：不引入 orchestrator/dispatch 编排；不触碰 environment 其他保护项；若未来改用 build.yml `make_release`/GITHUB_TOKEN 发版须另立决策（release 触发将被抑制）；gh api 写操作仅实施阶段执行。

**验证**：environment policy 列表出现 tag 型 `v*` 且三条死条目消失；下个真实 release 部署链自动跑通（P-11 终验）。

---

## S-02 自定义域名 boxing.xxx91n.com — 落实 D-002

**目标**：Pages 站点迁至 `https://boxing.xxx91n.com`（站点根无前缀，`/boxing` 消失）；隐私政策 URL = `https://boxing.xxx91n.com/privacy-policy.html`；demo 在 `/demo/`。

**需求**：
1. **用户侧前置**：Spaceship DNS `boxing` CNAME → `xxx91n.github.io.`；（推荐）另加 GitHub 账户级域名验证 TXT。
2. `.github/scripts/build-demo.mjs` 向 Pages artifact 根写 `CNAME`（内容 `boxing.xxx91n.com`）。
3. 全仓 URL 迁移（账本 F2 清单）：`scripts/pages-gc-verify.mjs` DEFAULT_BASE_URL、build-demo canonical、`CONTEXT.md` privacy URL、`docs/adr/0017` G-C URL 表、`CHANGELOG`×3、`demo/README`×2。
4. **单源机制**：站点/隐私 URL 建单源——构建侧共享常量（build-demo 与 pages-gc-verify 共用）+ 运行侧 ntp 常量（供 S-06 消费）；两处由构建期一致性检查钉死，禁止散写。
5. `https_enforced` 保持 true 不动。

**时序硬约束**：DNS 生效是 CNAME 部署的前置——含 CNAME 的 artifact 不得在 DNS 就绪前 deploy（否则全站 301 到未解析域=自断）。代码可先合入；CNAME 实际生效点是下一个 release deploy（P-11），届时 DNS 必须已通。旧 `xxx91n.github.io/boxing/...` 由 GitHub 301 过渡，不断链。

**负向约束**：不绑 apex/www 其它名；不把隐私 URL 散写进 locales 或多文件。

---

## S-03 标题选区状态机 — 落实 D-003

**契约**：保留 BX-TITLE-SEL「首次激活全选」；修复「已聚焦后无法再落 caret / 方向键失效 / 局部选择失效」。

**状态机**（业界标准，focus 驱动）：
- `mousedown`：仅 `stopPropagation()`——不再 `preventDefault()`、不再调用全选。
- `focus`：本聚焦周期未全选过 → 全选 + 置 per-focus 标志位。
- 已聚焦时点击：放行原生默认（caret 落点击位）。
- `blur`：复位标志位。
- mouseup 归一化防护：标志位 + 首次 mouseup re-assert/preventDefault，防 Chrome/Firefox 归一化吞掉首次全选。
- 方向键 / 局部拖选 / 双击选词 / Shift+点选 = 浏览器原生行为。

**改动面**：三处统一走共享实现——render.js:507（大盒标题）、:765（内层面包屑 crumb）、:920（小盒标题）；`selectAllTitleText`（render.js:65-71）单入口不拆。

**负向约束**：Esc 恢复 / Enter 提交 / paste 纯文本（SEC-03）契约不动；不引入「双击进入编辑」/F2 等**新编辑心智**（措辞校准，D-010①：双击**选词**属回归浏览器原生放行，是要的行为，与「双击进入编辑心智」是两件事，旧措辞把二者混为一谈）；`user-select:none` 容器 + contenteditable `text` 豁免 CSS 结构不动（BX-SEL-01）；不放弃 stopPropagation（画布拖选防冲突）。

**验证（新增 e2e）**：二次点击落 caret；方向键折叠选区；局部拖选；双击选词；Esc 恢复；Enter 提交；首点全选不被吞（Chromium 必测，Firefox 语义对齐）。

---

## S-04 全局字号阶梯 — 落实 D-004

**目标**：Font Size 滑块（范围 11–20、存储键 `fontSize` 均不变）驱动**全局文本**等比缩放——画布内容 + chrome/settings UI 文本。

**需求**：
1. 派生阶梯 `--fs-*`，全部 `calc(var(--font-size-base) × 比例)` 锚定——不用 rem（:root 是浏览器 16px 基准非我锚）；不用 em 级联 font-size（em 仅允许 padding/行高等「随本元素字号联动」属性）。
2. ≤11px 装饰小字（角标/计数/grip 等）用 `max(11px, calc(...))`——不向下缩、可随大档位升（iOS Caption2 同构）。
3. **正交红线**：Font Size 与画布 zoomLevel 两套旋钮，代码与存储键永不互写；UI 文案分名（Font Size vs Zoom）。
4. 迁移面：~70 条硬编码 CSS `font-size`（6 个源 css 文件）+ ~15 处 JS 内联 font-size（popups/render/settings-ui），全部改为阶梯/var 消费。
5. token 落 ADR-0008 体系 `design-system.css` primitive 层。
6. 防回归：新增硬编码 JS font-size 的 guard 或评审清单项。

**负向约束**：不做 UI 几何缩放（box/padding/icon 尺寸不随字号变）；不改滑块 11–20 范围与 `fontSize` 键名；不把画布 transform 缩放与字号挂钩。

**验证**：滑块全 UI 生效目测 + 新增 e2e（档位变化断言）+ guard 通过。

---

## S-05 书签图标 Phase-1 — 落实 D-005

**目标**：同会话重进盒内图标≈零闪；「已缓存 vs 加载中」视觉可分辨。

**需求**：
1. `bm-row__favicon` 去掉 `display:none` 等 onload——改固定尺寸骨架占位（防布局塌陷），`is-loading` / `is-cached` 状态类区分来源。
2. 缓存命中路径 `img.decode()` 后原子上屏（消 FOIC）；`onerror` 兜底再隐。
3. 模块级会话热池 `Map<host, Image>`；重建行复用 `complete===true` 对象同步赋 src → 同会话重进≈零闪。
4. 已知接受项：跨会话冷启动每图标仍闪一次。

**改动面**：`ntp/popups.js`（bm-row 创建点 :80-88 一带）、`ntp/favicon.js`（热池/decode）、行级 CSS。

**负向约束**：缓存值仍 URL 字符串（不迁 dataURI）；不新增权限、不动 optional_host_permissions；不用 Cache API/IndexedDB；不加 npm 依赖；不动 `_favicon/` API；不引入 lazy loading。

**范围外**：Phase-2 像素缓存（SW 抓像素→dataURI 持久化）为后续独立票，触发条件=用户判定冷启动闪不可接受。

---

## S-06 设置 About 页 — 落实 D-006

**结构**：settings nav 末尾新增 `about` tab（general/appearance/data/sync 之后），遵守 `lastSettingsTab` 持久化惯例。

**内容清单（A 定稿）**：
1. 扩展图标 `icons/icon_128.png`（与商店图标同源）；
2. 名称+简介——`brandName`/`brandSub` 既有 i18n 键；
3. 版本——`getManifest().version_name`，回退 `version`（与 `.modal__version` 页脚同源）；
4. 外链四项：GitHub 仓库 `https://github.com/Xxx91n/boxing`、Issues `/issues`、PRs `/pulls`、隐私政策（S-02 单源常量 → `https://boxing.xxx91n.com/privacy-policy.html`）；
5. License/版权一行：`Apache-2.0` + © 年份（License 名不翻译）。

**行为**：外链统一 `api.tabs.create({url, active:true})` 新标签页——不随 `urlOpenMode` 设置、不改 NTP 本页导航。

**i18n**：全部新键落 14 locale + `I18N_FALLBACK`（BX-I18N-001/002/005 构建期强制；data-i18n* 键须真实存在 BX-I18N-006）。

**负向约束**：不加检查更新按钮 / 商店评分入口 / 更新日志 / 致谢（本波不做，可后补）。

---

## X. 范围外汇总（账本负向约束 → 不做清单）

| 项 | 来源 | 理由/出路 |
|---|---|---|
| orchestrator/dispatch 编排（B/C） | D-001 | 用户选 A；若启用 CI 发版另立决策 |
| tldraw 终态 caret / 永远全选 | D-003 | 契约=首次全选保留 |
| rem/em 字号锚、UI 几何缩放 | D-004 | 正交红线 + 锚定纪律 |
| Phase-2 像素缓存、`_favicon/`、Cache API/IndexedDB、新权限、npm 依赖 | D-005 | 后续独立票/另立决策 |
| 检查更新、评分入口、changelog、致谢 | D-006 | 本波不做，可后补 |

## Y. ADR 候选（domain-modeling 三判据预判，随代码落地时写）

- **域名绑定**（S-02）：难逆转（301/商店元数据/单源迁移）+ 有真实取舍 → 新 ADR。
- **全局字号阶梯+正交红线**（S-04）：~85 处迁移、token 层决策、max() 下限反直觉 → 新 ADR。
- S-01 的 env tag-policy 坑记发布 runbook 即可（ADR-0017 G-C 已覆盖新鲜度决策）；S-03/S-05/S-06 不新立 ADR（可逆/常规）。

---

# Round-2（2026-10-05 追加议题：三新 bug + 遗留项收口）

> 上游权威：`decision-ledger.md` D-007..D-011（全 current）。Round-1（S-01..S-06）已实施落地（49 commit 至 origin/main），本节起为本波第二轮修复契约。语义冲突时以账本为准。

## S-07 bug1 连接线跨盒泄漏 — 落实 D-007 + D-011①

**目标**：A 盒内两个小盒的连接只在 A 盒内页渲染；其他盒的内页/画布不出现投影线；删除该连接后各处不再出现。

**归因（写死）**：同一 connId 的连接在每个打开的 inner surface 都被 `connSvgForConn` 选中——只判断"两端都是 inner"不判断父盒归属；坐标从 layout 数据解算与 DOM 无关 → 每个内页同位置投影。`removeConn`（render.js:135-144）只 tombstone 该 connId 无级联 → "删源头全灭"=同一 connId 的全部投影消失。

**需求**：
1. 新建统一 `resolveConnSurface(from, to)`：解析两端端点所属容器（分层键取父盒 id）；连接只在其公共父容器 surface 当前打开时渲染。
2. inner-inner 连接：`parentLargeId(from)===parentLargeId(to)===currentLargeBoxId` 才画入 innerConnSvg，否则不渲染。
3. canvas 级（大盒间）连接照旧画 canvasConnSvg；`large ↔ small` 混合端点按公共祖先语义处理（小盒端点无画布坐标→不渲染）。
4. 跨父 small-small 连接（UI 不可创建，仅 merge/import 可产）：不渲染 + console debugWarn（非 UI 警告——用户无过错）；**数据保留不删**（merge 可逆性：日后合并/移回后连接自然变合法）。
5. 归属判定每帧从 layout 现算，不缓存（reparent 瞬时改变归属）。
6. 核验既有链路：单个小盒删除时其连接随 tombstone 清理（若未覆盖须补）。
7. `__linePool` 保持全局不分池（无状态裸元素 appendChild 换父即可），复用前清 `conn-line--selected` 等残留 class。

**验证**：e2e——A 盒内连线→进 B 盒断言零线→回 A 盒线在；删线后回 A 无残留；注入跨父 conn fixture 后各面均不画且 console 有 debugWarn。

**负向约束**：不做持久化数据净化；不做按 surface 分注册表重构；不把跨父小盒边画上 canvasConnSvg（分层坐标下无意义——调研 A+ 建议不适用）；不向 UI 弹警告；归属不写进 conn 数据字段；不动 DSU/commit(op)/tombstone 架构。

---

## S-08 bug2 暗色模式收敛 — 落实 D-008 + D-011②③

**归因（写死）**：①`.ntp--dark` 三写入点非对称——boot-theme.js 加在 `documentElement`（只加不删），toggle/loadSettings 只切 `#app`+`body` → boot 暗进场的会话祖先类永驻压暗，"无法切日光、新建标签页可解"；②`applyExternalLayout` incomingWins 时 settings 远端全赢且不重放视觉态/不重写镜像 → "会话内正常、刷新失效"。

**需求**：
1. `.ntp--dark` 唯一宿主=`documentElement`；CSS 前缀 `.ntp--dark X`→`:root.ntp--dark X`（语义不变）；移除 `#app`/`body` 挂点。
2. 新建 `applyDarkMode(bool)` 单一 helper：切 html 类（对称 add/remove）+ 同步重写 boot 镜像 `boxingBootTheme.v1`。
3. 调用点收敛：loadSettings / 设置页 toggle / 头部按钮 / `applyExternalLayout` 合并后立即重放 / `storage.onChanged` 回调体内调用。
4. **WORKFLOW §6 红线**：`onChanged` 监听注册留在 storage.js 不搬家——回调体内调 helper（监听不拆散到多模块）。
5. **boot 豁免条款**：boot-theme.js 是 classic blocking script（index.html:9-11 明注 NOT type=module）无法 import ESM helper → boot 保留自含最小逻辑（读镜像+切 html 类），ntp.js 启动后用 `applyDarkMode` 校准。
6. toggle 退化为只写 `layout.settings.darkMode`+saveLayout，DOM 一律由 apply 路径渲染。
7. 镜像缺失/损坏时 boot 回退 `matchMedia('(prefers-color-scheme: dark)')`；**回退值只用于显示，禁止写回 settings**。
8. settings 合并维持远端全赢 LWW 不动（ADR-0016 分层不动）。

**验证**：boot暗→切亮→页内即亮→刷新保持；远端合并 darkMode=false 到达→会话内立即变亮；镜像与 settings 恒一致；onChanged 空/部分触发幂等（Firefox）。

**负向约束**：不引入 system-follow 三态/data-theme 属性迁移（darkMode 保持显式布尔，将来加跟随系统另立决策）；不做 settings 字段级 LWW；不动 mergeConcurrentLayout 整体语义；不把 boot-theme.js 转 module；镜像仍为首帧投影非第二权威源。

---

## S-09 bug3 demo 右键失效 — 落实 D-009 + D-011③

**归因（写死）**：右键退回功能本身正常（线上 demo Playwright 实测：建盒→进盒→右键→exitToCanvas 全链路通）。唯一拦截=onboarding overlay：`initOnboarding` 在 demo 无 install signal（reason=null）→ 落 file:// 兜底判断（`!onboardingCompleted && boxes===0`）→ aria-modal 浮层拦截全页指针事件（实测 intercepts pointer events）→ 建不了盒/进不了盒/右键因 `currentLargeBoxId=null` 静默 no-op。conn 线右键删除模式历史已显式移除（conn-layer.js:159），无其他 contextmenu 拦截路径。

**需求**：
1. `build-demo.mjs` 在与 chrome-stub.js 同段注入 `window.__BOXING_DEMO__=true`（ntp.js 执行前就绪，不等 DOMContentLoaded；demo 仅此一条构建链，单点注入即足）。
2. `initOnboarding` 检测 `__BOXING_DEMO__`（`runtime.id==='boxing-pages-demo'` 作防御兜底）→ return；**file:// 道不抑制**（调试入口保留）。
3. overlay 补 Escape 键关闭：监听仅在浮层打开时挂载、优先级高于画布全局 Escape（取消选择语义）；对 demo 与真扩展同生效（WCAG 2.1.2 No Keyboard Trap，A 级）。
4. `onContextMenu`/`onKeyDown` 主体不动。

**验证**：demo build 产物含标记；首访 demo 无浮层可直接建盒/进盒/右键退回；真扩展 install 导览仍弹且 Escape 可关；file:// 空画布导览仍弹。

**负向约束**：demo 不保留模态导览（违背 demo 惯例）；不做横幅问号入口（非模态 opt-in 留作后续选项）；不改 chrome-stub 的 runtime.id；不用 install-signal 伪造方案。

---

## S-10 范围项 — 落实 D-010

**本波收**：
1. 文档口径三项：spec §S-03 旧措辞对齐账本语义（"双击选词=回归原生放行（要）"≠"双击进入编辑心智=不引入"）；`.scratch` 文档机器绝对路径清扫；release-status §2/§5 错误块修正。
2. README badge → workflow-backed 动态 badge（或删坏 badge——daily.dev 惯例：留坏 badge 不如删）。
3. 重写 v2026.9.20 Release notes（`gh release edit`——外部产物改写，需用户授权后执行；GitHub immutable releases 下 notes 可编辑、tag/assets 不动）。
4. zip 政策：`.scratch/**/*.zip` 进 .gitignore；markdown 文档保持跟踪（保护账本防丢机制）。
5. 工程纪律：bugfix 与文档清理分开 commit。

**转下波/不做**：f=已发布 release body 内历史域 URL 不改写（历史记录原则，keepachangelog 2.0）；g=issue 镜像追平（无机制支撑必再漂移，先定单向镜像/放弃镜像的机制决策）。

---

## S-11 测试门与发版 — 落实 D-011④ + D-010⑥

**回归测试矩阵（发版 gate，断言归入现有 spec 族）**：
- conn-dsu 族：跨盒零线 / 同盒连线正常 / 删源头全线灭 / 跨父 conn 隐藏+console debugWarn
- settings-persist 族：boot暗→切亮→刷新保持亮 / 远端合并重放（会话内即见覆盖）/ onChanged 幂等 / 镜像缺失时 matchMedia 兜底
- build-pipeline 族：demo 产物含 `__BOXING_DEMO__` / demo 首访无浮层可交互（建盒→进盒→右键退回）/ Escape 关闭 overlay / 真扩展 install 导览仍弹

**发版 gate**：Chromium + Firefox 双项目全量过（沿用 workers=4 本地教训）→ 用户发 tag `v2026.10.11`。

---

## X-追加. Round-2 范围外汇总（账本负向约束 → 不做清单）

| 项 | 来源 | 理由/出路 |
|---|---|---|
| 跨父小盒边画 canvasConnSvg（调研 A+ 建议） | D-007 | 分层坐标空间下小盒端点无画布坐标，画了=幽灵线换面复现 |
| 持久化数据净化（B）/ 按 surface 分注册表（C） | D-007 | merge 可逆性会被毁 / 渲染细节固化进数据模型 |
| system-follow 三态 / data-theme 迁移 / settings 字段级 LWW | D-008 | 显式布尔够用零增益；将来加跟随系统另立决策 |
| demo 保留模态导览 / 横幅问号入口 | D-009 | 违背 demo 惯例；非模态 opt-in 形态留后续选项 |
| 已发布 release body 历史域 URL 改写（f）/ issue 镜像追平（g） | D-010 | 历史记录原则（勘误不删除）/ 无机制支撑必再漂移 |
| line pool 按 surface 分池 / boot-theme 转 module / onChanged 监听搬家 | D-011 | 无状态池不需分池 / classic blocking script 是故意形态 / WORKFLOW §6 红线 |
| `.scratch` 全目录 gitignore / curl 式 10 天冷静期 | D-011 / D-010 | 破坏账本防丢机制（只 zip 不入库）/ 规模不适用 |
