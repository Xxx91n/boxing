# ADR-0017: Release Data Gate — 三条件合取可发行，残红禁 tag

## Date
2026-09-12

## Status
Accepted（票 46 + atomcode 调研）· **修订 2026-09-13**（v2026.9.12 强制路径记账 + G-B 用户声明 pass · Wave9 D-003/004/006/007）

## Context

- **事故事实（2026-09-12）**：2026.9.12 zip 发布后 Chrome + Firefox 界面冻结（GitHub Issue #9），回退 v3.7.8 后书签被掏空。双层根因——渲染层 `ntp/settings.css` `.modal-overlay` 缺闭合 `}`（CSS Nesting 吞掉其后全部顶层规则，[hidden] 兜底失效）；数据层无升级前 COW、crash rescue 用快照覆盖主键、导入/WebDAV newer-wins 静默覆写。共同流程成因：**zip 发行未过任何数据/可观测门禁**——门禁缺失把一个渲染 bug 放大成用户数据丢失。
- **防线已落地事实（门禁的证据基础）**：票 40（CSS 花括号修复 + [hidden] 兜底成对约定，已 land）；票 41/41R（`snap.v1` 分键快照 + Time Machine 轮转，已 land）；票 42/42R（onInstalled(update) 先 COW 后迁移）；票 43/43R（crash rescue = fork 归档损坏主键 + saveLayout 写路径归档先行）；票 44（恢复 = 合并 + 冲突副本，两段式显式覆盖）；票 45/45R（schema golden fixture + migration guard 进 pretest 阻断 + `@data-golden` 运行时门禁，continue-on-error burn-in 至 2026-09-18）；票 47（Pages 工件 fail-closed + 三 URL live 200 已核验，2026-09-11 dispatch 后）。
- **撰写时现状**：40/41/47 已 land main；42/43/44/45 在 stacked 分支待合；main 全量 test.yml 残红未清（run 34569565899 exit 1，残红 = wave4 存量名单）。按本 ADR 裁定：**2026.9.12 存量包不可发行，禁 tag / 禁宣称可发行**；Pages 200 一项已满足。
- **工业心智模型（atomcode，官方文档全文核验）**：release gate = 构建产物级 CI 必绿 + 人工黄金路径（禁止无人复核的自动发布）+ 百分比灰度 + Rollback 兼容义务。渠道差异：CWS rollback 以新版本号重发上一版（约 1 分钟生效、免审核、丢弃进行中百分比发布、两版循环陷阱）；AMO rollback 需 ≥2 个已批准版本且只能回退一版、更新按 24h 窗口生效；AMO 无百分比发布（截至 2026 功能请求未实现），替代 = unlisted canary 或功能开关；CWS 百分比发布门槛 >10,000 七日活跃用户且只增不减。

## Decision

「可发行」定义为以下三条的**合取**；任一未满足即禁止打 tag（发行标记），唯一合法对外表述为「不可发行」：

| 门禁 | 条件 | 证据形态 |
|---|---|---|
| **G-A CI** | main 全量 CI 主 lane 残红**清零**，或每条残红均有**书面定谳豁免** | CI run URL + 豁免台账（见下书面豁免规则） |
| **G-B 黄金路径** | 对发行 zip **解包产物**的人工黄金路径验收通过（Chrome + Firefox 双浏览器） | 发行检查单勾选记录（WORKFLOW §4.4 模板） |
| **G-C Pages** | `https://xxx91n.github.io/boxing/demo/`、`/boxing/demo/ntp.css`、`/boxing/privacy-policy.html` 三 URL live HTTP 200（privacy-policy 为商店提交硬依赖） | HTTP 状态码记录（**原句保留**；2026-09-15 追加 `version.json` 新鲜度断言，见文末「修订 2026-09-15（票 109 · A-064）」） |

**数据兼容义务（Rollback 兼容，两商店官方文本共同要求）**：

- schema 永不前向破坏：每次迁移必须过票 45 golden guard 的 expand/contract 门禁；含 schema 迁移的版本发行前另须完成一次回滚演练留痕（自动化门禁 + 至少一次人工「新数据 → 旧版代码」读回）。
- 发行检查单必须记录「可回滚目标版本」：CWS = 上一已发布版本（注意两版循环陷阱：连续两次回滚回到事故版）；AMO = 上一已批准版本（资格 ≥2 批准版本，且该版本本身无已知问题）。
- AMO 生效按 24h 更新窗口计算，紧急修复预案在发行前拟好。

**渠道灰度条款**：

- Boxing 当前七日活跃 < 10,000，CWS 百分比发布不可用 → 灰度替代 = 可信测试者通道 / 自托管 zip canary。
- 高风险版本在 AMO 走 unlisted 自分发 canary 后再提 listed；功能开关只允许切换已打包逻辑（MV3 远程代码禁令）。
- 首次上架必须人工走完 Dashboard；CI 只承接后续增量发布。

