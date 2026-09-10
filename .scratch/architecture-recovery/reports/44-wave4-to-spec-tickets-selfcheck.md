# Wave4 产出自检报告（to-spec / to-tickets / handoff / prompts）

> 日期: 2026-09-10 · 角色: 架构首脑
> 方法: Node 读盘校验，不信自述

## 1. 启动器硬规则自检

| 文件 | 行数 | ≤60 | 违禁词 | 身份 | 必读 | delta | 开工第一句 | 报告路径 | handoff 锚定 |
|---|---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| prompts/09-create-render-decouple.md | 38 | ✓ | 无 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| prompts/10-title-select-all.md | 35 | ✓ | 无 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| prompts/11-url-open-mode-default.md | 37 | ✓ | 无 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| prompts/12-favicon-cache-hardening.md | 37 | ✓ | 无 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

违禁词集合: worktree / git checkout / git branch / git commit / git push / git merge — **零命中**。
版本控制仅写「遵循 WORKFLOW §4.2」；完成定义仅写「遵循 handoff 内的完成定义」。

## 2. 路径可解析

全部必读路径在仓库根 `D:/Aworker/crx/boxing` 下 existsSync 通过（issues/handoffs/prompts/spec/43/WORKFLOW/README/AGENTS/CONTEXT/ADR-0007/render/favicon/utils）。

## 3. Issue Blocked by → 波次

| 票 | Blocked by |
|---|---|
| 09 | None — can start immediately |
| 10 | **09 — create-render-decouple** |
| 11 | None — can start immediately |
| 12 | None — can start immediately |

| 波次 | 票 |
|---|---|
| W4-1 | 09 / 11 / 12 |
| W4-2 | 10 |

已写入 README.md Wave4 节。

## 4. Handoff atomcode 完整提示词

四份 handoff 均含「推荐 atomcode -p 提示词（完整，直接发送）」+ ctx_batch_execute 执行方式（concurrency:1, timeout:600000）。

- 09: 乐观 UI vs await-persist（中，非强制）
- 10: contenteditable select-all 兼容（低，quick）
- 11: 设置默认值迁移（低，quick）
- 12: single-flight + SWR 落地（中高；优先复用 ctx atomcode-favicon）

## 5. Spec

`spec.md` 已追加 Wave4 addendum（不覆盖 01–08），含 Problem/Solution/Stories/Implementation/Testing/Out of Scope。

## 6. 结论

**PASS** — 可进入人工多窗口派发。W4-1 三窗并行；W4-2 等 09。

## 7. 程序化逐字段比对（复审）

方法: Node 读盘。范围: prompts ↔ handoffs ↔ issues ↔ spec / 43 / README。

### 不一致清单（已修复）

| # | 严重度 | 位置 | 问题 | 修复 |
|---|---|---|---|---|
| A1 | P0 | 43 波次拆票 | 10 依赖写「无」，与 issue/handoff/README 的 Blocked by 09 矛盾 | 表改为 Blocked by；W4-1=09/11/12；W4-2=10 |
| A2 | P0 | issues/11 What to build | 仅中文「当前标签页」，缺领域词 sameTab | What to build 与验收显式写 urlOpenMode / sameTab / newTab |
| A3 | NOTE | prompts WORKFLOW 必读行 | 路径与中文节号粘连 | 改为 WORKFLOW.md + 空格 + （§ |

### 修复后复审

- Blocked by 五处一致（issue/handoff/prompt/README/43）
- 违禁词 worktree / 裸 git 写命令：零命中
- prompt 不复述 WORKFLOW 全文条款、不含验收 checkbox
- prompt 行数均 ≤60

**结论: PASS（修复后）**
