# 13 报告 — 黑暗模式小盒子加书签按钮亮色修复

票: issues/13-dark-bm-add-btn.md（Wave4 UX）。完成定义遵循 handoff 内的完成定义。

## 根因与特异度分析

- 触发链: ntp/popups.js:110 创建 `.bm-add-row`，其内唯一 button 即 `.bm-add-btn`（popups.js:113-122，只读确认，未改 JS）。
- 冲突规则:
  | 规则 | 特异度 | 效果 |
  |---|---|---|
  | base.css `.bm-add-row .bm-add-btn` | 0-2-0 | background: transparent（虚线 ghost） |
  | settings.css `.ntp--dark .bm-add-row button` | 0-2-1 | background: var(--color-accent) — 压过 base |
  | settings.css `.ntp--dark .bm-add-row .bm-add-btn` | 0-3-0 | 旧版缺 background 重置 |
- 结论: dark 下元素选择器遗产规则以 0-2-1 赢过 base 的 0-2-0，而类选择器 dark 规则未重置 background → 按钮被涂成亮色 accent。与 issue Notes 一致。

## 改动 diff 摘要

仅 ntp/settings.css（dark 段）:
- 删除 `.ntp--dark .bm-add-row button { background: var(--color-accent); color: var(--color-ink); }`（`.bm-add-row` 已无其它按钮，该规则为纯遗产；删除即「收紧」，未来新按钮须自带 class 样式）。
- `.ntp--dark .bm-add-row .bm-add-btn` 显式加 `background: transparent`（0-3-0 > base 0-2-0，且仅非 hover 生效）。
- hover 规则（0-4-0: accent-soft / accent / accent-ink）一字未动 → base 语义不变。

测试（test/tests/boxing-empty-state-buttons.spec.ts，Bug5 后新增 Bug5-dark）:
- 创建小盒子后给 #app + body 加 ntp--dark（与 persist.js:237-238 同构），断言 computed backgroundColor === 'rgba(0, 0, 0, 0)'（同时覆盖亮色模式不回归：同断言在 class 添加前的隐含路径 + 既有 Bug5 dashed 测试未动）。
- hover 断言: page.hover 后 computed 背景 == 探针元素解析 var(--color-accent-soft) 的值（token 驱动，不硬编码色值）。

未触碰: ntp/ntp.css（ADR-0011 构建产物，且由 A8.0 由源文件再生）、任何 JS、其它票文件。

## 验收对照

| Acceptance criteria | 状态 | 证据 |
|---|---|---|
| dark 下 .bm-add-btn computed 背景 transparent | code-done | settings.css 0-3-0 显式重置；CI-open |
| hover 仍 accent-soft/accent-ink | code-done | hover 规则未动 + Bug5-dark hover 探针断言；CI-open |
| 仅改源 CSS，不编辑 ntp.css | done | 改动面仅 settings.css + spec |
| Playwright dark 断言挂相关 spec | 已写 | Bug5-dark 加入 boxing-empty-state-buttons.spec.ts；CI-open |
| 亮色虚线按钮不回归 | code-done | 既有 Bug5 dashed/cursor 测试未动 + 新测试暗色前置 |

## 验证记录

- 写后字节复检: settings.css 25,921B LF、旧遗产规则串已不存在、新块含 transparent 重置。
- spec 文件 node --check 语法预检通过（exit 0，无输出）；git diff --check 干净。
- A8 双写校验器: 本票选择器不含 .large-box/.small-box 配对，无 BX-CSS-DUAL-WRITE 义务（build.mjs A8 只查两者同现规则）。
- 本机禁构建/测试（CI-only policy）: Playwright 全量绿灯由 CI 出具，状态 code-done / CI-open。

## 残留风险

- 探针 hover 断言依赖主题 token --color-accent-soft 在 body 作用域可解析；三主题预设均定义该 token（design-system.css .ntp--dark 块），风险低。
- 未来若 .bm-add-row 内新增无 class 按钮，将失去旧的兜底实心样式 — 属本票收紧意图，需在评审时知会。

## 版本控制

遵循 WORKFLOW §4.2：代码改动与本报告分两次提交落在本票独立分支（ticket-13-dark-bm-add-btn），提交 wzp（代码）+ 本 docs 提交；未触碰其它窗口/分支的工作区改动。
