# Boxing 2026.9.12 发行架构调查报告

> 大脑 Agent 调查产出 · 2026-09-10 · 目标版本 2026.9.12  
> 交接来源: handoff-boxing-archrec-round7-final.md + handoff-boxing-store-publishing-2026-09-09.md  
> 调查方式: 宏观自查 + 2 子代理深挖 + atomcode 深度调研（Pages）  
> **本报告只调查不改码**；票据见文末 T-36..T-42

---

## 0. 权威现状（调查确认）

| 项 | 值 | 证据 |
|---|---|---|
| 工作分支 | fix-release-pipeline（未合 main） | but status |
| 唯一线上 Release | v2026.9.11 | handoff-store-publishing |
| 源 manifest/package 版本 | 2026.9.9 | manifest.json:6, package.json:3 |
| 设置页脚版本 | **Boxing v3.6.6**（严重过期） | ntp/index.html:308 |
| AMO 可用版本号 | 2026.9.12（9.11 已预留给 listed） | handoff |
| _locales | 14 语言 × 216 键 | 均无 extensionName/Description |

---

## 1. 痛点调查结论

### 1.1 icons/ 冗余 — 不能整目录删除

**事实**: `icons/icon_48.png` (722B) / `icon_128.png` (2286B) 是 2026-07-14 的**过期紫色占位**。
manifest.json:10-11,17-18 引用它们。CI build.yml:61-79 每次构建从 `docs/brand/logo-light-theme.png` LANCZOS 重生成。

**docs/brand** 另有策展图标 icon_48 (1896B) / icon_128 (5716B)，哈希不同，是商店 logo 源。

