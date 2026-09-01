# 10 — settings/init 域拆分 · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-01
- 状态: **done** — issues/10 验收 6/6 勾选 (勾选动作已含于 docs commit lmo); 本文件为收口用完整版
- 分支: `arch-recovery-10-settings-sync` (stack 于 arch-recovery-09-agents-md-thinning 之上, 全链 09→08→07→04→06→05→03→02→01 为其祖先)
- 提交: ADR `tms` (ADR-0016 先行) → 实施 `xpo` (8 文件批次) → docs 收口 `lmo` (issues/10 + WORKFLOW §6); 报告文件随后补交同分支
- 上游依据: handoffs/10 (四层模型 + ADR-0016 先行 + updatedAt LWW 不顺手修)、callgraph-report §7.2 第 6 条 (settings/init ~1800 行缺口)、ADR-0009 (3-2-1 韧性/outbox/schemaVersion)、atomcode 心智模型调研 (SyncEngine/四层/outbox)

## 交付物

| 文件 | 变化 | 内容 |
|---|---|---|
| docs/adr/0016-sync-backup-engine-layering.md | 新文件 | Sync/Backup 引擎分层与 Outbox 协议裁决: storage=port / credentials=envelope / sync-engine=consumer / settings-ui+onboarding=presentation; updatedAt LWW 记录为已知妥协 (本票不修); onboarding 信号桥设计; 检查点 1/2 定义 |
| ntp/credentials.js | 新文件, 73 行 | PBKDF2+AES-GCM 纯加密信封 (v2 `{v,s,iv,d}`, legacy v1 兼容解密); 密钥由 CRED_APP_SECRET 派生不落盘; 零 DOM/零 layout 读; 仅注入 debugErr (initCredentialsFacade) |
| ntp/sync-engine.js | 新文件, 828 行 | WebDAV/Gist 传输 + 双向同步 (首拉/新者胜/outbox 字段级合并/数据丢失守卫) + chrome.alarms 自动备份 + BX-AUD-01/03 前端 URL 守卫 (AUD_PRIVATE_HOST_RE/isSafeExtUrl) + 同步配置 UI 绑定 (输入/凭据 flush/test/backup/interval); initSyncEngineFacade 注入 17 依赖 |
| ntp/settings-ui.js | 新文件, 331 行 | 设置 modal open/close + tab 切换 + 全部控制监听 (语言/记住位置/打开方式/conn 删除/缩放/字号/暗色/方角/主题包) + JSON export/import (SEC-06 2MB 上限) + 诊断 UI (BX-AUD-05) + confirm modal 事件; initSettingsUiFacade 注入 27 依赖 |
| ntp/onboarding.js | 新文件, 111 行 | 首次运行引导; **ADR-0016 触发模型 (全票唯一 deliberate change)**: `initOnboarding(trigger)` — reason `install`→未完成则 tour / `update`→压制 / 无信号 (file:// mock 车道)→legacy 空画布 freshInstall 判定 (boxing-onboarding 4 spec 保绿, 票 03 file:// 车道决议承继); initOnboardingFacade 注入 4 依赖 |
| ntp/ntp.js | 2207 → **997 行** (-55%) | 纯入口编排: api/mock + 日志系统 + DOM consts + 搜索/键盘/双击/视图恢复 + init() (load→facade 注入→bindSettingsUi/bindSyncBackupUi 原位调用→视图恢复→consumeInstallSignal→initOnboarding) |
| ntp/storage.js | +13 行 | 新增 `consumeInstallSignal()` 导出: SW 侧 boxingInstallSignal 信号读+消费收进门面 (检查点 1: ntp.js 不再出现 `layoutStorage.remove` 直写) |
| background.js | +5 行 | `onInstalled` (reason install/update) 写 `storage.local.boxingInstallSignal = {reason, at}` — SW 上下文信号桥 (ADR-0016) |
| test/tests/boxing-v3.spec.ts | +2 行 | settings-modal 源码断言随迁 ntp.js → settings-ui.js (票 04 教训: 符号搬去哪断言迁去哪) |

## 拆分模式 (票 10 核心经验, WORKFLOW §6 已写回)

1. **init() 巨体内区域**: 嵌套函数声明 (sendToBackground/syncWithWebDAV/performBackup 等 20+ 个) 整体上移模块顶层; init-time 语句 (DOM 绑定/水合/初始化调用) 收进 `bindSyncBackupUi()` / `bindSettingsUi()`, 由 init() 在**原语句块位置**调用 — 函数声明提升保证 bind 内调用模块级 helper 零时序风险, 行为时序平价。
2. **共用 DOM refs 单点声明在 entry**: L1073-1087 同步配置 14 个 DOM const 原位上移至 ntp.js const 区, 再经 facade 注入双模块 — 双模块各自 getElementById 会 fork 元素引用的 null-ness。
3. **facade 解耦红利实证**: entry 级函数 (openConfirmModal/openSettingsModal/syncSettingsDOM/updateCaption) 移入 settings-ui 后, 下游 render.js 的 initRenderFacade 28 项注入表**零改动** — entry 改 import 来源即可。

## 检查点证据 (prompts/10 定义的两条)

| 检查点 | 方法 | 结果 |
|---|---|---|
| 1. storage 直写 grep 除门面外为零 | 全 ntp/*.js + background.js 逐行 grep `chrome.storage.*set/remove/clear`、`layoutStorage.*`、`api.storage.local.set` | storage.js 门面 5 处 (4×layout 写链 + 1×consumeInstallSignal) + background.js SW 侧 2 个**非 layout 小键** (bgErrLog/boxingInstallSignal — 门面是页面上下文写链, 不适用 SW; ADR-0016 记录的合法例外); 四新模块 + 其余 ntp 模块 = **0 处** |
| 2. 凭据不出现在日志/导出/layout 序列化 | grep `_enc*`/`CRED_APP_SECRET`/`JSON.stringify(layout)`/debug 日志 pass|token 值 | layout.settings/导出/Gist payload 仅含 `_encWebdavPass`/`_encGistToken` **加密信封** (现状即如此, 未改); 明文只在 DOM input 值; debug 日志口令全部 `(set)`/`(empty)` 脱敏; 信封 JSON 不含明文 (探针 `plaintextLeak=false` 实证) |

## 验证证据

| 层 | 结果 |
|---|---|
| 搬移脚本十层自验 | marker 唯一性 (47 边界行) → 逐字节切片 → export 前缀唯一命中 → 逆变换对账 (onboarding 反转 export 前缀 + freshInstall deliberate change 后与 pristine 逐字节相等) → 括号深度平衡 ×5 文件 → 自由变量机械审计 (正则字面量掩码需跟踪字符类状态; 多变量声明/匿名 fn 参数/无括号箭头参数机械收集 — 票 05 假阳性第四源) → 回滚快照 → node --check ×6 → ESM 冒烟 ×4 全绿 |
| npm test | **418 passed + 1 failed** (star-sync Scenario 3 — solo 复跑 3/3 绿, 票 07/08 同类并行车道抖动, workers=4 已固化非代码回归; 本票未动 DSU/tombstone/写链) |
| npm run build | DONE_BUILD; A8 CSS 双写 OK; dist 双树 (chrome/firefox) 均含 credentials/sync-engine/settings-ui/onboarding 四模块 |
| git diff --check | clean (LF 无 CRLF 污染) |
| 活体探针 (persistent context + 真扩展 chrome-extension:// 上下文, **9/9 PASS**) | 凭据 v2 信封往返 (含非 ASCII 明文, 无泄漏) / 设置 modal 经模块开启 / resolveWebDAVFileUrl 自定义文件名 / isSafeExtUrl 守卫 (http/localhost 拒, https 过) / install 信号 init 消费后删除 / **update 信号压制 onboarding** / skipOnboarding 钩子 / syncWebDAV 空地址 i18n 拒绝 / 全程零 console error |
| window.* 契约 | `__boxingIsSafeExtUrl`/`__boxingEncryptCredential`/`__boxingDecryptCredential`/`__boxingFlushCredentials`/`__boxingTestWebDAV`/`__boxingBackupWebDAV`/`__boxingSyncWebDAV`/`__bxSync.*`/`_boxingOpenSettings` 等 17 项逐一核验存活 (现由对应模块在求值期赋值) |

**留白**: 真实远端 WebDAV 往返未跑 (沙箱不可达外网, 且 BX-AUD-01/03 守卫按设计拒绝 localhost/内网测试地址) — 留待用户手动验证; 本票以守卫逻辑 + 空地址拒绝路径 + BG 代理代码路径逐字节未动为替代证据。

## 版本控制轨迹 (§4.2)

- 分支 stack: 本票首次 commit 被拒 ("N changes could not be applied: ... depends on 07/06/05/08" — 新分支默认独立未入依赖链) → `but move arch-recovery-10-settings-sync --above arch-recovery-09-agents-md-thinning` 后原样重试成功; 错误信息自带完整依赖清单 (WORKFLOW §6 已写回)。
- WORKFLOW.md 共享文件单 hunk 混有票 06 窗口未提交的 §6 孤儿行: 按票 05 隔离法暂摘→提交 (lmo)→原样还回; **该票 06 孤儿行现仍留在 zz 未提交区归票 06/大脑处置**, 本票未代提交。
- 未 push, 未开 PR。
- .gitignore 增补 `.codex-tmp/` (活体探针临时脚本位置, 未实际入库 — 探针脚本用后即删)。

## 给大脑的收口注意

1. merge/落库顺序: 10 在 09 之上 (09→10), 其余不变; 未 push。
2. zz 未提交区遗留 (非本票): 票 06 WORKFLOW §6 孤儿行 1 条; dev-chrome (M/D junction) + dev-firefox (A junction) 构建噪音; .scratch README/handoffs/prompts 等大脑窗口规划文件未触碰。
3. **BUTLER fetch 漂移**: 报告/处置结论中 commit 引用以 change-ID (tms/xpo/lmo) 为准, git hash 可能因后续 GitButler 操作漂移 (票 07 先例)。
4. 后续接口: ntp.js 997 行残余 = api/mock + 日志系统 + DOM consts + 搜索/键盘/双击/视图恢复编排; initRenderFacade (28) / initPersistFacade (3) / initStorageFacade 注入表原样; 后续若抽日志系统为模块, 四新模块的 debug* 注入面可全部改为 import。
5. ADR-0016 遗留裁决点: updatedAt LWW 同字段冲突丢一侧 — 真正的 outbox 队列 / revision vector 升级留后续票; 调研预占编号已消费, 下一 ADR 从 0017 起。
