# Handoff — 08 版本字符串统一 + version_name 注入

## 票面
- Issue: issues/08-version-unify.md
- Spec: spec.md
- GitHub: milestone 2026.9.12
- Blocked by: 01 icons, 02 readme-sync, 03 store-i18n

## 完成定义
遵循 handoff 内的完成定义（本节）与 issues/08-version-unify.md 验收项。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/08-version-unify.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md（工具路由、CSS dual-write、i18n、安全规则）
5. docs/CONTEXT.md
6. 相关 ADR（见本票 delta）
7. 38-2026-09-12-release-architecture-investigation.md（对应小节）

## 本票 delta
manifest/package/README 徽章/CHANGELOG/AGENTS.md/ntp/index.html 页脚 → 2026.9.12；修复 build.mjs 使 BOXING_BUILD_VERSION 同时覆盖 version 与 version_name；settings 页脚不再显示 v3.6.6。

## 调研依赖（atomcode-research）
低。清单已在 investigation §2；核对 calver 与 AMO 版本占用即可。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "作为浏览器扩展架构调研员，结合本项目 docs/adr/ 与 docs/CONTEXT.md 已固化的心智模型，为当前票据寻找工业级成熟方案而非自研。综合学术与工业实践，回答：针对本票据主题，当前业界最成熟的落地心智模型是什么？有哪些已验证的开源/官方轮子？哪个最贴合本项目 MV3 + 14 locale + Playwright 的架构？需要补充哪些缺口？给出可引用来源。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。

## 回报
- 最后必写报告文件: .scratch/architecture-recovery/reports/08-version-unify-report.md
- 报告含: 变更摘要、验收对照、测试结果、残留风险、教训（若有）

## Suggested skills
- atomcode-research（若本票标记需要）
- but（提交）
- playwright（若涉及 UI/测试）
