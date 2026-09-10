# 11 — feat(settings): 书签默认在当前标签页打开

**What to build:** 全新安装/缺省设置下，点击书签在**当前标签页**打开；用户已选择「新标签页」的存量配置**不被改写**；设置面板与实际行为一致。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance criteria

- [ ] 空 storage / 新 profile：书签点击 → 当前标签导航
- [ ] 存量 `urlOpenMode:'newTab'`：仍为新标签
- [ ] 设置 UI 默认显示 Current Tab
- [ ] 跨 tab onChanged 后不回退成 newTab
- [ ] Playwright 默认值 + 打开路径断言；涉及文件 `node --check` 绿
