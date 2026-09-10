# Handoff — 10 点击标题全选

## 票面
- Issue: issues/10-title-select-all.md
- Spec: spec.md（Wave4）
- Blocked by: **09 — create-render-decouple**（同改 render 模块）

## 完成定义
遵循 issues/10-title-select-all.md 全部验收项 + 报告落盘。

## 版本控制
遵循 WORKFLOW §4.2。

## 必读
1. issues/10-title-select-all.md
2. handoffs/09-create-render-decouple.md（确认 09 已完成/已合并或已协调）
3. spec.md Wave4
4. AGENTS.md SEC-03（paste 纯文本）
5. docs/CONTEXT.md
6. ntp/render.js title mousedown（large / small / crumb）
7. test/tests/boxing-focus-steal.spec.ts（Selection 先例）

## 本票 delta
- 共享 select-all helper；三处 title mousedown 接入
- crumb 补 focus
- 不碰创建管线（09 范围）
- 文件面: ntp/render.js（title 块）+ 可选 test

## 调研依赖（atomcode-research）
低。contenteditable select-all 是平台标准 API；一般不必联网。若浏览器兼容存疑可 quick 查。

### 推荐 atomcode -p 提示词（完整，直接发送）
```
atomcode -p "快速查 contenteditable 元素点击后全选文本的工业标准做法：Range.selectNodeContents vs execCommand('selectAll') vs Selection.selectAllChildren，在 Chrome 与 Firefox 扩展页上的兼容性与注意点，3-5 条要点即可。"
```

执行方式: ctx_batch_execute(commands:[{label:atomcode,command:上述}], concurrency:1, timeout:600000)。串行：同会话仅一个 atomcode 在途。超时按 skill 续跑，不杀进程。

## 回报
- 报告: .scratch/architecture-recovery/reports/10-title-select-all-report.md

## Suggested skills
- but
- playwright