**书面豁免规则**：豁免条目必须含失败用例名、基线 run URL、失败签名、归属票号、到期条件；每次发行前复查全部在效豁免；不得设永久豁免。

**事故复盘义务**：发行类 P0/P1 事故恢复后 48h 内成稿，blameless；模板要点（atomcode，OneUptime/Google SRE 定制）——时间线（统一 UTC + 证据源：CI 日志/商店状态/推送记录）、影响量化（避免无工单即写"无影响"）、**触发-检测-修复三段分离**（审核通过 ≠ 推送生效）、版本号与回滚目标状态、纠偏措施表（Prevent/Detect/Mitigate/Respond + Owner + Done-when）。

**票 45 移交裁决**：`migrateLayout` 的 version===2 单程路径返回时缺 connections/groups/schemaVersion，规范化落在下一次加载。本 ADR 裁定：不阻断门禁（golden guard 已 pin 现状并具名），但列为 G-B 回滚演练必查项——v2 数据走首载 crash-rescue 路径须验证无损。

**数据韧性 RPO/RTO 交叉引用（票 51，2026-09-12）**：容灾留存义务的定量口径（RPO＝距最近留存点的编辑丢失窗口，破坏性入口写前 COW 使该事件 RPO=0、稳态 ≤ 自动备份间隔；RTO＝恢复到可用布局的时间，整机丢失目标 ≤ 5 分钟）见 ADR-0009「修订 2026-09-12（票 51）」。发行门禁与它的关系：G-A 数据完整性类测试（含信封导出/导入往返、覆盖前副本矩阵）永不豁免；G-B 人工黄金路径必须在解包产物上执行一次「默认信封导出 → 换 profile 导入还原」与一次「WebDAV pull 覆盖后快照回滚演练」，并记录所用备份文件的 `_exportedAt`（即实测 RPO 证据）。

**回滚验收 AC 具名升格（票 56，2026-09-12）**：本 ADR「数据兼容义务」的自动化镜像正式具名为回滚验收清单 RA-1..RA-6（= `scripts/migration-golden-guard.mjs` 回滚块与 v2 二过归一的检查名，实现体已存在，名字自此冻结）：`rollback-old-reader-accepts` · `rollback-bookmarks-visible` · `rollback-boxes-visible` · `rollback-connections-visible` · `rollback-isparent-self-contained` · `v2-second-pass-normalized`（v2 单程路径样例具名项）。治理口径：任一红 = G-A 数据兼容面残红，属 `migration-golden` never-quarantine 家族，禁入豁免台账；G-B「回滚演练」人工项按同名 RA 清单对照勾选。冻结读端（legacy reader）定界与独立模块接口设计（`scripts/legacy-reader-frozen.mjs`，append-only 契约注册表，生产 `ntp/**` 永不 import）见 `.scratch/architecture-recovery/reports/56-legacy-reader-freeze-rollback-ac-report.md`；落地接线留后续票。

**被否决备选**：

- 仅 CI 绿自动发行（无人工黄金路径）——否决：商店审核无法覆盖行为正确性，冻结恰是「绿灯 ≠ 可用」形态；atomcode G2「禁止无人复核的自动发布」为工业共识。
- 只设数据门禁（票 45 形态），不管可观测面——否决：privacy-policy 404 直接阻断商店提交（票 47 教训）；渲染冻结类缺陷不在数据层覆盖内（票 40 教训）。
- 允许「已知红」永久豁免——否决：无到期条件的豁免会让残红台账固化为债。

## 修订 2026-09-13（Wave9 · D-003/004/006/007）

**既成事实（如实记账，不改三门合取定义）**：

