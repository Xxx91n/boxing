# Wave8 收口交叉核对

日期: 2026-09-12

## 矛盾清单

- 71-report 仍写 gate2 未绿，但 81R2 已修且 gate2 实测绿 — 报告未回填

## Issue 状态快照

- 70-ga-set-diff-root-cause: AC 4/4 · ready-for-agent
- 71-ga-nq-bucket-fix: AC 4/4 · done
- 72-ga-broken-bucket-fix: AC 3/3 · done (2026-09-12)
- 73-ga-boot-pending-e2e: AC 3/3 · ready-for-agent
- 74-ga-waiver-review: AC 3/3 · ready-for-agent
- 75-rel-artifact-download-2026-9-12: AC 3/3 · done (2026-09-12; run 34689649760 downloaded+unpacked to D:/rel-2026.9.12 — see reports/75-report.md + evidence/75-rel-artifacts/)
- 76-gb-manual-golden-path: AC 4/4 · done (user-forced 2026-09-12 · **no artifacts** · D-009/A-038 · NOT ADR-0017 auditable G-B)
- 77-flash-slowmo-evidence: AC 3/3 · done (user-forced 2026-09-12 · **no artifacts** · D-009/A-038 · NOT ADR-0017 auditable G-B)
- 78-issue9-close: AC 3/3 · done (2026-09-12 · 用户强制路径 D-009/A-038 · #9 CLOSED)
- 79-conflict-copy-read-ui: AC 3/3 · implemented（源码+测试落地；e2e 取证走 CI，见 reports/79-report.md）
- 79R-conflict-copy-cluster-map: AC 4/4 · implemented（返工轮 2026-09-12；CM-1 转绿，见 reports/79-report.md 返工轮次节）
- 80-merge-quality-spec: AC 3/3 · done — 方案先行票（A-030）：方案交付于 reports/80-report.md §4（备选 A–D + 推荐 B 分阶段），零代码改动
- 81-cred-per-install-key: AC 4/4 · ready-for-human (cred e2e 回归归 CI; 代码/文档/测试已落地 reports/81-report.md)
- 81R-cred-browser-api-whitelist: AC 4/4 · done (81R 返工闭环; 守卫绿 + 报告追加, 见 reports/81-report.md 返工轮次节)
- 81R2-cred-gate2-write-path: AC 5/5 · done (81R2 闭环; gate2+cred 回归实测绿, 见 reports/81-report.md 返工轮次 81R2 节)
- 82-webdav-private-optin: AC 4/4 · done (2026-09-12 · 首脑 AC 卫生补勾 · 源码已核 webdavAllowPrivateHost + 14 locales + README Privacy opt-in · 证据 reports/82-report.md + W8-W1
- 83-search-debounce: AC 3/3 · done — 实现见 ntp/ntp.js（A-033 / 票 83）；报告 reports/83-report.md
- 84-popup-wave8: AC 3/3 · done (2026-09-12 · 首脑 AC 卫生补勾 · terracotta→accent 已落地 · 证据 reports/84-report.md + popup.css 实测)
- 85-docs-productize: AC 3/3 · done
- 86-ticket-hygiene: AC 3/3 · done（2026-09-12 · 证据 reports/86-report.md）

## 硬验收（收口实跑）

- build.mjs DONE_BUILD · boxing-2026.9.12.zip/crx/xpi 产出
- import-graph-guard 0 violations
- waiver-ledger-check OK
- docs-pointer-check 74 pointers / 9 docs PASSED
- data-golden gate 2 / 2b: 2 passed
- conflict-copy + cred-encrypt + search: 18 passed

## 备注

- CONTEXT has Wave8 settle: false
- ADR-0017 exists: true
- README release: | 78 | #9 **CLOSED**（过程性关账）；A-007 偏离记 A-039；对外仍不可发行 |
