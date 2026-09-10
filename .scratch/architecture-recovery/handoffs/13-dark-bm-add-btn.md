# Handoff — 13 黑暗模式加书签按钮亮色

## 票面
- Issue: issues/13-dark-bm-add-btn.md
- Spec: spec.md Wave4
- Blocked by: None — can start immediately

## 完成定义
遵循 issues/13-dark-bm-add-btn.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2。

## 必读
1. issues/13-dark-bm-add-btn.md
2. spec.md Wave4
3. WORKFLOW.md §4.2
4. AGENTS.md（CSS dual-write；ADR-0011 ntp.css 为构建产物）
5. docs/adr/0011-ntp-css-build-artifact.md
6. docs/css-dual-write-convention.md
7. docs/CONTEXT.md
8. ntp/base.css（.bm-add-btn token 样式）
9. ntp/settings.css（.bm-add-row button + .ntp--dark 覆盖）
10. ntp/popups.js（仅只读确认 DOM class：bm-add-row / bm-add-btn）

## 本票 delta
- 源文件修复 dark 覆盖：在 `.ntp--dark .bm-add-row .bm-add-btn` 显式 `background: transparent`
- 评估并收紧 `.ntp--dark .bm-add-row button { background: var(--color-accent) }`（旧实心按钮遗产，特异度 0-2-1 压过 base）
- **禁止**编辑 ntp/ntp.css；禁止改 JS DOM 结构
- 文件面: **ntp/settings.css**（必要时 base.css 一行）

## 调研依赖（atomcode-research）
低。CSS 特异度与 design-token 主题覆盖是平台标准；一般不必联网。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "快速查 CSS 特异度：类选择器 .a .b 与 .t .a button 谁赢，以及 dark mode 覆盖层正确写法（只重置需要的属性 vs 整块覆盖），3 条要点即可。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。

## 回报
- 报告: .scratch/architecture-recovery/reports/13-dark-bm-add-btn-report.md
- 含: 特异度分析、改动 diff 摘要、验收对照、亮/暗截图或 computed 断言结果

## Suggested skills
- but
- playwright
