# 109 — G-C 升格：version.json 新鲜度 + deploy verify

> Covers **A-064** · 启动器 `prompts/109-pages-gc-version-verify.md` · 完成日期 2026-09-15
> 上游：D-001（新增 Pages 同步门禁）/ D-003（B 形态 + 部署尾部 verify）/ B75 并入 · 门禁定义 ADR-0017

## 一、通用调研（handoff 要求三项，逐项完成）

### 1. atomcode 深度调研（串行单发）

- 工具：本地 `atomcode-research` skill（Exa + Tavily + AnySearch，read-only gate）。问题 = “对比静态站点（如 GitHub Pages）部署后验证线上产物新鲜度的工业成熟方案，并给出相应的测试策略”。
- **结论 1（高置信，两独立信源）**：`/version.json` 标记文件 + 部署后轮询 gate 是「部署绿了但用户看到旧版」的工业标准解。四个月实测运营数据：旧版到达用户 1–2 次/月 → 0；平均发现时间 ~5 小时（客服反馈）→ ~3 分钟（gate 失败即知）；95% 健康发布 40s 内收敛，故预算取 180s —— 与 D-003 已定的 180s 一致。
- **结论 2（高置信）**：探针自身必须绕缓存（查询串 + `no-cache` 头），否则 origin 已更新而检查仍拿旧值 = 假阴性；web.dev 官方缓存分层要求非版本化 URL（HTML/标记文件）走 `no-cache` + ETag。
- **结论 3（多信源）**：GitHub Pages 固定 `max-age=600` 且**不可配置**（社区讨论 #11884），且会缓存 404 约 1 小时 —— 该平台正是此门禁最刚需的场景。
- **结论 4**：原子部署平台（Netlify/Vercel）把问题形态从「缓存不收敛」变为「版本 skew」；GitHub Pages 无此能力，只能靠探针。
- **测试策略（分层）**：① 构建期契约断言（写 version.json 并回读）→ ② 部署后 smoke（轮询版本标记 + 关键路由 200；失败记录「是否收敛 / 最终值 / 耗时」）→ ③ 生产低频 e2e → ④ 持续监控。本票落地 ① 与 ② 的可离线回归部分。
- 与既有 Q3 调研（`.scratch/wave9-920-grill/reports/Q3-pages-sync-gate-research.md`）同向，**无冲突**。

### 2. docs/adr + docs/CONTEXT.md 心智模型回顾

| 现有心智模型 | 关系 | 处置 |
|---|---|---|
| ADR-0017 G-C 行（三 URL 200） | **扩写，非推翻** | 保留原句 + 新增「修订 2026-09-15」段（非静默改向） |
| ADR-0017 禁止无人复核自动发布 | 遵守 | 自动 verify 为**追加**探针，人工检查单保留 |
| docs/CONTEXT.md L181（G-C upgraded … deploy-tail verify） | 一致 | 无需改动 |
| D-001..D-008 | 无冲突 | 无需标 revised（与 Q3 结论一致） |

### 3. 工业对标（实现 / 测试）

- 实现采用 **A（version.json 标记文件）+ B（HTML 标记）双探针**：任一侧被缓存污染时另一侧仍可判定；不做 mike 多版本目录，不取消人工复核。
- 测试采用分层 ①+② 的**离线**部分（构建期契约断言 + 门禁纯逻辑自测 + 流水线接线静态断言），网络断言留给发行时人工 / 流水线执行 —— 避免把外网依赖引入常规测试 lane。

## 二、实测锚点（本窗口，2026-09-15）

