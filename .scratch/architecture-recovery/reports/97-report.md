# 97 — docs 层 live Release status（锐评6 / A-051）报告

> Covers: A-051 · Blocked by: 100, 104（均已完成，本票可执行）· Status: implemented（2026-09-14）
> 产物：`docs/release-status.md`（新增）· `docs/START-HERE.md` §4（导航）· `docs/CONTEXT.md` release gate 段（指针）
> 账本：`decision-ledger.md` A-051 由 current → implemented

## 1. 一句话

docs/ 层落地可维护的发行状态页：当前版本、G-A/G-B/G-C 三门状态、在效豁免、在办欠账；记中间里程碑 `34808080000` 与发行终谳预留。结论维持「不可发行」。

## 2. 调研（handoff 通用三项，本票一次性）

### 2.1 atomcode 深度调研（2026-09-14，ctx source=atomcode-97，串行一次）

**执行摘要（Confidence：高）**：成熟项目不靠「人手写一页然后记得更新」，而是三层结构——① 机器从单一事实源生成状态；② 人在机器数据之上做带审计痕迹的判断（每个豁免强制挂票）；③ 用 CI 把「过时」变成硬失败。防过时的核心机制是**棘轮（ratchet）+ 时间戳 + 证据链接**，而不是定期人工提醒。

四种成熟形态（对比矩阵）：

| 形态 | 代表 | 真值来源 | 豁免/债务表示 | 防过时机制 | 适用规模 |
|---|---|---|---|---|---|
| 机器生成页 | Debian RC bugs / excuses | BTS 查询，周期重算 | `ignore` 标签 + rm hints | 页面即查询结果，结构上不可漂移 | 超大型、多包 |
| 双仪表盘 + 人工巡检 | Kubernetes TestGrid | CI job 聚合 | Informing 层 tolerated failures，须挂 issue 限期认领 | 3 连绿 go/no-go + CI Signal 例会 | 超大型、多 SIG |
| 证据矩阵文档 | perfgate `RELEASE_READINESS.md` | xtask 命令复跑 + audit 文件 | 显式 Advisory (deferred) 行 + Superseded 语义 | Last verified 时间戳 + 每行证据链接 + docs-check gate | **中小型、单仓** |
| 追踪器状态机 | Fedora blocker 白板 | Bugzilla 字段 + blockerbugs 应用 | Freeze exception 流程 + Accepted* 分类 | 周评审会纪要链接 | 大型、发布制 |

横切策略：**棘轮豁免**（srdcheck：挂票 + 失效即失败，作者三向验证 exit 0/1/1）、**新鲜度 CI**（docfresh / doxloop：源码与文档 SHA 比对，exit 1 即 stale）、**发行工作流内嵌文档检查**。

**选型与理由**：Boxing 是中小型单仓，采纳 **A3 证据矩阵型**（perfgate 模型）。理由：① 与 ADR-0017 的「G-A 机器证明 / G-B 用户声明 / G-C 发行后核验」分层同构，无需引入新心智模型；② 状态页必须能承载「人签」的 G-B，机器生成型（A1）无法表达；③ 仓库已具备棘轮机制的机器侧实现（`scripts/waiver-ledger-check.mjs`，exit≠0 阻断），A3 只补文档侧时间戳与证据链接。

**信息缺口（如实记账）**：Debian rc 页生成脚本细节未读原文；perfgate 式重证据文档的维护成本无独立批评（仅正面自述）；docfresh / doxloop 均为 2025–2026 新工具（docfresh 仅 16 commits）成熟度存疑；K8s CI Signal 量化 SLO 未深挖。上述缺口均不影响 A3 选型结论——该结论由 perfgate 原文 + 本仓库既有机制直接支撑。

### 2.2 ADR / CONTEXT 现有心智模型回顾

