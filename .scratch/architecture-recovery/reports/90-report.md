# Report — Ticket 90: B54 WebDAV `.local` 与 opt-in 导出传播

> Covers: **A-044** · 波次: Wave9（目标 2026.9.15）· 分支: `wave9-ticket90-webdav-b54` · 提交: `vwu`
> 日期: 2026-09-13 · 版本控制: WORKFLOW §4.2（GitButler `but`；未 push、未开 PR）
> Blocked by: None · 本票不阻塞他票

---

## 0. 通用调研（handoff 要求的三项，先于实现）

### 0.1 atomcode 深度调研

- **通道**：`ctx_batch_execute` → `atomcode` CLI（`concurrency: 1`，本会话单次在途，符合 atomcode-research skill 串行护栏）。
- **提问（verbatim）**：把私网与本地主机（含 .local/.internal 与 IPv6 回环）默认拒绝、仅显式 opt-in 放行的 WebDAV/URL 校验，应如何在导出、上传、拉取等多条请求路径上保持一致，才符合工业安全实践？
- **充分性门**：searches 9（Exa 3 / Tavily 2 / AnySearch 1 + 角度标签）· angles 4 类（Official / Criticism / Currency / Community）· 全文核验 6 篇 + 2 次 404 换源。
- **来源**（报告自带清单）：OWASP SSRF Prevention Cheat Sheet；OWASP SSRF Prevention in Node.js；WICG Local Network Access Explainer；Chrome 官方博客 LNA 权限提示（2025-06，Chrome 142 生效）；MDN `Request.targetAddressSpace`；WICG LNA issue #115（官方确认扩展豁免 LNA）；Orange Tsai BlackHat USA 2017《A New Era of SSRF》；BBLabs SSRF bypass 汇编。

**结论（C1–C6）与本票的关系：**

| # | 工业结论 | 本票处置 |
|---|---|---|
| C1 | 校验必须收敛到**单一 choke point**，禁止每条路径各写一份正则（OWASP Case 2 同一 validation flow；Node.js 指南称手搓 regex 黑名单为反模式） | **采纳**：抽出 `normalizeHostname` + `isPrivateHost` 单一谓词，`isSafeExtUrl`（test/export）与 `checkUrlValid`（pull）共用。本票缺陷正是 C1 所描述的多路径漂移 |
| C2 | 默认拒绝 + 显式持久化 opt-in + 风险告知 = WICG/Chrome LNA 同构设计；且**扩展豁免浏览器级 LNA**，应用层守卫是**唯一一层**，一致性要求更高 | **采纳（作为本票必要性的依据）**：`webdavAllowPrivateHost` 默认 false、boolean true 才放行、hint 文案已有——保持不动；正因是唯一防线，pull 路径的漏网不可接受 |
| C3 | 重定向须禁用或逐跳重校验（OWASP："don't forget to disable the support for redirection"） | **本票不改**，列具名 F（见 §5.1） |
| C4 | URL 归一化须在 hostname 层、用标准库；留意 IPv4-mapped IPv6、`0.0.0.0`、十进制/八进制 IP 变体 | **部分采纳**：归一化 + 括号剥离已落地（本票）；`0.0.0.0` 与 `::ffff:` 覆盖缺口列具名 F（见 §5.2） |
| C5 | 校验必须在**请求时**执行，配置保存时的校验只是 UX（OWASP 两段式：输入一次 + 构建请求一次） | **已是现状**：test/backup/pull 三条运行时路径均在 fetch 前校验；本票补齐 pull 路径的判定完整性 |
| C6 | opt-in 粒度与撤销：扩展侧无按目标授权（Chrome 回复无计划）；hint 应限定"仅你自己拥有的 LAN/本机" | **已是现状**：全局开关 + `webdavAllowPrivateHostHint` 已具备限定语 |

**推荐与理由（一句话）**：把私网判定从"每条路径各自实现"改为"单一谓词 + 单一卡点"，并保持默认拒绝 / 显式 opt-in / fail-closed——这正是 C1+C2+C5 的交集，也是本票的最小充分修复。

**信息缺口（atomcode 自报）**：扩展豁免 LNA 的长期性只有单一官方信源（WICG issue #115），置信中等。

### 0.2 ADR / CONTEXT 心智模型回顾（冲突检查）

