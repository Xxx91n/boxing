# 15 — ADR 模板补 Consequences / 复核小节 · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-02
- 状态: **done** — issues/15 验收 3/3 勾选; 本文件为收口用完整版
- 分支: `ticket-15-adr-consequences-section` (独立分支, 无前票依赖)
- 提交: `vkn` (docs/adr/0000-adr-template.md 新增 + AGENTS.md 一行 + issues/15 写回, 单 commit); 本报告文件补交同分支
- 上游依据: handoffs/15 + issues/15 + spec.md (ADR 治理为一次性文档更新, 无代码) + WORKFLOW §4.2/§6

## 交付物

| 文件 | 变化 | 内容 |
|---|---|---|
| docs/adr/0000-adr-template.md | 新增 (1445B, 28 行) | ADR 模板: Date/Status/Context/Decision/**Consequences**/**Review** 六节; Consequences 强制正/负/中三面记录 (妥协不得只写收益); Review 复核日期 = 决策日期 + 30 天, 含复核项与结论回填位; 模板头注明用法与存量豁免 |
| AGENTS.md | +1 行 (L105, ### Domain docs 节) | 指向模板的强制引用一行, 不复述模板全文; `git diff --stat` = 1 insertion |
| .scratch/.../issues/15-adr-consequences-section.md | Status→done, 3/3 勾 | 逐项附落地证据 |
| .scratch/.../WORKFLOW.md | §6 +1 行 | 票15 教训 (见下) |

## 裁决与依据

- **模板骨架沿仓库现状**: 16 份存量 ADR 的房式结构 (Date/Status/Context/Decision/Consequences) 是既成惯例, 10/16 已有 Consequences — 模板不改头换面, 只把事实惯例升级为显式契约, 并按 handoff 指定轮子 (MADR 4.0 + joelparkerhenderson 模板库, ctx source=atomcode-arch-maturity, 复用未重查) 补 Consequences 语义 (负面/妥协显式) 与 Review 复核字段。
- **编号用 0000**: ADR 惯例 (模板/元文件占 0000, 决策从 0001 起), 存量 0001-0016 编号零冲突。
- **AGENTS.md 锚点**: `### Domain docs` 节本就有 "all ADRs live in docs/adr/" 语境, 引用行放此处与既有指引零重叠; 模板全文不复述 (delta 条款), 只留一行指针。
- **复核周期 30 天**: 与 handoff/issues 文本一致; 模板内 Review 节给出复核项示例 (前提仍成立 / 妥协仍可接受 / 是否 Supersede), 结论回填格式与 Status→Superseded 联动。

## 验证证据

- 文件写入后内建自验全绿: 模板无 BOM/纯 LF/关键节全在; AGENTS.md 无 BOM/无 CR/锚点唯一/新行唯一。
- `git diff --check` 干净; `git diff --stat -- AGENTS.md` = 1 insertion (无意外改动)。
- `git status`: docs/adr/ 下仅新增 0000 文件, 0001-0016 零触碰 (验收项 3)。
- **npm test (全量 419 项): 382 passed / 37 failed** — 失败全部集中 firefox-extension 车道, chromium 车道全绿; 本票改动纯 markdown 无行为面, 判定为 WORKFLOW 已记录的满负载抖动特征。按完成定义 "超时项单跑必绿为准" 收敛: `--last-failed` 批跑 → 36 passed / 1 failed; 残余项 (`boxing-auto-expand` hover 时序断言 60 vs >80, Firefox 悬停展开抖动) 单跑 → **1 passed (14.2s)**。三轮证据齐, 门禁达成。
- 纯文档票无 dist 契约面 → `npm run build` 不适用 (handoff: "拆分类票另需 build 绿", 本票非拆分类)。
- `codegraph sync` 已跑 (BX-EXPLORE-003)。

## 版本控制轨迹 (§4.2)

- 开工前 but status 认领检查: 本票只碰 ws(AGENTS.md)/lz(0000 模板)/xt(issues/15) 三个 id; WORKFLOW.md (pyw) 与 .scratch 全套为大脑窗共享基建, 本票只按 §6 追加教训行, **不提交** (整文件 id 会卷入他窗改动 — 票05 教训; 与票11 先例一致, 其分支同样不含 WORKFLOW.md)。
- `but diff` 逐文件认领: 三 hunk 全为本票改动, 无并行窗污染。
- `but commit -b ticket-15-adr-consequences-section -m "docs(adr): add 0000 template with mandatory Consequences + 30-day review; AGENTS.md one-line mandate (ticket 15)" ws lz xt` → commit `vkn`。未 push, 未开 PR (§4.2)。

## 给大脑的收口注意

1. **WORKFLOW.md 仍在工作区未提交**: 本票 §6 教训行 + issues/15 勾选后的基线内容都在盘上; 大脑收口时统一提交 (票11 报告同样提示过该重复添加冲突面 — 请大脑合并两票的 WORKFLOW 写入一并处理)。
2. **README 波次表未动**: 票15 状态行仍归大脑窗管辖, 本票未越权改。
3. **模板落地的后续执行面**: 自下一票 (12/13/14) 起新 ADR 须含 Consequences + Review; 若某票产出 ADR, 建议大脑在 handoff 里点名模板路径, 避免子窗重新发现约定。
4. **测试车道教训普适**: 票12-14 拆分类票验收若遇 firefox 满负载整批假失败, 可直接走 last-failed 收敛 + 残余 solo 终验路径 (本票实证两轮内收口), 无需怀疑代码。

## WORKFLOW §6 新增教训 (已写回)

- 纯文档票 (markdown only) 也会被满负载 firefox 车道整批假失败 (37/419, 全集中 firefox-extension, chromium 全绿): `--last-failed` 重跑 36 绿, 残余 hover 时序项单跑 1 绿 (auto-expand 60vs80 抖动) — 完成定义的 "超时项单跑必绿为准" 实操路径 = last-failed 批跑收敛 + 残余 solo 终验, 两轮内可收口; 文档票无需 npm run build (无 dist 契约面)。
