# Backlog — Wave10 Round-3 审计遗留项（2026-10-14 审计窗口登记；同日修复回写）

> 来源：审计窗口对 `wave-1011-round3` 的硬验收复跑 + 双轴评审。
> 状态口径：✅已修并复核 / 🕓待拍板（审计窗口解决不了或不该替用户定的）。

| ID | 类别 | 发现 | 处置与复核证据 | 状态 |
|---|---|---|---|---|
| B-01 | 测试基建 | `boxing-star-sync-audit` S2/S3 固定 sleep 在 4-worker 满载下读早→flake（354/1/1、353/1/2 两轮实证） | S2 hasBoxB、S3 star/unstar 双向改 `expect.poll`（同文件 S1 既有惯例）+ 30s 预算 + 显式 setTimeout(60s/90s)。复核：repeat-each=4 → 12/12；全量 chromium 重跑 **355/1/0** | ✅已修（commit 见 but log） |
| B-02 | docs/注释 | focus-steal L163-166 注释称合成块跑在 "firefox 无原生输入"车道，与 D-012 矛盾 | 改写为「合成块=双车道 app 级守护契约」 | ✅已修 |
| B-03 | test-evidence 逻辑 | walkSpecs flaky 双计 passed | retried-passed 只计 flaky 列，与 playwright 口径一致 | ✅已修（子集端到端复核绿） |
| B-04 | test-evidence 健壮性 | headedStates 正则扫注释/单引号限定/终止符失配 | 先剥 `//` 注释再扫描；name 兼容单双引号；project 体按 name 标记切片 | ✅已修（headed 列仍正确显示 headless） |
| B-05 | test-evidence 口径 | workers 硬编码 CI?2:4 | extra args 解析 `--workers`/`--workers=N`，缺省回落 CI?2:4 | ✅已修 |
| B-06 | test-evidence 口径 | waiver active 行数扫整个 WORKFLOW.md | 复用 waiver-ledger-check 节区切片（`### G-A 残红书面豁免台账` → 下个 `## `） | ✅已修（active rows 0 复核一致） |
| B-07 | spec 字面偏差 | `git rev-parse --short` vs spec 全 sha | 改全 sha；dirty 标记保留（GitButler workspace sha=实测树，语义正确） | ✅已修（块内 `8559e47f… (dirty)` 实证） |
| B-08 | 流程/纪律 | 两探针绕 test-mutex 直起浏览器 | 探头加「手工探针、勿与套件并行」显式警示（转正式工具时再议包 mutex） | ✅已修（注释级） |
| B-09 | 测试基建 | data-recovery 导出写仓库外 `../test-results` | 改 `EXTENSION_PATH/test-results/`（gitignored）；复核：隔离跑 5/5，导出落 `boxing\test-results\roundtrip-export.json` | ✅已修 |
| B-10 | 整洁 | 两探针脚手架近重复 | 权重过低不建议动（.scratch 一次性件）；若用户想收进正式工具链再抽公共件 | 🕓待拍板：建议弃 |

## 待拍板汇总（审计窗口无权替用户定的）

- **B-10**：探针脚手架去重 —— 建议弃（.scratch 一次性件）。
- **flake 观察面扩员**：B-01 已修绿，但本轮证明「跨 tab 传播窗 >10s」在满载下真实存在；star-sync-audit 建议并入 D-013 观察清单一起盯（不修产品、不豁免，纯观察）——需用户确认是否把该 spec 写进观察名单。
- **V-01..V-03** 过程违规（探针绕 mutex / docs commit 夹带可执行探针 / 两 docs commit 消息近重复）：审计已呈报，是否记教训由用户定。
