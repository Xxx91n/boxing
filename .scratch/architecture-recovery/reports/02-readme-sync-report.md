# Report — 票 02 README/locale/TRANSLATIONS 同步

日期: 2026-09-10 · 分支: ticket-02-readme-sync（遵循 WORKFLOW §4.2）

## 变更摘要

| 文件 | 变更 |
|---|---|
| README.md | Install 徽章改链 `releases/latest`（去除 "no release assets published yet"）；IMPORTANT 块改为 "Ready-to-use packages are published on GitHub Releases"（列出 zip/crx/xpi/SHA256SUMS 资产，保留 Edge 推进中 / Chrome 延后 / AMO 无公开列表的真实商店状态）；Chrome/Edge 与 Firefox 各新增 "From the release package" 路径（原 from-source 步骤保留）；NOTE 签名段尾句与 TIP 块改为 release 已发布的真实现状。版本徽章 (2026.9.9) 未动——留给票 08。 |
| docs/i18n/README.*.md ×13 | 每票补齐：完整 5 图 Screenshots 表（本地化表头/alt）、Brand Assets 节（链 `../../docs/brand/`，与英文源同 24 文件口径）、重写 Install 节为 release-first（本地化下载步骤 + 保留英文命令的 from-source 步骤，删除全语言共用的过期英文 TIP），并同步 TOC 新增两个锚点。ar/th/hi 等 RTL/非拉丁文脚本按语言惯例本地化散文，命令/文件名/URL 保持英文（TRANSLATIONS.md 指引）。 |
| TRANSLATIONS.md | 状态表 13 locale 全部 Available（en=Source）；新增 Language Switcher 节说明脚本新契约（仅同步 marker 块）；How-to 增补 Screenshots/Brand/Install 同步义务与 switcher 脚本用法。 |
| scripts/gen-i18n-readme.js | 重写：旧版以英文正文整文件重建 locale 并写到仓库根，运行即覆盖 docs/i18n 人工翻译（且因 package.json `type:module` 下仍用 CommonJS `require`，实际当场崩溃——危险是潜伏的）。新版只重写 README.md + docs/i18n/*.md 中 `README-I18N:START/END` 标记间的单行语言选择器，块外字节不动；ESM 化。 |

## 验收对照（issues/02-readme-sync.md）

- [x] English README Install links live release/store; no "no packages published" claim — 徽章/正文/步骤全链 https://github.com/Xxx91n/boxing/releases/latest（gh 实测 v2026.9.11=Latest，资产 zip/crx/xpi/SHA256SUMS.txt 在列）；15 个同步文件 grep 旧声称 = 0。
- [x] All 13 locale READMEs carry Screenshots table + Brand Assets + accurate Install — 逐文件断言 5 图路径齐全、Brand 节存在、旧 TIP 消失（脚本内 assert，13/13 OK）。
- [x] TRANSLATIONS.md lists all existing locales Available — 13 Available + en Source，Planned 残留 0。
- [x] scripts/gen-i18n-readme.js deprecated or rewritten to never clobber hand translations — 重写为 marker 限定同步器；两次连跑输出 `0 file(s) rewritten`（生成行与 14 文件现存选择器逐字节一致，证明确实"不覆盖"）。

## 测试与验证（CI-only 政策；本票为 markdown-only，无 dist 契约面，按票 15 先例不跑本地 Playwright）

- `git diff --check`（本票文件范围）: clean。
- 编码: 15 个 md + 1 个 js 全部 LF、无 BOM。
- 相对链接存在性: 全量解析 15 文件 md 链接，断链 0（screenshots×5、docs/brand、LICENSE、privacy-policy、publishing-guide 等）。
- `node --check scripts/gen-i18n-readme.js`: exit 0；幂等运行 ×2: 0 rewrites。
- codegraph sync: 已跑（Synced 3 changed files）。
- `git grep` test/ 与 .github/: 无对被改文档内容的断言（本票无 CI 契约面）。

## 调研说明（§4.3）

未新起 atomcode 在途：本票成熟模型已由 spec.md L47 固化（英文 README=source of truth，locale 手工维护全量对等，生成器退役），且 GitHub 多语言 README 官方实践（根 README 语言选择器 + 链接式本地化 README 文件）即现存 docs/i18n 布局本身，无待决问题。

## 残留风险

1. 版本徽章 2026.9.9 与正文 release-first 文案并存至票 08 收口（票面明确留给 08，不冲突：本票改动零版本字符串）。
2. .xpi 签名态未外部验证：文案采用条件式（"AMO-signed builds install directly; unsigned builds load only in Developer Edition/Nightly"），不承诺签名。
3. 调查报告 §0 与票 35 报告的 "zero releases" 是时点事实，已被 9-09 两连发 release 超越；历史文件不回改（非本票路径锚点）。
4. 与票 01 图标窗并行：icons/build.yml 等未提交改动属他窗，本票提交仅认领自己的 16 个文件。

## 教训（候选入 §6）

- 机械 patch 脚本的锚点断言在写前 abort 的价值：泰文标题含组合符号（`ติ` 的 mai han akat），GitHub slug 保留 `p{M}` 而朴素正则丢——th 在断言处失败，未产生半写状态；修复 = slug 字符类加 `p{M}`。
- 危险脚本可能同时是死脚本：旧 gen-i18n-readme.js 的 clobber 危害从未兑现，因为 ESM 化仓库里它先崩在 `require`；重写时一并 ESM 化并用"连跑两次 0 改动"作为不覆盖证明。
