# Ticket 29 Closure Report — Lockfile and CI sync

- 日期: 2026-09-06
- 窗口: Boxing architecture-recovery 子窗口 (票 29)
- 分支: GitButler 独立分支 ticket-29-lockfile-ci-sync (未 push — WORKFLOW §4.2)
- 任务书: .scratch/architecture-recovery/prompts/29-lockfile-ci-sync.md
- 载体: ctx (context-mode) + node.js 沙箱 (全部读取/写入经 ctx, 无宿主 $ 剥离面)

## 0. TL;DR

`npm ci` 在 CI 无法干净安装的根因是 package-lock.json 与 package.json 失步: lockfile 根版本滞留 3.7.0 (package.json 为 2026.8.21), 且缺 crx3@1.1.3 及其 6 个传递依赖。以 `npm install --package-lock-only --ignore-scripts` 再生 lockfile 后, `npm ci --dry-run --ignore-scripts` 从 EUSAGE exit 1 修复为 exit 0; 全部静态门绿。零运行时依赖变化 (3 个 devDeps 名称与 semver 范围逐字一致)。

## 1. 基线复现 (零基线, 非存在性自证)

命令: `npm ci --dry-run --ignore-scripts` (node v24.11.0 / npm 11.6.1, 与 .nvmrc=24 一致)。修复前: exit 1, EUSAGE, 缺 7 包:

- crx3@1.1.3 (package.json 已声明 ^1.0.0 但 lockfile 无任何 crx3 条目)
- mri@1.2.0, pbf@3.3.0, yazl@2.5.1, ieee754@1.2.1, resolve-protobuf-schema@2.1.0, protocol-buffers-schema@3.6.1 (6 个传递依赖)

与 round6-architecture-report.md 证据快照逐字一致。

## 2. 修复动作

`npm install --package-lock-only --ignore-scripts` — exit 0 ("up to date, audited 344 packages")。不触碰 node_modules、不跑生命周期脚本、不产生构建产物, 符合 CI-only build 政策 (2026-09-04)。

lockfile 变化:

- 根版本 3.7.0 → 2026.8.21 (与 package.json 一致)
- packages 337 → 344 (+7: crx3 树)
- 7 个缺失项全部落表且版本/integrity 匹配 (crx3=1.1.3, mri=1.2.0, pbf=3.3.0, yazl=2.5.1, ieee754=1.2.1, resolve-protobuf-schema=2.1.0, protocol-buffers-schema=3.6.1)
- lockfileVersion 3 不变; CRLF = 0 (LF 保持)
- 根 devDependencies 与 package.json 逐字一致: @playwright/test ^1.48.0, crx3 ^1.0.0, web-ext ^8.10.0 — 零新增运行时依赖

## 3. 逐项验证 (issue 29 checklist → 证据)

| Checklist | 结果 | 证据 |
|---|---|---|
| Regenerate the lockfile from the current package metadata | PASS | §2; npm exit 0 |
| Clean-install dry run exits zero and reports no missing packages | PASS | 修复后 `npm ci --dry-run --ignore-scripts` exit 0, "added 8 packages" (crx3 树 7 + fsevents 可选平台依赖), 输出无 error/missing |
| Root lockfile version and dependency set agree with the package metadata | PASS | lock.version = pkg.version = 2026.8.21; devDeps 逐字对账 true (Node 脚本集合比对); 7 缺失项在表且版本/integrity 匹配 |
| Run the existing build and static guards after the dependency change | PASS | 静态门本机全绿 (见 §4); 构建门按 CI-only 政策以证据链替代, 无 dist 契约面 (票 15 同构先例) |
| Write the closure report named by the handoff | PASS | 本文件 |

静态门明细:

- `node scripts/import-graph-guard.mjs` → `{"ok":true,"modules":14,"edges":48,"violations":[]}` exit 0
- `node --check ntp/ntp.js` → 0; `node --check background.js` → 0; `node --check .github/scripts/build.mjs` → 0
- `git diff --check` → 0 (行尾/CRLF 守卫)

## 4. 构建门处置 (CI-only build 政策合规)

宿主 AGENTS.md CI-only build 政策 (2026-09-04): 本机禁止一切构建/编译/打包/测试运行, 本机不得产生构建产物。本票未跑 `npm run build` / `npm test`, 以静态证据链满足 handoff "The existing build and static guards remain green":

1. build.mjs 零第三方依赖 (仅 node:fs/path/url/child_process, 头注释 "Zero third-party deps"), 不读 package-lock.json (SKIP 集显式排除, 版本取自 manifest.json) — lockfile 变更不在其输入面, 构建输出不可能因本票回归。
2. build.yml 为 workflow_dispatch-only (不随 push/PR 自动触发), 且无 npm ci 步骤 — 不构成本票的 CI 安装门。
3. 真正消费 npm ci 的 CI 路径 = test.yml 第 54 行与 quarantine.yml 第 41 行 (三 OS 矩阵; Playwright 浏览器缓存 key 挂 hashFiles('package-lock.json')) — 由 §3 的 dry-run exit 0 直接覆盖, 即本票的 CI 安装门验证。
4. CI 实跑 (test.yml 三 OS 矩阵) 随分支汇流/CI 派发执行 (票 32 波次), 子窗口不 push 不自证 (§4.2); 与票 15 "文档票无需 npm run build (无 dist 契约面)" 同构。

## 5. 风险与遗留

- npm audit 报 12 vulnerabilities (3 moderate, 6 high, 3 critical), 全部位于 devDeps 工具链 (web-ext/@playwright/test/crx3 传递树), 无运行时依赖。`npm audit fix` 会改版本范围、超出本票 delta ("只修复 lockfile 与 CI 安装门"), 不在本票执行 — 建议列入 backlog 单独开票。
- fsevents 2.3.2 出现在 dry-run 安装计划: 可选平台依赖 (darwin), 正常现象。
- build.yml 签名步 `npx --yes crx3 pack`: crx3 现已进入 lockfile, npm ci 后确定性可解析。

## 6. 版本控制

- GitButler 独立分支, 提交仅含本票文件: package-lock.json (修复本体), issues/29 (勾选闭环), 本报告, WORKFLOW.md §6 教训行。
- 大脑窗口未提交改动 (.scratch README.md / research-report-round6.md / spec.md 及 round6 未跟踪文件) 未卷入本票提交 (票 05 并行 hunk 认领纪律)。
- 未 push、未开 PR (WORKFLOW §4.2; CRX-R-013: 本地 but commit 为最低持久化门槛, CI dispatch 后续同步)。

## 7. 偏差记录

- handoff 建议 $implement → $code-review → $handoff skills: 本窗口技能目录未暴露这三个 skill (Skill 工具报 not found), 按其实质执行: 实施 (lockfile 再生) → 审查 (逐项证据对账 + 提交面纯度认领) → handoff (本报告)。与票 28 "无 ctx 工具时以 node.js 载体替代" 的偏差记录惯例一致。
- WORKFLOW.md §6 教训行随本票提交 (该文件提交时无其他窗口在途改动; 若并行窗 30/31 同期追加行, 按票 05 hunk 认领纪律处理)。
