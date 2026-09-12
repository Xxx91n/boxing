# 63 — CRED 诚实标注或 per-install key（P1）

**What to build:** 二选一落地：混淆级诚实承认，或 per-install 随机 key；不做 passphrase 真加密。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**覆盖 A-xxx:** A-017

- [ ] 在注释/隐私说明中选一并落地（混淆承认 or per-install key）
- [ ] 若 per-install：新装随机 key；不破坏既有 _enc 数据读回策略并写报告
- [ ] 若仅标注：字段/注释/README Privacy 措辞一致，不伪称强加密
- [ ] 禁止本票实现 passphrase/KDF 用户口令架构
- [ ] node --check / 相关测试不新增红
