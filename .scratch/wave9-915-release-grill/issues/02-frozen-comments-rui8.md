# 02: 冻结 hack 就地注释（锐评8）

**What to build:** `ntp.js` `['']` 与 `i18n.js` 重复键现场各加冻结注释，指向票 83/66 报告；不改变字节行为。

**Blocked by:** None (can start immediately)

**Source:** D-003③

**Status:** ready-for-agent

- [ ] ntp.js 冻结点有 // frozen by ticket 83 指针
- [ ] i18n.js 重复键有 // frozen by ticket 66 指针
- [ ] 不修改冻结契约字节/语义

