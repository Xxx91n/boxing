# 报告 — 52 新装/重置默认 sameTab（以实机为准）

- 日期: 2026-09-12
- 分支: ticket-52-url-open-mode-sametab-default（版本控制遵循 WORKFLOW §4.2）
- 阻塞: None（开工时核实）
- 调研: 无新增调研问题——复用 Wave5/6 已索引 atomcode 结论（ctx source=atomcode：票44 导入/冲突语义 13 信源、票46/ADR-0017 门禁 18 信源）；urlOpenMode sameTab-default 的工业对标在票 11（be86676）已定谳，本票按 handoff 通用调研要求注明来源，未新起 atomcode。

## 1. 验收对照（issues/52 全项）

| 验收项 | 证据 |
|---|---|
| 新装或重置后点击书签=当前标签导航 | T52-b（真实 .bm-row DOM 点击 → 当前标签导航至 https://t52.example.test/bookmark，context.pages()=1 无新标签）；代码面 §2 三处收口 |
| 根因覆盖：旧包/重置未清 settings/首帧 DOM/残留写路径 | 四面定谳见 §3 |
| 不接受仅改下拉显示关票 | 修的是解析/迁移/首帧三层：openBookmarkUrl 解析规则、migrateLayout v2 写路径、HTML 首帧 selected；T52-a/b/d/e 全部是行为断言 |
| Playwright 空 storage 新装路径断言 | T52-a（resetBoxing 清空 localStorage 后模型默认=sameTab 且主键回写不含 newTab）+ T52-e（未知/残留值→sameTab） |

## 2. 改动面

- `ntp/ntp.js`（openBookmarkUrl）：`urlOpenMode || 'sameTab'` → 仅显式 `'newTab'` 才开新标签，缺失/未知（旧包残留值）一律 sameTab，与 popups.js 书签行契约对齐。
- `ntp/utils.js`（migrateLayout v2 分支）：`Object.assign(raw.settings || {…}, {theme})` → `{ ...defaultLayout().settings, ...(raw.settings || {}) }`，v2 迁移写路径不再产出缺 urlOpenMode 的 settings 块（显式存量 newTab 仍保留——A-004 口径）。golden-guard 28/28 不破（v2 KNOWN GAP 的 schemaVersion/connections 归一注释仍由 second-pass 兜底，属票45 upstream 边界，不跨票扩面）。
- `ntp/index.html`：`<option value="sameTab" selected>` 置前——首帧 DOM 不再默认 newTab（syncSettingsDOM 此前仅在 modal-open / applyExternalLayout 后运行）。
- `test/tests/boxing-settings-persist.spec.ts`：新增 Ticket 52 describe（T52-a..e），12/12 绿。

**提交归属说明（重要）**：实施期间并行窗（ticket 51）以文件级 id 提交 `a714de8 feat(t51)`，将本票三处 ntp 源文件 hunk（同文件混挂）一并卷入其 commit；hunk 内容已落盘（git log -S 三锚点均命中 a714de8），本票分支仅承载 spec + issue + 本报告。按 §4.2「不改写他人提交」未做 uncommit 手术。

## 3. 根因四面定谳

1. **旧包（实机症状的直接解释）**：用户实机 zip/dist 构建于 097c31a（2026.9.12 版本统一）——早于票11 be86676 的 sameTab 默认；v3.7.1 语义「书签恒开新标签」（boxing-v3.spec 注释）。源码现势无此行为。纠偏 = 用当前源码重建发行包（G-B 检查单「全新安装」项复核，见 §7）。
2. **重置未清 settings**：应用内无 factory-reset（grep 全库 0 命中）；重置路径 = 存储清空 → loadLayout else 分支落 defaultLayout()（urlOpenMode=sameTab 已在）→ T52-a 空 storage 断言钉死。真正的「设置不干净」写路径是 migrateLayout v2 分支产出缺键 settings（本票 §2 已修）。
3. **首帧 DOM newTab**：index.html select 首 option=newTab 且无 selected → JS 同步前 DOM 值=newTab。已修（selected 置前）；T52-c 钉死首帧（syncSettingsDOM 仅 modal-open/applyExternalLayout 触发，boot 期不跑）。
4. **残留写路径**：全库写 urlOpenMode 仅 settings-ui.js:219（用户显式 change）；读点三处（popups.js 行点击、ntp.js openBookmarkUrl、settings-ui syncSettingsDOM）现全部「缺/未知→sameTab，显式 newTab→newTab」。background.js/sync-engine/onboarding/credentials 0 触碰。T52-e 防御未知残留值。

## 4. 验证

- `node --check` ntp.js/utils.js/background.js：全 0。
- `migration-golden-guard`：{ok:true, 28/28}（v2 分支改动后复跑，二次通过归一契约不破）。
- `import-graph-guard`：通过（无新 import）。
- `git diff --check`：0（spec.md CRLF 警告为并行窗文件，非本票）。
- 本票 spec：boxing-settings-persist **12 passed (13.3s)**（chromium-extension lane，workers=2）。
- 回归车道（改动面闭包）：boxing-migration-golden + boxing-v3 + boxing-import-merge **23 passed (13.5s)**。
- 全量闭包 `npm run test:changed` 与 CI 复跑由大脑派发（共享工作树含票51/49 WIP，本窗不跨窗自证）。

## 5. issue 状态

issues/52-url-open-mode-sametab-default.md：4 项全勾，Status → done（证据=本报告 §1+§4）。

## 6. 教训（写回候选，WORKFLOW §6）

| 日期 | 来源 | 教训 |
|---|---|---|
| 2026-09-12 | 票52 | 共享工作树并行窗在**同一源文件**各有 hunk 时，后提交窗的文件级 `but commit <file-id>` 必然先卷走他人未提交 hunk（票05 整文件教训的 hunk 级变体）：开工前 `but status` 若见同文件 M 且非本票，应在报告钉死归属；根治 = 同文件并发票错峰提交或提交前 `but diff <file>` 逐 hunk 认领并等待窗口间互让 |

## 7. 遗留 / 回报大脑

- **发行包重建**：实机症状的直接根因是旧 zip；下一发行 zip 必须由含票11+本票的源码构建（构建走 CI，本机不产构建产物）。G-B 人工黄金路径「全新安装 → 点书签=当前标签」为用户复核项（A-009），建议并入票49 检查单执行。
- a714de8（t51）混挂本票三 hunk：如需净归属历史，由大脑裁决是否 rebase 拆分；本窗按 §4.2 不动他人提交。
- v2 迁移分支 schemaVersion/connections 缺键（golden-guard KNOWN GAP 注释）仍归票45 upstream 口径，本票未扩面。
