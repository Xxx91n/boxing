# 10 — fix(rename): 点击盒子标题默认全选名称

**What to build:** 点击大盒子标题、小盒子标题、内层 crumb 标题进入编辑时，**整段名称默认选中**，可直接键入覆盖；Escape 恢复原文。

**Blocked by:** 09 — create-render-decouple（同改 render 模块，避免并行 hunk 冲突）

**Status:** ready-for-agent

## Acceptance criteria

- [x] 点击大/小盒子标题 → selection 字符串 === 当前标题文本
- [x] 点击 crumb 标题同样全选（并获得焦点）
- [x] 键入替换整名；Escape 还原；Enter blur 保存
- [x] 不触发盒子拖拽；SEC-03 paste 纯文本保留
- [x] Playwright selection 断言；`node --check ntp/render.js`
