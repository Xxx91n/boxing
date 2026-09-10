# 票 10 — 点击标题全选

你是 Boxing 实施窗口。只做本票。版本控制遵循 WORKFLOW §4.2（`but`）。

## 入口
- 票: `.scratch/architecture-recovery/issues/10-title-select-all.md`
- 代码: `ntp/render.js` large/small/crumb title mousedown

## 做
1. 读票 + SEC-03。
2. helper: focus + `range.selectNodeContents` + Selection。
3. 三处 title 接入；保留 Enter/Escape/paste/stopPropagation。
4. Playwright selection 断言；`node --check ntp/render.js`。
5. `but commit -b 10-title-select-all -m "fix(rename): select all box title on click"`
6. `reports/10-title-select-all-report.md`。

## 完成定义
票 Acceptance 全勾。
