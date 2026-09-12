# Report — 82 WebDAV 私网 opt-in（A-032 / D-007 R4，含旧 B47）

- 日期: 2026-09-12
- 身份: 实施票 82 窗口（覆盖 A-032）
- 必读清单: 全部读毕 — handoffs/82 · issues/82 · spec.md（Wave8 User Stories / Implementation / Testing Decisions）· WORKFLOW.md §4.2 · decision-ledger.md（A-032 行 + Wave8 覆盖自评）· destination-reconciliation-wave8.md · docs/CONTEXT.md；handoff 另列的 wave8-release-grill/atomcode-ga-residual-research.md、handoffs/next-round.md、docs/adr/0016-sync-backup-engine-layering.md、AGENTS.md 一并读毕
- 阻塞: `None (can start immediately)`，issue 状态 `ready-for-agent` — 满足，已开工
- 与 decision-ledger 的关系: A-032 状态 `current`，约束列「设置+i18n+README」。本票严格落在该范围内，**无改向**，因此**不需要**标 revised 或新呈 D-xxx

## 调研（D-005 精神）

1. **等价调研（atomcode 未在本窗口挂载，改用等价源码/测试实测）**：以 ctx 对 `ntp/*.js`、`background.js`、`_locales/*`、`test/tests/boxing-audit.spec.ts` 做实测扫描，定位到三处真实守卫与既有断言，未凭记忆推断。
2. **ADR / CONTEXT 心智模型回顾**：ADR-0016 四层模型把 URL 守卫划归 `sync-engine`（engine 层）与 `background`（代理），`window.__boxingIsSafeExtUrl` 属受保护的 window 契约；本票在两层同步放宽，未越层改 `storage.js` 门面。
3. **工业级对标**：W3C/WICG **Local Network Access**（原 Private Network Access）规范与 Chrome 已落地的同名权限提示，采用的正是一条「**默认拒绝 + 显式用户可见授权**」的路径——私网请求先拿到 local network access 权限，且该授权**不豁免**安全上下文、预检与凭据规则。本票 opt-in 形状与其同构：只放宽「目标是否属于私网」这一个判定，HTTPS、禁内嵌凭据、2048 长度上限三条不变。
4. **冲突检查**：与 decision-ledger current 无冲突，见上。

## 事实源（实测，非推理）

| 事实 | 证据 |
|---|---|
| 前端守卫 | `ntp/sync-engine.js` `AUD_PRIVATE_HOST_RE` + `isSafeExtUrl()`（暴露为 `window.__boxingIsSafeExtUrl`）；`checkUrlValid()` 另有一处私网判定 |
| 后台代理守卫 | `background.js` `BG_PRIVATE_HOST_RE` + `isSafeWebDAVUrl()` + `guardWebDAVRequest()`（`webdav-test` / `webdav-get` / `webdav-put` 三 handler 前置） |
| 消息通道 | `sync-engine.js` `sendToBackground()` 是全部 `webdav-*` 消息的唯一出口（实测 6 处调用：test ×2 / put ×3 / get ×1） |
| 外部发送者已拦 | `background.js` `dispatch()` 先过 `isOwnSender(sender)`，外部扩展无法把 Boxing 当 fetch 代理 |
| 既有断言 | `test/tests/boxing-audit.spec.ts`「isSafeExtUrl rejects private hosts, http, embedded creds, overlong URLs」（16 条 URL）；另有「私网 host 不发出网络请求」用例 |
| 主机权限 | `manifest.json` `host_permissions: ["https://*/*"]`，LAN 上的 `https://` 源已覆盖，**本票无需改 manifest** |

## 改动

### 1. 守卫：默认仍拒，仅 opt-in 放宽

