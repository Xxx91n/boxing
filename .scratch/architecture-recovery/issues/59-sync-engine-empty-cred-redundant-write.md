# 59 — sync-engine 空凭据冗余写（P2）

**What to build:** 消除空凭据路径上不必要的 saveLayout 冗余写（42R 遗留）。

**Blocked by:** None (can start immediately)

**Status:** closed-pending-ac3（票 86 关账 2026-09-12：源码关账；AC3 因票 70 点名本票守卫为 conn-delete 回归首要嫌疑（未定谳）而保持 open，待票 72（T-GA3）对照实验裁决——见 AC3 注与 reports/86-report.md）

**覆盖 A-xxx:** A-010

- [x] 定位空凭据仍触发 saveLayout 的路径 —— reports/59 定位节 + 42R 实证（flushUnsavedCredentials 主凶 + blur 叠加 2 处）
- [x] 去掉冗余写且不影响有凭据备份路径 —— 实测 sync-engine.js 四路变化守卫 + blur 无变化守卫在盘（af415e93 已 land main）；有凭据分支零语义变化、票 51 快照矩阵不在 diff
- [ ] 相关 data/COW 回归不新增红 ——（注明：票时点 CI-only 未宣称绿，辅证 = W6-W2 复核补测 data 面 12 passed + golden 除 gate4 外绿；2026-09-12 票 70 终表将 conn-delete×4 真回归的首要嫌疑指向本守卫（去掉 unload 兜底写回），对照实验归票 72（T-GA3）定谳——嫌疑未洗清前不勾，防假账）
- [x] 报告含改动面与验证命令结果 —— reports/59 改动面/验证两节齐
