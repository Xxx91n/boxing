# 42 — onInstalled(update) 先 COW 快照再迁移

**What to build:** 扩展更新信号到达后、任何 migrateLayout/数据写改之前，强制 saveSnapshot('pre-update')；NTP init 消费 boxingInstallSignal 时同样保证先备份；alarms 定时备份路径保持。

**Blocked by:** 41

**Status:** ready-for-agent

- [ ] background onInstalled reason=update 路径先快照后迁移（代码顺序可审查）
- [ ] NTP 看到 update 信号且待迁移时先快照
- [ ] 单测/集成：模拟 update 后存在 pre-update 快照且 schema 已升
- [ ] file:// 无信号路径行为不回归
