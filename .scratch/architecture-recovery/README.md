# Architecture Recovery — 票务索引

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

## Wave7 deferred（不立票）

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
