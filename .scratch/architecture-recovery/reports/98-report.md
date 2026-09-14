# Report 98 — 冻结 hack 就地注释（A-052 · 锐评8）

> Covers: A-052 · Blocked by: 96, 100 · 身份: Boxing Wave9.15 实施子窗口 ticket 98
> Spec: `.scratch/architecture-recovery/spec.md` · Issue: `issues/98-frozen-comments-rui8.md`
> Handoff: `handoffs/98-frozen-comments-rui8-handoff.md` · 日期: 2026-09-14 · 目标版本 2026.9.15

## 1. 通用调研（handoff 要求：结论先于实现）

### 1.1 atomcode 深度调研（串行 1 次，经 ctx 包裹）

调研问题（verbatim）：工业实践中，对刻意保留的遗留 hack 代码与重复键债务，就地冻结注释（freeze marker / debt marker）应包含哪些要素，以及如何在不改动运行时契约字节的前提下用静态检查防止其被顺手清理？

**结论 —— 冻结/债务标记六要素**（Confidence 高：官方风格指南 + 学术 SATD 综述 + 一手事故复盘三重交叉验证）：

| # | 要素 | 本票落地 |
|---|---|---|
| 1 | 唯一、可 grep、不与代码自然词冲突的标记词 | `FROZEN by ticket 83` / `FROZEN by ticket 66`（刻意避开 `ponytail:` 自动收割前缀，不污染既有台账） |
| 2 | 删除后果说明（删了会坏什么，具体到行为） | ntp.js：去掉第二实参会让 $count$ 占位符不解析，改变搜索结果里无名小盒的兜底标题；i18n.js：去重会改写 I18N_FALLBACK en 表键集/键序 |
| 3 | 解除条件（具体日期或具体事件） | 两处均写事件型 `Unfreeze when:` 触发器（另立票重推兜底 / 另立票做渲染前后 diff），非模糊表述 |
| 4 | 所有权 + 追踪号（bug 链接优先于人名） | `ticket 83 / A-033`、`ticket 66 / A-020`，附报告路径 `reports/83-report.md §7`、`reports/66-report.md §2/§5` |
| 5 | 债务天花板 ceiling + 升级触发器 | ntp.js：`only surviving occurrence`；i18n.js：`10 duplicated keys, no new ones` |
| 6 | 可静态解析的确定性格式 | 首行 `// FROZEN by ticket N — do NOT …`，后续固定 `Removal consequence:` / `Unfreeze when:` / `Ceiling:` / `Owner:` 标签 |

**防误清四道防线**（均不触碰运行时字节，天然满足「不改契约字节」）：1 构建期锚点校验 presence guard；2 CI diff 删除阻断（GitLab INC-12 模式：删除含警告短语的符号即 blocking + 第二评审人签核）；3 注释内容 lint（no-warning-comments / task-comment-format / expiring-todo-comments）；4 外部 golden 哈希清单。

**本票采用**：六要素全量落地。**未采用**防线 1-4 —— 均属新增机制，超出「只加注释」的本票 delta，转入 §6 后续建议。
主要来源：Google Java Style Guide §4.8.6.2（具体日期/事件强制、bug 链接优先于人名）、Chromium TODO styleguide（crbug 链接偏好排序）、GitLab INC-12 work item 96（一手事故：注释警告不可执行，fallback 被顺手删除）、arXiv 2312.15020（SATD 十年综述）、eslint no-warning-comments（大库裸启用噪音警告）、eslint-plugin-unicorn expiring-todo-comments（五种到期条件）、本仓 docs/history/ponytail-debt.md（一手：ponytail 标记 + ceiling + upgrade trigger 台账模式）。

### 1.2 ADR / CONTEXT.md 回顾（冲突不得静默改向）

- **ADR-0017**：把「渲染层冻结」明确归类为「绿灯不等于可用」形态，并据此否决「仅 CI 绿自动发行」。本票冻结语义与之一致 —— 无冲突。
- **docs/CONTEXT.md**：Data Resilience & Release Gate 段覆盖 ADR-0017 与 frozen legacy reader（票 56），但没有「就地冻结注释」这一心智模型。本票只增补源码注释，不改 CONTEXT.md（该文件正被并行窗口占用；票 83 报告 §7.3 已建议由大脑补一行，本票不扩面）。
- **结论**：无冲突，无 revised 项需呈报。

### 1.3 工业对标（补充快速查证）

- **MDN i18n.getMessage()**：substitutions 为 string 或 array；Chrome 下超过 9 个替换串返回 undefined。佐证 ntp.js 冻结点的第二实参是有语义的替换位，不是可随手删的空参数。
- **Google JavaScript Style Guide §8.3**：deprecation 注释必须给出修复调用点的明确方向 —— 与要素 2/3 同构。
- **本仓既有先例**：ntp/i18n.js 模块头 L7-9 已记录重复键债务（do not clean without re-checking rendered strings），但缺机器可检索的票号指针 —— 这正是 A-052 锐评8 的缺口，本票就地补齐。

## 2. 实现（delta：仅注释）

