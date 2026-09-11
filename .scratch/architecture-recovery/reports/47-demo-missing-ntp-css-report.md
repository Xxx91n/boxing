# Ticket 47 Report — Pages 工件完整性（ntp.css + privacy-policy）

日期: 2026-09-11 · 分支: ticket-47-pages-artifact-integrity · 提交: nkq（后续 docs 提交含本报告）

## 结论

demo-deploy 工件现已 fail-closed 产出两份缺失资产：`demo/ntp.css`（4 源拼接产物）与根路径
`privacy-policy.html`（由 docs/privacy-policy.md 渲染）。部署流水线在 upload 前双断言。
本地验收全绿；线上 200 验证待大脑 Agent 触发 Deploy NTP demo (Pages) 后复查（本窗口不 push、不 dispatch）。

## 根因（已查证，2026-09-11 live + 源码）

1. **demo 无样式**: `ntp/ntp.css` 是 gitignored 构建产物（ADR-0011，.gitignore:108），
   demo-deploy.yml 只跑 build-demo.mjs，从不执行 CSS 拼接；build-demo.mjs 仅镜像 `ntp/` 下
   已存在文件 → 干净 CI checkout 无 ntp.css → 镜像跳过 → /demo/ntp.css 404 → 整页裸 HTML。
2. **privacy-policy.html 404**: Pages Source 切到 GitHub Actions 后只服务 upload-pages-artifact
   内容；build-demo.mjs 只产出 index.html redirect + demo/**，从未生成 privacy-policy.html。
   商店提交（store-listings / publishing-guide / CONTEXT.md）硬依赖
   https://xxx91n.github.io/boxing/privacy-policy.html → 提交阻断。

## 变更（5 文件）

| 文件 | 变更 |
| --- | --- |
| .github/scripts/ntp-css.mjs（新增） | buildNtpCss(root) 共享模块 — 唯一 CSS 拼接逻辑（BX-XPLAT-001），base+settings+onboarding+conn → ntp/ntp.css |
| .github/scripts/build.mjs | 内联 buildNtpCss 抽出改为 import 共享模块；新增 --css-only 旗标（仅生成 ntp.css，不跑 dist 构建） |
| .github/scripts/build-demo.mjs | 镜像前调用 buildNtpCss(ROOT)；ntp.css 缺失/空 或 privacy-policy 源缺失 → FATAL + exit(1)；新增最小 Markdown 子集渲染器（标题/列表/粗体/内联代码/链接，HTML 转义，零依赖）产出 <out>/privacy-policy.html；JSON 汇总新增 ntpCssBytes/privacyPolicyBytes |
| .github/workflows/demo-deploy.yml | Assemble 前 step: `node .github/scripts/build.mjs --css-only`（既有构建入口）；upload 前 step: `test -s` 双断言 |
| demo/README.md | 记录两个生成产物 + fail-closed 契约 |

不改 NTP 业务 JS；不恢复 docs/ Jekyll（out of scope）。

## 验收对照（issues/47 全部 9 项）

| # | 验收项 | 结果 |
| --- | --- | --- |
| 1 | workflow 在 Assemble 前执行 ntp.css 生成步骤（BX-XPLAT-001 调用既有 build 入口） | ✅ demo-deploy.yml:43-44 `build.mjs --css-only`；拼接逻辑经共享 ntp-css.mjs 单一来源 |
| 2 | build-demo.mjs 从 docs/privacy-policy.md 生成工件根 privacy-policy.html（无新依赖；最小 HTML 壳 + Markdown 子集） | ✅ renderPrivacyPolicy()，零 npm 依赖（CRX-R-009） |
| 3 | build-demo.mjs 在 ntp.css 缺失/空 或 privacy 源缺失时 exit(1) | ✅ 负向实测两例均 exit 1（见下） |
| 4 | workflow 在 upload 前断言 pages-artifact/demo/ntp.css 与 pages-artifact/privacy-policy.html | ✅ demo-deploy.yml:50-53 `test -s` ×2 |
| 5 | 本地 build-demo --out .codex-tmp/pages-artifact 产物含两文件 | ✅（CI-only 政策要求运行后清除，已清除） |
| 6 | 部署后 /demo/ntp.css → 200 text/css | ⏳ 部署依赖项 — 当前 live 404（基线已录），待 dispatch 后复查 |
| 7 | 部署后 /demo/ → 200 且有主题色/布局 | ⏳ 同上（/demo/ 本身当前 200，issue 实测） |
| 8 | 部署后 /privacy-policy.html → 200 且含 "Boxing Privacy Policy" 与 Last updated | ⏳ 部署依赖项 — 当前 live 404；本地产物已含 `<h1>Boxing Privacy Policy</h1>` + "Last updated" |
| 9 | 报告写明全部 curl 状态码与 build-demo JSON 输出 | ✅ 见下两节 |

## 实测证据

### build-demo JSON 输出（真实仓库验收运行，exit=0）

```json
{"out":".codex-tmp\\pages-artifact","version":"2026.9.12","versionSource":"manifest","builtAt":"2026-09-11T05:06:54.121Z","ntpCssBytes":64402,"privacyPolicyBytes":5971}
```

- 产物根: index.html, demo/, **privacy-policy.html**；demo/ 内含 **ntp.css**（64402B，
  首行 `/* Boxing — NTP Styles (Warm Neutral, Modern, Minimal) */`）
- privacy-policy.html 5971B，含 `<h1>Boxing Privacy Policy</h1>`、"Last updated"、
  `<a href="https://github.com/Xxx91n/boxing/issues">` 链接

### fail-closed 负向测试（.codex-tmp/fx47-root 临时根，未触真实文件，已清除）

| 场景 | exit | FATAL 输出 |
| --- | --- | --- |
| docs/privacy-policy.md 缺失 | 1 | FATAL: docs/privacy-policy.md missing — store privacy URL would 404 |
| 4 个 CSS 源全空（→ ntp.css size=0） | 1 | FATAL: ntp/ntp.css missing or empty — demo would ship without styles |

### build.mjs --css-only（真实仓库）

exit=0，生成 ntp/ntp.css 64402B（A8.0 日志 63325 chars）；dist/ 未触碰
（最新文件 mtime 2026-09-10T16:47Z，早于运行 12h）。

### 线上状态码（2026-09-11 部署前基线，ctx fetch 实测）

| URL | 状态 |
| --- | --- |
| GET https://xxx91n.github.io/boxing/demo/ntp.css | **404** |
| GET https://xxx91n.github.io/boxing/privacy-policy.html | **404** |
| GET https://xxx91n.github.io/boxing/demo/ | 200（issue live 查证，HTML 引用 design-system.css + ntp.css） |

### 其他验证

- node --check: ntp-css.mjs / build.mjs / build-demo.mjs 全过
- js-yaml 解析 demo-deploy.yml: OK
- 本地构建产物已按 CI-only 政策清除（.codex-tmp/pages-artifact、fx47-root、ntp/ntp.css）

## 部署后收口清单（大脑 Agent）

1. dispatch "Deploy NTP demo (Pages)"（或随 release 触发）
2. 复查: /boxing/demo/ntp.css → 200 text/css；/boxing/demo/ 目视有主题；
   /boxing/privacy-policy.html → 200 含 "Boxing Privacy Policy" + "Last updated"
3. 部署 200 确认前，CWS/AMO 不要提交商店（store-listings:49 要求 re-verify before submit）

## 遵循

完成定义遵循 handoff 内的完成定义（issues/47 全部验收项 + 报告落盘）；
版本控制遵循 WORKFLOW §4.2（GitButler but CLI；未 push、未开 PR）。
