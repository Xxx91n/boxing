# Handoff — 48 CI 残红清零（修绿优先+受控豁免）

## 票面
- Issue: issues/48-ci-residual-red-clear.md
- Spec: spec.md（Wave6 节）
- Ledger: decision-ledger.md 覆盖 A-001, A-002, A-008, A-007
- Blocked by: None (can start immediately)

## 完成定义
遵循 issues/48-ci-residual-red-clear.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/48-ci-residual-red-clear.md
2. spec.md（Wave6）
3. decision-ledger.md
4. WORKFLOW.md §4.2 / §4.3 / §4.4
5. AGENTS.md
6. docs/CONTEXT.md
7. docs/adr/0009-3-2-1-data-resilience.md
8. docs/adr/0017-release-data-gate.md
9. test/playwright.config.ts
10. test/tests/*
11. docs/history/2026-09-12-wave5-closeout-backlog.md

## 本票 delta
残红清单以 main 最近 test.yml failed run 为基线；豁免台账写入 WORKFLOW §4.4；never-quarantine 名单见 spec W6-D3。

## 通用调研要求（每票一次，启动器不复述）
需要工业成熟方案时必须 atomcode 深度调研，并回顾 docs/adr 与 docs/CONTEXT.md 心智模型，对标工业级落地；禁止幻觉推理。
atomcode -p "主干 CI 存量残红测试治理：修绿优先与受控豁免台账的工业实践，flaky 与 broken 分界，数据完整性测试 never-quarantine，硬到期 SLA。"

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: reports/48-ci-residual-red-clear-report.md
- 报告路径必须写进本窗口最终回复
