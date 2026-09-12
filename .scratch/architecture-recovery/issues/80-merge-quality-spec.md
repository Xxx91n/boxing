# 80: WebDAV merge 质量方案

**Covers A-xxx:** A-030

**What to build:** 出子盒/id 级合并方案，不改生产语义。

**Blocked by:** None (can start immediately)

**Status:** done — 方案先行票（A-030）：方案交付于 reports/80-report.md §4（备选 A–D + 推荐 B 分阶段），零代码改动

## Acceptance criteria

- [x] 方案含备选与推荐（报告 §4.1 备选 A/B/C/D + §4.2 推荐 B 分阶段落地，阶段 1 = 备选 A 子集）
- [x] 不静默改 newer-wins（报告 §4.0 红线 + §4.3 语义边界：newer-wins 仅存于两处既有「归档先行」形态，不得回退静默覆盖；§4.4 无静默改向声明）
- [x] 实施边界清晰（报告 §4.3 边界表：函数/存储/语义/数据/测试/门禁/i18n 七维，下票可直接引用）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
