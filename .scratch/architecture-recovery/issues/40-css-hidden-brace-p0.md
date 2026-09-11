# 40 — P0 修复 settings.css 缺失花括号导致 hidden 遮罩失效

**What to build:** 修复 ntp/settings.css 中 .modal-overlay 未闭合导致 .modal-overlay[hidden]/.sync-group[hidden]/.settings-tab[hidden] 被 CSS Nesting 解析为后代选择器、全屏遮罩拦截指针的问题；重建 ntp.css；onboarding/extension-test/sync-ui 相关失败恢复。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] settings.css 括号最终 depth=0
- [ ] npm run build 成功且 ntp.css 中 .modal-overlay[hidden]{display:none} 为顶层规则
- [ ] Playwright: boxing-onboarding step navigation PASS
- [ ] extension-test settings modal close 后 isHidden PASS
- [ ] 人工：新装扩展出现引导后可点 Skip/Next，关闭后主界面可点击
