# 票 48 报告 — CI 残红清零（修绿优先 + 受控豁免）

日期: 2026-09-12 · 分支: ticket/48-ci-residual-red-clear · 版本控制: 遵循 WORKFLOW §4.2（未 push、未开 PR）

## 1. 基线

- 基线 = main 最近 test.yml failed run：https://github.com/Xxx91n/boxing/actions/runs/34626507101（t44 close-out push，3 OS 全红；data-golden job 已绿）。
- 57 failed（#9 旧基线）→ 6 用例面。逐面提取自 run 日志（三 OS 对比 + macos/windows 工件 playwright-report DOM 快照复核）。

## 2. 逐项定谳（6 面）

| # | 用例面 | 失败签名 | 分界 | 处置 |
|---|---|---|---|---|
| 1 | boxing-title-select-all ×3（双浏览器、全 OS、retries 全败） | seedTitles `applied=false` | **broken**（100% 失败） | 修绿：spec 种子载荷缺 `version` 字段 → migrateLayout 降级 defaultLayout 丢弃 `_meta.revision:5` → stale-revision 守卫合法拒绝。种子补 `version: 3.5`（真实跨 tab 载荷永远带 version，测试造数据应一致）。产品守卫行为正确，不改产品。 |
| 2 | boxing-empty-state-buttons › Bug5-dark（双浏览器、全 OS、retries 全败） | `page.hover('.bm-add-btn')` 被 `#onboarding-overlay` intercepts pointer events（DOM 快照证实 overlay 可见） | **broken** | 修绿：spec `resetBoxing` 补 `skipOnboarding()`（与 state-sync/zoom 等 spec 同约定）。本 spec 唯一真实指针动作用例，其余 evaluate-only 不受害。CSS 断言本体未动。 |
| 3 | boxing-state-sync › concurrent creation（仅 firefox、全 OS、retries 全败；chromium 全绿） | `second` tab `.large-box` 恒 1（Expected 2），失败快照显示 caption "2 large boxes"=内存已合并、DOM 未更新；10s 窗口后 B 才到 2 | **broken**（firefox lane 确定性） | 修绿（测试侧根因）：poll 只盯 A tab，A 收敛即退出，`second` 的断言是纯 toHaveCount 不再 nudge → 改为双 tab 同 poll（min(count(A),count(B))）+ 20s 预算，每轮都补 nudge。附带产品硬化：applyExternalLayout 防回环标志原只被尾部 finally 释放，merge/DSU/rebuild 段抛出会永久毒化标志（tab 对后续跨 tab 同步永久失聪）→ 整段纳入 try/finally（BX-EXPLORE-014 同类）。state-sync 属数据完整性面，**never-quarantine，不入台账**。 |
| 4 | boxing-snapshot-rotation › saveSnapshot 一快照一键（macos 两 lane） | `bodyKeys.length` 1 vs ≥2：两次 saveSnapshot 落同一毫秒 → `snap.v1.<ts>` 同键覆盖 | **broken**（快 runner 必现竞态） | 修绿：已由 t50 `_lastSnapTs` 单调化修复（commit 6562c17，本票不重复实现、不动他人提交）。数据完整性面，**never-quarantine，不入台账**。 |
| 5 | boxing-auto-expand › collapseHover expands（仅 ubuntu chromium） | hover 高 60 vs >80（BEFORE ENTER，collapsed clamp 值） | **flaky**（同码 macos+windows 绿；票 15/票 31 备案 60vs80 抖动、solo 绿） | 修绿尝试：固定 450ms sleep + 单读取改为有界轮询（10s）读 expand 高度（两处）。同时 **书面豁免入台账**（active，到期 2026-09-19），CI 复测绿即转 closed。 |
| 6 | boxing-zoom-dblclick › single click enters later dblclick（仅 windows firefox） | enter 迁移 expect.poll 默认 5s 超时（inner 未可见） | **flaky/环境性**（同码 2 OS + chromium 绿；playwright#16095 firefox 有头输入延迟家族，票 01/13 备案） | 修绿尝试：poll 预算 15s + backoff。**书面豁免入台账**（active，到期 2026-09-19）。 |

分界方法：同 SHA 不同 OS/lane 结果 = flaky；全签名一致失败 = broken（Datadog broken=7 天 100% 失败、Google 100% 即回归；ICSE 2020 警告自动误判率 76.2% — 故逐面人工判界，数据完整性面一律不入账）。

## 3. 豁免台账机制（票 48 交付）