| 项 | 值 |
|---|---|
| 最新 release tag | `v2026.9.15`（`gh api repos/Xxx91n/boxing/releases/latest`） |
| 线上三 URL | `demo/` 200 · `demo/ntp.css` 200 · `privacy-policy.html` 200 |
| 线上 `version.json?_=<cache-buster>` | `version=2026.9.12`，`deployedAt` 缺失（旧产物） |
| 门禁判定 | `node scripts/pages-gc-verify.mjs` → **exit 1 · MISMATCH** |
| 意义 | **旧口径（仅 200）判「达成」的同一时刻，Pages 停在两个版本之前** —— A-064 盲区实证 |
| 根因 | release 触发 run [34860199679](https://github.com/Xxx91n/boxing/actions/runs/34860199679)：deploy job **0 step、2 秒内失败** → `github-pages` environment 未放行 tag 引用；dispatch（main，run 34741247614）成功 |
| Pages 构建源 | `build_type: workflow` = GitHub Actions **单一模式** ✔ |
| 本地构建契约 | `RELEASE_TAG=v2026.9.20` → `version.json={version:2026.9.20, deployedAt:2026-09-15T08:13:40.410Z, source:release, builtAt:…}`；manifest 回退路径 → `2026.9.15` |
| demo 渲染 | 横幅 `data-boxing-version="2026.9.20" > v2026.9.20` + `meta[name=boxing-version]`（B75 机器化） |
| 门禁自测 | `node scripts/pages-gc-verify.mjs --mode=self-test` → **13 checks passed** |
| 新增 spec | `npx playwright test … boxing-pages-gc-version.spec.ts` → **4 passed (2.6s)** |

## 三、AC 对照

| AC | 状态 | 证据 |
|---|---|---|
| build-demo 稳定产出 `version.json={version,deployedAt}` | **达成** | `.github/scripts/build-demo.mjs`：写 `{version, deployedAt, source, builtAt}` + 产出后回读 fail-closed + 版本归一化（tag `v2026.9.20` → `2026.9.20`）；本地两次实跑见上 |
| G-C = 三 URL 200 且 version == 最新 release tag（cache-buster） | **达成** | `scripts/pages-gc-verify.mjs --mode=gate`（默认取最新 release tag；探针带 `?_=<ts>` + `no-cache`）；线上实跑 exit 1 MISMATCH |
| demo-deploy.yml deploy 尾部 verify ≤180s | **达成** | deploy job 新增 `Verify Pages freshness (deploy tail, <=180s)`：`--mode=deploy-tail --timeout=180`，`timeout-minutes: 5`；位于 Deploy 步骤**之后** |
| ADR-0017 G-C 行 + publishing-guide + release-status 显式修订 | **达成** | 见 §四；均为「保留原句/原结论 + 追加修订段」，未静默改向、未回溯改判已发布的 9.15 |
| 吸收关闭 B75 | **达成** | `W915-postrelease-backlog.md` B75 行标已关闭；B75 的「demo 渲染 version」由 `data-boxing-version` + `meta boxing-version` 机器化 |
| 核查 environment 放行 tag、Pages 仅 Actions | **核查达成 / 放行需人工** | Pages 构建源 = Actions 单一 ✔；`github-pages` environment **未放行 tag** ✘ → 已写入 ADR-0017 修订段、publishing-guide、release-status；放行动作属仓库设置变更，**不在 agent 范围，需用户另令** |

## 四、改动文件

| 文件 | 改动 |
|---|---|
| `.github/scripts/build-demo.mjs` | version.json 增加 `deployedAt`；版本归一化；空版本 fail-closed；产出后回读校验；demo 渲染版本（HTML 第二探针）；构建摘要输出 `deployedAt` |
| `scripts/pages-gc-verify.mjs`（新增） | G-C 门禁 / deploy-tail 轮询 / 离线 self-test 三模式；零依赖；失败两态 MISMATCH / UNREACHABLE |
| `.github/workflows/demo-deploy.yml` | build job 输出 `version`；deploy job 尾部 ≤180s verify（checkout + setup-node + 判定） |
| `package.json` | 新增 `verify:pages-gc` |
| `test/tests/boxing-pages-gc-version.spec.ts`（新增） | 4 项离线断言：门禁自测、构建契约、渲染版本、流水线接线与顺序 |
| `docs/adr/0017-release-data-gate.md` | G-C 行标注修订；新增「修订 2026-09-15（票 109 · A-064）」段（定义 / 机制 / 失败两态 / 环境核查） |
| `.scratch/architecture-recovery/WORKFLOW.md` §4.4 | G-C 定义升格 + 检查单 G-C 段补三行（版本断言、渲染一致、失败两态） |
| `docs/publishing-guide.md` Part 5 | 新增 G-C 升格小节；运维备注验收口径由「200」改为「版本断言」；记录 environment 阻塞 |
| `docs/release-status.md` §三 | G-C 行标注旧口径；新增「G-C 2026-09-15 实测（升格口径）」；F-113-01 补根因 |
| `.scratch/architecture-recovery/reports/W915-postrelease-backlog.md` | B75 关闭并入本票 |
| `.scratch/architecture-recovery/decision-ledger.md` | A-064 → implemented |
| `.scratch/architecture-recovery/issues/109-pages-gc-version-verify.md` | AC 勾选 |

## 五、完成定义与残留风险

- **未**宣称三门合取达成（G-A/G-B 不属本票）；**未**代签 G-B；**未** push / tag / force-push；**未**热修 2026.9.15；提交在 `a1acaaac` 之上线性追加（A-P01）。
- 版本控制按 WORKFLOW §4.2（GitButler `but`，独立 branch，不 push 不开 PR）。
- **残留风险 1（预期红，非 flaky）**：environment 未放行 tag 之前，release 触发的 Pages 同步**不会**发生，G-C 新口径将持续判 MISMATCH。这是门禁开始生效的证据，不是门禁失效。
- **残留风险 2（预算张力）**：atomcode 建议 Pages 场景预算 15–30 分钟（CDN 传播 + `max-age=600` 不可配），本票按 D-003 取 180s。若后续出现「稍后即收敛」的误红，应回来调预算并记账，不得把红直接改绿。
- **残留风险 3（人工依赖）**：放行 `github-pages` environment 的 `v*` tag 需用户在 Settings 执行（或 `POST /repos/Xxx91n/boxing/environments/github-pages/deployment_branch_policies`，需管理员权限）。本窗口只核查、不代改。
- **边界声明**：release-status 的「单一状态块」收敛属 A-068 / 票 114，本票仅在 §三 内追加日期化修订，未改写 §一 投影与其他块。
