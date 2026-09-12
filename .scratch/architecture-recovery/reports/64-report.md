# Report — 64 WebDAV 私网限制文档化（P2）

- 日期: 2026-09-12
- 身份: 实施票 64 子窗口（覆盖 A-018；D-004 #4）
- 必读清单: 全部读毕（handoffs/64 · issues/64 · spec.md Wave7 · decision-ledger.md A-018 · WORKFLOW.md §4.2/§4.4 · AGENTS.md · docs/CONTEXT.md · docs/adr/0017-release-data-gate.md · .scratch/wave7-flash-grill/decision-ledger.md D-004）
- 阻塞: 61（README 表面）已解除 — reports/61-report.md 已落地，README 安装区/徽章已收窄为 Latest published release: v2026.9.11
- 调研: 无新增调研问题；复用 Wave5/6/7 已索引结论 + 源码/测试实测（不幻觉）。本票为纯文档票，未发起 atomcode 调研。

## 事实源（实测，非推理）

| 事实 | 证据 |
|---|---|
| 前端 WebDAV 守卫 | `ntp/sync-engine.js` L35 `AUD_PRIVATE_HOST_RE` + L36-48 `isSafeExtUrl`：长度 >2048、非 `https:`、URL 内嵌 user/pass、私网 host、`*.local` / `*.internal` 一律拒绝 |
| 后台代理守卫 | `background.js` L71 `BG_PRIVATE_HOST_RE` + L73-83 `isSafeWebDAVUrl` + L85-95 `guardWebDAVRequest`（`webdav-test` / `webdav-get` / `webdav-put` 三 handler 前置调用） |
| 正则覆盖 | 两处正则同构，均含前缀 `localhost` / `127.` / `10.` / `192.168.` / `169.254.` / `172.16-31.` / `::1` / `fe80:` / `fc00:` / `fd00:`，外加 `.local`、`.internal` 后缀匹配 |
| 行为断言 | `test/tests/boxing-audit.spec.ts` L23-43 `isSafeExtUrl rejects private hosts...`（含 `169.254.169.254` 云元数据、`172.16/172.31`、`host.local`、`host.internal`、`[::1]`）；L45-57 私网 host 不发出网络请求 |
| 门禁语义 | ADR-0017 + WORKFLOW §4.4：G-A ∧ G-B ∧ G-C 合取；任一未满足禁止可发行宣称 |

## 改动（本票 delta: 主路径 README.md Privacy 节）

`README.md` +4 行（无删除、无其他文件改动）：

1. **主条目**：「WebDAV targets must be public HTTPS endpoints」— 列出被拒绝的 host：`localhost`、`127.0.0.0/8`、`10.0.0.0/8`、`192.168.0.0/16`、`169.254.0.0/16`（明确点名云元数据地址 `169.254.169.254`）、`172.16.0.0/12`、`*.local`、`*.internal`。
2. **Why 子条目**：写明原因 — WebDAV URL 由扩展后台代理发起请求，放行私网地址会把一个手输/误填的 URL 变成从内网发起的请求（SSRF 式暴露：路由器管理页、NAS 界面、云元数据端点），因此是「无条件拒绝」而非警告。
3. **Also refused 子条目**：非 HTTPS、URL 长度 >2048、URL 内嵌用户名/密码；并写明检查在设置界面与后台代理各执行一次（对应 sync-engine + background 双守卫）。
4. **现状子条目**：LAN / `localhost` 自建 WebDAV 当前不可用；**没有**放宽该限制的设置项，显式 opt-in 明确后置（不在本票实现）。

未新增任何设置项、未改代码、未改 ADR-0017 / WORKFLOW 门禁定义。

## AC 核验（issues/64 三项）