**结论（推荐）**:
- **不要删除 icons/ 目录**——Firefox 临时加载与 manifest 依赖它，且不在 .gitignore。
- **用 docs/brand 策展图标覆盖 icons/**（copy-over-regenerate），保证商店 logo == 工具栏图标。
- CI 的 logo 重生成步骤保留为 fallback，或改为 copy-from-brand。
- 可选：生成 16/32 尺寸补全。

**替代方案（若坚持删除源内图标）**: gitignore icons/ + 本地/CI 构建前统一生成——但会破坏 clone 后直接 load unpacked 的体验，不推荐。

### 1.2 README 多语言/截图/版本

**事实**:
| 位置 | 现状 | 问题 |
|---|---|---|
| README.md:32 徽章 | extension_version-2026.9.9 | 过期；线上已是 9.11 |
| README.md:78-84 Install | No installable packages are published yet / zero releases | **错误**——v2026.9.11 已发布 |
| README.md:62-70 Screenshots | 5 张表格 | locale 通常只有 1-2 张 |
| README.md:72-74 Brand Assets | 有 | 13 个 locale 均缺 |
| docs/i18n/README.*.md | 13 文件 × ~119 行 | 人工翻译存在，但不完整 |
| TRANSLATIONS.md:15-27 | 仅 zh_CN=Available，其余 Planned | **过期**——13 文件都在 |
| scripts/gen-i18n-readme.js | 写到 ROOT，输出英文正文+封面 | **危险**——运行会破坏人工翻译；未挂 package.json scripts |

**结论**:
1. 以英文 README 为 source of truth，同步版本徽章与 Install 文案到 v2026.9.12 + 真实 release 链接。
2. locale README 补齐：完整 Screenshots 表、Brand Assets 一段、准确 Install。
3. TRANSLATIONS.md 状态表改为全部 Available。
4. **废弃 gen-i18n-readme.js**（删除或重写为 docs/i18n 输出 + 不覆盖人工翻译）。

### 1.3 Edge/Firefox 商店多语言自动检测

**事实**: 14 个 locale 均无 `extensionName` / `extensionDescription`。
manifest name/description 为硬编码（description 131 字符，Edge 上限 132，仅 1 字符余量）。
Edge Partner Center 官方文档：从 manifest 的 __MSG_ 占位符 + _locales 探测语言。

**结论**:
1. 14 locale 各增加 extensionName / extensionDescription（description ≤132 字符）。
2. manifest 改为 `"name": "__MSG_extensionName__"`, `"description": "__MSG_extensionDescription__"`。
3. A7 构建校验器已强制 14-locale 键齐全——新键会被自动校验。
4. en 的 extensionDescription 可复用现有 131 字符文案；其他语言需逐个撰写/精简。
5. 做完后 Edge「Add a language」才会列出 zh-CN 等。

### 1.4 备份页 WebDAV/GitHub「混杂」

**事实（子代理确认）**:
- `#tab-sync` (index.html:238-303) 单页 8 个 section。
- show/hide 逻辑正确（sync-engine.js:55-59）：webdav/gist 互斥，local 隐藏 remote-backup-zone。
- **无双显 bug、无 ID 冲突**。
- 真正问题是 **UX 混杂**：共享字段（Sync Level / File Name / Auto-Backup / Sync Now）与供应商字段（webdav-config / gist-config）同属一个纵向滚动页，无分组标题、无子导航。
- local 时 remote-backup-zone 整体隐藏——逻辑正确。

**结论**: 这是产品 UX 票，不是逻辑 bug。
方案：在 Sync & Backup 页内做**视觉分组**（标题分隔 + 卡片），或拆成「共享设置」+「WebDAV」/「GitHub Gist」子区块；加 provider 互斥 Playwright 断言。

### 1.5 Firefox 备份页滚动卡顿（回归环）

**事实（子代理 + ADR-0014）**:
已修：nested .modal__body overflow、contain:layout、will-change 保留、overflow-anchor:none、thin scrollbars。

**残留根因（按可能性排序）**:
1. **`backdrop-filter: blur(8px) saturate(180%)` 于全视口 fixed overlay**（settings.css:5-14）——**从未被当作滚动性能因子审计**。Firefox backdrop-filter 主线程/合成器成本高。
2. `will-change: scroll-position`（:878）嵌在 backdrop-filter 创造的 stacking context 内——可能触发 FF 每帧额外 invalidation。
3. Sync 页最高、provider hidden 切换改滚动高度 + overflow-anchor:none → 跳动感。
4. `-webkit-overflow-scrolling: touch`（:870）FF 忽略（噪音）。

**测试缺口**: boxing-state-sync.spec.ts:100-112 计算了 scrollOwners 但**从未断言**；无 FF wheel-scroll / smoothScroll 测试。

**结论**: A/B 实验 backdrop-filter on/off；补完死断言；评估 prefers-reduced-motion 静态遮罩 fallback；禁止再改已正确的 will-change/overflow-anchor。

### 1.6 GitHub Pages 预览站（atomcode 深度调研）

**成熟心智模型（15 来源核验）**:
| 模式 | 代表 | 适用 |
|---|---|---|
| **A. UI 镜像 + stub chrome API** | Blink.new mock preview | **Boxing 主用**（NTP/popup 静态可玩） |
| B. 核心抽库 CDN | Dark Reader npm + chrome stub | 效果型扩展 |
| D. 官网/文档型 | vimium.github.io | 保底 |

**CI 官方 artifact 模式**（非 gh-pages 分支——GITHUB_TOKEN 推分支不触发 Pages）:
- `on: release: types: [published]` + `workflow_dispatch`
- `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`
- permissions: pages:write + id-token:write
- concurrency: group pages
- 注入 version.json = release tag
- SPA 兜底 cp index.html 404.html（Boxing 无路由可省）

**现状**: docs/ 有 _config.yml (jekyll-theme-minimal)，**无 index**，根路径 404；privacy-policy.md 可访问。

**Boxing 落地建议**:
1. 短期（本版可做）: docs/index.md 产品 landing（介绍+商店链接+截图+隐私链接）——修 404。
2. 中期（可 2026.9.12 或次版）: `demo/` 子工程 = NTP 静态镜像 + chrome.storage/local mock；release 后自动部署到 Pages。
3. 需人工在 GitHub Settings → Pages 选择 GitHub Actions 作为 source。

---

## 2. 版本字符串清单 → 2026.9.12

| 位置 | 当前 | 目标 |
|---|---|---|
| manifest.json:6,51 version/version_name | 2026.9.9 | 2026.9.12 |
| package.json:3 | 2026.9.9 | 2026.9.12 |
| README.md:32 徽章 | 2026.9.9 | 2026.9.12 |
| CHANGELOG.md | 至 2026.9.9 | 增 2026.9.12 节 |
| AGENTS.md:125 | 2026.9.9 | 2026.9.12 |
| ntp/index.html:308 页脚 | Boxing v3.6.6 | 从 manifest 注入或改为 2026.9.12 |
| store-listings-2026-09.md | v2026.9.9 zip 名 | 刷新 |

**附带 bug**: build.mjs:64 只覆盖 m.version，**不覆盖 version_name**（BOXING_BUILD_VERSION 失效于 version_name）。

---

## 3. 2026.9.12 票据（按依赖顺序）

### T-36 chore(icons): 用 docs/brand 策展图标覆盖过期 icons/
- 复制 docs/brand/icon_{48,128}.png → icons/
- CI 步骤改为 copy-from-brand（保留 PNG 校验）
- 验收: dist 内图标哈希 == docs/brand；Playwright 图标相关 spec 绿

### T-37 docs(readme): 同步版本/Install/截图/多语言状态到 2026.9.12
- 英文 README 徽章→2026.9.12；Install 指向 v2026.9.11+ release 与商店
- 13 locale 补 Screenshots 表 + Brand Assets + 准确 Install
- TRANSLATIONS.md 全部 Available
- 废弃 scripts/gen-i18n-readme.js
- 验收: 无 no release published；版本徽章一致；TRANSLATIONS 无 Planned

### T-38 feat(i18n-store): __MSG_ 占位符 + 14 locale extensionName/Description
- 14×2 新键（description ≤132）
- manifest name/description → __MSG_
- A7 校验通过；build 绿
- 验收: Edge 模拟探测到多语言；无硬编码 name/description

### T-39 fix(sync-ui): Sync & Backup 页 WebDAV/Git 视觉分组
- 共享设置 vs 供应商配置分区（标题/卡片）
- provider 互斥 Playwright 测试
- 验收: 切换 provider 永不双显；测试绿

### T-40 fix(firefox-scroll): backdrop-filter A/B + 死断言补完
- A/B modal-overlay backdrop-filter on/off（FF smoothScroll）
- 补完 boxing-state-sync.spec.ts scrollOwners 断言
- 评估 prefers-reduced-motion 静态遮罩
- 验收: FF 备份页滚动主观/客观改善；Chrome 无视觉回归

### T-41 feat(pages): docs/index 产品 landing（修根路径 404）
- docs/index.md：简介、截图、商店/release 链接、隐私、预览入口
- 验收: https://xxx91n.github.io/boxing/ 返回 200

### T-42 feat(pages-demo): release 自动部署 NTP 静态预览（atomcode 方案）
- demo/ 子工程 + chrome API stub（storage/local mock）
- .github/workflows/demo-deploy.yml（官方 artifact 模式）
- version.json 注入 release tag
- 人工：Settings→Pages 选 GitHub Actions
- 验收: release published 后 Pages 更新；预览可交互

### 附: T-43 chore(release): 版本字符串统一 2026.9.12 + version_name 注入修复
- 上表所有位置
- build.mjs 同步覆盖 version_name
- 可与 T-37/38/41 同分支或 release 前单独收口

---

## 4. 建议实施顺序（2026.9.12）

```
T-36 icons ──┐
T-37 README ─┼─→ T-43 版本收口 ─→ 发行
T-38 store i18n ┘
T-39 sync UI ──┐
T-40 FF scroll ┴─→ 并行（产品/体验，不阻塞商店包）
T-41 pages index ─→ 可与 T-43 同车
T-42 pages demo ─→ 可次版或本版（需 Pages source 人工步骤）
```

商店阻塞项: T-38（多语言）+ T-43（版本）+ T-36（图标一致性）。
T-39/T-40 是体验回归，建议同版但不阻塞上传。

---

## 5. 调查方法论记录

- ctx_batch_execute (bash) 读交接/仓库
- node 单文件分析（rg 在沙箱不可用）
- 2× explore 子代理并行深挖
- atomcode 串行深度调研（Pages）— 15 源核验
- 未改任何源码；未 commit

报告路径: .scratch/architecture-recovery/38-2026-09-12-release-architecture-investigation.md
