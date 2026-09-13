# Store Copy Governance — Boxing

> 固化日期: 2026-09-13 · 适用: AMO / Edge Partner Center / 未来 CWS  
> 权威正文（可粘贴）: `docs/store-assets/descriptions/<locale>.txt`  
> 历史长文与字段表: `store-listing.md` · `store-listings-2026-09.md`（仍有效，但 **Description 以 .txt 为准**）

## 1. 为什么不用 Markdown

| 商店 | 问题 |
|---|---|
| Edge Partner Center | Description 为纯文本框，不渲染 `###` / 表格 / 链接语法 |
| AMO | 长描述支持有限 HTML/纯文本，Markdown 表格会原样露出 |

**规范（grill 心智：面向用户、可扫描、无工程师记号）：**

1. **禁止** `#` / `**粗体**` / `| 表格 |` / 反引号命令块。
2. 分区用 **空行 + 全大写或中文方头括号风格短标题**（`FEATURES` / `功能`）。
3. 条目用 `•` 或 `-`，一行一事；避免长段。
4. 链接写完整 URL（商店常把 URL 自动链上）。
5. 权限、隐私、技术各一节，**先用户利益后权限**。
6. 字符长度：Edge Description **250–10000**；AMO Summary **≤250**（另文件）。
7. 新增语言：新建 `descriptions/<tag>.txt`，禁止只改 `store-listing.md` 的 Markdown。

## 2. Edge 多语言（显式语言前缀）

Partner Center **Store listings → 每种语言一个独立页签**。操作顺序：

1. **Languages** → 添加所需语言（至少 `English` + `Chinese (Simplified)`）。
2. 在 **对应语言页签** 下填 Description（不要把中文贴进 English 页签）。
3. 截图/Logo 可对多语言复用；**Description / 搜索词必须分语言**。
4. 提交审核时语言集合决定商店展示 locale；缺语言时商店回退到默认语言。

**内部文件名与 Edge 语言名对照：**

| 文件 tag | Edge / Partner Center | 备注 |
|---|---|---|
| `en.txt` | English | 默认语言（canonical） |
| `zh-CN.txt` | Chinese (Simplified) | 已完整 |
| `zh-TW.txt` | Chinese (Traditional) | 待译（可暂用 zh-CN 人工校订） |
| `ja.txt` | Japanese | 待译 |
| `ko.txt` | Korean | 待译 |
| `de.txt` `fr.txt` `es.txt` `pt-BR.txt` `ru.txt` `ar.txt` `hi.txt` `th.txt` `vi.txt` | 对应语言名 | 待译 |

`_locales/` 现有 14 语言（ar, de, en, es, fr, hi, ja, ko, pt_BR, ru, th, vi, zh_CN, zh_TW）为扩展 UI；**商店文案可少于 UI 语言**，但至少 en + zh-CN 必须齐。

## 3. 内容源与同步

| 内容 | 权威源 |
|---|---|
| 功能清单 | `descriptions/en.txt`（英文 canonical） |
| 中文商店文 | `descriptions/zh-CN.txt`（忠实本地化，不逐字硬译） |
| 短摘要 AMO | `store-listings-2026-09.md` Summary 节 |
| 产品截图 | `screenshots/`（1280×800） |
| 隐私政策 | Pages `privacy-policy.html` |

**变更流程：** 改产品功能 → 先改 `en.txt` → 再改已完成语言的 `.txt` → 最后更新历史 Markdown 仅作交叉引用。禁止反向（只改 Markdown）。

## 4. 语言状态（2026-09-13）

| Locale | 状态 | 文件 |
|---|---|---|
| en | **ready** | `descriptions/en.txt` |
| zh-CN | **ready** | `descriptions/zh-CN.txt` |
| 其余 12 | pending | 可复制 `en.txt` 结构翻译；未译前商店暂不添加该语言页签 |

## 5. 审核备注（沿用）

- 源码无混淆、无打包；若商店要源码 zip：`boxing-source-<ver>.zip`
- 主机权限仅用于用户自配 WebDAV；默认私网拒绝，可显式 opt-in（2026.9.12+）
- 不收集用户数据；隐私政策 URL 与 listing 一致

## 6. 版本

2026.9.12 商店提交请使用本目录下 **en.txt / zh-CN.txt** 全文粘贴；`store-listing.md` 的 `###` 结构仅供仓库内阅读，**不要**再原样粘进 Partner Center。
