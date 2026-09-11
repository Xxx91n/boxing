# 窗口启动器 — 42R COW 测试 harness 返工

身份: Boxing 子窗口实施代理，只做 42R。对票 42 FAIL 的修复窗。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/reports/W2-wave5-brain-review.md
- .scratch/architecture-recovery/issues/42R-cow-test-harness-fix.md
- .scratch/architecture-recovery/handoffs/42R-cow-test-harness-fix.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2）
- AGENTS.md
- test/tests/boxing-update-cow-before-migrate.spec.ts
- ntp/ntp.js · ntp/persist.js · ntp/storage.js

## 阻塞
None — can start immediately

## 本票 delta
中和 unload flush；T42-1 绿；3/3 passed；报告追加返工轮次；不改 COW 产品序。

## 硬约束
- 版本控制只写「遵循 WORKFLOW §4.2」。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 禁止无绿跑勾 AC；禁止覆盖原报告，只追加「返工轮次」。

## 开工第一句（必须先输出）
1. 复述阻塞状态
2. 复述必读清单
3. 复述首脑 FAIL：T42-1 snapCount=0 + unload flush 覆盖 seed
4. 声明先重跑基线再改代码
5. 然后动手

## 质检门
- 必须贴 playwright 原始 passed 行
- 必须贴中和 flush 的具体手法

## 完成时
- 报告追加节路径写进最终回复
