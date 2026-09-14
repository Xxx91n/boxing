# Handoff — Wave9 收口归档（2026-09-14）

> 下一轮: land 93+94 → 9.15 G-A → 用户 G-B → tag/商店

## 一句话

Wave9 票 87–95 全部 implemented；硬验收本机全绿；版本面 2026.9.15；origin/main 仍 02d31657（9.12 面 + pre-bump 双绿 CI）；**93/94 栈未 push**。

## 必读

| 主题 | 路径 |
|---|---|
| 本 handoff | .scratch/architecture-recovery/handoffs/W9-closeout-handoff.md |
| 收口审计 | reports/W9-closeout-audit.md |
| 硬验收 JSON | reports/W9-closeout-hard-acceptance.json |
| Backlog | reports/W9-backlog.md |
| W1–W3 首脑 | reports/W1-brain-review.md · W2-brain-review-93.md · W3-brain-review-94.md |
| 账本 | decision-ledger.md A-040..A-049 |
| D 账本 | ../wave9-postrelease-grill/decision-ledger.md D-001..D-010 |
| 门禁 | docs/adr/0017-release-data-gate.md |
| 领域 | docs/CONTEXT.md Wave9 grill+settle |
| 发行检查单 | reports/94-report.md §4 |
| 版本控制 | WORKFLOW.md §4.2 · GitButler but |

## 已就绪

- merge three-way + syncBase；WebDAV 私网统一；凭据 env 化
- G-A pre-bump 双绿 run 34773593267 / 34778641702
- notes SSOT `docs/release-notes/2026.9.15.md`
- 栈: wave9-93 → wave9-94（未 push）

## 下一轮建议

1. **你明令** land/push 整栈
2. 盯新 tip test.yml → 关闭 9.15 G-A
3. 你 G-B 声明；发行后 G-C
4. 按 backlog B60–B70 裁定是否立票

## 禁止

- 未明令 push/tag/force-push
- agent 代签 G-B
- 宣称三门达成直至实测
- 恢复真实凭据

## Suggested skills

| 场景 | Skill |
|---|---|
| 版本控制 | GitButler `but` |
| 发行 | docs/publishing-guide.md |
| 实施 backlog | implement · tdd |
| 复核 | code-review |
| 根因 | diagnosing-bugs · research |
| 知识收尾 | neat-freak · handoff |
