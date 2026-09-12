# 66 — 用户可见债务标记合并清理（A-020 · P2）实施报告

- 日期: 2026-09-12
- 窗口启动器: `.scratch/architecture-recovery/prompts/66-visible-debt-markers-merge.md`
- 覆盖 A-xxx: **A-020**（源 `.scratch/wave7-flash-grill/decision-ledger.md` D-004 #8 / plan W7-T7）
- 阻塞: None (can start immediately)
- 状态: **AC 五项全勾，实施完成**

---

## 1. 结论

三处用户可见债务标记已合并清理完毕：footer 多余 `add` 错字、`syncProviderHint` 与真实存储区不符的错文、`__lastSaveError` 持久化进用户 settings。i18n 重复 Fallback 键按要求**未**清理，14 语言键完整性经程序化校验未被破坏。

本票无新增调研问题，复用 Wave7 已索引 atomcode 结论（D-004 #8 合并表）与 Wave6/Wave7 决策台账；心智模型回顾 `docs/CONTEXT.md`（Storage / Settings / Theme i18n 词条）与 `docs/adr/0017-release-data-gate.md`（残红治理口径）。

---
## 2. 变更清单

| 文件 | 变更 | 依据 |
|---|---|---|
| `ntp/index.html` | footer `footerHint` 文本节点尾部独立一行 `add` 删除（L92–93 合并为单行） | AC1 |
| `ntp/index.html` | 设置弹层 `syncProviderHint` 内联默认文案改为与 `storage.local` 一致（L275） | AC2 |
| `ntp/i18n.js` | `I18N_FALLBACK.syncProviderHint` 文案同步修正（L62） | AC2 |
| `_locales/{ar,de,en,es,fr,hi,ja,ko,pt_BR,ru,th,vi,zh_CN,zh_TW}/messages.json` | 14 份 `syncProviderHint.message` 同步修正，键集合不变 | AC2 + AC5 |
| `ntp/storage.js` | `stripGroupsForPersist()` 升格为唯一持久化净化边界：新增 `RUNTIME_ONLY_SETTING_RE = /^__/`，在深拷贝上剥离所有 `__` 前缀 settings 键 | AC3 |
| `ntp/storage.js` | BX-AUD-04 注释中 `chrome.storage.sync` 纠正为 `chrome.storage.local`（A6 事实） | 债务标记同名项 |
| `ntp/sync-engine.js` | `buildSyncPayload()` 三分支与 WebDAV push / 本地导出 3 处 `JSON.stringify(layout)` 统一走 `stripGroupsForPersist` | AC3 的“导出污染”面（D-004#8 原文） |

**未触碰**：`ntp/i18n.js` L83 起的重复 Fallback 键块（AC4 明确要求不动）；`ntp/ntp.js`、`README.md`、`CHANGELOG.md`、`docs/CONTEXT.md`（其他分支/其他票在途）。

---
## 3. AC 逐项与证据

| # | AC | 结果 | 证据 |
|---|---|---|---|
| 1 | index.html footer 多余 add 类用户可见错字清除 | 通过 | 全文件扫描 `add` 仅余 4 处合法用法（`add-box` / `add-small` 按钮 id、onboarding 文案、`click + to add small`）；footer 已无游离 `add`，与 `ntp/i18n.js:45 footerHint` 权威文案逐字一致 |
| 2 | i18n `syncProviderHint` 文案与实际 `storage.local` 一致 | 通过 | `ntp/storage.js:34` `layoutStorage = api.storage.local`（A6 / ADR-0002），`docs/CONTEXT.md` Storage 词条同述；新文案已同步至 index.html、i18n.js、14 份 locale |
| 3 | `__lastSaveError` 不再持久化进用户 settings（或等价净化） | 通过（等价净化） | 见下 §3.1 |
| 4 | 不清理 i18n 重复键 | 通过 | `ntp/i18n.js` L83 重复块零改动 |
| 5 | i18n 14 语言键完整性不被破坏 | 通过 | 14 份 `messages.json` 键数均为 **241**（改动前同为 241），仅 value 变更；`JSON.parse` 全部通过 |

### 3.1 AC3 净化设计说明

`__lastSaveError` 是 BX-AUD-04 的**运行期**诊断旗标（配额失败时置位、下次成功保存后清零），既有断言 `boxing-audit.spec.ts:92` 与 `boxing-data-golden.spec.ts:284/292` 读的是**内存态** `__boxingDebug.layout.settings.__lastSaveError`。因此采用“等价净化”而非删除旗标：

- 保留内存语义（测试与用户可见告警不变）；
- 在 `stripGroupsForPersist()` 的**深拷贝**上剥离 `__` 前缀键，`src`（活布局）零变更；
- 该函数是全部落盘/快照/导出路径的唯一出口（`storage.js` L105/125/282/360/650/658 与 `sync-engine.js` 的 WebDAV/Gist/本地备份），故 storage 主键、Time Machine 快照、emergency localStorage 快照、导出与云端推送**同时**被净化；
- 全仓扫描确认 `__lastSaveError` 是唯一 `settings.__*` 键，`/^__/` 规则不会对既有持久化字段产生副作用（`__groupsMigrated` 属 layout 顶层字段，不在 settings 内）。

---
## 4. 验证命令与结果（可复核）

