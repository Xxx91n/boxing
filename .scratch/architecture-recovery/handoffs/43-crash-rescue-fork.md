# Handoff — 43 crash rescue 改为 fork：归档损坏主键再重建

## 票面
- Issue: issues/43-crash-rescue-fork.md
- Spec: spec.md（企业级数据容灾与发布门控）
- 调研: atomcode 2026-09-11（source=atomcode，22 源）
- Blocked by: 41

## 完成定义
遵循 issues/43-crash-rescue-fork.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/43-crash-rescue-fork.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md
5. docs/CONTEXT.md
6. docs/adr/0009-3-2-1-data-resilience.md
7. docs/adr/0016-sync-backup-engine-layering.md
8. 相关源文件见本票文件面

## 本票 delta
persist.js loadLayout/crashRescue + settings-ui 数据展示；依赖 41 快照 API。

## 文件面
ntp/persist.js · ntp/settings-ui.js · ntp/utils.js · test/tests/data-recovery.spec.ts

## 调研依赖（atomcode-research）
高。工业心智模型必须以 atomcode 结论为准，禁止幻觉推理；可回顾 docs/adr 与 docs/CONTEXT.md。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "存储损坏恢复的 fork vs overwrite 语义：Dropbox conflicted copy、1Password item history、VS Code Local History、Adblock Plus #6599 storage 损坏处理。扩展在 chrome.storage.local 读失败时应如何归档损坏载荷并提示用户？给出状态机与文案要点。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: .scratch/architecture-recovery/reports/43-crash-rescue-fork-report.md
- 报告路径必须写进本窗口最终回复
