# 94 报告 — 2026.9.15 版本面与门禁重跑准备

> 票: **94** · covers **A-048** · 镜像 **—** · Blocked by: **91, 92, 93**（均已 done）
> 波: Wave9（目标版本 **2026.9.15**，持有 2026.9.12 不热修）
> 日期: 2026-09-14 · 版本控制: WORKFLOW §4.2（GitButler `but`，不 push、不开 PR、不 tag）
> 分支: `wave9-94-version-2026-9-15`（本票独立分支）

---

## 0. 开工复述（启动器「开工第一句」三项）

**① 阻塞 / 被阻塞关系**

- 本票 **Blocked by: 91, 92, 93**。三票 Status 均为 `done（2026-09-14 · run 34773593267）`：91 = B55 merge 三向（A-045，GH #11）、92 = boot-pending e2e（A-046）、93 = G-A 残红出口（A-047，GH #12）→ **阻塞已解除**，与 issue 标注 `ready-for-agent（W2 首脑 2026-09-14：91/92/93 前置满足；可开工）`一致。
- 本票**不阻塞他票**；同波 95（A-049 凭据清扫）已 done。本票是 Wave9 票面最后一张——其后仅剩用户侧动作（G-B 声明、发行后 G-C 复核）。

**② 必读清单存在性**（启动器 7 项 + handoff 表 3 项，共 10 项，**全部存在**）

| 来源 | 路径 |
|---|---|
| 启动器 | `.scratch/architecture-recovery/prompts/94-version-2026-9-15.md` |
| handoff | `.scratch/architecture-recovery/handoffs/94-version-2026-9-15-handoff.md` |
| 本票 | `.scratch/architecture-recovery/issues/94-version-2026-9-15.md` |
| Spec | `.scratch/architecture-recovery/spec.md` |
| 过程 | `.scratch/architecture-recovery/WORKFLOW.md`（§4.1/§4.2/§4.4 + 豁免台账 + §5/§6） |
| 门禁 | `docs/adr/0017-release-data-gate.md`（含 2026-09-13 修订） |
| 领域 | `docs/CONTEXT.md` |
| A 账本 | `.scratch/architecture-recovery/decision-ledger.md`（A-040..A-049） |
| D 账本 + 定谳 + 计划 | `.scratch/wave9-postrelease-grill/decision-ledger.md` · `ga-definitive-b4f3df2.md` · `plan.md` |

**③ handoff 内通用调研三项**（先读完再动手；结论见 §1）

1. **atomcode 深度调研**（串行一次一个）：版本面同步 × 发行说明 SSOT × 门禁重跑的工业成熟方案。
2. **回顾** `docs/adr` 与 `docs/CONTEXT.md` 现有心智模型；冲突不得静默改向——记 revised 并呈报。
3. **对标** 工业级实现/测试策略（Playwright 扩展 e2e、合并策略、CI 门禁等）。

---

## 1. 通用调研摘要（handoff 通用三项）

### 1.1 atomcode 深度调研

- **载体**：`ctx_batch_execute` → `atomcode -p "<verbatim>"`（atomcode-research skill 唯一命令；串行一次，开工前 tasklist 探测零在途）；exit 0 正常完成，FTS5 索引 12 sections（source=`atomcode-94`）。提示词与蒸馏落盘：`.scratch/94-atomcode/prompt.md` / `atomcode-research.md`；续跑锚 `--resume d560228e-dd7b-446a-97fe-982dd026d09a`。
- **题目**：浏览器扩展（CWS/AMO）发版时版本号推进需同步的版本面、发行说明单一来源做法、发行门禁（CI 绿 + 人工验收 + 页面存活）在新版本号下的重跑规程。
- **核心结论**（Confidence 高；searches 6 / angles 5 类全覆盖 / full reads 8；官方×2 + 工程博客×3 + 生态×2 交叉验证）：

