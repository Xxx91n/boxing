# Handoff — 票 15 ADR 模板补 Consequences / 复核小节

## 任务

更新 docs/adr 模板约定: 新 ADR 必须包含 Consequences 小节与 30 天后复核日期; 在 AGENTS.md 或 docs/agents 指引中加一行引用要求; 存量 16 份 ADR 不批量重写, 自下一票起适用。

## 阻塞
Blocked by: None — can start immediately

## 本票专属 delta

- 参考模板: MADR 4.0 + joelparkerhenderson ADR 模板库 (结论在 ctx source=atomcode-arch-maturity, 勿重查)
- AGENTS.md 只加一行引用, 不复制模板全文

## 相关 ADR

- 无

## 完成定义
- issue 验收清单全勾; npm test 全绿 (本机满负载抖动: 超时项单跑必绿为准); 拆分类票另需 npm run build 绿 + dist 契约不变 (WORKFLOW §4.1)。
- 版本控制遵循 WORKFLOW §4.2。
- 验收勾稽与新教训写回本票 issue 文件与 WORKFLOW §6。

## 建议 skills
/implement → /code-review; 联网调研若必须, 走 ctx 包裹 atomcode 串行。
