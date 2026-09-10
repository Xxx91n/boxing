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
