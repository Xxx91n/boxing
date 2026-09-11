# 47 — Demo Pages 缺失 ntp.css 导致整页无样式

**What to build:** 修复 GitHub Pages demo（/boxing/demo/）整页无 CSS 渲染：demo-deploy 流水线在打包前必须生成 gitignored 的构建产物 ntp.css，并在产物中校验其存在；部署后 /demo/ 与 /demo/ntp.css 均 HTTP 200 且视觉带样式。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## 已查证根因（2026-09-11 实测，非猜测）

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

结论：Pages 工件缺主样式表 → 浏览器回退默认 UA 样式 → 用户所见「全是文字」。

## 验收

- [ ] demo-deploy.yml 在 Assemble 前执行生成 ntp.css 的构建步骤（遵循 BX-XPLAT-001：优先调用 build.mjs 或其 CSS 拼接入口，禁止复制粘贴第二套拼接逻辑）
- [ ] build-demo.mjs 在 ntp.css 缺失或 size=0 时 process.exit(1)（fail-closed）
- [ ] workflow 在 upload-pages-artifact 前断言 pages-artifact/demo/ntp.css 存在
- [ ] 本地 `node .github/scripts/build-demo.mjs --out .codex-tmp/pages-artifact` 后产物含 ntp.css
- [ ] 部署后 curl https://xxx91n.github.io/boxing/demo/ntp.css → 200 text/css
- [ ] 部署后 curl https://xxx91n.github.io/boxing/demo/ → 200 且目视有主题色/布局（非裸 HTML）
- [ ] 报告写明 curl 状态码与 build-demo JSON 输出

## Out of scope

- demo 功能/数据/ i18n 问题
- 与票 40 CSS 花括号修复可并行；两者都影响「可发行」宣称（票 46 门禁）
