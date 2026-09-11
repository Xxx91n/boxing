# Handoff — 45 CI 数据兼容性门控：golden fixture + 迁移/回滚测试

## 票面
- Issue: issues/45-ci-data-golden-gates.md
- Spec: spec.md（企业级数据容灾与发布门控）
- 调研: atomcode 2026-09-11（source=atomcode，22 源）
- Blocked by: 41

## 完成定义
遵循 issues/45-ci-data-golden-gates.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/45-ci-data-golden-gates.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md
5. docs/CONTEXT.md
6. docs/adr/0009-3-2-1-data-resilience.md
7. docs/adr/0016-sync-backup-engine-layering.md
8. 相关源文件见本票文件面

## 本票 delta
test/ 新 spec + fixtures；不改产品逻辑除非迁移测试暴露真 bug（另票）。

## 文件面
test/tests/boxing-migration-golden.spec.ts（新） · test/fixtures/schema/ · test/cluster-map.json

## 调研依赖（atomcode-research）
高。工业心智模型必须以 atomcode 结论为准，禁止幻觉推理；可回顾 docs/adr 与 docs/CONTEXT.md。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "Android Room exportSchema+MigrationTestHelper、CWS rollback 前向兼容要求、PlanetScale expand/contract。浏览器扩展如何在 CI 中做 storage JSON schema 的 golden fixture 迁移测试与回滚演练？给出目录布局与断言清单。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: .scratch/architecture-recovery/reports/45-ci-data-golden-gates-report.md
- 报告路径必须写进本窗口最终回复
