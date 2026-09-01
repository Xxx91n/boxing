# 02 — ntp.js 全文件调用图扫描

**What to build:** 一个脚本对 ntp/ntp.js 做静态调用图扫描, 产出: 顶层符号清单、每个符号的被引用位置、跨区块隐式依赖边、按领域 (favicon / i18n / utils / state / storage / persistence / render) 的初步分区建议。产出物为 .scratch 下的 markdown 报告, 供后续每张拆分票引用。

**Blocked by:** None — can start immediately

**Status:** done (2026-08-31, ticket 02 agent)

- [x] 脚本可无头重跑 (node 单文件, 无新运行时依赖) — `node tools/callgraph-scan.mjs > .scratch/architecture-recovery/callgraph-report.md`
- [x] 报告含各领域符号归属表, 且与 04-08 票的验收项对得上 — callgraph-report.md §5 (领域归属表) + §6 (与 04-08 验收项逐条对照)
- [x] 报告点名风险最高的隐式依赖 (跨领域调用 ≥ 3 处的符号) — callgraph-report.md §7.1 (30 个符号, `layout` 5 领域/312 次居首) + §7.2 结构性结论