1. **v2026.9.12 已于 2026-09-13 发布**（GitHub Release + CI 四附件）。发行时 G-B 为用户强制豁免（D-009/A-038，无证据包）；G-A 当时未对发行 tip 定谳。
2. **G-A 定谳（2026-09-13）**：对 `origin/main` `b4f3df2` 触发 `test.yml` run
   [34749813393](https://github.com/Xxx91n/boxing/actions/runs/34749813393)
   ——data-golden **success**；ubuntu/macos/windows test **failure**。
   分桶：R1 `boxing-star-sync-audit` Scenario 1 = **B 稳定残红**（三 OS）；
   R2 empty-state Bug5-dark = F/B 待分诊；R3 auto-expand = F flaky。
   **结论：G-A 不成立**。详见 `.scratch/wave9-postrelease-grill/ga-definitive-b4f3df2.md`。
3. **商店**：AMO + Edge 已过审可见 **2026.9.12**（2026-09-13，发布方声明）。
   商店可见 **不** 等价于三门合取达成。
4. **发行姿态**：2026.9.12 **持有不热修**；下一目标版本 **2026.9.15** 全部修复（W9）。

**G-B 证据形态（常设口径，D-007）**：

- G-B = **用户在发行 zip/产物上的人工声明 pass**（须含 **版本号 + 日期**）。
- 可不附勾选单/截图；**禁止 agent 代签或伪造 G-B pass**。
- G-A 仍必须 main CI 绿（残红按 N/B/F 规则；N 桶与数据完整性永不豁免）；G-C 仍须三 URL 200。
- 本口径取代「必须归档检查单勾选记录」作为 G-B 的唯一合法形态；检查单仍可作为用户自愿附件。

**对齐 W9**：修绿 R1–R3 与纸面债后，以 2026.9.15 重新走 G-A∧G-B∧G-C；在 G-A 绿之前不得宣称门禁达成。

## 修订 2026-09-15（票 109 · A-064）：G-C 升格为「200 + 新鲜度」

**触发事实（2026-09-15 实测，非假设）**：三 URL live 200 **全部成立**，但带 cache-buster 的 `GET https://xxx91n.github.io/boxing/demo/version.json` 返回 `version=2026.9.12`（`deployedAt` 缺失 = 旧产物），而 `gh api repos/Xxx91n/boxing/releases/latest` = `v2026.9.15`。即：**旧口径 G-C 判「达成」的同一时刻，Pages 停在两个版本之前** —— 这正是 A-064 / B75 记录的「过时但 200」盲区，旧定义无力发现。

**修订内容（在上门禁表原句之上追加，不删除、不弱化原条件）**：

| 门禁 | 条件（修订后） | 证据形态 |
|---|---|---|
| **G-C Pages** | 三 URL live HTTP 200 **且** `GET /boxing/demo/version.json?<cache-buster>` 解析出的 `version` == 最新 release tag（`v` 前缀归一化后相等） | HTTP 状态码记录 + version.json 快照（version / deployedAt）+ 判定命令输出 |

**机制与分工**：

- **构建期**：`.github/scripts/build-demo.mjs` 稳定产出 `demo/version.json = { version, deployedAt, source, builtAt }`，产出后**回读校验**（探针损坏即 fail closed）；同时把版本号渲染进 demo（`data-boxing-version` + `<meta name="boxing-version">`），构成 HTML 侧第二探针（B75 的「demo 渲染 version」由此机器化）。
- **部署期**：`.github/workflows/demo-deploy.yml` deploy job 尾部 `node scripts/pages-gc-verify.mjs --mode=deploy-tail --timeout=180`（≤180s 轮询，不收敛即红）。
- **发行期**：`npm run verify:pages-gc`（等价 `node scripts/pages-gc-verify.mjs --mode=gate`，默认取最新 release tag）；人工检查单按同一口径勾选。
- **探针必绕缓存**：请求带 `?_=<ts>` 与 `no-cache` 头。GitHub Pages 固定 `max-age=600` 且不可配置（社区讨论 #11884），不绕缓存会产生「看起来没到达」的假阴性。

**失败两态（写入发行检查单，禁止笼统记「Pages 红」）**：

- `MISMATCH` = 部署链路未落地 → 重跑 `demo-deploy`、核查 `github-pages` environment 是否放行 tag 引用。
- `UNREACHABLE` = 存活/读取问题 → Pages 故障、被缓存的 404、`version.json` 不可读。

**未改变**：三门合取定义、G-B 用户声明口径（禁止 agent 代签）、人工检查单 —— 自动 verify 是**追加**探针，不取代人工复核（ADR-0017「禁止无人复核的自动发布」）。

**2026-09-15 一次性核查结论**：Pages 构建源 = **GitHub Actions 单一模式**（`build_type: workflow`）✔；`github-pages` environment **未放行 tag** ✘ —— release 触发的 run [34860199679](https://github.com/Xxx91n/boxing/actions/runs/34860199679) deploy job 0 step、2 秒内失败，而 dispatch（main）同流程成功。放行需**人工**在 Settings → Environments → github-pages → Deployment branches and tags 增加 `v*`；在放行前，release 触发的 Pages 同步**不会**发生，G-C 新口径将持续判红。

## Consequences

- 正面：「可发行」从口头判断变为可验证三值函数；tag 动作有了明确副作用边界（三条件齐备前不可执行）；残红获得治理台账面——每条红必须具名、有归属、有到期日。
- 负面/妥协：门禁是程序性（检查单 + 人工复核），不是流水线硬拦截——tag 与商店发布天然是人工动作，无法全自动强制；约束力靠报告落盘与大脑复核兜底。AMO 灰度必须引入 unlisted 自分发面，多一层托管与信任成本。
- 中性/约束：`@data-golden` 的 continue-on-error 必须在 2026-09-18 前摘除并绿，否则它自身成为 G-A 需豁免红项；此后任何发行票/启动器必须引用 WORKFLOW §4.4 检查单；新 ADR 若改数据格式，须对照本 ADR 的 Rollback 兼容义务。

## Review

- 复核日期: 2026-10-12
- 复核项: ① 豁免台账是否清零或全部在效续期；② 票 45 burn-in 是否已按期翻为阻断态且绿；③ 首个按本门禁执行的发行是否完成回滚演练并将检查单归档。
- 复核结论: （复核后回填）
