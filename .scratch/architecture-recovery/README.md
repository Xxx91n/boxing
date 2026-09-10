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
