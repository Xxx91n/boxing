# 窗口启动器 — 43R fork 写路径防覆盖 + 测试返工

身份: Boxing 子窗口实施代理，只做 43R。对票 43 FAIL 的修复窗（含产品 P0）。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/reports/W2-wave5-brain-review.md
- .scratch/architecture-recovery/issues/43R-fork-test-harness-fix.md
- .scratch/architecture-recovery/handoffs/43R-fork-test-harness-fix.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2）
- AGENTS.md
- test/tests/data-recovery.spec.ts
- ntp/storage.js · ntp/ntp.js · ntp/utils.js

## 阻塞
None — can start immediately

## 本票 delta
**先修产品**：saveLayout 对非 plausible 主键先 archiveCorruptMain，禁止无归档覆盖；再修 E2E 竞态；issue 状态同步；报告追加返工轮次。

## 硬约束
- 版本控制只写「遵循 WORKFLOW §4.2」。
- 禁止只改测试不改 saveLayout 写路径。
- 禁止无绿跑宣称 done；禁止覆盖原报告。

## 开工第一句（必须先输出）
1. 复述阻塞状态
2. 复述必读清单
3. 复述首脑 FAIL：archiveKeys=0 **且** saveLayout 可无归档覆盖损坏主键
4. 先重跑 Corrupt main key 基线
5. 然后动手

## 质检门
- 贴 saveLayout 防覆盖改动要点
- 贴 playwright 原始 passed 行
- 贴 issues/43 状态同步

## 完成时
- 报告追加节路径写进最终回复
