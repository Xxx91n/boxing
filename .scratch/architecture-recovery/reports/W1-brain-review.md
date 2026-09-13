# W1 首脑复核 — tickets 87–92（2026-09-13）

> 原则: 不信报告自述；每条关键声明回仓库实物验证。  
> 数据: git show / grep / node import / playwright --list / but status / origin/main。

## 总裁

| 票 | Covers | 报告自述 | 实物结论 | 可关？ |
|---|---|---|---|---|
| 87 | A-041 | 测试夹具修绿，本地 6/6 | **部分采信**：diff 确为 boot(reset) + poll；产品零改动；**无 CI** | 否（缺 CI） |
| 88 | A-042 | 暗色对比度产品修复 | **采信产品修复**（settings.css 实物 token 切换）；亮色仍不达标已呈报；**无 CI**；issue 状态未同步 | 否（缺 CI） |
| 89 | A-043 | overlay 确定性 dismiss | **采信**：auto-expand spec 增加 waitForInitComplete/dismissOnboarding；账本写 implemented **过早** | 否（缺 CI） |
| 90 | A-044 | 统一私网拒绝 | **采信代码**：normalizeHostname/isPrivateHost 在位；**无 CI** | 否（缺 CI） |
| 91 | A-045 | 三向合并已落地 | **代码在位但 e2e 不可加载 + 明文凭据** → **返工 91R** | **否 · P0** |
| 92 | A-046 | boot-pending e2e 落盘 | **采信文件存在**（264 行）；仅静态验证；**无 CI** | 否（缺 CI） |

**G-A / 票 93**：frontier **不可开**。origin/main 最近 Test 仍为 run 34749813393 **failure**；W1 全部未 push。

---

## 声明 → 证据 → 结论（逐票）

### 87 · A-041
| 声明 | 证据 | 结论 |
|---|---|---|
| 根因=测试 boot 清 storage | `git show 7c254992` 仅改 `boxing-star-sync-audit.spec.ts`（reset 选项 + expect.poll） | 与报告一致 |
| 产品 isParent 正确 | 报告反证 boxCount/found/isParent；CONTEXT 一致 | 未独立复跑产品路径，**弱采信**（测试改动合理） |
| 本地 6/6 绿 | 无 CI run；分支 `wave9-ticket87-star-sync` **未 push** | **AC2 未完成** |
| 无 waiver/不热修 9.12 | diff 无 skip/waiver | 通过 |

### 88 · A-042
| 声明 | 证据 | 结论 |
|---|---|---|
| 产品缺陷=暗色对比度 | `ntp/settings.css` L744–754：hairline→muted，muted→ink-soft | **实物确认** |
| 非只改断言 | 改产品 CSS；新增比值测试 | 通过 |
| 亮色仍不达标 | 报告 Q1 自呈 | 如实；**待另票**（非本 AC） |
| CI 证据 | 未 push，无 run | **AC3 未完成** |
| issue Status | 仍 `ready-for-agent` | **过程漂移**（报告已完成） |

### 89 · A-043
| 声明 | 证据 | 结论 |
|---|---|---|
| overlay 拦 hover | `git show 27dbdefc` 测试侧 dismissUntilHidden + waitForInitComplete | 采信 |
| 账本 implemented | decision-ledger A-043 | **过早**（应 fixed-pending-ci） |
| 无 CI | 未 push | 未关 |

### 90 · A-044
| 声明 | 证据 | 结论 |
|---|---|---|
| 统一 deny | `sync-engine.js` L45–65 isPrivateHost/normalizeHostname | 代码在位 |
| 默认拒私网 | allowPrivateHost 仅 true 放行 | 通过 |
| CI | 未 push | 未关 |

### 91 · A-045 · **P0 返工**
| 声明 | 证据 | 结论 |
|---|---|---|
| mergeLayoutThreeWay 落地 | `utils.js:347/407` + `sync-engine.js:404` + `storage.js getSyncBase` | **产品代码在位** |
| e2e 可执行 | `playwright --list` → **ReferenceError: fileURLToPath is not defined**；Total 0 tests | **阻断全量 suite** |
| 无真实凭据 | spec L26–28：**真实 Koofr URL + 邮箱 + 明文密码**，commit `38a2d005` | **安全事件** |
| 推送状态 | 仅本地 `ticket-91-merge-three-way`；**未进 origin/main** | 略减暴露面，**不豁免轮换** |

### 92 · A-046
| 声明 | 证据 | 结论 |
|---|---|---|
| e2e 文件存在 | `boxing-boot-pending.spec.ts` 264 行 | 通过 |
| 运行时绿 | 仅静态 check；未 push | 未关 |
| P-92-1 failsafe 早退 | 报告呈报产品缺口 | **记 backlog，不阻本票**（范围外） |

---

## 账本维度（A-xxx）

| A | 账本状态 | 复核修正 |
|---|---|---|
| A-041 | fixed-pending-ci | 维持；**禁止 implemented** |
| A-042 | fixed-pending-ci | 维持；补 issue Status |
| A-043 | implemented | **降为 fixed-pending-ci** |
| A-044 | implemented | **降为 fixed-pending-ci** |
| A-045 | implemented | **降为 blocked-rework（91R）** |
| A-046 | implemented | **降为 fixed-pending-ci** |
| A-047/048 | current | 维持；93/94 不可开 |

---

## 过程违规（不追认）

1. **票 91 明文凭据入库**（P0 安全）— 报告已升级，属实。  
2. **票 91 e2e 阻断 Playwright 加载** — 88 Q4 升级属实；91 自称 e2e 落盘但未做 `--list`。  
3. **账本过早 implemented**（89/90/91/92）vs CI-only + 禁未明令 push。  
4. **issue 88/89 Status 未与报告同步**。  
5. 全部 W1 **未 push** — 符合禁令；同时导致 **零 CI 证据**，AC 无法关闭。

---

## Frontier（重算）

| 波次 | 票 | 状态 |
|---|---|---|
| — | **91R 返工** | **立即可开**（P0） |
| W1 收口 | 87,88,89,90,92 + 91R | 代码/文档在；**待用户明令 push + CI** |
| W2 | 93 | **blocked**（87+88+89 CI 未绿） |
| W3 | 94 | **blocked**（91/92/93） |

**下一波可开工：仅 91R。**  
**用户侧必做：立即轮换 Koofr/邮箱对应 WebDAV 密码**（凭据已进本地 git 对象库；未推 origin 不能视为未泄露）。

---

## 88 待裁决项处置

| Q | 处置 |
|---|---|
| Q1 亮色对比度 | 记 backlog **A-042b**（另票），不阻 W1 |
| Q2 DESIGN.md hairline | 记 revised 呈报，待用户 |
| Q3 CI | 随 push 一并解决 |
| Q4/Q5 | 见 91R |