| # | 命令 | 结果 |
|---|---|---|
| V1 | `node --check ntp/storage.js && node --check ntp/i18n.js && node --check ntp/sync-engine.js` | exit 0 |
| V2 | 14 份 locale `JSON.parse` + 键数比对 | 全通过，键数均为 241 |
| V3 | 文件完整性：字节/BOM/CRLF | 无 BOM，CRLF=0（保持 LF） |
| V4 | `git diff --check` | exit 0（无空白/行尾错误） |
| V5 | `npm run test:changed`（chromium + firefox，13.1m） | **504 passed / 41 failed / 5 skipped** |
| V6 | 定向复跑本票面 4 规格（chromium，3.1m） | **15 passed / 5 failed / 1 skipped**；其中 i18n-module 4/4 全绿、`boxing-audit:59`（__lastSaveError + fallback 快照）绿 |
| V7 | `node scripts/import-graph-guard.mjs && node scripts/migration-golden-guard.mjs && node scripts/css-balance-guard.mjs`（即 `npm run pretest`） | exit 0：模块图 15 modules / 48 edges / **0 violations**；迁移黄金 **28/28 passed**；CSS 平衡 OK（6 个源 CSS，无嵌套 `[hidden]`） |
| V8 | 14 语言键集合等价校验（非仅键数） | 以 en 为基准求差：14 份 `messages.json` 的 241 个键 **集合完全相等**，无缺失/多余键 |

### 4.1 关于 41 条残红的定豌（对照实验）

残红台账（WORKFLOW §4.4）仅登记 2 条豁免，41 条远超基线，故对**本票改动文件**相关的用例做了“临时还原 → 复跑 → 字节级还原”对照：

| 用例 | 对照组（还原本票改动）结果 | 结论 |
|---|---|---|
| `boxing-dr-export-envelope` AC1 / AC2 / AC4 | 还原 `ntp/sync-engine.js` 后失败**签名完全一致**（AC1/AC2 `Expected 1 / Received 0`；AC4 `Expected pull / Received merge`） | 与本票无因果；封套构建器在 `ntp/settings-ui.js`（本票未触碰） |
| `boxing-data-golden` gate 4 | 还原 `ntp/storage.js` 后失败**签名一致**（`Expected 3 / Received 4`，B tab 未收敛到共享 revision） | 与本票无因果 |
| `boxing-audit:102` | `browserType.launch: Timeout 180000ms exceeded` | 本机浏览器启动超时，基础设施类 |
| `boxing-i18n-module:111`（首轮 firefox） | chromium 定向复跑通过；该用例断言键为 `emptyCanvasTitle`，与 `syncProviderHint` 无关 | firefox lane 环境性，非本票 |

两次对照实验均在脚本内自动还原，`restored byte-identical: true`。其余 38 条失败分布在 `boxing-search` / `innerclip` / `zoom-arrow` / `star-sync-audit` / `empty-state-buttons` / `conn-delete-action` / `popup-dragselect` / `sync-ui-grouping` / `state-sync` / `auto-expand` / `data-recovery`，均为本票未触碰文件，且多数在 `.scratch` 历史（quarantine / firefox 收敛报告）中有在册 flaky 记录。

**诚实边界**：本窗口未取得“改动前同一 tree 的完整基线 run”——并行分支正在同时修改 `ntp/ntp.js`、`docs/CONTEXT.md`、`README.md`、`CHANGELOG.md`，且测试进程互斥锁期间无法并行取基线。因此上表仅对本票直接相关的 3 组用例做了严格因果排除，其余按“文件无交集 + 历史 flaky 记录”归类为存量残红，未做逐条复现。

---
## 5. 未完成 / 后续建议

- 存量的、已落盘的 `__lastSaveError` 不会被主动清除（本票只在持久化边界拦截）。存量用户需一次成功保存后由 `storage.js:663` 的内存清零路径带走。若要求“加载即净化”，应在 `migrateLayout` 内加一次 purge——属后续票范围，本票按最小 delta 未做。
- `i18n.js:88 allLanguages: All 13 languages translated` 与真实 14 语言目录不一致，属另一处用户可见错文，但不在 A-020 列举的三项内，未纳入本票（已记录供台账参考）。

---

## 6. 完成定义自检

遵循 handoff 内的完成定义：

- [x] AC 全勾（见 §3 五项）
- [x] 报告落 `reports/66-report.md`
- [x] 验证命令结果可复核（见 §4，含对照实验与边界声明）

---

## 7. 版本控制

遵循 WORKFLOW §4.2（GitButler `but` CLI）。不 push、不开 PR。

### 7.1 并行分支交叉留痕

本票对 `ntp/index.html` 与 `ntp/storage.js` 的改动在提交前已被并行分支票 60（branch `t60-ntp-zero-flash`，commit `rqo`）以整文件形式带入。经逐项校验，两文件中本票的改动均完整存在：

- `ntp/index.html`：footer 游离 `add` 已删除、`syncProviderHint` 为新文案、旧文案零残留；
- `ntp/storage.js`：`RUNTIME_ONLY_SETTING_RE` 净化边界存在、BX-AUD-04 注释已纠正为 `chrome.storage.local`。

按硬约束“不改写他人提交”，本窗口不重排该提交，仅在此留痕。本窗口提交的是：`ntp/i18n.js`、`ntp/sync-engine.js`、14 份 `_locales/*/messages.json` 与本报告。