| # | 结论 | 对本票的落点 |
|---|---|---|
| R1 | **版本面 ≥6 处**：manifest.version、package.json、CHANGELOG、git tag、GitHub Release、商店「版本说明」；SSOT = CHANGELOG/release-notes 一处写入、多处派生/摘取 | 本票同步面 = manifest(version+version_name) + package.json + package-lock×2 + ntp/index.html 兜底 + AGENTS.md + CHANGELOG 新节 + `docs/release-notes/2026.9.15.md`（build.yml `body_path` 硬依赖）；tag/Release/商店字段属发行后用户动作，不在本票 |
| R2 | **版本号单调递增为平台铁律**（CWS 拒绝非递增、同版本重传静默压制自动更新；AMO 同规）→ pre-commit+CI 双层校验 | 2026.9.15 > 2026.9.12 满足递增；本票验证脚本即一次性一致性校验（§3），台账化建议见 §6 |
| R3 | **门禁绑新版本号整轮重跑**：① CI 绿的对象是待发布构建产物；② 人工验收测 CI 产出的同一 zip、禁本地重打包、版本号即制品对账锚点；③ 页面存活发布事件后重跑，机械化定义 = 渲染版本/version.json == 新 tag（非仅 200）。**失败 → 修复 → bump 更新版本号 → 三门全重跑** | G-A 已有证据（run 34773593267 + corroboration 34778641702，tip 02d31657 双绿）；本票改动落 main 后须对新 tip 复跑或按 `on.push.paths` 论证等价；G-B 留用户；G-C 现状 200 已核（§3），发行后按「渲染版本 == v2026.9.15」复核 |
| R4 | **CalVer 变体** = CI bot 提交 manifest bump + 手写 CHANGELOG + CI 三处一致性校验（DuckDuckGo 模式；release-please 对 CalVer 不友好） | Boxing 票08 已是此路线，本票沿用；`docs/release-notes/<ver>.md` 即本仓 Release notes SSOT |
| R5 | 已知坑：`on: release` 的 GITHUB_TOKEN 事件不触发后续 workflow | 本仓 demo-deploy.yml 用 `release: published`；publishing-guide Part 5 已备手动重部口径（`gh workflow run demo-deploy.yml`）→ 与调研一致，无需改向 |

### 1.2 docs/adr 与 docs/CONTEXT.md 心智模型复核

- **ADR-0017（含 2026-09-13 修订）**：可发行 = G-A ∧ G-B ∧ G-C 合取；G-B 常设口径 = 用户声明 pass（版本号+日期），**禁 agent 代签**；豁免台账 5 字段 + 硬到期 + never-quarantine；2026.9.12 持有不热修、9.15 重新走三门。本票做法（版本面推进 + notes SSOT + 检查单逐项、不宣称达成）与该模型**完全一致，无冲突、无 revised**。
- **docs/CONTEXT.md**：Wave9 grill 条目已载「目标 2026.9.15 / G-B=用户声明 / 线性追加」；Wave9 merge 条目已载三路合并。本票补一条 Wave9 版本面收口记录（§2 改动表），无改向。
- **既有版本面清单锚点**：票 08 报告（version-unify）确立的写入方/读取方分野仍有效——manifest `version`+`version_name` 唯一写入方，build.mjs `BOXING_BUILD_VERSION` 构建期可覆盖，settings 页脚运行时读 `version_name || version`（票 65），index.html 静态值仅 file:// mock 兜底。
- **观察到一处系统性陈旧（具名登记，非门禁项、非本票改动）**：全部 14 个 `docs/i18n/README.*.md` 的 Install 块仍是 9.12 上架前口径（「商店上架仍在推进 / Edge 进行中 / 无公开 AMO / release `.xpi` 即 Firefox 自托管路径」），且 `README.hi.md` 额外钉死 `v2026.9.11`。英文 README 已在 W9-P3 改为「store latest = 2026.9.12 + 不再发 xpi/crx」，locale 层未同步——属 docs-sync 票（61/85 一脉）的存量债，逐文件半修反而放大漂移，本票不动、仅登记，建议大脑列入下一波。

### 1.3 工业对标（实现/测试策略）

- **Playwright 扩展 e2e**：`launchPersistentContext` + `--load-extension` + headed（或 `--headless=new`）为工业硬要求（extension.js.org 官方）——与本仓既有 `test/playwright.config.ts` 车道（chromium headed persistent + firefox `-no-remote`）一致；本票无新 spec 需求（版本面属构建产物级一致性，非行为面）。
- **合并策略**：三路合并需 base 快照（Joplin `base_*` 模型）——票 91 已落 `syncBase` + `utils.mergeLayoutThreeWay`，本票仅消费其结论（用户向 notes 表述），无新增实现。
- **CI 门禁**：「Release PR/构建产物级绿 → 人工验同一 zip → 发布后页面存活复核」三段式与 ADR-0017 三门同构；本仓 `test.yml` 三 OS + data-golden + waiver-ledger 台账（queue-not-graveyard，票 93 调研：GitLab/Chromium/Meta 具名-F 主流）已达工业口径，本票不新增门禁件。

