# Handoff — Wave9.20 Followup 常驻任务书（next-round）

> 生成: 2026-09-22 · 数据源: .scratch/wave9-920-followup/decision-ledger.md（D-001..D-007）
> 用途: 任意子 Agent 依赖本任务书即可开工；不重复 spec/plan/账本正文，只给指针 + 覆盖 D + message 步骤
> 敏感信息: 无密钥；勿恢复真实凭据

## Goal（防丢）

**把 Wave9.20 followup 可解项收口到「三门可宣称」边界；C08 tag/商店始终归用户。**

## Message 步骤（子 Agent 顺序消息契约）

| Step | Message（发给执行 Agent 的指令要点） | 覆盖 D | 退出信号 |
|---|---|---|---|
| M0 | 读本任务书 + decision-ledger.md + spec.md + plan.md；禁止账本外补结论 | D-007 | 已复述主序 plan-01..06 |
| M1 | 执行 plan-01（C05+C07 分层）；但 commit 分片落盘 | D-005 D-004① | guard 绿 + 删除类 0 |
| M2 | 执行 plan-02（C01 处置）；禁止续期 | D-003 D-004② | active F=0 + waiver-check 0 |
| M3 | 执行 plan-03（C04 environment v*） | D-002 D-004③ | policy 证据入 reports/ |
| M4 | 执行 plan-04（G-A）；记 run URL | D-004④ | 四 job 绿 + 0 active F |
| M5 | 准备 plan-05 包+检查单；**停下等用户 G-B 声明** | D-002 D-004⑤ | 用户声明（版本+日期） |
| M6 | 执行 plan-06（G-C） | D-004⑥ | pages-gc-verify 0 |
| M7 | plan-07 文档账本收口；release-notes 一次性回填 | D-001 D-002 D-007 | C09 closed + 措辞无误导 |
| M8 | 汇报三门状态；**C08 交还用户**；未明令不 tag | D-002 D-006 | 用户收令 |

## 任务分解（每项声明覆盖 D-xxx）

| 任务 | 覆盖 D | 产物指针 |
|---|---|---|
| T-C05C07 | D-005 · D-004① | plan-01 |
| T-C01 | D-003 · D-004② | plan-02 |
| T-C04 | D-002 · D-004③ | plan-03 |
| T-GA | D-004④ | plan-04 |
| T-GB-prep | D-002 · D-004⑤ | plan-05 |
| T-GC | D-004⑥ ·（C03/C06） | plan-06 |
| T-docs | D-001 · D-002 · D-007 | plan-07 |
| T-C08 | D-002（**用户**） | 范围外，仅交接 |

## Suggested skills

| 场景 | Skill |
|---|---|
| 实施改码 | implement · tdd |
| 根因 | diagnosing-bugs |
| 测试/门禁 | （repo pretest / playwright） |
| 版本控制 | **but** |
| 领域措辞 | domain-modeling |
| 知识收口 | neat-freak |
| 复核 | code-review |
| 外网调研（若再开） | atomcode-research（串行） |

## 红线（摘自账本负向，完整以账本为准）

- 不代签 G-B；C08 不 tag/商店；未三门齐不宣称可发行
- 不建 GH Issue（D-006）；豁免不续期；C07 不 9→0 大爆炸
- N/数据完整性永不豁免；文件写用 node；版本控制仅 but

## 指针

- 账本: .scratch/wave9-920-followup/decision-ledger.md
- 对账: destination-reconciliation.md
- Spec/Plan: spec.md · plan.md
- 调研: reports/Q3-waiver-disposition-research.md · reports/Q5-bypass-whitelist-endpoint-research.md
- 前序: .scratch/architecture-recovery/handoffs/W920-closeout-handoff.md

