# 66 — 用户可见债务标记合并清理（P2）

**What to build:** 合并清理 footer add、syncProviderHint 错文、__lastSaveError 污染等；不动 i18n 重复键。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**覆盖 A-xxx:** A-020

- [ ] index.html footer 多余 add 类用户可见错字清除
- [ ] i18n syncProviderHint 文案与实际 storage.local 一致
- [ ] __lastSaveError 不再持久化进用户 settings（或等价净化）
- [ ] 不清理 i18n.js 重复 Fallback 键
- [ ] i18n 14 语言键完整性不被破坏
