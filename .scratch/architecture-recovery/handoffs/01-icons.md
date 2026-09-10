# Handoff — 01 icons 与 brand 策展图对齐

## 票面
- Issue: issues/01-icons.md
- Spec: spec.md
- GitHub: milestone 2026.9.12
- Blocked by: None

## 完成定义
遵循 handoff 内的完成定义（本节）与 issues/01-icons.md 验收项。

## 版本控制
遵循 WORKFLOW §4.2（GitButler but CLI；不 push、不开 PR，除非用户明确要求）。

## 必读
1. issues/01-icons.md
2. spec.md
3. WORKFLOW.md §4.2 / §4.3
4. AGENTS.md（工具路由、CSS dual-write、i18n、安全规则）
5. docs/CONTEXT.md
6. 相关 ADR（见本票 delta）
7. 38-2026-09-12-release-architecture-investigation.md（对应小节）

## 本票 delta
路径锚点: icons/, docs/brand/, manifest.json (icons/action.default_icon), .github/workflows/build.yml。
复制 docs/brand/icon_48.png 与 icon_128.png 覆盖 icons/；CI build.yml 图标步骤改为 copy-from-brand（保留 PNG 签名断言）。不要删除 icons/ 目录。ADR: 无新增；参考 docs/brand/README 若存在。

## 调研依赖（atomcode-research）
低。工业实践已定：以策展 brand 资产为唯一图标源。可快速核对 Firefox/Chrome 扩展图标尺寸惯例。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "作为浏览器扩展架构调研员，结合本项目 docs/adr/ 与 docs/CONTEXT.md 已固化的心智模型，为当前票据寻找工业级成熟方案而非自研。综合学术与工业实践，回答：针对本票据主题，当前业界最成熟的落地心智模型是什么？有哪些已验证的开源/官方轮子？哪个最贴合本项目 MV3 + 14 locale + Playwright 的架构？需要补充哪些缺口？给出可引用来源。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。

## 回报
- 最后必写报告文件: .scratch/architecture-recovery/reports/01-icons-report.md
- 报告含: 变更摘要、验收对照、测试结果、残留风险、教训（若有）

## Suggested skills
- atomcode-research（若本票标记需要）
- but（提交）
- playwright（若涉及 UI/测试）
