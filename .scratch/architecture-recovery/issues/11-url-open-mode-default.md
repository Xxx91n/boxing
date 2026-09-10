# 11 — feat(settings): 书签默认在当前标签页打开

**What to build:** 全新安装/缺省设置下，`urlOpenMode` 默认为 **`sameTab`**（当前标签页打开书签）；用户已显式选择的存量 `newTab` **不被改写**；设置面板与实际行为一致。

**Blocked by:** None — can start immediately

**Status:** code-done, CI-open (见 reports/11-url-open-mode-default-report.md)

## Acceptance criteria

- [x] 空 storage / 新 profile：`urlOpenMode` 视作 `sameTab`，书签点击 → 当前标签导航 (T11-a/T11-c)
- [x] 存量 `urlOpenMode:'newTab'`：仍为新标签 (T11-b/T11-d)
- [x] 设置 UI 默认显示 Current Tab (Bug3-c selectVal)
- [x] 跨 tab onChanged 后不回退成 newTab (Bug3-c 双侧缺键 apply)
- [x] Playwright 默认值 + 打开路径断言；涉及文件 `node --check` 绿 (spec 已写, node --check 4/4; Playwright 绿待 CI)
