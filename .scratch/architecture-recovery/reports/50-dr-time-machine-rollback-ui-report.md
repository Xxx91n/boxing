# 报告 — 50 Time Machine 一键回滚 UI + 恢复前安全快照

- 日期: 2026-09-12
- 分支: t50-dr-time-machine-rollback-ui（stacked on t51-dr-export-envelope-rpo；版本控制遵循 WORKFLOW §4.2）
- 提交: oxn (6562c17) `feat(t50): Time Machine rollback UI + pre-restore safety snapshot (spec W6-D1)`
- 阻塞: None（开工时核实；实现依赖 t51 已在途的 settings-ui import 行改动，故按 but Hint stack 到 t51 之上）
- 调研: atomcode 2026-09-12（ctx source=atomcode，17 信源，官方文档为主；JetBrains Local History / VS Code Timeline / Obsidian File Recovery / macOS Time Machine / Chrome Enterprise rollback / Mitratech TeamConnect / unf / claudette #47 / Claude Code #27387 反例）

## 1. 验收对照（issues/50 全项）

| 验收项 | 状态 | 证据 |
|---|---|---|
| 快照列表含 ts/schemaVersion/size | ✅ | 设置-数据区 Time Machine 区块（index.html `#data-snapshot-timemachine`）：`refreshDataHealth()` 每次开弹窗重建行（最新在上、上限 20），每行 = `toLocaleString()` 时间 + `v<schemaVersion>` + `formatSnapshotSize()`（B/KB）+ Roll back 按钮。spec AC1 断言行文本含 `/v\d+/` + `/\d+(\.\d+)? ?(B|KB)/` + 按钮可见 |
| 一键回滚二次确认后执行 restoreFromSnapshot | ✅ | 行按钮 → `performSnapshotRollback(ts)`：先 `askConfirmModal`（页内共享确认框，t44 封装）二次确认，确认文案点名目标时间点与「先存安全快照、可再撤销」；确认后 `restoreFromSnapshot(ts)` → `replaceLayoutFromRestored()` 整替落盘 → 全量重渲染 → 回到设置页。spec AC1：确认框未决时画布 A+B 原样，确认后内存与主键双双 = ['A']（替换而非 merge——B 只能从安全快照找回） |
| 恢复/覆盖/导入前自动 pre-restore 快照 | ✅ | 四个整替/变更入口统一 `saveSnapshot('pre-restore')` 先行：① Time Machine 回滚（fail-closed：快照返回 null 即取消回滚并提示，W6-D1 禁止无安全快照的整替）；② 导入 merge 路径（新增，spec AC3：合并前快照体 = 导入前画布 ['Local Root']）；③ 导入空画布整替（新增）；④ 导入覆盖恢复（t44 已有，补 reason 标签）。WebDAV「从云恢复」显式路径 t44 已有归档先行。spec AC3+AC1 断言 index 计数 +1、体 `reason='pre-restore'`、且 index 条目仍仅 {ts,schemaVersion,size}（41R pin 不破） |
| Playwright：回滚往返 + 安全快照计数 | ✅ | `boxing-time-machine-rollback.spec.ts` 3 用例（AC1+AC2 回滚往返+计数、AC2-dismiss 取消零副作用、AC3 merge 快照先行），chromium-extension 本地实跑 **3 passed (4.5s)**；t44 §4 先例（任务书要求绿跑即本地实跑，CI 复跑由大脑派发） |

## 2. 改动面

