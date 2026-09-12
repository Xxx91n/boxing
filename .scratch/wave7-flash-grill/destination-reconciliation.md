# Wave7 去向对账（唯一数据源: decision-ledger.md 决策表 current）

> 规则: 禁止对话回忆补写；无去向清单非空则停。
> 日期: 2026-09-12 · 阶段: grill 结束后整理

## 1. current 记录枚举

| ID | 原问题（摘） | 状态 |
|---|---|---|
| D-001 | 本轮范围：闪现 / 发行收口 / 锐评 triage；G-B 前禁 tag；不解耦记忆 | current |
| D-002 | 零闪现验收 = 主题层首帧 + 内容层禁错误态（A+B） | current |
| D-003 | 一张 P1 票；不扩 ADR-0017；与 G-B 并行 | current |
| D-004 | 锐评 1–10：立票/条件立票/台账/不立票 | current |

## 2. 去向标注

| ID | 去向类型 | 去向位置 | 内容摘要（来自账本原文，不扩写） |
|---|---|---|---|
| D-001 | 计划表条目 | plan.md → **W7-SCOPE** | 三轨全收；主序闪现→锐评→发行票务；G-B 仍 ready-for-human 并行 |
| D-001 | 计划表/票约束 | 各票 AC 负向节 | grill 不修源码；一次一问；结论落盘；G-B 前禁 tag/禁宣称；不解耦记忆 |
| D-002 | spec 条目 | plan.md → **W7-T1 spec**（闪现票） | 主题层镜像+classic boot；内容层遮罩/inert；慢放 AC；清 localStorage 降级说明 |
| D-002 | spec 词条（domain-modeling） | docs/CONTEXT.md → UX/Cache invariants | 新术语: paint-critical boot mirror / zero-flash 新开标签（无实现细节） |
| D-003 | 计划表条目 | plan.md → **W7-T1 票形状** | 一张 P1；不拆主题/内容两票 |
| D-003 | 显式范围外 | 范围外清单 R1 | **不修改** ADR-0017 / WORKFLOW §4.4 合取；理由: D-003 current |
| D-003 | 显式范围外 | 范围外清单 R2 | 不设 G-D；闪现不进 G1–G6；理由: D-003 |
| D-004#1 | 计划表条目 | plan.md → **W7-T2** P1 | README 收窄声明；Latest published=v2026.9.11；draft/pre-release；CHANGELOG 9.11 |
| D-004#2 | 计划表条目（条件） | plan.md → **W7-T3** P2 | 无正式历史声明则立票；有则台账（整理阶段不预判仓库是否已有声明） |
| D-004#3 | 计划表条目 | plan.md → **W7-T4** P1 | CRED 诚实标注或 per-install key；不做 passphrase 重设计 |
| D-004#4 | 计划表条目 | plan.md → **W7-T5** P2 | WebDAV 私网限制写入 README Privacy；opt-in 后置 |
| D-004#5 | 计划表条目 | plan.md → **W7-T6** P2 | 统一用户可见版本串 |
| D-004#6 | 显式范围外 | 范围外清单 R3 | 性能债台账/backlog；理由: 无回归证据不立票 |
| D-004#7 | 显式范围外 | 范围外清单 R4 | popup/ 零改动不立票；理由: 非缺陷 |
| D-004#8 | 计划表条目 | plan.md → **W7-T7** P2 | footer add / syncProviderHint / __lastSaveError 合并卫生票；i18n 重复键不立票 |
| D-004#9 | 显式范围外 | 范围外清单 R5 | .scratch/README 工作日志台账；发行后 docs 里程碑 |
| D-004#10 | 显式范围外 | 范围外清单 R6 | V6 违规台账+月复核；**禁止**变门禁；理由: D-003+D-004 |
| D-004#8 中 i18n 重复键 | 显式范围外 | 范围外清单 R7 | 不立票；理由: 账本「注释禁止盲清」 |

## 3. 无去向记录清单

**（空）** — 决策表 4 条 current 及其可拆子项均已挂到 spec / 计划表编号 / 范围外+理由。

## 4. 范围外清单（汇总）

| 编号 | 事项 | 理由（账本依据） |
|---|---|---|
| R1 | 修改 ADR-0017/WORKFLOW 合取 | D-003 |
| R2 | 设 G-D / 闪现进 G1–G6 | D-003 |
| R3 | 性能债实施票 | D-004#6 |
| R4 | popup/ 改造票 | D-004#7 |
| R5 | .scratch 搬家 / README 去工作日志 | D-004#9 |
| R6 | V6 违规升级为发行阻断 | D-004#10 + D-003 |
| R7 | i18n 重复键清理票 | D-004#8 |
| R8 | G-B 实机执行与 #9 close 本体 | D-001：用户并行，非本轮文档立票 |
| R9 | 闪现/CRED 等写码实施 | D-001：grill/整理阶段不修源码；定稿后按票 |

## 5. ADR 触发判定（domain-modeling: sparingly）

| 候选 | 难逆转 | 无上下文会困惑 | 真权衡 | 结论 |
|---|---|---|---|---|
| 零闪现 boot 镜像 | 中 | 是 | 是（C 被否定） | **不新开 ADR**：手段写进 T1 spec/CONTEXT 词条；避免与 ADR-0012/0002 抢真源叙事 |
| CRED 诚实标注 vs per-install | 低-中 | 是 | 是 | **不新开 ADR**：T4 票内二选一拍板后若升架构再议 |
| README 声明收窄 | 低 | 否 | 弱 | 不新开 ADR |

## 6. 对账结论

- 无去向: **0**
- 可进入整理落盘: **是**
