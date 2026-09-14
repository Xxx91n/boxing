# W1 首脑复核 — 96 / 100（2026-09-14）

> 方法: 不采信报告自述；本机重跑守卫 + workflow/分支/GH 实物。

## 96 docs-gov（A-050 · GH #13）

| 声明 | 证据 | 结论 |
|---|---|---|
| 替换 naive grep 为 docs-link-guard.mjs | `scripts/docs-link-guard.mjs` 189 行存在；`node --check` exit 0 | **成立** |
| workflow 接入 | `ai-docs-governance.yml` Dead-link 步骤 = `node scripts/docs-link-guard.mjs`；paths 含脚本 | **成立** |
| 8 refs 0 dead | 本机 `node scripts/docs-link-guard.mjs` → `8 reference(s) checked, 0 dead` exit 0 | **成立** |
| 保留引用能力（AC3） | AGENTS/CONTEXT 8 条 agents/history 引用全部 OK；脚本 refs==0 硬失败 | **成立** |
| CI green run URL（AC1/2） | 分支 `ticket/96-docsgov-deadlink` **未 push**；main 无新 docs-gov run | **具名 F（授权边界）** |
| 不与 G-A 混写 | 脚本注释明确 Not wired into pretest | **成立** |

**票面结论: implemented-pending-ci** — 实现采信；AC1/2 待 land 后 CI。

## 100 calver（A-054）

| 声明 | 证据 | 结论 |
|---|---|---|
| calver-guard.mjs 存在 | 315 行；`node --check` 0 | **成立** |
| 覆盖 AC 三项+扩面 | 硬检 8 面：manifest v+version_name / package / lock×2 / notes / CHANGELOG / ntp 脚注 / 单调性 | **成立** |
| 失败非零退出 | 本机负向：package version→2026.9.14 → **exit 1**（BX-CALVER-005）；还原 sha256 一致后 exit 0 | **成立** |
| 接入 pretest | package.json pretest 含 `calver-guard.mjs`；`npm run pretest` exit 0 四门全绿 | **成立** |
| 策略书面说明 | AGENTS 降级告警、GitButler hook、单调性 fail-open 均有书面理由 | **成立** |

**票面结论: done（本地验收）** — land 后随 test.yml pretest 进 CI。

## 过程违规

| 项 | 结论 |
|---|---|
| 未明令 push | **未违规**（两支均未 push） |
| 越权改他人提交 | **未发现** |
| issue 票面 Status/勾选未同步 | **轻微过程债**：账本已 implemented，issues/96、100 仍 ready-for-agent 且 AC 未勾 — 复核时已代为登记 |

## 账本

- A-050: implemented（含 CI 具名 F）— 采信
- A-054: implemented — 采信

## Frontier

W1 实现齐。**下一波可开工: 98 ∥ 104 ∥ 102**（Blocked by 96,100 已满足实现面；96 CI 门在后续 land/发行 G-A 一并闭环）。
