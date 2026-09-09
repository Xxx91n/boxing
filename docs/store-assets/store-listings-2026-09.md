# Store Listings — AMO (Firefox) + Edge Add-ons — v2026.9.9 (2026-09-09)

Field-ready copy for both stores. Everything below is verified against the
official store requirements pages fetched 2026-09-09 (see "Sources" at the
bottom). English copy is canonical; zh-CN is a faithful localization.

Package files to upload (from the v2026.9.9 release / CI artifacts):

- **Firefox AMO**: `boxing-firefox-2026.9.9.zip` (AMO accepts zip; it builds
  and signs its own XPI — do NOT upload the CI-signed XPI when listing on
  AMO, and do NOT re-upload version 2026.8.21 anywhere, it is burned).
- **Edge Add-ons**: `boxing-chrome-2026.9.9.zip` (Edge accepts Chromium MV3
  zips directly; the CRX is NOT used for store submission).

---

## 1. Firefox Add-ons (AMO) — Submit a New Add-on (listed)

URL: https://addons.mozilla.org/developers/addon/submit/

### Upload + validation steps

1. Log in with the Mozilla account at addons.mozilla.org → Developer Hub →
   **Submit a New Add-on** → choose **"List the add-on on AMO"**.
2. Upload `boxing-firefox-2026.9.9.zip`. The validator must pass with no
   errors.
3. Compatible platforms: **Firefox on desktop** (Windows/macOS/Linux);
   do NOT tick Android (strict_min_version is 112 and the NTP surface is
   desktop-oriented; Android review is a separate lane).
4. Source-code question: answer **No** — the zip contains plain,
   non-minified ES modules (no bundler, no minifier). If AMO reviewers later
   request source under the minification policy, point them at the repo tag
   `v2026.9.9`.
5. Add-on details:

| Field | EN value |
|---|---|
| Name | Boxing |
| Add-on URL (slug) | `boxing` (suggested; must be unique) |
| Summary (≤250 chars) | See below |
| Description (long) | Use "Detailed description (EN)" below |
| Homepage URL | https://github.com/Xxx91n/boxing |
| Support URL | https://github.com/Xxx91n/boxing/issues |
| License | Apache-2.0 |
| Categories | Privacy & security is wrong here — pick **Bookmarks** + **Productivity** (two categories max) |
| Tags | bookmark manager, new tab, infinite canvas, bookmarks organizer |
| Screenshot | upload all 5 from docs/store-assets/screenshots/ (1280x800, AMO-recommended size) |
| This add-on is experimental | leave UNCHECKED |
| Privacy policy | CHECK, paste URL: https://xxx91n.github.io/boxing/privacy-policy.html (200 OK verified 2026-09-06, re-verify before submit) |
| Notes for Reviewer | "New Tab override extension. All data stays local (storage.local); optional WebDAV/Gist backup only contacts servers the user configures themselves. Manifest declares host_permissions https://*/* solely so the optional WebDAV backup can reach the user's own server; no browsing data is read, transmitted, or shared. Source: https://github.com/Xxx91n/boxing (tag v2026.9.9)." |

**Summary (EN, 250-char limit — this is 236 chars):**

> Turn your new tab into an infinite-canvas bookmark workspace. Organize bookmarks into labeled boxes, nest sub-canvases, connect ideas, with list & grid views. Local-first, open source.

**Summary zh-CN（AMO 支持按 locale 填写，新增 zh-CN 语言条目后填）:**

> 把新标签页变成无限画布书签工作台：书签装进带标签的盒子，可嵌套子画布、连接关联，支持列表与网格视图。数据全本地、完全开源。

### AMO required-field notes (verified)

- Summary hard limit: 250 characters (Extension Workshop: "The summary
  description for your add-on is limited to 250 characters").
- Screenshots: recommended capture size is 1280x800 px (our files match).
- Review notes: the host_permissions <all-urls>-equivalent request
  (`https://*/*`) will trigger extra scrutiny — the Notes for Reviewer text
  above pre-answers it. Privacy policy URL is required because the listing
  declares one.
- After approval, AMO hosts the signed XPI; users install from AMO. The
  GitHub Release XPI is the self-distribution copy.

---

## 2. Microsoft Edge Add-ons — Partner Center (public)

URL: https://partner.microsoft.com/dashboard/microsoftedge (requires the
Microsoft developer account; free registration, no fee).

### Package + account steps

1. Register at Partner Center → Edge program (Microsoft account; identity
   verification may take a few days for individuals — start early).
2. **Create new extension** → upload `boxing-chrome-2026.9.9.zip`
   (MV3, no changes needed for Edge).
3. **Availability**: Visibility = **Public**; Markets = all (default).
4. **Properties**:

| Field | Value |
|---|---|
| Category | Productivity |
| Website | https://github.com/Xxx91n/boxing |
| Support contact details | https://github.com/Xxx91n/boxing/issues |
| Mature content | No |

5. **Privacy**:

| Field | Value |
|---|---|
| Single Purpose Description (EN) | Replace the browser's new tab page with an infinite-canvas workspace for organizing bookmarks into boxes. |
| Single Purpose Description (zh-CN) | 将浏览器新标签页替换为无限画布工作区，用于把书签整理进盒子。 |
| Permission justification: storage | Store bookmarks, layout, and settings locally on the device. |
| Permission justification: tabs | Open bookmarks in a new tab when the user configures that behavior. |
| Permission justification: bookmarks | Read and write the browser bookmark tree the user asks to organize/import. |
| Permission justification: unlimitedStorage | Bookmark layouts with favicons can exceed the default local-storage quota. |
| Permission justification: alarms | Schedule optional periodic WebDAV/Gist backups the user opts into. |
| Permission justification: host_permissions https://*/* | Used only at runtime for the user-configured WebDAV backup endpoint; no other hosts are contacted and no browsing data is read. |
| Are you using remote code? | **No** (all code ships in the package) |
| Data usage certifications | Does not collect any user data → answer "No" to all collection questions |
| Privacy policy URL | https://xxx91n.github.io/boxing/privacy-policy.html |

