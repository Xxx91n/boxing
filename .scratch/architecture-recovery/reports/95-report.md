# 报告 — 95 凭据清扫：存量 spec 真实 WebDAV 账号 env 化（票 95 · A-049）

- 日期: 2026-09-14 · 窗口: Wave9 实施子窗口 · 分支: ticket-95-credential-sweep（版本控制遵循 WORKFLOW §4.2，本地 commit，无 push）
- 票面: issues/95-credential-sweep-specs.md · 模板: 91R（boxing-merge-three-way.spec.ts L26–32 env 三行）

## 1. 检查点①：全量命中清单（grep 实测，先扫后改）

扫描词 = 真实用户 / 真实口令前缀 / 真实 koofr 主机（三词明文一律不在本报告回显，按文件:行定位）。

| 文件 | 命中 | 形态 |
|---|---|---|
| test/tests/boxing-sync.spec.ts | 3（L7–9） | URL/USER/PASS 三常量 |
| test/tests/boxing-import-merge.spec.ts | 3（L15–17） | 同上三常量 |
| test/tests/boxing-dr-export-envelope.spec.ts | 3（L20–22） | 同上三常量 |
| test/tests/boxing-webdav.spec.ts | 2（L7, L271） | URL 常量 + bootAndSeed 字面量 |
| test/tests/boxing-memory.spec.ts | 5（L105–107, L133–134） | evaluate 内联三字面量 + 两处 toBe 期望 |
| test/tests/boxing-cred-encrypt.spec.ts | 1（L154） | evaluate 内联真实用户 |
| test/tests/boxing-audit.spec.ts | 5（L27, L29, L40, L41, L61） | isSafe 断言中的真实主机字面量（无用户/口令） |
| .codex-tmp/zip-verify/test/tests/（sync/webdav/memory/cred-encrypt/audit 5 副本） | 14 处 | 同上形态的陈旧快照 |

test/ 合计 22 处 + .codex-tmp/ 14 处 = 36 处。`.scratch/` 下 issue/91-report 的命中系门禁规则自述与历史报告，不属工作树凭据面，未动。

## 2. 实施内容（91R 同构，不改测试语义）

- **三常量块**（sync / import-merge / dr-export-envelope）→ 91R 同款 `process.env.BOXING_SPEC_WEBDAV_URL/USER/PASS || 占位`；三个 spec 的 WebDAV 传输全部由 runtime.sendMessage 桩接管，占位只需过 checkUrlValid（https / 非私网 / 无内嵌 auth，sync-engine.js:613–622 实证 .invalid 与 example.net 均放行）。
- **boxing-webdav**：URL 常量 env 化（无尾斜杠形态保留）；L271 字面量改引 WEBDAV_URL 常量。该 spec 的用户/口令本已是 `test@example.com`/`testpass` 占位，未动。
- **boxing-memory**：顶部插入 env 三常量；evaluate 闭包改带参 `page.evaluate((cfg) => …, { url, user, pass })`（Playwright 序列化函数进浏览器作用域，读不到 module 顶层 const 与 process.env，必须走参数传递）；两处 toBe 期望改引同一常量 → 输入↔落盘回环等值断言逐点保留。
- **boxing-cred-encrypt**：顶部插 env 用户常量，用户值经参数传入 evaluate；该用例只断言密文对象与「明文口令不在导出中」，用户值仅形态占位，断言零改动。
- **boxing-audit**：5 处 isSafe 断言的真实主机字面量（URL 常量同款 koofr 端点）→ 等价公共域 `dav.example.net/dav/webdav`。逐条核对 true/false 判定路径（https 协议、私网正则、内嵌 auth、2048 长度阈）均不依赖具体域名，断言意图零削弱。
- **`.codex-tmp/zip-verify/` 5 副本**：同套替换（含陈旧快照的残余字面量兜底）。该目录 gitignored，不进 commit，仅满足「工作树 0 明文」。

## 3. 专属验收门禁（本票完成定义证据）

| 门禁 | 结果 |
|---|---|
| grep 三词 on test/ + .codex-tmp/（AC 原式，case-sensitive） | **0 命中**；追加 case-insensitive 复核亦 **0** |
| `npx playwright test --list` × 7 spec 合收 | **Total: 108 tests in 7 files**，无加载错误 |
| `git diff --check` | 干净；改动文件无 CRLF 字节、无 BOM（首 3 字节实测） |
| diff 形状 | 7 文件 +53/−26，全部限于凭据常量/字面量与其引用点，无断言削弱 |

## 4. AC 对照（issues/95）

| AC | 状态 |
|---|---|
| test/ 与 .codex-tmp/ 工作树 0 明文 | ✅（§3 grep 0） |
| 各 spec env override + 占位；--list 可加载 | ✅（§2/§3） |
| 不削弱断言；reports/95-report.md 落盘 | ✅（§2 逐文件论证；本报告） |
| 提醒用户轮换密码 | ✅ 见 §5，并已在收口消息具名提醒 |

## 5. 安全事件后续（用户决策项，非本票权限）

- **轮换提醒（重申）**：该 WebDAV 应用密码仍存在于**历史 commit**（38a2d005 及更早多票提交均含同一凭据字节；历史改写不在本票范围），本票只保证**工作树** 0 明文 → 该密码必须视为已泄露，请在服务商侧**立即轮换**。
- CI secret 注入（staging 账号跑真网络）本票未引入：所有命中 spec 均为 sendMessage 桩 mock 车道，占位不影响执行路径；若未来加真网络冒烟，再经 BOXING_SPEC_WEBDAV_* 注入。

## 6. 具名 CI 项与账本

- **具名 F-95-CI**：chromium 主车道 test.yml 全绿由大脑派发 push 后出证据（CI-only 政策，本窗不 push）；本票改动面 = 上述 7 spec 所在的 sync/webdav/memory/cred-encrypt/audit/import-merge/dr-export 族。
- decision-ledger A-049：`current` → `swept-pending-ci`（仅动本票行，hunk 隔离——票83/91 ledger 教训）。
- issues/95：Status → done-when-CI；AC 全勾，CI 证据具名注记随波次收口关闭。

## 7. 教训（写回候选，WORKFLOW §6 —— 大脑定夺）

| 日期 | 来源 | 教训 |
|---|---|---|
| 2026-09-14 | 票95 | 91R「模板化时凭据行一律换占位」的存量版：复用既有 spec 先例时，文件头三常量、evaluate 内联字面量、toBe 期望字面量是三个独立泄漏面，清扫必须分层 grep，只查常量声明会漏 memory/cred-encrypt 型内联。 |
| 2026-09-14 | 票95 | Playwright evaluate 闭包引用 module 顶层 const（含 process.env 结果）必须走参数传递——函数序列化进浏览器作用域，直接引用会 ReferenceError；--list 不执行函数体，拦不住此类错误。 |
