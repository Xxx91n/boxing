# Handoff — 44 导入/WebDAV 恢复改为合并+冲突副本，废除静默覆盖

## 票面
- Issue: issues/44-restore-merge-never-overwrite.md
- Spec: spec.md（企业级数据容灾与发布门控）
- 调研: atomcode 2026-09-11（source=atomcode，22 源）
- Blocked by: 43

## 完成定义
遵循 issues/44-restore-merge-never-overwrite.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/44-restore-merge-never-overwrite.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md
5. docs/CONTEXT.md
6. docs/adr/0009-3-2-1-data-resilience.md
7. docs/adr/0016-sync-backup-engine-layering.md
8. 相关源文件见本票文件面

## 本票 delta
persist/import + sync-engine mergeLayoutFields 策略；UI 确认框。

## 文件面
ntp/persist.js · ntp/sync-engine.js · ntp/settings-ui.js · ntp/utils.js

## 调研依赖（atomcode-research）
高。工业心智模型必须以 atomcode 结论为准，禁止幻觉推理；可回顾 docs/adr 与 docs/CONTEXT.md。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "浏览器扩展/笔记类应用导入恢复的工业合并语义：Raindrop import 永不覆盖、Dropbox conflicted copy、Syncthing 冲突文件、Chrome 书签 sync 双子树。推荐 Boxing 书签 JSON 导入与 WebDAV 冲突时的合并算法与冲突副本键设计。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: .scratch/architecture-recovery/reports/44-restore-merge-never-overwrite-report.md
- 报告路径必须写进本窗口最终回复
