# 票 51 收口报告 — 导出信封/完整容灾包 + 覆盖必先副本 + RPO/RTO ADR

- 票面: issues/51-dr-export-envelope-rpo.md（覆盖 A-001, A-003, A-006, A-011）
- 决策: spec W6-D2 / D-006 混合导出策略（atomcode 2026-09-12 调研，.scratch/wave6-dr-grill/decision-ledger.md 复用，未重复全量调研）
- 版本控制: 遵循 WORKFLOW §4.2 — commit `ynu` on branch `t51-dr-export-envelope-rpo`（本地 but commit，未 push、未开 PR）
- 日期: 2026-09-12

## 验收项逐条对照

| AC | 内容 | 实现 | 证据 |
|---|---|---|---|
| 1 | 默认导出含 layout + meta 索引不含正文 | ntp/settings-ui.js `buildExportEnvelope()`：`{ _exportedAt, meta:{ schemaVersion, fullPackage:false, snapshots[], corrupt[], conflicts[] }, layout }`；meta 条目来自 `listSnapshots()/listCorruptArchives()/listConflictArchives()`（仅 {ts,schemaVersion,size} 级索引） | spec AC1：`meta.snapshots[0].data` undefined、`_bodies` undefined、顶层 `boxes` 不存在 |
| 2 | 可选完整包含正文；体积预估+5MB 处理 | 新增第二按钮 `#export-full-dr-btn` → `doExportEnvelope(true)`：`meta.fullPackage=true` + `_bodies`（ntp/storage.js 新增 `readDrBodies()`，verbatim 读 snap.v1/corrupt/conflict 正文）；下载前 `JSON.stringify` 预估体积，>5MB 时从最旧快照正文裁剪并计 `meta.bodyTrimmed`，纯元数据仍超限则回退标准信封并 `alert(i18n('exportFullOverflow'))` | spec AC2：`_bodies.snapshots[0].data.boxes[0].title === 'Seeded Snap'`，索引仍无正文 |
| 3 | 文件名 boxing-backup-YYYYMMDD.json | `_ymd()` 本地日期 → `'boxing-backup-' + _ymd() + '.json'`（替换旧 `boxing-backup.json`） | spec AC1/AC2 断言 `/^boxing-backup-\\d{8}\\.json$/`（HTMLAnchorElement.click 钩子捕获 download 名） |
| 4 | 同步/导入覆盖必先本地副本+测试 | ①导入覆盖恢复：settings-ui.js overwrite-confirmed 分支 `saveSnapshot()`（票44已有，本次测试钉死）②WebDAV cloud-newer pull：sync-engine.js 写入前新增 `if (computeBoxCount(layout).total > 0) await saveSnapshot()` ③WebDAV data-loss restore-from-cloud：conflict 归档后追加 `saveSnapshot()` 统一口径 ④首拉且本地为空 → 无可丢数据，明确不快照 | spec AC4：pull 后 `snap.v1.index` ≥1 且最新快照体含被丢弃的 'Pre-Pull Root'；boxing-import-merge.spec.ts 已覆盖 ① |
| 5 | RPO/RTO 入 ADR-0009 修订并交叉 ADR-0017 | docs/adr/0009：新增「## 修订 2026-09-12（票 51）」节 = 信封契约 / 覆盖必先副本矩阵（4 入口表）/ RPO 定义（破坏性入口 COW⇒RPO=0；稳态 ≤ 自动备份间隔 ≥1h；离线=距上次导出）/ RTO 定义（crash-rescue≈0、Time Machine 秒级、整机丢失 ≤5min 目标）；交叉 ADR-0017。docs/adr/0017：「数据兼容义务」新增票51 交叉引用段——G-A 数据完整性类测试永不豁免；G-B 必须实测「信封导出→换 profile 导入还原」+「pull 覆盖后快照回滚演练」并记录 `_exportedAt` 作 RPO 证据 | 两文件 diff |
| 6 | 导入信封可还原当前布局 | ntp/utils.js 新增纯函数 `unwrapExportEnvelope(data)`（信封→裸 layout；legacy 裸 dump 直通；非法→null），settings-ui.js 导入 handler 在 SEC-06 校验前调用；SEC-06 2MB 上限语义=作用于解包后的 layout 载荷（落进存储的东西），非信封索引 | spec AC6（空画布直还原）+ AC6b（非空画布走票44合并管线，两侧都在） |

## 改动文件清单（commit ynu，25 个）
- 代码: ntp/settings-ui.js, ntp/storage.js, ntp/sync-engine.js, ntp/utils.js, ntp/i18n.js, ntp/ntp.js, ntp/index.html
- 测试: test/tests/boxing-dr-export-envelope.spec.ts（新增 5 用例）, test/tests/data-recovery.spec.ts（旧断言信封化适配）
- 文档: docs/adr/0009-3-2-1-data-resilience.md, docs/adr/0017-release-data-gate.md
- i18n: _locales/{en,zh_CN,zh_TW,ja,ko,fr,de,es,pt_BR,ru,ar,hi,th,vi}/messages.json（exportFullPackage / exportFullOverflow 两键 × 14 语言；A7 键完整性已本地核对）

## 本地验证（CI-only 政策下仅做语法/解析级）
- `node --check` storage/settings-ui/sync-engine/utils/i18n/ntp/background 全 0
- 14 个 messages.json JSON.parse 全过 + en 键集与各 locale 键集 parity 0 差异
- 全部编辑文件 BOM=false / CRLF=false；`git diff --check` exit 0（仅 .scratch 下他人未提交文件的 CRLF 提示，与本票无关）

## 未验证 / 遗留
- Playwright 测试未本机运行（构建/测试一律 CI 政策，AGENTS.md 2026-09-04 mandate）。测试证据待大脑 Agent 推送本分支触发 workflow 后以 CI run 为准；spec 文件为 test/tests/boxing-dr-export-envelope.spec.ts，5 用例。
- issue 勾选框未改（关闭/勾选取证属主 Agent 复核职责，见 D-007 门禁纪律；本票不越权）。
- 与票 50（Time Machine 回滚 UI）共享 sync/storage 面：本票只在写入前插快照，不碰 UI 行；票 50 的 `saveSnapshot('pre-restore')` 参数化如落地，本票调用点（无参 `saveSnapshot()`）兼容——参数为可选。

## 结论
票面 6 项验收全部实现并各有 spec 断言对应；版本控制遵循 WORKFLOW §4.2。等待 CI run 作为最终绿证据。
