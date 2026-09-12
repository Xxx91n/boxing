# 85 报告 — 文档产品化 (A-035 / D-007 R7, 重开 A-023)

> 启动器: prompts/85-docs-productize.md · handoff: handoffs/85-docs-productize.md
> 日期: 2026-09-12 · 阻塞: None (can start immediately) — 满足 · 状态: done

## 0. 开工前置

1. **阻塞**：票面 blocked = None。开工前复核 spec / decision-ledger / 工作区未提交面，确认无前置依赖 → 满足，可立即开工。
2. **必读清单**：启动器 7 项 + handoff 追加 2 项（atomcode-ga-residual-research.md、next-round.md）+ AGENTS.md = 10 项，全部读完再动手。

## 1. 调研（D-005 精神，写一次）

- **atomcode**：本票为文档票，不新增联网调研；复用本波已交付的 `.scratch/wave8-release-grill/atomcode-ga-residual-research.md`（22 源核验）作决策背景。
- **ADR / CONTEXT 心智模型**：回顾 ADR-0017（G-A∧G-B∧G-C 门禁合取）、ADR-0007/0008/0013 与 docs/CONTEXT.md。
- **工业对标**：docs-as-product 的三层分离 —— 产品文档 / 工程与架构文档 / 工作日志。判据：产品向入口不得承载治理台账与 agent 工作日志路径。
- **冲突检查**：本票做法与 decision-ledger 全部 current（A-025..A-037）无冲突，**无需 revised，未新增 D-xxx**，未静默改向。

## 2. 检查点：先减后加

### 减

- README.md 248 → 207 行：迁出 `## Quarantined tests` 与 `### Host-environment incident register`（48 行，含 3 处 .scratch 工作日志直引、ticket 01/14/18/27/31 票号黑话）。
- **减的硬依据**：13 个 i18n README（各 155 行）对 quarantine / .scratch / incident 的命中数**全为 0** —— 英文版是唯一异常点，且与全部译文结构背离。
- 减后 README：.scratch 引用 = 0，票号黑话 = 0；章节收敛为 产品 → 开发 → 贡献 → 许可，与 i18n 版同形。

### 加

- 新建 `docs/START-HERE.md`：按 4 类受众路由（用户 / 贡献者 / agent / 发布与审计），并显式声明 `.scratch/` 是工作日志层而非文档层。
- 三处各挂一行指针：README.md、CONTRIBUTING.md、docs/agents/README.md。

## 3. 专属验收：关键指针可解析

- 新增 `scripts/docs-pointer-check.mjs`（零反斜杠实现，规避转义层损坏正则）+ `npm run docs:pointers`。
- 结果：**74 个关键指针 / 9 份入口文档全部可解析，exit 0**。
- **检查器当场抓到 1 个真实缺陷**：治理文档迁至 docs/ 后，3 条 .scratch 证据指针仍相对仓库根（解析为 docs/.scratch/... 不存在）→ 改为 ../.scratch/ 后通过。这正是本验收项的价值。
- **非门禁**：未挂 pretest、未进任何必过 CI job —— 不阻塞 G-A/G-B，不扩 ADR-0017。

## 4. AC 对照

| AC | 结果 | 证据 |
|---|---|---|
| 新人入口清晰 | 达成 | docs/START-HERE.md 单一路由页 + 三处挂载；README 不再夹带治理台账与工作日志路径 |
| 不阻塞 G-A/G-B | 达成 | 纯文档 + 一个非门禁脚本；未改 test/、CI、门禁、豁免台账任一文件 |
| 不删唯一证据链 | 达成 | 3 份 .scratch 报告均 EXISTS；证据块字节级原样迁移，仅路径前缀改 ../ |

## 5. 红线

- 未 tag、未宣称 2026.9.12 可发行；未改 ADR-0017；未扩门禁；未动豁免台账；未复用 gb-2026.9.13。

## 6. 验证命令与结果

- `npm run docs:pointers` → exit 0（74/74 可解析）
- `npm run build` → exit 0（A8 / A8.0b / A10 OK，DONE_BUILD）
- `git diff --check` → exit 0（无 CRLF / 空白问题）

## 7. 版本控制（WORKFLOW §4.2）

`but diff` 逐 hunk 认领 → `but commit -b 85-docs-productize`。并行窗（票 70–84 / 86）与大脑会话的未提交改动一个未卷入。

## 8. 已知缺口

- 13 个 i18n README 本就无治理块，与本票无冲突，无需改动。
- docs/START-HERE.md 未做 i18n；产品向多语言入口仍由 i18n README 承担。
- 检查器当前只覆盖入口链 9 份文档；未覆盖 docs/adr 与 docs/history 全量（有意收窄，避免变成新门禁面）。
