# Research Report Round 6 — Ticket 28: 归并治理与 CI 修复心智模型深度调研

- 生成: 2026-09-05
- 票: `.scratch/architecture-recovery/issues/28-release-merge-governance-research.md` (ready-for-agent → 本报告交付后闭环)
- 窗口: Boxing architecture-recovery 子窗口 (票 28)
- 纪律: 只读票 — 本轮未改源码 / manifest / 测试 / 产品文档; 全程**仅一次串行 atomcode 调研** (无并行, 无第二次); 版本控制遵循 WORKFLOW §4.2 (GitButler 独立分支, 不 push)。
- 调研证据: atomcode 单次 run (session `f73fbeaa-fba6-4a12-a0a7-df8be579f44c`, 问题按票 28 delta 原样发送): 15 次引擎搜索 (Exa×7 + Tavily×4 + AnySearch×4, 覆盖 Official/Comparative/Criticism/Currency/Community 五角度) + 18 个原文核验 (17 web_fetch + 1 个 Chromium 页面浏览器只读打开; 1 个抓取失败按未读弃用) + 17 个独立域名 + 本地沙箱摸底 (模块图/守卫/cluster-map/git 拓扑)。18 条来源见 §6。
- 载体备注: 本窗口无 ctx 工具, 按启动器指示以 node.js 载体 (`node.exe` 直拉 `@atomgit.com/atomcode/bin/atomcode.js`, args 数组零引号层) 后台串行执行; stdout 即唯一成果通道。

## 0. 执行摘要 (Tl;dr)

对 Boxing 这类 **MV3 + 零 npm 依赖 + 原生 ESM 直载 + Chrome/Firefox 双浏览器** 的扩展, 工业 2026 成熟心智模型是三个正交契约:

1. **模块边界 = 编译期可校验的显式依赖图** (入口组合根 + 叶子禁入 + 守卫规则), 而非"靠自觉分层" — Boxing 的 `import-graph-guard.mjs` (B-1..B-9) 已是该心智的完整落地, 方向正确 (置信: 高)。
2. **测试选择 = 保守变更面选择 + 全量保底** (微软 Test Impact Analysis 的"无法推理就全量回退"心智), 且 TIA 永不独当门禁 — merge-to-main 与夜间必须全量; Boxing 的 `test-surface.mjs` 保守规则与 Azure TIA 同构 (置信: 高, 官方文档 + 厂商实现双印证)。
3. **分支归并 = "栈式 PR 是开发方法、merge queue 是集成方法", 两者正交** — GitButler Butler Flow (虚拟分支挂 target=main、集成即自动清理) 与本仓 .scratch 工作流同族; 本次 Round 5 汇流是"单人 + agent + 一次性汇流"形态, 用 per-ticket merge commit 串行落地即可, **不要引入 merge queue** (CI 双跑 + 小团队边际收益小, 置信: 中-高)。

Lockfile 修复主题: 单次调研的问题原文 (按 delta 不得改写) 未含 lockfile 角度, atomcode 返回亦无 lockfile 专项外部来源 — 本报告的 lockfile 推荐模板以**本地实证 + spec 既有裁决**锚定 (见 §4.2 与 §7 缺口声明), 不虚构外部证据。

## 1. 本地现状基线 (先记录, 后对比)

### 1.1 三大治理对象现状 (round6-architecture-report 证据快照 + 本地实测)

| 对象 | 现状 |
|---|---|
| 分支归并 | `origin/main` 停在 Round 4 收口 commit `26a5182`; Round 5 栈顶 `bc-branch-5` 领先 10 commits, 只以分支形式推送 (origin/gitlab/codeberg 三镜像); 本地 `main` `ahead 6, behind 55` (发散陈旧分支, 非汇入目标, 票 33 处置); `bc-branch-1`/本地 main/`ticket-16`/`ticket-17` 有本地 commit 无对应远端分支; Round 4 历史已是 per-ticket merge commit 汇流形态 |
| Lockfile | `npm ci --dry-run --ignore-scripts` 报 `EUSAGE`: lockfile 缺 `crx3@1.1.3` 与六个传递依赖; lockfile 根版本 `3.7.0` 而 `package.json` 为 `2026.8.21` — CI 无法干净安装; 零运行时依赖不变 (devDeps: web-ext / @playwright/test / crx3) |
| Flaky 测试 | 3 个 `boxing-state-sync` 多标签失败未分类 (应用缺陷 vs 宿主环境); quarantine 车道既有治理: firefox 项目 grepInvert `@quarantine`、chromium 全绿基线 (票 14/27); 票 25 已落地 test-mutex (exit 75 拒绝第二并发) + `test:changed` 默认路径 + 保守全量回退 |