- `docs/adr/0016-sync-backup-engine-layering.md` 把 `isSafeExtUrl 守卫` 列为 sync-engine 的职责 → 本票**强化**该守卫，不违背。
- `docs/adr/0017-release-data-gate.md`：三门合取与 URL 守卫正交；本票不触及 G-A/G-B/G-C 定义，不扩三门。**无 revised**。
- `docs/CONTEXT.md` Wave8 settle 已记录 `webdavAllowPrivateHost` opt-in（票 82）→ 本票是其在 **pull 路径**上的补齐，属既有心智模型的收敛，不是改向。
- **具名纠偏**：atomcode C1 把 `ntp/utils.js:292` 的 `privateHost` 正则计入"三份正则漂移"。逐行核验后**不采纳**该归类——该正则属 `normalizeBookmarkUrl`（BX-DEV-055，为书签 URL 选择 http/https 方案），与扩展发起的特权 WebDAV 请求**不是同一威胁模型**，且不在任何 WebDAV 路径上。本票不动它（改它会改变书签打开行为，需独立票）。
- 结论：**无冲突，无 revised，无需呈报改向**。

### 0.3 工业对标（测试与门禁策略）

- **Playwright 扩展 e2e**：沿用仓库既有 seam，不引入新框架——`file://` harness + `addInitScript` 注入 mock `chrome.runtime`（`boxing-webdav.spec.ts` 既有 `bootWithMockRuntime`），与 spec「Prefer existing Playwright extension seams」一致。
- **断言形态（关键）**：主断言是 **`__webdavCalls` 零消息**（"守卫在发请求前拒绝"），而非仅断言错误字符串——错误串受 i18n 影响，零网络副作用才是行为契约（C5「请求时校验」的可观测镜像）。
- **CI 门禁对标**：pre-test 三守卫（import-graph / migration-golden / css-balance）+ `npm run build` + 双浏览器 chromium/firefox；不新增门禁、不改 ADR-0017。

---

## 1. 缺陷与根因

WebDAV 有三条进入路径，私网判定曾分属两份实现：

| 路径 | 入口 | 原守卫 | `.local`/`.internal` | IPv6 括号剥离 | opt-in 传播 |
|---|---|---|---|---|---|
| test | `testWebDAVConnection` | `isSafeExtUrl(url)` | ✅ | ✅ | ✅（undefined→读设置） |
| export/上传 | `backupToWebDAV` | `isSafeExtUrl(url)` | ✅ | ✅ | ✅ |
| **pull/同步** | `syncWithWebDAV` | **`checkUrlValid`（内联正则）** | ❌ **缺** | ❌ **缺** | 读设置但判定不完整 |

**根因**：`checkUrlValid` 用内联 `AUD_PRIVATE_HOST_RE.test(target.hostname.toLowerCase())`，
（a）**无 `.local`/`.internal` 后缀规则**；
（b）**未剥离 IPv6 字面量括号**——`URL.hostname` 对 `https://[::1]/` 返回 `"[::1]"`，而正则 `::1$` 因 `^` 锚定永不匹配。
因此默认（未 opt-in）时，`https://nas.local/dav/`、`https://host.internal/dav/`、`https://[::1]/dav/` 在 **pull 路径被放行并发起真实请求**，与 test/export 路径行为矛盾 → 违反 AC「默认仍拒私网」与「opt-in 在导出与 pull 路径一致生效」。

（`fe80:`/`fc00:`/`fd00:` 链路本地/唯一本地 IPv6 同因括号问题在 pull 路径漏网；实测已随修复一并覆盖。）

---

## 2. 改动

| 文件 | 改动 |
|---|---|
| `ntp/sync-engine.js` | 新增 `normalizeHostname(u)`（hostname 小写 + 剥离 IPv6 括号）与 `isPrivateHost(host, allowPrivateHost)`（opt-in 为 literal `true` 才放行；否则 regex 或 `.local`/`.internal` 后缀命中即私网）。`isSafeExtUrl` 改为 `return !isPrivateHost(normalizeHostname(u), allowPrivateHost)`；`checkUrlValid` 改为 `if (isPrivateHost(normalizeHostname(target), layout.settings.webdavAllowPrivateHost === true)) throw`。四条 i18n 错误串与判定顺序原样保留 |
| `background.js` | `isSafeWebDAVUrl` 的 `host` 增加 `.replace(/^[|]$/g, '')`，与 NTP 守卫对齐（否则 `[::1]` 在后台层同样漏网） |
| `test/tests/boxing-webdav.spec.ts` | 新增 `describe("WebDAV private-host opt-in propagation (ticket 90 / A-044)")`：3 主机 × {pull 默认拒, export 默认拒} + opt-in 放行（`.local` / IPv6）+ 非私网不受影响，共 8 用例；导入放宽为 `type Page` |

