# Handoff — 43R fork 写路径防覆盖 + 测试返工

## 票面
- Issue: issues/43R-fork-test-harness-fix.md
- 首脑复核: reports/W2-wave5-brain-review.md（43 FAIL + 子代理 P0）
- 基线: ticket-43-crash-rescue-fork 产品代码已存在（loadLayout fork 有；saveLayout 无防）
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
5. ntp/storage.js loadLayout fork + archiveCorruptMain + **saveLayout L491–501**
6. ntp/ntp.js unload flush
7. ntp/utils.js isPlausibleLayout
8. AGENTS.md

## 本票 delta
**产品**：saveLayout 非 plausible → archiveCorruptMain 再恢复（禁止无归档覆盖）；legacy 写路径同步。**测试**：竞态修复 + 用例绿。issue 同步 + 报告追加。

## 文件面
ntp/storage.js（saveLayout + legacy 分支） · test/tests/data-recovery.spec.ts · issues/43 状态

## 调研依赖
低。根因已由 general-5 定位。

## 完成时
- 报告追加: reports/43-crash-rescue-fork-report.md「## 返工轮次 43R」
- 路径写进最终回复