---

## 2. 版本面盘点与改动（2026.9.12 → 2026.9.15）

### 2.1 改动表

| # | 面 | 改动 | 性质 |
|---|---|---|---|
| 1 | `manifest.json` | `version` + `version_name` → 2026.9.15 | **唯一写入方**（票08 契约） |
| 2 | `package.json` | `version` → 2026.9.15 | 与 manifest 同步（票29 lockfile 教训） |
| 3 | `package-lock.json` | 根 `version` + `packages[""].version` → 2026.9.15 ×2 | 同上，防 `npm ci` EUSAGE |
| 4 | `ntp/index.html` | 页脚静态兜底 `Boxing v2026.9.12` → `v2026.9.15` | file:// mock 兜底；扩展上下文由 settings-ui 运行时注入 `version_name`（票08/65） |
| 5 | `AGENTS.md` | `manifest version 2026.9.12, calver` → 2026.9.15 | agent 合同面 |
| 6 | `CHANGELOG.md` | Unreleased 文案 `after 2026.9.12` → `after 2026.9.15`；新增 `## [2026.9.15] - 2026-09-15` 节（Fixed/Improved/Internal/Install） | 仓库内 changelog SSOT |
| 7 | `docs/release-notes/2026.9.15.md` | **新建**：用户向发行说明（9.12 同构版式） | build.yml `body_path` 硬依赖——无此文件 `make_release` 会发布空正文 |
| 8 | `docs/publishing-guide.md` | 当前发行口径 2026.9.12→2026.9.15；商店行「9.11 已上线；9.12 由你提交」→「9.12 已上线；9.15 由你提交」×2；三个 zip 文件名 → 2026.9.15；CHANGELOG 条目引用 → 2026.9.15；修订日期 2026-09-14 | 面向下一发行轮的活文档 |
| 9 | `docs/store-publishing-plan.md` | 标题/现况日期/版本行/材料包节/用户清单文件名/`gh workflow run` 版本参数 → 2026.9.15；AMO+Edge 行 9.11→9.12 已过审 | 同上；Grill Decisions 历史裁定行保留原样 |
| 10 | `docs/store-assets/STORE-COPY.md` §6 | `2026.9.12 商店提交请使用` → 2026.9.15 | 提交操作指针；L69「2026.9.12+」特性引入标记保留 |
| 11 | `docs/index.md` | 删陈旧条件句「Once the first 2026.9.12-milestone release ships…」（demo 已 live，G-C 实测 200）；「Until it goes live」→「Prefer a quick look first?」 | 版本里程碑指针失真修正 |
| 12 | `scripts/gb-dryrun-chrome.mjs` | 默认 `--ext` → `D:/rel-2026.9.15/chrome`；P0-manifest 断言 → `2026.9.15`；G4 升级基线 `v2026.9.11` → `v2026.9.12`（两处：header 注释 + outOfScope） | **门禁重跑准备**：G-B 彩排工具对齐下一发行轮 |

### 2.2 明确不动的面（防止过度宣称/历史失真）

