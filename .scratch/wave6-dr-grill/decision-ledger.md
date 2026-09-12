# Decision Ledger — Wave6 DR Grill

> 开始: 2026-09-12 · 规则: 用户每确认一条实质结论当场追加；压缩前必须核对本账本最新。

| ID | 原问题 | 用户原回答 | 规范化需求 | 显式约束/负向需求 | 状态 |
|---|---|---|---|---|---|
| D-011 | 容灾 M1 是否拆票 | A（拆两张） | 票 α：Time Machine 一键回滚 UI + 恢复/覆盖/导入前自动安全快照；票 β：导出 meta 信封+可选完整容灾包 + 同步/导入覆盖必先本地副本 + RPO/RTO 写入 ADR-0009/0017。两票可并行，分别复核 | 负向：不合并成一张大票；不把 RPO/RTO 塞进 UI 票 | current |
| D-010 | B15–B23 立票范围 | A（本轮全立） | 必立实施票：G-A 残红清零、G-B 人工黄金路径、容灾 M1（可拆回滚 UI+导出/安全快照）、urlOpenMode 默认 sameTab；一并立 B17 CSS 括号门禁、B20 data-golden 摘 burn-in；B18/19/21/22/23 亦立票但标 P2/backlog 不占本轮带宽；#9 更新评论并入门禁轨 | 负向：P2 不阻塞 G-A/G-B；B18 仍 deferred 实施（D-003） | current |
| D-009 | G-B 人工 zip 黄金路径归属 | A（你亲自执行） | 立 ready-for-human 票；我出 WORKFLOW §4.4 可勾选检查单 + 证据归档路径；用户在真 Chrome+Firefox 装发行 zip 解包产物并勾选；含升级 pre-update 快照与回滚演练；我复核证据后写回 #9 与 ADR-0017 | 负向：禁止用纯自动化宣称 G-B 完成；禁止无签字关闭 G-B | current |
| D-008 | G-A 残红治理：修绿优先 vs 豁免优先 | A（修绿优先+受控豁免兜底） | 立「CI 残红清零」P0 票逐项修；仅 flaky/环境性且签名匹配才可书面豁免；数据完整性/迁移/回滚类永不豁免；豁免硬到期收敛（到期未修→禁用或删除并记录）；发行前自动校验台账未过期且签名仍匹配；稳态=全绿 | 负向：禁止 waiver-first；禁止永久豁免；禁止 Skip 测试失明；禁止数据完整性类入台账 | current |
| D-007 | #9 事故票关闭条件 | A（跟 G-A/G-B 门禁绑定） | 先更新 #9 body 勾选现状与评论证据；仅当 G-A（残红清零或书面豁免）与 G-B（人工 zip 黄金路径）完成后才 close；关闭评论必须链到门禁证据 | 负向：不得在 G-A/G-B 完成前 close #9；不得只改标题不改勾选 | current |
| D-006 | 导出是否含快照/档案正文（atomcode 深调后拍板） | A（混合策略） | 默认导出=当前主布局+轻量 meta 信封（schemaVersion + snap/corrupt/conflict 索引，不含正文）；可选「完整容灾包」才打包正文并做体积预估与 5MB 处理；文件名 boxing-backup-YYYYMMDD.json；历史靠多次导出+WebDAV/Gist；RPO 语义写入 ADR-0009/0017 修订 | 负向：默认导出不得内嵌快照/档案正文；不得把完整包做成唯一导出路径 | current |
| D-005 | D-004 与 main 源码矛盾时，urlOpenMode 票验收口径 | A（以实机为准） | P1 票验收：新装或重置后点击书签 = 当前标签页导航。根因调查面强制覆盖：旧包/问题 zip、重置未清 boxingLayout settings、设置下拉首帧 DOM newTab（Bug3-a）、任何残留写 newTab 路径 | 不接受仅改下拉显示即关票；不接受用「存量显式 newTab 保留」解释新装行为 | current |
| D-004 | urlOpenMode「默认当前标签页」实机是 A 缺 UI / B 有项仍新标签 / C 默认仍新标签 / D 另事 | C | 新装或重置后默认仍是**新标签**，不是当前标签；属默认值/migrate 问题，不是「选项不存在」。需票：保证全新 profile 与重置路径 default 为 sameTab，并修任何仍写入 newTab 的首装/迁移/引导路径 | 负向：不接受「仅保留存量显式 newTab」被用来解释**新装**也是新标签；新装必须 sameTab | current |
| D-003 | 容灾验收边界 M0/M1/M2 到哪一档 | A（M1 产品化） | 本轮容灾票收口五项：①Time Machine 一键回滚 UI ②恢复/覆盖/导入前自动安全快照 ③导出含主布局+快照索引（或明确不含并 UI 提示，二选一待定）④同步/导入覆盖必先本地副本（代码级+测试）⑤RPO/RTO 写入 ADR-0009/0017 修订 | deferred：冲突解决 UI(B18)、OPFS 介质迁移、CRDT、导出加密；不扩 CRDT | current |
| D-002 | 红线绑什么动作？tag-only vs 禁止 land | A | 发行门禁红线只约束 **tag / 对外宣称可发行**；容灾与设置类功能票可与门禁票并行实施并 land main；G-A 残红清零或书面豁免、G-B 人工黄金路径、#9 状态更新为门禁轨 P0 | 禁止在三门禁齐备前 tag；禁止宣称可发行；#9 在 G-A/G-B 完成前只能更新、不得关闭 | current |
| D-001 | 本轮主目标：容灾拓展 / 门禁收口 / 票务卫生 / 澄清 urlOpenMode，四选一或全都要+P0序 | 所有内容通通包含，后面立多个票据 | 本轮 grill 覆盖全部四条轨道：①企业级容灾 M1/M2 缺口 ②发行门禁 G-A/G-B 收口 ③issue/票据卫生（#9 + B15–B23 等）④urlOpenMode「默认当前标签页」现象定谳；最终拆成**多张票据**交付，不合并为单一功能票 | grill 中不修源码；不自行宣布结束；一次一问；结论必须落盘；票在定稿后立，不在 grill 中边问边写代码 | current |

