# Decision Ledger — Wave10 2026.10.11 Grill

> 对象: 本波 6 项议题（Pages-发行套牢 / boxing.xxx91n.com 自定义域名 / 标题全选无法退出 / 字号设置覆盖面 / 书签图标重进闪现 / 设置-关于页+i18n）
> 规则: 每条含 ID / 原问题 / 用户原回答原文 / 规范化需求 / 显式约束·负向需求 / 状态(current|revised|stale|deferred)
> 日期: 2026-10-04（Round-1 定稿）· Round-2 追加议题 2026-10-05 · grill 中不修源码；一次一问；结论必须落盘；任何 compact/handoff 前先确认账本最新

## 覆盖自评（随轮更新）

- 议题调研: 6/6 完成（见下方事实底稿）· atomcode 深调一次（Q1，信源 11 条）
- 议题 1（Pages 套牢）机制已定: A（env tag-policy 修复）
- 议题 2（域名）已定: A（本波绑定，DNS 前置）
- 议题 3（标题选区）已定: A（两段式契约+focus 状态机）
- 议题 4（字号范围）已定: C（全局文本等比+小字下限+与缩放正交）
- 议题 5（图标闪显）已定: A（Phase-1：免门+decode+热池+状态类；Phase-2 像素缓存留作后续独立票）
- 议题 6（About 页）已定: A（六项+License/版权行）
- 未覆盖: 无——6/6 议题均有 current 决策
- Round-2（2026-10-05 追加 3 bug + 遗留项）: bug1 连接线跨盒泄漏已定（D-007）；bug2 暗色已定（D-008）；bug3 demo 右键已定（D-009）；范围/发版已定（D-010）；审计补丁已定（D-011：归因写死+§6措辞校准+测试门）
- 已确认决策: **11**（D-001..D-011）
- 定稿: Round-1 **是**（2026-10-04）；Round-2 **是**（2026-10-05 用户指令进入整理文档环节，视为定稿）

## 事实底稿（调研所得，非用户决策；供提问引用）

- F1 Pages 链: demo-deploy.yml 已有 release:[published]+workflow_dispatch 双触发；release 由用户账号发布（author=Xxx91n），事件确实点火（run 35702698416）；deploy job 全在 ~4s 内 0-step 失败；main dispatch 成功（35704498181）。根因: github-pages environment 自定义放行 5 条全是 type=branch（gh-pages/main/refs/tags/v*/v*/v2026.9.20），branch 型条目对 tag ref 永不匹配 → tag 上下文部署被秒拒。deploy 尾部已带 pages-gc-verify --mode=deploy-tail（≤180s version.json 新鲜度）。
- F2 域名: Pages API cname=null·html_url=https://xxx91n.github.io/boxing/·build_type=workflow·https_enforced=true。自定义域名生效后站点根变为 boxing.xxx91n.com（/boxing 前缀消失）→ /demo/、/privacy-policy.html。硬编码点: scripts/pages-gc-verify.mjs DEFAULT_BASE_URL、build-demo.mjs canonical、CONTEXT.md、ADR-0017、CHANGELOG×3、demo/README×2；商店侧隐私 URL 需用户在 CWS/AMO 后台更新。DNS 侧需用户在 Spaceship 加 boxing CNAME→xxx91n.github.io。
- F3 标题 bug: selectAllTitleText（render.js:65-71）focus+selectNodeContents；三处 mousedown（507/765/920）每次按压都 preventDefault()+selectAll → 任何再点击都无法落 caret；标题有 user-select:text 豁免（base.css:362-366），全局 onKeyDown 不碰方向键。修法方向: 已聚焦时放行默认 caret 行为。
- F4 字号: --font-size-base 仅被 body 一条消费（base.css:36）；base/settings/onboarding/conn/design-system/popup.css 共 ~70 条硬编码 px + JS 内联 ~15 处（popups/render/settings-ui）→ 滑块只影响无显式字号元素。
- F5 图标闪现: bm-row__favicon 初始 display:none、onload 才显示（popups.js:80-88）；loadFavicon 缓存命中也仅同步写远程 CDN URL → 仍需取流+解码 → 每次 renderBookmarks 重建即闪。缓存层: session Map + localStorage（v1，TTL 7d/90d）+ single-flight + SWR。
- F6 About: settings nav 现 4 tab（general/appearance/data/sync）+lastSettingsTab 持久化+.modal__version 已动态读 manifest.version_name。新增 about tab 需: nav item+tab-about+i18n 键（14 locale+I18N_FALLBACK，BX-I18N-001/002/005 构建期强制）+品牌图标（icons/icon_128.png）+链接（仓库/issues/pulls/privacy——privacy URL 随域名决策）。

