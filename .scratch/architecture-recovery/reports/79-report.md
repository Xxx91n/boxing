# Report 79 — 冲突副本读取口（ticket 79 / A-029 / Wave8）

> 日期: 2026-09-12 · 窗口: 票 79 实施 · 状态: implemented（源码+测试落地，测试证据走 CI）

## What to build（票面）

设置数据区列表展示 conflict 副本并支持单条导出 JSON。

## 实现摘要

- **storage.js**：新增只读单条 getter `getConflictArchive(ts)`（`CONFLICT_PREFIX + ts` body 直查，body 被轮转剪除或 ts 未知时返回 null）。**零写入** — `archiveConflictLayouts` / `_readConflictIndex` / 轮转 / 上限 20 / MAX_SNAPSHOT_BYTES 归档写入语义全部未动（issue 79 AC3）。
- **ntp/index.html**：数据区 Data tab 在 conflict 计数行后新增 `#data-conflict-list-wrap`（label `dataConflictList` + `#data-conflict-list` 容器），复用 Time Machine 容器结构，无副本时 hidden。
- **ntp/settings-ui.js**：
  - import 增 `getConflictArchive`；
  - `refreshDataHealth`（单一 seam，随每次 modal open 重建）在 conflict 行后渲染列表：每副本一行 `ts / reason / side / size`（newest first，复用 `SNAPSHOT_LIST_MAX`=20 上限与 `formatSnapshotSize`，复用 Time Machine 行模式），行内 per-row `.data-conflict-export-btn` 按钮；`cWrapEl.hidden = rows.length === 0`；
  - 新增 `exportConflictCopy(ts)`：经只读 facade 取归档 entry，`JSON.stringify(entry, null, 2)` 下载为 `boxing-conflict-<ts>.json`；body 不可用时 fail-soft（debugWarn，无半截下载）；
  - `bindSettingsUi` 增委托点击（`#data-conflict-list` → `.data-conflict-export-btn` → `exportConflictCopy`），与 Time Machine 委托并列。
