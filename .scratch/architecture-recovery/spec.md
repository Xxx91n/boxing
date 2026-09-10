# Spec — Boxing 2026.9.12 发行就绪包

> 来源: 38-2026-09-12-release-architecture-investigation.md  
> GitHub Milestone: [2026.9.12](https://github.com/Xxx91n/boxing/milestone/1) (issues #1–#8)  
> 徽章: ready-for-agent

## Problem Statement

用户面对七个并行痛点，阻塞 2026.9.12 商店发行与体验验收：

1. 扩展图标是过期紫占位，与商店 logo 不一致；
2. README 多语言版本不完整、截图未同步、版本徽章过期、Install 文案与线上 release 矛盾；
3. Edge/Firefox 商店无法自动检测多语言 listing（manifest 硬编码 name/description）；
4. 备份页 WebDAV 与 GitHub Gist 配置在同一纵向页扁平混排，用户感知「混杂」；
5. Firefox 备份页滚动卡顿反复回归（Chrome 流畅）；
6. `https://xxx91n.github.io/boxing/` 根路径 404（docs/ 无 index）；
7. 无 release 自动重部署的扩展预览演示站；
8. 版本字符串分散（manifest/package/README/CHANGELOG/设置页脚 v3.6.6/AGENTS.md），且 build 不覆盖 version_name。

## Solution

以「商店可上架 + 文档可信 + 体验不回归 + Pages 可达」为验收线，交付八张 tracer-bullet 票：图标与 brand 一致、README/locale 真相同步、`__MSG_` 多语言商店检测、Sync 页视觉分组、Firefox backdrop-filter 残留审计、docs/index landing、release 自动 Pages 预览、版本字符串统一与 version_name 注入修复。

## User Stories

1. As a store reviewer, I want toolbar icons to match the store logo, so that the listing does not look fraudulent.
2. As a Firefox user installing from AMO, I want the listed version 2026.9.12 with correct icons, so that the package passes automated checks.
3. As an Edge reviewer, I want manifest name/description as `__MSG_` placeholders backed by 14 locales, so that Partner Center detects all supported languages.
4. As a zh-CN user browsing GitHub, I want a Simplified Chinese README with the same screenshots and accurate install steps as English, so that I can install without guessing.
5. As a Japanese/Korean/… user, I want my locale README to carry the full screenshot table and brand assets note, so that docs parity holds.
6. As a repo visitor, I want the README Install section to link the live v2026.9.11+ release, so that I am not told “no packages published”.
7. As a maintainer, I want TRANSLATIONS.md to list all 13 locales as Available, so that status matches the tree.
8. As a future agent, I want `gen-i18n-readme.js` removed or rewritten so it cannot clobber hand translations, so that docs stay safe.
9. As a backup user, I want shared sync settings visually separated from WebDAV and GitHub Gist credential blocks, so that I never confuse which fields belong to which provider.
10. As a backup user, I want switching provider to never show both WebDAV and Gist forms, so that the UI reflects the mutual exclusion the engine already implements.
11. As a Firefox user with general.smoothScroll enabled, I want settings/backup scrolling to feel as smooth as Chrome, so that the recurring jank regression ends.
12. As a Playwright maintainer, I want the existing scrollOwners computation to actually assert, so that scroll-owner regressions fail CI.
13. As a visitor of the GitHub Pages site, I want the root URL to render a product landing with screenshots and store links, so that the privacy-policy-only site is not a 404.
14. As a prospective installer, I want an interactive NTP preview on Pages that redeploys on every release, so that I can try Boxing before installing.
15. As a release engineer, I want every version string (manifest, package, badge, changelog, settings footer, AGENTS.md) to read 2026.9.12, so that artifacts cannot ship mixed versions.
16. As a CI consumer, I want BOXING_BUILD_VERSION to override both version and version_name in dist, so that calver injection is complete.
17. As a domain reader, I want ticket/handoff/prompts to use CONTEXT.md and ADR vocabulary (settings modal, sync provider, brand assets), so that multi-window work shares one language.

## Implementation Decisions

- **Icons**: overwrite committed `icons/` from curated `docs/brand` icons (copy-over-regenerate). Do not delete the directory — manifest and Firefox temp-load require the files. CI icon step becomes copy-from-brand with PNG signature assert retained.
- **README source-of-truth**: English README remains canonical. Locale files under `docs/i18n/` stay hand-maintained; generator script is deprecated (delete or rewrite to never clobber).
- **Store i18n**: add `extensionName` + `extensionDescription` to all 14 locales (description ≤132 chars for Edge). Manifest switches to `__MSG_extensionName__` / `__MSG_extensionDescription__`. A7 build validator already enforces 14-locale parity.
- **Sync UI**: keep engine mutual exclusion (`sync-engine.js` provider switch). Change only presentation: labeled groups or sub-sections for Shared vs WebDAV vs Gist. No new provider logic.
- **Firefox scroll**: audit `backdrop-filter` on `.modal-overlay` as the residual cost (never previously treated as a scroll factor). A/B against FF `general.smoothScroll`. Do not re-break ADR-0014 decisions (`will-change: scroll-position`, `overflow-anchor: none`, no nested scroll, no `contain`). Prefer `prefers-reduced-motion` static overlay fallback over deleting the blur outright if visual design must stay.
- **Pages landing**: add `docs/index.md` under existing `jekyll-theme-minimal` `_config.yml`. No new site generator.
- **Pages demo**: Mode A from atomcode research — static-open NTP mirror with `chrome.*` stub (storage/local mock). CI uses official artifact deploy (`upload-pages-artifact` + `deploy-pages`), triggered by `release: types: [published]` + `workflow_dispatch`. Do not use gh-pages branch (GITHUB_TOKEN pushes do not trigger Pages builds). Inject `version.json` = release tag.
- **Version unify**: single closer ticket bumps all known locations to 2026.9.12 and fixes `build.mjs` to override `version_name` alongside `version`. Settings footer stops reading a stale hardcoded `v3.6.6`.
- **Seams (testing)**: prefer existing Playwright seams — settings modal open/tab switch, provider select, extension load unpacked, manifest parse. Highest seam = Playwright e2e in `test/tests/`; no new unit-test harness. One new assertion seam only where missing: provider mutual exclusion + scrollOwners assert.

## Testing Decisions

- Good tests assert external behaviour (DOM visibility, manifest fields, built artifact bytes), not implementation details.
- Modules under test: manifest/build packaging; settings/sync presentation; docs tree completeness; Pages demo artifact.
- Prior art: `test/tests/boxing-webdav.spec.ts` (provider fields appear), `boxing-state-sync.spec.ts` (scroll owner scan — currently dead assert), `boxing-empty-state-buttons.spec.ts` (overflow-anchor/body overflow guards), `boxing-i18n-module.spec.ts` (14-locale contract).
- Icon ticket: assert dist icon bytes match `docs/brand` curated files.
- Store i18n: build-time A7 validator + a manifest parse assertion that name/description are `__MSG_` placeholders.
- Firefox scroll: keep Chrome visual parity; FF improvement is A/B measured, not a flaky timing assert in CI if environment noise dominates — record manual FF evidence in the ticket report.

## Out of Scope

- Chrome Web Store submission (still deferred per publishing guide).
- Merging `fix-release-pipeline` into main.
- AMO/Edge interactive store dashboard steps (human-gated).
- Rewriting ADR-0014 decision set (only append an update if backdrop-filter changes the decision).
- Full NTP feature refactors, new sync providers, new locales beyond the existing 14.
- Storybook / component library extraction for the demo (overkill vs Mode A).

## Further Notes

- Investigation evidence: `38-2026-09-12-release-architecture-investigation.md`.
- atomcode Pages research is ctx-indexed under label `atomcode` (15 sources); sub-windows may re-query via `ctx_search`.
- GitHub issues #1–#8 already mirror these tickets under milestone 2026.9.12; local `issues/` files are the multi-window source of blocking edges.
- All version-control statements defer to WORKFLOW §4.2.


---

# Spec addendum — Wave4 UX 四痛点（2026.9.12）

> 来源: `43-2026-09-12-wave4-investigation.md`
> 范围: 票 09–12；与 01–08 同属 2026.9.12 发行内容
> 徽章: ready-for-agent

## Problem Statement

用户在 2026.9.12 体验验收中报告四个并行痛点：

1. 大盒子画布双击新建**间歇无反馈**，进入小盒子再返回后**冒出多枚**新建大盒子。
2. 点击盒子名称重命名时光标落在名称前，**不能默认全选**。
3. 书签默认在**新标签页**打开；产品要求默认**当前标签页**。
4. 书签 favicon 缓存/加载需对齐工业成熟心智模型，**同时省 IO 与流量**。

日志 `boxing-log-2026-09-10T13-58-24.log` 盘上不存在；P1 以源码时序根因立案。

## Solution

- **09**: 创建路径 **mutate → render → save**，视觉反馈不再被 storage 写链阻塞。
- **10**: 点击大/小盒子标题与 crumb 标题时 **focus + 全选** 原文。
- **11**: `urlOpenMode` 默认与缺键迁移为 **sameTab**；用户已显式选择的 newTab **保留**。
- **12**: favicon 增加 **single-flight** 与 **SWR hydrate**；不引入 IDB/Cache API/新权限。

## User Stories

1. As a canvas user, I want every successful double-click create to show a box immediately, so that I trust the gesture.
2. As a canvas user, I want rapid consecutive creates to match what I see, so that no "ghost pile" appears after navigation.
3. As a canvas user, I want toolbar / empty-state CTA creates to use the same visual timing, so that all create entry points feel consistent.
4. As a renamer, I want clicking a box title to select the entire name, so that I can type a replacement without manual select-all.
5. As a renamer, I want the same select-all on small-box titles and the inner crumb title, so that rename is consistent across surfaces.
6. As a renamer, I want Escape to restore the previous name after select-all edit, so that accidental clicks are safe.
7. As a bookmark opener, I want new installs to open bookmarks in the current tab by default, so that I do not spawn tab clutter.
8. As an existing user who chose New Tab, I want that choice preserved after upgrade, so that my preference is not overwritten.
9. As a settings user, I want the Open-bookmarks-in control to reflect the live default, so that the modal matches actual behaviour.
10. As a performance-minded user, I want concurrent favicon loads for the same host to share one network probe, so that traffic stays minimal.
11. As a returning user, I want stale cached favicon URLs to paint first and refresh in background, so that cold start stays fast.
12. As a privacy-conscious user, I want no new extension permissions in this wave, so that install surface does not grow.

## Implementation Decisions

- **Create pipeline (09)**: All create entry points that currently `await saveLayout()` before render must render first; persistence uses the existing debounced save path (or fire-and-forget direct save). Cooldown / markCreate / focus-sink semantics unchanged. Storage write chain and cross-tab merge are **not** rewritten.
- **Title selection (10)**: One shared select-all helper; applied to large title, small title, inner crumb title. Paste remains plain-text (SEC-03).
- **Bookmark open default (11)**: Default and missing-key migrate to `sameTab`. Explicit stored `newTab` is preserved. Unset legacy Firefox browserSettings branch collapses to sameTab.
- **Favicon (12)**: Keep URL-string metadata cache (no blobs). Add host-keyed in-flight Promise map. Hydration keeps expired hits as stale for immediate paint + one background refresh. Explicitly **out**: `favicon` permission, Chrome `_favicon` API, IndexedDB, Cache API (atomcode research).
- Seams: existing Playwright extension context; no new unit harness.

## Testing Decisions

- Good tests assert external behaviour (DOM box count, selection string, navigation target, single network probe), not internal maps.
- Modules: create paths in render pipeline; title mousedown handlers; settings default/migrate; favicon loader.
- Prior art: `boxing-empty-state-buttons.spec.ts`, `boxing-focus-steal.spec.ts` (Selection), `boxing-settings-persist.spec.ts`, `boxing-debug.spec.ts`.
- CI-only policy: local `node --check` + report; full Playwright green required before merge.

## Out of Scope

- Storage write-chain / mergeConcurrentLayout algorithm changes
- Chrome `_favicon` permission expansion
- Favicon privacy kill-switch for external CDNs
- Title typography / rename history
- 01–08 closeout gates (unchanged)

## Further Notes

- Investigation: `43-2026-09-12-wave4-investigation.md`.
- Favicon brain research ctx-indexed as `atomcode-favicon`.
- File affinity: 09 and 10 both edit the render module — ticket 10 is **Blocked by 09**.
- All version-control statements defer to WORKFLOW §4.2.