## 决策表

| ID | 原问题 | 用户原回答 | 规范化需求 | 显式约束/负向需求 | 状态 |
|---|---|---|---|---|---|

| D-001 | Q1 发行→Pages 套牢机制（A 修 env tag-policy / B orchestrator-dispatch / C 双保险） | 采纳A | **最小修复落地**：用 `gh api` 给 `github-pages` environment 新增 `{"name":"v*","type":"tag"}` 部署放行策略，并清理 3 条 branch 型死条目（`refs/tags/v*`、`v*`、`v2026.9.20`）；保留 `main`、`gh-pages` 两条 branch 条目。`release:[published]` 直连链保持不变——Release 由用户本人发布后，demo-deploy 自动在 tag ref 下部署，deploy 尾部 `pages-gc-verify --mode=deploy-tail` 新鲜度断言不动。workflow 文件零改动 | 负向：不引入 orchestrator/dispatch 编排（B/C 不做）；不触碰 environment 其他保护项；若未来改用 build.yml `make_release`/GITHUB_TOKEN 发版，须另立决策（届时 release 触发被抑制）；实施阶段才执行 gh api 写操作（grill 不动仓库设置）；分支型 `v*` 误配条目清除以绝误导 | current |

| D-002 | Q2 boxing.xxx91n.com 绑定决策与时序（A 本波绑定 / B 代码备好延后切换 / C 不绑） | A | **本波绑定自定义域名**：①agent 侧——`build-demo.mjs` 在 Pages artifact 根写入 `CNAME`（内容 `boxing.xxx91n.com`）；全仓 URL 迁移到新域站点根（`pages-gc-verify.mjs` DEFAULT_BASE_URL → `https://boxing.xxx91n.com`、build-demo canonical、CONTEXT.md privacy URL、ADR-0017 G-C URL 表、CHANGELOG×3、demo/README）；About 页隐私链接走单源常量。②用户侧（不可代办）——Spaceship DNS 加 `boxing` CNAME→`xxx91n.github.io.`；推荐另加 GitHub 账户级域名验证 TXT；商店后台隐私 URL 下次提交更新。**时序硬约束**：DNS 生效前置 → CNAME 随后续 deploy 落地；旧 github.io URL 由 GitHub 301 到新域，过渡期不断 | 负向：不在 DNS 就绪前部署含 CNAME 的 artifact（会立即 301 到未解析域 = 自断）；不绑 apex/www 其它名（仅 boxing 子域）；不把隐私 URL 散写进 locales/多文件（必须单源）；不改动 https_enforced（保持 true） | current |

| D-003 | Q3 标题选区交互模型（A 两段式+focus 状态机 / B tldraw 终态 caret / C 永远全选仅修键盘） | 采纳 | **保留 BX-TITLE-SEL 首次全选契约，实现改为业界标准状态机**：`mousedown` 仅 `stopPropagation()`（不再 preventDefault、不再全选）；`focus` 时若本聚焦周期未全选过→selectAll+置 per-focus 标志位；已聚焦点击放行原生 caret；`blur` 复位标志位。方向键/局部拖选/双击选词/Shift+点选全部回归浏览器原生。三处标题统一修（render.js:507 大盒标题、:765 内层面包屑、:920 小盒标题，共用 selectAllTitleText 单入口）。实现必须带 mouseup 归一化防护（标志位+首次 mouseup re-assert/preventDefault）防首点全选被 Chrome/Firefox 吞掉。补 e2e：二次点击落 caret/方向键折叠/局部拖选/Esc 恢复/Enter 提交 | 负向：不改 Esc/Enter/paste 纯文本契约（SEC-03 保留）；不引入双击/F2 新心智；不改 user-select:none 容器+text 豁免的 CSS 结构（BX-SEL-01）；不放弃 stopPropagation（画布拖选防冲突）；不拆散共享实现为三份 | current |

