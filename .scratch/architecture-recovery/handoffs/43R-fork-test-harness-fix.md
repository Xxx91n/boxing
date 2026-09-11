# Handoff — 43R fork 测试 harness 返工

## 票面
- Issue: issues/43R-fork-test-harness-fix.md
- 首脑复核: reports/W2-wave5-brain-review.md（43 FAIL）
- 基线: ticket-43-crash-rescue-fork 产品代码已存在
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/43R-fork-test-harness-fix.md + 报告追加返工轮次。

## 版本控制
遵循 WORKFLOW §4.2。

## 必读
1. issues/43R-fork-test-harness-fix.md
2. reports/W2-wave5-brain-review.md
3. reports/43-crash-rescue-fork-report.md
4. test/tests/data-recovery.spec.ts（Corrupt main key 用例）
5. ntp/storage.js loadLayout fork + archiveCorruptMain
6. ntp/ntp.js unload flush
7. ntp/utils.js isPlausibleLayout
8. AGENTS.md

## 本票 delta
只修 fork 验收 harness；issue 状态同步；报告追加。

## 文件面
test/tests/data-recovery.spec.ts · issues/43 状态

## 调研依赖
低。与 42 同类 unload 覆盖。

## 完成时
- 报告追加: reports/43-crash-rescue-fork-report.md「## 返工轮次 43R」
- 路径写进最终回复