- WORKFLOW §4.4 新增「G-A 残红书面豁免台账」：规则（修绿优先 / broken-flaky 分界闸门 / never-quarantine 名单 / 5 字段完整性 / 硬到期二选一：禁用或删除并回填处置记录，禁止静默续期与 Skip 失明 / 发行前逐行签名复查）+ 2 条 active 条目（基线 run URL、签名含 OS+lane 限定、归属票 48、到期 2026-09-19）。
- 机器校验 `scripts/waiver-ledger-check.mjs`：字段缺失、active 过期、never-quarantine 名单命中 → exit 1；`--as-of` 负例自测通过（过期行被拒）。发行检查单 G-A 段新增勾选行调用之。
- never-quarantine 名单（spec W6-D3 + atomcode）：data-golden / migration-golden / update-cow / snapshot-rotation / state-sync / data-recovery / import-merge / sync(webdav) 冲突面。

## 4. 调研（atomcode 2026-09-12，本票一次性，ctx source=atomcode-48）

14 检索、12 篇原文核验：Google 2016 / Datadog 状态机（Active→Quarantined→Fixed/Disabled/Broken，30 天自动禁用）/ ICSE 2020（76.2% 真回归被误判 flaky）/ GitLab 双档 3 天+3 月自动删除 / Mergify 2–4 周 + ">2% 且阻塞 PR" 触发线 / dbt severity:error 默认。落地形态全部吸收进 §4.4 规则；与 ADR-0017「不得永久豁免」「逐条具名」条款对齐。信息缺口：无大厂明文"数据完整性测试永不豁免"单一原文（由 dbt 默认 error + GitLab state-leak 必修 + 全绿门槛 + ICSE 四链收敛为强推理），已在台账规则注明证据链。

## 5. 改动清单

- ntp/storage.js — applyExternalLayout 防回环标志 try/finally 硬化（唯一产品改动，行为兼容：无抛出路径不变）。
- test/tests/boxing-title-select-all.spec.ts — 种子载荷补 version: 3.5。
- test/tests/boxing-empty-state-buttons.spec.ts — resetBoxing 补 skipOnboarding。
- test/tests/boxing-state-sync.spec.ts — concurrent 双 tab 轮询收敛。
- test/tests/boxing-auto-expand.spec.ts — 展开高度有界轮询（×2）。
- test/tests/boxing-zoom-dblclick.spec.ts — enter 门 poll 预算 15s。
- .scratch/architecture-recovery/WORKFLOW.md — §4.4 台账节 + 检查单 G-A 机器校验行 + 指针。
- scripts/waiver-ledger-check.mjs — 台账机器校验。
- .scratch/architecture-recovery/issues/48-ci-residual-red-clear.md — AC 全勾 + 证据注记。
- GitHub issue #9 — body 勾选更新（P0-2/P0-4/P0-6 定谳；P0-1 数据找回不可行+恢复=合并已 land；P0-3/P0-5 保持待验证注明）+ 现状评论 https://github.com/Xxx91n/boxing/issues/9#issuecomment-5639792428。未关闭（A-007：仅 G-A+G-B 完成后 close）。

## 6. 验证状态

- 本地：node --check（storage.js/ntp.js/checker）绿；`git diff --check` 绿；waiver-ledger-check 正/负例绿；codegraph sync 已跑。**本机禁跑构建/测试（CI-only mandate），车道绿不认本地输出。**
- 票 48 的 CI 证据由 §7 启动卡产出；基线 6 面中 4 面修绿 + 2 面豁免，G-A「残红清零或逐条书面豁免」在两豁免面复测绿（或按到期处置）后达成。

## 7. 交大脑 — CI 验证启动卡（按 §4.2/CI-only mandate，由大脑推送并 dispatch）

1. 分支 `ticket/48-ci-residual-red-clear`（本票 commit 全部在此，含 42/43/44/45/50 依赖栈顶则需 stack 时 `but move --above`）。
2. push 后：`gh workflow run test.yml --ref ticket/48-ci-residual-red-clear`（或 PR-to-main 触发 push/PR lanes）。
3. 判绿口径：chromium+firefox 主 lane 中本票 6 面对照（1–4 必须绿；5–6 允许在台账豁免语义下 flaky 一次通过即转 closed；若 5/6 仍全败且签名匹配豁免条目 → 保持 active 并在到期前处置）。
4. 结果回填：本报告 + WORKFLOW 台账「处置记录」列（run URL）；快照-rotation 若再现 → 确认 t50 已入本 run ref（未入则先 merge t50）。
5. 若 1–4 面复跑仍红：写返修启动器重开窗口（本票不本地自证）。

## 8. 风险与遗留

- 面 3 的产品侧毒化路径是静态推断（CI 无法本地复现）；测试侧双 poll 修复独立生效，即使根因在别处，收敛判据也已覆盖。若 CI 仍红按 §7.5 返修。
- 面 5/6 的轮询硬化未经 CI 证实 — 这正是台账 active+到期二选一所兜底的状态。
- snapshot-rotation 修复在 t50 分支：票 48 验证 run 需包含 t50（stack/merge），否则 macos 可能再现 flaky。
- @data-golden burn-in（票 45 移交、B20）到期 2026-09-18 摘除 continue-on-error — 独立日历项，不属本票，已在发行检查单挂钩。
