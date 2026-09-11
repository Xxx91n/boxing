# 48 — CI 残红清零（修绿优先+受控豁免）

**What to build:** 将 main test.yml 主 lane 残红逐项修绿；仅 flaky/环境性且签名匹配可书面豁免；数据完整性/迁移/回滚类永不豁免；豁免硬到期收敛；更新 #9 勾选现状。

**Blocked by:** None (can start immediately)

**Status:** implemented — CI verification pending brain dispatch (启动卡 report §7; per §4.2 no push from sub-window)

**覆盖 A-xxx:** A-001, A-002, A-008, A-007

- [x] 残红清单逐项处置：修绿或书面豁免 — 6 面：4 修绿 (title-select-all/Bug5-dark/state-sync/snapshot-rotation[已由 t50 修复]) + 2 豁免入台账 (auto-expand/zoom-dblclick)，见 reports/48-ci-residual-red-clear-report.md
- [x] 豁免仅限 flaky/环境性且失败签名匹配 — 两条均为跨 OS 非确定性 (同码至少一侧绿)，签名含 OS/lane 限定，broken/flaky 分界规则写入台账节
- [x] 数据完整性/迁移往返/回滚演练类不得入台账 — never-quarantine 名单入台账规则；snapshot-rotation/state-sync 面走修绿不入账；waiver-ledger-check.mjs 命中名单即 exit≠0
- [x] 豁免条目含用例名/基线 run/签名/归属票/到期 — 两条目 5 字段齐备 (基线 run 34626507101)，checker 机器校验字段完整性通过
- [x] 到期未修禁用或删除并记录 — 硬到期 2026-09-19 + 处置记录列 + checker 对过期 active 行 exit 1；禁止静默续期规则写入 §4.4
- [x] 发行前校验台账未过期且签名仍匹配 — G-A 检查单加机器步骤 (node scripts/waiver-ledger-check.mjs exit 0) + 逐行签名对最新基线人工复核；到期日绑定下一条 main 全绿 run
- [x] 更新 #9 body 勾选与现状评论（不关闭 #9） — gh issue edit #9 (P0-2/P0-4 勾选更新) + 现状评论见票48报告 §6
