# Handoff — 60 ntp 新开标签零闪现（FART+内容遮罩）（P1）

## 票面
- Issue: issues/60-ntp-new-tab-zero-flash.md
- Spec: spec.md（Wave7 节）
- Ledger: decision-ledger.md 覆盖 A-013, A-014（范围 A-012）
- Blocked by: None (can start immediately)

## 完成定义
遵循 handoff 内的完成定义：AC 全勾 + 报告落 reports/60-report.md + 验证命令结果可复核。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/60-ntp-new-tab-zero-flash.md
2. spec.md（Wave7）
3. decision-ledger.md A-013/A-014
4. WORKFLOW.md §4.2
5. AGENTS.md
6. docs/CONTEXT.md（zero-flash / paint-critical boot mirror）
7. docs/adr/0012-curated-theme-packs.md
8. docs/adr/0017-release-data-gate.md
9. ntp/ntp.js
10. ntp/persist.js
11. ntp/index.html
12. ntp/storage.js

## 本票 delta
- 主路径 ntp/index.html + ntp/ntp.js init + ntp/persist.js + 可能 ntp/boot-theme.js,- 禁解耦 loadLayout/renderCanvas

## 通用调研要求（每票一次，启动器不复述）
需要工业成熟方案时必须 atomcode 深度调研，并回顾 docs/adr 与 docs/CONTEXT.md 心智模型，对标工业级落地；禁止幻觉推理。
（本票若无新增调研问题，可复用 Wave5/6/7 已索引 atomcode 结论，需在报告注明来源。）

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:atomcode -p "..."}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑。

## 完成时
报告写入 reports/60-report.md；但 commit 按 §4.2；不擅自 push/tag/close #9。
