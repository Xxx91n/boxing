# Handoff — 51 导出信封/完整包 + 覆盖必先副本 + RPO/RTO ADR

## 票面
- Issue: issues/51-dr-export-envelope-rpo.md
- Spec: spec.md（Wave6 节）
- Ledger: decision-ledger.md 覆盖 A-001, A-003, A-006, A-011
- Blocked by: None (can start immediately)

## 完成定义
遵循 issues/51-dr-export-envelope-rpo.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/51-dr-export-envelope-rpo.md
2. spec.md（Wave6）
3. decision-ledger.md
4. WORKFLOW.md §4.2 / §4.3 / §4.4
5. AGENTS.md
6. docs/CONTEXT.md
7. docs/adr/0009-3-2-1-data-resilience.md
8. docs/adr/0017-release-data-gate.md
9. ntp/settings-ui.js
10. ntp/storage.js
11. docs/adr/0009-3-2-1-data-resilience.md
12. docs/adr/0017-release-data-gate.md

## 本票 delta
实现 D-006 混合导出；覆盖必先副本；ADR RPO/RTO 修订。

## 通用调研要求（每票一次，启动器不复述）
需要工业成熟方案时必须 atomcode 深度调研，并回顾 docs/adr 与 docs/CONTEXT.md 心智模型，对标工业级落地；禁止幻觉推理。
（已由 Wave6 grill atomcode 完成导出策略调研，结论在 .scratch/wave6-dr-grill/decision-ledger.md；实施时复用，不重复全量调研除非有新问题。）

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: reports/51-dr-export-envelope-rpo-report.md
- 报告路径必须写进本窗口最终回复
