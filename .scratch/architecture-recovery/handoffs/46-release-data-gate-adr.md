# Handoff — 46 发行数据门禁策略 + ADR-0017 + 发行检查单

## 票面
- Issue: issues/46-release-data-gate-adr.md
- Spec: spec.md（企业级数据容灾与发布门控）
- 调研: atomcode 2026-09-11（source=atomcode，22 源）
- Blocked by: 40,42,45

## 完成定义
遵循 issues/46-release-data-gate-adr.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/46-release-data-gate-adr.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md
5. docs/CONTEXT.md
6. docs/adr/0009-3-2-1-data-resilience.md
7. docs/adr/0016-sync-backup-engine-layering.md
8. 相关源文件见本票文件面

## 本票 delta
纯文档票；依赖 40/42/45 落地后的事实描述。

## 文件面
docs/adr/0017-*.md · docs/CONTEXT.md · .scratch/architecture-recovery/WORKFLOW.md · docs/history/

## 调研依赖（atomcode-research）
高。工业心智模型必须以 atomcode 结论为准，禁止幻觉推理；可回顾 docs/adr 与 docs/CONTEXT.md。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "浏览器扩展发布门禁（release gate）工业清单：CI 必绿、人工黄金路径、商店百分比发布、CWS Rollback 兼容义务。对比 Chrome Web Store 与 Firefox AMO 渠道差异，给出可写入项目 WORKFLOW 的最小门禁条款与事故复盘模板要点。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: .scratch/architecture-recovery/reports/46-release-data-gate-adr-report.md
- 报告路径必须写进本窗口最终回复
