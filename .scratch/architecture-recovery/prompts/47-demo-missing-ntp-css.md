# 窗口启动器 — 47 Pages 工件完整性（ntp.css + privacy-policy）

身份: Boxing 子窗口实施代理，只做本票，不跨票。

## 必读（动手前全部读完）
- .scratch/architecture-recovery/handoffs/47-demo-missing-ntp-css.md
- .scratch/architecture-recovery/issues/47-demo-missing-ntp-css.md
- .scratch/architecture-recovery/spec.md
- .scratch/architecture-recovery/WORKFLOW.md （§4.2 / §4.3）
- AGENTS.md
- .github/workflows/demo-deploy.yml
- .github/scripts/build-demo.mjs
- .github/scripts/build.mjs
- docs/privacy-policy.md
- docs/adr/0011-ntp-css-build-artifact.md

## 阻塞
None — can start immediately

## 本票 delta
生成 ntp.css + 根路径 privacy-policy.html；工件双文件 fail-closed；不改 NTP 业务逻辑。

## 硬约束
- 版本控制表述只写「遵循 WORKFLOW §4.2」，禁止出现任何版本控制命令原词。
- 完成定义只写「遵循 handoff 内的完成定义」。
- 需要成熟方案时：用 handoff 内 atomcode 提示词 + ctx_batch_execute 串行调用；并回顾 docs/adr 与 docs/CONTEXT.md。
- 不改写他人提交；不动其他票文件。
- 禁止第二套 CSS 拼接逻辑（BX-XPLAT-001）。
- 禁止新增 npm 依赖（CRX-R-009）。

## 开工第一句（必须先输出）
1. 复述阻塞状态：None — can start immediately
2. 复述必读清单（逐条路径）
3. 复述已查证根因（ntp.css 404 + privacy-policy.html 404 + Actions 只服务工件）
4. 然后才开始读文件/改代码

## 完成时
- 遵循 handoff 内的完成定义
- 写报告: .scratch/architecture-recovery/reports/47-demo-missing-ntp-css-report.md
- 给主 Agent 的报告文件路径必须写进本窗口最终回复
