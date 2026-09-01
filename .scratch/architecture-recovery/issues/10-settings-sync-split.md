# 10 — settings/init 域拆分 (sync-engine / credentials / settings-ui / onboarding)

**What to build:** ntp.js 内 settings/init 区 (调用图定位约 L4102-5909 段, ~1800 行) 按工业 sync/backup 四层模型拆为四个模块: `sync-engine.js` (WebDAV/Gist 同步 + alarm + outbox 队列, 只经 saveLayout 门面落盘)、`credentials.js` (PBKDF2+AES-GCM 凭据封装, 密钥与密文分离)、`settings-ui.js` (设置界面 modal 与 DOM 绑定)、`onboarding.js` (onInstalled 引导)。四个模块都是 storage 写入门面的消费者, 不是门面的一部分。

**Blocked by:** 08 (持久化与渲染分离完成后, 门面与 state 接口已稳定)

**Status:** done (2026-09-01, ticket 10 agent)

- [x] sync-engine 拆出且所有 WebDAV/Gist 写操作只经 saveLayout 门面落盘, 不直接读写全局 layout — sync-engine.js (828 行) 持久化仅经 storage.js 门面导出 (saveLayout/directSetBoxingLayout/saveSnapshot/stripGroupsForPersist), 共享态经 state.js live binding; 四新模块 grep 直写 = 0 (检查点 1)
- [x] credentials 拆出且凭据不进入 layout 序列化 / 日志 / Gist 导出 — credentials.js (73 行) 纯加密信封 (v2 {v,s,iv,d}, 密钥派生不落盘), 仅注入 debugErr; 审计: layout 序列化/Gist payload 只含 _enc* 信封, debug 日志口令全 (set)/(empty) 脱敏 (检查点 2)
- [x] onboarding 由 onInstalled 触发 (install/update 区分) 而不是每次 init 判定 — background.js onInstalled 写 boxingInstallSignal 信号; NTP init 经门面 consumeInstallSignal() 读+消费; onboarding.js: install→tour / update→压制 / 无信号 (file:// mock 车道)→legacy 空画布判定 (boxing-onboarding 4 spec 保持绿); 活体探针实证信号消费 + update 压制
- [x] settings-ui 依赖 i18n + saveLayout, 不直接触 storage — settings-ui.js (331 行) import 面 = state/storage 门面/utils/i18n/persist/render, 零 chrome.storage 引用
- [x] 拆分前先落地 ADR-0016 (Sync/Backup 引擎分层与 Outbox 协议) 草案, 作为本票裁决依据 — docs/adr/0016 (commit tms, 先于实施 commit xpo)
- [x] `npm test` + `npm run build` 绿; 手动验证一次 WebDAV 同步与凭据加密往返 — npm test 418 passed + 1 failed (star-sync Scenario 3, solo 复跑 3/3 绿 = 票07/08 同类并行车道抖动); build DONE_BUILD 双树含四模块; chrome-extension:// 活体探针 9/9 (凭据 v2 信封往返+无泄漏/设置 modal/resolveWebDAVFileUrl/isSafeExtUrl 守卫/信号消费+update 压制/skipOnboarding 钩子/syncWebDAV 空地址 i18n 拒绝/零 console error); 注: 真实远端 WebDAV 往返留待用户手动 (BX-AUD-01/03 守卫按设计拒绝 localhost/内网, 沙箱不可达外网)

---

## 处置结论 (子窗口 → 大脑, 2026-09-01)

1. **交付物**: ntp/credentials.js (73 行, 纯加密信封, initCredentialsFacade 注入 debugErr) + ntp/sync-engine.js (828 行, 传输+双向同步+alarm+URL 守卫+同步配置 UI 绑定, initSyncEngineFacade 注入 17 依赖) + ntp/settings-ui.js (331 行, modal+控制监听+export/import+诊断+confirm 事件, initSettingsUiFacade 注入 27 依赖) + ntp/onboarding.js (111 行, initOnboardingFacade 注入 4 依赖); ntp.js 2207→997 行, init() 只剩编排 (load→facade 注入→bind 调用→视图恢复→信号消费→onboarding)。
2. **结构决策** (ADR-0016 裁决): (a) 嵌套函数声明整体上移模块顶层, init-time 语句 (监听器/水合/初始化调用) 收进 bindSyncBackupUi()/bindSettingsUi() 由 init() 原位调用 — 函数声明提升保证 bind 内↔模块级互调零时序风险, bind 调用点即原语句块位置 (行为时序平价); (b) 同步配置 DOM consts 单点声明在 entry 再注入双模块 — 双模块各自 getElementById 会 fork 元素引用 null-ness; (c) render.js 的 initRenderFacade 28 项注入表零改动 — openConfirmModal/openSettingsModal/updateCaption 改由 entry 从 settings-ui import 后原样传入 (facade 解耦红利); (d) 搬移体字节级 verbatim (逆变换对账门禁), onboarding freshInstall 判定行是全票唯一 deliberate change, ADR-0016 已记录。
3. **检查点证据**: 检查点 1 — 全 ntp/*.js grep 直写点 = storage.js 门面 5 处 (4 layout 写 + 1 信号消费 consumeInstallSignal) + background.js SW 侧 2 个非 layout 小键 (bgErrLog/boxingInstallSignal, ADR-0016 记录的 SW 上下文例外); 检查点 2 — 凭据仅以 _enc* 信封存在于 layout.settings/导出/Gist payload, 明文只在 DOM input 值, 日志全脱敏; window.__boxing* 17 项诊断契约逐一核验存活。
4. **验证证据**: 十层自验 (marker 唯一性/字节对账/逆变换 export 前缀/括号深度平衡/自由变量机械审计含正则字符类掩码/node --check×6/ESM 冒烟×4/回滚快照) 全绿; npm test 418+1 (star-sync Scenario 3 solo 复跑 3/3 绿, 车道抖动); build DONE_BUILD; 活体探针 9/9 (persistent context + 真扩展 chrome-extension:// 上下文)。
5. **版本控制 (§4.2)**: branch arch-recovery-10-settings-sync (stack 到 09 之上), commit tms (ADR-0016) → xpo (实施批次, 8 文件); 本收口 docs 批次随后提交同分支。未 push。踩坑: 但 commit 报 "depends on" 拒绝 = 新分支未 stack, but move --above 栈顶恢复后重试成功 (已写回 WORKFLOW §6)。
6. **给后续的接口提示**: ntp.js 997 行残余 = api/mock + 日志系统 + DOM consts + 搜索/键盘/双击/视图恢复编排; initRenderFacade (28) / initPersistFacade (3) / initStorageFacade 注入表原样; 后续若抽日志系统为模块, 四新模块的 debug* 注入面可全部改为 import。