- **ADR-0017**（Accepted，修订 2026-09-13）：「可发行」= G-A ∧ G-B ∧ G-C 合取；任一未满足即禁 tag，唯一合法表述为「不可发行」。**本页与其零冲突**——本页是状态投影，门禁定义仍以 ADR-0017 为唯一来源，页首显式声明冲突时以 ADR-0017 为准。
- **docs/CONTEXT.md** § Data Resilience & Release Gate：`release gate` 条目已定义三门合取与 N/B/F 分桶。本票在其后新增 `release status page` 指针条目（英文，与该段语种一致）。
- **冲突判定：无冲突，无需记 revised。** 未改动 ADR-0017 任何条款，未改三门定义，未放宽豁免规则。

### 2.3 工业对标（实现与测试策略）

- 每行状态附**可复现证据**（run URL / 命令 / 实测日期）→ 对应 perfgate Evidence 列。
- 旧证明保留并标 **Interim / Superseded**，不删除 → 对应 perfgate 审计链不断裂原则。
- 豁免以**机器校验命令**为入口（`node scripts/waiver-ledger-check.mjs`）→ 对应 srdcheck 棘轮。
- 页内写明「如何更新本页」6 条维护契约 → 把防过时从「记得更新」变为**可判定的步骤**。

## 3. 实现

| 文件 | 变更 |
|---|---|
| `docs/release-status.md` | 新增（130 行）。七节：结论 / 当前版本 / 三门状态（含 G-C 实测锚点、G-A 历史证据、发行终谳预留）/ 在效豁免 / 在办欠账 / 如何更新本页 / 来源与交叉引用 + 变更记录 |
| `docs/START-HERE.md` | §4「发布或审计」入口新增状态页链接（LF 原样） |
| `docs/CONTEXT.md` | `release gate` 条目后新增 `release status page` 指针（CRLF 原样） |

关键内容决策：

1. **结论先行**：第一节即「不可发行」，并列出已满足 / 未满足项，避免读者误读为可发行。
2. **中间里程碑显式标注**：run `34808080000` @ `9fa4666c` 标注为「中间里程碑，不是发行终谳」，并注明 tip 已前进 18 个提交；同时保留 `34773593267` / `34778641702` 两条连续绿 run 作为历史证据。
3. **发行终谳预留**：独立小节列出待填项（新 tip / 发行 G-A run / 四 job 结果 / G-B 用户声明 / G-C 发行后复检 / 结论），供 B 轨 land 后直接填写。
4. **G-B 不可由 agent 代签**：状态为「未达成」，并注明仅用户可签（须含 2026.9.15 + 日期）。
5. **公开路径无本机绝对路径**：全页仅用仓库相对路径与 github.io / github.com URL（已机器扫描确认零泄漏）。

## 4. AC 对照

| # | AC | 结果 | 证据 |
|---|---|---|---|
| 1 | docs/ 层存在 Release status 或 ADR-0017 等价 live 节 | ✅ | `docs/release-status.md` 已落盘；ADR-0017 未改动（其 Review 段复核结论仍为待回填，非本票范围） |
| 2 | 写明 34808080000 为中间里程碑 | ✅ | 第三节 G-A 行 + G-A 历史证据表 + 第六节禁止项，共 3 处明确标注 |
| 3 | 公开路径无本机绝对路径 | ✅ | 全页扫描零命中（检测：盘符路径、系统用户目录、仓库绝对目录三种形态）；外链仅 github.com 与 github.io，其余为仓库相对路径，4/4 可解析 |

完成定义（handoff）：AC 全勾 ✅；附 CI / 实测锚点 ✅（见 §5）；账本状态更新 ✅；报告落盘 ✅；版本控制遵循 §4.2 ✅（见 §7）。

## 5. 锚点

