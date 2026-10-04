# Decision Ledger — Wave10 2026.10.11 Grill

> 对象: 本波 6 项议题（Pages-发行套牢 / boxing.xxx91n.com 自定义域名 / 标题全选无法退出 / 字号设置覆盖面 / 书签图标重进闪现 / 设置-关于页+i18n）
> 规则: 每条含 ID / 原问题 / 用户原回答原文 / 规范化需求 / 显式约束·负向需求 / 状态(current|revised|stale|deferred)
> 日期: 2026-10-04 · grill 中不修源码；一次一问；结论必须落盘；任何 compact/handoff 前先确认账本最新

## 覆盖自评（随轮更新）

- 议题调研: 6/6 完成（见下方事实底稿）· atomcode 深调一次（Q1，信源 11 条）
- 议题 1（Pages 套牢）机制已定: A（env tag-policy 修复）
- 议题 2（域名）已定: A（本波绑定，DNS 前置）
- 议题 3（标题选区）已定: A（两段式契约+focus 状态机）
- 议题 4（字号范围）已定: C（全局文本等比+小字下限+与缩放正交）
- 议题 5（图标闪显）已定: A（Phase-1：免门+decode+热池+状态类；Phase-2 像素缓存留作后续独立票）
- 议题 6（About 页）已定: A（六项+License/版权行）
- 未覆盖: 无——6/6 议题均有 current 决策
- 已确认决策: **6**（D-001..D-006）
- 定稿: **是**（2026-10-04 用户指令进入整理文档环节，视为定稿；spec/plan/handoff 已生成）

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

<!-- 条目自此追加 -->
