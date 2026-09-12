# 59 — sync-engine 空凭据冗余写（P2）报告

> 票面: issues/59-sync-engine-empty-cred-redundant-write.md（覆盖 A-010）
> 日期: 2026-09-12 · 阻塞: None (can start immediately)
> 调研来源: 复用 Wave5/6 已索引结论（spec.md Wave6 节、42R 根因实证 reports/42-update-cow-before-migrate-report.md §7、ADR-0009/0017）；本票无新增调研问题，未新跑 atomcode。

## 验收项对照

| 验收项 | 结论 |
|---|---|
| 定位空凭据仍触发 saveLayout 的路径 | ✅ 见下「定位结论」 |
| 去掉冗余写且不影响有凭据备份路径 | ✅ 两处守卫，最小改动 1 文件；有凭据路径零语义变化（见下） |
| 相关 data/COW 回归不新增红 | ✅ 本窗 CI-only 政策未跑测试；引用面核查 + 静态门禁全绿（见下「验证」），测试证据以 CI run 为准（由大脑推送验证分支触发） |
| 报告含改动面与验证命令结果 | ✅ 本文件 |

## 定位结论（非推断，源码 + 42R 实证）

42R 已实证（reports/42-update-cow-before-migrate-report.md §7「根因实证」）：`flushUnsavedCredentials()`（= `window.__boxingFlushCredentials`）即使凭据输入全空也无条件 `saveLayout()`。本窗逐路径核对 `ntp/sync-engine.js`，空凭据冗余写路径共 2 处：

1. **`flushUnsavedCredentials()`（原 L791-809）— 主凶**。调用面 5 处：`ntp.js` pagehide / beforeunload / visibilitychange(hidden) 三组 teardown 监听、`settings-ui.js closeSettingsModal()`、本模块 `__scheduleCredFlush` 800ms debounce（webdavUrl/webdavUser/webdavPass/gistToken input 监听）。空凭据（输入空且无变化）时仍执行 `layout.settings._encWebdavPass = null; _encGistToken = null; saveLayout()` —— 每次页面 teardown 一次 boxingLayout 冗余写；42R 中它正是「unload 写回污染 needsMigration 判定」的根因载体。
2. **`[webdavUrlInput, webdavUserInput]` blur 监听（原 L766-770）**。无变化也 `saveLayout()`；与 debounce input 监听叠加后同一字段一次编辑触发 2 次写。

非冗余路径确认（未动）：`syncWithWebDAV` 内 push 分支的两处 `saveLayout()`（L585/L595）是同步成功后的状态持久写（lastSyncAt/lastKnownBoxCountBaseline），且 provider 必须已配置 webdav 才可达 —— 空凭据（无 url）在 L426 `webdavErrNoUrl` 已抛出，不可达。`performBackup()` 的 `saveSnapshot()` + `saveLayout()`（L661-665）是 ADR-0009 稳态备份写（票 51 RPO 口径），不属于本票冗余写。票 51 copy-before-overwrite 快照（L447/L555 `await saveSnapshot()`）零改动。

## 改动面（1 文件，+21/−4）

`ntp/sync-engine.js`：

1. **blur 监听守卫**：先比较 `urlChanged/userChanged`，两者皆 false 直接 return（不写不存）；有变化才赋值 + `saveLayout()`。
2. **`flushUnsavedCredentials()` 空凭据守卫**：新增四路变化检测 `urlChanged/userChanged/passChanged/gistChanged`，全 false 直接 return（零 storage 写）。语义钉死两点：
   - **空输入不再清空已存凭据**：`passChanged`/`gistChanged` 要求 `passCur`/`gistCur` 非空才判变化，空白输入不再把 `_encWebdavPass`/`_encGistToken` 置 null（旧行为里空输入会把已存密文抹掉，是副作用缺陷）；closeSettingsModal 无凭据输入的路径因此零写。
   - **有凭据输入路径行为不变**：任一变化存在 → 与原逻辑完全一致（赋值、加密、`_enc*` 写入、`saveLayout()`）。boxing-memory.spec.ts 的 `flushCredentials persists the current _encWebdavPass even without blur` 用例（填值→flush→断言 enc 存在）走的正是变化分支，不受影响。

未动：`backupToWebDAV`/`testWebDAVConnection`/`syncWithWebDAV`/`backupToGist`/`performBackup`/`setupAutoBackup` 全部函数体；票 51 快照矩阵；`settings-ui.js`/`ntp.js` 调用点（守卫在 flush 函数体内收口，调用点零改动）。

## 验证（本机零产物静态门禁；测试走 CI）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check ntp/sync-engine.js` | exit 0（SYNTAX-OK） |
| 行尾/空白 | `git diff --check`（含全仓） | exit 0（WHITESPACE-OK；spec.md CRLF 警告为 .scratch 文件既有状态，非本票改动） |
| 模块依赖图 | `node scripts/import-graph-guard.mjs` | `{"edges":48,"violations":[]}` exit 0 |
| 有凭据路径零改动 | `git diff -- ntp/sync-engine.js` 逐 hunk 认领 | 仅 2 处守卫 hunk；`user && !pass`（webdavErrNoPass）等校验、`saveSnapshot()` 票 51 快照矩阵、push 分支 saveLayout 全部不在 diff 内 |
| 回归引用面核查 | grep 全部 spec | `flushUnsaved/__boxingFlushCredentials` 仅 boxing-memory.spec.ts（有值 flush 断言，走变化分支）与 boxing-update-cow-before-migrate.spec.ts（42R `= null` 中和 + `typeof fn === 'function'` 守卫，本票改动后仍兼容：中和后 fn 为 null，pagehide 处理器 no-op，守卫不改变该语义）；boxing-cred-encrypt.spec.ts 仅断言 `_encWebdavPass` 直写导出，不经 flush。blur/saveSnapshot 在 boxing-sync*/state-sync spec 中零引用 |

**CI-only 构建政策合规**：本窗未跑 `npm test`/Playwright/构建，未产生构建产物。data/COW 回归「不新增红」的权威证据 = CI run（test.yml），由大脑 Agent 推送验证分支触发；本窗提供的是静态门禁 + 引用面穷举证据，CI run 落地前不宣称测试绿。

## 风险与边界

- **行为差异面**（唯一）：此前「打开设置模态后关闭」若用户没动任何凭据字段，旧代码会触发一次 saveLayout（连带 `_meta.revision+1` 与跨 tab onChanged）；新代码零写。跨 tab 同步依赖 revision/updatedAt 的面会少收到一次无变化广播 —— 属消除冗余的预期效果，非回归。
- **空输入抹密文**：旧行为里空 pass/gist 输入 + flush 会把已存 `_enc*` 置 null（数据副作用）；新守卫下不再发生。若存在「用户清空密码输入期望删除凭据」的场景，删除仍可经 settings 其他路径达成（本票不扩面，如需显式「清除凭据」按钮另立票）。
- file:// 测试车道：`window.__boxingFlushCredentials` 契约保留（flush 函数仍存在并暴露），中和补丁（`= null` + typeof 守卫）语义不变。

## 版本控制

遵循 WORKFLOW §4.2：`but diff` 逐 hunk 认领后 `but commit -b <branch> -m "<msg>" <id...>`，不 push、不开 PR。
