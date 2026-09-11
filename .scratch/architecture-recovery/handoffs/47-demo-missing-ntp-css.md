# Handoff — 47 Pages 工件完整性（ntp.css + privacy-policy）

## 票面
- Issue: issues/47-demo-missing-ntp-css.md
- Spec: spec.md（Related Ticket 47）
- 查证: 2026-09-11 live curl + 源码 + 票 07 报告预警
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/47-demo-missing-ntp-css.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/47-demo-missing-ntp-css.md
2. .github/workflows/demo-deploy.yml
3. .github/scripts/build-demo.mjs
4. .github/scripts/build.mjs（CSS 拼接入口）
5. docs/privacy-policy.md
6. docs/adr/0011-ntp-css-build-artifact.md
7. docs/store-assets/store-listings-2026-09.md（隐私 URL 权威口径）
8. demo/README.md
9. AGENTS.md（BX-XPLAT-001；CRX-R-009 禁新增 npm 依赖）

## 本票 delta
- workflow：Assemble 前生成 ntp.css；upload 前双文件断言
- build-demo.mjs：ntp.css fail-closed + 产出根路径 privacy-policy.html
- 不改 NTP 业务 JS；不恢复 docs/ Jekyll

## 文件面
.github/workflows/demo-deploy.yml · .github/scripts/build-demo.mjs · 可能触及 build.mjs 导出

## 调研依赖（atomcode-research）
低。两处 404 已 live 定谳。可选：

### 可选 atomcode -p 提示词
```
atomcode -p "GitHub Pages 从 Jekyll docs/ 切换到 Actions artifact 后，商店隐私政策 URL 与静态资源的工业迁移清单：应如何在无 Jekyll 环境下发布 privacy policy HTML，并对 upload-pages-artifact 做 fail-closed 校验？对比 CWS/AMO 对隐私政策 URL 可用性的要求。"
```

执行方式: ctx_batch_execute concurrency:1 timeout:600000。同会话仅一个 atomcode 在途。

## 完成时
- 报告: .scratch/architecture-recovery/reports/47-demo-missing-ntp-css-report.md
- 报告路径必须写进本窗口最终回复
