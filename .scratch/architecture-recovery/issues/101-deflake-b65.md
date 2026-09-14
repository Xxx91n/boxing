# 101: fire-and-forget 测试族 deflake（B65）

**Covers A-xxx:** A-055

**What to build:** 识别并降低 fire-and-forget 测试族 flaky；清单落盘；N/数据完整性不豁免。

**Blocked by:** 104（已 implemented 2026-09-14 · ticket 104）

**Status:** done-with-named-F

## Acceptance criteria

- [x] 家族清单落盘 — 24 文件引用 skipOnboarding；23 spec / 26 处 fire-and-forget 全量迁移；已硬化 1（boxing-auto-expand）+ 非 CI 手工工具 1（take-store-screenshots.mjs）+ 同族固定等待 1（boxing-search）均具名；46 spec 复扫零残留
- [x] deflake 或稳定 skip+票 — 家族本体已 deflake（helper + 确定性门 + 守卫；Bug5-dark 40/40、search 40/40）；zoom-dblclick 残留为**异源**新签名（L192 双建，firefox ~5%）→ 具名 N-101-06 待开票
- [ ] 附 CI 证据 — 本机锚点齐备（pretest 全绿 / repeat-20 / 全量 613 passed·5 skipped @workers=2）；**post-land CI run 具名 F-101-01**（未获 push 授权）

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的 完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #14
- 报告: reports/101-report.md
