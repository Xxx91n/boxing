# 63 — CRED 诚实标注或 per-install key（P1）

**What to build:** 二选一落地：混淆级诚实承认，或 per-install 随机 key；不做 passphrase 真加密。

**Blocked by:** None (can start immediately)

**Status:** done（票 86 关账 2026-09-12：票面=源码实测一致，证据 reports/86-report.md；PV-W7-63-1 已处置）

**覆盖 A-xxx:** A-017

- [x] 在注释/隐私说明中选一并落地（混淆承认 or per-install key）—— 选诚实标注（混淆级）：credentials.js 注释 + README Privacy + docs/privacy-policy.md 三处
- [x] 若 per-install：新装随机 key；不破坏既有 _enc 数据读回策略并写报告 —— N/A：未采用此分支（理由 reports/63 §3）；既有 _enc 读回策略零改动（实测守卫在盘）
- [x] 若仅标注：字段/注释/README Privacy 措辞一致，不伪称强加密 —— 实测：CRED_OBFUSCATION_SECRET 2 处 / CRED_APP_SECRET 0 / 密钥字面量 intact；privacy-policy「user-provided password」0 命中
- [x] 禁止本票实现 passphrase/KDF 用户口令架构 —— 实测零口令输入/KDF 参数变更
- [x] node --check / 相关测试不新增红 —— reports/63 §6：node --check 0 + import/migration 守卫全绿 + cred-encrypt 双浏览器 5+5 绿
