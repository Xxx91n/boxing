# 27 — Firefox quarantine residual convergence · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-05
- 状态: **done** — handoff 完成定义 5/5 满足; issues/27 验收 5/5 勾 + 决议写回
- 分支: `arch-recovery-27-quarantine-convergence` (GitButler, WORKFLOW §4.2), 实施提交 `usp` (645192c, 10 files / +264/−72); 报告与文档提交另列
- 上游依据: prompts/27 + handoffs/27 + issues/27 + spec.md + WORKFLOW.md + round5-architecture-report.md + README.md + 两个 playwright config + test/tests (必读全读)
- 阻塞核验: 票 23 (research-report-round5.md + 23-review-verification.md PASS) 与票 24 (arch-recovery-24-readme-beautify @ wvm) 均已闭环 → 本票解锁

## 完成定义勾稽 (handoff)

| # | Acceptance criterion | 证据 | 结论 |
|---|---|---|---|
| 1 | Quarantine lane run + every remaining failure classified | 基线 (workers=2): chromium **14/14 绿**, firefox **0/14** (全环境签名); solo (workers=1): firefox **12 绿 / 2 确定性失败** — data-recovery export (`mouse.dblclick: Test ended`)、extension-test NTP (`locator.click: Test ended`)。全部归入 playwright#16095 原生输入停滞类 (票01/13/18 同族) | PASS |
| 2 | Every entry repaired or retired with a recorded decision; no auto-extension | **14/14 repair, 0 retire** (逐项决议见下); 到期日 2026-10-02 的裁决由本票提前强制完成, 14 行台账全部删除, `@quarantine` tag 与 `quarantine-ref` 注释全仓清零 (grep 验证) | PASS |
| 3 | README table reflects new Chromium and Firefox counts | README 治理节改写: 表格 14 行 → 0 行 (收敛声明行), 收敛基线 (两车道 14/14 pass @2026-09-05)、repair 模式、focus-steal chromium-scope 说明、两份历史报告链接全部写入; 过期规则原文保留 (约束未来新 tag) | PASS |
| 4 | Firefox lane and quarantine lane verified after the change | quarantine lane: `npm run test:quarantine` → **0 tests, exit 0** (--pass-with-no-tests)。firefox 主车道: 7 个修复 spec solo (workers=1) **36 pass / 3 skip / 0 fail** (1.8m); 全 firefox 车道 (222 tests, 含 14 个回归项) 证据见"车道验证时间序" | PASS |
| 5 | Closure report exists | 本文件 | PASS |

## 逐项决议 (14/14 repair, 0 retire)

