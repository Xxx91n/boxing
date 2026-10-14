# Testing Governance

> Audience: maintainers, CI owners, and agents doing test-governance work.
> This is a governance **record**, not a status board.

> Moved out of `README.md` (ticket 85 / A-035, 2026-09-12): the quarantine register and
> host-environment incident register are English-only governance records that were inlined in the
> product-facing README, while all 13 localized READMEs never carried them. Relocating the block
> converges the agent-work-log impression on the product entry and re-aligns English with the
> localized set. Evidence lives in the local `.scratch/architecture-recovery/` work area
> (untracked since the 2026-10-14 governance pass; relative to this file) and is referenced,
> never deleted.

Original location: `README.md` § Quarantined tests / § Host-environment incident register.

## Quarantined tests

The quarantine program is **converged as of 2026-09-05** (ticket 27): no test titles carry the
`@quarantine` tag anymore. The final 14 entries were repaired by converting their native-input
dispatch to synthetic events (the established repair pattern — the guarded behavior is
app-level, not input realness) and rejoined the Firefox main lane; the only native-input block
kept (double-click selection realness in `boxing-focus-steal.spec.ts`) is chromium-scoped
because native input on the Firefox persistent context stalls (the
[playwright#16095](https://github.com/microsoft/playwright/issues/16095) class). The history:
tags were introduced in architecture-recovery ticket 01, governed since ticket 14, first five
entries repaired at the ticket 18 expiry pass
([.scratch/architecture-recovery/18-quarantine-expiry-report.md](../.scratch/architecture-recovery/18-quarantine-expiry-report.md)),
final 14 at ticket 27
([.scratch/architecture-recovery/27-firefox-quarantine-convergence-report.md](../.scratch/architecture-recovery/27-firefox-quarantine-convergence-report.md)).

| Test (spec › title) | Chromium | Firefox | Registered | Due (30d) |
| --- | --- | --- | --- | --- |
| *(none — quarantine table empty since ticket 27, 2026-09-05)* | — | — | — | — |

Baseline at convergence: chromium 14/14 and firefox 14/14 pass in the quarantine lane
(2026-09-05, ticket 27); after the tag removal the firefox main lane absorbed all 14 tests and
`npm run test:quarantine` selects 0 tests (exit 0 via `--pass-with-no-tests`).

**Expiry rule.** Every entry must be resolved by its due date — either **repaired** (remove the
`@quarantine` tag + `quarantine-ref` comment, rejoin the Firefox lane, delete the row) or
**retired** (delete the test and the row, recording the decision in the governance ticket).
Entries do **not** auto-extend: at expiry the next governance pass forces the decision, defaulting
to retirement. A newly tagged quarantine must be registered in this table the same day, with
due = registered + 30 days. The quarantine lane is patrolled daily by CI
(`.github/workflows/quarantine.yml`, `continue-on-error`).

### Host-environment incident register

Tests that failed from host-load browser instability — not app defects — are registered here
with a CI re-verification due date instead of a `@quarantine` tag: they pass and stay in every
lane, and the repair-or-retire default of tagged quarantine does not fit a host incident.
Classification protocol and evidence: ticket 31
([.scratch/architecture-recovery/31-state-sync-flaky-diagnosis-report.md](../.scratch/architecture-recovery/31-state-sync-flaky-diagnosis-report.md)).

| Test (spec › title) | Incident | Classification | Registered | Due (30d) |
| --- | --- | --- | --- | --- |
| *(none — all incident rows resolved)* | — | — | — | — |

Resolved at the 2026-10-14 governance pass: the three `boxing-state-sync.spec.ts` rows registered
2026-09-06 (2026-09-05 host-load incident, chromium CDP session closed mid-test) showed green in
the chromium lane on post-registration full main runs (34773593267, 34778641702) and stayed green
through the wave-2026.10.11 lanes — resolved per the incident-row rule below.

Incident-row rule: a row is resolved (deleted) once a CI run after the lockfile repair (ticket 29)
shows its test green in the chromium lane. Rows do not auto-extend: past due without CI-green
evidence, the next governance pass must reclassify — defect repair or tagged quarantine.


### Local-only flake observations (not CI residual reds)

Tests observed failing **only on a contended local host** and never in the CI main lane are recorded
here, not in the G-A waiver ledger (the 「G-A 残红书面豁免台账」 section below). The ledger
holds main-lane residual reds; filing a never-red test there would *widen* the waiver surface, against
the ratchet rule (the waiver file may only shrink). Closure follows the industry "downgrade + SLA" path:
the row keeps an owner, a due date, and a concrete escalation trigger, so the observation is never
silently dropped and never becomes a `worksforme` close.

| Test (spec) | Lane | Classification | Observed | Registered | Due | Status | Escalation trigger |
| --- | --- | --- | --- | --- | --- | --- |
| `boxing-innerclip.spec.ts` + `boxing-innerclip-pan.spec.ts` | firefox | environment-only (host-load) | local full run (ticket 94) and local targeted rerun (ticket 106): the **first test in the file** consumes the Firefox headed cold-start cost under host contention and hits the 30s default budget at the shared `resetBoxing` fixture — never a geometry assertion | 2026-09-14 | 2026-10-14 | the face shows `failed`/`flaky` in any main full `test.yml` run, or the `resetBoxing` navigation-timeout signature reappears in CI logs → apply the ticket-13 repair (`test.setTimeout` budget bump) to the two specs and validate on both lanes | **closed 2026-09-15** |

CI evidence for the row (ticket 106): across 9 full-matrix main `test.yml` runs spanning 2026-09-11 →
2026-09-14 the face shows **zero occurrence in 216 executions** (Wilson 95% upper bound ≈ 1.75%). The two
2026-09-12 runs that did show it were a **B (broken)** commit-wide failure — 113 numbered failures,
identical signature on all three OSes and both lanes, including `data-golden` gate 4 — not this
observation. Row rule: a row is resolved (deleted) when the escalation trigger fires and the repair
lands, or when the due date passes with the face green across ≥2 consecutive full `test.yml` runs on
main and the classification re-confirmed as environment-only. Rows do not auto-extend.

**Third closure path - preemptive repair (added 2026-09-15, ticket 111 / A-066).** A row is also
resolved when a wave decision promotes the observation into a repair ticket and that repair lands
- without waiting for the CI escalation trigger or the due date. The row is then marked `closed`
in place (not deleted), so the closure evidence stays in the governance record. First use: the
`boxing-innerclip` firefox row above was closed 2026-09-15 by ticket 111 / A-066 / B72 - the
wave-9.20 grill (D-004 item 2) promoted residual **N-106-01** into the 9.20 implementation wave
ahead of the 2026-10-14 due date, and the ticket-13 repair (`test.setTimeout(120_000)`, with a
written rationale comment in both specs) landed with both lanes green. Evidence:
`.scratch/architecture-recovery/reports/111-report.md`.

## Waiver ledger revocation criteria (ticket 105 / B69)

The G-A residual-red written-waiver ledger (the 「G-A 残红书面豁免台账」 section at the end of
this file) is the release-gate evidence surface for residual flaky reds. The ledger holds the
operational rule text; this section is the docs-layer record of its **revocation criterion**.
Revoking an entry
(`active` → `closed`) is a **two-run** decision, never a one-run observation.

**The criterion (conjunctive):**

- **Consecutive-green count (≥2).** A row may be closed only after the target test shows **zero
  recurrence of its recorded signature across ≥2 consecutive full `test.yml` runs on main**. A
  single run with zero occurrence is **not** sufficient. Ticket 74 closed `boxing-zoom-dblclick`
  on one clean run; ticket 93 observed the same face recur on the next run. That premature
  revocation is the incident this rule exists to prevent.
- **Consecutive means consecutive.** Any change to the tested surface between the two runs
  (`ntp/**`, `test/**`, `.github/workflows/test.yml`, `manifest.json`) **resets** the count. A
  `.scratch/**`-only difference may be carried over via the tip-equivalence rule (`test.yml`
  `on.push.paths` excludes `.scratch`).
- **Evidence shape.** At least one of the two runs must be a same-commit corroboration run
  (`workflow_dispatch` on the same headSha, or a re-verification run on identical tested code)
  annotated `corroboration`; the two runs must come from **different trigger sources** (push vs
  `workflow_dispatch`/`schedule`) **or be ≥24h apart**. The closed row disposal record must carry a
  `撤账证据:` marker followed by **≥2 distinct run references** and the revocation date.
- **Recurrence re-enters the ledger.** If the same signature recurs in any later main run, the row
  immediately returns to `active` and the revocation counts as a failure. This is the safety net
  (GitLab: monitor for 1 week after de-quarantine; Mill: the auto-quarantine system catches it back).
- **N / B / F bucket constraints.** Only **F** (flaky — same code, different outcomes) is ever
  waivable, so only F can be revoked. **B** (broken — identical signature on every lane) is never
  waivable, so it has **no revocation path**: repair, or retire with a written reason. **N**
  (never-quarantine: data-integrity / migration-roundtrip / rollback-drill families) never enters
  the ledger and is never revoked — red there is fix-only.
- **Gate boundary.** Revocation changes only whether a red is still in effect. It is not a waiver,
  not G-A satisfaction, and it does not relax ADR-0017 (G-A ∧ G-B ∧ G-C), the no-permanent-waiver
  rule, or the per-release re-check.

**Machine check.** `node scripts/waiver-ledger-check.mjs` (extended by ticket 105) exits non-zero
when the criteria section is missing from the ledger, when a `closed` row cites fewer than two run
references or lacks the `corroboration` annotation, or when any row (including `closed`) matches the
never-quarantine family list.

## Waiver ledger (G-A residual reds)

Migrated verbatim from `.scratch/architecture-recovery/WORKFLOW.md` §4.4 during the 2026-10-14
governance pass (the work-log layer is now local and untracked). `node scripts/waiver-ledger-check.mjs`
and `scripts/test-evidence.mjs` slice the `### G-A 残红书面豁免台账` section below; keep its heading
and table shape intact.

### G-A 残红书面豁免台账 (Waiver Ledger — 票48 建立)

规则 (来源: 票48 / spec W6-D3 / ADR-0017; 工业对标: atomcode 2026-09-12, 12 篇原文核验, ctx source=atomcode-48):

- **修绿优先**: 豁免是过渡态不是终点 (GitLab: "a queue, not a graveyard"); 台账只允许 flaky/环境性失败进入。
- **broken/flaky 分界 (豁免合法性闸门)**: 同一代码不同结果 (至少一条 lane/OS 绿, 或单跑绿且签名匹配) = flaky; 全签名一致失败 = broken。broken 不得豁免, 只能修或附书面理由退役 (Datadog 7 天 100% 失败即 broken; ICSE 2020: 自动分类把 76.2% 真回归误判为 flaky — 必须先复现分界再豁免)。
- **never-quarantine**: 数据完整性 / 迁移往返 / 回滚演练类用例 (`data-golden`, `migration-golden`, `update-cow-before-migrate`, `snapshot-rotation`, `state-sync`, `data-recovery`, `import-merge`, `sync`/`webdav` 冲突面) 永不入台账 — 红灯只允许修绿 (dbt severity:error 默认 + GitLab state-leak 必修口径)。
- **字段完整性**: 每条 5 字段 (用例名 | 基线 run URL | 失败签名 | 归属票 | 到期) 缺任一即无效; `到期` 最迟为该用例所在面的下一条 main 全绿验证 run。
- **硬到期**: 到期未修 → 二选一: 主 lane 禁用该用例 (grep 排除并注明) 或删除, 并回填处置记录; 禁止无动作续期, 禁止静默 Skip 失明 (A-008)。
- **撤账判据 (Revocation Criteria — 票105/B69)**: 「撤账」= 台账行 `active` → `closed`。以下判据**合取**, 缺一不可:
  1. **连续绿次数 (≥2)**: 目标面须在 **≥2 个连续的 main 全量 `test.yml` run** 中**签名零出现**; **单 run 零出现不足以撤账** —— 票74 曾据单 run 将 `boxing-zoom-dblclick` 撤账, 票93 于下一个 run 观测到该面复发, 即撤账过早事故。(工业口径: Datadog 30 天窗内零复发 / GitLab >100 次本地一致通过 + 1 周观察 / Tenki 10+ 连续通过 / rushstack「multiple times in a row」—— **无一家以单次全绿为判据**; 来源见 reports/105-report.md §1。)
  2. **连续语义**: 两次 run 之间被测面代码若变化 (`ntp/**` · `test/**` · `.github/workflows/test.yml` · `manifest.json`), 计数**重置**; 仅 `.scratch/**` 文档差异可按 tip 等价性沿用 (`test.yml` 的 `on.push.paths` 不含 `.scratch`)。
  3. **撤账证据 (机器校验字段)**: 处置记录须含 `撤账证据:` 标记, 其后列出 **≥2 个 distinct run 引用** 并写明撤账日期; 其中 **≥1 个必须是 corroboration run** (同码重跑: `workflow_dispatch` 对同一 headSha, 或被测代码同一的复验 run) 并在标记区内**显式标注 `corroboration`**; 两次 run 须**分属不同触发源** (push vs `workflow_dispatch`/`schedule`) **或间隔 ≥24h**, 防同一环境毛刺同时洗绿两条证据。
  4. **N/B/F 分桶约束**: 仅 **F (flaky: 同一代码不同结果)** 可入账, 因而**仅 F 可撤账**; **B (broken: 全签名一致失败) 不得入账**, 无撤账路径 —— 只能修绿或附书面理由退役; **N (never-quarantine: 数据完整性/迁移往返/回滚演练家族) 永不入账、永不撤账**, 红灯只允许修绿 (`waiver-ledger-check.mjs` 对 NQ 名单**含 closed 行**一并拦截)。
  5. **门禁边界**: 撤账只改变「该残红是否仍在效」, **不**等于豁免成立, **不**等于 G-A 达成, **不**解除 ADR-0017 三门合取 (G-A ∧ G-B ∧ G-C); 「不得永久豁免」与「每次发行前复查」义务不因撤账而变。
  6. **复发即重新入账**: 撤账后若同一失败签名在任意后续 main run 中再现, 该行**立即恢复 `active`** (并记为一次撤账失败); 撤账行保留本条款引用。对应 GitLab「出隔离后监控 1 周 + 复发立即重隔离」与 Mill「自动隔离系统会把仍然 flaky 的用例抓回」的安全网。
- **发行前复查**: 每次发行 G-A 步骤先跑 `node scripts/waiver-ledger-check.mjs` (exit≠0 = 字段缺失/已过期/签名空/never-quarantine 名单命中 → 阻断发行), 再逐行人工比对失败签名与最新基线。

| 状态 | 用例名 | 基线 run | 失败签名 | 归属票 | 到期 | 处置记录 |
|---|---|---|---|---|---|---|
| closed | boxing-auto-expand › 'large box with collapseHover=true still expands after visiting and returning' (chromium) | https://github.com/Xxx91n/boxing/actions/runs/34626507101 | expand height 60 (collapsed max-height clamp) vs >80, BEFORE ENTER hover; ubuntu-latest only, macos+windows 同码绿; 票15/票31 已备案 60vs80 hover 抖动 (solo 单跑绿) | 48 | 2026-09-19 (撤账条件已达成) | 票93 逐行复核 2026-09-14: 最新 main 全绿验证 run https://github.com/Xxx91n/boxing/actions/runs/34773593267 中本面三 OS x 双浏览器**零出现** → 票89 四层硬化 (waitForInitComplete + 幂等 dismissOnboarding + elementFromPoint 命中断言 + domcontentloaded) 生效 → 按台账规则撤账 closed。R3 关闭。 撤账证据: https://github.com/Xxx91n/boxing/actions/runs/34773593267 (push, headSha 16ce5d27) ; https://github.com/Xxx91n/boxing/actions/runs/34778641702 (corroboration, workflow_dispatch, 同码 02d31657) —— 连续 2 个全量 main run 本面零出现, 触发源不同, 票105 补录; 复发即重新入账。 |
| closed | boxing-empty-state-buttons › 'Bug5-dark: bm-add-btn stays transparent in dark mode' (firefox + chromium) | https://github.com/Xxx91n/boxing/actions/runs/34773593267 | expect.poll 5000ms 谓词超时 (spec L300-301): Expected "rgba(196, 168, 130, 0.12)" / Received "rgba(0, 0, 0, 0)"; ubuntu-latest only, firefox-extension + chromium-extension 各 1; 重试收敛 = flaky | 93 | 2026-09-19 (硬到期) | **C01 处置 2026-09-22（D-003）**: 已修证据 = A-055 / 票101（onboarding helper + assertPointerReaches，本地 Bug5-dark **40/40**）；产品对比度由票88 修复。到期后**不续期**。按票105 撤账判据关账。裁决句「发行时该行为要不要裸奔？」→ **不裸奔**（用例保留启用，不退役）。 撤账证据: https://github.com/Xxx91n/boxing/actions/runs/34857433215 (push, 2026-09-14, 4/4 job success, log-failed 空=签名零出现) ; https://github.com/Xxx91n/boxing/actions/runs/34955347673 (corroboration, push, 2026-09-15, 间隔≈19h 复验, 4/4 job success, log-failed 空=签名零出现) —— 修复合入后连续 2 个全量 main run 本面零出现；复发即重新入账。 |
| expired-handled | boxing-zoom-dblclick › 'single click enters; later dblclick inner creates exactly one small box' (firefox) | https://github.com/Xxx91n/boxing/actions/runs/34773593267 | expect.poll 15000ms 谓词超时 (spec L171-173): Expected true / Received false — inner 未在 15s 内 un-hide; windows-latest firefox only; 重试收敛 = flaky | 93 | 2026-09-19 (硬到期) | **C01 处置 2026-09-22（D-003）**: 已修证据 = 票110 根因修复（onBoxEnterClick 根元素绑定；本地 120 连跑产品签名 0 次；全量 629 passed）。**不续期、不挂 active 等 2 绿**。105 双绿证据尚缺：票110 变更面在 34857433215 与 34955347673 之间落地（计数重置），post-110 仅 34955347673（4/4 success, log-failed 空）1 条。故置 **expired-handled**（非 active、非续期；用例**保留启用**不退役）。待 M4 新 tip G-A 后若再现 1 条零签名全量 run 则升级 closed。裁决句→ **不裸奔**。 |
| closed | boxing-search › 'search filters large boxes by title on main canvas' (firefox) | https://github.com/Xxx91n/boxing/actions/runs/34773593267 | expect(result.matchHasClass).toBe(true) (spec L46) Expected true / Received false; macos-latest firefox only; 重试收敛 = flaky | 93 | 2026-09-19 (硬到期) | **C01 处置 2026-09-22（D-003）**: 已修证据 = A-055 / 票101（固定 200ms 等待改重试式断言，本地 search **40/40**）。到期后**不续期**。按票105 撤账判据关账。裁决句→ **不裸奔**（用例保留启用，不退役）。 撤账证据: https://github.com/Xxx91n/boxing/actions/runs/34857433215 (push, 2026-09-14, 4/4 job success, log-failed 空=签名零出现) ; https://github.com/Xxx91n/boxing/actions/runs/34955347673 (corroboration, push, 2026-09-15, 间隔≈19h 复验, 4/4 job success, log-failed 空=签名零出现) —— 修复合入后连续 2 个全量 main run 本面零出现；复发即重新入账。 |

基线 2026-09-12 (票48): main run 34626507101 残红 = 6 用例面。其中 4 项为 broken 直接修绿 (title-select-all×3: spec 种子载荷缺 version 字段被 migrateLayout 降级拒绝 / Bug5-dark: spec 未关首运引导 overlay 拦截 hover / state-sync concurrent: spec 只盯 A tab 收敛后 B tab 再未被 nudge, 改双 tab 轮询; 另 storage.js 防回环标志 try/finally 硬化 / snapshot-rotation: 同毫秒 ts 撞键已由 t50 `_lastSnapTs` 修复, 属 never-quarantine 不得入账)。2 项 flaky/环境性入上表。台账保持至票48 CI 验证 run 出结果: 对应面绿 → 状态改 closed + 处置记录引用 run URL。

基线 2026-09-14 (票93 · G-A 出口): main 全量 test.yml run 34773593267 (headSha 16ce5d27, push on main) = **4 job 全 success / 0 failed** → 残红清零, G-A 成立。分桶复核: R1 boxing-star-sync-audit Scenario 1 三 OS x 双浏览器**零出现** (票87 修绿 → 关闭); R2 empty-state Bug5-dark 由 failed 降为 ubuntu flaky (上表 active, 具名 F); R3 auto-expand **零出现** (票89 修绿 → 上表撤账 closed)。另新入 2 条 flaky 观察 (zoom-dblclick windows / search macos, 上表 active)。**N 桶与数据完整性零豁免**: data-golden job success 且 continue-on-error 已于票54 摘除; 台账 never-quarantine 正则零命中; node scripts/waiver-ledger-check.mjs exit 0。**tip 等价性**: 当前 main tip 02d31657 与绿 run headSha 16ce5d27 的差异仅 .scratch/** 文档, 且 test.yml on.push.paths 不含 .scratch → 被测代码同一, 绿 run 对 tip 有效。**corroboration（同码重跑, 把「单 run 声明」升级为「稳定态声明」）**: 对 tip 02d31657 触发 workflow_dispatch run **34778641702** → **同样 4 job 全 success / 0 failed**（ubuntu 2 flaky / macos 1 / windows 1, 5 skipped）→ **连续 2 个全量 main run 全绿**; 签名比对: Bug5-dark(ubuntu ff+ch) 与 search(macos ff) **逐字复发**, zoom-dblclick 未复发而 windows 改为 Bug5-dark(ff) → 4 条 flaky 均属「同码不同结果」, 无新增 broken 签名。
