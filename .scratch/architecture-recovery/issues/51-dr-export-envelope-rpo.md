# 51 — 导出信封/完整包 + 覆盖必先副本 + RPO/RTO ADR

**What to build:** 默认导出=主布局+meta 索引（不含快照正文）；可选完整容灾包；同步/导入覆盖必先本地副本；RPO/RTO 写入 ADR-0009/0017。

**Blocked by:** None (can start immediately)

**Status:** closed-pending-ga（票 86 关账 2026-09-12：源码关账 B33/B44；AC1/AC2/AC4 行为首红按票 70 终表归票 71 治理，留待补勾——见各 AC 注与 reports/86-report.md；本票不宣称 CI 绿）

**覆盖 A-xxx:** A-001, A-003, A-006, A-011

- [ ] 默认导出含 layout + meta 索引不含正文 ——（注明：源码 buildExportEnvelope 实测在盘、a714de81 已 land；行为验收 boxing-dr-export-envelope AC1+AC3 在 main run 34686760142 首次 CI 即红（票 70 终表 N4），由票 71 修绿后补勾，票 86 不折算为绿）
- [ ] 可选完整包含正文；体积预估+5MB 处理 ——（注明：#export-full-dr-btn + _bodies + bodyTrimmed + 5MB 处理实测在盘；AC2 首红同归票 71（N4），绿证补后补勾）
- [x] 文件名 boxing-backup-YYYYMMDD.json —— 实测 settings-ui.js 文件名拼接 
- [ ] 同步/导入覆盖必先本地副本+测试 ——（注明：三路径 saveSnapshot 前置 + spec 文件实测在盘；AC4 首红 Expected pull / Received merge 归票 71（N3），定谳后补勾）
- [x] RPO/RTO 入 ADR-0009 修订并交叉 ADR-0017 —— 实测 ADR-0009 票51修订节 + ADR-0017 交叉引用在盘
- [x] 导入信封可还原当前布局 —— 实测 utils.js unwrapExportEnvelope + 导入路径调用在盘；对应 spec 用例未列票 70 红面
