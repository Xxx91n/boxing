# Handoff — 42 onInstalled(update) 先 COW 快照再迁移

## 票面
- Issue: issues/42-update-cow-before-migrate.md
- Spec: spec.md（企业级数据容灾与发布门控）
- 调研: atomcode 2026-09-11（source=atomcode，22 源）
- Blocked by: 41

## 完成定义
遵循 issues/42-update-cow-before-migrate.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/42-update-cow-before-migrate.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md
5. docs/CONTEXT.md
6. docs/adr/0009-3-2-1-data-resilience.md
7. docs/adr/0016-sync-backup-engine-layering.md
8. 相关源文件见本票文件面

## 本票 delta
background.js onInstalled + ntp.js init/onboarding 触发链；依赖 41 的 saveSnapshot。

## 文件面
background.js · ntp/ntp.js · ntp/persist.js · ntp/onboarding.js

## 调研依赖（atomcode-research）
高。工业心智模型必须以 atomcode 结论为准，禁止幻觉推理；可回顾 docs/adr 与 docs/CONTEXT.md。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "MV3 扩展 chrome.runtime.onInstalled(update) 与迁移执行顺序的工业最佳实践：如何保证迁移前 COW？Chrome Enterprise 更新后快照、Android Room 迁移前备份、gh-ost cut-over 前校验的共性；给出扩展侧可落地的信号消费时序图建议。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: .scratch/architecture-recovery/reports/42-update-cow-before-migrate-report.md
- 报告路径必须写进本窗口最终回复
