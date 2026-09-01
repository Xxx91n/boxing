# ADR-0016: Sync/Backup 引擎分层与 Outbox 协议

## Date
2026-09-01

## Status
Accepted (草案落地, 作为票 10 settings/init 域拆分的裁决依据; 编号预占自 research-report.md)

## Context
callgraph-report.md §7.2 第 6 条: ntp.js 原始 6055 行中的 settings/init 区 (旧 L4102-5909, ~1800 行) 含
WebDAV 同步 + 加密凭据 + 诊断 + onboarding, spec 原本漏立票。票 08 完成后该区仍全部嵌在 ntp.js 的巨型
`init()` 函数体内 (现 L958-2118) 与 IIFE 级函数 (L395-461, L2120-2201)。

工业 sync/backup 心智模型 (atomcode 调研, ctx source: atomcode, 搜 'SyncEngine' / '四层' / 'outbox')
把这类系统分层为: 存储 = port (门面), 传输 = adapter (WebDAV/Gist), 同步引擎 = 门面消费者, UI = 表示层。
当前代码已经隐式符合大部分分层, 但结构上没有边界, 规则只能靠 AGENTS.md 条文代理。

约束 (WORKFLOW §6 教训):
- storage 写链 / 防回环 / onChanged 是单一体, 严禁拆散到多模块 (票 07 已整体落在 storage.js 门面)。
- updatedAt LWW (last-write-wins) 是已知妥协, 本票不改其语义 — 本 ADR 只记录现状并留待后续裁决。

## Decision

### 四层模型 (本票落地为四个模块)

| 层 | 模块 | 职责 | 边界规则 |
|---|---|---|---|
| port | `ntp/storage.js` (既有, 票 07) | boxingLayout 读写链/防回环/onChanged/snapshot/tombstone | 唯一允许触碰 `layoutStorage` 的 NTP 模块 |
| envelope | `ntp/credentials.js` (本票) | PBKDF2+AES-GCM 凭据封装: deriveCredKey/encryptCredential/decryptCredential | 纯加密; 不读 layout; 不触 DOM; 密钥与密文分离 (CRED_APP_SECRET 派生, v2 格式 `{v,s,iv,d}`); 只注入 debugErr |
| engine | `ntp/sync-engine.js` (本票) | WebDAV/Gist 传输 + 双向同步 + outbox 字段级合并 + chrome.alarms 自动备份 + isSafeExtUrl 守卫 + 同步配置 UI 绑定 | 持久化只经 storage 门面导出 (saveLayout / directSetBoxingLayout / saveSnapshot / stripGroupsForPersist); 内存态经 state.js 单例 (layout/setLayout/writerId live binding); 不直接调 `layoutStorage.*` |
| presentation | `ntp/settings-ui.js` + `ntp/onboarding.js` (本票) | 设置 modal + DOM 绑定 + export/import + 诊断; onboarding 引导 | settings-ui 只依赖 i18n + saveLayout 门面, 不直接触 storage; 凭据输入的加密落盘经 credentials.js 完成 |

### 模块间依赖方向 (无环)
`ntp.js (entry/orchestration)` → `settings-ui` / `onboarding` / `sync-engine` → `credentials`, `storage`, `state`, `utils`, `i18n`, `render`, `persist`。
跨作用域依赖沿用票 07/08 的 facade 注入模式: `initCredentialsFacade({debugErr})` / `initSyncEngineFacade(...)` / `initSettingsUiFacade(...)` / `initOnboardingFacade(...)`; render.js 的 initRenderFacade 注入表不变 (openConfirmModal/updateCaption 改由 entry 从 settings-ui import 后原样传入)。

### Outbox 协议 (现状记录, 非本票变更)
- 并发检测: `cloudUpdatedAt > lastSyncAt && localUpdatedAt > lastSyncAt && writerId 不同` → 字段级自动合并
  (mergeLayoutFields: 盒子按 id 合并非重叠字段, >3 字段分歧视为整体编辑保留本地; 连接按 from:to 去重并集)。
- 冲突回落: 合并失败 → newer-wins (updatedAt 比较), 已知妥协 — **多设备同字段编辑会丢一侧**, 本票不修,
  留待后续票引入真 outbox 队列 / revision vector 时另行裁决。
- 直接写入路径: pull/merge 成功后走 `directSetBoxingLayout(stripGroupsForPersist(layout))` (门面的显式
  直写口, 绕过 saveLayout 的防丢合并 — BX-FATAL-FIX 语义), push 路径走 `saveLayout()`。两类都属门面调用。

### Onboarding 触发模型 (本票唯一行为变更)
- background.js `onInstalled` (reason `install`/`update`) 额外写 `storage.local.boxingInstallSignal = {reason, at}`
  (SW 侧独立小键, 与 bgErrLog 同类, 不经 NTP 门面 — 门面是页面上下文的 layout 写链, 不适用 SW)。
- NTP init 消费该信号后删除; `install` → 未完成引导则展示 tour; `update` → 不展示 (区分生效);
  无信号 (file:// mock 车道, 调试/测试) → 保留 legacy 空画布判定, 保住 boxing-onboarding 四条 file:// 测试。
- 行为差异: 扩展环境下"每次 init 判定"变为"install 信号驱动"; mock 车道行为不变。

### window.* 契约
`__boxingIsSafeExtUrl / __boxingEncryptCredential / __boxingDecryptCredential / __boxingFlushCredentials /
__boxingTestWebDAV / __boxingBackupWebDAV / __boxingSyncWebDAV / __bxSync.{buildSyncPayload,resolveWebDAVFileUrl,backupToGist}`
随所属块 verbatim 保留 (现由对应模块在求值期赋值), Playwright/诊断脚本兼容性不变。

## Consequences
- ntp.js 从 2207 行降至 ~1.1k 行, init() 只剩编排: load → facade 注入 → bind → 视图恢复 → onboarding。
- 检查点 1 (storage 直写 grep): ntp/*.js 中 `chrome.storage.*`/`layoutStorage.*` 直写除 storage.js 门面外为 0;
  background.js 保留 bgErrLog 与新增 boxingInstallSignal 两个非 layout 小键 (SW 上下文, 见上)。
- 检查点 2 (凭据审计): 明文口令/令牌只存在于 DOM input 值; layout 序列化/导出/Gist payload 中仅出现
  `_encWebdavPass`/`_encGistToken` 加密信封 (现状即如此, 不改); 日志中口令一律 `(set)`/`(empty)` 脱敏。
- updatedAt LWW 妥协被显式记录而非掩盖; 后续真 outbox 升级有本 ADR 作为基线。
