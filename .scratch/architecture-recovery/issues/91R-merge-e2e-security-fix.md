# 91R: 返工 — 凭据清除 + e2e 可加载（A-045）

**Covers A-xxx:** A-045

**What to build:** 在保留 merge 产品实现的前提下：①从 `boxing-merge-three-way.spec.ts` **永久移除**真实 WebDAV 用户/密码/服务地址，改为占位或环境变量；②补上 `fileURLToPath` 导入使 Playwright 能 list/load 本文件；③追加写入 `reports/91-report.md` 标注「返工轮次」，不覆盖原记录。

**Blocked by:** None (can start immediately)

**Status:** done-local（修复落盘+grep/​--list 证据见 reports/91-report.md 返工轮次 91R R3；CI 关闭待用户 push+派发）

## Acceptance criteria

- [x] 源文件不再出现真实邮箱/密码/真实 DAV 主机（grep 0 命中，reports/91-report.md R3）；**注**: 历史 commit 38a2d005 与他票存量 spec 仍含凭据 → 分别由用户轮换/另票清扫（R4），本票边界内不再扩散
- [x] --list 加载成功：Total: 8 tests in 1 file（chromium-extension + firefox-extension 各 4），无 ReferenceError（R3 锚点）
- [x] 4 用例断言一字未动；凭据换 env override + 占位（mock sendMessage 桩接管，无真账号依赖）
- [x] 已追加「返工轮次 91R」章节，原记录保留
- [x] 本 issue 已勾；账本 A-045 维持首脑的 blocked-rework（handoff 要求保持至 push+CI）；未 push
- [x] 提醒已记（R4）：38a2d005 旧字节在历史，请轮换 Koofr 应用密码；本票未改写历史

## Notes

- 版本控制遵循 WORKFLOW §4.2
- 完成定义遵循 handoff
- 首脑复核: reports/W1-brain-review.md
- 镜像: GitHub #11
