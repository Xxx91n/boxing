# 52 — 新装/重置默认 sameTab（以实机为准）

**What to build:** 保证全新 profile 与重置路径 urlOpenMode 默认 sameTab；修复任何仍导致新装开新标签的路径。

**Blocked by:** None (can start immediately)

**Status:** done

**覆盖 A-xxx:** A-001, A-004, A-005

- [x] 新装或重置后点击书签=当前标签导航（T52-b 行点击=当前标签导航；实机复核走 G-B 检查单）
- [x] 根因覆盖：旧包/重置未清 settings/首帧 DOM/残留写路径（见报告 §3 四面定谳）
- [x] 不接受仅改下拉显示关票（行为收口 ntp.js/utils.js + T52-a..e，非仅显示）
- [x] Playwright 空 storage 新装路径断言（T52-a/e；行点击 T52-b）