| D-004 | Q4 字号设置作用范围（A 全局 / B 仅画布内容+改名 / C 全局+小字下限）+ 用户附加约束“字号缩放≠UI缩放” | 我倾向C，而且不要把字体的缩放跟UI的缩放搞混淆了 →（调研印证后）采纳 | **C 定稿**：①范围=全局文本（画布内容+chrome UI 文本），引入 `--fs-*` 派生阶梯，全部 `calc(var(--font-size-base) × 比例)` 锚定（不用 rem——:root 是浏览器 16px 基准非我锚；不用 em 级联 font-size，em 仅允许 padding/行高等随本元素字号联动属性）；②≤11px 装饰小字（角标/计数/grip 等）用 `max(11px, calc(...))` ——不向下缩、可随大档位升（iOS Caption2 同构）；③**正交红线**：Font Size 与画布 zoomLevel 为两套独立旋钮，代码与存储键永不互相写入，文案分名（Font Size vs Zoom）；④JS 内联 font-size（~15 处）全部迁移为 var 消费；⑤token 落 ADR-0008 体系 design-system.css primitive 层 | 负向：不引入 UI 几何缩放（box/padding/icon 尺寸不随字号变）；不用 rem/em 做字号锚；不把画布 transform 缩放与字号挂钩；不改动滑块 11–20 范围与现有存储键名 fontSize；JS 不得再新增硬编码 font-size（设防回归 guard 或评审清单） | current |

| D-005 | Q5 书签图标重进闪显修复范围（A Phase-1 本波 / B Phase-1+2 像素缓存一次到位 / C Phase-1 永久） | 采纳 | **A 定稿——本波落 Phase-1**：①`bm-row__favicon` 不再 `display:none` 等 onload——改为骨架占位保布局（固定尺寸免塌陷），类名区分 `is-loading`/`is-cached` 使“已缓存 vs 加载中”可分辨；②缓存命中路径 `img.decode()` 后再上屏（decode 完原子上屏，消 FOIC），`onerror` 兜底再隐；③模块级会话热池 `Map<host, Image>`，重建行复用 `complete===true` 对象同步赋 src → 同会话重进≈零闪；④跨会话冷启动每图标仍闪一次为已知接受项。**Phase-2（SW 抓像素→dataURI 持久缓存）留作后续独立票**，触发条件=用户判定冷启动闪不可接受 | 负向：本波不动缓存值形态（仍 URL 字符串，不迁 dataURI）；不新增权限/不动 optional_host_permissions 用途；不用 Cache API/IndexedDB；不加 npm 依赖；不动 _favicon/ API（Chrome 专属且未访站点覆盖缺，若用须另立决策含 Firefox 回退）；不引入 lazy loading | current |

| D-006 | Q6 About 页内容清单（A 六项+License/版权行 / B 纯六项 / C 自定义） | 采纳 | **A 定稿**：设置 nav 末尾新增 `about` tab，内容=扩展图标（icons/icon_128.png 与商店同源）、名称+简介（brandName/brandSub i18n 键）、版本（`getManifest().version_name` 回退 version，与 .modal__version 同源）、链接四项=GitHub 仓库 / Issues / PRs / 隐私政策（单源常量→`https://boxing.xxx91n.com/privacy-policy.html`，随 D-002 域名生效）、License/版权一行（`Apache-2.0` + © 年份，License 名不翻译）。外链统一 `api.tabs.create({url, active:true})` 新标签页、不随 urlOpenMode 设置。全部新键落 14 locale + I18N_FALLBACK（BX-I18N-001/002/005 构建期强制） | 负向：不加检查更新按钮（商店托管更新）；不加商店评分入口；不加更新日志/致谢（本波不做，可后补）；不把隐私 URL 散写多文件（单源常量）；外链不得改 NTP 本页导航（不同 sameTab）；不引入双击打开外链的网页惯例（保持扩展 API 模型） | current |

