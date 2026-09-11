# 窗口启动器 — 45R gate2 写路径扫描

身份: Boxing 子窗口实施代理，只做 45R。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/reports/W2-wave5-brain-review.md
- .scratch/architecture-recovery/issues/45R-gate2-write-path-scan.md
- .scratch/architecture-recovery/handoffs/45R-gate2-write-path-scan.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2）
- AGENTS.md
- test/tests/boxing-data-golden.spec.ts
- background.js

## 阻塞
None — can start immediately

## 本票 delta
gate2 禁止子串 not.toContain('boxingLayout')；改为写调用扫描；允许 t42 合法读；报告 SHA 纠正。

## 硬约束
- 版本控制只写「遵循 WORKFLOW §4.2」。
- 禁止改 t42 读路径迁就旧断言。

## 开工第一句（必须先输出）
1. 复述阻塞状态
2. 复述必读清单
3. 复述首脑结论：gate2 与 t42 读碰撞 + ba1e7e9 dangling
4. 先重跑 data-golden 确认 gate2 FAIL 基线
5. 然后动手

## 质检门
- 贴 gate2 修复后 passed 行
- 贴 migration-golden 仍 4 passed
- 贴 pretest guard ok

## 完成时
- 报告追加节路径写进最终回复