统一依据: 每条失败 (基线 R1 workers=2 全 14 fail; R2 solo 后仅 2 条确定性) 的签名全部是原生输入停滞类 (page.goto/click/dblclick 停滞、`Test ended`、goto 冷启动超时), 与票 01 (#16095)/票 13 (冷启动 22s)/票 18 (R1 18 fail→R3 solo 收敛) 三条既有教训同族; chromium 全程 14/14 绿证明被测应用行为无损。修复模板 = 票 18 已验证的合成化模式 ("守卫决策被同一形态的输入锻炼, 意图不变"), 零依赖新增。

| # | Entry | 决议 | 手法 |
|---|---|---|---|
| 1-3 | focus-steal ×3 (native dblclick 选区/焦点) | repair | **唯一保留原生输入的块**: 输入真实性即目的 (票18 判定), 转合成即空洞化。原 3 test 摘标后 `test.skip(browserName==='firefox')` 显式 chromium-scoped (chromium 主车道覆盖不变, 非隔离债务、无到期时钟); 新增 3 个合成孪生 (BX-SEL-01 应用层契约: **seeded Selection** + dblclick 建盒 → renderCanvas `removeAllRanges` 清选区 + `.canvas` user-select:none 计算样式断言) 供 firefox 车道覆盖。seeded-range 使断言非空洞 (守卫被移除时 rangeCount≠0 必炸) |
| 4 | innerclip-pan (pan-to-top clip) | repair | 原生 mouse.move/down/up pan 序列 → 合成: mousedown 派发到绑定目标 `#inner-canvas` (ntp.js:879), mousemove/mouseup 派发到 document (render.js:1241-1242 绑定面); 被测行为是 overflow:hidden 裁剪契约, 非输入真实性 (票18 对同族 innerclip 已用同法) |
| 5 | onboarding step-nav | repair | 5 处原生 locator.click → jsClick (evaluate element.click()); 步进状态机是纯应用行为; 同文件 3 个主车道兄弟 test 全 evaluate-only |
| 6-8 | v3 ×3 (visual check / pin toggle / cross-tab delete) | repair | 原生 dblclick/click → jsDblclick('#canvas-surface')/jsClick; "Chromium:" 前缀摘除 (两车道都跑); 冷启动预算 30s→60s (票13: 有头冷启动 ~22s); manual newContext 保留 (同文件/兄弟 spec 惯例, 验证轮未见 close 挂) |
| 9-12 | webdav ×4 (backup / data-loss / empty-pull / test-button) | repair | 原生 #add-box ×6、#webdav-test-btn click → jsClick; fill/selectOption 保留 (协议级, 同文件 2 个主车道兄弟 test 在 firefox 长期绿); 决议日 solo 4/4 绿 |
| 13 | data-recovery export round-trip | repair | **solo 确定性失败** (`mouse.dblclick: Test ended`) → 3 × jsDblclick; 导出捕获 (createObjectURL patch) 原样保留 |
| 14 | extension-test NTP rendering | repair | **solo 确定性失败** (`locator.click: Test ended`) → 2 处 modal click → jsClick; 且 boot 升级为套件标准 (waitUntil `load` 在 firefox 恒挂 — NTP 的 favicon/i18n file:// 网络尝试使 load 事件 pending, ticket-27 solo 证据) → `domcontentloaded` + `__boxingDebug` poll |

不退役任何一项的统一理由: 与票 18 相同 — 删除会把 chromium 主车道正在提供的回归覆盖一并删掉; 修复路径 (剥离原生输入) 保留被测行为。focus-steal 例外处理 (skip 而非转换) 正是票 18 "输入真实性即目的" 判定的执行。

## 配置与脚本面

- `test/playwright.config.ts`: firefox project 的 `grepInvert: /@quarantine/` **移除** (主车道恢复全量); 注释改写为收敛叙事 (票01 → 票27 历史)。
- `test/playwright.quarantine.config.ts`: 注释追加收敛状态 (0 tagged, lane 为未来注册保留)。
- `package.json`: `test:quarantine` 追加 `--pass-with-no-tests` — 0 匹配时 exit 0 (否则空车道报 "No tests found" 破坏门禁 UX; CI quarantine.yml 有 continue-on-error 不受影响)。
- 未触碰: ntp/* 源码 (本票 0 产品代码改动)、import-graph-guard 面Preserved (pretest 照跑)。

## 车道验证证据 (时间序)

1. R1 基线 (quarantine lane, workers=2): chromium 14/14 绿, firefox 0/14 (5.3m)。
2. R2 solo (quarantine lane firefox, workers=1): 12 绿 / 2 确定性失败 (data-recovery dblclick 停滞、extension-test click 停滞, 2.1m) — 分类依据。
3. 修复后 chromium 聚焦轮 1 (focus-steal/innerclip-pan/onboarding, workers=2): 11/11 绿。
4. 修复后 chromium 聚焦轮 2 (v3/webdav/data-recovery/extension-test, workers=2): 28/28 绿。
5. 修复后 firefox 聚焦轮 (7 spec, workers=2): 34 pass / 3 skip / 2 fail (extension-test goto 'load' 恒挂 → 标准化 boot 修复; data-recovery 负载抖动)。
6. 修复后 firefox 聚焦 solo (extension-test + data-recovery, workers=1): data-recovery 绿; extension-test 仍挂 (boot 修复前)。
7. boot 修复后: extension-test 绿; data-recovery 文件 solo 3 fail (失败面 = 未触碰的主车道 test :14/:74/:113, goto 冷启动超时, 票13 签名) → 判环境。
8. 修复后 firefox 7-spec 批 (workers=2): 10 fail — 含未触碰的 main-lane test, 受害名单逐轮轮换 → **宿主饿死签名** (票01: "先降 workers 再怀疑代码")。
9. 修复后 firefox 7-spec **solo (workers=1)**: **36 pass / 3 skip (chromium-only native) / 0 fail** (1.8m) — 决定性绿。
10. quarantine lane 复核: 0 tests, exit 0。
11. 全 firefox 主车道 (222 tests, workers=2, 含 14 个回归项): 见下节最终轮证据。
12. (收口时补) 全量 `npm test` 两项目 + last-failed 收敛 + 残余 solo 终验: 见下节。
13. `git diff --check` clean。

## 最终轮证据 (收口时更新)

- 全 firefox 主车道 workers=2 (222 tests, 含 14 个回归项): **exit 0, 219 passed / 3 skipped / 0 failed (3.7m)** — FIN-FX
- 全量 `npm test` (两项目, mutex-wrapped, workers=4): 444 tests → 438 passed / 3 skipped / **3 failed**, 3 个失败全部是 chromium `boxing-accent-theme` 的 `browserType.launch: Timeout 180000ms` (套件中途浏览器启动超时 — 与本票无关的项目/文件, 满载资源饥饿签名, FIN-FULL)
- 残余 last-failed 收敛 (票15 协议 R1): **3/3 绿 (7.1s, exit 0)** — FIN-SOLO; 残余清单清零, 无需 R2
- `git diff --check` clean

## 已知残余与边界 (报大脑)

0. **v3 visual-check 的 networkidle boot (review P3, 登记)**: `boxing-v3.spec.ts` visual-check test 保留既有 `waitUntil: 'networkidle'` — 与 extension-test 的 'load' 恒挂同族暴露面 (file:// favicon/i18n 请求使 load 类事件 pending)。本票 solo/满载 firefox 车道均绿 (3.7m 全车道 exit 0), 未改 (既有行为, 爆炸半径外); 若未来 firefox 假失败光顾该 test, 与 extension-test 同款 boot 标准化即可。

1. **宿主负载假失败是持续风险**: 本窗口复现了票 01/15/18 的同一现象 — firefox 有头车道在 workers≥2 批跑下受害名单逐轮轮换 (本票 R8 轮 10 fail, 其中 ≥6 个是本票未触碰的 main-lane test)。solo 全绿 ×N 轮成立。若 CI 或其他窗口再遇满载假失败, 按票 15 协议 (last-failed 收敛 + 残余 solo 终验) 处理即可, 勿怀疑代码。
2. **data-recovery.spec.ts:14 (未触碰, main-lane)**: goto 10s 预算 + test 20s 预算对 firefox 冷启动 (~22s, 票13 实测) 过紧, 冷启动轮彩票式失败。属票 13 范畴 (该票只修了 boxing-debug 的预算), 非本票爆炸半径; 若要根治建议下轮把该 spec 预算对齐票 13 方案 (test.setTimeout)。
3. **extension-test popup test (未触碰)**: manual newContext + waitUntil 'load' 默认值仍在 (file:// popup.html 无外链请求, 实际绿)。若未来 firefox 假失败光顾, 同款 boot 标准化可复用。
4. **GitButler 栈操作披露**: 本票分支依赖票 18 (测试文件行) 与票 25 (package.json 行) 的未合并提交, 按 ticket-10 教训执行 `but move --above` 两次 (25→18→27 链)。stacking 使基座 commit sha 重写 (GitButler 正常语义, patch 内容不变) — 与 24-25-26 review §6 指出的 "commit-identity rewriting" 同类操作, 此处为依赖链必需, 特此登记。
5. **CI-only 政策 (2026-09-04) 的执行口径**: 沿用票 25 先例 — 子窗口本地车道为工作证据, 权威证据按政策由大脑推送 CI 验证分支后重跑 (当前 test.yml 在 npm ci 步骤红, 26-28s, 票25 残余 #2 未解)。本报告所有 lane 输出均为本机实测, 请大脑在 CI 恢复后以 quarantine.yml + test.yml 巡逻复核。
6. **state-sync 3 例既有红** (chromium, 票25 残余 #1): 本票未触碰; 归票建议维持票 25 原议 (大脑裁决归 27 或新票 — 本票按 handoff 范围未扩围)。

## 版本控制轨迹 (§4.2)

- 分支 `arch-recovery-27-quarantine-convergence`; 实施提交 `usp` (7 spec + 2 config + package.json, 10 files)。
- 本报告 + README + issues/27 + prompts/27 + handoffs/27 (任务书三件套, 票 14/18 先例) 作为第二提交落于同分支。
- 未 push, 未开 PR (§4.2)。
- zz 未提交区的大脑工件 (spec.md/round5-report/23-25-26 文件等) 全部排除在外, 未卷入 (票 05 hunk 认领纪律)。

## 无偏离声明

必读清单全读; 基线先行 (R1/R2 后动手); 逐项决议含依据; 无到期延长; README 与台账一致; GitButler-only; 零依赖新增; 零产品源码改动。

## 独立复核 (code-review 双轴, 子代理)

- **Standards 轴: PASS** — 无 P1。P2×1 (config 注释把 14 项全写成 "synthetic-input conversion", 未反映 focus-steal 3 项是 chromium-scope + synthetic twin) 已修; P3×5 (未用 import pathToFileURL / 注释空格 / extension-test boot 平价表述过强 / webdav 注释边界过宽 / config 注释叙述 diff) 全部照改。
- **Spec 轴: PASS** — 无 P1; 8/8 验证全过 (14 tag 全摘、0 test 删除、断言无弱化 — 逐 test 比对确认、合成孪生非同义反复 — seeded Selection 使 BX-SEL-01 守卫可证伪、合成输入对产品源码可行性双确认: render.js:1241/1254-1276 pan handler 无 e.buttons 检查、ntp.js:853 dblclick 绑定面匹配)。P2×1 (README/报告当时未提交 = 持久化缺口) → 本提交解决; P3×1 (quarantine.yml 缺 --pass-with-no-tests) → 已修 (workflow 与 npm lane 语义对齐); P3×1 (v3 networkidle boot 脆弱面) → 残余 §0 登记。
- 复核后回归: chromium focus-steal 6/6 绿; firefox webdav+extension-test 9/9 绿 (23.8s)。
