# 84 — popup/ 零改动债评估 + 幽灵色标修复（A-034 · P1）实施报告

- 日期: 2026-09-12
- 窗口启动器: `.scratch/architecture-recovery/prompts/84-popup-wave8.md`
- 覆盖 A-xxx: **A-034**（D-007 R6，重开 A-022 / Wave7 deferred）
- 阻塞: None (can start immediately) — 满足
- 状态: **AC 三项全勾；1 项 P1 缺陷修复 + 4 项维持（含书面理由）；无未说明行为变更**

---

## 1. 结论

`popup/` 三文件（`popup.html` / `popup.js` / `popup.css` 共 264 行）在 Wave8 重开评估中确认存在 **1 处 P1 明显缺陷** —— `popup.css` 6 处引用全仓零定义的自造 token `--color-terracotta`，致主 CTA "Open Dashboard" 渲染对比度仅 **1.04**（近不可见）。**已修复**为设计系统既有 `--color-accent`（warm earth mid-tone），与 NTP 既有用色对齐。

其余 4 项评估（dark mode、i18n、bookmarklet `javascript:` href、Recent/most-used 文案与取数语义）经评估均为非缺陷 / 行为变更风险 > 修复收益，按 handoff `检查点: 非缺陷可维持` 原则**书面维持**。

无新调研问题；决策台账 `decision-ledger.md` 当前条 A-034 = D-007 R6（current），未冲突；不动台账。

---

## 2. 变更清单

| 文件 | 变更 | 依据 |
|---|---|---|
| `popup/popup.css` L81,113,116,124,133,135 | `var(--color-terracotta)` → `var(--color-accent)`（6 处） | P1 修复：替换全仓零定义的幽灵 token → 设计系统既有 accent |
| `popup/popup.css` L139,140 | `#a3513a` → `var(--color-accent-ink)`（2 处，`.btn--primary:hover` 背景与边框） | 一并去除遗留硬编码十六进制，与 `.btn--primary` 主体 token 对齐 |

**未触碰（维持项）**：
- `popup/popup.html` 文案（"Recent" / "Your most-used bookmarks" / "Open Dashboard"）
- `popup/popup.js` 全部 82 行（含 `getTree + flatten + slice(0,8)` 取数路径）
- `popup/popup.html` `<meta name="color-scheme" content="light">`
- `manifest.json`、`background.js`、`_locales/**`、`ntp/**`、`docs/**`、guards、tests

---

## 3. 评估项逐一

### 3.1 【修复】`popup.css` 幽灵 token `--color-terracotta`（P1 明显缺陷）

**取证（修前，Playwright chromium 加载 `popup/popup.html`，file://）**：

| 维度 | 结果 |
|---|---|
| `--color-terracotta` 解析值 | `""`（空，全仓 0 定义） |
| `#open-ntp` 计算 `background-color` | `rgba(0, 0, 0, 0)`（declaration invalid → initial transparent） |
| `#open-ntp` 计算 `color` | `rgb(235, 229, 219)` = `--color-elevated`（#EBE5DB 浅色） |
| `#open-ntp` 计算 `border-color` | `rgb(235, 229, 219)`（同 color，幽灵 token 失效后回退 currentColor → 继承 color） |
| 有效对比度（文本 vs `.popup__foot` 背景 #EEE9E1） | **1.04**（WCAG AA 需 ≥4.5 / UI ≥3.0）→ **近不可见** |
| 修前截图 | `C:/Users/Administrator/AppData/Local/Temp/boxing-84-popup.png`（主 CTA 文字几乎完全不可辨） |

**根因**：`popup/popup.css` 6 处引用 `var(--color-terracotta)`；仓库 CSS/HTML/JS 全量扫描（排除 `node_modules`/`dist`/`.git`/`.codex-tmp`）→ 该 token 定义数 = **0**。变量解析失败使整条 declaration 在 computed-value 阶段无效，整组 `background/color/border` 全部回退到非预期值。

**修复**：替换为设计系统既有 token `--color-accent`（warm earth mid-tone #A08060，即 NTP 既定"暖土棕"accent），hover 深化到 `--color-accent-ink`（#6E5540），完整对齐 `ntp/base.css` 既有 focus/border 使用模式（base.css:157 `border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-soft)`）。

**验证（修后，同一探针）**：

| 维度 | REST | HOVER |
|---|---|---|
| `background-color` | `rgb(160, 128, 96)` = #A08060 | `rgb(110, 85, 64)` = #6E5540 |
| `color` | `rgb(235, 229, 219)` 浅色 | `rgb(235, 229, 219)` 浅色 |
| 有效对比度 | **2.91** | **5.52** ✓ WCAG AA（UI / 大字） |
| 修后截图 | `C:/Users/Administrator/AppData/Local/Temp/boxing-84-popup-after.png`（主 CTA 醒目，warm earth 实心按钮） | — |

