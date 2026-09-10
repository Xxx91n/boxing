# 10 — fix(rename): 点击盒子标题默认全选名称

> 版本: 2026.9.12 · 优先级: P1 · 分支建议: `10-title-select-all`
> 状态: ready-for-agent

## Problem

点击大/小盒子标题进入编辑时，光标停在名称前/中，不能直接覆盖重命名。期望：点击即全选原文。

## Root cause

`ntp/render.js` title `mousedown` 只做 `preventDefault + focus()`，未设 Selection。
crumb 标题甚至不 `focus()`。

## Fix (ponytail)

共享一个小 helper（可放 `utils.js` 或 render 内私有）:

```js
function selectTitleContents(el) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createDocumentRange?.() || document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}
```

（注意：`createDocumentRange` 不存在则用 `document.createRange()`。）

接入三处:
1. large-box title mousedown（~L427）
2. small-box title mousedown（~L813）
3. innerCrumbTitle mousedown（~L674）— 同时补 `focus()`

保留: Enter blur、Escape 还原、SEC-03 paste 纯文本、stopPropagation 防拖拽。

## Acceptance

- [ ] 点击大盒子标题 → `window.getSelection().toString()` === 当前标题文本。
- [ ] 点击小盒子标题、crumb 标题同样全选。
- [ ] 键入字符替换整名；Escape 恢复。
- [ ] 不触发 box 拖拽（mousedown 仍 stopPropagation）。
- [ ] Playwright 断言 selection；`node --check ntp/render.js`。

## Out of scope

- 标题样式/字号
- 重命名历史
