# 74 — 既有豁免两条复查（A-025 · Wave8 T5 / P-GA5）实施报告

- 日期: 2026-09-12
- 窗口启动器: `.scratch/architecture-recovery/prompts/74-ga-waiver-review.md`
- 覆盖 A-xxx: **A-025**（源 `.scratch/wave8-release-grill/decision-ledger.md` D-006 / next-round.md T5）
- 阻塞: None (can start immediately) — 满足
- 状态: **AC 三项全勾，逐行处置完成**

---

## 1. 结论（逐行处置终表）

| # | 用例面 | 复核前 | 复核后 | 关键证据 |
|---|---|---|---|---|
| 1 | boxing-auto-expand › large box with collapseHover=true still expands after visiting and returning (chromium) | active | **active（维持）** | run 34686760142 仅 ubuntu-latest + chromium-extension 命中，签名逐字仍为 Expected >80 / Received 60；已由 failed 降级为 1 flaky（重试收敛）；macos/windows 零命中 |
| 2 | boxing-zoom-dblclick › single click enters; later dblclick inner creates exactly one small box (firefox) | active | **closed（撤账）** | run 34686760142 三 OS × 双浏览器零命中（绿）；票48 放宽 poll 预算至 15s 已生效（spec 现 timeout=15000） |

- active 行数 2 → 1；**未新增任何 N/B 豁免行**（N = never-quarantine 家族，B = broken 桶）。
- 到期：两条原到期均为 2026-09-19，as-of 2026-09-12 **未过期**，硬到期分支未触发（机制实证见 §4 V2/V3）。

---

## 2. 证据：最新基线 run 34686760142 程序化取证

run 34686760142 是 main 分支**最新一条已完成**的 Test workflow（run_number 32，head_sha `f8556297`，2026-09-12T09:47:33Z，conclusion=failure）；后续 run 29/30/31 均为 cancelled。取证材料 = 本地已存档原始日志 `.codex-tmp/ci-34686760142.log`（9470 行 / 1.18MB），按 job 切分后统计：

| job | failed | flaky | skipped | passed | auto-expand 命中 | zoom-dblclick 命中 |
|---|---|---|---|---|---|---|
| data-golden | 1 | 0 | 1 | 5 | 0 | 0 |
| test (ubuntu-latest) | 37 | 1 | 5 | 507 | 4（编号 #38 = 该 flaky） | 0 |
| test (macos-latest) | 36 | 1 | 5 | 508 | 0 | 0 |
| test (windows-latest) | 36 | 1 | 5 | 508 | 0 | 0 |

关键判读：

1. ubuntu 的 38 条编号条目 = 37 failed + 1 flaky；auto-expand 为第 38 条且落在 `1 flaky` 段（日志 L3484「37 failed」→ L3522「1 flaky」→ L3523 auto-expand 标题），即**首轮失败、重试收敛**，不再计入红灯。
2. 失败签名逐字比对：`Expected: > 80` / `Received: 60`、`expect(...poll...).toBeGreaterThan(80)`、`Timeout 10000ms exceeded while waiting on the predicate`（L3465–L3475）——与台账所记「expand height 60 vs >80」**完全一致**，签名新鲜度成立。
3. zoom-dblclick 全日志零命中：`/zoom-dblclick/i` = 0；`/dblclick/i` 的 90 行均为被测页面 `onCanvasDblClick` 调试噪声，非失败条目。两份 spec 均无 `@quarantine` / `test.skip` / `test.fixme`，排除「因被排除而未失败」的假阴性。

---

## 3. AC 逐项与证据

| # | AC | 结果 | 证据 |
|---|---|---|---|
| 1 | 逐行复核处置 | 通过 | §1 终表：两条逐行定谳并各回填台账「处置记录」列——auto-expand 维持 active、zoom-dblclick 撤账 closed |
| 2 | 过期按硬到期处理 | 通过（当前未过期；硬到期分支已实证） | as-of 2026-09-12 / 09-18 / 09-19 均 exit 0；as-of 2026-09-20 exit 1 并报 `active waiver EXPIRED (2026-09-19 < 2026-09-20) — 到期未修必须禁用或删除并回填处置记录, 禁止续期`。故 2026-09-19 当日若仍 active，须走禁用/删除二选一，**禁止续期** |
| 3 | 不新增 N/B 豁免行 | 通过 | 台账总行数不变（2 行 = 1 active + 1 closed），新增行为 0；auto-expand 不命中 never-quarantine 正则（data-golden / migration-golden / update-cow / snapshot-rotation / state-sync / data-recovery / import-merge / webdav / sync-ui / boxing-sync），且非「全签名一致失败」故不属 B 桶 |

专属验收：`node scripts/waiver-ledger-check.mjs` → **exit 0**。

---

## 4. 验证命令与结果（可复核）