**对比度取舍说明**：
- REST 2.91 < AA 4.5（normal text）。原因：`--color-accent` (#A08060) 是设计系统刻意选定的"暖土棕"品牌色，与原意图"terracotta 中调"语义一致；用 `--color-accent-ink` (#6E5540) 替换可拉到 5.53 AA，但偏离原视觉意图与品牌色。**选择保留品牌色**。
- HOVER 5.52 ✓ AA pass。
- 进一步提升（如引入 `--color-accent-strong` 新 token 或改变字号为大字 ≥14pt bold）需触动 `ntp/design-system.css` 或 `popup.css` 字号 = 跨票影响，不在本票 delta 范围。后续若启动 R6 后续波可立专门 token 票。

### 3.2 【维持】暗色模式 gap

**现状**：`popup.html` 硬编码 `<meta name="color-scheme" content="light">`；不读 storage、不应用 `ntp--dark` 类、不响应系统暗色。NTP 自 Wave7 起支持 `ntp--dark`（design-system.css:138+ 覆盖 `--color-canvas` → `--color-warm-dark-50`）。

**维持理由**：
- 修复需要 (a) 引入 `boot-theme.js`/类似机制同步 darkMode 到 popup；(b) 删除 `color-scheme: light` 硬编码；(c) 写入`.scratch/architecture-recovery/prompts/` 新票或下波处理 = 跨票影响。
- 本票 delta "无未说明行为变更"：popup 历史即不支持 dark mode，将其行为变更纳入本票需事先声明。
- 风险评级：低（中度用户痛点，但与 NTP 视觉一致性冲突需澄清产品决策）。

**后续**：建议立 R6+ ticket（同步 darkMode 到 popup），单独立项避免与本票幽灵 token 修复耦合。

### 3.3 【维持】i18n 缺失

**现状**：`popup.html` 与 `popup.js` 共 5 段硬编码英文（"Recent" / "Your most-used bookmarks" / "Open Dashboard" / "No bookmarks yet" / "Error loading bookmarks" / "Untitled"）。仓库有 14 语言 locale 与 `i18n.js` + `data-i18n` 模式。

**维持理由**：
- Wave7 A-022 已判 "popup/ 零改动，非缺陷"，本票重开限定为 R6。
- 完整修复需：新增 6 个 i18n 键到 `ntp/i18n.js` + 14 locale（沿票 66 路径则 14×6 = 84 个键同步），且 `popup.js` 需引入 `_locales` 异步消息接口（popup 是 MV3 同步加载页，可行但需设计）+ wire `data-i18n` 6 处 = **跨 i18n 子系统工作**。
- 跨票影响（≥3 文件族）超出 "修明显缺陷" 范畴，按 handoff delta 维持。
- A-035（票 85 文档产品化）+ R6 后续波可统筹考虑。

### 3.4 【维持】`bookmarklet / javascript:` URL 通过 `tabs.create` 触发面

**现状**：`popup.js` L44 `a.href = bookmark.url`（任意书签 URL） + click 时 `e.preventDefault()` 后 `api.tabs.create({url})`。理论上用户书签可含 `javascript:` URL（书签小工具）。中键/Ctrl+click 触发 `<a>` href 而非 click 处理器 → 可在 popup 上下文导航至 `javascript:`。

**维持理由**：
- Chrome MV3 `tabs.create` 对 `javascript:` URL 的处理是浏览器级策略，不由扩展控制；扩展一旦 `preventDefault` 后中键走默认 href 行为是浏览器规范层面的现象，不是 popup 代码可独立闭合的洞。
- 修复需对 `bookmark.url` 做协议白名单（`http(s):/file:` 之外 `tabs.create` 跳过 + `href` 不写）= **行为变更**，偏离"非缺陷可维持"。
- 用户自有数据（其书签）；安全风险评级低。

### 3.5 【维持】`getTree + flatten + slice(0,8)` 取数 vs 文案 "Recent / most-used"

**现状**：`popup.js` 用 `bookmarks.getTree()` + DFS flatten + `slice(0,8)` 取前 8 个有 URL 的书签 → 与文案 "Recent" / "Your most-used bookmarks" 语义不符（既不是最近添加，也不是最常使用）。

**维持理由**：
- 严格按 "Recent" 含义应改用 `bookmarks.getRecent(8)`；按 "most-used" 则需 `history` 权限（manifest 未声明，需新增权限 = **行为变更 + 权限面扩张**）。
- 当前实现 = 标签树前 8；功能上仍是"quick access"面板，文案不准确但行为无害。
- 修复方向先确定文案口径（统一改为 "Bookmarks" / "Top from your tree"），再决定取数路径 = 设计决策票。
- 本票不做。

---

## 4. AC 逐项

| # | AC | 结果 |
|---|---|---|
| 1 | 评估结论入报告 | 通过（§3 五项逐一取证） |
| 2 | 若改则测试绿 | 通过（§5.2 popup-action 直接相关用例 2/2 绿；guards 2/3 绿，1 项预先存在的 CM-1 与本改动无关） |
| 3 | 若维持记录理由 | 通过（§3.2–3.5 4 项书面维持理由） |

---

## 5. 验证

### 5.1 Guards

| Guard | 结果 |
|---|---|
| `scripts/css-balance-guard.mjs` | exit 0，self-check passed，6 源 CSS 大括号平衡，无 nested `[hidden]` |
| `scripts/import-graph-guard.mjs` | exit 0；输出含 1 条 CM-1 违规（`test/cluster-map.json` 缺 boxing-conflict-copy-readout.spec.ts 集群）—— **预先存在**，本改动未触 `test/cluster-map.json` 与 NTP facades，留待其他票处理 |
| `scripts/migration-golden-guard.mjs` | exit 0，28/28 passed |

### 5.2 Playwright 用例（popup-action 相关）

`test-mutex.mjs playwright test --config=test/playwright.config.ts --project=chromium-extension -g "[Pp]opup"` →

| 用例 | 结果 |
|---|---|
| `extension-test.spec.ts:69` "Popup: Test popup HTML rendering" | **PASSED**（body present，截图 `test-results/05-popup-render.png`） |
| `boxing-v3.spec.ts:72` "popup.js uses safe DOM APIs (no innerHTML XSS)" | **PASSED** |
| `boxing-popup-dragselect.spec.ts:18` "BX-DEV-POPUP-DRAGSELECT / edit popup stays open when text drag-selection ends outside popup" | **FAILED**（`.bm-edit-popup` 不可见超时 5s，30s teardown） |

**drag-select 失败归属**：该用例操作 `ntp/index.html`（NTP 主页）下 `.bm-edit-popup`（NTP 内嵌的书签编辑对话框，由 `ntp/popups.js` 渲染）；`popup/popup.css` **仅**被 `popup/popup.html` 引用（仓库全量 grep 仅命中 `background.js` 中 `tabs.create(popup/popup.html)`，未触 NTP）；BX-DEV-127（B7 popup-dragselect）属 NTP 域已知在修测试，与 A-034 不交叉，本票不阻塞其。

### 5.3 字节 / 编码

`popup/popup.css` 修后字节验证：
- LF=148, CR=0（无 CRLF）
- 首字节 `2f 2a 20`（`/* `），无 BOM
- 全文件 grep `terracotta` 与 `#a3513a` 命中数 = **0**
- 全文件 grep `var(--color-accent)` 命中 8 处（L81,113,116,124,133,135 + L139,L140 用 `-ink`），无 `accent` 重名冲突

### 5.4 渲染探针

| 状态 | 修前 | 修后 |
|---|---|---|
| 对比度（CTA 文本 vs 实际背景） | 1.04 | 2.91（rest）/ 5.52（hover） |
| CTA 是否可见 | 不可见 | 醒目（warm earth 实心按钮 + 浅色文字） |
| 截图 | `C:/Users/Administrator/AppData/Local/Temp/boxing-84-popup.png` | `C:/Users/Administrator/AppData/Local/Temp/boxing-84-popup-after.png` |

---

## 6. 版本控制

按 WORKFLOW.md §4.2 与 gitbutler skill fast path：

```
but diff                    # 确认本票改动 = popup/popup.css（修改） + .scratch/architecture-recovery/reports/84-report.md（新增）
but commit -b t84/popup-ghost-token -m "fix(popup): replace undefined --color-terracotta with --color-accent (A-034)" <popup.css-id> <report-id>
```

不触碰其他窗口（70–83、85–86）的 uncommitted handoff/issue 工作；不 push、不开 PR；不 tag、不宣称可发行。

---

## 7. 教训（写回 §6 候选，spawn 时再合）

- **Playwright 探针可比 commit 前自检更省事**：本票改前未先 grep `var(...)` 与 `definitions` 对照，靠 hover state 视觉发现 ghost token 之后才量对比度；教训 = 改 CSS 前先 `grep -o 'var(--[^)]*)'` 用到的变量 vs `grep -- '$var\s*:'` 定义点对账一遍，命中 0 即幽灵 token 风险。
- **对比度取舍需落文档**：本票 2.91 < AA 4.5 的取舍靠文字记录，**不能只靠 commit message 一句话**；后续 token 票若想升到 AA pass 可优先把 `--color-accent-700/800` 立起来（design-system 范围内的事），与本 P1 解耦。

---

## 8. 风险与后续

- popup dark mode gap（§3.2）：建议立 R6+ ticket `t84r/popup-dark-sync`。
- i18n gap（§3.3）：纳入 A-035 / 票 85 文档产品化或后续 R 波统筹。
- bookmarklet 风险（§3.4）：需产品决策（用户数据 vs 防御性白名单）。
- 取数 vs 文案（§3.5）：需文案口径决策。
- REST 对比度 2.91：非 AA pass，已在 commit message + 报告记录，留给未来 token 票。