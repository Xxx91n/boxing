# 报告 — 49 G-B 人工 zip 黄金路径（ready-for-human）

- 日期: 2026-09-12
- 票面: `issues/49-g-b-manual-golden-path.md` · handoff: `handoffs/49-g-b-manual-golden-path.md`
- 覆盖: A-001（四轨全包含拆票）· A-009（G-B ready-for-human，禁纯自动化）· A-007（#9 完成前只更新不关闭）
- **窗口状态: 子窗口交付物全部落盘；G-B 本体等待用户人工执行回传。本报告不宣称 G-B 完成。**

## 0. 调研声明

本票无新增调研问题，复用 Wave5/6 已索引 atomcode 结论：release gate =「构建产物级 CI 必绿 + 人工黄金路径（禁止无人复核的自动发布）+ 灰度 + Rollback 兼容义务」（atomcode 2026-09-11/12 发布门禁调研，ctx source=atomcode，18 信源官方文档全文核验，收录于 ADR-0017 Context 与票 46 报告）。检查单渠道条款（CWS 回滚 ~1min 免审/两版循环陷阱、AMO 24h 窗口/≥2 批准版、unlisted canary 替代百分比）直接沿用该结论，未重复调研。

## 1. 交付物

目录: `.scratch/architecture-recovery/evidence/49-g-b-manual-golden-path/`

| 文件 | 内容 |
|---|---|
| `README.md` | 证据归档路径规范、目录树、证据命名规则、复核拒绝条件（无证据勾选视同未勾） |
| `checklist-template.md` | WORKFLOW §4.4 发行检查单可勾选母本（G-A/G-B/G-C + 渠道与商店 + 结论；G-B 六项 G1–G6 编号，双浏览器各复制一份） |
| `gb-execution-card.md` | G-B 逐项执行卡：准备（build.yml 工件、sha256、解包路径与扩展 ID 稳定性）、G1 新装、G2 CRUD 重开、G3 导入合并/冲突副本、G4 升级 pre-update 快照（COW）、G5a 新→旧读回、G5b v2 单程路径样例、G6 具名复核；含可直接粘贴的 storage 验证命令 |
| `writeback-draft.md` | 回传后复核清单 + GitHub #9 更新稿 + ADR-0017 状态写回稿 + 关票条件 |
| `chrome/`、`firefox/` | 双浏览器证据归档目录（空，含 .gitkeep，待用户回传填充） |

## 2. 验收项（AC）对照

| AC | 状态 | 证据/说明 |
|---|---|---|
| 输出 §4.4 可勾选检查单副本与证据归档路径 | **完成** | 上表四文件 + 归档目录结构 |
| 用户在真浏览器完成勾选并回传 | **待用户**（ready-for-human 本体） | 执行人=用户；操作面已全部模板化，按 `gb-execution-card.md` 可零上下文执行 |
| 复核证据后写回 #9 与 ADR-0017 状态 | **待回传后执行** | 写回稿已预置于 `writeback-draft.md`（#9 评论稿 + ADR-0017 追加行 + 关票条件）；A-007 约束：完成前对 #9 只更新、不关闭 |
| 禁止纯自动化宣称 G-B 完成 | **遵守** | 本报告与全部交付物均未将 G-B 记为满足；复核拒绝条件把「无实机证据的勾选」定为无效；Playwright/CI 绿灯仅作 G-A 证据，不可替代 G-B |

## 3. 设计说明 — 检查项与事故形态一一对应

2026-09-12 事故（#9）各失效面在 G-B 检查单中的映射：

| 事故形态 | 防线落地 | G-B 检查项 |
|---|---|---|
| `.modal-overlay` 缺 `}` → 全屏遮罩冻结 | 票 40 修复（main）+ 票 53 构建期门禁 | G1/G4「零 console 错误 + 可点击、遮罩可关」 |
| 无升级前 COW → 回退掏空数据 | 票 42/42R pre-update 快照 | G4 首开前 `snap.v1.index` 新增条目核验 |
| crash rescue 覆盖主键 | 票 43/43R fork 归档 `boxingLayout.corrupt.*` | G5a 回滚中若触发 crash-rescue 须验证主键重建无损 |
| 导入/WebDAV newer-wins 静默覆盖 | 票 44 合并 + `boxingLayout.conflict.*` | G3 冲突副本可查、书签消失即判红 |
| v2 单程路径缺字段延迟规范化（票 45 移交裁决） | golden guard pin 现状 | G5b fixture 注入实机演练（ADR-0017 具名必查项） |
| zip 零门禁发布 | ADR-0017 三条件合取 | 检查单「结论」节 + G6 禁止无人复核发布 |

操作细节设计依据（工程约束，非推测）：unpacked 扩展 ID 与加载路径绑定 → G4/G5 升级回滚演练必须在同一解包目录覆盖文件，否则 storage 随 ID 漂移，演练失效；Firefox 临时附加组件不跨重启保留 → 升级/回滚车道建议 Dev Edition/Nightly 安装态（执行卡已注明，勾选单允许记录车道差异）。

## 4. 门禁三条件现状（供主 Agent 收口对账）

| Gate | 状态 | 归属 |
|---|---|---|
| G-A CI | 未满足（main 残红，run 34569565899 基线） | 票 48 |
| G-B 人工 zip 黄金路径 | 检查单+执行卡+归档路径已就绪，**待用户实机执行** | 本票 49 |
| G-C Pages 200 | 已满足（2026-09-11 核验） | 票 47 |
| 结论 | **不可发行**（合取未满足），禁 tag | ADR-0017 |

## 5. 版本控制

遵循 WORKFLOW §4.2（GitButler `but` CLI，独立本票分支；不 push、不开 PR）。提交含 §1 全部交付物与 `issues/49` AC 勾选写回；commit 号见本窗口最终回复。

## 6. 移交下一步

1. 用户（或主 Agent 派发）按 `gb-execution-card.md` 在真 Chrome+Firefox 对候选 zip 解包产物执行 G1–G6，证据回传 `chrome/`、`firefox/`。
2. 复核人按 `writeback-draft.md` 验证 → 执行 #9 评论 + ADR-0017 写回 → 本票 AC2/AC3 勾满 → 票 49 关票。
3. 前置事实（2026-09-12 复核修订）：2026.9.12 存量包已被 ADR-0017 判不可发行，G-B 演练对象必须是新候选版本。经核验 `origin/main`（tip `ffa55f8`）已含全部防线——`snap.v1`/pre-update COW（票 41/42）、fork（票 43/43R）、合并+冲突副本（票 44）、golden fixtures + guard（票 45，`test/fixtures/schema/{v1,legacy-groups,legacy-v2}.json`）、ADR-0017（票 46），即 backlog B14 的 land 实际已完成。**当时的唯一缺项已补齐**（同日后续轮次）：以任务文本逐字授权命令 `gh workflow run build.yml -f version=2026.9.13 -f make_release=false -f amo_sign=true` 从 main 触发 run https://github.com/Xxx91n/boxing/actions/runs/34641377036 ，三 OS leg 全绿，工件 `boxing-release-ubuntu-latest`（890KB，含 chrome/firefox 的 zip/crx/xpi 四件，版本号 2026.9.13；amo_sign=true 未燃烧 AMO 版本号）。候选 zip 获取：`gh run download 34641377036 -n boxing-release-ubuntu-latest`。
