# Handoff — 票 14 quarantine 车道治理补强

## 任务

给既有 @quarantine 标签逐条挂 issue 引用 (指向本 scratch issues 编号), 登记 30 天修复/退役时限到 README 状态表, 并在 CI 工作流增加每日定时 job 跑 quarantine 车道 (continue-on-error)。

## 阻塞
Blocked by: None — can start immediately

## 本票专属 delta

- 先跑一遍 npm run test:quarantine 拿基线再动工
- rg 全部 @quarantine 命中逐条挂引用, 一条不漏
- CI job 改动在 .github/workflows; 若仓库无 workflows 则不虚构, 记手验项

## 相关 ADR

- 无

## 完成定义
- issue 验收清单全勾; npm test 全绿 (本机满负载抖动: 超时项单跑必绿为准); 拆分类票另需 npm run build 绿 + dist 契约不变 (WORKFLOW §4.1)。
- 版本控制遵循 WORKFLOW §4.2。
- 验收勾稽与新教训写回本票 issue 文件与 WORKFLOW §6。

## 建议 skills
/implement → /code-review; 联网调研若必须, 走 ctx 包裹 atomcode 串行。
