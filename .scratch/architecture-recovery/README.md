# Architecture Recovery — 2026.9.12 发行包

> 调查: [38-2026-09-12-release-architecture-investigation.md](38-2026-09-12-release-architecture-investigation.md)  
> Spec: [spec.md](spec.md) · GitHub Milestone: [2026.9.12](https://github.com/Xxx91n/boxing/milestone/1) (#1–#8)  
> 流程: [WORKFLOW.md](WORKFLOW.md)（§4.2 版本控制唯一来源）

## 并行波次（由 issues/Blocked by 推导）

| 波次 | 票 | Blocked by | 可并行 |
|------|-----|------------|--------|
| Wave 1 | 01 icons | None | 是 |
| Wave 1 | 02 readme-sync | None | 是 |
| Wave 1 | 03 store-i18n | None | 是 |
| Wave 1 | 04 sync-ui | None | 是 |
| Wave 1 | 05 firefox-scroll | None | 是 |
| Wave 1 | 06 pages-index | None | 是 |
| Wave 2 | 07 pages-demo | 06 pages-index | 与 08 并行 |
| Wave 2 | 08 version-unify | 01, 02, 03 | 与 07 并行 |

```
Wave1: [01][02][03][04][05][06]   ← 全部可同时开工
           │  │  │        │
           └──┴──┴──┐     └──► 07 (需 06)
                    ▼
              08 version-unify   ← release 收口
```

## 目录

- `spec.md` — to-spec 产出（ready-for-agent）
- `issues/0N-*.md` — 本包 8 票（16–37 为历史轮次）
- `handoffs/0N-*.md` — 子窗口 handoff（含 atomcode 完整提示词）
- `prompts/0N-*.md` — 窗口启动器（≤60 行；唯一入口）
- `reports/` — 子窗口完成报告落点
- `38-2026-09-12-release-architecture-investigation.md` — 调查报告

## 派发

人工将 `prompts/0N-slug.md` 原文贴入子窗口。子窗口开工第一句必须复述阻塞 + 必读清单。

## 商店阻塞集

`01 icons` + `03 store-i18n` + `08 version-unify` — 上架前必须绿。

## Wave 1 复核状态（2026-09-10 首脑实物复核）

> 证据: reports/40-wave1-brain-review.md · 方法: hash/but show/HTTP/grep, 不信自述
> 版本控制: 全程 GitButler (`but`) 并行分支, 互不影响 (WORKFLOW §4.2)

| 票 | 状态 | 分支 | 报告 |
|---|---|---|---|
| 01 icons | DONE-CI-OPEN | `01-icons` @ zvs | 有 |
| 02 readme-sync | DONE | `ticket-02-readme-sync` @ xul,nqs | 有 |
| 03 store-i18n | **NOT-STARTED** | 无 | **无** |
| 04 sync-ui | DONE-CI-OPEN | `04-sync-ui` @ zqr | 有 |
| 05 firefox-scroll | DONE-CI-OPEN | `ticket-05-firefox-scroll` @ pvy | 有 |
| 06 pages-index | DONE | `ticket-06-pages-index` @ sup,lnv | 有 |
| 07 pages-demo | **FRONTIER** | — | — |
| 08 version-unify | BLOCKED by 03 | — | — |

### Frontier（下一波）

```
立即并行开工:
  03 store-i18n     从未实施; 无阻塞; 阻塞 08
  07 pages-demo     06 已 DONE, 阻塞边解除

仍阻塞:
  08 version-unify  等 03 完成 (01/02 已 DONE)

CI 门 (合并前必须绿): 01 / 04 / 05
```

### 过程违规 (不追认)

- **V1 BLOCKER**: 03 被宣称完成, 仓库零实物 (无分支/无报告/键 0/14) → 重发启动器
- **V2 NOTE**: 全员 CI-only, 本机零 build/test → 合并前补 CI 绿
- **V3 NOTE**: 04 改 14 locale 仅 syncGroupShared → 正当范围, 非污染
- **V4 NOTE**: AMO 链接 404 — 用户裁定不改, 06 保留

## Wave 2 复核状态（2026-09-10 首脑实物复核）

> 证据: reports/41-wave2-brain-review.md · 方法: JSON/manifest/spec/workflow/stub node --check/but, 不信自述
> 版本控制: 全程 GitButler (`but`) 并行分支, 互不影响 (WORKFLOW §4.2)

| 票 | 状态 | 分支 |
|---|---|---|
| 01 icons | DONE-CI-OPEN | `01-icons` @ zvs |
| 02 readme-sync | DONE | `ticket-02-readme-sync` @ xul,nqs |
| 03 store-i18n | **DONE-CI-OPEN** | `03-store-i18n` @ kky,qtr |
| 04 sync-ui | DONE-CI-OPEN | `04-sync-ui` @ zqr |
| 05 firefox-scroll | DONE-CI-OPEN | `ticket-05-firefox-scroll` @ pvy |
| 06 pages-index | DONE | `ticket-06-pages-index` @ sup,lnv |
| 07 pages-demo | **DONE-CI-OPEN** | `ticket-07-pages-demo` @ swt,utn |
| 08 version-unify | **FRONTIER** | — |

### Frontier（下一波）

```
立即开工: 08 version-unify (唯一剩余; 01+02+03 全 DONE)

CI 门 (合并前必须绿): 01 / 03 / 04 / 05 / 07
人工门: 07 Pages Source → GitHub Actions (账户操作)
```

### Wave 2 违规 (不追认)

- V1 NOTE: 03/07 CI-only, 本机未跑 build/Playwright → 合并前补 CI 绿
- V2 NOTE: 07 Pages Source 人工步骤未代操作 → 正确边界
- V3 正面: 03 先自检主 Agent 结论再实施, 符合启动器质检要求

## Wave 3 复核状态（2026-09-10 首脑实物复核 · 票包收口）

> 证据: reports/42-wave3-brain-review.md · 方法: JSON/grep/node --check/but, 不信自述
> 版本控制: 全程 GitButler (`but`) 并行分支, 互不影响 (WORKFLOW §4.2)

| 票 | 状态 | 分支 |
|---|---|---|
| 01 icons | DONE-CI-OPEN | `01-icons` @ zvs |
| 02 readme-sync | DONE | `ticket-02-readme-sync` @ xul,nqs |
| 03 store-i18n | DONE-CI-OPEN | `03-store-i18n` @ kky,qtr |
| 04 sync-ui | DONE-CI-OPEN | `04-sync-ui` @ zqr |
| 05 firefox-scroll | DONE-CI-OPEN | `ticket-05-firefox-scroll` @ pvy |
| 06 pages-index | DONE | `ticket-06-pages-index` @ sup,lnv |
| 07 pages-demo | DONE-CI-OPEN | `ticket-07-pages-demo` @ swt,utn |
| 08 version-unify | **DONE-CI-OPEN** | `ticket-08-version-unify` @ ovo |

### Frontier（收口门）

```
票包内: 无剩余 — 01-08 全部 code-done
商店阻塞集 01+03+08: 全绿 (code 层)

收口门:
  CI 绿: 01 / 03 / 04 / 05 / 07 / 08
  人工: 07 Pages Source → GitHub Actions
  人工: AMO 2026.9.12 版本号占用核对
```

### Wave 3 违规 (不追认)

- V1 NOTE: 08 CI-only, 本机未跑 build → 合并前补 CI 绿 (build.mjs 改动必须被 CI 覆盖)
- V2 NOTE: store-listings 仍写 2026.9.9 zip 名 → 等 CI artifacts 产出后再改
- V3 NOTE: AMO 2026.9.12 占用未联网核实 → 提交前人工核对


## Wave 4 复核状态（2026-09-10 首脑实物复核 · 45 报告）

> 证据: reports/45-wave4-brain-review.md · 方法: Node 源码断言 + git 实物，不信自述

| 票 | 状态 | 分支 |
|---|---|---|
| 09 create-render-decouple | DONE-CI-OPEN | ticket-09-create-render @ mno,ptw |
| 10 title-select-all | DONE-CI-OPEN **+VIOLATION** | 10-title-select-all @ out；改动在 13 的 2ce2c41 |
| 11 url-open-mode-default | DONE-CI-OPEN | ticket-11-url-open-mode @ qwo,kqx |
| 12 favicon-cache-hardening | DONE-CI-OPEN | ticket-12-favicon-swr @ kow,ylu |
| 13 dark-bm-add-btn | DONE-CI-OPEN **+VIOLATION** | ticket-13-dark-bm-add-btn @ wzp,wnl |

### Frontier（收口门）

```
票包内: 无剩余 — 09-13 全部 code-done
收口门:
  CI 绿: 01/03/04/05/07/08 + 09/10/11/12/13
  人工: Pages Source → GitHub Actions；AMO 版本占用
  合并建议: 09 → 10(文件在 13 提交) → 11 → 12 → 13 → docs
  待用户授权: 10 的文件是否从 2ce2c41 拆回独立分支
```

### Wave 4 违规 (不追认)

- **V-W4-1 P0**: 窗 13 提交 2ce2c41 卷走窗 10 的 render.js/title-select spec/报告；13 报告与 git 实物矛盾。树内 PASS；历史归属待授权。
- **V-W4-2 NOTE**: 全员 CI-only，Playwright 待 CI。

## 收口归档（2026-09-10）

- 全部 01–13 已 land 到 origin/main @ d11672f（origin/codeberg/gitlab 一致）
- 构建: npm run build DONE_BUILD 2026.9.12
- 摘要: docs/history/2026-09-12-wave4-closeout.md
- Backlog: docs/history/2026-09-12-backlog.md
- 本目录保留为历史工作区档案，不再作为 frontier


---

## Wave 5 — 企业级数据容灾与发布门控（2026-09-12 事故驱动）

> Spec: `spec.md` · 调研: atomcode 2026-09-11 · 父事故: GitHub #9  
> 波次由 issues 的 Blocked by 字段推导，不另造顺序。

| Wave | 票 | 标题 | Blocked by | 可并行 |
|---|---|---|---|---|
| W1 | 40 | P0 CSS hidden 花括号修复 | None | 是（与 41） |
| W1 | 41 | 快照分键 + 分层轮转 | None | 是（与 40/47） |
| W1 | 47 | Pages 工件完整性（ntp.css + privacy-policy） | None | 是（与 40/41） |
| W2 | 42 | onInstalled(update) 先 COW 再迁移 | 41 | 与 43/45 并行 |
| W2 | 43 | crash rescue fork 语义 | 41 | 与 42/45 并行 |
| W2 | 45 | CI golden fixture 数据门控 | 41 | 与 42/43 并行 |
| W3 | 44 | 导入/WebDAV 合并+冲突副本 | 43 | — |
| W4 | 46 | 发行门禁 ADR-0017 + 检查单 | 40,42,45 | — |

### 红线
- CI 绿 + 人工 zip 黄金路径 + HTTP 200 齐备前，禁止宣称可发行、禁止 tag。
- 恢复 = 合并/fork，禁止静默覆盖。
- 快照禁止单键数组膨胀。

### 启动器
`prompts/40-…` … `prompts/47-…` + `prompts/41R-…` + **W2 返工 `prompts/42R|43R|45R-…`**（每份 ≤60 行）。

### Wave 5 W2 返工轮复核状态（2026-09-11 首脑实跑）

> 证据: reports/W2R-wave5-rework-brain-review.md · 首脑独立 Playwright + guard，不信返工自述

| 票 | 裁决 | 实跑 | 分支 |
|---|---|---|---|
| 42R | **PASS** | T42-1 snapCount=1；**3 passed** | ticket-42R @ vqm |
| 43R | **PASS** | data-recovery **5 passed**；saveLayout 已 archive | ticket-43 @ vuv |
| 45R | **PASS** | data-golden 6+1skip；migration 4 passed；guard 28/28 | ci/data-golden @ ovx/vrp |

#### W2R Frontier

```
待 land: 42R · 43R · 45R
W3 立即可开工: 44（43R 已绿解锁）
W4: 46（等 42R+45 land）
红线: 全量 CI 绿前禁止 tag / 禁止宣称可发行
```

#### W2 过程违规（首轮，不追认）— 见 W2-wave5-brain-review.md

- V5-42-1 / V5-43-1 / V5-43-2 / V5-45-1 / V5-45-2

### Wave 5 W3 复核状态（2026-09-11 首脑实跑）

> 证据: reports/W3-wave5-brain-review.md · import-merge 4 passed；邻接 9 passed；guard ok

| 票 | 裁决 | 实跑 | 分支 |
|---|---|---|---|
| 44 恢复合并+冲突副本 | **PASS** | boxing-import-merge **4 passed**；14 locale；CM-1 绿 | ticket-44 @ nmw/oqv |

#### W3 后 Frontier

```
DONE-CODE 待 land: 42R · 43R · 45R · 44 · 46
W4 已完成: 46 PASS
Wave 5 功能票全部 code-done
下一步（门禁驱动，非新票）: land → G-A 残红定谳 → G-B 人工黄金路径 → G-C 维持 200
红线: 齐备前禁止 tag / 禁止宣称可发行
```

### Wave 5 W4 复核状态（2026-09-12 首脑实测）

> 证据: reports/W4-wave5-brain-review.md · ADR-0017 + WORKFLOW §4.4 + CONTEXT 8 词条 + backlog B13

| 票 | 裁决 | 实测 | 分支 |
|---|---|---|---|
| 46 发行门禁 ADR | **PASS** | Consequences+Review 2026-10-12；检查单 17 框；无 BOM | ticket-46 @ mvu |

### Wave 5 整轮收口（2026-09-12）

> 报告: reports/W5-wave5-closeout.md · 账本: decision-ledger-wave5.md · backlog: docs/history/2026-09-12-wave5-closeout-backlog.md
> 归档 handoff: Temp/handoff-boxing-2026-09-12-wave5-closeout.md

| 项 | 状态 |
|---|---|
| 功能票 40–47 | 全部 code-done + 首脑 PASS |
| 已 land main | 40 · 41/41R · 47 |
| 待 land（栈序 A–F） | 42R · 43R · 45R · 44 · 46 · 复核 docs |
| 构建闭环 | build / demo / 双 guard / node --check 全绿 |
| 文档三层 | CONTEXT + ADR-0017 对齐；**ADR-0009 已补修订** |
| Decision ledger | 8 implemented · 4 deferred · 0 stale |
| **push** | **未执行 — 等用户明令** |
| 发行 | G-A/G-B 未满足 → **不可发行** |

### Wave 5 W1 复核状态（2026-09-11 首脑对抗性复核）

> 证据: reports/45R-wave5-w1-brain-review.md · 方法: Node/git/Playwright 实跑/live curl/子代理，不信自述

| 票 | 裁决 | 落位 | 报告 | 备注 |
|---|---|---|---|---|
| 40 CSS 花括号 | **PASS** | **已 land origin/main** | 有 | onboarding 4/4 + extension-test 2/2 |
| 41 + 41R 快照 | **PASS（41R 复核后）** | **已 land origin/main** | 41R 报告取代 41 虚假段 | 首脑实跑 4 passed；guard ok |
| 47 Pages 工件 | **PASS** | **已 land + dispatch** | 有 | live 三 URL **均 200** |

#### Live 验证（2026-09-11 dispatch 后）

```
https://xxx91n.github.io/boxing/demo/                 → 200
https://xxx91n.github.io/boxing/demo/ntp.css          → 200 (text/css)
https://xxx91n.github.io/boxing/privacy-policy.html   → 200 (含 Boxing Privacy Policy + Last updated)
```

#### Frontier（W1 收口后）

```
DONE-LANDED: 40 · 41/41R · 47
W2 立即可开工（41 已真 PASS）:
  42 onInstalled COW   | 43 crash-rescue fork | 45 CI golden gates
  三者互不依赖，可并行
W3: 44（等 43）
W4: 46（等 42+45；40/47 已绿）
```

#### 发行残留（非 W1 范围，但阻断「可发行」宣称）

- **全量 test.yml on main 仍红**（run 34569565899 exit 1）：Wave4 遗留 57 failed 面未清；W1 只覆盖 CSS 括号 + 快照测试 + Pages 工件。
- 红线不变：全量 CI 绿 + 人工 zip 黄金路径之前禁止 tag / 禁止宣称可发行。

#### W1 过程违规（不追认）

- V5-41-1 P0 虚假报告（AC 全勾 vs 3 failed）
- V5-41-2 P0 CM-1 未登记
- V5-40-1 NOTE 分支已 push origin（待用户裁定）
- V5-47-1 NOTE 报告未写明「先 merge main 再 dispatch」


---

## Wave 6 — 容灾 M1 + 门禁收口 + 票务 + urlOpenMode（2026-09-12）

> Spec: spec.md（Wave6 节）· Ledger: decision-ledger.md（A-001..A-011）· Grill: .scratch/wave6-dr-grill/
> 波次由 issue 的 **Blocked by** 字段推导，不另造顺序。

| Wave | 票 | 标题 | Blocked by | 可并行 |
|---|---|---|---|---|
| W1 | 48 | CI 残红清零（修绿优先+受控豁免） | None | 是（与 49–54） |
| W1 | 49 | G-B 人工 zip 黄金路径（ready-for-human） | None | 是 |
| W1 | 50 | Time Machine 一键回滚 UI + 安全快照 | None | 是（与 51） |
| W1 | 51 | 导出信封/完整包 + 覆盖副本 + RPO/RTO | None | 是（与 50） |
| W1 | 52 | urlOpenMode 新装/重置默认 sameTab | None | 是 |
| W1 | 53 | 构建期 CSS 括号 balance 门禁 | None | 是 |
| W1 | 54 | @data-golden 摘 continue-on-error | None | 是 |
| P2 | 55 | 冲突解决 UI（实施 deferred） | None | 可见不占带宽 |
| P2 | 56 | legacyReader 冻结读端 | None | 可见不占带宽 |
| P2 | 57 | ADR-0017 复核 2026-10-12 | None | 日历 |
| P2 | 58 | 本地 main ref 对齐 | None | 待授权 |
| P2 | 59 | sync-engine 空凭据冗余写 | None | 可见不占带宽 |

### 红线（A-002）

- G-A ∧ G-B ∧ G-C 齐备前 **禁止 tag / 禁止宣称可发行**
- #9 在 G-A+G-B 完成前只更新不关闭（A-007）
- P2 不阻塞 G-A/G-B

### 启动器

`prompts/48-…` … `prompts/59-…`（每份 ≤60 行，调研细节在 handoff）

### Wave 6 W1 首脑复核状态（2026-09-12）

> 报告: reports/W6-W1-brain-review.md · 守卫实跑 + t50 3 passed + issue 勾选

| 票 | 裁决 | 证据 | 分支 |
|---|---|---|---|
| 48 | PASS-with-caveats | waiver-check OK；CI 定谳 pending | ticket/48 |
| 49 | PASS 交付 / G-B open | evidence/49 齐 | ticket/49 |
| 50 | PASS | 3 passed (7.1s) | t50 |
| 51 | PASS-with-caveat | 代码+ADR 在；issue 0/6 | t51 |
| 52 | PASS-with-violation | 代码在盘；hunk 在 t51 | ticket-52 |
| 53 | PASS | guard exit 0；--css-only OK | ticket/53 |
| 54 | PASS-with-caveat | workflow 已改；issue 0/3 | ticket/54 |

违规: V6-51-1 · V6-54-1 · V6-52-1 · V6-54-push · V6-48-ci

Frontier: G-B 人工 · G-A land 后定谳 · 51/54 票务关账 · 禁 tag

### Wave 6 W2 首脑复核状态（2026-09-12）

> 报告: reports/W6-W2-brain-review.md

| 票 | 裁决 | 证据 |
|---|---|---|
| 55 | PASS deferred | 冲突锚点在盘；4/4；零代码 |
| 56 | PASS 设计 | ADR RA-1..6 + CONTEXT；guard 28/28 |
| 57 | PASS 未到期 | 保持 open；ADR 未改 |
| 58 | PASS | main=origin/main=ffa55f8 0/0 |
| 59 | PASS-with-caveat | 守卫在盘；guards 绿；issue 0/4 |

违规: V6-59-1 · V6-58-git(update-ref)

Wave6 全票复核完毕。Frontier: G-B 人工 · land+G-A 定谳 · 51/54/59 票务关账 · 禁 tag
