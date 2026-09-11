# Handoff — 41 快照分键存储 + Time Machine 分层轮转

## 票面
- Issue: issues/41-snapshot-key-split-rotation.md
- Spec: spec.md（企业级数据容灾与发布门控）
- 调研: atomcode 2026-09-11（source=atomcode，22 源）
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/41-snapshot-key-split-rotation.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/41-snapshot-key-split-rotation.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md
5. docs/CONTEXT.md
6. docs/adr/0009-3-2-1-data-resilience.md
7. docs/adr/0016-sync-backup-engine-layering.md
8. 相关源文件见本票文件面

## 本票 delta
主战场 ntp/persist.js 或 ntp/storage.js 的快照子系统；兼容 ADR-0009 字段；不改 sync 传输。

## 文件面
ntp/persist.js · ntp/storage.js · ntp/state.js · docs/adr/0009 · docs/CONTEXT.md（术语）

## 调研依赖（atomcode-research）
高。工业心智模型必须以 atomcode 结论为准，禁止幻觉推理；可回顾 docs/adr 与 docs/CONTEXT.md。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "浏览器扩展 storage.local 快照轮转工业实践：Chrome Enterprise UserDataSnapshotRetentionLimit、Time Machine 分层、Sidebery #1057 单键事故、MetaMask 大键丢失。推荐 MV3 扩展的快照键命名、index 形态、轮转算法与配额预算；给出可引用来源。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: .scratch/architecture-recovery/reports/41-snapshot-key-split-rotation-report.md
- 报告路径必须写进本窗口最终回复
