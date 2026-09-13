# Store Publishing Plan — Boxing 2026.9.12

> 状态: **商店发版进行中（用户执行，Agent 供材）** · 更新: 2026-09-13
> Grill 心智模型保留于「Grill Decisions」节；执行表已按 2026.9.12 现况重写。
> 隐私政策: https://xxx91n.github.io/boxing/privacy-policy.html

## 现况（2026-09-13）

| 渠道 | 状态 |
|---|---|
| **Firefox AMO** | **9.11 已过审上线** — [addons.mozilla.org/…/boxing-newtab](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/) |
| **Edge Add-ons** | **9.11 已过审上线** — [Edge listing](https://microsoftedge.crxsoso.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi) |
| Chrome Web Store | 可选；历史上 Edge 优先 |
| GitHub Releases | **日志化、面向用户**；**不再分发 .xpi / .crx**；安装引导到商店 |
| 版本 | **2026.9.12** 候选包与源码包已就绪 |

## Grill Decisions（历史裁定，仍有效）

| Q | Decision | Rationale |
|---|----------|-----------|
| Q1 | A+B sync, prepare everything at once | Screenshots as placeholders, human replaces later |
| Q2 | (A) Chrome optional_host_permissions + Firefox keeps host_permissions | Chrome review: narrower permissions = higher pass rate; Firefox more tolerant of WebDAV |
| Q3 | (A) GitHub Pages hosts privacy policy | https://xxx91n.github.io/boxing/privacy-policy.html |
| Q4 | (A) 5 transparent 1280x800 PNG placeholders + README | Human overwrites same filenames later |
| Q5 | CRX pem + AMO API key deferred to daytime interactive setup | Involves user account identity, needs hands-on guidance |
| 发行门禁 (ADR-0017) | 可发行 = G-A ∧ G-B ∧ G-C | 数据事故驱动；程序性门禁，非流水线硬拦 |
| Wave8 D-002 | 发行号 2026.9.12 含零闪现 | 用户痛点；新 build，非覆盖旧包 |
| Wave8 D-009 | G-B 用户强制通过（无产物） | 发布权限方裁定；**非**可审计 G-B |
| 2026-09-13 发版 | GitHub **不再发 xpi/crx**；安装走官方商店 | 避免双源与未签名包；商店为唯一正式安装真源 |

## 2026.9.12 材料包（Agent 已备）

| 材料 | 路径 | 用途 |
|---|---|---|
| Chrome 商店包 | `D:\boxing-user-test-2026.9.12\boxing-chrome-2026.9.12.zip` | Edge / CWS 上传 |
| Firefox 商店包 | `D:\boxing-user-test-2026.9.12\boxing-firefox-2026.9.12.zip` | AMO 上传（源码 zip） |
| **源码审核包** | `D:\boxing-user-test-2026.9.12\boxing-source-2026.9.12.zip` | 商店「源代码」审核 |
| 源码说明 | `D:\boxing-user-test-2026.9.12\SOURCE-REVIEW-README.txt` | 审核员构建说明 |
| 文案 | `docs/store-assets/store-listing.md` + `store-listings-2026-09.md` | 短/长描述 |
| 截图 | `docs/store-assets/screenshots/` | 1280×800 |
| 隐私政策 | GitHub Pages URL（上） | 商店必填 |
| 用户向 Changelog | `CHANGELOG.md` §2026.9.12 | GitHub Release 正文 |

**注意：** AMO 上传通常用 **未签名 zip**（商店代签）。不要用本地 `.xpi` 当正式上架包。

## 用户执行清单（发版权在你）

### A. Firefox AMO（已有 listing → 新版本）

1. [AMO Developer Hub](https://addons.mozilla.org/developers/) → Boxing New Tab → **Upload New Version**
2. 上传 `boxing-firefox-2026.9.12.zip`
3. 若要求源代码：上传 `boxing-source-2026.9.12.zip`，并可粘贴 SOURCE-REVIEW-README 要点（构建命令、无混淆）
4. 更新版本说明：粘贴 CHANGELOG §2026.9.12 的用户向条目
5. 提交审核

### B. Edge Add-ons（已有 listing → 新版本）

1. [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/) → Boxing
2. **Packages** → 上传 `boxing-chrome-2026.9.12.zip`
3. 同步商店文案与截图（若改过）
4. 隐私政策 URL 保持 Pages 链接
5. 提交审核

### C. GitHub Release（日志化，用户向）

1. 不附带 `.xpi` / `.crx`
2. 可附：`boxing-chrome-2026.9.12.zip`（开发者/侧载可选）+ `boxing-source-2026.9.12.zip` + SHA256
3. **正文用 CHANGELOG §2026.9.12**，不要贴 commit 列表
4. 顶部安装引导：Firefox → AMO；Edge/Chrome → Edge 商店（及 CWS 若已开）

### D. 安装引导（GitHub / README 口径）

| 浏览器 | 正式安装 |
|---|---|
| Firefox | [AMO 列表页](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/) |
| Edge / Chromium | [Edge Add-ons 列表页](https://microsoftedge.crxsoso.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi) |
| 从源码 | clone → `npm ci` → `npm run build` → 加载 unpacked（开发者） |

## 风险与红线（未改）

| 风险/红线 | 说明 |
|---|---|
| ADR-0017 合取 | tag/宣称可发行仍看 G-A∧G-B∧G-C；本波 G-B 为强制豁免（D-009） |
| CRX key 丢失 | 新 ID 重上架（若仍走 CWS 自签；商店包不依赖本地 crx） |
| AMO 版号烧录 | `web-ext sign` 真密钥会占用版号；商店网页上传 zip 不烧本仓 CI 号 |
| 双安装源 | **禁止**再引导用户从 GitHub 下 xpi/crx 当正式安装 |

## 执行角色

| 步骤 | 谁 |
|---|---|
| 上传商店 / 填表 / 提交 | **用户** |
| zip/源码包/文案/changelog 草稿 | Agent 已备或可再生成 |
| 密钥、账号、最终 Publish | **用户** |
