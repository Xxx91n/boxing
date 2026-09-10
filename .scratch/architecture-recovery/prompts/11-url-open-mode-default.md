# 票 11 — 书签默认当前标签页

你是 Boxing 实施窗口。只做本票。版本控制遵循 WORKFLOW §4.2（`but`）。

## 入口
- 票: `.scratch/architecture-recovery/issues/11-url-open-mode-default.md`
- 代码: `ntp/utils.js` defaultLayout+migrate；`ntp/ntp.js` openBookmarkUrl；`ntp/settings-ui.js`；`ntp/popups.js`

## 做
1. 读票 + BX-DEV-120。
2. 默认 `sameTab`；migrate **保留**已写 newTab；缺键填 sameTab。
3. 同步所有 `\|\| 'newTab'` fallback。
4. 测试: 新 profile 当前标签打开；存量 newTab 不回归。
5. `but commit -b 11-url-open-mode-default -m "feat(settings): default bookmarks open in current tab"`
6. `reports/11-url-open-mode-default-report.md`。

## 完成定义
票 Acceptance 全勾；不回退用户显式 newTab。