| 面 | 现状 | 不动的理由 |
|---|---|---|
| README 徽章 + 「Latest published store version: 2026.9.12」 | 指向商店实况 | 商店至今仍是 9.12（D-006）；9.15 未过闸未上架前改成 9.15 即假宣称（§4.4 禁） |
| `docs/release-notes/2026.9.12.md`、CHANGELOG §2026.9.12、docs/history/*、ADR 内文 | 历史记录 | 不可改写 |
| 14 个 `docs/i18n/README.*.md` | 9.12 上架前口径（hi 钉 v2026.9.11） | 系统性 locale 滞后债（§1.2 具名登记），建议大脑列入下一波 docs-sync |
| `docs/store-assets/store-listings-2026-09.md` | 9.9 提交实况记录 | 历史档案 |
| `.codex-tmp/*` | scratch | 不入版本面 |

### 2.3 与 AC「manifest/calver 与 notes 一致（构建产物级）」的对应

- 源：`manifest.json` version/version_name、`package.json`、`package-lock.json` 根两处、`ntp/index.html` 兜底、`AGENTS.md`、`CHANGELOG` 新节、`release-notes/2026.9.15.md` —— 全部指向 **2026.9.15**，无残留指针面。
- 产物：`npm run build` 后 `dist/boxing-chrome/manifest.json` 与 `dist/boxing-firefox/manifest.json` 的 `version`/`version_name` 均为 2026.9.15；dist `ntp/index.html` 页脚 `Boxing v2026.9.15`；构建产物命名 `boxing-{chrome,firefox}-2026.9.15.{zip,crx,xpi}` —— 与 notes 文件名 `2026.9.15.md` 一致（CI `body_path` 将按版本号精确命中）。

## 3. 验证（结果可复核）

| 步骤 | 命令/手段 | 结果 |
|---|---|---|
| JSON 完整性 | `node -e` 读 manifest/package.json/package-lock | version+version_name 全 = 2026.9.15，解析无错 |
| 语法 | `node --check scripts/gb-dryrun-chrome.mjs` | exit 0 |
| 构建产物级一致 | `npm run build` | DONE_BUILD；dist 双 manifest = 2026.9.15/2026.9.15；页脚 v2026.9.15；产物名 boxing-*-2026.9.15.* |
| pretest 三守卫 | `npm run pretest` | import-graph 15 modules/48 edges/0 violations；migration-golden 28/28；css-balance OK |
| 豁免台账机检 | `node scripts/waiver-ledger-check.mjs` | exit 0（4 行字段全、无过期、never-quarantine 零命中） |
| G-C 基线 | fetch 三 URL | `/boxing/demo/` 200 text/html 含 NTP 内容；`/boxing/demo/ntp.css` 200 text/css 63,988B 含 tokens；`/boxing/privacy-policy.html` 200 含正文 + `Last updated:` |
| e2e | `npm run test:changed`（ambiguous → 全量回退，610 用例） | 604 passed / 5 skipped / **1 failed**：`boxing-innerclip`（firefox-extension 车道，4-worker 满载下几何断言超时）→ solo 重跑 **3/3 绿**（20.6s）→ 环境性 flaky，与本票面（版本串/文档）无因果；never-quarantine 家族（data-golden/migration/state-sync/data-recovery/sync/webdav）全过 |
| 卫生 | `git diff --check` | 干净（LF，无尾随空白） |

## 4. 发行检查单 — 2026.9.15（WORKFLOW §4.4 模板逐项）

```
发行检查单 — 2026.9.15
G-A CI
- [ ] main 全量 test.yml run URL: __________ → 全绿
      备注：本票改动含 manifest.json + ntp/index.html，两者均在 test.yml
      on.push.paths 内 → 本票落 main 的 push 即自动触发新 tip 的全量跑。
      前置证据（pre-bump tip 02d31657）：
        run 34773593267 (headSha 16ce5d27) — 4 job 全 success/0 failed
        run 34778641702 (dispatch, headSha=tip 02d31657) — 4 job 全 success/0 failed
      → G-A 须以 bump 后新 tip 的 run 为准，旧证据仅证明修复面已绿。
- [x] 残红豁免逐行在效（台账 4 行：auto-expand closed；Bug5-dark / zoom-dblclick / search 具名 F，到期 2026-09-19 = 下一条 main 全绿验证 run）
- [x] @data-golden continue-on-error 已摘除且绿（票54；run 34773593267 data-golden success）
- [x] node scripts/waiver-ledger-check.mjs exit 0（2026-09-14 实测）；发行前仍须按 §4.4 逐行人工比对失败签名与最新基线 run
G-B 人工 zip 黄金路径（Chrome 与 Firefox 各一遍，用解包产物 — 用户侧，agent 禁代签）
- [ ] 全新安装 → 引导可走完（Skip/Next），关闭后主界面可点击，零 console 错误
- [ ] 建盒/改名/拖拽/缩放 → 重开后数据完整
- [ ] 旧备份导入 → 合并或冲突副本可查，无静默覆盖
- [ ] 升级安装（上一发行版 2026.9.12 → 新 zip）：首开前 pre-update 快照存在；迁移后数据完整、无冻结
- [ ] 回滚演练：新版数据用 2026.9.12 代码读回无损失（含 v2 单程路径样例 — RA-1..RA-6）
- [ ] 至少 1 名具发布权限者确认已知风险与回滚预案
      彩排工具：node scripts/gb-dryrun-chrome.mjs（已重定向至 D:/rel-2026.9.15/chrome，断言 manifest 2026.9.15；属彩排非 G-B 证据）
G-C Pages（现状基线已核；发行后须按新 tag 复核）
- [x] https://xxx91n.github.io/boxing/demo/ → 200 且有主题渲染（2026-09-14 实测）
- [x] https://xxx91n.github.io/boxing/demo/ntp.css → 200 text/css（63,988B）
- [x] https://xxx91n.github.io/boxing/privacy-policy.html → 200 含政策正文与 Last updated
      发行后复核点：demo 页渲染版本/version.json == v2026.9.15（atomcode-94 机械化定义）；
      demo-deploy 由 release: published 触发，若 deploy 失败用 gh workflow run demo-deploy.yml 重部（guide Part 5）
渠道与商店
- [x] 可回滚目标版本已记录：CWS = 上一已发布版 2026.9.12；AMO = 上一已批准版 2026.9.12（≥2 批准版本满足：9.11、9.12；9.12 无已知阻断问题——G-A 未满足为主干态，非商店版特有缺陷）
- [ ] 商店文案/截图/权限声明/隐私政策与本次产物一致；版本号与 manifest 一致（提交时用户核）
结论
- [ ] 三条件齐备 → 允许 tag 与可发行宣称
- [x] 未齐备 → 记录缺项，状态保持「不可发行」
      缺项 = G-A（bump 后新 tip run）+ G-B（用户声明 9.15 pass）+ G-C（发行后复核）
```

## 5. AC 对照（issues/94）

| AC | 结果 | 锚点 |
|---|---|---|
| manifest/calver 与 notes 一致（构建产物级） | ✅ | §2.3 + §3：源七面 + dist 双 manifest + 产物命名 + `release-notes/2026.9.15.md` 与版本号同名 |
| 不宣称门禁达成直至 G-A 实测 + 用户 G-B 声明 + G-C | ✅ 未宣称 | §4 检查单三项缺项具名；本报告与 issue 均只写「备妥/待用户」，无 gate-passed 表述；README 商店徽章保持 9.12 实况 |
| reports/94-report.md | ✅ | 本文件 |

## 6. 残余与风险（具名，非豁免）

1. **G-A 需对新 tip 重跑**：本票落 main 后 `push.paths` 命中 manifest.json + ntp/** → 自动触发全量 test.yml；该 run 绿 + 台账复查（Bug5-dark/zoom-dblclick/search 签名比对）才构成 9.15 的 G-A。
2. **G-B 用户动作**：对 CI 产出的 9.15 zip（非本地重打包 — atomcode-94 纪律）在 Chrome+Firefox 各走一遍黄金路径；用户声明须含版本号+日期（D-007）。
3. **G-C 发行后复核**：三 URL 200 之外，建议按 atomcode-94 加验 demo 渲染版本 == v2026.9.15。
4. **boxing-innerclip firefox flaky**（本地全量 1 红，solo 3/3 绿）：未入台账（台账只收 main 车道残红）；若出现在 bump 后 CI run 则按 §4.4 规则入账。
5. **locale README 系统性滞后**（§1.2）：14 文件停留在上架前口径，hi 额外钉 v2026.9.11 → 建议下一波 docs-sync 票处理。
6. **AMO 版号红线**：`web-ext sign` 真密钥烧版号（guide 红线）；9.15 演练/签名用 99.9.x 或商店网页上传。
7. **版本一致性校验未工具化**：atomcode-94 R2/R4 建议 pre-commit + CI 双层递增/一致性校验脚本（CalVer 形态 C 的第三支柱）；本票以 §3 一次性验证代替，建议挂 backlog 评估是否固化。
8. **审核期勿重传**：CWS 审核中再传新版会取消在审版本（atomcode-94 / zenn.dev）——G-B 一次通过后再提交。

## 7. 版本控制（WORKFLOW §4.2）

- 分支：`wave9-94-version-2026-9-15`（独立 but branch；与 93 分支并行，无文件交叠）
- 提交：`but diff` → `but commit -b wave9-94-version-2026-9-15`（见 commit 记录）
- 未 push、未开 PR、未 tag、未动已推送 main（D-008 线性追加）