| 文件 | 位置 | 内容 |
|---|---|---|
| `ntp/ntp.js` | L578 上方，新增 8 行 | `FROZEN by ticket 83` —— 保护 `i18n(newLargeBox, ['']?.[0] or empty)` 占位符 hack；指向 reports/83-report.md §7（发现但未修） |
| `ntp/i18n.js` | L78 之后，新增 10 行 | `FROZEN by ticket 66` —— 保护 10 个重复 fallback 键（dblclickCreateHint / bookmarkSave / bookmarkDelete / bookmarkEditTitle / backupNow / backupNowHint / autoBackupInterval / syncProvider / squareCorners / squareCornersHint）；指向 reports/66-report.md §2（未触碰）/ §5 |

**零契约字节改动证明**：git diff -U0 统计为新增 18 行 / 删除 0 行，且 18 行新增全部匹配行首注释正则（逐行机器校验，18/18，无例外）。即运行时字节、键集、键序、求值结果全部与改动前逐字节相同。

## 3. AC 对照

| # | AC | 结论 | 证据 |
|---|---|---|---|
| 1 | ntp.js 冻结点有票 83 指针注释 | 勾 | ntp/ntp.js:578 首行 `// FROZEN by ticket 83 — do NOT tidy this expression. See .scratch/architecture-recovery/reports/83-report.md §7 …`；grep 命中 |
| 2 | i18n.js 重复键有票 66 指针注释 | 勾 | ntp/i18n.js:79 首行 `// FROZEN by ticket 66 — do NOT de-duplicate the block below. See .scratch/architecture-recovery/reports/66-report.md §2 / §5 …`；注释紧邻重复键块上方 |
| 3 | 冻结契约行为不变 | 勾 | 见 §4 锚点：diff 仅注释（+18/-0 逐行校验）、node --check ×2 绿、npm run build DONE_BUILD、4 道 guard exit 0、migration golden 28/28 |

**F/N 具名未达项 —— 已结清**：Playwright 变更面测试一度未执行（测试进程锁被并行窗口持有，PID 24704 node.exe 实测存活；两次 TEST_MUTEX_WAIT=1 各等待 300s 均超时）。按票 05/10 教训与 mutex 设计意图未强删该锁（强删会与在途窗口争抢浏览器资源），先按具名 F/N 记录，非「跳过即绿」。

**补测（2026-09-14 08:51，锁释放后重跑）**：`TEST_MUTEX_WAIT=1 npm run test:changed` → **613 passed / 5 skipped / 0 failed（6.7m，chromium-extension 车道）**，含 data-recovery 导出往返（3 盒 JSON 结构校验）与 extension-test NTP/popup 渲染。零失败、零静默跳过，F/N 项据此结清。
## 4. 锚点（可复核命令与实测结果）

```text
node --check ntp/ntp.js                          -> exit 0
node --check ntp/i18n.js                         -> exit 0
npm run build                                    -> DONE_BUILD（A8 CSS dual-write OK / A10 brace-balance OK）
git diff -U0 -- ntp/ntp.js ntp/i18n.js           -> +18 / -0，新增行注释匹配率 18/18
node scripts/import-graph-guard.mjs              -> exit 0（violations 空）
node scripts/migration-golden-guard.mjs          -> exit 0（ok true，28/28）
node scripts/css-balance-guard.mjs               -> exit 0（6 个源 CSS 平衡）
node scripts/calver-guard.mjs                    -> exit 0（version 2026.9.15，8 面一致）
grep -rn "FROZEN by ticket" ntp/ntp.js ntp/i18n.js -> 2 处命中（578 / 79）
npm run test:changed                             -> 613 passed / 5 skipped / 0 failed（6.7m）
```

字节卫生：两文件均 LF、无 BOM（与仓库 .gitattributes 约定一致）；git diff --check 无告警。

## 5. 账本状态

- decision-ledger.md **A-052**：current -> implemented（2026-09-14 · ticket 98 · 两处六要素指针注释 · 零契约字节改动）。
- issues/98-frozen-comments-rui8.md AC 三条同步回写为 [x]（对齐票 83 报告的做法）。

## 6. 后续建议（不扩本票面）

1. **防线一落地**：在 .github/scripts/build.mjs 的 A7 校验器加 FROZEN by ticket 锚点存在性断言（数量/位置），使「删注释即构建红」—— 成本最低的一档，建议单独立票。
2. **台账收割范围**：确认 docs/history/ponytail-debt.md 的 ponytail 自动收割是否应纳入 FROZEN by ticket 标记（本票刻意使用独立标记词以避免污染）。
3. **真正的清理票**：ntp.js 空串占位与 i18n.js 重复键的清理仍是无主债；本票只冻结不清理，建议由大脑立票并按「渲染前后 diff」验收。

## 7. 版本控制（WORKFLOW §4.2）

- 经 GitButler（but）独立分支提交本票改动；逐 hunk 认领，不含并行窗口的 ntp/boot-theme.js 改动。
- 不 push、不开 PR、不改写他窗提交；不 tag、不宣称可发行、不扩 ADR-0017。

## 8. 完成定义自检（handoff）

- [x] AC 三条全勾（§3；Playwright 由具名 F/N 转为补测全绿 613 passed / 0 failed）
- [x] 附锚点（§4，命令与实测结果可复核）
- [x] 账本状态更新（§5）
- [x] 报告落盘 reports/98-report.md
- [x] 版本控制遵循 WORKFLOW §4.2（§7）
- [x] 未触碰禁止项：未宣称三门合取、未代签 G-B、无 N 桶/数据完整性豁免、未 push/tag/force-push、未热修 2026.9.12、未用 run 34808080000 冒充发行 G-A
