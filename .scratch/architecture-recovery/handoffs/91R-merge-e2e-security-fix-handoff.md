# Handoff — Ticket 91R: 凭据清除 + e2e 可加载（A-045）

> Covers: A-045 · Blocked by: None · 返工自 ticket 91  
> Spec: spec.md · Issue: issues/91R-merge-e2e-security-fix.md · 首脑: reports/W1-brain-review.md

## 一句话

清除 91 票 e2e 中的明文 WebDAV 凭据，并修复 `fileURLToPath` 缺失导入，使 suite 可加载；**不回滚** merge 产品实现。

## 必读

| 用途 | 路径 |
|---|---|
| 本票 | issues/91R-merge-e2e-security-fix.md |
| 原票 91 | issues/91-merge-three-way-b55.md |
| 原报告 | reports/91-report.md（只追加） |
| 首脑复核 | reports/W1-brain-review.md |
| Spec | spec.md |
| A 账本 | decision-ledger.md |
| 门禁 | docs/adr/0017-release-data-gate.md |
| 过程 | WORKFLOW.md §4.2 |

## 实物问题（已验证，禁止再「自述一致」）

1. `test/tests/boxing-merge-three-way.spec.ts` L26–28：真实 URL/邮箱/密码（commit 38a2d005）。  
2. 同文件 L21 只 import `pathToFileURL`，L23 使用 `fileURLToPath` → Playwright list = 0 tests。

## 通用调研

本返工以首脑已核验缺陷为输入；仍须快速回顾 CONTEXT/ADR 是否被 91 改动波及，结论写入返工章节。深度 atomcode 可跳过若缺陷修复为机械单行+删密（在报告注明跳过理由）。

## 完成定义

AC 全勾；报告追加 91R；账本 A-045 保持 blocked-rework 直至用户 push+CI。  
版本控制遵循 WORKFLOW §4.2。

## 禁止

- 恢复任何真实凭据  
- force-push / 改写 38a2d005 历史（除非用户明令）  
- 回滚 mergeLayoutThreeWay  
- 宣称 CI 绿