6. **Store listings** — add languages **English (en)** and **Chinese
   (Simplified, zh-hans)**, then per language:

| Field | EN | zh-CN |
|---|---|---|
| Extension name (from manifest, read-only) | Boxing | Boxing |
| Description (250–10,000 chars, REQUIRED) | "Detailed description (EN)" below | "详细描述 (zh-CN)" below |
| Extension logo (REQUIRED, 1:1) | docs/brand/icon_128.png scaled, or boxing-prod.png resized to 300x300 | duplicate from EN |
| Small promotional tile (optional, 440x280) | docs/brand/chrome-store-tile-440x280.png | duplicate |
| Screenshots (640x480 or 1280x800, max 6) | all 5 from docs/store-assets/screenshots/ | duplicate from EN |
| Search terms (≤7 terms, each ≤30 chars, ≤21 words total) | bookmark manager, new tab, canvas, organizer, boxes, links | 书签管理, 新标签页, 画布, 收藏夹 |

7. **Submit** → Notes for certification:

> This extension replaces the new tab page. It does not collect or transmit
> user data; storage.local holds all bookmarks/settings locally. The
> https://*/* host permission exists only so the user can optionally
> configure their own WebDAV server for backups (off by default). Test:
> install, open a new tab, double-click empty canvas to create a box, add a
> bookmark, drag to connect two boxes, open Settings for theme/sync options.
> Privacy policy: https://xxx91n.github.io/boxing/privacy-policy.html

**Detailed description (EN, also reused for AMO long description — 1,876 chars):**

See `docs/store-assets/store-listing.md` "Detailed Description" section
(existing, verified accurate for this release) — it already covers the
infinite canvas, boxes, connections, privacy posture, permissions table,
and license. Paste it as-is.

**详细描述 (zh-CN，Edge 需至少 250 字符；粘贴用):**

> Boxing 将浏览器的新标签页变成一个可视化、可无限延展的画布工作区。不再使用扁平的文件夹和列表，而是把书签整理进画布上一个个带标签的盒子——拖动、连线、嵌套，完全贴合你的思维方式。
>
> 【无限画布】Ctrl+滚轮自由缩放与平移；画布上可创建无限个盒子；用连线表达盒子之间的关系；支持父子层级，移动父盒子时子盒子跟随；双击空白处新建盒子；右键返回上级画布。
>
> 【书签管理】每个盒子拥有独立的书签集合，支持列表与网格两种视图；通过简洁的对话框添加、编辑、删除书签；可自定义书签标题、URL 与描述；拖拽排序；可配置在新标签页或当前页打开。
>
> 【层级组织】盒子可以包含自己的子画布——点击进入盒子的独立空间；面包屑导航显示层级路径；嵌套深度不限；每一层完全独立隔离。
>
> 【设计与主题】米色/奶油色极简美学，安静专注；浅色与深色模式，自动跟随系统；可调字号与缩放；平滑的 SVG 连线；圆角样式可选。
>
> 【隐私优先】所有数据存储在本地，不会离开你的设备；可选 WebDAV 云备份（用你自己的服务器，由你掌控）；可选 GitHub Gist 备份；无统计、无追踪、无第三方服务；100% 开源（Apache-2.0），代码随时可审计。
>
> 【权限说明】storage：本地保存书签、布局与设置；tabs：按配置在新标签页打开书签；bookmarks：读取/整理浏览器书签树；unlimitedStorage：书签布局与图标可能超过默认配额；alarms：按需执行定时备份；https://*/* 主机权限仅用于你自行配置的 WebDAV 备份服务器，不读取任何浏览记录。我们不请求历史记录、下载、剪贴板等任何涉及浏览活动的权限。
>
> 【适用场景】科研项目资料整理——每个项目一张画布、每个主题一个盒子；多年收藏的可视化管理；知识图谱式关联；把常用书签钉在新标签页作为快捷入口。
>
> 【技术实现】纯原生 JavaScript，无框架、无打包器、零运行时第三方依赖；Manifest V3；支持 Chrome、Edge、Firefox 等 Chromium/Firefox 浏览器。开源仓库：https://github.com/Xxx91n/boxing

---

## 3. What is already done vs. what needs the human

Done by the agent (2026-09-09):
- Release pipeline fixed + version 2026.9.9 built by CI with a real AMO
  signature and CRX3 signature (see GitHub Release v2026.9.9).
- This listing pack; screenshots verified 1280x800; brand assets inventoried.

Needs the human (interactive, account-gated):
- Firefox: log in to AMO and run the submission flow above (~15 min).
- Edge: log in to Partner Center, register if not yet, run the flow (~30 min
  plus account verification latency).
- Both stores require interactive dashboards + 2FA; no API keys exist for
  Edge, and AMO listing metadata cannot be set via the signing API.

## Sources (fetched 2026-09-09 via tavily, cached in ctx)

- AMO flow/fields: https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- AMO summary 250-char limit + screenshot 1280x800 recommendation:
  https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/
- Edge flow/fields (8 steps, description 250–10,000, logo 300x300 min 128,
  screenshots 640x480 or 1280x800 max 6, search terms 7/30/21):
  https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Edge developer policies: https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies
