# 47 — Pages Actions 工件不完整：demo 无 ntp.css + privacy-policy 404

**What to build:** 修复 GitHub Pages（Actions artifact）公开面残缺：(1) /demo/ 主样式表 ntp.css 404 导致整页裸 HTML；(2) 商店硬依赖 URL /privacy-policy.html 404。demo-deploy 打包前生成 gitignored 的 ntp.css，并从 docs/privacy-policy.md 产出根路径 privacy-policy.html；工件对两者 fail-closed；部署后相关 URL 均 200。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## 已查证根因（2026-09-11 live 实测，非猜测）

### A. Demo 无样式

| 证据 | 结果 |
|---|---|
| GET /boxing/demo/ | 200，HTML 引用 design-system.css + ntp.css |
| GET /boxing/demo/design-system.css | **200**（仓库内有源文件） |
| GET /boxing/demo/ntp.css | **404** |
| GET /boxing/demo/ntp.js | 200 |
| .gitignore:108 | `ntp/ntp.css` 被忽略（ADR-0011 build 产物） |
| demo-deploy.yml | 只跑 `build-demo.mjs`，**从不**执行 CSS 拼接 / build.mjs |
| build-demo.mjs | 仅 copy `ntp/` 下**已存在**文件；干净 CI checkout 无 ntp.css → 跳过 |
| index.html | 只 link ntp.css，不 link base/settings/onboarding/conn 源 CSS |

### B. privacy-policy.html 404（商店硬依赖）

| 证据 | 结果 |
|---|---|
| GET /boxing/privacy-policy.html | **404** |
| GET /boxing/docs/ | **404**（旧 Jekyll 源已停用） |
| 仓库源文件 | `docs/privacy-policy.md` 存在（90 行，2026-08-08） |
| 历史 | Pages Source 为 legacy main:/docs 时该 URL 曾 200（票 35 实测） |
| 切换后 | Source=GitHub Actions，**只服务 upload-pages-artifact 内容** |
| build-demo.mjs | 只产出 index.html redirect + demo/**，**从不**生成 privacy-policy.html |
| 预警 | 票 07 报告已写明「切换 source 时 privacy-policy.html 也会 404」 |
| 商店依赖 | store-listings / publishing-guide / CONTEXT.md 均把该 URL 定为 CWS/AMO 隐私政策地址 |

结论：Actions 工件 ≠ 旧 Jekyll docs/ 全集。缺 ntp.css → demo 裸奔；缺 privacy-policy.html → 商店提交阻断。

## 验收

- [ ] demo-deploy.yml 在 Assemble 前执行生成 ntp.css 的构建步骤（遵循 BX-XPLAT-001：调用既有 build 入口，禁止第二套拼接逻辑）
- [ ] build-demo.mjs 从 `docs/privacy-policy.md` 生成工件根目录 `privacy-policy.html`（无新 npm 依赖；最小 HTML 壳 + 所需 Markdown 子集）
- [ ] build-demo.mjs 在 ntp.css 缺失/空 **或** privacy-policy 源缺失时 process.exit(1)
- [ ] workflow 在 upload 前断言 `pages-artifact/demo/ntp.css` 与 `pages-artifact/privacy-policy.html` 存在
- [ ] 本地 `node .github/scripts/build-demo.mjs --out .codex-tmp/pages-artifact` 产物含上述两文件
- [ ] 部署后 curl https://xxx91n.github.io/boxing/demo/ntp.css → 200 text/css
- [ ] 部署后 curl https://xxx91n.github.io/boxing/demo/ → 200 且目视有主题色/布局（非裸 HTML）
- [ ] 部署后 curl https://xxx91n.github.io/boxing/privacy-policy.html → 200 且含 “Boxing Privacy Policy” 与 Last updated
- [ ] 报告写明全部 curl 状态码与 build-demo JSON 输出

## Out of scope

- 恢复整个 docs/ Jekyll 站（Actions 模式下有意不服务 docs/**）
- demo 功能/数据/i18n 问题
- 与票 40（CSS 花括号）可并行；本票与 40 均进入票 46 发行门禁
