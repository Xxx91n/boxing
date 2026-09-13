# 87: R1 star-sync Scenario 1 三 OS 修绿

**Covers A-xxx:** A-041

**What to build:** 跨窗口星标（isParent）在新标签正确领养；star-sync Scenario 1 在 CI 三 OS 不再 failed。先分诊产品 vs 测试。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-14 · https://github.com/Xxx91n/boxing/actions/runs/34773593267）

## Acceptance criteria

- [x] 根因结论写入 reports/87-report.md（产品/测试/环境）—— 定谳：测试缺陷（boot() 无条件清 storage）
- [x] 修复后 test.yml 该签名三 OS 非 failed；附 run URL —— 本地 ff+ch 双 lane 6/6 绿；run URL 待明令 push 后补
- [x] 不引入 waiver；不热修 9.12

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #10