- `ntp/sync-engine.js` `isSafeExtUrl(urlStr, allowPrivateHost)`：新增第二参数；**省略时读取 `layout.settings.webdavAllowPrivateHost`**，因此既有单参调用（含全部既有 Playwright 断言）语义不变。私网/回环/链路本地与 `.local` / `.internal` 两条判定包进 `if (allowPrivateHost !== true)`。
- `ntp/sync-engine.js` `checkUrlValid()`：私网判定前置 `layout.settings.webdavAllowPrivateHost !== true`。
- `background.js` `isSafeWebDAVUrl(urlStr, allowPrivateHost)` 同构放宽；`guardWebDAVRequest()` 传入 `msg.allowPrivateHost`。
- **opt-in 传递单点**：`sendToBackground()` 内对 `type` 以 `webdav-` 开头的消息统一注入 `msg.allowPrivateHost = layout.settings.webdavAllowPrivateHost === true`。选单点注入而非改 6 处调用点，是为了新增调用点不会漏带标志。
- **未放宽**（与私网判定解耦，opt-in 与否都不变）：非 `https:`、URL 内嵌用户名/密码、长度 >2048。

### 2. 设置项与 UI

- `ntp/utils.js` `defaultLayout().settings` 新增 `webdavAllowPrivateHost: false`；守卫只认 `=== true`，旧 layout 经 migrate 展开缺省值后一律为「拒」。
- `ntp/index.html` WebDAV 配置区新增复选框 `#webdav-allow-private` + `modal__hint` 风险提示（沿用既有 `checkbox-label` / `checkbox-label__text` 模式）。
- `ntp/ntp.js` 取元素引用并注入 `initSyncEngineFacade`。
- `ntp/sync-engine.js` `bindSyncBackupUi()`：回填 `checked`，并挂 `change` → 写 `layout.settings.webdavAllowPrivateHost` + `saveLayout()`。

### 3. i18n

- `ntp/i18n.js` `I18N_FALLBACK` 新增 `webdavAllowPrivateHost`、`webdavAllowPrivateHostHint`。
- 14 份 `_locales/*/messages.json` 同步新增两键（插入点统一在 `webdavPass` 之后），各由 243 → **245 键**，键集合全等。

### 4. README

- Privacy 节改写「LAN / localhost 自建 WebDAV」条目：由「当前不可用且无放宽设置项（opt-in 后置）」改为「默认拒绝 + 可显式 opt-in」，并点名设置路径。
- 新增「Why the opt-in is explicit」子条目，**保留并强化 SSRF 说明**：启用后 Boxing 会从用户网络内部向所填地址发起请求，点名路由器管理页、NAS 界面与 `169.254.169.254` 云元数据端点。

### 5. 测试

- `test/tests/boxing-audit.spec.ts` 新增 2 条：
  1. opt-in 后 `192.168.` / `10.` / `localhost:8443` / `nas.local` 放行，且 `http:`、内嵌凭据、超长 URL 仍拒；
  2. 复选框默认未勾选、setting 缺省为假、单参调用仍拒；翻转 setting 后守卫随之放行（覆盖「设置 → 守卫」这条真实接线）。

## AC 核验（issues/82 四项，全勾）

- [x] **默认仍拒** — `webdavAllowPrivateHost` 默认 `false`；守卫只认 `=== true`；既有拒绝断言全绿，并新增「复选框默认未勾选 / 单参调用仍拒」断言。
- [x] **opt-in 后白名单可用** — 前端与后台双层守卫同步放宽；新增断言覆盖 `192.168.` / `10.` / `localhost` / `.local` 四类。
- [x] **14 locale 齐** — 14 份各 245 键，`JSON.parse` 全通过，两键均存在。
- [x] **README Privacy 更新** — opt-in 段 + SSRF 说明段均已改写。

**检查点与专属验收**：

- 检查点「保留 SSRF 说明」 — README 原有 `Why` 子条目未删；新增子条目进一步点名云元数据地址。
- 专属验收「未 opt-in 行为与现网一致」 — 既有 `boxing-audit` 全部 5 条用例未改一字、全部通过；`isSafeExtUrl` 单参契约保留（省略参数时读 setting，fresh 状态下为假）。

