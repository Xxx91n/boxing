# Handoff — 02 README/locale/TRANSLATIONS 同步

## 票面
- Issue: issues/02-readme-sync.md
- Spec: spec.md
- GitHub: milestone 2026.9.12
- Blocked by: None

## 完成定义
遵循 handoff 内的完成定义（本节）与 issues/02-readme-sync.md 验收项。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/02-readme-sync.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md（工具路由、CSS dual-write、i18n、安全规则）
5. docs/CONTEXT.md
6. 相关 ADR（见本票 delta）
7. 38-2026-09-12-release-architecture-investigation.md（对应小节）

## 本票 delta
英文 README Install/徽章/截图为 source of truth；补齐 13 个 docs/i18n/README.*.md 的 Screenshots 表、Brand Assets、准确 Install；TRANSLATIONS.md 全 Available；废弃或重写 scripts/gen-i18n-readme.js 禁止覆盖人工翻译。版本徽章统一留给 08，本票不硬改版本号（避免与 08 冲突时以 08 为准）。

## 调研依赖（atomcode-research）
中。成熟模式：单一英文源 + 链接式 locale 门面，或完整翻译。需决定 docs 团推荐哪一种（GitHub 官方多语言 README 实践）。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "作为浏览器扩展架构调研员，结合本项目 docs/adr/ 与 docs/CONTEXT.md 已固化的心智模型，为当前票据寻找工业级成熟方案而非自研。综合学术与工业实践，回答：针对本票据主题，当前业界最成熟的落地心智模型是什么？有哪些已验证的开源/官方轮子？哪个最贴合本项目 MV3 + 14 locale + Playwright 的架构？需要补充哪些缺口？给出可引用来源。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。

## 回报
- 最后必写报告文件: .scratch/architecture-recovery/reports/02-readme-sync-report.md
- 报告含: 变更摘要、验收对照、测试结果、残留风险、教训（若有）

## Suggested skills
- atomcode-research（若本票标记需要）
- but（提交）
- playwright（若涉及 UI/测试）
