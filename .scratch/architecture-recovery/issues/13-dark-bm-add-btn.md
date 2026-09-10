# 13 — fix(dark): 小盒子加书签按钮黑暗模式仍为亮色

**What to build:** 开启黑暗模式后，小盒子书签列表底部的「+ 加书签」按钮与主题一致（虚线描边 + 透明底 + muted 文字），不再显示为亮色实心块。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `.ntp--dark` 下 `.bm-add-btn` 的 computed `background-color` 为 transparent（非 accent 亮色）
- [ ] hover 仍用 accent-soft / accent-ink（base.css 语义不变）
- [ ] 仅改 CSS 源文件（settings.css 或 base.css），**不**提交/编辑 ntp/ntp.css（ADR-0011 构建产物）
- [ ] Playwright：扩展上下文切 dark 后对 `.bm-add-btn` 断言背景（或 computed style）；可挂 accent-theme/settings 相关 spec
- [ ] 亮色模式虚线按钮样式不回归

## Notes

- 根因：`.ntp--dark .bm-add-row button { background: var(--color-accent) }` 元素选择器特异度压过 base 的 `.bm-add-btn { background: transparent }`；dark 的 `.bm-add-btn` 规则只改了 border/color 未重置 background