**刻意未改**（避免超范围，见 §5）：重定向策略、`0.0.0.0`/`::ffff:` 覆盖、`utils.js` 书签正则、README/ADR 文档面。

---

## 3. AC 对照（issue `issues/90-webdav-b54-gaps.md`）

| AC | 结论 | 证据 |
|---|---|---|
| 默认仍拒私网 | ✅ 满足 | pull 与 export 两路径对 `.local`/`.internal`/`[::1]` 均零网络消息拒绝；既有 `boxing-audit.spec.ts` 全部 A-032 用例保持绿（未放松任何既有拒绝） |
| opt-in 设置在导出与 pull 路径传播 | ✅ 满足 | opt-in=true 时 pull 路径放行 `.local` 与 IPv6（`__webdavCalls > 0`）；export 路径原本已生效，未回退 |
| 报告 `reports/90-report.md` | ✅ 满足 | 本文件 |

**本票 delta 逐项**：`checkUrlValid 正确处理 .local` ✅；`webdavAllowPrivateHost 在导出/同步路径一致生效` ✅；`维持默认拒私网` ✅。

---

## 4. 证据锚点

**TDD 红灯（修复前）** — `boxing-webdav.spec.ts -g "A-044"`，chromium：**3 failed / 6 passed**，失败恰为三条 pull 路径默认拒（`.local` / `.internal` / `[::1]`），`err` 为 `null`（未拒绝）。

```
node scripts/test-mutex.mjs playwright test --config=test/playwright.config.ts \
  --project=chromium-extension test/tests/boxing-webdav.spec.ts -g "A-044" --reporter=line
```

**绿灯（修复后）**：

| 验证 | 命令 | 结果 |
|---|---|---|
| chromium（webdav+audit 全量） | `... --project=chromium-extension test/tests/boxing-webdav.spec.ts test/tests/boxing-audit.spec.ts --reporter=line` | **23 passed**（26.7s） |
| firefox（同两 spec，单 worker） | `... --project=firefox-extension <同两 spec> --workers=1 --reporter=line` | **23 passed**（1.9m） |
| 语法 | `node --check ntp/sync-engine.js && node --check background.js && node --check ntp/ntp.js` | 均 exit 0 |
| import-graph 守卫 | `node scripts/import-graph-guard.mjs` | `{ok:true, modules:15, edges:48, violations:[]}` |
| migration golden 守卫 | `node scripts/migration-golden-guard.mjs` | `{ok:true, passed:28, total:28}` |
| CSS 括号守卫 | `node scripts/css-balance-guard.mjs` | OK，6 源文件平衡 |
| 构建 | `npm run build` | `DONE_BUILD`（chrome/firefox zip+crx/xpi 产出） |
| 行尾 | `git diff --check` | clean；改动文件无 CRLF（（无回车字节）） |
| URL 归一化实测 | `node -e` 探针 | `[::1]`/`[0:0:0:0:0:0:0:1]`→`::1`；`2130706433`/`0x7f000001`/`0177.0.0.1`/`127.1`→`127.0.0.1`；`[fe80::1]`/`[fd00::1]`/`[fc00::1]`→裸 IPv6（均命中） |

**firefox 4-worker 复跑说明**：首次 firefox 全量（默认 4 worker）出现 11 项失败，**全部发生在 `resetBoxing` 启动阶段**（`__boxingDebug` 轮询超时）且**包含未改动的既有用例**（`WebDAV settings panel is visible`、`boxing-audit L64`）；单 worker 复跑 **23/23 全绿**。判定为 firefox headed 多 worker 启动资源竞争（环境性），**非本票回归**——本票改动不在启动路径上。此现象按 §4.4 flaky/broken 分界属环境性 F，且未入豁免台账（本票不涉及 G-A 台账）。

**提交**：`vwu` on `wave9-ticket90-webdav-b54`（含注释修正 amend）。仅含本票三文件；他窗改动（`boxing-star-sync-audit.spec.ts`、`.scratch/probe-89/*`、`_87-diag-star-sync.cjs`、`ntp/settings.css`、`boxing-empty-state-buttons.spec.ts`）**未纳入**。

