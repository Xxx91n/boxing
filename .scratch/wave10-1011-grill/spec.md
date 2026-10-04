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

**负向约束**：Esc 恢复 / Enter 提交 / paste 纯文本（SEC-03）契约不动；不引入双击/F2 新心智；`user-select:none` 容器 + contenteditable `text` 豁免 CSS 结构不动（BX-SEL-01）；不放弃 stopPropagation（画布拖选防冲突）。

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
