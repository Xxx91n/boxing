# Publishing Guide — Boxing（2026-09-13 修订）

> 面向：**发布者（用户）**。商店上传由你完成；本指南给路径、材料与红线。
> 保留心智模型：Chrome/Firefox 权限拆分、隐私页走 Pages、AMO 版号烧录教训、ADR-0017 门禁。
> 已废除：「以 GitHub `.xpi`/`.crx` 为官方安装源」的旧叙述。

## 当前发行口径（2026.9.12）

| 渠道 | 角色 |
|---|---|
| **Firefox AMO** | 正式安装源（9.11 已上线；9.12 由你提交新版本） |
| **Edge Add-ons** | 正式安装源（9.11 已上线；9.12 由你提交） |
| Chrome Web Store | 可选；历史上 Edge 优先 |
| **GitHub Releases** | **变更日志 + 可选源码/侧载 zip**；**不发布 .xpi / .crx** |

已上线 listing：

- Firefox: https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/
- Edge: https://microsoftedge.crxsoso.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi

## 材料位置（本机）

见 `D:\boxing-user-test-2026.9.12\README-TEST.txt` 与：

- `boxing-chrome-2026.9.12.zip` — Edge/CWS 上传
- `boxing-firefox-2026.9.12.zip` — AMO 上传
- `boxing-source-2026.9.12.zip` — 商店源代码审核
- `SOURCE-REVIEW-README.txt` — 审核说明

构建复现：Node ≥ 18，`npm ci && npm run build`。产物在 `dist/`。

## Part 1 — Firefox AMO 新版本

1. [Developer Hub](https://addons.mozilla.org/developers/) → 你的 listing → **Upload New Version**
2. 上传 **未签名** `boxing-firefox-2026.9.12.zip`（商店负责签名）
3. 版本说明：用 `CHANGELOG.md` 中 **2026.9.12** 用户向条目（勿贴 git log）
4. 若要求源码：上传 `boxing-source-2026.9.12.zip`，说明：Vanilla JS、无混淆、`npm ci && npm run build`
5. 隐私政策 URL：https://xxx91n.github.io/boxing/privacy-policy.html
6. Submit

**红线（历史教训）：** 本地 `web-ext sign` + 真 API key 会**永久占用版号**。演练请用 `99.9.x` 或只跑 `web-ext lint`。商店网页上传不占用本仓 CI 的 AMO 签名步。

## Part 2 — Edge Add-ons 新版本

1. [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/) → Boxing → 新提交/新包
2. 上传 `boxing-chrome-2026.9.12.zip`
3. 文案与截图：`docs/store-assets/`
4. 隐私政策 URL 同上
5. Submit

## Part 3 — GitHub Release（用户向日志）

1. Tag：仅在你接受当前门禁状态后创建（见 ADR-0017；G-B 为 D-009 强制豁免须知情）
2. 标题示例：`Boxing 2026.9.12`
3. 正文结构（用户能读懂）：
   - 一句话摘要
   - **新增 / 改进 / 修复**（来自 CHANGELOG）
   - **从哪里安装**（AMO / Edge 链接）
   - 已知限制（若有）
4. 附件（可选）：
   - `boxing-source-2026.9.12.zip`（+ sha256）
   - 可选 `boxing-chrome-2026.9.12.zip` 供开发者侧载
   - **不要**上传 `.xpi` / `.crx`
5. 不要把 release 写成工程师变更集（长 commit 列表、内部票号表）

## Part 4 — 权限与隐私（grill 保留）

- Chrome：`optional_host_permissions` — WebDAV 时再请求
- Firefox：`host_permissions` — 审核更宽容
- 隐私页：GitHub Pages `/docs`
- 凭据：per-install key + AES-GCM **混淆级**信封，非用户口令加密（见 Privacy 文案）

## Part 5 — GitHub Pages / Demo 同步（现行）

| 触发 | 行为 |
|---|---|
| **`release` published** | `demo-deploy.yml` checkout **该 tag** → 构建 demo + privacy → 部署 Pages |
| `workflow_dispatch` | checkout **main** 手动重部 |

因此：**每次正式 GitHub Release 后，Pages/demo 应自动跟该发行 tag 同步**（`demo-deploy.yml`），无需再手动 push gh-pages。  
隐私政策页与 `/demo/` 同属该 artifact；未发 Release 时 Pages 停在上一次部署内容。  
（历史教训：`GITHUB_TOKEN` push 不会触发 Pages build，故用 Actions artifact 而非 gh-pages 分支。）

**运维备注（2026-09-13）：** 偶发 `release` 触发的 **deploy** job 失败时，可先 `gh workflow run demo-deploy.yml`（checkout main）重部，或 `gh run rerun <id> --failed`。验收以 `/demo/` 与 privacy URL 200 为准。

## Part 6 — 本地验证（不烧号）

```bash
npm ci
npm run build
node scripts/import-graph-guard.mjs
npx web-ext lint --source-dir dist/boxing-firefox/release/firefox/boxing
```

`build.yml` 可用 `amo_sign=true` `make_release=false` 做 CI 打包且**不**打 tag、不烧 AMO 号。

## 安全清单

- [ ] 商店上传使用本地已核对的 zip（sha256 与 README-TEST 一致）
- [ ] 源码包无 `.git` / secrets / `.pem`
- [ ] 隐私政策 URL 可打开
- [ ] 截图非透明占位（若商店要求实图）
- [ ] GitHub Release 无 xpi/crx，安装链到商店
- [ ] 你知道 G-B 为强制豁免、G-A 以 CI 为准