## 验证（命令 + 结果）

```bash
node --check ntp/sync-engine.js background.js ntp/utils.js ntp/ntp.js ntp/i18n.js   # 5/5 OK
npm run build                    # A8 CSS dual-write OK · A10 brace-balance OK · DONE_BUILD（绿，exit 0）
git diff --check                 # exit 0（无空白/行尾问题，仓库保持 LF）
# 14 locale JSON.parse 全通过，各 245 键，bad=0；8 个改动文件 CRLF 计数全为 0
TEST_MUTEX_WAIT=1 node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts \
  --project=chromium-extension test/tests/boxing-audit.spec.ts --reporter=line
# 7 passed (11.5s) — 既有 5 条 + 新增 2 条
```

**测试锁说明**：首次执行时锁被并行窗口（PID 18608）持有，改用 `TEST_MUTEX_WAIT=1` 等待后正常执行。

## 已知缺口（不在本票范围，建议另立票）

1. **`npm run pretest` 存在他票导致的既有红灯**：`import-graph-guard` 报 `CM-1: spec is not covered by any cluster: boxing-conflict-copy-readout.spec.ts`。该 spec 属票 79（A-029），`test/cluster-map.json` 尚未登记；与本票无因果关系（本票 spec `boxing-audit.spec.ts` 已被 cluster-map 覆盖）。未越界代改。
2. **`checkUrlValid()` 未检查 `.local` / `.internal`**（既有缺口）：未 opt-in 时，同步路径 `syncWithWebDAV` 对 `nas.local` 不会在 `checkUrlValid` 处被拒，而 test/backup 路径会被 `isSafeExtUrl` 拒——两条路径不一致。本票未扩范围修改；建议随 WebDAV merge 质量票（80）收敛到单一守卫函数。
3. **后台 IPv6 方括号未剥离**（票 64 报告缺口 1，仍未修）：`new URL("https://[::1]/").hostname` 保留方括号而 `background.js` 未去括号（前端已做）。未 opt-in 时该 host 前端拒、后台放行。本票未改。
4. **opt-in 会随布局导出/同步一起传播**：`webdavAllowPrivateHost` 落在 `layout.settings`，会被纳入同步负载与 JSON 导出（`stripGroupsForPersist` 只剥离 `__` 前缀运行时键）。导入他人导出的布局可能把 opt-in 一并带入。当前与其他 settings 一致处理，用户仍可在设置面板看到并关掉；若需要「仅本机生效」语义，建议另立票评估改为 runtime-only。

## 版本控制

遵循 WORKFLOW §4.2（GitButler `but` CLI）：

1. `but diff` 确认改动 → 逐 hunk 判定归属（本窗口与票 79/83 并行，同一文件内混有他票 hunk）→ 仅提交本票 hunk。
2. `but commit -b 82-webdav-private-optin -m "feat(webdav): 私网 host 显式 opt-in 设置项 (ticket 82, A-032) ..." <本票 hunk ids>` → 创建 commit `tqr` 于新分支 `82-webdav-private-optin`。
3. 本报告作为第二个 commit 追加到同一分支。

**未纳入本票提交**（属其他并行窗口，原样留在工作区）：票 79 的 `dataConflictList` / `dataConflictExportBtn` i18n 与 `ntp/index.html` 冲突副本列表 hunk；票 83 的 `ntp/ntp.js` 搜索 debounce hunk（含 `searchRunCount`）。不 push、不开 PR、不改写其他分支/窗口的提交。

## 完成定义

遵循 handoff 内的完成定义：issue AC 全勾 + 报告落 `reports/82-report.md` + 版本控制遵循 WORKFLOW §4.2；**不 tag、不宣称可发行、不扩 ADR-0017**（三者均未触碰）。
