# Wave8 工件程序化审计（复跑）

日期: 2026-09-12

## 方法
- 解析 decision-ledger Wave8 current A-xxx
- 解析 spec Wave8 覆盖声明并展开区间
- 逐票比对 issue/handoff/prompt 的标题、A-xxx、Blocked by、delta、必读路径
- 解析磁盘路径；禁词扫描；prompt 是否复述 AC/调研块；README 波次行；三维覆盖

## 三维覆盖
- ledger current: A-025, A-026, A-027, A-028, A-029, A-030, A-031, A-032, A-033, A-034, A-035, A-036, A-037
- spec A: A-025, A-026, A-027, A-028, A-029, A-030, A-031, A-032, A-033, A-034, A-035, A-036, A-037
- tickets A union: A-025, A-026, A-027, A-028, A-029, A-030, A-031, A-032, A-033, A-034, A-035, A-036, A-037
- missingInSpec: 无
- extraInSpec: 无
- missingInTickets: 无
- extraInTickets: 无

## 不一致清单

- 无

## 票矩阵

| 票 | slug | A | blocked | AC | prompt L |
|---|---|---|---|---|---|
| 70 | ga-set-diff-root-cause | A-025, A-037 | None (can start immediately) | 4 | 26 |
| 71 | ga-nq-bucket-fix | A-025 | 70 ga-set-diff-root-cause | 4 | 26 |
| 72 | ga-broken-bucket-fix | A-025 | 70 ga-set-diff-root-cause | 3 | 26 |
| 73 | ga-boot-pending-e2e | A-025 | 70 ga-set-diff-root-cause | 3 | 26 |
| 74 | ga-waiver-review | A-025 | None (can start immediately) | 3 | 26 |
| 75 | rel-artifact-download-2026-9-12 | A-026 | None (can start immediately) | 3 | 26 |
| 76 | gb-manual-golden-path | A-026, A-027 | 75 rel-artifact-download-2026-9-12 | 4 | 26 |
| 77 | flash-slowmo-evidence | A-028 | None (can start immediately) | 3 | 26 |
| 78 | issue9-close | A-027 | 76 gb-manual-golden-path | 3 | 26 |
| 79 | conflict-copy-read-ui | A-029 | None (can start immediately) | 3 | 26 |
| 80 | merge-quality-spec | A-030 | None (can start immediately) | 3 | 26 |
| 81 | cred-per-install-key | A-031 | None (can start immediately) | 4 | 26 |
| 82 | webdav-private-optin | A-032 | None (can start immediately) | 4 | 26 |
| 83 | search-debounce | A-033 | None (can start immediately) | 3 | 26 |
| 84 | popup-wave8 | A-034 | None (can start immediately) | 3 | 26 |
| 85 | docs-productize | A-035 | None (can start immediately) | 3 | 26 |
| 86 | ticket-hygiene | A-036 | None (can start immediately) | 3 | 26 |
