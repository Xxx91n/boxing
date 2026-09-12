# Wave6 计划表（Grill 定稿整理）

> 数据源唯一: `.scratch/wave6-dr-grill/decision-ledger.md`（D-001..D-011 current）
> 日期: 2026-09-12 · 状态: **grill 已对账；待用户确认定稿后立 GH issue**
> 红线: 三门禁齐备前禁 tag / 禁宣称可发行（D-002 / ADR-0017）

---

## P0-Charter（D-001）

本轮覆盖四轨，拆多张票，不合并为单一功能票：

1. 企业级容灾 M1（产品化）
2. 发行门禁 G-A / G-B 收口
3. issue/票据卫生（#9 + B15–B23）
4. urlOpenMode 默认当前标签页定谳

---

## P0-RedLines（D-002 / D-007 / D-008 负向）

| 红线 | 约束 |
|---|---|
| tag / 对外宣称可发行 | G-A ∧ G-B ∧ G-C 齐备前禁止 |
| land 功能 | 允许与门禁票并行（不绑 land） |
| #9 | G-A+G-B 完成前只更新不关闭；关闭评论链门禁证据 |
| G-A 豁免 | 禁 waiver-first；禁永久豁免；禁 Skip 失明；数据完整性/迁移/回滚类永不豁免 |
| 导出 | 默认不得内嵌 snap/corrupt/conflict 正文（D-006） |

---

## P0-TicketIndex（D-010 / D-011）

### 必立实施票

| 票号（建议） | 标题 | 优先级 | 覆盖 D-xxx | 轨 |
|---|---|---|---|---|
| T-GA | CI 残红清零（修绿优先+受控豁免兜底） | P0 | D-008, D-002 | 门禁 |
| T-GB | G-B 人工 zip 黄金路径（ready-for-human） | P0 | D-009, D-007 | 门禁 |
| T-DR-α | Time Machine 一键回滚 UI + 恢复/覆盖/导入前安全快照 | P1 | D-003①②, D-011α | 容灾 |
| T-DR-β | 导出信封/完整包 + 覆盖必先本地副本 + RPO/RTO ADR | P1 | D-003③④⑤, D-006, D-011β | 容灾 |
| T-URLOPEN | 新装/重置默认 sameTab（以实机为准） | P1 | D-004, D-005 | 设置 |
| T-B17 | 构建期 CSS 括号 balance 门禁 | P1 | D-010 | 工程 |
| T-B20 | `@data-golden` 摘除 continue-on-error（到期 2026-09-18） | P1 | D-010 | 门禁 |

### 一并立票（P2/backlog，不占本轮带宽）

| 票号（建议） | 标题 | 覆盖 | 备注 |
|---|---|---|---|
| T-B18 | 冲突副本解决 UI | D-003 deferred, D-010 | **实施 deferred**，只立票可见 |
| T-B19 | legacyReader 冻结读端升格 rollback AC | D-010 | P2 |
| T-B21 | ADR-0017 复核（2026-10-12） | D-010 | 日历 |
| T-B22 | 本地 main ref 与 origin 对齐 | D-010 | 待授权 |
| T-B23 | sync-engine 空凭据冗余写 | D-010 | P2 |

### 门禁轨内嵌动作（不单独立码票）

| 动作 | 覆盖 D-xxx |
|---|---|
| 更新 #9 body 勾选 + 现状评论 | D-007 |
| G-A/G-B 完成后 close #9（链证据） | D-007 |

---

## P0-T-GA（D-008）

**验收**

- [ ] main test.yml 主 lane 残红清单逐项处置：修绿 **或** 书面豁免
- [ ] 豁免仅限 flaky/环境性且失败签名与台账匹配
- [ ] 数据完整性 / 迁移往返 / 回滚演练类用例 **不得** 入豁免台账
- [ ] 豁免条目含：用例名、基线 run URL、失败签名、归属票、到期条件
- [ ] 到期未修 → 禁用或删除并记录
- [ ] 发行前自动校验：台账未过期且签名仍匹配
- [ ] 稳态目标：台账归零 / 全绿

**Suggested skills:** playwright · code-review · atomcode-research（仅残红根因需再调研时，串行）

---

## P0-T-GB（D-009）

**归属:** ready-for-human（用户亲自执行）

**验收**

- [ ] 按 WORKFLOW §4.4 检查单，在真 Chrome + Firefox 对 **发行 zip 解包产物** 勾选
- [ ] 含升级安装 pre-update 快照与回滚演练
- [ ] 证据归档路径写入票报告
- [ ] 复核后写回 #9 与 ADR-0017；禁止纯自动化宣称完成

