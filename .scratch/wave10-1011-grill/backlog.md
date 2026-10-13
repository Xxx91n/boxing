# Backlog — Wave10 Round-3 审计遗留项（2026-10-14 审计窗口登记）

> 来源：审计窗口对 `wave-1011-round3`（基 `2e2723b1`，8 commits）的硬验收复跑 + 双轴评审（Standards/Spec 子代理并行取证）。
> 处置：全部 backlog 级，不阻塞本轮收口；逐条认领时引本表 ID。审计报告：`reports/2026-10-14-audit.md`。

| ID | 类别 | 发现 | 证据 | 建议处置 |
|---|---|---|---|---|
| B-01 | 测试基建 | `boxing-star-sync-audit.spec.ts` Scenario 3（unstar→tombstone 清理）在 4-worker 并行负载下 flake：chromium 全量 354/1skip/**1fail**，隔离复跑 **3/3 绿（9.8s）**。与 R3-02/D-013 同族（并行争用），但是不同用例 | acc-lanes 复跑输出 + 单 spec 复跑 | 并入 D-013 观察项监视范围；若复红走「复现分界→分类」，不得直接豁免 |
| B-02 | docs/注释 | `test/tests/boxing-focus-steal.spec.ts:163-166` 残留矛盾注释：仍称合成块跑在 "firefox main lane where native input is unavailable (#16095)"，与 D-012 后 L78-80 新注释（双车道原生恢复）直接冲突 | Spec 轴 (a)；S-12 需求 2 要求注释语义更新 | 下次触碰该文件时改写为「合成块=双车道 app 级守护契约」 |
| B-03 | test-evidence 逻辑 | `walkSpecs` flaky 双计：retried-passed 同时计 `flaky` 与 `passed`（scripts/test-evidence.mjs:93-96），passed≠playwright `expected`、行列不自洽——正是本工具要消灭的口径漂移类；本地 `retries:0` 潜伏，CI retries/`--retries` 透传下显形 | Spec 轴 (c1) + Standards 轴同报 | `statuses.length>1 && last==='passed'` 时只计 flaky（或列注明「passed 含 flaky」） |
| B-04 | test-evidence 健壮性 | `headedStates()` 正则解析 TS config：注释文本也会被 `/headless:\s*true/` 命中、仅支持单引号 `name:`、chromium 段终止符 `\}\s*\]` 失配落到文件尾——今日正确，任何格式变化静默错报 | test-evidence.mjs:61-81；双轴同报 | 行内锚定注释提示，或改结构化读取 |
| B-05 | test-evidence 口径 | workers 硬编码 `CI?2:4`：`--workers=N` 透传时块内 args 行与 workers 行自相矛盾 | test-evidence.mjs:154 | 从 extra args 解析 `--workers`，或读 playwright stats |
| B-06 | test-evidence 口径 | waiver active 行数正则 `^\|\s*active\s*\|` 扫整个 WORKFLOW.md，未像 `waiver-ledger-check.mjs` 那样限定账本节区；今日报 0 属巧合正确 | test-evidence.mjs:108-118 | 限定节区切片后再计数 |
| B-07 | spec 字面偏差 | S-13 要 `git rev-parse HEAD`，实现为 `--short`；且 GitButler workspace 下 HEAD=workspace commit（`c729e9e6`）而非分支 tip（`7e3ace7c`）——语义上实测树即 workspace，但报告读者需知非分支 sha | test-evidence.mjs:51 | 接受现状并在块内注明，或改全 sha |
| B-08 | 流程/纪律 | 两探针 `ff-native-input-probe.mjs`/`ext-liveness-probe.mjs` 直接 `playwright` 起 headed 持久上下文，未走 `test-mutex`；任务书红线「测试一律 test-mutex」严格读涵盖；缓解：手工 .scratch 探针非车道，但与套件并行会无保护争用 | probes/*.mjs；Standards 轴 borderline-1 | 探头加「勿与套件并行」注释，或包 mutex |
| B-09 | 测试基建（存量，非本轮引入） | `data-recovery.spec.ts:242` 写 `../test-results/roundtrip-export.json` → 落到仓库外 `D:\Aworker\crx\test-results` | grep | 下次触碰改 `test/test-results/` 或 `os.tmpdir()` |
| B-10 | 整洁 | 两探针脚手架（mkdtemp/launch/cleanup）近重复；.scratch 一次性件权重低 | Standards 轴 smell | 若转正式工具再抽公共件 |
