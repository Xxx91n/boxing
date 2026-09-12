# Architecture Recovery — 票务索引

## Wave8 波次表（由 issue Blocked by 推导 · 2026-09-12）

| 波次 | 票 | 覆盖 A-xxx | Blocked by |
|---|---|---|---|
| W1（前沿） | 70 ga-set-diff-root-cause | A-025,A-037 | None |
| W1 | 74 ga-waiver-review | A-025 | None |
| W1 | 75 rel-artifact-download | A-026 | None |
| W1 | 77 flash-slowmo (human) | A-028 | None |
| W1 | 79 conflict-copy-read-ui | A-029 | None |
| W1 | 80 merge-quality-spec | A-030 | None |
| W1 | 81 cred-per-install | A-031 | None |
| W1 | 82 webdav-private-optin | A-032 | None |
| W1 | 83 search-debounce | A-033 | None |
| W1 | 84 popup-wave8 | A-034 | None |
| W1 | 85 docs-productize | A-035 | None |
| W1 | 86 ticket-hygiene | A-036 | None |
| W2 | 71 ga-nq-bucket-fix | A-025 | 70 |
| W2 | 72 ga-broken-bucket-fix | A-025 | 70 |
| W2 | 73 ga-boot-pending-e2e | A-025 | 70 |
| W2 | 76 gb-manual-golden-path (human) | A-026,A-027 | 75 |
| W3 | 78 issue9-close (human) | A-027 | 76 |

并行约束: 同会话 atomcode 串行；G-B 人工与源码票并行；禁 tag 直至 G-A∧G-B∧G-C；N/B 桶禁豁免。


## Wave8 W1 首脑复核状态（2026-09-12）

| 票 | 源码/产物 | issue 票面 | 结论 |
|---|---|---|---|
| 70 | PASS | AC 4/4 · Status 未翻 | PASS-with-PV |
| 74 | PASS | AC 3/3 · Status 未翻 | PASS-with-PV |
| 75 | PASS | done | PASS |
| 77 | PASS（基建） | 人工 AC open | PASS（待用户采集） |
| 79 | 源码在 | AC 3/3 | **FAIL CM-1 → 79R** |
| 80 | PASS | done | PASS |
| 81 | 源码在 | AC 4/4 | **FAIL B-6 → 81R** |
| 82 | 源码在 | **AC 0/4** | 源码 PASS / 票面 FAIL |
| 83 | PASS | done | PASS |
| 84 | 源码在 | **AC 0/3** | 源码 PASS / 票面 FAIL |
| 85 | PASS | done | PASS |
| 86 | PASS | done | PASS |

**Frontier:** 79R · 81R · 71 · 72 · 73 · 76(人) · 77 采集(人) · 70/74 Status · 82/84 AC 卫生。78 仍等 76。

详见 reports/W8-W1-brain-review.md


## Wave8 W2 首脑复核状态（2026-09-12）

| 票 | 结论 |
|---|---|
| 79R | PASS（CM-1 绿） |
| 81R | PASS 守卫面；**gate2 未闭环 → 81R2** |
| 71 | 部分 PASS；job 同绿未达成（gate2） |
| 72 | PASS B 面（flush/persistView/poll 实锚在） |
| 73 | PASS-with-PV（N/A；Status 未翻） |
| 76 | PASS agent 边界；G-B 人工未完成 |
| 77 | PASS agent 边界；用户采集未完成 |

**Frontier:** 81R2 · 76(人) · 77 采集(人) · 71/73 票面卫生 · 78←76。禁 tag 直至 gate2 绿 + G-A CI + G-B。

详见 reports/W8-W2-brain-review.md


## Wave8 W3 首脑复核状态（2026-09-12）

| 票 | 结论 |
|---|---|
| 81R2 | **PASS**（gate2 2/2 + import-graph 0 违规 + facade 注入在位） |
| 76 | Agent 边界 PASS；**G-B 人工未完成**（勾选单 0/11） |
| 77 | Agent 边界 PASS；**慢放采集未完成**（chrome/firefox 目录空缺） |

