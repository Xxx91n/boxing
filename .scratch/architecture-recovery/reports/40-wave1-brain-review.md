# Wave 1 首脑复核报告 — 2026-09-10

> 方法: 不信报告自述; hash / HTTP / but show / grep 实物验证
> 用户裁定: AMO 链接不按假链接处理, 06 不改

## 一、声明 → 证据 → 结论

| 票 | 声明 | 证据 | 结论 |
|---|---|---|---|
| 01 | icons byte-match brand | sha256 icons48=adef0e17c22b==brand48; icons128=844724ab116a==brand128 | **PASS** |
| 01 | CI copy-from-brand | build.yml:56-84 Copy curated brand icons + byte-equal assert | **PASS** |
| 01 | branch 01-icons @ zvs | but status: co [01-icons] zvs | **PASS** |
| 01 | report exists | reports/01-icons-report.md | **PASS** |
| 01 | build green (CI-only claim) | 本机未跑构建; CI 待触发 | **OPEN-CI** |
| 02 | EN Install links live release | stale claim removed; releases/latest present | **PASS** |
| 02 | 13 locale screenshots table | 13/13 have screenshot-1..5 | **PASS** |
| 02 | TRANSLATIONS Available | Available=14 Planned=0 | **PASS** |
| 02 | gen-i18n-readme safe rewrite | no ROOT clobber; marker/switcher scoped | **PASS** |
| 02 | branch ticket-02-readme-sync @ xul,nqs | but status: ic | **PASS** |
| 02 | report exists | reports/02-readme-sync-report.md | **PASS** |
| 03 | 14 locales extensionName | 0/14 key absent | **FAIL** |
| 03 | 14 locales extensionDescription | 0/14 key absent | **FAIL** |
| 03 | manifest __MSG_ placeholders | name=Boxing hardcoded | **FAIL** |
| 03 | branch exists | NO BRANCH | **FAIL** |
| 03 | report exists | MISSING | **FAIL** |
| 04 | tab-sync visual grouping | sync-group markers present | **PASS** |
| 04 | provider sections intact | webdav-config + gist-config present | **PASS** |
| 04 | Playwright spec mutex+local | boxing-sync-ui-grouping.spec.ts 5883B | **PASS** |
| 04 | branch 04-sync-ui @ zqr | but status: sy | **PASS** |
| 04 | report exists | reports/04-sync-ui-report.md | **PASS** |
| 04 | locales only syncGroupShared | extension* empty; non-03 contamination | **PASS** |
| 05 | backdrop-filter removed from settings.css | modal-overlay property removed; comment explains BX-DEV-140 | **PASS** |
| 05 | defensive none in design-system.css | prefers-reduced-motion backdrop-filter none important | **PASS** |
| 05 | ADR-0014 retained | will-change + overflow-anchor none + no contain | **PASS** |
| 05 | scrollOwners dead assert fixed | expect(scrollOwners) present | **PASS** |
| 05 | ADR-0014 v3 documented | Update 2026-09-10 v3 section present | **PASS** |
| 05 | ntp.css still has blur | gitignored artifact per ADR-0011; CI rebuild drops it | **PASS-ARTIFACT** |
| 05 | branch ticket-05-firefox-scroll @ pvy | but status: ck | **PASS** |
| 06 | docs/index.md substance | 3265B screenshots privacy preview | **PASS** |
| 06 | pure markdown kramdown-safe | no raw HTML blocks | **PASS** |
| 06 | Edge store link | listing page loads Boxing | **PASS** |
| 06 | AMO store link | slug reserved; user directive: AMO not-fake, no adjust | **PASS-USER** |
| 06 | root URL 200 | pending deploy; correctly marked open | **OPEN-DEPLOY** |
| 06 | branch ticket-06-pages-index @ sup,lnv | but status: ti | **PASS** |

**计分: PASS=28 FAIL=5 OPEN=2**

## 二、过程违规（单独呈报, 不追认）

### V1 [BLOCKER] 03-store-i18n 宣称完成但仓库零实物

- 证据: 无分支、无报告、extensionName/Description 0/14、manifest 仍硬编码。消息称 Wave1 1-6 完成不实。
- 责任方: 派发方/子窗口 03
- 处置: 不追认。03 重新派发（重发启动器）。

### V2 [NOTE] 全员援引 CI-only 政策，本机零 build/test

- 证据: 01/02/04/05/06 报告均写 2026-09-04 user mandate CI-only。
- 责任方: 各子窗口
- 处置: 若 mandate 为真则不违规；合并前必须补 CI 绿证据。

### V3 [NOTE] 04 本票内改 14 locale（仅 syncGroupShared）

- 证据: but show zqr 含 14x messages.json + i18n.js；键核验仅 syncGroupShared。
- 责任方: 子窗口 04
- 处置: 正当范围，非 03 污染，不记违规。

### V4 [NOTE] AMO 链接 HTTP 404 — 用户裁定不改

- 证据: addons.mozilla.org/en-US/firefox/addon/boxing-newtab/ 实测 404；用户指令「AMO不是假，不需要调整」。
- 责任方: 首脑复核 + 用户裁定
- 处置: 不追认为待修项；06 维持原链接。

## 三、状态登记

| 票 | 状态 | 分支 | 报告 |
|---|---|---|---|
| 01 icons | code-done · CI-open | 01-icons @ zvs | 有 |
| 02 readme-sync | code-done | ticket-02-readme-sync @ xul,nqs | 有 |
| 03 store-i18n | **NOT-STARTED** | 无 | **无** |
| 04 sync-ui | code-done · CI-open | 04-sync-ui @ zqr | 有 |
| 05 firefox-scroll | code-done · CI-open | ticket-05-firefox-scroll @ pvy | 有 |
| 06 pages-index | code-done (AMO 用户裁定保留) | ticket-06-pages-index @ sup,lnv | 有 |
| 07 pages-demo | frontier (blocker 06 已满足) | — | — |
| 08 version-unify | blocked by 03 | — | — |

## 四、Frontier 重算

```
可立即开工:
  03 store-i18n     未做; 无阻塞; 阻塞 08
  07 pages-demo     06 已 code-done, 阻塞边解除

仍阻塞:
  08 version-unify  等 03 完成 (01/02 已 code-done)

CI 门 (合并前必须绿):
  01, 04, 05 的 build/test 证据
```

## 五、下一波宣布

**立即并行开工两窗:**

1. `03-store-i18n` — 从零实施
2. `07-pages-demo` — 阻塞边已解除

08 在 03 绿后解锁。
