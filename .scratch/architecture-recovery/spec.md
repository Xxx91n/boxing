# Spec — 企业级数据容灾与发布门控（2026-09-12 事故驱动）

> 状态: ready-for-agent  
> 调研: atomcode 2026-09-11（22 源核验，索引 source=atomcode）  
> 父事故: GitHub Issue #9 · P0 书签丢失 + 冻结  
> 关联 ADR: 0009（3-2-1）、0016（sync 分层）、0002（storage.local）  
> Wave4 spec 已归档：本文件取代其为当前工作区权威 spec。

## Problem Statement

2026-09-12 事故：用户升级到 2026.9.12 zip 后 Chrome+Firefox 界面冻结；回退 v3.7.8 后书签被掏空仅剩盒子。根因层面：

1. **冻结**：`ntp/settings.css` 中 `.modal-overlay` 缺闭合 `}`，CSS Nesting 使 `.modal-overlay[hidden]` 等规则永不匹配，全屏遮罩在 hidden 后仍拦截指针事件。
2. **数据**：无升级前强制 COW；`boxingSnapshots[]` 单键存储（Sidebery 140MB 教训）；crash rescue 用快照**覆盖**主键而非 fork 归档；导入/WebDAV 存在 newer-wins 静默丢一侧；发布无数据兼容性 CI 门控。

用户要求：每次发布编译包必须过 CI/CD 或 test 门控，门控旨在保护用户数据不被更新包破坏/覆盖；本地容灾需定时备份 + 版本更新后首开强制备份。

## Solution

四层防线（工业成熟心智模型，来源见 atomcode 调研）：

| 层 | 模型 | 工业先例 |
|---|---|---|
| L0 冻结修复 | CSS hidden pair 必须成对且非嵌套 | BX-DEV-020 既有约定 |
| L1 写前 COW | onInstalled(update) 先 saveSnapshot 再迁移；分键轮转 | Chrome Enterprise 3 份更新后快照；Time Machine 轮转 |
| L2 损坏/恢复 | crash rescue = 归档损坏主键再重建（fork）；导入/同步 = 合并/冲突副本 | Dropbox conflicted copy；Raindrop 永不覆盖；1Password 版本链 |
| L3 发布门控 | golden schema fixture + 迁移单测进 pretest；红灯禁 tag；回滚演练 | Android Room MigrationTestHelper；CWS rollback 前向兼容强制；gh-ost test-on-replica |

## User Stories

1. 作为扩展用户，我希望升级前系统自动留下可回滚的数据副本，这样即使新版本有 bug 我的书签也不会消失。
2. 作为扩展用户，我希望扩展更新后第一次打开时立刻备份当前数据，这样迁移若出错仍可恢复。
3. 作为扩展用户，我希望后台定时备份在 NTP 关闭后仍继续，这样长时间不打开新标签页也有副本。
4. 作为扩展用户，我希望快照按时间分层保留（小时/日/周），这样既覆盖最近误操作也能找回更早状态。
5. 作为扩展用户，我希望存储损坏时旧数据被归档而不是直接删掉，这样我或支持人员仍能手工提取。
6. 作为扩展用户，我希望从备份导入时永不静默覆盖已有书签，冲突时生成副本供我选择。
7. 作为扩展用户，我希望 WebDAV 多设备冲突时双方数据都保留（冲突副本），而不是 newer-wins 丢一侧。
8. 作为扩展用户，我希望设置页能看到最近备份时间与快照数量，这样我知道容灾是否在工作。
9. 作为扩展用户，我希望一键从最近健康快照恢复，且恢复前自动再存一份当前状态（fork）。
10. 作为发布者，我希望 CI 在 schema 迁移破坏旧数据格式时直接红灯，而不是用户升级后才发现。
11. 作为发布者，我希望每个 schemaVersion 都有仓库内 golden fixture，迁移测试可复现。
12. 作为发布者，我希望测试套件包含「旧版数据 → 新版代码」的升级路径测试。
13. 作为发布者，我希望测试套件包含「新版数据 → 旧版代码」的回滚安全测试（expand/contract）。
14. 作为发布者，我希望 zip/crx/xpi 产物在 CI 绿灯前无法被标记为可发行。
15. 作为发布者，我希望发行检查单明确：CI 绿 + 人工黄金路径 + curl 200 三者齐备才可 tag。
16. 作为维护者，我希望快照存储为分键而非单键数组，避免 Sidebery 式单键膨胀后 get/set 全挂。
17. 作为维护者，我希望 storage 写失败（lastError/配额）被显式捕获并提示，而不是静默吞掉。
18. 作为维护者，我希望 CSS `[hidden]` fallback pair 有构建期校验，缺失括号或嵌套错误在 build 失败。
19. 作为维护者，我希望 ADR 记录本次容灾模型升级及事故教训，供后续代理遵循。
20. 作为维护者，我希望恢复语义文档化为「合并/fork，永不覆盖」，废除静默 newer-wins 作为默认。

