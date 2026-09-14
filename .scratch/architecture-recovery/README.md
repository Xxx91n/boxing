## Wave9.15 波次表（2026-09-14 · 由 Blocked by 推导）

| 波次 | 票 | Covers | Blocked by | 状态 |
|---|---|---|---|---|
| W1 | 96 docsgov-deadlink | A-050 | — | **implemented-pending-ci**（本地绿 · CI F） |
| W1 | 100 calver-guard-b64 | A-054 | — | **done**（首脑采信） |
| W2 | 98 frozen-comments-rui8 | A-052 | 96, 100 | ready-for-agent |
| W2 | 104 boot-failsafe-b68 | A-058 | 96, 100 | ready-for-agent |
| W2 | 102 bm-add-contrast-b66 | A-056 | 96, 100 | ready-for-agent |
| W3 | 101 deflake-b65 | A-055 | 104 | ready-for-agent |
| W3 | 97 release-status-rui6 | A-051 | 100, 104 | ready-for-agent |
| W4 | 106 innerclip-b70 | A-060 | 101 | ready-for-agent |
| W4 | 99 locale-readme-b63 | A-053 | 97 | ready-for-agent |
| W4 | 103 design-hairline-b67 | A-057 | 102 | ready-for-agent |
| W4 | 105 unflaky-criteria-b69 | A-059 | 97 | ready-for-agent |

- A-061 发行 G-A 重跑 + 等 G-B: **无实施票**（执行动作，W5）
- GH 镜像: #13→96 · #14→101 · #15→104 · #16→102
- Spec: `spec.md` · 对账: `destination-reconciliation-wave915.md`（无去向=空）
- D 账本: `../wave9-915-release-grill/decision-ledger.md` D-001..D-009
- Frontiers: **W2 = 98 ∥ 104 ∥ 102**（W1 实现齐；96 CI 待 land）

## W1 首脑复核 — 96/100（2026-09-14）

| 票 | 结论 |
|---|---|
| 96 / A-050 | implemented-pending-ci · docs-link-guard 本机 8/8 绿 · AC1/2 具名 F |
| 100 / A-054 | **采信 done** · calver-guard 正/负向 + pretest 4/4 |

详表: `reports/W1-brain-review-96-100.md`

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

## Wave9 波次表（2026-09-13 · 由 Blocked by 推导）

| 波次 | 票 | Covers | Blocked by | 状态 |
|---|---|---|---|---|
| W1 | 87 star-sync | A-041 | — | done |
| W1 | 88 empty-state | A-042 | — | done |
| W1 | 89 auto-expand | A-043 | — | done |
| W1 | 90 webdav-b54 | A-044 | — | done |
| W1 | 91 merge-three-way | A-045 | — | done |
| W1 | 92 boot-pending-e2e | A-046 | — | done |
| W2 | 93 ga-residual-exit | A-047 | 87,88,89 | done |
| W3 | 94 version-2026-9-15 | A-048 | 91,92,93 | done |

- A-040 纸面债: implemented（无票）
- GH 镜像: #10→87 · #11→91 · #12→93
- Spec: `spec.md` · 对账: `destination-reconciliation-wave9.md`（无去向=空）

## Wave9 W1 首脑复核状态（2026-09-13）

| 票 | Covers | 复核结论 | 状态 |
|---|---|---|---|
| 87 | A-041 | 测试夹具修复实物确认 | fixed-pending-ci · 待 push |
| 88 | A-042 | 暗色 token 产品修复确认；亮色另票 | fixed-pending-ci · 待 push |
| 89 | A-043 | overlay deflake 确认 | fixed-pending-ci · 待 push |
| 90 | A-044 | 私网 deny 代码在位 | fixed-pending-ci · 待 push |
| 91 | A-045 | **P0 凭据 + e2e 加载失败** | **blocked-rework → 91R** |
| 92 | A-046 | e2e 文件在位，仅静态 | fixed-pending-ci · 待 push |
| 93 | A-047 | — | **blocked**（87/88/89 CI） |
| 94 | A-048 | — | **blocked**（91R/92/93） |

**Frontier 可开工：95（凭据清扫）** · 91R 已核验关闭（wyw）  
**用户必做：轮换 91 泄漏的 WebDAV 密码**（本地 git 对象库已含；未推 origin 仍须轮换）

完整对照: `reports/W1-brain-review.md`

## 95 首脑核验（2026-09-14）

| 检查 | 结果 |
|---|---|
| grep kel988/jinxi2410 on test/ + .codex-tmp/ | **0** |
| env 占位（91R 同构） | dr-export / import-merge / sync / memory / cred-encrypt 等在位 |
| playwright --list 抽样 | 3 spec 可加载（报告称 7 文件 108 tests） |
| 账本 A-049 | swept-pending-ci |
| 用户 | 声明已移除/轮换该密码 |

**Frontier：无新实施票可开。**  
下一门：**用户明令 push 整栈 → main test.yml** → 关 87–92/91R/95 的 CI 项 → 开 **93**（需 87/88/89 绿）→ **94**。

栈顶: `ticket-95-credential-sweep` (lkk) on 91R on w1-review …


## CI Loop 收口（2026-09-14）

- **main test.yml GREEN**: https://github.com/Xxx91n/boxing/actions/runs/34773593267 @ `16ce5d27`
- 修复链: cluster-map CM-1 → nextSmallIndex → **no-base both-sides-only 字段比较**（nyu/16ce5d27）
- 87–92 / 91R / 95 → **done**
- **93 / 94 → ready-for-agent**
- G-A 出口票 93 实质前置已满足（CI 绿）；93 仍负责残红治理账本化与门禁表述


## W2 首脑复核 — 93（2026-09-14）

| 项 | 结论 |
|---|---|
| 93 / A-047 | **采信 done**（run 34773593267 + 34778641702 皆 4/4 success；R1/R3 关、R2+2F 具名） |
| 安全复查 | test/ 明文凭据仍 **0** |
| 过程 | 93 分支 vwl **未 push** |
| **Frontier** | **可开工：94** |

详表: `reports/W2-brain-review-93.md`


## W3 首脑复核 — 94（2026-09-14）

| 项 | 结论 |
|---|---|
| 94 / A-048 | **采信 done**（版本面 2026.9.15 一致；不宣称三门；G-C 现状 200） |
| Wave9 实施 | **87–95 全部完成** |
| Frontier | **无新实施票**；等 land → 新 tip G-A → **用户 G-B** → tag 门 |

详表: `reports/W3-brain-review-94.md`