| D-007 | Q1(Round-2) bug1 连接线跨盒泄漏修复契约（A' 公共祖先面域过滤+resolveConnSurface / B 数据层净化 / C 按 surface 分注册表） | 采纳 | **A' 定稿——公共祖先面域过滤**：新建统一 `resolveConnSurface(from,to)` 解两端端点所属容器；连接仅在其公共父容器 surface 打开时渲染（A 盒内小盒连线只在进 A 时画，canvas 级连接照旧）；跨父 small-small 连接公共祖先为 canvas 但小盒端点无画布坐标（分层坐标空间，非 tldraw 单坐标系）→ **不渲染 + console debugWarn**，数据保留不删（业界模型=边属于图，surface 归属为渲染期派生）；归属判定**每帧从 layout 现算**，不缓存（reparent 瞬时改变归属）；同时核验单个小盒删除时其连接随 tombstone 清理的链路。补 e2e：A 盒内连线→进 B 盒断言零线 | 负向：不做持久化数据净化（B 证伪——merge 可逆性会被毁）；不做按 surface 分注册表重构（C 证伪）；不把跨父小盒边画上 canvasConnSvg（调研 A+ 建议不适用——小盒坐标是 inner-local 非全局，画了=幽灵线换个面）；不向 UI 弹警告（用户无过错）；归属结果不写进 conn 数据字段；不动 DSU/commit(op)/tombstone 架构 | current |

| D-008 | Q2(Round-2) bug2 暗色模式修复契约（A' 单点归属+统一apply+三面收敛 / B +settings字段级LWW / C 只修html类泄漏） | 采纳 | **A' 定稿**：①`.ntp--dark` 唯一宿主收敛为 `documentElement`（CSS 前缀改 `:root.ntp--dark`，语义不变；业界模型=主题只挂 root，含根滚动条/初始背景）；②新建 `applyDarkMode(bool)` 单一 helper——内部切 html 类（对称 add/remove）+ 同步重写 boot 镜像 `boxingBootTheme.v1`；③全部调用点收敛到该 helper：boot 校准 / loadSettings / 设置页 toggle / 头部按钮 / `applyExternalLayout` 外部合并后立即重放 / `storage.onChanged` 跨标签广播回调；④toggle 退化为只写 `layout.settings.darkMode` + saveLayout，不再直接摸 DOM；⑤镜像缺失/损坏时 boot 回退 `matchMedia(prefers-color-scheme)` 而非硬编码亮色；⑥settings 合并维持远端全赢 LWW 不变（单布尔字段级 LWW 零增益），LWW 静默丢弃的 UX 缺陷由"合并后立即重放视觉态"消除 | 负向：不引入 system-follow 三态/data-theme 属性迁移（darkMode 保持显式布尔，将来若加跟随系统再另立决策迁 data-theme）；不做 settings 字段级时间戳合并；不改动 ADR-0016 同步分层与 mergeConcurrentLayout 的整体 LWW 语义；boot 脚本仍只做读+应用不做业务逻辑；镜像仍为首帧投影非第二权威源 | current |

| D-009 | Q3(Round-2) bug3 demo 右键失效修复契约（B' demo抑制+Escape双修 / A' 只抑制 / C demo保留导览） | 采纳 | **B' 定稿**：①构建期标记——`build-demo.mjs` 在与 chrome-stub.js 同段注入 `window.__BOXING_DEMO__=true`（保证 ntp.js 执行前就绪，不等 DOMContentLoaded）；②`initOnboarding` 检测 `__BOXING_DEMO__` 即 return（`runtime.id==='boxing-pages-demo'` 作防御兜底条件）；③**file:// 调试道的空画布兜底判断保持不抑制**（故意保留的调试入口）；④onboarding overlay 补 Escape 键关闭——监听仅在浮层打开时挂载、优先级高于画布全局 Escape 语义，对 demo 与真扩展同生效（WCAG 2.1.2 No Keyboard Trap A 级修复）；⑤右键退回功能本身实测正常不修——修的是挡住它的浮层 | 负向：demo 不保留模态导览（违背 demo 惯例：访客目的是试用非学习）；不在本波把导览降级为横幅问号入口（非模态 opt-in 形态留作后续选项）；不改 chrome-stub 的 runtime.id 值（仅作兜底检测条件不依赖其语义）；不用 install-signal 伪造方案（污染 signal 语义）；不改 onContextMenu 本身 | current |

