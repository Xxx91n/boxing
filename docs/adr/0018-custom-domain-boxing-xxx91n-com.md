# ADR-0018: Custom Domain boxing.xxx91n.com

## Date
2026-10-11

## Status
Accepted（Wave 2026.10.11 · D-002）

## Context
Boxing 扩展的在线预览（GitHub Pages demo）与公开隐私政策（privacy policy）此前托管于 GitHub Pages 默认仓库路径 `https://xxx91n.github.io/boxing/`。

该默认域名路径存在以下问题与约束：
1. **URL 前缀冗余**：所有站点公开资源均带有 `/boxing` 仓库名前缀（如 `/boxing/demo/`、`/boxing/privacy-policy.html`），不够规范统一。作为 Chrome Web Store、AMO 等扩展商店必填且向公众公示的隐私政策链接，缺乏独立域名与专业度。
2. **多处硬编码散落**：构建脚本（`build-demo.mjs`）、G-C 门禁探针（`pages-gc-verify.mjs`）、项目规范与文档（`CONTEXT.md`、`CHANGELOG.md`、`demo/README.md`、`ADR-0017`）多处散写旧域名，缺乏统一常量管理。

迁移至自定义独立域名 `boxing.xxx91n.com` 可彻底消除 `/boxing` 仓库路径前缀，站点根直接对应域名根（`/demo/`、`/privacy-policy.html`）。

## Decision
1. **绑定自定义域名**：
   - GitHub Pages 产物根目录写入 `CNAME` 文件，内容为 `boxing.xxx91n.com\n`，由构建脚本 `.github/scripts/build-demo.mjs` 在组装 Pages artifact 时自动生成。
   - 保持 `https_enforced: true`。
2. **建立全仓 URL 单源常量**：
   - 创建 `.github/scripts/site-constants.mjs`，导出 `SITE_URL = 'https://boxing.xxx91n.com'`、`PRIVACY_URL` 与 `DEMO_URL`，作为全仓公共站点的单一事实来源（Single Source of Truth）。
   - 构建脚本 `build-demo.mjs` 与探针 `scripts/pages-gc-verify.mjs` 统一从此单源导入常量，禁止散写硬编码。
3. **全仓 F2 清单迁移**：
   - 彻底清理仓库内对旧域名 `https://xxx91n.github.io/boxing/` 的硬编码引用（`pages-gc-verify.mjs`、`build-demo.mjs`、`CONTEXT.md`、`ADR-0017`、`CHANGELOG.md`、`demo/README.md`）。
4. **被否决的备选**：
   - **绑定 apex/www 等其他别名**：否决。Boxing 仅需子域名承载 NTP demo 与 privacy policy，绑定 `boxing.xxx91n.com` 即可，避免污染主域名解析与其他服务。
   - **在 DNS 解析生效前部署含 CNAME 的产物**：严厉否决。GitHub Pages 在检测到 CNAME 后会立即对所有旧 `xxx91n.github.io/boxing/` 路径下发 301 重定向指向新域；若 Spaceship DNS 尚未生效，将导致全站解析不可达，demo 与隐私政策直接断链。
   - **在代码与文档中继续分散硬编码 URL**：否决。必须通过单源常量维护，以绝日后维护漂移。

## Consequences
- 正面:
  - 站点根路径更加规范简洁（`https://boxing.xxx91n.com/demo/`、`https://boxing.xxx91n.com/privacy-policy.html`），去除 `/boxing` 冗余前缀。
  - 公开站点 URL 实现单源常数收敛，构建与验证脚本共用，消除了多处散落硬编码的维护风险。
  - GitHub Pages 官方机制对旧路径 `https://xxx91n.github.io/boxing/*` 自动提供 301 重定向，保证存量引用的向后兼容与平滑过渡。
- 负面/妥协:
  - **DNS 依赖与时序硬约束**：上线前必须由用户在 DNS 托管商（Spaceship）配置 `boxing` CNAME 指向 `xxx91n.github.io.`，并在 GitHub 完成账户/仓库级域名所有权验证；含 CNAME 的代码可以提前合入，但真实 release 部署必须在 DNS 验证通过后才能触发。
  - **商店后台人工维护成本**：Chrome Web Store 与 AMO 开发者控制台中的隐私政策 URL 需要在下次版本提交时人工更新至新域名。
- 中性/约束:
  - 仓库内公共 URL 必须严格引用 `.github/scripts/site-constants.mjs` 单源常量，禁止散写。
  - 仅绑定 `boxing.xxx91n.com`，不绑定其他别名；保持 `https_enforced: true`。

## Review
- 复核日期: 2026-11-11
- 复核项:
  1. `boxing.xxx91n.com` 域名解析与 HTTPS 证书签发是否正常生效。
  2. GitHub Pages 部署后 `verify:pages-gc` 针对新域名的三 URL 与 `version.json` 探针是否全绿。
  3. CWS 和 AMO 商店后台隐私政策链接是否已在下次发行提交时更新。
- 复核结论: （复核后回填）
