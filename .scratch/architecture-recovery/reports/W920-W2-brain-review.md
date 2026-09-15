# Wave9.20 W2 首脑复核 — 票 108（含 109R/113R）

> 日期: 2026-09-15 · 方法: 实物证据，不信报告自述
> 范围: W2 frontier = 108 only（107–116 中 108 为最后一张未完成实施票）

## 声明 → 证据 → 结论

| 声明（报告/issue） | 实物证据 | 结论 |
|---|---|---|
| `layout-bypass-guard.mjs` 上线且 exit 0 | 本机 `node scripts/layout-bypass-guard.mjs` **exit 0**；15 模块 / 0 违规 / 9 活豁免具名打印 | **成立** |
| self-test 18/18 | 本机 `--self-test` **PASS (18/18)**，含故意旁路红、无名豁免红、LB-3 孤儿红、缺 marker fail-closed | **成立** |
| pretest 第 2 位接入（八门） | `package.json` pretest 链含 `layout-bypass-guard.mjs` | **成立** |
| test.yml lane | `.github/workflows/test.yml` 含 `layout-bypass` | **成立** |
| 唯一删除类旁路收编 `reorderBookmarks` | `ntp/render.js` 含 handler；`ntp/popups.js` 走 `reorderBookmarks`；**裸 `bms.splice(dragIdx` 已不存在**；CONTEXT op 清单已同步 | **成立** |
| 离线 spec | `test/tests/boxing-layout-bypass-gate.spec.ts` chromium-extension **5/5 passed (1.7s)** | **成立** |
| **109R** cluster-map | `cluster-map.json` 含 `boxing-pages-gc-version`；import-graph-guard **exit 0** | **成立** |
| **113R** store published | locale-readme-guard **exit 0**，baseline **2026.9.15**；release-status 无「商店 published=9.12」 | **成立** |
| A-063 implemented | 账本 A-063 行 = implemented，证据与脚本一致 | **成立** |
| issue Status done | issues/108 Status=done | **成立** |

## 完成门（pretest 八守卫本机实测）

| 守卫 | 结果 |
|---|---|
| import-graph-guard | **OK** |
| layout-bypass-guard | **OK** |
| migration-golden-guard | **OK** |
| css-balance-guard | **OK** |
| contrast-guard | **OK** |
| calver-guard | **OK**（2026.9.20 8 面） |
| onboarding-guard | **OK** |
| locale-readme-guard | **OK** |

**完成门：八门全绿。**

## 账本维度

| ID | 状态 | 证据充分性 |
|---|---|---|
| A-063 | implemented | **强**（脚本+self-test+reorder 收编+pretest/CI 接线+spec 5/5） |
| 109R | 已并入 108 | **强**（cluster-map + import-graph exit 0） |
| 113R | 已并入 108 | **强**（locale-readme exit 0 + baseline 9.15） |

具名残余（报告已录，不阻断本票）：
- **N-108-01**：add 类旁路（popups push）具名豁免，**不同票**收编
- 9 处改写类具名豁免（conn-layer/settings-ui/storage/sync-engine/utils）— 符合 A-063「白名单须具名」

## 过程观察（不代追认）

1. README 波次表 W2/108 仍写 `ready-for-agent`（issue 已 done）— **票面滞后**，本复核就地更新。
2. zz 仍有 `prompts/108-*.md` 修改（启动器 109R/113R 并入后未单独提交）— 小残留。
3. 未发现越权 force-push / 代签 G-B / 宣称三门达成。

## 返工判定

**无源码层返工。** 108 本体 + 109R + 113R 全部实物过关。

## Frontier（下一波）

Wave9.20 **实施票 107–116 全部完成**。

| 项 | 状态 |
|---|---|
| 实施票 | 无未完成 |
| 出口条件 A-P02 | 豁免 3 条 active F 09-19 到期 — 须按 105 撤账至 0（**执行动作**，非票） |
| 出口条件 A-P03 | 新 tip G-A 四 job 全绿 → 用户 G-B → tag/商店另令 |
| A-064 残余 | github-pages environment 放行 tag — **用户侧** |
| N-108-01 | add 旁路 — 可选后续票，非 9.20 阻断 |

**宣布：无新实施票可开工。下一门 = 发行 G-A 执行（A-P02 豁免清零 + 全量 test.yml）。**
