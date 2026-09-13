# 调研任务：发行门禁（Release Gate）下的「残红治理出口」工业成熟方案

## 背景（已发生的事实，不要重复推导）

一个浏览器扩展仓库（Chrome MV3 + Firefox，Playwright 扩展 e2e，GitHub Actions 三 OS matrix：ubuntu/macos/windows + 独立 data-golden job）。

- 目标：把一个长期存在「残红（residual red）」的 main 分支治理到可诚实声明「门禁绿」。
- 当前最新 main 全量 test.yml run：**4 个 job 全部 conclusion=success**，0 failed。但 Playwright 汇总里仍有 **flaky（首次失败、重试后通过）**：ubuntu 2 条（同一 spec 的 ff+ch）、windows 1 条、macos 1 条；每 OS 各 603/604 passed、5 skipped。
- 此前一轮定谳 run 曾 3 OS test 全红，分桶为：R1=三 OS 稳定失败（B 桶）、R2=单 OS 失败待分诊、R3=单 OS flaky（F 桶）。修绿票已全部落地。
- 仓库已有「G-A 残红书面豁免台账」（waiver ledger）机制：只允许 flaky/环境性失败入账；每条 5 字段（用例名 | 基线 run URL | 失败签名 | 归属票 | 到期）；硬到期不得续期；never-quarantine 家族（数据完整性/迁移往返/回滚演练）永不豁免；broken（全签名一致失败）不得豁免；发行前跑机器校验脚本。

## 需要你回答的问题（每问都要给「推荐 + 理由 + 来源」）

1. **一个 CI run 全部 job 绿、但内部存在若干「重试后才通过」的 flaky 测试时，业界是否允许把它声明为 release gate 的 green？** 给出主流做法（如 Google、Meta、Microsoft、GitLab、Datadog、Chromium 的政策或工程报告原话）。
2. **flaky vs broken 的工业分类阈值**：单次 run 内「首次失败+重试通过」是否足以判定 flaky？需要几次 run / 多长时间窗（如 Datadog 7 天口径、ICSE 2020 自动分类误判率）？
3. **quarantine / waiver 台账的成熟设计**：字段应包含什么？到期机制怎么设计（时间到期 vs 事件到期，如「下一条全绿 run」）？如何避免「台账变成坟场」（GitLab「a queue, not a graveyard」）？是否推荐「具名 F 出口（named-F exit）」这种把残余 flaky 明确命名、绑定归属票与到期日、而不是隐藏的做法？
4. **release gate 与 CI 绿的关系**：CI 绿是必要还是充分？工业上如何把「人工黄金路径/回滚演练」与「CI 绿」组成合取门禁（conjunctive gate）？
5. **退出一个「残红治理波」时，最容易被审计方质疑的过度声明（overclaim）有哪些？** 给出可落地的表述纪律。
6. **同一根因（测试装置 fire-and-forget 关闭引导遮罩导致的指针拦截竞态）横跨约 10 个 spec 时**，工业上推荐「抽公共 helper 统一治理」还是「逐 spec 修」？理由？

## 输出要求

- 中文；结构化（按上述 6 问分段）。
- 每条结论后附来源（标题 + 发布方 + 年份/URL 或可定位出处）。无法核验的不得写成事实。
- 最后给「对本仓库的具体建议」一节：明确 ① 本次是否可声明 G-A 绿；② 残余 flaky 应当入账还是修绿；③ 是否应另立票抽公共 helper。
- 明确列出你无法核验的缺口（信息缺口），不要编造证据。
