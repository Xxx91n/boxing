# Handoff — 42R COW 测试 harness 返工

## 票面
- Issue: issues/42R-cow-test-harness-fix.md
- 首脑复核: reports/W2-wave5-brain-review.md（42 FAIL）
- 基线: 票 42 产品代码已在 ticket-42-update-cow-before-migrate（勿重写 COW 序）
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/42R-cow-test-harness-fix.md 全部验收项 + 报告追加返工轮次。

## 版本控制
遵循 WORKFLOW §4.2。

## 必读
1. issues/42R-cow-test-harness-fix.md
2. reports/W2-wave5-brain-review.md
3. reports/42-update-cow-before-migrate-report.md
4. test/tests/boxing-update-cow-before-migrate.spec.ts
5. ntp/ntp.js（pagehide/flush + init 827–832）
6. ntp/persist.js（flushPendingViewStatePersist → saveLayout）
7. ntp/storage.js（ensurePreUpdateSnapshot / needsMigration）
8. AGENTS.md

## 本票 delta
只改测试 harness（及必要时最小产品补丁并单独论证）；中和 unload 覆盖；绿跑勾 AC。

## 文件面
test/tests/boxing-update-cow-before-migrate.spec.ts · 可能 ntp/persist.js（仅若需测试钩子）

## 调研依赖
低。根因已由 general-4 插桩证实。

## 完成时
- 报告追加: reports/42-update-cow-before-migrate-report.md 内「## 返工轮次 42R」节（不覆盖原文）
- 路径写进最终回复
