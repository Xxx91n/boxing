# 54 — @data-golden 摘除 continue-on-error

**What to build:** 在 2026-09-18 前摘除 test.yml 中 @data-golden 的 continue-on-error 并保持绿；逾期需豁免登记。

**Blocked by:** None (can start immediately)

**Status:** done（票 86 关账 2026-09-12：票面=实测一致，证据 reports/86-report.md）

**覆盖 A-xxx:** A-010, A-008

- [x] continue-on-error 已摘除 —— 实测当前 .github/workflows/test.yml：continue-on-error 0 命中、BOXING_EXCLUDE_GREP 0 命中、data-golden 专用 job 保留且阻塞
- [x] @data-golden 相关 spec 绿 —— 票时点证据：CI run 34637028614（专用 job 7/7 绿 + 主 lane 折入 14 项全绿）；注明：main run 34686760142 gate4 现回归红（票 70 终表 N1 真回归），修绿归票 71，本勾不折算当前为绿
- [x] 若逾期则按 G-A 豁免规则登记 —— N/A：完成于 2026-09-12，早于 2026-09-18 期限，无需登记
