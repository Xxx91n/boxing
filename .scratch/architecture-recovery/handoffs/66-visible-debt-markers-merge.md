# Handoff — 66 用户可见债务标记合并清理（P2）

## 票面
- Issue: issues/66-visible-debt-markers-merge.md
- Spec: spec.md（Wave7 节）
- Ledger: decision-ledger.md 覆盖 A-020
- Blocked by: None (can start immediately)

## 完成定义
遵循 handoff 内的完成定义：AC 全勾 + 报告落 reports/66-report.md + 验证命令结果可复核。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/66-visible-debt-markers-merge.md
2. spec.md（Wave7）
3. decision-ledger.md A-020
4. WORKFLOW.md §4.2
5. AGENTS.md
6. docs/CONTEXT.md
7. ntp/index.html
8. ntp/i18n.js
9. ntp/storage.js

## 本票 delta
- ntp/index.html,- ntp/i18n.js 文案

## 通用调研要求（每票一次，启动器不复述）
需要工业成熟方案时必须 atomcode 深度调研，并回顾 docs/adr 与 docs/CONTEXT.md 心智模型，对标工业级落地；禁止幻觉推理。
（本票若无新增调研问题，可复用 Wave5/6/7 已索引 atomcode 结论，需在报告注明来源。）

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:atomcode -p "..."}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑。

## 完成时
报告写入 reports/66-report.md；但 commit 按 §4.2；不擅自 push/tag/close #9。