**Frontier:** 76（用户）· 77（用户）· 78←76 · main CI 复跑 · 无 agent 源码返工。

详见 reports/W8-W3-brain-review.md


## Wave8 · D-009 强制通过记账（2026-09-12）

| 票 | 处理 |
|---|---|
| 76 | done **user-forced, no artifacts**（非 ADR-0017 可审计 G-B） |
| 77 | done **user-forced, no artifacts**（无慢放证据包） |

Frontier 更新: 76/77 按 D-009 关闭；**78 可开工**（关闭评论须写强制通过）；**tag 仍禁**直至用户明令并接受 G-B 人工豁免 + G-A CI 定谳 + G-C。


## Wave8 · 78 关账 + 82/84 AC 卫生（2026-09-12）

| 项 | 结论 |
|---|---|
| 78 | #9 **CLOSED**（过程性关账）；A-007 偏离记 A-039；对外仍不可发行 |
| 82 | AC 4/4 补勾 · done（源码早已落地） |
| 84 | AC 3/3 补勾 · done |

**Frontier:** main CI 复跑定谳 G-A · 无新 agent 源码票 · **tag 仍禁**（G-A 未绿 + G-B 强制豁免）。

## Wave7 波次表（由 issue Blocked by 推导 · 2026-09-12）

| 波次 | 票 | 覆盖 A-xxx | Blocked by |
|---|---|---|---|
| W1（前沿可并行） | 60 zero-flash P1 | A-013,A-014 | None |
| W1 | 61 README claims P1 | A-015 | None |
| W1 | 62 git-history P2 | A-016 | None |
| W1 | 63 CRED honesty P1 | A-017 | None |
| W1 | 65 version strings P2 | A-019 | None |
| W1 | 66 debt markers P2 | A-020 | None |
| W2 | 64 WebDAV docs P2 | A-018 | 61 |

并行约束: 同会话 atomcode 串行；G-B 人工与 W1 并行；禁 tag 直至 G-A∧G-B∧G-C。

## Wave7 deferred → Wave8 已重开（A-033..A-036）

> D-007 显式重开；下表仅历史记录。

## Wave7 deferred（历史，已重开）

| A-xxx | 事项 |
|---|---|
| A-021 | 性能债 |
| A-022 | popup/ |
| A-023 | .scratch 搬家 |
| A-024 | V6 升门禁（禁止） |

## 目录

- spec.md · decision-ledger.md · issues/ · handoffs/ · prompts/ · reports/
- Wave7 grill: ../wave7-flash-grill/

## Wave7 W1 复核状态（2026-09-12 首脑）

| 票 | 源码 | issue 勾选 | 结论 |
|---|---|---|---|
| 60 | PASS | done 7/7 | PASS-with-caveat（慢放证据待补） |
| 61 | PASS | **未勾 0/5** | PASS-source + PV-W7-61-1 |
| 62 | PASS | done 3/4（N/A 路径） | PASS |
| 63 | PASS | **未勾 0/5** | PASS-source + PV-W7-63-1 |
| 65 | PASS | done 3/3 | PASS |
| 66 | PASS | **未勾 0/5** | PASS-source + PV-W7-66-1 |

**Frontier: 64 可开工。** 详见 reports/W1-brain-review.md

## Wave7 W2 复核状态（2026-09-12 首脑）

| 票 | 源码 | issue 勾选 | 结论 |
|---|---|---|---|
| 64 | PASS | **未勾 0/3** | PASS-source + PV-W7-64-1 |

**Wave7 实施票 60–66 源码面齐。Frontier 空（无更多可开工实施票）。**
详见 reports/W2-brain-review.md

## Wave7 收口审计（2026-09-12）

| 项 | 结果 |
|---|---|
| 硬验收 | build DONE_BUILD · 四守卫绿 · syntax OK |
| 账本 | A-012..020 implemented · A-021..024 deferred · 0 stale |
| 合并 | 栈就绪 · **未 land/push** |
| 报告 | reports/W7-closeout-audit.md |
| backlog | docs/history/2026-09-12-wave7-closeout-backlog.md |