---

## 5. 具名 F / N（本票不改，建议后续票）

> 均为**既有**缺口（非本票引入），且经本票修复后**两条路径行为已一致**；因此不违反 AC。列名以便后续票收敛。

### 5.1 F-90-1 · 重定向逐跳校验缺失（pull 直连 fallback）

- **现象**：`webdavGetCloud` 直连 fallback 用 `redirect: 'follow'`、`webdavPutLocal` 直连 fallback 同为 `follow`；而 test 路径、BG 路径均为 `redirect: 'manual'`（`opaqueredirect` 即抛错）。
- **风险**：被攻陷/恶意配置的 WebDAV 服务器可 302 到 `http://127.0.0.1/` 或云元数据地址；因**扩展豁免浏览器级 LNA**（C2），浏览器不会兜底。
- **工业依据**：OWASP Case 2 明示禁用重定向；Node.js 指南要求逐跳重校验（C3）。
- **建议**：三处 fallback 统一 `redirect: 'manual'` 并沿用 `opaqueredirect` → 抛 `webdavErrNetwork` 的既有模式（需同时补 e2e）。**未在本票做**：属重定向策略变更，超出 A-044 delta（`.local` + opt-in 传播），且需独立 e2e 与文档面。

### 5.2 F-90-2 · 两处私网覆盖缺口（既有，两路径一致）

- **`0.0.0.0`**：`https://0.0.0.0/dav/` → hostname `0.0.0.0`，不在 `AUD_PRIVATE_HOST_RE` 中 → 默认放行。OWASP 明确要求拦 `0.0.0.0/8`。
- **IPv4-mapped IPv6**：`https://[::ffff:127.0.0.1]/dav/` → WHATWG 归一化为 `[::ffff:7f00:1]` → 剥离后 `::ffff:7f00:1`，正则无 `::ffff:` 分支 → 默认放行。
- **建议**：在 `AUD_PRIVATE_HOST_RE` 增 `0\.` 与 `::ffff:` 分支，并在 `boxing-audit.spec.ts` 加断言。**未在本票做**：会**扩大**默认拒绝面（改变安全姿态），且 `0.0.0.0`/映射回环的实际可达性需单独评估；属"扩大"而非"维持"，与 A-044「小修收口」不符。

### 5.3 F-90-3 · 两份正则的机械重复（`AUD_PRIVATE_HOST_RE` vs `BG_PRIVATE_HOST_RE`）

- 现状：NTP 与 background 各持一份**逐字节相同**的正则副本，靠人工同步（本票已人工对齐行为）。
- **建议**（C1 建议的两种）：构建期共享同一源码（复用 `.github/scripts/build.mjs` Tailor 机制），或加契约测试断言两份正则字符串相等（类比 `import-graph-guard.mjs` 的导出契约守卫）。
- **未在本票做**：涉及构建管线或新门禁，超出本票 delta 且触及门禁面（需大脑裁决）。

### 5.4 N 桶声明

- **本票无 N 桶事项**：未触碰数据完整性 / 迁移往返 / 回滚演练任何用例（`data-golden`、`migration-golden`、`snapshot-rotation` 等），`migration-golden-guard` 28/28 保持绿。

---

## 6. 风险、回滚与边界

- **行为变更面**：此前仅 pull 路径对 `.local`/`.internal`/IPv6 回环默认放行。修复后这些主机在 pull 路径需 opt-in。**对真实用户无新增限制**——同主机在 export 路径（`backupToWebDAV`）此前已拒绝，即此类用户本就必须 opt-in 才能完成备份；本票消除的是「能拉不能推」的不一致。
- **回滚**：单分支 `wave9-ticket90-webdav-b54` 单提交 `vwu`；回滚即 `but uncommit vwu`（或 revert 该提交），无数据面副作用（纯守卫逻辑 + 测试）。
- **未 push / 未开 PR / 未打 tag / 未改 ADR / 未动 main 历史**（D-008 线性追加；`b4f3df2` 之上）。
- **不宣称三门达成**：本票与 G-A/G-B/G-C 无关联断言。
- **完成定义核对**（handoff）：AC 全勾 ✅；具名 F/N 已注明 ✅（§5）；CI/实测锚点 ✅（§4）；账本状态更新 ✅（`decision-ledger.md` A-044 → implemented）；报告落盘 ✅。
