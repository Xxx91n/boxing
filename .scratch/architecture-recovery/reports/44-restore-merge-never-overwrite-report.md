# 报告 — 44 导入/WebDAV 恢复改为合并+冲突副本，废除静默覆盖

- 日期: 2026-09-11
- 分支: ticket-44-restore-merge-never-overwrite（版本控制遵循 WORKFLOW §4.2）
- 提交: nmw (0b5061b) `feat(t44): restore = merge + conflict copies, abolish silent overwrite (spec D4)`
- 阻塞: 43 已 done（43R 绿跑关闭，2026-09-11），开工时核实
- 调研: atomcode 2026-09-11（ctx source=atomcode，13 信源，9 已读原文；Raindrop/Dropbox/Syncthing/Chrome/ownCloud 工业语义）

## 1. 验收对照（issues/44 全项）

| 验收项 | 状态 | 证据 |
|---|---|---|
| 导入含本地已存在 id 的备份后两侧书签都在（或冲突副本可查） | ✅ | `boxing-import-merge.spec.ts` AC1+AC2：本地 L1（local.test/b1）与备份分歧 L1 同 id → 画布保留本地原样 + 新 L2 追加；备份分歧子树 verbatim 归档 `boxingLayout.conflict.<ts>`，index 含 reason=import-merge，raw 可读出 backup.test/b2 |
| 无「静默丢弃本地 bookmarks」路径作为默认 | ✅ | 导入默认 = `mergeImportedLayout` 追加合并（utils.js，纯函数）；WebDAV 字段合并失败回落路径先归档败者再 LWW（sync-engine.js），merge 成功但同字段分歧时云侧入冲突副本；首拉路径本就仅限空本地（BX-FATAL-FIX 不动） |
| 显式覆盖恢复仍可用且有确认对话框 | ✅ | 两段式页内确认框（复用 confirm-modal，askConfirmModal Promise 封装）：先「合并导入」预览，取消→再「覆盖恢复」警示；确认后 saveSnapshot() 先行（COW，ADR-0009/atomcode 4.1-1）再整替。spec AC3：拒绝合并→确认覆盖→备份内容落主键 + 本地侧快照可找回 |
| Playwright：导入合并用例 PASS | ✅ | 本地实跑（44 任务书要求绿跑证据，先例同 43R）：`boxing-import-merge.spec.ts` chromium-extension **4 passed (11.0s)**；含 AC-sync 用例：WebDAV 并发字段分歧 → direction=merge + conflicts=1 + 云侧盒 verbatim 入冲突键，本地盒不被覆写 |

## 2. 改动面

| 文件 | 变更 |
|---|---|
| ntp/utils.js | 新增纯函数 `deepJsonEquals`（键序容忍深比较，防同框误报冲突）、`mergeImportedLayout`（Raindrop 式追加合并：新 id 追加 / 同 id 全等跳过 / 同 id 分歧出冲突副本；连接 from:to 并集去重；settings 本地权威——换偏好属显式覆盖模式职责）；export 表追加 |
| ntp/storage.js | 门面新增 `archiveConflictLayouts(payload, meta)` / `listConflictArchives()`；键 `boxingLayout.conflict.<ts>` + 轻量索引 `boxingLayout.conflict.index`（仿 43 corrupt fork 模式：LRU 上限 20、单条 MAX_SNAPSHOT_BYTES 超限降级元数据、单调 ts 防同毫秒撞键）。分层不变：写入仍只在 storage 门面（ADR-0016） |
| ntp/settings-ui.js | 导入 change 处理改道：空画布=原整替语义（gate 5 平价，不弹窗）；非空=合并预览确认框→执行合并（冲突归档）/ 取消→覆盖恢复二次确认（快照先行）。`askConfirmModal` Promise 封装（一次性监听、resolve 即摘除）；`openConfirmModal` 补按钮文案复位（覆盖场景改过文案）；数据区新增冲突副本行（data-conflict-row） |
| ntp/sync-engine.js | `mergeLayoutFields` 返回 `{merged, conflicts}`：同 id 盒字段分歧 → 云侧盒 verbatim 进 conflictCopies（>3 字段启发式/字段并集行为保留 = 「outbox 合并保留」）；调用方合并成功后先 `archiveConflictLayouts({boxes:conflicts}, 'webdav-field-conflict')`；合并抛错 → 不再静默 newer-wins，先按 LWW 胜者判定归档败者（'webdav-merge-failed'）再落主键；数据丢失守卫的「从云恢复」（用户显式确认路径）也先归档本地侧（'webdav-data-loss-restore'）。merge 返回值附 `conflicts` 计数 |
| ntp/i18n.js + _locales/×14 | 7 新键（importMergeTitle/importMergeBody(带 $1$–$3$ placeholders)/importOverwriteTitle/importOverwriteBody/importBtnMerge/importBtnOverwrite/dataConflictArchived）；14 locale 键集一致性脚本验证 + I18N_FALLBACK 全量（BX-I18N-001/003/005） |
| ntp/index.html | 数据区冲突副本行 markup（hidden，同 corrupt 行样式位） |
| test/tests/boxing-import-merge.spec.ts + test/cluster-map.json | 新 spec 4 用例（文件:// mock 车道，addInitScript 预导航种子，43R harness 纪律）；4 cluster 登记（CM-1 守卫绿：14 modules/48 edges 不变、0 violations） |

