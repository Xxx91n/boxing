# 11 — feat(settings): 书签默认在当前标签页打开

> 版本: 2026.9.12 · 优先级: P1 · 分支建议: `11-url-open-mode-default`
> 状态: ready-for-agent

## Problem

产品默认书签在**新标签页**打开。要求默认改为**当前标签页**（sameTab）。

## Root cause

多处硬编码 `'newTab'` 为 fallback/default，且 defaultLayout 写入 storage 后老用户被固化。

## Fix (ponytail)

| 位置 | 改动 |
|---|---|
| `ntp/utils.js` defaultLayout | `urlOpenMode: 'sameTab'` |
| `ntp/utils.js` migrateLayout | 若 `raw.settings` **没有** `urlOpenMode` 键 → 填 `'sameTab'`；若已有值（含 newTab）→ **原样保留** |
| `ntp/ntp.js` openBookmarkUrl | `layout.settings.urlOpenMode \|\| 'sameTab'` |
| `ntp/settings-ui.js` sync + 注释 | fallback `'sameTab'`；改 BX-DEV-120 注释 |
| `ntp/popups.js` | 显式 mode 分支已正确；缺省走 legacy 时改为 **先 sameTab**（或与 ntp.js 同 fallback），去掉「unset 即 FF browserSettings」歧义：**有 setting 键就用；无键视作 sameTab** |

不改 index.html option 顺序亦可；建议把 Current Tab 放前以匹配默认（可选）。

## Acceptance

- [ ] 全新 profile / 空 storage：点书签 → 当前标签导航（`tabs.update` 或 `location.href`）。
- [ ] 存量 `urlOpenMode:'newTab'`：行为仍为新标签。
- [ ] 设置面板默认显示 Current Tab。
- [ ] 跨 tab onChanged 后 DOM 同步（storage.js syncSettingsDOM）不回退成 newTab。
- [ ] Playwright: 扩展上下文设置默认值断言 + 打开书签导航断言；`node --check` 涉及文件。

## Out of scope

- 设置 UI 重设计
- Firefox browserSettings.openBookmarksInNewTabs 联动（仅在显式未写键时废弃该分支）
