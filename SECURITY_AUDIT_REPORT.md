# 🔒 统一安全审计报告 — Boxing v3.5.0

**时间**：2026-07-10 19:45 (UTC+8)
**目标**：`D:\Aworker\crx\boxing`
**模式**：标准（Semgrep 候选 + Code-VulnScan + 手动 Code Review）
**语言**：JavaScript (Vanilla) + CSS + HTML + JSON (Chrome Extension MV3)
**引擎**：SecretsScan ✅ | DependencyScan ✅ | VulnScan ✅ | CodeReview ✅

---

## 执行摘要

| 严重度 | 数量 | 详情 |
|--------|------|------|
| 🔴 Critical | 0 | — |
| 🟠 High | 0 | — |
| 🟡 Medium | 2 | Manifest 配置瑕疵、popup 缺少权限声明 |
| 🟢 Low | 4 | innerHTML 使用模式、popup 无 i18n、旧变量名、错误静默吞没 |

**整体评估**：Boxing 项目安全状况**良好**。无 XSS 可利用路径、无密钥泄露、无依赖漏洞、无可远程执行点。最关键的是 Manifest 配置需要修正，以及 popup 页面有若干工程债务。

---

## 🟡 Medium

### [M-001] manifest.json 中 `version` 字段重复定义
- **CWE**：N/A（配置错误）
- **位置**：`manifest.json:7-8`
- **证据**：
  ```json
  "version": "3.3.0",
  "version": "3.5.0",
  ```
- **影响**：JSON 中重复 key 的行为在不同浏览器解析器中不一致；Chrome 可能取后者，Firefox 可能取前者，导致版本号歧义和 store 验证失败。
- **修复**：删除第一行 `"version": "3.3.0"`，保留 `"version": "3.5.0"`。

### [M-002] popup.js 使用 `bookmarks` API 但 manifest 未声明权限
- **CWE**：N/A（权限缺失）
- **位置**：`popup/popup.js:12` + `manifest.json:27-30`
- **证据**：
  ```js
  const tree = await api.bookmarks.getTree();
  ```
  manifest.json 中 `permissions` 仅有 `["storage", "tabs"]`，缺少 `"bookmarks"`。
- **影响**：`api.bookmarks.getTree()` 在 Chrome/Firefox 中将因权限不足而失败，popup 始终显示 "Error loading bookmarks"。
- **修复**：在 `permissions` 数组中添加 `"bookmarks"`，或移除 popup 中的 bookmarks API 调用改用 layout 数据。

---

## 🟢 Low

### [L-001] popup.js 使用 innerHTML 注入动态 HTML 字符串
- **CWE**：CWE-79（XSS 的低风险变体）
- **位置**：`popup/popup.js:15, 38`
- **证据**：
  ```js
  recentListEl.innerHTML = '<div class="empty-msg">No bookmarks yet</div>';
  recentListEl.innerHTML = '<div class="empty-msg">Error loading bookmarks</div>';
  ```
- **影响**：当前为静态硬编码字符串，无用户数据注入，不可利用。但代码模式危险，未来若有人将用户数据拼接进 innerHTML 则产生 XSS。
- **修复**：改用 `textContent` + DOM 创建元素，如：
  ```js
  recentListEl.textContent = '';
  const div = document.createElement('div');
  div.className = 'empty-msg';
  div.textContent = 'No bookmarks yet';
  recentListEl.appendChild(div);
  ```

### [L-002] background.js 中变量名使用旧项目前缀
- **CWE**：N/A（代码卫生）
- **位置**：`background.js:11`
- **证据**：`root.__qlearly_last_install__`
- **修复**：改为 `root.__boxing_last_install__`

### [L-003] background.js 错误静默吞没
- **CWE**：CWE-390（未检查错误条件）
- **位置**：`background.js:10, 16, 19`
- **证据**：`catch (_) {}` — 3 处
- **影响**：安装失败、action 打开失败等错误无日志，排查困难。
- **修复**：添加 `console.error` 或 `debug` 输出：
  ```js
  } catch (e) { console.error('[Boxing BG]', e); }
  ```

### [L-004] popup UI 与 ntp 设计系统脱节
- **CWE**：N/A（工程一致性）
- **位置**：`popup/popup.html`、`popup/popup.js`
- **证据**：popup 使用硬编码字符串（"Recent"、"No bookmarks yet"、"Open Dashboard"），未接入 i18n 模块。按钮使用 `btn--primary`（CSS 中未定义）。暗黑模式 CSS 未覆盖 popup。
- **修复**：将 popup 纳入 i18n 系统，同步设计 tokens。

---

## XSS 专项审查结论

Code-VulnScan 标记了 6 个 XSS 候选（全部在 ntp.js 中）。逐个人工验证：

| # | 位置 | 模式 | 判定 |
|---|------|------|------|
| 1 | `ntp.js:409` | `canvasSurface.innerHTML = ''` | ✅ 安全 — 清空容器 |
| 2 | `ntp.js:636` | `innerSurface.innerHTML = ''` | ✅ 安全 — 清空容器 |
| 3 | `ntp.js:739` | `body.innerHTML = ''` | ✅ 安全 — 清空容器 |
| 4 | `ntp.js:444` | `title.textContent = box.title \|\| ...` | ✅ 安全 — textContent 自动转义 |
| 5 | `ntp.js:663` | `title.textContent = sb.title \|\| ...` | ✅ 安全 — textContent 自动转义 |
| 6 | `ntp.js:773` | `tEl.textContent = bm.title \|\| bm.url` | ✅ 安全 — textContent 自动转义 |

**结论**：所有 "XSS 候选" 均为安全模式。textContent 保证浏览器自动 HTML 转义。contentEditable 的用户输入经由 `textContent.trim()` 读取后存为纯文本。**无可用 XSS 攻击向量**。

## 密钥/依赖审查结论

- **密钥扫描**：0 发现（`.js`、`.json`、`.html` 中无硬编码 token/key/password）。
- **依赖扫描**：0 依赖包（纯 Vanilla JS，无 `package.json` / `node_modules`）。

## 引擎详情

| 发现 | Secrets | Dependency | VulnScan | CodeReview |
|------|---------|------------|----------|------------|
| M-001 | — | — | — | ✅ |
| M-002 | — | — | — | ✅ |
| L-001 | — | — | 候选 | ✅ |
| L-002 | — | — | — | ✅ |
| L-003 | — | — | — | ✅ |
| L-004 | — | — | — | ✅ |

---

## 建议优先级

1. **立即修复**：M-001（manifest version 重复）— 1 行删除。
2. **尽快修复**：M-002（bookmarks 权限缺失）— 1 行添加，否则 popup 功能不可用。
3. **计划修复**：L-001~L-004（工程卫生问题）— 可在下个 minor 版本统一处理。

---

**评估人**：Codex Security Audit Engine
**签名**：SHA256 验证可用 `boxing/SECURITY_AUDIT_REPORT.md`
