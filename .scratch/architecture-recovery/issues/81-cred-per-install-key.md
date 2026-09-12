# 81: CRED per-install key

**Covers A-xxx:** A-031

**What to build:** per-install 随机密钥或等价硬化，含迁移与备份兼容。

**Blocked by:** None (can start immediately)

**Status:** done (2026-09-12 · 源码+81R+81R2 闭环 · gate2 绿 · e2e 子集 18 passed)

## Acceptance criteria

- [x] 新装 per-install secret
- [x] 存量可读或迁移
- [x] 导出/同步不破坏
- [x] 文档诚实

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
