# Wave8 Plan — 发行收口 / T-GA / R1–R8 / 人工项

> 日期: 2026-09-12 · 源: decision-ledger.md D-001..D-008 + destination-reconciliation.md
> 实施另波；本文件只定范围、优先级、覆盖 ID，不写实现步骤长文

## §0 范围与红线（D-001）

- 三轨全收，主序 A→B→C；实施波建议主序 **T-GA*（发行硬门）→ P-R* → 卫生**
- G-B 未完成前 **禁 tag / 禁宣称可发行**
- 不扩 ADR-0017（禁 G-D）；零闪现不解耦记忆（Wave7 D-002 红线继续有效）
- 版本控制唯一 `but`；grill/本整理不修产品源码

## §0.1 调研协议（D-005，已满足）

- atomcode 串行一次一个；回顾全部 current + ADR/CONTEXT + 工业模型
- 与 current 冲突：标 revised + 新 D-xxx 呈报，禁止静默改向
- 本轮 G-A 调研交付: `atomcode-ga-residual-research.md`（无 revised）

## §映射（D-008）— Wave7 backlog 收敛

| 旧 ID | 新去向 |
|---|---|
| B45 | **废止编号** → P-GA2 |
| B46 | **废止编号** → P-GA1..5 |
| B47 | **废止编号** → P-R4 |
| B48 | **废止编号** → P-R5 / P-R7 |
| B40 + B44 | 并入 P-R8 |
| B41 | 保持独立 → P-HUM1 |
| B42 | 保持独立 → P-HUM2 |
| B43 | 保持独立 → P-HUM3 |

---

## 发行轨

### P-REL0 候选包证据（D-004，已执行）

- [x] `gh workflow run build.yml -f version=2026.9.12 -f make_release=false -f amo_sign=true`
- [x] run **34689649760** conclusion=success
- [ ] 下载 `boxing-release-ubuntu-latest` 工件到固定路径（G-B 解包用；**勿**复用 `D:/gb-2026.9.13`）

### P-REL1 发行号 2026.9.12（D-002）

- 正式发行号 = **2026.9.12**；G-B 必须在**本号新 build**解包产物上执行
- 闪现修复（898119eb）必须在本版
- 过闸前 README 保持 Latest published=**v2026.9.11**
- 过闸前 CHANGELOG 补 `## [2026.9.12]` 条目 + 与同号历史 CI 存量包的鉴别说明
- 负向: 禁止宣称 2026.9.12 ready-to-use，直至 G-A∧G-B∧G-C

### P-REL2 G4/G5 基线（D-003）

- 上一发行版 **只用 v2026.9.11**；双浏览器各一轮
- G4 记录 v2026.9.11 → 2026.9.12
- G5b legacy-v2 fixture 仍按 ADR-0017 具名项
- v3.7.8 不进 G-B 勾选行

---

## G-A 治理（D-006；详细分桶见 atomcode-ga-residual-research.md）

| 计划号 | 内容 | 优先级 | D |
|---|---|---|---|
| **P-GA1** | 34626507101 vs 34686760142 集合差 + 根因 H1–H4 定谳 | **P0** | D-006 |
| **P-GA2** | N 桶修绿: data-golden gate4 / state-sync 并发 / dr-export WebDAV（建议含 AC1/AC2） | **P0** | D-006（含旧 B45） |
| **P-GA3** | B 桶 broken 修绿: conn-delete、innerclip、search、zoom-arrow、Bug5-dark 回归等 | **P1** | D-006 |
| **P-GA4** | 若 H1: boot-pending 与 e2e 就绪契约对齐（**不回滚零闪现**） | **P1** | D-006 |
| **P-GA5** | 既有 2 条 active 豁免到期复查 | **P2** | D-006 |

**禁止**: 为 N/B 桶写豁免；把 G-A 红折算成绿；因 G-A 红跳过 G-B。

---

## 轨 B — R1–R8（D-007）

| 计划号 | 内容 | 优先级 | 备注 |
|---|---|---|---|
| **P-R1** | 冲突副本读取口: 列表 + 单条导出 JSON | **P1** | 原 B36/锐#3 |
| **P-R2** | WebDAV merge 质量（子盒/id 级） | P2 | 先方案票再实施 |
| **P-R3** | CRED per-install 运行时 key + 迁移/备份兼容 | P2 | 诚实标注已做 |
| **P-R4** | WebDAV 私网 opt-in 设置 + i18n + README（并入旧 B47） | P2 | |
| **P-R5** | 性能债第一批: 至少搜索 debounce | P2 | 全量重建维持 ADR-0013 Q3=B |
| **P-R6** | popup/ 纳入本波 | P2 | Wave7 A-022 重开 |
| **P-R7** | .scratch/README 产品化 | P2 | Wave7 A-023 重开；**不阻塞** G-B/G-A |
| **P-R8** | 票务/过程卫生: 补勾 61/63/64/66 等 AC（并入 B40/B44） | P2 | **禁止**升发行门禁 |

---

## 人工项（D-008）

| 计划号 | 内容 | 优先级 |
|---|---|---|
| **P-HUM1** | B41: 60 零闪现慢放证据 Chrome+Firefox | P1 |
| **P-HUM2** | B42: G-B 六项实机（2026.9.12 新包；基线 v2026.9.11） | **P0** |
| **P-HUM3** | B43: Issue #9 close（绑 P-HUM2） | P0 |

---

## 建议实施波顺序

1. P-HUM2 可与 P-GA1..3 **并行**（门禁纯度，D-006）
2. P-GA1 → P-GA2 → P-GA3 →（H1 则）P-GA4 → P-GA5
3. P-R1 优先；P-R2/R3/R4 可并行方案；P-R5..R8 随带宽
4. 全门齐备后才: CHANGELOG/README 改口 → tag v2026.9.12 → P-HUM3

## 事实面状态（neat-freak 摘要）

| 面 | 状态 | 说明 |
|---|---|---|
| 代码 | verified-current | origin/main db649204；boot-theme 在盘 |
| 运行态 | pending | G-B 未实机；tag 未打 |
| 文档 | changed-and-verified | 本 plan/对账/调研新建；README 未改口（正确） |
| 规则 | verified-current | ADR-0017 未改；AGENTS.md 未改 |
| 记忆 | not-applicable | 本整理未写平台记忆 |
| 工作区 | pending | 候选包工件待下载；`.codex-tmp/ci-*.log` 为调查残留可删 |