### 1.2 三个既有心智模型 (本票对账对象, issue 勾选第 3 项)

- **facade 模块模型**: 14 个原生 ESM 模块; `ntp.js` (994L) 唯一入口/组合根, 静态 import 全部模块, 0 dynamic import; 守卫 B-1..B-9 (入口禁被引/禁环/禁 barrel/禁 storage·browser API 直连/B-7 强制 `initXxxFacade` 注入/B-9 特征层兄弟边白名单 = ADR-0016 errata-26); ADR-0016 四层 (port/envelope/engine/presentation)。
- **changed-surface 测试模型**: `test-surface.mjs` 文件级 spec-cluster 映射 (15 簇, `minimumFullSuiteSpecs=18`), 保守回退全量 (test//.github//package*.json 变更、映射缺失、未映射叶子、闭包超阈一律全量), 拒绝 `--last-failed` 做选择; 进程级 test-mutex 包裹。
- **GitButler 工作流**: WORKFLOW §4.2 = 唯一版本控制权威 (but CLI 提交、每票独立分支、不 push 不开 PR 除非用户明确要求); 宿主 AGENTS.md gitbutler 节 + CRX-R-013/014/015 (禁止 reset --hard / checkout -- 丢弃用户改动)。

## 2. 对比矩阵 (atomcode 调研原文浓缩; 来源见 §6)

### 矩阵 A | 模块化与边界策略 (Boxing NTP 语境)

| 策略 | 边界可校验性 | 生产加载开销 | MV3 SW 兼容 | 调试/可读性 | npm 依赖成本 | 大规模伸缩 (>200 模块) |
|---|---|---|---|---|---|---|
| **A1 原生 ESM 直载零构建 (Boxing 现状)** | 高: 静态 import 可被守卫全量枚举 [本地] | 低~中 (同源静态图, 无 CDN 往返) | 不适用 SW 主战场 (SW 禁 `import()`, 见结论①); NTP 窗口上下文无限制 | 最高: 所见即所跑 [S14] | 零 | 社区实测几百模块以下无瓶颈 [S14][S12] |
| A2 ESM + import map | 中 (specifier 被间接化) | 同 A1 | import maps 不能用于 SW [S2] | 高 | 零 | 同 A1 |
| A3 开发 ESM 直载 + 生产 bundle | 高 (源码同一 ESM 图) | 最优 | 产物可喂 `type:"module"` SW | 开发高/生产低 | 中 (+1 构建依赖) | 高: 业界终局 [S12] |
| A4 全量打包 (Vite/Webpack) | 中 (边界被编译器隐藏) | 最优 | 原生支持 | 低 | 高 | 高 |
| **A5 规则守卫 + 单一入口组合根 (A1 强化 = 推荐基线)** | **最高** (B-1..B-9 全覆盖) [本地] | 同 A1 | 与 background 单文件共存 | 最高 | 零 | 到阈值前无限; 阈值后切 A3 |

### 矩阵 B | 测试选择与执行治理 (33+ E2E spec 语境)

| 策略 | 反馈时长 | 漏检/安全回退 | 零依赖可实现 | 业界对应物 |
|---|---|---|---|---|
| **B0 全量回归 (`npm test` 基线)** | ~4 分钟级 [本地] | 无漏检 | ✅ | CI 兜底层 |
| **B1 文件级簇映射 + 保守回退 (Boxing 现状)** | 中 | 强: 无法推理即全量, 绝不静默跳过 [本地] | ✅ | Azure TIA safe fallback [S5]; Datadog TIA [S10] |
| B2 静态 import 图传播选择 (反向可达闭包 → 簇并集) | 更准 (改 state.js 自动波及全部上游) | 强 (闭包保守) | ✅ 可复用守卫已有图 | Nx/Turbo affected 图; Bazel [S10] |
| B3 覆盖型 TIA (工具自动记录 测试→代码) | 最快 | 中 (依赖覆盖率质量) | ❌ 需 instrumentation | pytest-testmon; Azure TIA 托管 [S5][S10] |
| B4 Playwright 分片全量 (`--shard=x/y`) | 全量墙钟÷N | 无漏检 | ✅ | Playwright 官方 CI 模式 [S4] |
| **B5 quarantine 隔离通道** | 阻塞面消除 | 必须配 cap(~1%)+expiry, 否则变"藏 bug" [S10] | ✅ | 行业 2026 标配 [S10]; 本仓票 18/27 "到期修复不退役"同构 |

**推荐组合**: B1 (现状) 之上叠加 B0 作为 merge-to-main/夜间保底; B2 为零新依赖的下一步演进 (L1, 见 §4.3); quarantine 沿用 B5。B3 (覆盖型 TIA) 因零依赖约束 + E2E 黑盒归因噪声判为 over-engineering, 不引入 — 与票 19/23 过工程反模式清单一致 [本地]。

### 矩阵 C | Git 多分支归并主分支策略

| 策略 | main 历史形态 | 冲突成本 | 防 merge skew | CI 成本 | GitButler/agent 契合 | 规模适用 |
|---|---|---|---|---|---|---|
| **C1 直接 merge commit (Round 4 现状形态)** | 网状但每票可审计可回滚 | 中 (汇入点一次解决) | 无自动防 (靠串行纪律) | 1× | 高 (集成后虚拟分支自动清理 [S18]) | 单人/agent + 分支 <10 最优 |
| C2 squash merge | 线性 | 低 | 无 | 1× | 高 | 中团队 |
| C3 rebase + fast-forward | 完全线性 | 中 (改写侧冲突) | 无 | 1× | 高 | 强调线性团队 (**与本仓 CRX-R-015 "不改写历史"张力最大**) |
| C4 栈式分支 + 整栈原子落地 (GitHub Stacked PRs preview / GitButler 0.22 原生) [S7][S9] | 依赖有序多小 PR | 低 | 整栈原子合并 | 可批处理省 CI [S6] | 极高 (`but pr` 建栈) [S7] | 大特性拆小、agent 驱动 |
| C5 merge queue / merge train [S6][S15] | 自动 rebase 线性 main | 最低 (queue 建临时分支 hot-merge) | **最强** | **2×** (分支 CI + merge_group 双跑) | 中 | 高频多作者 monorepo; **小团队边际收益小** [S6] |
| **C6 trunk 短分支高频集成 (Butler Flow / GitHub Flow 变体)** | 干净 | 最低 (早集成冲突早现) [S18] | 依赖 C5 或纪律 | 1× | 极高 | **与本仓单人+agent 形态最契合** |

**推荐**: **C6 为形态 + C1 为汇入动作** (与 Round 4 历史同构、不重写历史 — CRX-R-015); 将来出现"多并发分支反复把 main 打红"再升 C5 (届时用 GitHub native, 勿为此引第三方)。

## 3. 分点结论 (关键结论 + 双源交叉验证)

1. **MV3 模块边界铁律**: background SW 只支持静态 import; `import()` 与 import maps 在 SW 内被禁, 至 2026-09 未松动 — Chrome 官方明文 [S1][S2]; W3C webextensions #212 至今 Open [S3]; Chromium issue 40760920 (P2, 2026-09 读取仍无状态更新) [S17]。**推论: 模块化主战场在窗口上下文 (NTP 正是), background.js 保持单文件是约束而非妥协。**
2. **Firefox 无 MV3 service worker**: 官方跨浏览器答案是 `scripts` + `service_worker` 双声明同文件 (Firefox 走事件页, Chrome 121+ 忽略 scripts) [S16] — 与本仓 manifest-contract (BX-MANIFEST 双声明) 完全同构 [本地]。
3. **裸 ESM 零构建在窗口上下文工业可行, 但存在规模阈值分歧**: Bryan Braun ~60 模块生产裸 ESM 一年实证 "几百模块以下没问题" [S14]; 反方 Vite 官方称 unbundled ESM 生产低效 (嵌套 import 网络往返) [S12]。**分歧本质是规模与加载通道**: Boxing 14 个顶层模块、全在 `chrome-extension://` 同源包内无网络往返, 远低于阈值 — 维持 A1/A5 理性, 但应设"切生产 bundle"的显式触发条件 (§4.4) 而非等性能崩了再救。两源利益立场相反, 均如实记录。
4. **浏览器裸 ESM 平台级约束**: import 路径必须全路径带扩展名、资源用 `new URL(..., import.meta.url)` 定位 [S13] — Boxing 强制 `./x.js` 全路径是平台要求而非风格。
5. **测试选择工业心智 = "保守变更面选择 + 全量保底"**: Azure TIA 三要素 + Safe fallback (无法推理的文件 → 全量) + 自定义依赖映射可扩到 JS [S5]; Boxing `test-surface.mjs` 保守规则与之同构 [本地] — 三源交叉 (微软官方 + 行业指南 [S10] + 本地实现)。
6. **天真版"只跑改动测试文件"是已知陷阱**: Playwright #40691 明示 `--only-changed` 只覆盖被改的测试文件, "改共享逻辑而没改测试文件时仍依赖回归测试" [S11] — 这正是需要 生产代码→测试 映射 (cluster-map.json) 的原因。
7. **TIA 永不独当门禁**: "TIA 只改变 PR 上跑哪些测试, 不改变哪些测试存在; 覆盖率靠 merge-to-main 与夜间全量保住" [S10]; Azure 同样建议周期全量校准 [S5]。**推论: 票 32 汇入 main 的动作必须显式绑定全量跑 (B0)。**
8. **分片是 E2E 全量提速的官方通道**: `--shard=x/y`、fullyParallel 时按测试级均衡、blob reporter + merge-reports [S4]。Boxing 全量尚在单机舒适区; 全量 >10 分钟再按官方矩阵 2–4 shard 起步。
9. **归并概念正交**: merge queue/merge train 是集成方法, stacked PRs 是开发方法, 可组合可独立 [S8]; Graphite 三阵营对比: GitHub native 免配置但 CI 双跑、小团队边际收益小 [S6]; Rush 给出 hot-merge 三档严格论证 [S15]。**推论: 本次一次性汇流上 merge queue 是负收益 (双跑 CI 而无人排队)。**
10. **2026 时效**: GitHub Stacked PRs 进入 public preview、Trunk 支持整栈原子落地 [S9]; GitButler 0.22 原生 `but pr` 建栈 + `but land` (本地合并直推 target) + merged-history guardrails [S7]; Butler Flow 六原则 (target=生产代码、一切工作在分支、近合分支本地 apply 集成测试、**集成即自动移出上下文**) [S18]。**推论: 本仓 .scratch 工作流形态上就是 Butler Flow; 票 32 落点保留 per-ticket merge commit, 不 rebase 重写。**
11. **本地实证差距**: 沙箱实测模块图与守卫覆盖确认 Boxing 是"单一组合根 + facade 注入"的教科书式边界; 唯一缺口是缺"何时切生产 bundle"的显式阈值规则 (§4.4)。

## 4. 推荐模板 (三治理主题各一 + 模块边界附带)

### 4.1 模板一: 分支归并主分支 (票 32 执行; 心智模型 = C6 形态 × C1 动作 × Butler Flow)

> 本模板按 WORKFLOW §4.2 以 GitButler 操作表述 (atomcode 原始模板的 raw-git 步骤已翻译; 概念对应: fetch→拉取 target, rebase 分支→栈上重放/解决冲突, merge --no-ff→集成动作, push→推送 target, branch -d→集成后自动清理)。

```
前提: Round 5 栈顶 (bc-branch-5, 领先 origin/main 10 commits) 为汇入对象;
     本地发散 main 不作目标、不 force-push (spec.md 裁决, 票 33 处置)。

步骤 (严格串行, 全部验证通过再汇入):
  1. 更新 target: but pull                          # 拉取并应用 target 最新 (冲突走 but resolve, 最旧优先)
  2. 逐分支验证: npm run test:changed               # 票 25 语义: mutex 单进程 + import-graph-guard pretest
                                                    # config/test/manifest 类改动自动回退全量 [本地]
  3. 汇入动作: 集成 = merge commit (与 Round 4 per-ticket merge 同构, 可审计可回滚);
     GitButler 0.22 等价操作 = but land <branch> (本地合并 + 直推 target) [S7];
     **推送 / PR 动作需用户明确授权** (WORKFLOW §4.2: 不 push 不开 PR 除非用户明确要求) —
     票 32 启动器须显式携带该授权, 否则止步于本地集成。
  4. 汇入点验证: 全量 npm test (结论⑦: TIA 永不独当门禁, merge-to-main 必须全量 [S5][S10]);
     本仓适配: 构建与测试按 CI-only mandate 走 CI 云端, 测试证据只认 CI run/artifact。
  5. 镜像同步: origin → gitlab → codeberg 三镜像同步 (票 32 completion 定义)。
  6. 清理: 已集成虚拟分支由 GitButler 自动移出上下文 (Butler Flow 原则 6 [S18]);
     stale 分支处置表归票 33, 不擅自删除。
决策但书: 不为本次汇流引入 merge queue (C5) — 单人+agent、无并发排队, 双跑 CI 纯负收益 [S6][S15];
     它是"未来多作者高频合并、main 反复红"时的升级位, 届时用 GitHub native。
未来形态: 大特性拆 3-5 个有序小分支, but pr 建栈整栈评审 (GitButler 0.22 原生 [S7]) —
     与本仓每票一小步的 .scratch 工作流天然吻合; Stacked PR 生态尚在预览期 (§7 缺口 6), 不押关键流程。
```

### 4.2 模板二: Lockfile 修复 (票 29 执行; 证据锚定: 本地实证 + spec 既有裁决)

> **诚实声明**: 票 28 delta 要求调研问题原样发送, 问题原文未含 lockfile 角度; 本轮 atomcode 返回无 lockfile 专项外部来源。本模板因此锚定 (a) 本地实证 (round6-architecture-report 证据快照), (b) spec.md 既有裁决, (c) npm 平台文档级常识 (下文标注, 未经本轮 atomcode 源核验)。不虚构外部引用或基准数据。

```
证据 (本地实证): npm ci --dry-run --ignore-scripts 报 EUSAGE — lockfile 缺 crx3@1.1.3
  与六个传递依赖; lockfile 根版本 3.7.0 vs package.json 2026.8.21 (calver 漂移)。

步骤:
  1. 从当前 package 元数据再生 lockfile (spec.md 裁决: "regenerated from the current
     package metadata"); 不新增 package.json 依赖 (spec Out of Scope: 无修复 lockfile
     以外的新依赖)。
  2. 验证门禁 (spec.md 测试裁决): npm ci --dry-run --ignore-scripts 必须绿 —
     npm ci 的平台契约是 lockfile 与 package.json 不同步即失败、严格按 lockfile 安装
     【平台文档常识, 未经本轮 atomcode 源核验】。
  3. **本仓 CI-only mandate 适配 (2026-09-04 用户令)**: 本机禁止一切构建/测试运行,
     npm ci 干跑验证由票 29 的 CI 验证分支在 GitHub Actions 三 OS 矩阵执行;
     测试证据只认 CI run/artifact, 不认本地输出。本地只做 lockfile 文件再生与提交。
  4. CI 既有 npm ci 步骤本身就是长期的 lockfile 同步门禁: 任何漂移都会让 CI 安装红 —
     与 spec 用户故事 2 ("clean install 在 CI 成功, 每个矩阵 runner 从同一确定性依赖集启动") 对齐。
  5. 提交: but commit 独立分支 (lockfile 单独 commit, 与 Round 5 栈顶 stack 后提交 —
     WORKFLOW §4.2 + 票 10 教训: 依赖前票文件先 stack 再提交)。
验收: 三 OS 矩阵 npm ci 全绿 (CI 证据) + lockfile 根版本与 package.json 一致 + 零新依赖。
```

### 4.3 模板三: Flaky 测试处置 (票 31 执行; 心智模型 = 分类先行 × quarantine 状态机 × TIA 非唯一门禁)

```
1. 分类先行 (spec.md: "classified from logs, reproduced in isolation"):
   用 DEBUG=pw:api 时间线定位 (launch 时长 / commit 是否 fired) 判 test-vs-environment —
   本仓票 13 已固化该判别协议 ("判断 test-vs-environment 必须用 log 定位, 不许按现象幻觉推理");
   隔离复现 = 单 spec 重跑 + --last-failed 批跑收敛 + 残余 solo 终验 (票 15 实操路径);
   宿主资源症状先查 workers 饿死 (票 01 教训: 本地 8 核默认 workers 饿死 8 headed 浏览器)。
2. 修复优先, quarantine 为显式登记而非藏匿 [S10]:
   quarantine 必须带 (a) 到期日 (repair-by expiry, 本仓票 18/27 已有 "到期修复不退役" 规则),
   (b) 失败签名 + 分类结论, (c) 状态机 healthy→quarantined→fixed [S10];
   补充 cap: quarantined 比例 >~1% 视为债务告警 [S10] (本仓现状 19 分之 5 ≈ 26% 历史峰值,
   已收敛至 chromium 19/19 全绿 — cap 用于防再次膨胀)。
3. 多标签 state-sync 专项: 3 个失败逐个走第 1 步分类; 属应用缺陷 → 修复;
   属环境时序 → 修复 (预算/等待策略) 或显式 quarantine + expiry 登记 (README 治理表同步,
   票 27 基线行随更新)。
4. 门禁关系: quarantine 车道保持非阻塞独立巡逻 (独立 workflow, continue-on-error, 票 14 形态);
   汇入 main 的全量门禁不含 quarantine 项, 但 merge-to-main 全量本身不可豁免 (结论⑦)。
验收 (spec.md): focused repeat of the state-sync lane + documented classification report;
   修复或 quarantine+expiry 二选一, 不留未分类项。
```

### 4.4 附带: 模块边界契约 (回答调研问题第一主题; 供未来 ADR/守卫增强, 非本票实施)

- **维持 A1/A5 现状**: 单一组合根 + facade 注入 + B-1..B-9 机检 = 外部印证的正确形态, 不重构。
- **background 铁律**: background.js 永不 `import()` (SW 禁用 [S1][S2][S3][S17]); 保持 Firefox 双声明契约 [S16]。
- **生产 bundle 触发条款** (补足结论⑪的唯一缺口, 建议未来以 ADR 或守卫注释固化): 源码保持 ESM 不变, 当 (a) ntp/ 模块总量 >150–200 [S14 阈值], 或 (b) NTP 首屏出现可测加载回归 (需先补基线采样, §7 缺口 3), 或 (c) 未来批准非 ESM 依赖 — 任一触发再立项 esbuild 生产期打包; bundle 不得破坏 import-graph-guard 的源码级校验 (守卫读源不读 dist)。

## 5. 与既有模型的对账 (issue 勾选第 3 项)

| 既有模型 | 对账结论 | 增量 (仅此, 不重写) |
|---|---|---|
| **facade 模块模型** (14 模块 + B-1..B-9 + ADR-0016) | 外部证据直接印证为教科书式"单一组合根 + 可校验依赖图" (结论⑪); A3/A4 全量打包对当前规模是过度设计; import map (A2) 因守卫可校验性下降且不适用 SW 而排除 | 仅补"生产 bundle 触发条款" (§4.4), 零代码改动 |
| **changed-surface 测试模型** (test-surface + mutex + cluster-map) | 与 Azure TIA safe fallback 同构 (结论⑤); Playwright #40691 证明纯"改动测试文件"选择不足, 代码→测试映射是必需 — 本仓 cluster-map 已是正确形态 | L1 演进 (可选, 零新依赖): 复用守卫已解析 edges 做反向可达闭包选择, cluster-map 退化为兜底; 硬性增量 = merge-to-main 动作显式绑定全量 (§4.1 步骤 4) |
| **GitButler 工作流** (WORKFLOW §4.2 唯一权威) | Butler Flow 与本仓 .scratch 工作流同族 (target 分支 + 虚拟分支 + 集成自动清理) [S18]; GitButler 0.22 的 `but land`/`but pr` 为票 32 的汇入/建栈提供原生操作 [S7] | atomcode 原始模板含 raw-git 步骤 — 本报告已翻译为 but 操作 (§4.1); 推送/PR 需用户明确授权; stale 分支处置归票 33, 不 force-push (CRX-R-015) |

## 6. 来源清单 (atomcode 单次 run 真实打开并核验, 18 URL + 本地证据)

| # | 来源 / URL | 域名 | 角度 | 贡献 |
|---|---|---|---|---|
| S1 | Extension service worker basics — developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics | developer.chrome.com | 官方 | MV3 SW 仅静态 import、`import()` 禁用、`type:"module"` |
| S2 | ES modules in service workers (Jeff Posnick) — web.dev/articles/es-modules-in-sw | web.dev | 官方 | SW 静态-only 原因 (install 期缓存)、import maps 不能用于 SW |
| S3 | w3c/webextensions #212 Support dynamic import() in background SW | github.com | 官方/批评 | 扩展动态 import 诉求未获满足 (2022-05 开, 至今 Open) |
| S4 | Playwright Sharding 官方文档 | playwright.dev | 官方 | `--shard=x/y`、blob+merge-reports、CI workers:1 |
| S5 | Use Test Impact Analysis (Azure Pipelines) — learn.microsoft.com | learn.microsoft.com | 官方 | TIA 三要素 + safe fallback=全量 + 依赖映射扩 JS + 周期全量校准 |
| S6 | Comparing GitHub merge queue, GitLab merge train, Graphite — graphite.com | graphite.com | 对比 | 三阵营特征矩阵: CI 双跑成本、小团队边际收益小 |
| S7 | GitButler 0.22 "Catch 22" (Scott Chacon) — blog.gitbutler.com | blog.gitbutler.com | 时效 | `but pr` 建栈、`but land` 直推 target、merged-history guardrails |
| S8 | HN: stacked PRs vs merge trains 概念辨析 | news.ycombinator.com | 社区 | merge train=集成方法、stacked PR=开发方法, 正交 |
| S9 | Trunk Merge Queue now Supports GitHub Stacked PRs — trunk.io | trunk.io | 时效 | GitHub Stacked PR public preview、整栈原子落地 |
| S10 | Flaky Test Quarantine & TIA Guide (2026) — qaskills.sh | qaskills.sh | 社区/批评 | quarantine 状态机 + cap+expiry、TIA 不降覆盖率 (merge-to-main+夜间全量) |
| S11 | microsoft/playwright #40691 Run only related tests for changed files | github.com | 批评 | `--only-changed` 只覆盖改动测试文件; 映射缺陷实证 |
| S12 | Why Vite (官方) — vite.dev | vite.dev | 官方/对比 | 反方立场: unbundled ESM 生产低效、full-bundle 探索 (利益立场注明) |
| S13 | Going Buildless: ES Modules — modern-web.dev | modern-web.dev | 社区 | 浏览器 ESM 平台规则: 全路径+扩展名、import.meta.url |
| S14 | ES modules in production: my experience so far (Bryan Braun) | bryanbraun.com | 社区/批评 | ~60 模块生产裸 ESM 实证: 几百模块以下 OK、打包可推迟 (2020 首发/2023 修订) |
| S15 | Enabling a merge queue (Rush 官方) | rushjs.io | 官方 | hot-merge 三档、组合爆炸、GitHub/Mergify/GitLab 清单 |
| S16 | MDN: manifest.json background 键 | developer.mozilla.org | 官方 | Firefox 无 SW (bug 1573659)、双声明标准写法、Chrome 121+ 忽略 scripts |
| S17 | Chromium Issue 40760920: dynamic import() in extension SW | issues.chromium.org | 官方/时效 | 平台方拒绝理由原文 (P2, 2026-09 读取无更新, 浏览器只读打开) |
| S18 | Butler Flow (GitButler 官方文档) — docs.gitbutler.com | docs.gitbutler.com | 官方 | target 六原则、集成即自动清理、冲突早知 |
| 【本地】 | ntp 模块图 (沙箱实测)、scripts/import-graph-guard.mjs、scripts/test-surface.mjs、scripts/test-mutex.mjs、test/cluster-map.json、.scratch/architecture-recovery/{README,spec,issues 28-33,handoffs 19/21/25/28/32/33}、round6-architecture-report.md、git 拓扑 | D:/Aworker/crx/boxing | 本地 | 模块边界规则、保守选择器、15+ 分支拓扑、lockfile EUSAGE 实证 |

引擎交叉说明: S1/S17 (SW import 限制) 被三引擎独立命中; S6/S15 (merge queue) 双引擎命中; S10 (TIA) 双引擎命中; 矩阵 A 构建权衡被 Exa+AnySearch 命中。vivianvoss.net (buildless 社区文) 抓取无正文, 按未读弃用, 同一论点由 S14/S13/S12 三源覆盖。

## 7. 信息缺口 (诚实声明; 不虚构基准/采用率数据)

**调研自认缺口 (置信边界)**:
1. **MV3 动态 import 是否松动**: S17 为 P2 且 2026-09 无状态更新, S3 仍 Open — 结论基于现状; 若未来放开, background 模块化策略需重估 (NTP 侧结论不变)。
2. **Firefox 事件页对 `type:"module"` 的实际支持细节**: MDN 仅声明 type 对 scripts 生效 [S16]; 事件页模块加载的浏览器矩阵无官方精确背书 — 建议未来以双浏览器 E2E 断言 spec 作活文档。
3. **本仓裸 ESM 性能基线缺失**: 无 NTP 首屏模块抓取数/耗时量化 profile — "何时切 bundle"阈值条款 (§4.4b) 目前缺本地触发依据, 需一次性 resource-timing 采样。
4. **学术 flaky 数据未读原文**: Exact 的 FPPP 案例研究仅摘要级出现, 未整页核验, 本报告不引用其 27%→96% 等数字为结论依据。
5. **merge queue 在本仓规模的量化 ROI 无实测**: S6 明示小团队边际收益小, 但本地冲突频率/红 main 事件数未采集 — 上 queue 前应记录 4 周基线。
6. **GitHub Stacked PR 生态在预览期**: S9/S7 均为 vendor 时效源; 官方 GA 前不把关键流程押在它上面 (§4.1 仅列为未来形态)。

**本票主题覆盖缺口**:
7. **lockfile 专项外部来源缺失**: 调研问题原文 (按 delta 原样发送) 未含 lockfile 角度, atomcode 返回亦无 lockfile 专项来源 — §4.2 模板锚定本地实证 + spec 裁决 + npm 平台文档常识 (已逐条标注), 未做任何外部引用虚构。票 29 若需外部最佳实践 (如 dependabot/lockfile 维护策略), 属新调研主题, 本票 delta 不允许追加第二次 atomcode。
8. **三镜像 (gitlab/codeberg) 归并语义未核验**: 本轮来源只覆盖 GitHub 生态 merge queue/stacked PR; gitlab merge train 与 codeberg (Forgejo) 的对等能力仅矩阵级提及, 未整页核验 — 票 32 若走 PR 路线需另行确认。

**置信声明**: 模块边界铁律与 TIA 保守原则 = 官方文档 + 厂商实现双源以上交叉验证 (高); 归并部分 = 概念稳定但 2026 生态快速滚动, vendor 信源占多数 (中-高); 裸 ESM 规模阈值 = 社区经验与 bundler 厂商立场存在可写明的利益分歧 (中)。所有"本地实证"标注均可由仓库文件复核。

## 8. 下游票执行指针 (一句话)

- **票 29 (lockfile + CI)**: 按 §4.2 执行; 验收 = 三 OS 矩阵 npm ci 全绿 (CI 证据) + 版本一致 + 零新依赖。
- **票 30 (agent 版本控制规则对账)**: 与本报告 §5 第三行同向 — AGENTS.md 内 raw Git 表述翻译为 but 操作, WORKFLOW §4.2 保持唯一权威; 验收按 spec (扫描禁令 + 权威文件可解析)。
- **票 31 (state-sync 失败诊断)**: 按 §4.3 执行; 分类先行 (pw:api log 定位) → 修复或 quarantine+expiry, 产出 classification report。
- **票 32 (main 收敛)**: 按 §4.1 执行; 严格串行 per-ticket merge commit; 汇入点全量走 CI; 推送/PR 需启动器显式授权; 不引入 merge queue。
- **票 33 (文档与 stale 分支对账)**: 分支处置表 + 摘要/README 与合并后现实对齐; 本地发散 main 不 force-push。
