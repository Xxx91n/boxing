# Wave7 计划表（去向对账通过后整理 · 唯一数据源: wave7-flash-grill/decision-ledger.md）

> 生成: 2026-09-12 · 对账: destination-reconciliation.md（无去向 0）
> 不修源码；GitHub issue 立票在定稿/授权后另执行

## W7-SCOPE（源 D-001）

| 项 | 内容 |
|---|---|
| 轨道 | ①闪现 ②发行收口 ③锐评 triage |
| 主序 | 闪现 → 锐评 → 发行票务 |
| G-B | ready-for-human，用户并行，不阻塞本计划文档 |
| 红线 | G-B 完成前禁 tag / 禁宣称可发行；闪现不解耦记忆功能 |

## 票清单（计划表条目号）

| 编号 | 标题（建议） | 优先级 | 源 | AC 要点（仅账本） | 负向 |
|---|---|---|---|---|---|
| **W7-T1** | fix(ntp): new-tab zero-flash（FART + content mask） | **P1** | D-002 + D-003 | 主题层: 首帧已是记忆主题/明暗；paint-critical 键（至少 theme/darkMode）镜像 + head classic 阻塞 boot 同步应用；loadLayout 后仍以 boxingLayout 为准。内容层: renderCanvas/enterLargeBox 前 canvas 正确底色遮罩/inert。AC: Chrome+Firefox 新开标签慢放无默认 beige、无亮暗跳变、无非记忆盒子；rememberLastPos 不变；清 localStorage 允许一次性默认主题降级并说明 | 一张票不拆；不解耦/不延迟记忆主路径；完整 layout 不进 localStorage 当真源；禁 inline script；镜像不参与迁移/同步/导出；**不**改 ADR-0017；**不**进 G1–G6；不设 G-D |
| **W7-T2** | docs(README): release claims 收窄到已发布事实 | **P1** | D-004#1 | Latest published=v2026.9.11；候选 draft/pre-release；CHANGELOG 补 9.11；shields 语义与 pre-release | 禁写 main/2026.9.12 ready-to-use；禁宣称当前候选可发行 |
| **W7-T3** | docs/git-history: 历史声明（条件） | P2 | D-004#2 | 若无正式历史声明则立票处理 CI URL/证据链；若已有声明则改台账 | 整理阶段不预判仓库是否已有声明 |
| **W7-T4** | security(credentials): CRED 诚实标注或 per-install key | **P1** | D-004#3 | 二选一：混淆级承认（注释/隐私/字段名 _obf 类）或 per-install 随机 key | **禁止**本票做 passphrase 真加密架构重设计 |
| **W7-T5** | docs(privacy): WebDAV 私网限制说明 | P2 | D-004#4 | README Privacy 写明默认封锁私网 host | opt-in 设置后置 |
| **W7-T6** | chore: 统一用户可见版本串 | P2 | D-004#5 | 日志/头注释等与 manifest/calver 对齐 | — |
| **W7-T7** | chore: 用户可见债务标记合并清理 | P2 | D-004#8 | footer add / syncProviderHint / __lastSaveError 等 | **不**清理 i18n 重复键 |

## 发行轨（非本计划新票，源 D-001/D-003）

| 项 | 状态（账本） |
|---|---|
| G-B 人工黄金路径 | ready-for-human；2026.9.13 候选可继续 G1–G6 |
| 闪现与 G-B | 并行；闪现 land 后进后续 build；不回溯作废已通过数据路径证据 |
| README/CRED 等 | 见 W7-T2/T4，属发行卫生，不扩门禁合取 |

## 范围外清单（源: 对账 R1–R9）

| 编号 | 事项 | 理由 |
|---|---|---|
| R1 | 修改 ADR-0017 / WORKFLOW §4.4 合取 | D-003 |
| R2 | 设 G-D / 闪现进 G1–G6 | D-003 |
| R3 | 性能债实施 | D-004#6 台账 |
| R4 | popup/ 改造 | D-004#7 非缺陷 |
| R5 | .scratch 搬家 / README 去工作日志 | D-004#9 |
| R6 | V6 违规升为发行阻断 | D-004#10 + D-003 |
| R7 | i18n 重复键清理 | D-004#8 |
| R8 | G-B 实机与 #9 close 本体 | D-001 用户并行 |
| R9 | 源码实施 | D-001 整理/ grill 不修源码 |

## CONTEXT 词条去向（domain-modeling）

- docs/CONTEXT.md → UX/Cache invariants: 增补 zero-flash / paint-critical boot mirror（见整理 diff）
- **不**新开 ADR（对账 §5）
