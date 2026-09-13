# Store Publishing Plan — Boxing 2026.9.12

> 状态: **商店发版进行中（用户执行，Agent 供材）** · 更新: 2026-09-13
> Grill 心智模型保留于「Grill Decisions」节；执行表已按 2026.9.12 现况重写。
> 隐私政策: https://xxx91n.github.io/boxing/privacy-policy.html

## 现况（2026-09-13）

| 渠道 | 状态 |
|---|---|
| **Firefox AMO** | **9.11 已过审上线** — [addons.mozilla.org/…/boxing-newtab](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/) |
| **Edge Add-ons** | **9.11 已过审上线** — [Edge listing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi) |
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

## 2026.9.12 材料包（从哪拿）

| 材料 | 获取方式 | 用途 |
|---|---|---|
| Chrome 商店包 | CI `build.yml` 工件 `boxing-chrome-<ver>.zip`，或本地 `npm run build` 后 `dist/boxing-chrome/release/chrome/` | Edge / CWS 上传 |
| Firefox 商店包 | 同上 `boxing-firefox-<ver>.zip` | AMO 上传 |
| 源码审核包 | 从 Git tag 导出，或 `git archive -o boxing-source-<ver>.zip v<ver>`（不含 `.git`/`node_modules`/`dist`） | 商店「源代码」审核 |
| 文案 | `docs/store-assets/descriptions/<locale>.txt`（纯文本，可粘贴） | Description |
| 短摘要/字段表 | `store-listings-2026-09.md` | Summary、权限理由 |
| 截图 | `docs/store-assets/screenshots/`（1280×800） | 商店截图 |
| 隐私政策 | https://xxx91n.github.io/boxing/privacy-policy.html | 商店必填 |
| 用户向 Changelog | `CHANGELOG.md` §对应版本 | Release 正文 / 商店版本说明 |

**注意：** AMO 上传用**未签名 zip**（商店代签）。不要把 CI 的 `.xpi`/`.crx` 当正式上架包。

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

### C. GitHub Release（日志化，用户向 · **必须 CI**）

```bash
gh workflow run build.yml -f version=2026.9.12 -f make_release=true -f amo_sign=true
```

CI 在 ubuntu 腿自动生成并 Publish：`chrome.zip` `firefox.zip` `source.zip` `SHA256SUMS.txt`。
**禁止**本地 `gh release upload` 手工塞附件；**禁止**上传 `.xpi` / `.crx`。
正文模板含商店安装链；如需润色再 `gh release edit --notes-file`。

### D. 安装引导（GitHub / README 口径）

| 浏览器 | 正式安装 |
|---|---|
| Firefox | [AMO 列表页](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/) |
| Edge / Chromium | [Edge Add-ons 列表页](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi) |
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
