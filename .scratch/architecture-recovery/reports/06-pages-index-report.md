# Report — 06 docs/index 产品 landing

- 日期: 2026-09-10
- 分支/提交: GitButler branch `ticket-06-pages-index`, commit `sup`
- 票: issues/06-pages-index.md (GitHub #6, milestone 2026.9.12)
- 版本控制: 遵循 WORKFLOW §4.2（未 push、未开 PR）

## 变更摘要

- 新增 `docs/index.md`（3322 bytes, UTF-8 无 BOM, LF）：产品 landing 页, 修复 Pages 根路径 404。
- 沿用 `docs/_config.yml` 的 jekyll-theme-minimal, 未引入新站点生成器, 未改任何其他文件。
- 内容区块（对齐 handoff delta）:
  - **简介**: 一句话定位 + 段落简介（Obsidian canvas meets bookmarks; local-first; 14 语言; Apache-2.0）
  - **截图**: 5 张 store 截图（相对路径 `store-assets/screenshots/*.png`, 双端可渲染, 已验证全部存在）
  - **商店/release 链接**: AMO / Edge 官方店 / GitHub Releases 真实安装入口 + build-from-source 指引 + publishing guide 链接（初版写「零 release / 零上架」属信息过期, 见文末更正记录）
  - **预览入口**: Preview 区块声明 release 自动部署的交互预览计划, 链接 2026.9.12 milestone（真实存在的非死链）; 过渡期指向截图与源码安装。
  - **隐私**: 摘要 + 隐私政策绝对链接（`https://xxx91n.github.io/boxing/privacy-policy.html`, 线上 200 已实测, 与 store-listings 唯一权威口径一致）。
- 关键渲染决策: 全文纯 markdown, 无 raw HTML 块（README 式 `<div>/<picture>` hero 在 GitHub blob 视图可渲染, 但 Pages kramdown 默认 `parse_block_html: false` 不解析块内 markdown —— 双端一致性优先, logo 改行内图片）。
- 无 front matter: 与仓库惯例一致（docs/ 64 个 md 均 0 front matter）; GitHub Pages 默认插件 `jekyll-optional-front-matter` + `jekyll-titles-from-headings` 负责转换与标题。

## 验收对照（issues/06-pages-index.md）

| 验收项 | 状态 | 证据 |
|---|---|---|
| docs/index.md exists with intro, screenshots, store/release links, privacy | ✅ 本提交完成 | 文件写入后碎片断言 10/10 OK; 六处引用资源（logo + 5 截图）`fs.existsSync` 全 EXISTS; 五区块标题齐全 |
| Root Pages URL returns 200 with landing content | ⏳ 待部署后终验 | 部署门在前端（人工）: 本票遵循 WORKFLOW §4.2 不 push, 根 URL 200 只能在合并进 Pages 源分支并由 Pages 构建后成立。证据链: (a) 现状根路径 HTTP 404（ctx_fetch 实测 2026-09-10, 即本票要修的 bug baseline）; (b) 同源管线 `privacy-policy.html` 200 且带主题渲染, 证明 docs/ 是 Jekyll 源且无 front matter 的 md 会被转成 html —— `index.md` 将同机制产出 `index.html` 服务根路径。合并后终验: GET `https://xxx91n.github.io/boxing/` 期望 200 且含 "Your new tab is a spatial bookmark board" |

## 测试结果

- 遵循 CI-only 政策（2026-09-04 用户指令）: 本机零构建/零测试运行。
- docs-only 变更无 dist 契约面（同票 15 结论: 文档票无需 build）; grep `test/tests/*.spec.ts` 无任何 spec 断言 docs/index、privacy-policy 或 Pages 内容, 本票不触碰测试契约。
- 静态验证: 字节数 3322; BOM 缺席; CR 字节 0（纯 LF, `git diff --check` 面）; 内容碎片断言 10/10; 资源存在性 6/6。

## 残留风险

1. **终验依赖部署**: 根路径 200 的闭环需要本分支合并 + Pages 构建（Pages source 为分支/docs Jekyll 模式）。若 Pages 源切到 T-42 的 Actions artifact 模式且不经 Jekyll, `index.md` 不会被转换 —— T-42 落地时需复制产物或改用 html。
2. **插件依赖**: 相对路径图片依赖 GitHub Pages 默认插件集; 若未来自定义 `plugins:` 白名单遗漏 `jekyll-optional-front-matter`, 页面会退化为静态 md 直出。
3. **绝对链接**: 隐私链接硬编码 `/boxing/` basepath; 仓库改名或换自定义域时需同步（与 store-listings 口径一致, 属既有约束）。

## 教训（已回写 WORKFLOW §6）

- 同一份 markdown 的 raw HTML 块渲染在 GitHub.com（CommonMark 系, 解析块内 markdown）与 Pages kramdown（`parse_block_html: false`, 不解析）之间不一致: 本仓 landing/docs 类页面要保持纯 markdown, hero 用行内图片而非 `<picture>`/`<div>` 包裹。
## 更正记录（2026-09-10, 用户证据）

初版依据 README 与 2026-09-06 调研快照写「零 release / 零上架」, 属信息过期。按用户提供证据复核后更正:

- **GitHub Releases**: v2026.9.11（Latest, 2026-09-09）与 v2026.9.9（First public release）已发布, 资产含 chrome/firefox zip + crx + xpi + SHA256SUMS（gh 实查）。
- **Edge Add-ons**: 官方店已上架 https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi （ctx_fetch 实测 200, 标题 "Boxing - Microsoft Edge Add-ons"; 用户给的 crxsoso 链接为同 ID 第三方镜像, landing 采用官方 URL）。
- **Firefox AMO**: 已上架 https://addons.mozilla.org/en-US/firefox/addon/boxing-newtab/ （用户确认直接采用, 不再复核; 本窗口自动抓取 404 判为 AMO 反爬假阴性, 另注 AMO slug `boxing` 是 2010 年无关扩展, 不可用）。
- landing 的 Install 区块已改为真实安装入口（Firefox / Edge / Releases / build-from-source）, 版本无关写法（不硬编码版本号, 避免发版即过期）; Preview 区过渡指引同步改为指向商店安装。
- 交叉发现（不属本票文件, 不动, 留给对应票）: README 的「No installable packages are published yet / zero releases」警示块与 docs/store-assets/store-listings-2026-09.md 的「rollout in progress / no public listing」表述现已过期, 归 README/locale 同步票（#2 / T-37 面）处理。
