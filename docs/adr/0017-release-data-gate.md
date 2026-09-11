# ADR-0017: Release Data Gate — 三条件合取可发行，残红禁 tag

## Date
2026-09-12

## Status
Accepted（裁决来源: 票 46 + spec D7 + atomcode 2026-09-11/12 发布门禁调研，ctx source=atomcode，18 信源官方文档全文核验）

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
| **G-C Pages** | `https://xxx91n.github.io/boxing/demo/`、`/boxing/demo/ntp.css`、`/boxing/privacy-policy.html` 三 URL live HTTP 200（privacy-policy 为商店提交硬依赖） | HTTP 状态码记录 |

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

**被否决备选**：

- 仅 CI 绿自动发行（无人工黄金路径）——否决：商店审核无法覆盖行为正确性，冻结恰是「绿灯 ≠ 可用」形态；atomcode G2「禁止无人复核的自动发布」为工业共识。
- 只设数据门禁（票 45 形态），不管可观测面——否决：privacy-policy 404 直接阻断商店提交（票 47 教训）；渲染冻结类缺陷不在数据层覆盖内（票 40 教训）。
- 允许「已知红」永久豁免——否决：无到期条件的豁免会让残红台账固化为债。

## Consequences

- 正面：「可发行」从口头判断变为可验证三值函数；tag 动作有了明确副作用边界（三条件齐备前不可执行）；残红获得治理台账面——每条红必须具名、有归属、有到期日。
- 负面/妥协：门禁是程序性（检查单 + 人工复核），不是流水线硬拦截——tag 与商店发布天然是人工动作，无法全自动强制；约束力靠报告落盘与大脑复核兜底。AMO 灰度必须引入 unlisted 自分发面，多一层托管与信任成本。
- 中性/约束：`@data-golden` 的 continue-on-error 必须在 2026-09-18 前摘除并绿，否则它自身成为 G-A 需豁免红项；此后任何发行票/启动器必须引用 WORKFLOW §4.4 检查单；新 ADR 若改数据格式，须对照本 ADR 的 Rollback 兼容义务。

## Review

- 复核日期: 2026-10-12
- 复核项: ① 豁免台账是否清零或全部在效续期；② 票 45 burn-in 是否已按期翻为阻断态且绿；③ 首个按本门禁执行的发行是否完成回滚演练并将检查单归档。
- 复核结论: （复核后回填）
