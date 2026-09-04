# 25 — Test-process mutex and changed-test standardization — Closure Report

- 生成: 2026-09-05
- 票: `.scratch/architecture-recovery/issues/25-test-process-mutex-changed-default.md`
- 窗口: Boxing architecture-recovery 子窗口 (票 25)
- 阻塞: 23 — Mental model deep research (已闭环: `research-report-round5.md` 落盘, `23-review-verification.md` 判定 PASS, 其 §5.3 为本票执行蓝图)
- 必读清单: prompts/25 + handoffs/25 + issues/25 + spec.md + WORKFLOW.md(§4.2) + round5-architecture-report.md + scripts/test-surface.mjs + test/playwright.config.ts + package.json — 全部完整读取
- 版本控制: WORKFLOW §4.2 (GitButler `but` CLI, 独立分支 `arch-recovery-25-test-mutex`, 不 push)

## 完成定义逐项验证

| # | Acceptance criterion (handoff/issues 25) | 证据 | 结论 |
|---|------------------------------------------|------|------|
| 1 | 零依赖 Node wrapper 只允许一个本地 Playwright 进程 | `scripts/test-mutex.mjs` (mkdir 原子抢锁 + lock.json PID/时间戳 + PID 存活/年龄双通道陈旧检测 + 锁释放于 exit/SIGINT/SIGTERM/SIGHUP + CI 环境绕过) | PASS |
| 2 | package scripts 以 wrapper + changed-surface 为标准本地路径 | package.json: `test:changed` = wrapper changed 模式 (test-surface 选择器); 所有本地 Playwright 车道 (test/test:all/test:chromium/test:firefox/test:failed/test:quarantine/test:debug) 全部经 wrapper | PASS |
| 3 | 配置/测试变更仍回退全量 | 隔离 clone 干跑: package.json 变更 → "full-suite fallback: configuration/test change requires the full suite"; .gitignore 未映射叶子 → "full-suite fallback: unmapped leaf" | PASS |
| 4 | 第二并发进程被拒绝或等待 (第一进程持锁期间) | (a) `node scripts/test-mutex-verify.mjs` 5/5 全绿 (含 exit 75 + 报错指名持锁 PID + probe 未执行); (b) 真实 Playwright 运行期间第二 wrapper 实测 exit 75: "[test-mutex] error: test process lock is currently held by PID 11620 (held for 52s)", marker 未生成 | PASS |
| 5 | 有界 source-only change 跑有界子集且受影响车道绿 | 隔离 clone 干跑: ntp/utils.js 变更 → 精确选择 8 spec 子集 (boxing-adr-0007-acceptance/audit/conn-dsu/connections/memory/search/state-sync/v3); 真实车道经 wrapper 实测: 86 passed / 10 failed — 10 失败归约为 3 个唯一既有测试 (state-sync 多标签同步 3 例, CDP "session closed" 环境签名), 无 wrapper 直跑基线同 3 失败 + 单测单 worker 仍失败 → 判定既有环境性, 与本票工件无关, 详见 §残余 | PARTIAL (子集执行 PASS; 车道 3 例既有红, 见残余) |
| 6 | 收口报告落盘 | 本文件 | PASS |

## 工件清单

- `scripts/test-mutex.mjs` (新增): 零依赖进程级互斥 wrapper, 导出 acquireLock/acquireLockWithWait/isLockStale/releaseLock 供程序化验证; CLI 模式 full/changed/任意脚本直通; exit 75 = EX_TEMPFAIL 忙拒; `--wait`/`TEST_MUTEX_WAIT=1` 阻塞等待; `TEST_MUTEX_DRY_RUN=1` 干跑; `CI` 环境绕过; 默认锁目录 `<repo>/.test-mutex` (可 `TEST_MUTEX_DIR` 覆盖)。
- `scripts/test-mutex-verify.mjs` (新增): 5 项并发门禁程序化验证 (干跑洁净 / 并发忙拒 exit 75 + 指名持锁 PID / 死 PID 陈旧锁回收 / --wait 阻塞至释放后执行 / CI 绕过不动持锁目录)。
- `package.json` (改): test=wrapper full (收口/CI 全量), test:all 同义别名, test:changed=wrapper changed (标准本地路径), 其余车道全 wrapper 化。
- `.gitignore` (改): 追加 `.test-mutex/` 与 `.test-mutex-*`; 顺带整文件 CRLF→LF 规范化。
- `AGENTS.md` (改): Build-and-Verification 表新增标准本地验证行; Playwright 段重述 npm test 语义 (全量+mutex 保护) 与并发门禁入口。

## 验证命令与结果摘要

- `node scripts/test-mutex-verify.mjs` → ALL 5 PROGRAMMATIC TESTS PASSED VERIFIED (exit 0)。
- `node scripts/import-graph-guard.mjs` → ok:true, 14 modules, 48 edges, 0 violations。
- `node --check scripts/test-mutex.mjs && node --check scripts/test-mutex-verify.mjs` → 双绿。
- `git diff --check` → 干净 (WHITESPACE CLEAN)。
- 隔离 clone (OS temp) 干跑: bounded subset 精确 8 spec; package.json/.gitignore 变更全量回退; wrapper full 模式干跑 status 0 且不留锁目录。
- 真实并发互斥: 持锁运行 (PID 11620) 期间第二进程 exit 75, probe marker 未生成, 套件结束后锁目录自动释放。

## 残余 (报大脑)

1. 3 个既有红色测试 (不在本票爆炸半径): `boxing-state-sync.spec.ts` 144/167/222 (多标签同步三例)。错误签名 "Protocol error (Runtime.callFunctionOn): Internal server error, session closed" — chromium CDP 会话中途死亡, 环境性; 无 wrapper 直跑基线复现同 3 失败 (6 passed/3 failed), 单测单 worker 仍失败。本票未触碰 ntp/* 与 test/tests/*, wrapper 仅进程级协调。建议由大脑归票 27 或新票处理。
2. CI test.yml 全 3 OS 在 `npm ci` 步骤红 (最近 4 次 run 均 26-28s 失败, 2026-09-04 起) — 既有 CI 基建问题, 非本票引入; 按 CI-only 政策由大脑推送后重跑方为权威车道证据。
3. BX-EXPLORE-003 codegraph sync 未执行: 本机无 codegraph CLI (探测无该命令)。本票新增两个 scripts 文件已通过 import-graph-guard 实测。
4. 本窗口执行了 `but pull` (工具提示: origin/main 前移 + 5 个 merged-upstream 分支待移除): 5 分支集成移除, 9 分支无冲突 rebase, 并行窗分支 (23/24/26) 内容提交完整保留。

## 版本控制 (WORKFLOW §4.2)

- 分支: `arch-recovery-25-test-mutex` (GitButler), 提交 kzp `test(ticket25): zero-dep process mutex + changed-surface standard path`。
- 本报告作为第二条提交落于同一分支。未 push。

