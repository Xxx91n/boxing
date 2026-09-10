# 工件程序化比对报告 — 2026.9.12 包

- 方法: node 字段级比对（拒绝自述一致）
- 范围: 8 票 × {issues, handoffs, prompts} + spec + README 波次
- 维度: 路径引用 / 标题 slug / 需求关键词 / 阻塞边 / 验收清单 / 波次 / 交叉引用 / 禁词 / 上游复述

## 结果

**PASS — 0 不一致**

- 01-icons: boxes=3 lines=35 wave=1
- 02-readme-sync: boxes=4 lines=35 wave=1
- 03-store-i18n: boxes=3 lines=35 wave=1
- 04-sync-ui: boxes=3 lines=35 wave=1
- 05-firefox-scroll: boxes=3 lines=35 wave=1
- 06-pages-index: boxes=2 lines=35 wave=1
- 07-pages-demo: boxes=3 lines=35 wave=2
- 08-version-unify: boxes=3 lines=35 wave=2

## 合规

| 维度 | 结果 |
|---|---|
| worktree / git 写命令 | 无 |
| 复述 WORKFLOW/handoff 已有条款 | 无 |
| 启动器 ≤60 行 | 全部 35 行 |
| 路径可解析 | 全 OK |

## 本轮修复

1. handoffs/01-icons.md — 补 manifest 锚点
2. handoffs/02-readme-sync.md — 补 README.md 锚点
3. handoffs/04-sync-ui.md — 补 Shared/WebDAV 分组表述
4. handoffs/06-pages-index.md — 补 200 + privacy-policy 锚点
5. handoffs/08-version-unify.md — 补 package.json/build.mjs 锚点
6. 审计器 — 修正 handoff 自引用误报；Local/local 大小写敏感误报
