# Wave 2026.10.11 — 重修 LOOP 复审报告（第 2 轮审计）

- **日期**：2026-10-04
- **复审对象**：整改提交 `vqn` (`f9e51552`) + 文档提交 `rrp` (`e917f75b`)，分支 `wave-2026-10-11`
- **上游**：第 1 轮审计 [2026-10-04-audit.md](file:///D:/Aworker/crx/boxing/.scratch/wave10-1011-grill/reports/2026-10-04-audit.md)（CONDITIONAL FAIL，2 硬 + 2 中 + 5 软）
- **基线**：base `32df9e9f`；现 diff = 70 files changed, 1636 insertions(+), 139 deletions(-)
- **方法**：独立复跑硬验收 + 逐条复核整改证据 + 新守卫真伪审读 + 测试覆盖核查（不采信整改自述）
- **职责边界**：只出报告、不改代码

---

## 0. 复审结论（TL;DR）

**整改闭环、未达全绿（CONDITIONAL PASS）**。

- 第 1 轮 6 类整改项（H1、H2、M1、M2、L1、L2、L3/L4）**全部独立复核闭环**，硬验收 8 项全绿。
- **新增 1 条遗留规格缺口 R1**：spec S-03 / 账本 D-003 明确要求的新增 e2e（二次点击落 caret / 方向键折叠 / 局部拖选 / 双击选词 / 首点全选不被吞）**未落地**；且本轮整改**改动了 D-003 行为（新增 `preventDefault` + per-focus 标志）却无任何测试覆盖**。
- 结合用户指令「本轮先不发版、另有新问题进下一轮 grill」，R1 并入下一轮 grill 处置。

---

## 1. 硬验收独立复跑（原样重跑）

| 门禁 | 命令 | 实测 | 结论 |
|---|---|---|---|
| 语法编译 | `node --check`（ntp/background/site-constants/settings-ui/render/favicon） | 6/6 OK | ✅ |
| 10 重预检 | `npm run pretest` | **10/10 全绿**，exit 0 | ✅ |
| 打包 | `npm run build` | exit 0，Chrome+Firefox 产物齐 | ✅ |
| E2E 测活 | `playwright ... --project=chromium-extension` | **10 passed (7.4s)**，exit 0 | ✅ |
| 行尾 | `git diff --check` | CLEAN，工作区干净 | ✅ |
| 图谱 | `codegraph sync` | Already up to date | ✅ |
| 字号守卫 | `guard-fontsize` | 16 files, 0 硬编码 px | ✅ |
| 单源守卫 | `guard-site-constants`（self-test + 实跑） | self-test passed / OK aligned | ✅ |

---

## 2. 整改闭环核对（声明 → 证据 → 结论）

| 编号 | 整改声明 | 独立取证 | 结论 |
|---|---|---|---|
| **H1** | 建 `ntp/site-constants.js` 单源；settings-ui 消费；新增构建期一致性守卫并入 pretest | 文件存在，导出 SITE_URL/PRIVACY_URL/DEMO_URL；`settings-ui.js:16` 导入、`:336` 映射 `'about-link-privacy': PRIVACY_URL`（无字面量）；`guard-site-constants.mjs` **真校验**（比对 build/runtime 常量 + 校验 import/消费 + 自检含负例）；pretest 链尾已挂载 | ✅ 闭环 |
| **H2** | ADR-0018/0019 复核日期纠正为 Date+30 | 两份 ADR `复核日期: 2026-11-10` | ✅ 闭环 |
| **M1** | onboarding.css 两处 rem → `--fs-*` | `ntp/*.css` rem font-size 扫描 = NONE | ✅ 闭环 |
| **M2** | 商店文案与文档旧域全量迁移 | `git grep xxx91n.github.io`（排除 .scratch/.archive/.codex-tmp）**仅剩 ADR-0018**（历史/决策叙述，属合理保留）；14 份商店文案 + 发布文档已迁 | ✅ 闭环 |
| **L1** | `#dark-mode-btn` 改 `--fs-lg`；`.about-*` 去 px 兜底 | `:571 font-size: var(--fs-lg)`；`.about-name/sub/version` = `var(--fs-lg/md/sm)` 无兜底字面量 | ✅ 闭环 |
| **L2** | 重构 focus 状态机：`selectedThisFocus` + `guardFirstMouseUp` + `preventDefault` | `render.js:75-111`：focus 分支 `if(!selectedThisFocus)` 条件全选；mouseup `e.preventDefault()` + re-assert；blur 复位两标志 | ✅ 实现闭环 / ⚠️ 无测试覆盖（见 R1） |
| **L3/L4** | 提取 `applyDecodedFavicon`；负缓存去 `is-cached` | `favicon.js:127` 定义、`:169/:222` 复用；负缓存分支（`:159-161`）仅 `remove('is-loading')`+`display:none`，无 `is-cached` | ✅ 闭环 |
| 附 | 无新增 npm 依赖 / 权限 | `package-lock` diff 空；package.json 仅加 2 个 guard script | ✅ |

**新文件**：`ntp/site-constants.js`、`scripts/guard-site-constants.mjs`（`guard-fontsize.mjs`、两 ADR、`.github/scripts/site-constants.mjs` 为原波新增）。
**import-graph**：16 modules / 49 edges / 0 violations；`site-constants.js` 已登记为 leaf。

---

## 3. 遗留发现与观察

### R1（规格缺口，建议下一轮处置）
- **spec S-03 / 账本 D-003 明确要求的新增 e2e 未实现**。原文要求覆盖：二次点击落 caret；方向键折叠选区；局部拖选；双击选词；首点全选不被吞。
- 实测：`test/tests/boxing-title-select-all.spec.ts` 仅有 6 个用例（小/大/面包屑首点全选 + 源契约 + D-005 + D-006）；全仓 `test/` 检索 `caret|ArrowRight|局部拖选|双击` **无任何标题编辑相关覆盖**（命中项均为画布创建/连线删除）。
- 且整改提交 `f9e51552` **未触碰任何测试文件**（`--stat` 无 test 项）——即本轮改动了 D-003 行为却无回归防护。
- 影响：D-003 的修复目前只有「源字符串断言」+ 首点全选用例，**行为正确性未被行为级 e2e 验证**。

### O1（观察，非阻断）
- 整改脚本改写了 4 份**历史** release-notes（`2026.9.12/9.15/9.15.bilingual/9.20`）内的旧 URL。第 1 轮审计曾注明「历史 release-notes 可豁免」；改写历史记录虽无害（URL 会 301），但超出必要范围。

### O2（观察，非阻断）
- 整改版报告/交接仍以「→ 待发版」为阶段口径；与用户最新指令「本轮先不发版」不一致，需以本轮交接覆盖。

### O3（观察，非阻断）
- ADR-0018 正文仍含「彻底清理仓库内对旧域名硬编码引用」表述——现已基本为真（仅其自身历史叙述保留），可接受。

---

## 4. 复审方法备注

- 所有硬验收均由审计窗口**独立复跑**，与整改自述逐项比对；`guard-site-constants.mjs` 经**源码审读**确认为真校验（非空跑），并含负例自检。
- 结论未采信「10/10 守卫、10/10 用例」等自述，均以本窗口实测为准。