- **ntp/i18n.js**：`I18N_FALLBACK.dataConflictList = 'Conflict copies'`、`I18N_FALLBACK.dataConflictExportBtn = 'Export'`（BX-I18N-005 fallback 覆盖）。
- **_locales/**：14 locales 各 +2 键（`dataConflictList` / `dataConflictExportBtn`，各语言翻译），各 243 键，A7 validator 兼容（键集合一致）。

## 检查点（handoff delta）

复用 settings-ui 数据区：✔ — 列表渲染在 `refreshDataHealth`（既有数据健康 seam）内，行模式复用 Time Machine（t50 spec W6-D1）实现，导出复用 `downloadJson`/blob 模式（t51 spec W6-D2 同型）。

## 专属验收

有副本时 UI 非空：✔ — seed 一条 conflict 归档后列表渲染 1 行（含 reason/side/size/Export 按钮）；无副本时 wrap hidden（负例断言）。

## 测试（新 spec：test/tests/boxing-conflict-copy-readout.spec.ts）

file:// mock lane（t50/t51 harness 纪律）：seed 走 t41R seam（`__boxingDebug.storageSet` 写 `boxingLayout.conflict.<ts>` body + `boxingLayout.conflict.index`），导出捕获 patch `URL.createObjectURL` + `HTMLAnchorElement.click`（t51 先例），不触 `window.chrome.storage`（SEC-01）。

| 用例 | AC 覆盖 |
|---|---|
| AC1: 有副本时列表 1 行，含 reason/side/size/Export 按钮 | 列表可见 + 专属验收 |
| AC1-neg: 无副本时 wrap hidden、0 行 | 列表可见（负例） |
| AC2: Export 下载 `boxing-conflict-<ts>.json`，JSON 含 verbatim entry（ts/reason/side/raw.boxes） | 单条导出可用 |
| AC3: 读取+导出后 index 长度/字段与 body 原文不变 | 不改归档写入语义 |

## 验证

- `node --check ntp/storage.js && node --check ntp/settings-ui.js && node --check ntp/i18n.js` → 3/3 exit 0
- `git diff --check` → exit 0（LF 干净，无 CRLF 引入）
- `_locales/` diff → 每份仅 +8 行（两键），无格式重写污染
- codegraph sync → +1 新文件（新 spec），9 modified
- Playwright e2e（4 用例）→ 本机按 CI-only 政策（2026-09-04 用户指令）不运行；测试证据由 CI run/artifact 认定
- 版本控制：WORKFLOW §4.2 — `but commit` commit zpm，分支 `ticket-79-conflict-copy-readout`（仅本票文件；其他并行窗口文件 ntp.js/sync-engine/utils/background/popup/boxing-audit/boxing-search 未纳入）

## 调研复用声明（D-005）

- handoff 79 必读清单已读全（spec / decision-ledger / WORKFLOW / destination-reconciliation / docs/CONTEXT / AGENTS / issue）。
- 数据层心智模型沿用 spec D4（Dropbox conflicted copy / Syncthing .sync-conflict lifecycle，atomcode 2026-09-11 调研已沉淀 storage.js 注释）；导出工业形态沿用 t51 W6-D2 envelope 研究（pg_dump-vs-WAL 分离）。
- 未新增 ADR 冲突项；未改归档写入语义；未扩 ADR-0017 门禁。

## 约束遵守

- 不 tag、不宣称可发行、不扩 ADR-0017：✔（本报告无 ready-to-use / 可发行宣称）
- 优先既有 Playwright seam：✔（refreshDataHealth / storageSet / blob 捕获均为既有模式）
- CSS dual-write：不适用（settings modal 内联样式，仅复用既有行样式，无 .large-box/.small-box 规则）

## 遗留

- e2e 4 用例待 CI run 取证（本机禁测试运行）。
- ticket 82 的 `webdavAllowPrivateHost` locale 键同步由票 82 窗口负责（本票 14 locales 仅 +2 键，各 243 键）。

---

# 返工轮次 — 79R：cluster-map 登记 conflict-copy spec（2026-09-12）

> 触发: reports/W8-W1-brain-review.md 违规 PV-W8-79-1 · 启动器 prompts/79R-conflict-copy-cluster-map.md

## 首脑复核（开工第一句）

- 违规点: **PV-W8-79-1** — 报告验证清单未含 import-graph-guard；**CM-1 红**（`boxing-conflict-copy-readout.spec.ts` 未被任何 cluster 覆盖；guard 实测输出确认该违规）。
- 必读: brain-review / 79-report / handoff-79R / issue-79R / cluster-map.json / WORKFLOW 已读全；guard 实跑取证。
- 认同: **认同首脑裁定**，无修正 — 最小修复按 handoff 准则（seam 以 storage getter 为准则优先 storage）执行。

## 最小修复

- `test/cluster-map.json`：`boxing-conflict-copy-readout.spec.ts` 归入 `ntp/storage.js` cluster（+1 行；spec 的数据 seam 是只读 getter `getConflictArchive`，storage facade 为准则）。仅此一处，未加进 settings-ui.js cluster（准则要求二选一取 storage），未改生产逻辑。

## 验证（重跑同一套）

- `node scripts/import-graph-guard.mjs` → exit 0，**CM-1 零命中**；violations 仅剩 credentials.js B-6×4（72-81 行，属票 81 范围 = PV-W8-81-1，非本票修复面）
- `node --check` ntp/storage.js / settings-ui.js / i18n.js → 3/3 exit 0
- `cluster-map.json` JSON.parse → OK
- `git diff --check` → exit 0
- 版本控制：WORKFLOW §4.2（`but commit`，79R 改动独立提交后 amend 进所属 commit）

## 遗留（承接）

- credentials.js B-6×4 归票 81 返工（PV-W8-81-1）；e2e 4 用例仍待 CI run 取证。