## 覆盖自评（随轮更新）

- 轨道: 4/4 已纳入 D-001
- 已确认决策: 11
- 待定: 用户是否确认定稿

## atomcode 调研笔记（2026-09-12 · 导出是否含快照）

> 串行一次；已回顾 D-001..D-005（current）+ ADR-0009 + CONTEXT Data Resilience + Wave5 快照/导出实物。

### 与 current 决策对照
| 账本 | 对照结论 |
|---|---|
| D-001..D-002 | 无冲突 |
| D-003 M1 五项 | 无冲突；调研细化③的「二选一」 |
| D-004/D-005 | 无冲突 |
| 我先前 Q6 推荐 A（默认导出含快照正文） | **与工业结论相左**——但该推荐**未获你确认**，未入账本，故不改 D-003 为 revised |

### 工业结论（要点）
1. Chrome/MDN：卸载即清 storage.local → 导出内容 = 重装可恢复性全部承诺
2. Notion / 1Password 1PUX / Evernote ENEX / Raindrop：导出=当前态；历史留在产品内或靠「多份按时备份」
3. PostgreSQL：pg_dump（当前）与 WAL/PITR（历史）分离，不揉进同一文件
4. Telegram 反例：历史即主数据时才全量导出——Boxing 快照是撤销/容错层，不是用户主数据
5. 3-2-1：离机副本须「干净、一致、可独立恢复」；默认塞入被裁剪的历史两头不靠

### 调研落地建议（已 D-006=A 拍板）
默认导出信封：`{layout, _exportedAt, meta:{schemaVersion, snapshots:[轻量索引], corrupt:[索引], conflicts:[索引]}}`（不含正文）
+ 可选「完整容灾包」开关才打包快照/档案正文（体积预估 + 校验/放宽 5MB）
+ 文件名 `boxing-backup-YYYYMMDD.json`；历史靠多次导出 + WebDAV/Gist

## atomcode 调研笔记（2026-09-12 · Q8 G-A 残红治理）

> 已回顾 D-001..D-007（current）+ ADR-0017 G-A 书面豁免规则 + main test.yml 实物。

### 与 current 决策对照
| 账本 | 对照结论 |
|---|---|
| D-002（G-A 清零或书面豁免） | **无冲突**；调研收窄「可豁免」范围，与 ADR-0017 不得永久豁免同向 |
| D-007（#9 绑 G-A/G-B） | 无冲突；调研强化「数据完整性类永不豁免」→ G-B 回滚演练相关红不可入台账 |
| 其余 D-001/003–006 | 无冲突 |

### 工业结论（要点）
1. **全绿是默认门槛**（Google/TBD green tree）；无「无条件放行残红」先例
2. **受控台账是过渡态**（Chromium TestExpectations / GitLab allow_failure / Trunk quarantine / Datadog）：字段=用例名+平台+归属+期望+到期+owner；禁 Skip 失明
3. **broken ≠ flaky**（Trunk）：真回归不得隔离/豁免；仅 flaky/环境性可入台账
4. **never-quarantine**：数据完整性、迁移往返、回滚演练类测试永不豁免——事故后尤其如此
5. **残红传染有实证**（Springer 2024 broken windows）；豁免必须硬到期收敛（SLA：Critical 48h / High 1w / Medium 2w）
6. **事故恢复序**：revert-to-green → 补数据完整性回归 → 逐条修台账 → 台账归零后才恢复正常发版节奏

### 对你方 WORKFLOW G-A 的补齐（待 D-008）
- 台账只放行签名匹配的 flaky/环境性失败
- 数据完整性/迁移/回滚类测试永不豁免
- 到期未修 → 禁用或删除并记录；发行前自动化校验台账未过期且签名仍匹配
- 稳态目标仍是全修绿；豁免只是带到期的过渡态
