# Handoff — 47 Demo Pages 缺失 ntp.css

## 票面
- Issue: issues/47-demo-missing-ntp-css.md
- Spec: spec.md（发行门禁相关；本票属 L3 可观测面）
- 查证: 2026-09-11 live curl + 源码（demo-deploy.yml / build-demo.mjs / .gitignore）
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/47-demo-missing-ntp-css.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/47-demo-missing-ntp-css.md
2. .github/workflows/demo-deploy.yml
3. .github/scripts/build-demo.mjs
4. .github/scripts/build.mjs（buildNtpCss / A8.0 段）
5. docs/adr/0011-ntp-css-build-artifact.md
6. ntp/index.html（stylesheet link）
7. .gitignore（ntp/ntp.css）
8. AGENTS.md（BX-XPLAT-001 单一构建入口）

## 本票 delta
- demo-deploy.yml：Assemble 前增加生成 ntp.css 的步骤（调用既有 build 入口）
- build-demo.mjs：对 ntp.css fail-closed
- 不改 NTP 业务 JS；不改 spec 中 DR 数据路径
- 若需 pull request 人工步骤：Pages Source 已是 GitHub Actions，无需再切

## 文件面
.github/workflows/demo-deploy.yml · .github/scripts/build-demo.mjs · 可能触及 .github/scripts/build.mjs 导出

## 调研依赖（atomcode-research）
低。根因已用 live HTTP + 源码定谳，无需再开 atomcode。若实施中要对比「静态站构建产物校验」工业门禁，可用下方提示词（可选）。

### 可选 atomcode -p 提示词
```
atomcode -p "GitHub Pages 静态站点流水线中，对 gitignored 构建产物（CSS/JS bundle）的工业级校验与 fail-closed 最佳实践：upload artifact 前应做哪些存在性/非空/内容哈希检查？对比 actions/upload-pages-artifact 与通用 upload-artifact 的守卫模式。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。

## 完成时
- 报告: .scratch/architecture-recovery/reports/47-demo-missing-ntp-css-report.md
- 报告路径必须写进本窗口最终回复