| 文件 | 变更 |
|---|---|
| ntp/storage.js | `saveSnapshot(reason)`：可选标签只写快照体（index 保持 41R 元数据契约）；返回值 ts/null 供调用方 fail-closed；单调 ts 守卫（防同毫秒撞体键，先例=t44 `_lastConflictTs`）。新增门面出口 `replaceLayoutFromRestored(recovered)`：恢复整替写腿——刻意绕过 `mergeConcurrentLayout`（跨标签并集合并会把回滚掉的盒复活），保留 t43R「损坏载荷归档先行」+ revision 续号两个不变量；写成功后才 `setLayout`+重建索引（quota 失败拒改内存态）。分层不变：所有 storage 写仍只在门面（ADR-0016） |
| ntp/settings-ui.js | Time Machine 行渲染进 `refreshDataHealth()` 单一 seam（开弹窗即刷新）；`performSnapshotRollback(ts)`：closeSettingsModal→askConfirmModal（t44 平价，防叠层）→saveSnapshot('pre-restore') 失败即 alert+返回→restoreFromSnapshot 缺失即返回→replaceLayoutFromRestored→exitToCanvas+全量重渲染→重开设置页。行按钮走 `#data-snapshot-list` 委托 click（行每次重建，直绑会泄漏）。导入三入口统一补 pre-restore 快照（见 §1 行3）；覆盖入口由裸 `saveSnapshot()` 升级为带 reason |
| ntp/index.html | 数据区 Health 节内新增 `data-snapshot-timemachine` 区块（hidden 兜底 + `data-i18n="dataTimeMachine"` 标签 + 空 `#data-snapshot-list` 容器，由 JS 填充） |
| ntp/i18n.js + _locales/×14 | 8 新键（dataTimeMachine/dataRollbackBtn/rollbackConfirmTitle/rollbackConfirmBody/rollbackConfirmAction/rollbackNoSafety/rollbackSnapshotMissing/rollbackFailed）；`rollbackConfirmBody` 用命名占位符 `$point$`+placeholders{$1}（BX-I18N-003）；脚本验证 14 locale 键集与 en 平价 + I18N_FALLBACK 全量（BX-I18N-001/005） |
| test/tests/boxing-time-machine-rollback.spec.ts + test/cluster-map.json | 新 spec 3 用例（file:// mock 车道，t41R/t44 harness 纪律：`__boxingDebug` seam、无 unload-flush 窗口；行按钮点击用 evaluate-dispatch——onboarding 遮罩拦 pointer，同 t44 合成输入先例）；4 cluster 登记。顺带把 t51 遗留未登记的 `boxing-dr-export-envelope.spec.ts` 补进 clusters（清 pretest CM-1 既有违例，非本票改动引入） |

## 3. 设计决策（以 atomcode 调研为准）

1. **回滚=整替而非 merge**（对比矩阵 unf/claudette 语义 + spec W6-D1「一键回滚」）：回滚到时点必须精确，`mergeConcurrentLayout` 的并集会复活被回滚掉的盒；安全层由「替换前必存快照」承担（restoring is itself reversible, unf HN）。跨标签可见性由 revision 续号 + `directSet` 语义外的正常 onChanged 通知路径保住。
2. **pre-restore 快照 fail-closed**（claudette PR #47「never clobber newer content」精神）：`saveSnapshot` 返回 ts/null 区分成功/失败；回滚路径拿不到安全快照即中止，绝不「裸替换」。导入 merge/replace-empty 属 best-effort（无内容可丢的兜底，失败不阻断 UX——与 t44 覆盖路径的 fire-and-forget 平价），但三者共用同一 reason 标签供 UI/审计分辨。
3. **reason 写体不写索引**（41R `indexFields == ['schemaVersion','size','ts']` 是 pin 死的契约，`boxing-snapshot-rotation` 在跑）：标签语义（`pre-restore`）在体上，UI 需要时按 ts 拉体即可；不动索引形态=不碰并行票面与既有门禁。
4. **确认文案与动作语义一致 + 当前版本不禁按钮**（负面案例 Gemini「Confirm Undo 实际删文件」、story-spark #5529「当前版本仍可 Restore 静默丢编辑」）：文案点名目标时间与「先安全快照」；「回滚到最新快照」也是合法操作（最新即上一次保存，替换语义仍成立），无需禁用面——安全快照使任何一行都不是一单向门。
5. **行渲染收敛在 refreshDataHealth 单一 seam**：列表是存储的投影，不建独立状态；委托监听防重建泄漏；列表 UI 只读 `listSnapshots()`（索引），体只在按钮按下时按 ts 取——Sidebery 大键教训的读侧镜像。

## 4. 验证

