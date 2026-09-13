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
- Edge: https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi

## 材料从哪来

| 材料 | 获取方式 |
|---|---|
| `boxing-chrome-<ver>.zip` | GitHub Actions `build` 工件，或本地 `npm run build` → `dist/boxing-chrome/release/chrome/` |
| `boxing-firefox-<ver>.zip` | 同上 → `dist/boxing-firefox/release/firefox/` |
| 源码审核包 | `git archive -o boxing-source-<ver>.zip v<ver>` 或 GitHub「Download ZIP」后去掉 `.git`/`node_modules` |
| 商店文案 | `docs/store-assets/descriptions/` |

构建：Node ≥ 18，`npm ci && npm run build`。

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

## Part 3 — GitHub Release（用户向日志 · **必须走 CI**）

**禁止**在本地 `gh release upload` 手工塞附件。统一走：

```bash
gh workflow run build.yml -f version=<VER> -f make_release=true -f amo_sign=true
```

- `make_release=true`：ubuntu-latest 腿生成 `chrome/firefox/source zip` + `SHA256SUMS.txt` 并 **Publish** Release  
- **不上传** `.xpi` / `.crx`（商店签名是安装真源；workflow artifact 里仍可有 crx/xpi 供调试）  
- `amo_sign=true`：跳过 AMO 签名，避免烧版号（商店网页上传不烧本仓号）

1. Tag 名默认 `v<version>`（可用 `release_tag` 覆盖）
2. 标题：`Boxing <version>`（由 action 生成）
3. 正文：workflow 内模板（商店安装链 + 说明 CHANGELOG）；发版后如需润色再 `gh release edit --notes-file`
4. 发版后核对：四个附件齐全、无 xpi/crx、`SHA256SUMS.txt` 与 zip 一致
5. 不要把 release 写成工程师变更集（长 commit 列表、内部票号表）

**demo-deploy** 会在 `release: published` 时自动部署 Pages；若 deploy job 失败，见 Part 5 备注。

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