## Implementation Decisions

### D1 快照分键 + 分层轮转（取代 boxingSnapshots[] 单键）
- 键形态：`snap.v1.<ts>`（或分桶 `snap.v1.<bucket>.<ts>`），索引键 `snap.v1.index` 仅存 ts 列表。
- 轮转（Time Machine）：近 24h 每小时 1 份、近 30 天每日 1 份、更早每周 1 份；总量与单份上限沿用 ADR-0009（单份 2MB / 总 8MB 或提高后的预算），LRU 兜底。
- 禁止把全部快照塞进单个 storage 键（Sidebery #1057）。

### D2 更新即 COW
- `onInstalled` reason=update：**先** `saveSnapshot('pre-update')` **再** 跑 `migrateLayout`。
- 消费现有 `boxingInstallSignal`（ADR-0016）；NTP 侧 init 看到 update 信号时若检测到 schema 迁移待执行，同样先快照。
- 无信号路径（file:// 测试）保持现有行为。

### D3 crash rescue = fork
- 读主键失败/校验失败：将损坏 JSON 写入 `boxingLayout.corrupt.<ts>`，再以最近健康快照重建 `boxingLayout`。
- 不直接覆盖损坏主键；用户可见提示（ABP 模式）。

### D4 恢复 = 合并
- 导入 JSON、WebDAV/Gist 拉取：默认追加合并；同 id 字段分歧 → 冲突副本键，禁止静默 newer-wins 丢一侧。
- ADR-0016 的 newer-wins 降级路径仅在用户显式选择「覆盖恢复」时使用。

### D5 CI 数据门控
- 仓库维护 `test/fixtures/schema/vN.json` golden 文件（每个已发布 schemaVersion 一份）。
- Playwright/单测：旧 fixture → 当前 migrateLayout → 断言书签数/盒子数不减、关键字段存在。
- 回滚测试：当前数据写入后，用上一版本号的读取约束验证前向兼容（expand/contract）。
- `pretest` / CI test job 失败 = 禁止 land/tag。

### D6 构建期 CSS hidden 校验
- build.mjs 增加括号平衡扫描：任一源 CSS 文件 final depth ≠ 0 → build fail。
- 检测嵌套 `[hidden]` 选择器（depth≥1）→ build fail。

### D7 发行门禁（流程）
- 同时满足才可宣称可发行：CI 全绿 + 人工 zip 黄金路径验收 + Pages/HTTP 200。
- 写入 ADR-0017 + WORKFLOW。

## Testing Decisions

- 只测外部行为：storage 键布局、备份条数、恢复后书签计数、升级路径数据完整性、CI 退出码。
- 新 seams：
  1. `saveSnapshot` / `listSnapshots` / `restoreFromSnapshot`（storage 层 API）
  2. `migrateLayout` + golden fixtures
  3. build.mjs CSS validator
- 既有 prior art：`boxing-sync-*.spec.ts`、`data-recovery.spec.ts`、import-graph-guard。
- 禁止断言内部 Map/Set 实现细节。

## Related Ticket (Wave 1 parallel)

- **47**: Pages Actions 工件不完整：demo/ntp.css 404（裸 HTML）+ /privacy-policy.html 404（商店硬依赖，票 07 曾预警）。属发行可观测面，与 DR 数据路径并行。