- `node --check` ×4（storage/settings-ui/i18n/ntp + background）：全 0。
- `import-graph-guard`：`{ok:true, 14 modules, 48 edges, 0 violations}`（新 import `restoreFromSnapshot`/`replaceLayoutFromRestored` 均为既有 storage→settings-ui 边）。
- `migration-golden-guard`：`{ok:true, passed:28/28}`（pretest 门，本票未触迁移面）。
- `git diff --check`：0。
- 本票 spec：`boxing-time-machine-rollback.spec.ts` chromium-extension **3 passed**（首轮 2 failed 为 onboarding 遮罩拦真 pointer click——按 t44 合成输入纪律改 evaluate-dispatch 后全绿）。
- 回归车道（票 50 改动面闭包）：`time-machine-rollback + snapshot-rotation + import-merge + data-recovery + update-cow + settings-persist + i18n-module` 7 spec **35 passed (26.0s)**——含 t44 AC3（覆盖确认体仍含 snapshot 文案、pre-overwrite 快照仍绿）与 t41R 全部（index 形态/轮转/迁移不回归）。
- `npm run test:changed` 改动面全闭包：**530 passed / 15 failed / 5 skipped (6.0m)**。**残红定谳（非本票引入）**：① `boxing-dr-export-envelope` 3×2 道=票 51 自家 spec，其报告 §本地验证 明记「Playwright 未本机运行」（CI-only 政策，绿证据待大脑派发 CI）；② 其余 9 条（`title-select-all`×3、`empty-state Bug5-dark`、`state-sync` 双车道）与票 44 报告 §4 基线残红名单逐名重合（GitHub Actions run 34603576542 同签名）。本票改动行不触碰上述用例路径；本票新 spec 双车道全绿。
- 浏览器实载验证（AGENTS.md「UI 改动用浏览器运行时验证」条款）：本窗无 browser-runtime MCP 工具面，Playwright chromium-extension 真浏览器渲染即运行时证据（行/按钮/确认框/替换/重渲染全链路在断言中走过），按 43R/44 先例登记为充分；G-B 人工黄金路径（票 49 面）仍含本 UI 的真机勾选。

## 5. issue 状态

issues/50-dr-time-machine-rollback-ui.md：4 项全勾，Status → done（证据=本报告 §1+§4）。

## 6. 教训（写回候选，WORKFLOW §6）

| 日期 | 来源 | 教训 |
|---|---|---|
| 2026-09-12 | 票50 | 并行窗已 land 工作树时的正确 stack 通道 = but commit 失败信息自带 Hint（`branch new --anchor <dep>` 或 `move --above`），照 Hint 堆栈再重试即可，不要 uncommit/回退他窗文件来"清场" |
| 2026-09-12 | 票50 | 快照类 UI 文案含时间时别断言盒标题字母（'A' 命中 "AM"）；file:// 车道开弹窗点新元素统一 evaluate-dispatch，onboarding 遮罩在 fresh profile 必现 |

## 7. 遗留 / 回报大脑

- t51 的 `boxing-dr-export-envelope.spec.ts` 3 用例双车道红（其票未本机跑过 Playwright），名单与本窗 `test:changed` 重合——建议票 51 窗口（或大脑）按 43R 先例本地实跑收口，或由大脑派发 CI 复跑定谳；本票仅代登 cluster-map 解除 pretest CM-1 阻断，未动其代码。
- `replaceLayoutFromRestored` 绕过 merge 后，另一开着的标签仍会走 `applyExternalLayout`（incomingWins=revision 更高→merge incoming-first）：合并语义对该标签生效——恢复盒保留、被回滚盒若该标签未本地改则按并集回填。单标签主场景（NTP 新标签页）无此面；多标签回滚语义精化留 sync 产品化票（out of scope 面，spec W6 Out of Scope 精神）。
- 冲突副本「对比/合并/删除」解决 UI 仍 deferred（票 55 可见不实施，Wave6 Out-of-Scope 明载）。
- CI 复跑：本票分支 stack 在 t51 之上，大脑派发时按栈顶一次 push 即含两票（未 push，等指令）。
