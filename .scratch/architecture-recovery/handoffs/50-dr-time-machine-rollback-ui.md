# Handoff — 50 Time Machine 一键回滚 UI + 恢复前安全快照

## 票面
- Issue: issues/50-dr-time-machine-rollback-ui.md
- Spec: spec.md（Wave6 节）
- Ledger: decision-ledger.md 覆盖 A-001, A-003, A-011
- Blocked by: None (can start immediately)

## 完成定义
遵循 issues/50-dr-time-machine-rollback-ui.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/50-dr-time-machine-rollback-ui.md
2. spec.md（Wave6）
3. decision-ledger.md
4. WORKFLOW.md §4.2 / §4.3 / §4.4
5. AGENTS.md
6. docs/CONTEXT.md
7. docs/adr/0009-3-2-1-data-resilience.md
8. docs/adr/0017-release-data-gate.md
9. ntp/storage.js
10. ntp/settings-ui.js
11. ntp/index.html
12. test/tests/data-recovery.spec.ts

## 本票 delta
实现 restoreFromSnapshot 的设置入口与 pre-restore 安全快照；文件面以 storage 门面为准。

## 通用调研要求（每票一次，启动器不复述）
需要工业成熟方案时必须 atomcode 深度调研，并回顾 docs/adr 与 docs/CONTEXT.md 心智模型，对标工业级落地；禁止幻觉推理。
atomcode -p "本地优先扩展时间机器回滚 UI：快照列表、二次确认、恢复前安全快照的成熟产品交互。"

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: reports/50-dr-time-machine-rollback-ui-report.md
- 报告路径必须写进本窗口最终回复
