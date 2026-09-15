# Wave9.20 W1 首脑复核报告

> 日期: 2026-09-15 · 方法: 实物证据，不信报告自述
> 范围: W1 = 107,109–116（108 属 W2，Blocked by 107，**不在本波完成范围**）

## 总表（声明 → 证据 → 结论）

| 票 | A | 报告自述 | 实物证据 | 结论 |
|---|---|---|---|---|
| **107** | A-062 | deleteBookmark+commit+tombstone 回归 | `ntp/render.js:172` `deleteBookmark` 返回 tombstoneIds；`ntp/popups.js` `commit("deleteBookmark",…)`；裸 `bookmarks.splice(index,1)` **已不存在**；`test/tests/boxing-sync-bookmark-delete-tombstone.spec.ts` 242 行含 tombstone+reload/merge 断言；commit `1a7d572e` | **done**（采信） |
| **108** | A-063 | — | **无报告**；账本 A-063 仍 current；issue ready-for-agent | **未开工**（W2 frontier） |
| **109** | A-064 | G-C version.json+verify | `.github/workflows/demo-deploy.yml` L91 `pages-gc-verify.mjs --mode=deploy-tail --timeout=180`；script 存在；ADR-0017 有 09-15 修订痕迹 | **done-with-named-F** |
| **110** | A-065 | 根因=点击未进入（非 L192 双建） | `ntp/render.js` `onBoxEnterClick` + root binding；spec 有改；commit `53cdadd5`；120 次 0 产品签名（报告自述，CI URL 待授权） | **done-with-named-F**（签名更正已入账本 N-110-01） |
| **111** | A-066 | setTimeout 120s | `boxing-innerclip.spec.ts:25` + `boxing-innerclip-pan.spec.ts:24` `test.setTimeout(120_000)` 实物 | **done** |
| **112** | A-067 | contrast 串 pretest | `package.json` pretest 含 `contrast-guard.mjs`；本机 `node scripts/contrast-guard.mjs` **8/8 PASS exit 0** | **done** |
| **113** | A-068 | 单一状态块 | `docs/release-status.md`：§一=投影非第二表；§三「唯一现役状态块」硬契约；旧 run 标 Superseded；终谳 09-14 已填 | **done-with-named-F**（F-113-01 demo 渲染 9.12） |
| **114** | A-069 | DESIGN Box/Zoom 校正 | `docs/DESIGN.md` L144–145 / L215–216 N-103-01/02 closed + 代码现实校正 | **done** |
| **115** | A-070 | CHANGELOG 9.15 扩写 | `CHANGELOG.md` 存在 `[2026.9.15]`；commit `e9c5014d` | **done** |
| **116** | A-071 | calver 2026.9.20 | `package.json` version=`2026.9.20`；`node scripts/calver-guard.mjs` **exit 0**（8 面一致） | **done** |

## 门禁实测（pretest 族）

| 守卫 | 本机结果 |
|---|---|
| import-graph-guard | **FAIL** CM-1：`boxing-pages-gc-version.spec.ts` 未入 cluster-map |
| migration-golden-guard | OK |
| css-balance-guard | OK |
| contrast-guard | OK 8/8 |
| calver-guard | OK 2026.9.20 |
| onboarding-guard | OK |
| locale-readme-guard | **FAIL** BX-LOCALE-006：README store_published **2026.9.15** ≠ release-status published **2026.9.12** |

## 账本维度（A-xxx）

| ID | 状态 | 证据充分性 |
|---|---|---|
| A-062 | implemented | 强（代码+spec+commit） |
| A-063 | **current** | 未实施（正确，W2） |
| A-064 | implemented | 强（workflow+script）；残余：environment 未放行 tag（人工）；import-graph 红源于 109 新 spec |
| A-065 | implemented | 中强（产品代码+本地 120 次）；CI URL 待授权 F-110-02 |
| A-066 | implemented | 强（两 spec setTimeout 实物） |
| A-067 | implemented | 强（pretest 链+本机 exit 0） |
| A-068 | implemented | 强（文档结构）；F-113-01 具名 |
| A-069 | implemented | 强 |
| A-070 | implemented | 强 |
| A-071 | implemented | 强（calver-guard exit 0） |
| A-P01/02/03 | current | 过程/出口，无票 — 维持 |

## 过程违规 / 欠账（不替用户追认）

1. **Issue 状态未同步**：107/109/110/112/113 issue 仍 `ready-for-agent`，与报告/账本 implemented 不一致（111/114/115/116 已写 done）。属票面滞后，非代码违规。
2. **未提交残留**：zz 仍有 `.scratch/112-atomcode/*`、`decision-ledger.md` M、`109-report.md` M、`ntp/index.html` M — 窗口收尾未清。
3. **账本行级共 hunk 披露**：110/109 等故意不提交含他人行的 decision-ledger hunk（已在报告披露）— 可接受，但 A-065 行最终状态以账本现文为准（已 implemented）。
4. **import-graph 红未在 109 收口**：新 spec 未进 cluster-map，pretest 第 1 门红 — **不得**在 G-A 前忽略。
5. **locale-readme 红**：N-111-01 已具名，但根因是 release-status 商店版本仍写 2026.9.12 与 README 9.15 冲突 — **113/116 应对齐事实**（商店真源用户声明 2026.9.15）。

## 返工判定

| 项 | 是否返工 | 理由 |
|---|---|---|
| 107–116 产品/文档本体 | **不返工** | 实物与 AC 对齐 |
| **109 补丁** | **要** | cluster-map 漏 `boxing-pages-gc-version.spec.ts` → import-graph 红 |
| **113/116 补丁** | **要** | release-status store published 应与 README/用户声明 2026.9.15 对齐（或修 guard 基线并书面说明） |
| 108 | 不返工 | 本波未开工 |

## README 状态登记（复核后）

| 波次 | 票 | 结论 |
|---|---|---|
| W1 | 107 | done |
| W1 | 109 | done-with-named-F + **返工: cluster-map** |
| W1 | 110 | done-with-named-F |
| W1 | 111 | done |
| W1 | 112 | done |
| W1 | 113 | done-with-named-F + **返工: store published 对齐** |
| W1 | 114 | done |
| W1 | 115 | done |
| W1 | 116 | done + **返工: 与 113 共修 locale 版本面** |
| W2 | 108 | **ready-for-agent（frontier）** |

## 下一波 frontier

1. **108** `layout-bypass-static-gate`（A-063）— 启动器: `prompts/108-layout-bypass-static-gate.md`
2. **109R** import-graph cluster-map 一行修复（可并入 108 窗口或独立小窗）
3. **113R** release-status 商店 published 对齐 2026.9.15（locale-readme 第 6 门）

G-A 前置：import-graph + locale-readme 必须绿；豁免清零（A-P02）仍出口条件。
