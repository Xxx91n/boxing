# Handoff — 40 P0 修复 settings.css 缺失花括号导致 hidden 遮罩失效

## 票面
- Issue: issues/40-css-hidden-brace-p0.md
- Spec: spec.md（企业级数据容灾与发布门控）
- 调研: atomcode 2026-09-11（source=atomcode，22 源）
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/40-css-hidden-brace-p0.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/40-css-hidden-brace-p0.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md
5. docs/CONTEXT.md
6. docs/adr/0009-3-2-1-data-resilience.md
7. docs/adr/0016-sync-backup-engine-layering.md
8. 相关源文件见本票文件面

## 本票 delta
只动 settings.css（补一个 }）+ 必要时 onboarding.css 拼接边界；不改 JS 行为；build 后跑 onboarding+extension-test。

## 文件面
ntp/settings.css · ntp/ntp.css（build 产物） · test/tests/boxing-onboarding.spec.ts · test/tests/extension-test.spec.ts

## 调研依赖（atomcode-research）
高。工业心智模型必须以 atomcode 结论为准，禁止幻觉推理；可回顾 docs/adr 与 docs/CONTEXT.md。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "对比 CSS Nesting 规范与各大浏览器对「属性选择器嵌套在父规则内」的解析差异：当 .modal-overlay 未闭合时 .modal-overlay[hidden] 被当作后代还是嵌套复合选择器？给出 Chrome/Firefox 对 display:flex 覆盖 HTML hidden 属性的权威说明与构建期可自动化的括号平衡校验最佳实践。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 完成时
- 报告: .scratch/architecture-recovery/reports/40-css-hidden-brace-p0-report.md
- 报告路径必须写进本窗口最终回复
