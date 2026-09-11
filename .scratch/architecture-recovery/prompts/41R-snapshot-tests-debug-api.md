# 窗口启动器 — 41R 快照测试与 debug API 补齐

身份: Boxing 子窗口实施代理，只做 41R，不跨票。这是对票 41 FAIL 的修复窗。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/reports/45R-wave5-w1-brain-review.md
- .scratch/architecture-recovery/issues/41R-snapshot-tests-debug-api.md
- .scratch/architecture-recovery/handoffs/41R-snapshot-tests-debug-api.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2 / §4.3）
- AGENTS.md
- ntp/storage.js
- ntp/ntp.js（__boxingDebug）
- test/tests/boxing-settings-persist.spec.ts
- test/cluster-map.json

## 阻塞
None — can start immediately

## 本票 delta
暴露快照 debug API；重写 spec 真调用 API；迁移用例；cluster-map；迁移成功才置 flag。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 禁止空壳断言；禁止 chrome.storage 作 file:// 主 seam；禁止虚假「N checks passed」。
- 不改写他人提交；不动 40/42–47 票文件。

## 开工第一句（必须先输出）
1. 复述阻塞状态
2. 复述必读清单
3. 逐条复述首脑对 41 的 FAIL 清单（测试空壳 / 3 failed / 无 __boxingDebug 暴露 / CM-1 / 报告虚假）
4. 声明「我会先重跑现有 spec 确认 3 failed 基线，再改代码」
5. 然后才动手

## 质检门（完成前）
- 必须贴出 playwright 原始 passed 行
- 必须贴出 cluster-map 登记行 + guard ok
- 报告禁止只写结论不写命令输出

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/41R-snapshot-tests-debug-api-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