| 项 | 命令 / 动作 | 结果 |
|---|---|---|
| 死链治理门禁（票 96） | `node scripts/docs-link-guard.mjs` | exit 0 · self-test OK · 8 引用 0 死链 |
| 豁免台账棘轮 | `node scripts/waiver-ledger-check.mjs` | exit 0 · 4 行台账、字段齐全、无过期、never-quarantine 零命中（as of 2026-09-14） |
| 版本面一致性（票 100） | `node scripts/calver-guard.mjs` | exit 0 · version=2026.9.15，8 面一致 |
| 行尾 / 空白 | `git diff --check` | exit 0 |
| G-C 三 URL 实测（2026-09-14，本机 fetch） | `/boxing/demo/` · `/boxing/demo/ntp.css` · `/boxing/privacy-policy.html` | 均 200；demo 渲染 NTP 界面，css 返回样式表正文，privacy 含政策正文且 Last updated 2026-09-12 |
| 状态页内链可解析 | 相对链接扫描 | 4/4 OK（adr/0017、publishing-guide、store-publishing-plan、testing-governance） |

**注意**：G-C 为「达成」，但 G-A 未定谳、G-B 未达成 → 三门合取**不成立**，状态页结论为「不可发行」。本次 G-C 实测是状态页数据核验，不是发行动作。

## 6. 账本状态更新

- `A-051` → `implemented（2026-09-14 · ticket 97 · docs/release-status.md …）`，显式约束「不宣称三门达成」已遵守。
- A-050..A-061 中仍有 6 条 current：A-053（99）、A-055（101）、A-057（103）、A-059（105）、A-060（106）、A-061（无票，执行）。已在状态页第五节列表记账。

## 7. 版本控制实况（WORKFLOW §4.2）

- 全程使用 GitButler（`but`）检视与提交；未 push、未开 PR、未改写其他窗口提交。
- 分支 `ticket/97-release-status-rui6`，两个提交（自底向上）：
  - `twk` docs(release)：`docs/release-status.md`（新）、`docs/START-HERE.md`、`docs/CONTEXT.md`、`reports/97-report.md`；
  - `yzu` docs(ledger)：`.scratch/architecture-recovery/decision-ledger.md` A-051 置 implemented。
- **栈位置调整（关键决策）**：账本 hunk 的 diff 上下文依赖栈上更高分支对 `decision-ledger.md` 的既有改动（A-050 / A-052 / A-054 等行已被他窗票改为 implemented），`but commit` 以「line 139 depends on wave915-grill-settle」拒绝落盘。按提示 `--above wave915-grill-settle` 仍不通过（该分支不含更高分支的改动），最终将本票分支移至栈顶（`but move ticket/97-release-status-rui6 --above ticket/96-docsgov-deadlink`）后提交成功。**仅调整分支顺序，未改写任何其他窗口的提交内容。**
- **跨窗口隔离**：工作区同期存在他窗改动（`reports/101-report.md` 等），均未纳入本票提交；提交完成后工作区只剩他窗未跟踪项。

## 8. 禁止项自检

| 禁止项 | 结果 |
|---|---|
| 宣称三门合取达成 | 未违反：结论明确「不可发行」 |
| agent 代签 G-B | 未违反：G-B = 未达成，注明仅用户可签 |
| N 桶 / 数据完整性豁免 | 未违反：状态页显式声明永不豁免 |
| 未明令 push / tag / force-push | 未违反：未执行任何 push / tag |
| 热修 2026.9.12 | 未违反：未触碰发布产物 |
| 用 run 34808080000 冒充本波 land 后发行 G-A | 未违反：三处标注为中间里程碑 |

## 9. 遗留与建议（非本票范围）

1. **新鲜度门禁缺位**：本页目前靠第六节人工契约防过时。若要对齐 docfresh / doxloop 模式，可后续开票把「`docs/release-status.md` 的 Last verified 日期 vs `manifest.json` / 最新 CI run 的变更时间」做成 CI 检查（本票不开，避免与 G-A 混写）。
2. **G-A 重跑后回填**：B 轨 land 后新 tip 触发 `test.yml`，须回填「发行终谳预留」小节并把 G-A 行改为定谳。
3. **A-053 对齐**：票 99（locale README 版本口径）完成后，应与本页当前版本栏保持一致。