| D-010 | Q4(Round-2) 本波范围裁决（B' 3bug+文档类+badge+9.20notes重写+zip政策 / A 只收3bug / C 全收含f,g） | 采纳 | **B' 定稿——本波范围**：①3 bug 修复（D-007/008/009）；②文档口径类：D-003 spec 旧措辞对齐账本、.scratch 机器绝对路径清扫、release-status §2/§5 错误块修正；③README badge 修为 workflow-backed 动态 badge；④重写 v2026.9.20 Release notes（gh release edit，需用户授权的外部产物动作——GitHub immutable releases 下 notes 可编辑、tag/assets 不动）；⑤zip 政策裁定：归档不入库、`.scratch/**/*.zip`（或等价模式）进 .gitignore，markdown 文档保持跟踪（保护账本防丢机制）；⑥**修完验证通过即发 v2026.10.11**（商店审核期=天然观察窗，calver 日期语义要求不拖）；⑦工程纪律：bugfix 与文档清理分开 commit | 负向：不改已发布 release body 里的历史域 URL（历史记录原则，勘误不删除——keepachangelog 2.0）；不追平 issue 镜像 #16（无机制支撑必再漂移，机制决策转下波）；不把 .scratch 全目录 gitignore（会破坏账本防丢机制——调研该条经修正）；不引入 curl 式 10 天冷静期（规模不适用）；不发版前跳过回归自测 | current |

| D-011 | Q5(Round-2) atomcode 定稿审计补丁条目（A 全部采纳 / B 逐项挑） | 采纳 | **审计补丁全收**：①**归因写死**——bug1=同一 connId 在多面渲染泄漏（removeConn 只 tombstone 该 id，render.js:135-144 无级联实锤）；bug3=onboarding overlay 唯一拦截（conn 线右键删除模式历史已显式移除，conn-layer.js:159 注释为证，无其他 contextmenu 拦截路径）；②**D-008 措辞校准**——storage.onChanged 监听注册留在 storage.js 不搬家（WORKFLOW §6 红线：写链/防回环/onChanged 严禁拆散），回调体内调统一 applyDarkMode；boot-theme.js 是 classic blocking script（index.html:9-11 NOT type=module）无法 import ESM helper → boot 保留自含最小逻辑（读镜像+切 html 类），ntp.js 启动后用 applyDarkMode 校准；③**实施注意**——__linePool 全局池不分池（无状态裸元素，appendChild 换父即可）但复用须清 conn-line--selected 等残留 class；matchMedia 回退只用于显示、禁止写回 layout.settings；__BOXING_DEMO__ 单链注入即足（demo 仅 build-demo.mjs 一条构建链）；④**回归测试矩阵为发版 gate**——约 12 条断言归入 conn-dsu/settings-persist/build-pipeline spec 族：跨盒零线/同盒连线正常/删源头全线灭；暗色 boot暗→切亮→刷新保持/远端合并重放/onChanged 幂等/matchMedia 兜底；demo 无浮层可交互/右键退回/Escape 关闭 overlay/真扩展 install 导览仍弹；双浏览器（Chromium+Firefox）全量过才发 v2026.10.11 | 负向：不分池（line pool 保持全局）；不把 onChanged 监听移出 storage.js；不把 boot-theme.js 转 module；matchMedia 值不得持久化进 settings；不省略测试门直接发版 | current |

<!-- 条目自此追加 -->
