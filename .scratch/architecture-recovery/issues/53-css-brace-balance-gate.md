# 53 — 构建期 CSS 括号 balance 门禁

**What to build:** build.mjs 对源 CSS 做括号 depth=0 fail-closed（及嵌套 [hidden] 检测），防止 settings.css 类冻结回归。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**覆盖 A-xxx:** A-010

- [x] 源 CSS final depth≠0 时 build fail
- [x] 嵌套 [hidden] 选择器 build fail
- [x] 故意破坏一个 CSS 文件的负向测试或脚本自检
