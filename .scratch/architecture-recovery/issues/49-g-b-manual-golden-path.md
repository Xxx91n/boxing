# 49 — G-B 人工 zip 黄金路径（ready-for-human）

**What to build:** 在真 Chrome+Firefox 对发行 zip 解包产物按 WORKFLOW §4.4 检查单勾选验收（含升级 pre-update 快照与回滚演练）；我方出检查单与证据模板，用户执行。

**Blocked by:** None (can start immediately)

**Status:** ready-for-human — 检查单副本/执行卡/证据归档路径/写回稿已交付（evidence/49-g-b-manual-golden-path/，报告 reports/49-g-b-manual-golden-path-report.md）；G-B 本体待用户实机执行回传。Standby 详情（2026-09-12 更新）：候选 zip 已就绪——版本 2026.9.13，main 分支 build.yml run 34641377036 三 OS 全绿（amo_sign=true 未燃烧 AMO 版本号、make_release=false、无 tag；dispatch 命令与版本号逐字取自用户任务文本，由代理执行）。下载：`gh run download 34641377036 -n boxing-release-ubuntu-latest`。余下仅人工 G1–G6（执行卡）

**覆盖 A-xxx:** A-001, A-009, A-007

- [x] 输出 §4.4 可勾选检查单副本与证据归档路径（2026-09-12 票 49 子窗口交付：checklist-template.md + gb-execution-card.md + README.md 归档规范）
- [ ] 用户在真浏览器完成勾选并回传
- [ ] 复核证据后写回 #9 与 ADR-0017 状态
- [ ] 禁止纯自动化宣称 G-B 完成