## Out of Scope

- 云端自动书签同步产品化（仍限 WebDAV/Gist）。
- 跨浏览器账号系统。
- CWS/AMO 实际上架操作（流程写入文档，人工执行）。
- 已丢失书签的找回（用户确认救不回）。
- Wave4 功能票回归（已另轨）。

## Further Notes

- atomcode 明确信息缺口：AMO 阶段发布一手文档未核验；单键拆小是否降低损坏率属工程共识非实证——落地时以 Sidebery/MetaMask 事故为风险驱动，不以实证为前置。
- CSS 修复（票 40）与数据容灾可并行，但发行门禁（票 46）两者都要绿。


---

# Wave6 Spec — 容灾 M1 产品化 + 门禁收口 + 票务 + urlOpenMode

> 数据源: `.scratch/wave6-dr-grill/decision-ledger.md`（D-001..D-011）→ `decision-ledger.md`（A-001..A-011）
> 状态: ready-for-agent（local issues）· 日期: 2026-09-12
> 每条 Implementation Decision **声明覆盖的 A-xxx**

## Problem Statement（Wave6）

Wave5 底座（snap.v1 / COW / fork / golden / ADR-0017）已 land，但仍：

1. 用户**点不到**一键回滚（API 有、设置无入口）；导出不含历史索引语义未定。
2. main test.yml 仍红（G-A 未满足）；G-B 人工 zip 黄金路径未执行 → **不可发行**。
3. 事故票 #9 未更新；B15–B23 只在 history 文档未立票。
4. 用户实机：新装/重置后书签仍开新标签（与 main 源码 sameTab 默认矛盾）。

## Solution（Wave6）

| 轨 | 方案 | 覆盖 A-xxx |
|---|---|---|
| 容灾 α | Time Machine 一键回滚 UI + 恢复/覆盖/导入前安全快照 | A-003, A-011 |
| 容灾 β | 默认导出 layout+meta 索引；可选完整包；覆盖必先本地副本；RPO/RTO 入 ADR | A-003, A-006, A-011 |
| 门禁 | G-A 修绿优先+受控豁免；G-B 用户人工检查单；#9 绑门禁后关 | A-002, A-007, A-008, A-009 |
| 设置 | urlOpenMode 新装/重置默认 sameTab（以实机为准） | A-004, A-005 |
| 票务 | B15–B23 全立；P2 不占带宽 | A-010 |

## User Stories（Wave6 增量）

21. 作为扩展用户，我希望在设置里列出快照并一键回滚到某个时间点。
22. 作为扩展用户，我希望回滚/覆盖/导入前系统自动再存一份当前状态，误操作可撤销。
23. 作为扩展用户，我希望默认导出是干净的当前布局+元数据索引，换机可还原现状。
24. 作为扩展用户，我可选导出「完整容灾包」以带走快照正文。
25. 作为扩展用户，我希望新装或重置后点书签默认在**当前标签页**打开。
26. 作为发布者，我希望残红要么修绿要么具名到期豁免，数据完整性测试永不豁免。
27. 作为发布者，我希望 G-B 由人在真浏览器对 zip 解包产物签字验收。
28. 作为发布者，我希望 #9 仅在 G-A+G-B 完成后关闭并链证据。

## Implementation Decisions（Wave6）

### W6-D1 回滚 UI + 安全快照（覆盖 A-003, A-011）
- 设置数据区：快照列表（ts/schemaVersion/size）+ 回滚二次确认。
- 回滚/恢复/覆盖/导入入口统一先 `saveSnapshot('pre-restore')`。
- 禁止无安全快照的整替恢复。

### W6-D2 导出混合策略（覆盖 A-003, A-006, A-011）
- 默认导出信封：主布局 + `meta:{schemaVersion, snapshots:[索引], corrupt:[索引], conflicts:[索引]}`（**不含正文**）。
- 可选完整容灾包才打包正文；体积预估 + 5MB 处理。
- 文件名 `boxing-backup-YYYYMMDD.json`。
- 同步/导入覆盖路径必先本地副本（代码级+测试）。
- RPO/RTO 写入 ADR-0009 修订 + ADR-0017 交叉引用。