**Suggested skills:** playwright（仅辅助取证）· 用户人工路径

---

## P1-M1Scope（D-003）

本轮收口五项（已切 α/β，见 D-011）：

| # | 项 | 归属票 |
|---|---|---|
| ① | Time Machine 一键回滚 UI | T-DR-α |
| ② | 恢复/覆盖/导入前自动安全快照 | T-DR-α |
| ③ | 导出（由 D-006 定稿为混合策略） | T-DR-β |
| ④ | 同步/导入覆盖必先本地副本 | T-DR-β |
| ⑤ | RPO/RTO 写入 ADR-0009/0017 | T-DR-β |

**范围外（deferred，账本约束）:** 冲突解决 UI(B18 实施)、OPFS、CRDT、导出加密

---

## P1-T-DR-α（D-003①②, D-011α）

**覆盖:** D-003, D-011

**验收**

- [ ] 设置数据区可列出快照并一键回滚（二次确认）
- [ ] 回滚前自动落安全快照（可撤销撤销）
- [ ] 恢复/覆盖/导入路径均先安全快照
- [ ] Playwright：回滚往返 + 安全快照计数

**Suggested skills:** playwright · code-review · tdd（数据路径 seam）

---

## P1-T-DR-β（D-003③④⑤, D-006, D-011β）

**覆盖:** D-003, D-006, D-011

**验收**

- [ ] 默认导出 = 主布局 + meta 信封（schemaVersion + snap/corrupt/conflict **索引**，不含正文）
- [ ] 可选「完整容灾包」才打包正文；体积预估 + 5MB 处理
- [ ] 文件名 `boxing-backup-YYYYMMDD.json`
- [ ] 同步/导入覆盖必先本地副本（代码级 + 测试）
- [ ] RPO/RTO 语义写入 ADR-0009 修订 + ADR-0017 交叉引用
- [ ] 导入默认导出信封可还原当前布局；完整包含快照可还原到时间点

**Suggested skills:** playwright · code-review · domain-modeling（ADR/CONTEXT 词条）

---

## P1-T-URLOPEN（D-004, D-005）

**覆盖:** D-004, D-005

**验收（以实机为准）**

- [ ] 新装或重置后点击书签 = **当前标签页**导航
- [ ] 根因调查面：旧包/问题 zip、重置未清 boxingLayout settings、设置下拉首帧 DOM newTab（Bug3-a）、残留写 newTab 路径
- [ ] 不接受仅改下拉显示即关票
- [ ] 不接受用「存量显式 newTab 保留」解释新装行为

**Suggested skills:** playwright · diagnosing-bugs

---

## P1-T-B17 / T-B20（D-010）

| 票 | 验收摘要 | Suggested skills |
|---|---|---|
| T-B17 | build.mjs 源 CSS 括号 depth=0 fail-closed | code-review |
| T-B20 | 2026-09-18 前摘 `@data-golden` continue-on-error 且绿 | playwright |

---

## CONTEXT / ADR 待同步（实现票内完成，非本文件发明）

| 落点 | 内容来源 | 由哪张票写入 |
|---|---|---|
| CONTEXT Data Resilience | 导出信封 / 完整容灾包 词条 | T-DR-β |
| ADR-0009 修订 | RPO/RTO、导出=干净当前态副本 | T-DR-β |
| ADR-0017 / WORKFLOW §4.4 | G-A 豁免收窄（flaky-only、never-quarantine、到期收敛） | T-GA |
| WORKFLOW §4.4 检查单 | G-B 人工路径证据 | T-GB |

---

## Suggested skills（波次级）

- **but** — 立分支/提交（WORKFLOW §4.2；禁未授权 push）
- **playwright** — G-A 清红、容灾 α/β、urlOpenMode
- **atomcode-research** — 仅残红根因/商店政策需再调研时（串行，一次一个）
- **domain-modeling** — T-DR-β 写 ADR/CONTEXT 时
- **code-review** — 每票 land 前
- **neat-freak** — 波次收口时知识对齐

---

## 整理元数据（neat-freak）

| 事实面 | 状态 |
|---|---|
| 代码 | out-of-scope（grill 不改源码） |
| 运行态 | pending（G-B 未执行；G-A 未绿） |
| 文档 | changed-and-verified（本 plan + ledger） |
| 规则 | pending（G-A 豁免规则待写入 WORKFLOW，由 T-GA） |
| 记忆 | not-applicable（本轮未授权写平台记忆） |
| 工作区 | pending（立 GH issue 待用户定稿令） |

**无去向记录:** 无（对账 11/11）