## 3. 设计决策（以 atomcode 调研为准）

1. **冲突副本 = 存储键而非画布盒**（spec D4 原文「同 id 字段分歧 → 冲突副本键」）：规避 Dropbox Watchdog 十年批评的「冲突副本噪音污染工作区」；数据经设置-数据区行可查、raw 可再经导入合并路径找回——同时满足验收「两侧书签都在（或冲突副本可查）」。
2. **box 级冲突粒度**（整子树副本，不做盒内字段级拆分）：Chrome 官方明确 id 不固定不可依赖匹配；文件系统级同步（Syncthing 结论）做不到内容合并，保留双方交给上层是工业共识。
3. **不做 URL 归一化去重**：Raindrop 的 URL 键适配扁平库；Boxing 盒嵌套下同 URL 多盒合法、跟踪参数误判风险（Raindrop 自认「尽力而为+事后清理」），box id + 深比较语义更干净。id 冲突时不重映射入画布而是出副本，比 atomcode 推荐的 `imp-` 前缀重映射少一层悬空连接风险。
4. **覆盖恢复保留两段式确认**：Chrome 2025「显式上传」精神——destructive 路径必须用户主动抵达，且不可从默认路径一步滑入。
5. 数据丢失守卫/首拉等既有显式确认与空本地守卫不动（非静默面）。

## 4. 验证

- `node --check` ×5（utils/storage/sync-engine/settings-ui/i18n）：全 0。
- `import-graph-guard`：`{ok:true, 14 modules, 48 edges, 0 violations}`（新 import 均为既有边）。
- `git diff --check`：0。
- 本票 spec：`boxing-import-merge.spec.ts` **4 passed (11.0s)**（workers=2；首轮 workers=4 两例 launch-timeout 为宿主资源竞争，票 01 已知症状，降 workers 全绿）。
- 回归车道（票 44 改动面闭包）：`boxing-data-golden + boxing-sync + data-recovery` 19 passed / 1 skipped；`npm run test:changed` 全闭包 510 passed / 9 failed / 5 skipped（6.0m）。
- **残红定谳（非本票引入）**：9 failed 全部命中基线既有红——GitHub Actions run **34603576542**（branch `ci/data-golden-gates`，本票改动不存在，Test workflow 2026-09-11T13:18:41Z = failure）含完全相同名单：`boxing-title-select-all`×3（seedTitles 的 `applyExternalLayout` revision/writerId 判定路径，storage.js 非本票改动行）、`boxing-empty-state-buttons Bug5-dark`、`boxing-state-sync`(firefox 已知票 31 host-incident 类) 等。本票改动行不触碰上述用例路径；`Bug1` 单跑红为并发资源性（510 全量中不红）。
- Playwright 绿跑方式说明：44 任务书「完成定义 = handoff 完成定义 = issues/44 全部验收项」，验收项 4 要求 Playwright PASS——按 43R 先例（任务书要求 passed 行即本地实跑，覆盖 CI-only 待跑态）执行；CI 复跑由大脑派发。

## 5. issue 状态

issues/44-restore-merge-never-overwrite.md：4 项全勾，Status → done（证据=本报告 §1+§4）。

## 6. 教训（写回候选，WORKFLOW §6）

| 日期 | 来源 | 教训 |
|---|---|---|
| 2026-09-11 | 票44 | 残红定谳要拿「改动不存在的分支 CI run」做基线对照（gh run view --log-failed 名单 ⊇ 本地红名单 = 基线既有），比 stash 自证安全且不碰他票文件 |
| 2026-09-11 | 票44 | mutex 包装器把 `--grep "a|b"` 的管道符二次解释成 shell 命令（cmd 风格）——带正则管子的参数别过 test-mutex，直接缩 workers 重跑整文件 |

## 7. 遗留 / 回报大脑

- 基线残红（title-select-all 3 例、empty-state Bug5-dark、snapshot-rotation、auto-expand、zoom-dblclick、state-sync 偶发）在 `ci/data-golden-gates` run 上即红，建议另立返修票（疑似 41R/42 系 applyExternalLayout revision 判定 + dark-mode CSS 面），非票 44 改动面。
- out of scope（票面已划）：真 outbox 队列 / revision vector / WebDAV ETag(If-Match)、冲突副本「对比/合并/删除」解决 UI（本票只到可查）、冲突副本上传回云（atomcode ownCloud 反面教材，留待 sync 产品化票）。