### W6-D3 G-A 治理（覆盖 A-002, A-008）
- 修绿优先；豁免仅 flaky/环境性且签名匹配。
- 数据完整性/迁移/回滚类 **never-quarantine**。
- 豁免字段：用例名、基线 run、签名、归属票、到期；到期未修禁用或删除。
- 发行前校验台账未过期且签名仍匹配。

### W6-D4 G-B 人工路径（覆盖 A-009, A-007）
- ready-for-human：用户在真 Chrome+Firefox 对发行 zip 解包产物按 WORKFLOW §4.4 勾选。
- 含 pre-update 快照与回滚演练；禁止纯自动化宣称完成。
- 完成前只更新 #9；完成后 close 并链证据。

### W6-D5 urlOpenMode（覆盖 A-004, A-005）
- 验收以实机为准：新装或重置后点击书签=当前标签导航。
- 根因面：旧包、重置未清 settings、首帧 DOM newTab、残留写路径。
- 不接受仅修下拉显示关票。

### W6-D6 票务卫生（覆盖 A-010, A-001）
- 必立：48 GA · 49 GB · 50 DR-α · 51 DR-β · 52 URLOPEN · 53 B17 · 54 B20。
- P2 立票可见：55 B18 · 56 B19 · 57 B21 · 58 B22 · 59 B23。
- 红线：三门禁齐备前禁 tag（A-002）。

## Testing Decisions（Wave6）

- 优先既有 seam：`__boxingDebug` + storage facade + Playwright chromium-extension。
- α：回滚往返、安全快照计数（seed→reload 须中和 unload 写回）。
- β：导出信封不含正文、完整包含正文、导入还原、覆盖前副本。
- urlOpenMode：空 storage 新装路径点书签=当前标签；首帧 select 值。
- G-A：以「改动不存在的分支 CI run」做残红基线对照。
- 禁 file:// 把 `chrome.storage` 当主 seam。

## Out of Scope（Wave6）

- 冲突解决 UI 实施（A-003 deferred；票 55 可见不实施）
- OPFS 介质迁移、CRDT、导出加密（A-003 deferred）
- 书签找回（B24 closed）
- 商店实际上架操作（A-46-2 wave5 deferred）

## Further Notes

- 源账本 D-xxx 与 A-xxx 1:1；实现票 AC 以 local issue 为准。
- 通用调研（atomcode+ADR+CONTEXT+工业对标）写在各 handoff，启动器只引用路径。

## Wave7 — 零闪现 + 发行卫生（2026-09-12）

**覆盖 A-xxx:** A-012, A-013, A-014, A-015, A-016, A-017, A-018, A-019, A-020（deferred 见 Out of Scope: A-021..A-024）

### Problem Statement

新开标签页会闪现默认主题/错误内容（Firefox 更明显）；README 宣称 ready-to-use 与 ADR-0017 门禁矛盾；CRED 硬编码密钥与用户可见版本串/债务标记不诚实或不一致。

### Solution

一张 P1 修零闪现（主题首帧 + 内容遮罩）；并行发行卫生票收窄 README、诚实标注 CRED、文档化 WebDAV 限制、统一版本串、合并用户可见债务清理；G-B 仍人工并行，不扩门禁。

### User Stories

- 作为用户，新开标签时第一帧已是我的主题与记忆布局语义，无 beige/亮暗跳变/错误盒子。
- 作为用户/审核方，README 只陈述已发布事实，不宣称未过门禁的构建可安装。
- 作为隐私读者，凭据保护级别与 WebDAV 私网限制被如实说明。

### Implementation Decisions

| 项 | 决定 | 源 |
|---|---|---|
| 零闪现 | 一张票；paint-critical 镜像 + classic boot；内容遮罩；boxingLayout 仍为真源 | A-013/A-014 |
| 门禁 | 不改 ADR-0017 合取；闪现不进 G1–G6；不设 G-D | A-014 |
| README | Latest published=v2026.9.11；候选 draft/pre-release | A-015 |
| CRED | 诚实标注或 per-install key；不做 passphrase 重设计 | A-017 |
| WebDAV | 仅文档化；opt-in 后置 | A-018 |
| 债务 | 一张合并卫生票；i18n 重复键不动 | A-020 |

