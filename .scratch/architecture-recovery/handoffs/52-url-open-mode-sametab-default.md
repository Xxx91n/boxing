# Handoff — 52 新装/重置默认 sameTab（以实机为准）

## 票面
- Issue: issues/52-url-open-mode-sametab-default.md
- Spec: spec.md（Wave6 节）
- Ledger: decision-ledger.md 覆盖 A-001, A-004, A-005
- Blocked by: None (can start immediately)

## 完成定义
遵循 issues/52-url-open-mode-sametab-default.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/52-url-open-mode-sametab-default.md
2. spec.md（Wave6）
3. decision-ledger.md
4. WORKFLOW.md §4.2 / §4.3 / §4.4
5. AGENTS.md
6. docs/CONTEXT.md
7. docs/adr/0009-3-2-1-data-resilience.md
8. docs/adr/0017-release-data-gate.md
9. ntp/utils.js
10. ntp/settings-ui.js
11. ntp/ntp.js
12. ntp/popups.js
13. ntp/index.html

## 本票 delta
以实机验收为准；调查四类根因面（旧包/重置/首帧 DOM/残留写路径）。

## 通用调研要求（每票一次，启动器不复述）
需要工业成熟方案时必须 atomcode 深度调研，并回顾 docs/adr 与 docs/CONTEXT.md 心智模型，对标工业级落地；禁止幻觉推理。
（本票若无新增调研问题，可复用 Wave5/6 已索引 atomcode 结论，需在报告注明来源。）

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: reports/52-url-open-mode-sametab-default-report.md
- 报告路径必须写进本窗口最终回复
