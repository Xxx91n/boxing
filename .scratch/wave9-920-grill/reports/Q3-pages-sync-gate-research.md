# Q3 深度调研 — Pages 发行后严格同步门禁形态

> Generated 2026-09-15 · source: atomcode-research（Exa/Tavily/AnySearch + 定点全文）
> workspace: `.scratch/wave9-920-grill/`
> 约束: 不改源码；与 current 冲突须 revised 不得静默改向

## Executive summary

1. **三种形态回答三个不同问题**，不是同一问题的三档强度：200=「活着吗」；version 断言=「线上是哪个版本」；自动部署=「谁保证更新」[atomcode #1,#4]。
2. **仅 HTTP 200 无法发现「过时但 200」**——这是最大盲区；实战：绿色部署 ≠ 用户看到新构建 [4]；GitHub 社区多起「成功但站点未更新」[2][3]。
3. **Boxing 机制层已正确**：`demo-deploy.yml` release published → checkout **tag** → build-demo → upload-pages-artifact + deploy-pages（已规避 GITHUB_TOKEN push 不触发 Pages 的官方坑 [1] 与同 SHA 重复发布坑 [2]）。
4. **缺的是门禁侧断言**：G-C 仍定义为「三 URL 200 + HTTP 状态码记录」（ADR-0017 L24）；release-status 已预留「渲染版本 == v2026.9.15」但未机器化；仓库内 `version.json` 仅出现在 .codex-tmp 临时目录，**发行包/demo 构建是否稳定产出 version.json 待实施核验**。
5. **推荐 = 升级 G-C（B）+ 部署尾部自动 verify（C 的 verify 半步）**：200 + `GET demo/version.json?t=<ts>`（no-cache）version == 最新 release tag；部署 job 尾部 180s 级轮询；**保留** ADR-0017 人工检查单（不取消人工复核，符合「禁止无人复核自动发布」）。
6. **与 current 零 D 冲突**；对 **ADR-0017 G-C 证据形态**是**扩写**（在 D-001 授权下的计划内修订），实施票落地时须同步 revised ADR-0017 该行——**不是**静默改向。

## Background & scope

D-001 新增门禁：每次发行后 Pages 严格同步、保证不过时。Q3 在 A 纯流程 / B 新鲜度断言 / C 全自动部署 / D 另定 中选型。

## 本地现状（实物）

| 项 | 状态 |
|---|---|
| `demo-deploy.yml` | 存在；release 事件；checkout tag；artifact 部署；environment=github-pages |
| G-C 定义 ADR-0017 L24 | 三 URL live HTTP 200；证据=HTTP 状态码记录 |
| release-status L66 | 预留「渲染版本 == v2026.9.15」— **未填、非机器门禁** |
| B75 backlog | G-C demo version 抽查 — P1 未关 |
| version.json | 工作树无正式产出路径命中（仅 .codex-tmp）；workflow 输入支持 manual version，release 应用 tag |

## 工业界结论（atomcode 对比矩阵摘要）

| | 仅 200 | version 断言 | 自动部署 |
|---|---|---|---|
| 发现过时但 200 | **不能** | **能** | 不能（自身可静默败） |
| 成本 | 极低 | 低 | 中 |
| 失败案例 | 旧构建静默到达用户 [4] | CDN 缓存假阴性（需 cache-buster）[4] | 同 SHA 拒发 [2]；environment tag 拦截 [2]；Pages 后端故障 [3] |

**集成建议**（调研原文）：verify 放部署 job 尾部；G-C 检查方读 version.json 与 `gh release list` 最新 tag 比对；失败区分「不匹配=部署链路」vs「读不到=存活」。

**明确不做**：mike 多版本目录（单 demo 过度设计）；用流水线 verify **取消**人工检查单（违 ADR-0017 人工黄金路径）。

## 与 current 决策冲突审计

| 记录 | 内容 | 关系 |
|---|---|---|
| W9.20 D-001 | 新增 Pages 严格同步门禁 | **无冲突**；本调研即其形态 |
| ADR-0017 G-C | 三 URL 200 + 状态码记录 | **扩写而非推翻**：在 200 之上增加 version 相等；三门合取与人工 G-B 不变。实施时 ADR-0017 该行须显式 revised（保留原句 + 修订段） |
| ADR-0017 人工复核 | 禁止无人复核自动发布 | **遵守**：自动 verify 不替代检查单 |
| B75 | demo version 抽查 P1 | **吸收合并**进升级后 G-C，可关 |
| publishing-guide Part 5 | release 自动部署 Pages | **强化**：机制已有，补门禁 |

**无需将任何 D-xxx 标 revised。** ADR-0017 G-C 行的修订属实施期文档动作，将在 D-003 确认后写入实施票 AC。

## 推荐（待拍板）

**Q3 = B 为主 + 部署尾部 verify（吸收 C 的自动化半步）；不做全自动免人工。**

落地 AC 草案（定稿后立票）：

1. 确认 `build-demo.mjs` 稳定产出 `demo/version.json = {version, deployedAt}`（version=release tag / manifest）。
2. G-C 升格：三 URL 200 **且** `GET .../demo/version.json?<cache-buster>` 解析 version == 最新 release tag（发行检查单 + 可脚本化）。
3. `demo-deploy.yml` deploy job 尾部 verify step：轮询 ≤180s 至 version 收敛；不收敛失败红。
4. 一次性核查：github-pages environment 放行 tag 部署规则；Pages source 仅 Actions 单一模式。
5. ADR-0017 G-C 行 + release-status + publishing-guide 同步修订；B75 关闭并入。
6. 失败两态口径写入检查单：不匹配→重跑 demo-deploy / 查 environment；读不到→存活问题。

## Open questions

- Pages CDN 对 `Cache-Control` 的实际尊重程度未在本环境实测——落地后用真实探测验一次。
- 商店 listing 新鲜度（B76）不在本链路，另案。

## Sources（atomcode 清单节选）

[1] GitHub 官方 Pages publishing source — docs.github.com（GITHUB_TOKEN push 不触发 Pages build）
[2] community discussion #145042 — 同 SHA 重复发布「成功但不更新」；environment tag 规则
[3] community discussion #200823 — deploy-pages 后端故障；混用部署模式诱因
[4] Antigravity Lab 2026-07-14 — version.json 断言、cache-buster、事故对照
[5] mkdocs-material / mike — 多版本文档场景（Boxing 不采用）
[6] 本地 ADR-0017 / demo-deploy.yml / release-status / publishing-guide
