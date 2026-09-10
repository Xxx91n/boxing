# Handoff — 04 Sync 页视觉分组

## 票面
- Issue: issues/04-sync-ui.md
- Spec: spec.md
- GitHub: milestone 2026.9.12
- Blocked by: None

## 完成定义
遵循 handoff 内的完成定义（本节）与 issues/04-sync-ui.md 验收项。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/04-sync-ui.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md（工具路由、CSS dual-write、i18n、安全规则）
5. docs/CONTEXT.md
6. 相关 ADR（见本票 delta）
7. 38-2026-09-12-release-architecture-investigation.md（对应小节）

## 本票 delta
视觉分组: Shared 设置 vs WebDAV 配置 vs GitHub Gist 配置；local 隐藏 remote-backup-zone。
仅改 ntp/index.html tab-sync 与 ntp/settings.css（必要时 settings-ui.js 绑定）；共享字段 vs webdav-config vs gist-config 做分组标题/卡片；保持 sync-engine.js 互斥逻辑；新增 Playwright 互斥断言。CSS 改动遵循 docs/css-dual-write-convention.md。

## 调研依赖（atomcode-research）
中低。工业模式：设置页 provider 分组（子选项卡 vs 字段集 legend）。参考 Firefox/Chrome 扩展 settings 常见 IA。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "作为浏览器扩展架构调研员，结合本项目 docs/adr/ 与 docs/CONTEXT.md 已固化的心智模型，为当前票据寻找工业级成熟方案而非自研。综合学术与工业实践，回答：针对本票据主题，当前业界最成熟的落地心智模型是什么？有哪些已验证的开源/官方轮子？哪个最贴合本项目 MV3 + 14 locale + Playwright 的架构？需要补充哪些缺口？给出可引用来源。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。

## 回报
- 最后必写报告文件: .scratch/architecture-recovery/reports/04-sync-ui-report.md
- 报告含: 变更摘要、验收对照、测试结果、残留风险、教训（若有）

## Suggested skills
- atomcode-research（若本票标记需要）
- but（提交）
- playwright（若涉及 UI/测试）
