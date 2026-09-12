# 66 — 用户可见债务标记合并清理（P2）

**What to build:** 合并清理 footer add、syncProviderHint 错文、__lastSaveError 污染等；不动 i18n 重复键。

**Blocked by:** None (can start immediately)

**Status:** done（票 86 关账 2026-09-12：票面=源码实测一致，证据 reports/86-report.md；PV-W7-66-1 已处置）

**覆盖 A-xxx:** A-020

- [x] index.html footer 多余 add 类用户可见错字清除 —— 实测 ntp/index.html footer 无游离 add，单行与 footerHint 权威文案一致
- [x] i18n syncProviderHint 文案与实际 storage.local 一致 —— 实测：index.html 内联默认 + i18n.js Fallback + 14 份 locale 均「本地存储」语义（en: local storage），sync storage 残留 0
- [x] __lastSaveError 不再持久化进用户 settings（或等价净化）—— 实测 storage.js stripGroupsForPersist + RUNTIME_ONLY_SETTING_RE=/^__/；sync-engine buildSyncPayload/导出统一走净化
- [x] 不清理 i18n.js 重复 Fallback 键 —— 实测 i18n.js 重复块零改动（按 AC 要求保留）
- [x] i18n 14 语言键完整性不被破坏 —— 实测 14 份 messages.json 键集合完全相等；本票 delta 时点各 241 键仅 value 变更（现 245 键为票 79/82 后继新增，键集仍等价）；ar/ko 两处译文错字已在 reports/86 §观察项上报