### Testing Decisions

- 零闪现: Chrome+Firefox 新开标签慢放人工 AC（票内）；不勾 G-B 六项。
- 文档票: 文案 diff + 门禁一致性自检（不得出现可发行宣称）。
- CRED: 若改 key 策略需单测/手工备份还原；仅改标注则文案审查。

### Out of Scope

- A-021 性能债实施；A-022 popup 改造；A-023 .scratch 搬家；A-024 V6 升为门禁。
- G-B 实机本体与 #9 close（用户并行）。
- 源码实施不在 spec 撰写窗口。

### Further Notes

- 权威 current: wave7-flash-grill/decision-ledger.md D-001..D-004。
- 对账: wave7-flash-grill/destination-reconciliation.md。
- CONTEXT 词条已增补 zero-flash / paint-critical boot mirror。

---

# Wave8 Spec — G-A 残红治理 · 2026.9.12 发行候选 · 锐评重开项

> 状态: ready-for-agent
> 覆盖 A-xxx: A-025..A-037
> 源: wave8 decision-ledger D-001..D-008 · next-round.md · atomcode-ga-residual-research.md
> 关联: ADR-0017（门禁合取，未修改）· ADR-0009/0016 · ADR-0013 Q3=B

## Problem Statement

1. G-A 不成立：main test.yml run 34686760142 全红；台账仅 2 条 active 豁免，不能折算为绿；N 桶 never-quarantine，B 桶 broken。
2. 正式发行号 2026.9.12（含零闪现）；候选包 34689649760；G-B 必须在该新包人工执行；过闸前禁 tag/禁宣称。
3. 锐评未关项 Wave8 全量重开：冲突副本读取口、merge 质量、CRED per-install、WebDAV opt-in、搜索 debounce、popup/、文档产品化、票务卫生。

## Solution

- 并行：G-A 源码 70–74 ｜ G-B 人工 75–76/78 ｜ 锐评 79–86。
- 门禁纯度：不扩 ADR-0017；禁 G-D；N/B 禁豁免。
- 单一台账：B45–B48 废止并入对应票。

## User Stories

1. 作为发布者，数据完整性用例红灯时不能用豁免冒充可发行。
2. 作为发布者，2026.9.12 包含零闪现且 G-B 在该包取证。
3. 作为发布者，升级/回滚基线固定 v2026.9.11。
4. 作为用户，冲突副本可列表并导出 JSON。
5. 作为用户，WebDAV 合并不静默丢子盒（方案先行）。
6. 作为用户，凭据混淆诚实且可选 per-install key。
7. 作为用户，可显式 opt-in 私网 WebDAV。
8. 作为用户，搜索输入不卡顿。
9. 作为维护者，popup/与文档/卫生有票面。
10. 作为审计者，每票声明 A-xxx，波次由 Blocked by 推导。

## Implementation Decisions

- 分桶权威：atomcode-ga-residual-research.md；H1–H4 由票 70 定谳。
- 票 73 仅当 H1；禁止回滚零闪现。
- 候选包 version=2026.9.12 amo_sign=true make_release=false；路径禁 gb-2026.9.13。
- R2 先方案；R8 禁升门禁。
- 本地 tracker issues/NN-slug.md；版本控制遵循 WORKFLOW §4.2。

## Testing Decisions

- 优先既有 Playwright seam；never-quarantine 家族不得 skip/豁免。
- G-A 验收：N/B 用例绿或书面退役；waiver-ledger-check exit 0 且无 N/B 行。
- R1：settings 冲突列表+导出；R4：opt-in 开关默认仍拒。
- G-B 仍为人工黄金路径。

## Out of Scope

- 修改 ADR-0017 合取 / 新增 G-D。
- 回滚票 60 零闪现或解耦记忆。
- passphrase 真加密重写。
- 过程违规升 release-blocking。
- tag/Release/商店提交（须明令且三门齐备）。

## Further Notes

- Wave7 A-021..024 已由 D-007 重开；结算原文不改写。
- 人工项不阻塞源码票并行。
