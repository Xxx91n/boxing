# Q5 调研纪要 — layout-bypass 白名单长尾终点（atomcode）

> 日期: 2026-09-22 · 载体: atomcode-research
> 对照: followup D-001..D-004 · W920 D-002 · ADR-0007 · layout-bypass-guard LB-1/2 · 票105 棘轮

## 调研结论（要点）

1. **棘轮（只减不增）= 业界标准**（qntm / Suppress Ratchet / imbue-ratchets / Notion / Metabase）。
2. **本波零豁免全量收编 = 错误交付物**：大规模 diff 放大「加一减一抵消 / 豁免位移动」失效，挤占发行窗；零豁免是**长期终点**。
3. **风险分层有官方支撑**：Android lint baseline 按 issue 类型分层；ESLint 须 reason + 临时豁免挂任务；删除/致命类对应 **fatal、不可 baseline**。
4. **数据完整性优先** ⇒ 删除/墓碑类 **零豁免、必须走单一 mutation 入口**；非集合改写可留**少量具名豁免**（reason + 到期/工单）。
5. 纯棘轮不产生清理动力，须配 **downcounting / tighten**。

## 来源（atomcode）

- qntm.org/ratchet（2021-11）— 棘轮定义 + 「不推动清理」缺陷
- github.com/motchalini-llc/suppress-ratchet — count 只减；IMPROVED→降 baseline
- github.com/imbue-ai/ratchets — 规则×区域预算分层 + tighten
- HN #46814340 — Notion per-file 棘轮；加一减一抵消 / 位移动失效
- eslint.org/docs/latest/use/configure/rules — reason 必填、临时豁免挂任务、unused-directive 报错
- Metabase PR #81319 — 政策化豁免预算 + master 自动收紧
- developer.android.com/studio/write/lint — baseline 分层 / fatal 不可 baseline（部分 302）
- ngautopilot eslint-disable-governance — justified/temporary/unnecessary/suspicious + expiry path

## 辩证：与本地 current 对照

| 本地 | 调研 | 判定 |
|---|---|---|
| 票105 / A-063：豁免只许缩小（棘轮）；具名 `layout-bypass-allow` | 一致 | **无冲突** |
| W920 D-002：删除/改写旁路静态门禁 + 白名单注释；delete/reorder 已收编 | 删除类零豁免=已满足；与分层模型一致 | **无冲突** |
| D-003 数据完整性 / N 永不豁免 | 删除/墓碑 fatal 化一致 | **无冲突** |
| D-001「全量可解项」/ D-004「C07 本波收编」 | 若读成「9 处全收至 0 豁免」= 与调研冲突（本波错误交付） | **措辞冲突（待澄清）** |
| D-004 主序（代码先行→…→G-B 重签） | 调研支持「本波勿大爆炸收编」⇒ 分层终点不改变主序 | **主序无冲突** |

## 信息缺口 / 噪声

- 无「单一 mutation 入口」完全同构一手案例（lint 类比，置信中）。
- Tavily 超配额，Exa+AnySearch 双引擎支撑。
- ngautopilot 为社区模板，非标准组织强制。

## 映射 Q5 选项（待拍板）

- A 零豁免本波收完：**否**（长期终点，非本波）。
- **B 分层（删除/墓碑零豁免 + 改写具名 + 棘轮）= 调研推荐**。
- C 仅 C05、C07 挂观察：弱于 B，且删除类已收完故 C 无额外收益。