- [x] **Privacy 节写明私网/localhost 默认拒绝及原因** — 主条目列出完整 host 清单，`Why` 子条目给出 SSRF 式暴露的因果说明，并注明「无条件拒绝」。
- [x] **不新增设置项（opt-in 后置）** — 明文「There is no setting to relax this; an explicit opt-in is deliberately deferred」；全仓设置相关源码零改动（`git diff --stat` 仅 `README.md` +4）。
- [x] **与 sync-engine/background 实际拦截范围一致** — 见下节逐 host 实测对照；README 只声明两层守卫共同覆盖的范围（IPv4 私网/回环/链路本地 + `.local`/`.internal`），未超范围宣称。

## 拦截范围一致性自检（结果可复核）

用两处真实正则对 README 文案逐条求值（表中 `false` = 被拒绝）：

| host | sync-engine（前端） | background（代理） | README 声明 |
|---|---|---|---|
| `localhost` | false | false | 拒绝 ✔ |
| `127.0.0.1` | false | false | 拒绝 ✔ |
| `10.1.2.3` | false | false | 拒绝 ✔ |
| `192.168.1.1` | false | false | 拒绝 ✔ |
| `169.254.169.254` | false | false | 拒绝 ✔ |
| `172.16.0.1` | false | false | 拒绝 ✔ |
| `172.31.255.255` | false | false | 拒绝 ✔ |
| `172.32.0.1` | true | true | 放行（段外，文案未声明）✔ |
| `nas.local` | false | false | 拒绝 ✔ |
| `box.internal` | false | false | 拒绝 ✔ |
| `dav.example.com` | true | true | 放行 ✔ |

## 门禁一致性自检（spec Wave7 文档票要求）

- README 全文 `ready-to-use` / `ready to use` 命中 **0**；`2026.9.12` 命中 **0**；`v2026.9.11` 命中 8（均为票 61 留下的真实发布表述）。
- 本票未引入任何可发行宣称、未触碰 tag / 发布状态、未修改 ADR-0017 合取条件（遵守 D-003 负向约束）。

## 验证（命令 + 结果）

```bash
npm run build                 # A8 CSS dual-write OK · A10 brace-balance OK · DONE_BUILD（绿）
git diff --check              # exit 0（无空白/行尾错误，仓库保持 LF）
git diff --stat -- README.md  # README.md | 4 ++++（仅本票 delta）
```

字节级复核：写入后重读 Privacy 节 12 行确认内容完整；BOM 无；CRLF 计数 0（LF 保持，`.gitattributes` 策略未破坏）。

## 已知缺口（不在本票范围，建议另立票）

1. **IPv6 字面量在后台守卫未被拒绝**：`new URL("https://[::1]/dav/").hostname` 返回 `[::1]`（保留方括号），而 `background.js` L79 未做去括号处理（前端 `sync-engine.js` L45 已做 `replace(/^\[|\]$/g, "")`）。实测：`[::1]` front=false（拒绝）/ background=true（放行）。本票为文档票，README 只声明两层共同覆盖范围，未宣称 IPv6 被拦；修复属代码改动，建议单独立票（一行去括号 + 对应单测）。
2. **`docs/privacy-policy.md` 未同步**：其「All network connections use HTTPS (enforced by URL validation — HTTP is rejected)」只提 HTTPS，未提私网 host 封锁。README 已链接该文件，属同一隐私面；本票 delta 限定 README 主路径，建议随 i18n 同步票一并处理。
3. **i18n README 副本**：14 份 `docs/i18n/README.*` 的 Privacy 节均无此限制说明（遗漏而非错误宣称）。沿用票 61 策略：只修含违规宣称的副本、不做批量翻译重写，建议纳入 README → i18n 同步票统一治理。

## 版本控制

遵循 WORKFLOW §4.2（GitButler `but` CLI）：`but diff` 确认改动 → `but commit -b <branch> -m "..." <改动id>`。不 push、不开 PR、不改写其他分支/窗口的提交。

## 完成定义

遵循 handoff 内的完成定义：AC 全勾 + 报告落 `reports/64-report.md` + 验证命令结果可复核。