| # | 命令 | 结果 |
|---|---|---|
| V1 | `node scripts/waiver-ledger-check.mjs` | exit 0：`OK — 2 ledger row(s), all fields complete, none expired, never-quarantine clear (as of 2026-09-12)` |
| V2 | `node scripts/waiver-ledger-check.mjs --as-of 2026-09-19` | exit 0（到期当日仍有效：脚本用严格 `<` 比较） |
| V3 | `node scripts/waiver-ledger-check.mjs --as-of 2026-09-20` | exit 1 + 硬到期告警（AC2 机制证明） |
| V4 | 台账文件完整性 | 18093 → 18555 字节；CRLF=0（保持 LF）、无 BOM 变更 |
| V5 | 逐行定位断言 | auto-expand / zoom-dblclick 行各匹配且仅匹配 1 次，写入后回读校验通过 |
| V6 | `gh api repos/Xxx91n/boxing/actions/runs?branch=main` | 确认 34686760142 为最新已完成 Test run（后续 29/30/31 cancelled） |

---

## 5. 与 70–72 对齐 / 交叉留痕

- 本票与票 70 复用同一基线 run **34686760142**。本票产出（auto-expand 由 failed 降级为 flaky、zoom-dblclick 转绿）是票 70「集合差」的**输入证据**，不替代其终表。
- **证据更正（供票 70 采纳，本票不代改其交付物）**：wave8 atomcode 调研 §2 桶 B 的 B8 记「auto-expand … 本 run firefox 面亦见」。按 run 34686760142 原始日志逐 job 统计，auto-expand **仅**出现于 ubuntu-latest 的 chromium-extension（4 行，编号 #38），firefox 面与 macos/windows 面均零命中。建议在票 70 终表中把 auto-expand 由「B 桶（chromium + firefox）」下调为「ubuntu + chromium flaky」。
- 票 71（N 桶修绿）/ 票 72（B 桶修绿）/ 票 73（boot-pending × e2e，仅 H1）：本票**不触碰**其目标面；本票只做台账处置，不改任何测试源码或生产源码。
- 门禁纯度：未改 ADR-0017 合取、未设 G-D、未回滚零闪现（A-025 显式约束）。本票**不**把「2 → 1 条豁免」折算为 G-A 绿——main run 34686760142 仍 37/36/36 failed，**G-A 仍不成立，tag 仍锁**。

---

## 6. 调研与工业对标（D-005 精神）

- **调研载体**：复用 wave8 已交付的 atomcode 深度调研（`.scratch/wave8-release-grill/atomcode-ga-residual-research.md`，D-005 协议、串行一次、已回顾 W8 D-001..D-005 + A-008 + ADR-0017，结论为「无冲突、无需 revised」）。本窗口另做**等价程序化取证**：对 run 34686760142 原始日志按 job 切分 + 逐编号条目定谳（§2），补齐了 atomcode 报告 §6 自述信息缺口「34626507101 逐条失败标题未与本次做程序化集合差」中属于**本票两条**的部分。
- **心智模型回顾**：`docs/CONTEXT.md` §Data Resilience & Release Gate（release gate = G-A ∧ G-B ∧ G-C；G-A = main-lane CI reds cleared **or per-item written waiver**）与 §Wave8 grill 词条；ADR-0017（合取 + 数据完整性永不豁免）；WORKFLOW §4.4 台账规则（broken/flaky 分界、never-quarantine、硬到期）。
- **工业对标**：① *GitLab — quarantine is a queue, not a graveyard*：撤账条件达成即出队（本票将 zoom-dblclick 出队），未达成者不得静默续期。② *Datadog 7 天 / ICSE 2020*：broken（全签名一致失败）与 flaky（同码不同结果）的分界必须先复现再定性——auto-expand 在 3 个 OS 中仅 1 个出现且重试收敛，落在 flaky 侧，豁免仍合法；若后续出现「三 OS × 双浏览器一致失败」则必须改判 broken 并**退出台账**（禁豁免）。③ *dbt severity:error*：数据完整性类永不为 warn——never-quarantine 正则保持现状，本票未放宽。

---

## 7. 冲突与改向声明

- 与 decision-ledger **current**（A-025 及 W8 D-001..D-008）**无冲突**：本票结论全部服从既有约束（N/B 禁豁免、不扩 ADR-0017、不回滚零闪现、过闸前禁 tag）。
- 因此**无需**标 revised、**无需**新立 D-xxx。§5 的 B8 更正属**证据层**修正（同一 run 的日志统计与调研转述不一致），不改决策、不触发改向。

---

## 8. 完成定义自检

- [x] AC 全勾（见 §3 三项）
- [x] 专属验收 waiver-ledger-check exit 0（§4 V1）
- [x] 报告落 reports/74-report.md
- [x] 不 tag、不宣称可发行、不扩 ADR-0017
- [x] 未新增 N/B 豁免行（active 2 → 1）
- [x] 版本控制遵循 WORKFLOW §4.2（见 §9）

---

## 9. 版本控制

遵循 WORKFLOW §4.2（GitButler `but` CLI）：不 push、不开 PR、不 tag。

本票改动文件：

- `M .scratch/architecture-recovery/WORKFLOW.md`（台账两行：auto-expand 回填处置记录并维持 active；zoom-dblclick status → closed 并回填处置记录）
- `M .scratch/architecture-recovery/issues/74-ga-waiver-review.md`（AC 三项勾选）
- `A .scratch/architecture-recovery/reports/74-report.md`（本报告）

并行分支交叉：提交前以 `but diff` 逐 hunk 认领，仅提交上述文件对应的 hunk，不卷入其他票在途的未提交改动。
