# 104: boot-theme 早退 failsafe（B68）

**Covers A-xxx:** A-058

**What to build:** boot-theme 早退路径增加 failsafe，避免无罩/半渲染；不破坏零闪现。

**Blocked by:** 96, 100

**Status:** done-with-named-F（2026-09-14 · 源码契约绿；no-mirror e2e chromium 启动超时=env F）

## Acceptance criteria

- [x] 早退路径有 failsafe
- [x] 相关 e2e 或书面否证
- [x] 零闪现路径不回退

> 2026-09-14 · 实测锚点: `boxing-boot-pending.spec.ts` chromium 7/7 (16.3s) + firefox 7/7 (33.4s)，含本票新增 3 例（早退双路径行为 + 源码顺序契约）；M2 mutant 杀 3/3（exit 1）。CI 复跑归大脑窗口（本窗口未获 push 明令）。报告 `reports/104-report.md`。

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff 内的 完成定义
- 调研要求见 handoff（atomcode + ADR/CONTEXT + 工业对标），本文件不复述
- 镜像: GitHub #15
- 报告: reports/104-report.md
