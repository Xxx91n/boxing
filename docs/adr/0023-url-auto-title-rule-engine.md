# ADR-0023: URL 规则自动填标题 — match-pattern 子集 + 预设提取 + 精简 eTLD

## Date
2026-10-15

## Status
Accepted - wave 2026.10.16 grill 决策 D-005/D-006/D-007/D-008（atomcode 行业调研）

## Context

需求：添加/编辑书签时根据 URL 自动填充标题，设置里可配置多条提取规则。调研结论（atomcode，交叉 linkding/tldts/Chrome match patterns/PSL 官方）：成熟项目里 URL 派生标题只做兜底而非终态，但本需求语义明确=结构化派生（用户决策 D-005）；`new URL()` 解析而非手写正则（本项目有 IPv6 括号陷阱前科）；eTLD+1 必须靠公共后缀表；match-pattern 已有 Chrome 语法惯例。项目零 npm 依赖红线排除直接引包。

## Decision

- 引擎 = 有序规则列表 `{ match-pattern 子集, 预设提取类型 }`，首个命中生效，末尾内置默认兜底规则；
- pattern = Chrome match-pattern 受限子集（`scheme://host_pattern/path`，host 支持 `*.` 前缀与 `*`、path 支持 `*`），自写小 matcher 零依赖；
- 提取类型 = 内部预设枚举 8 类（域名主体/完整主机名/子域名/路径首段/路径末段/路径前两段/域名主体+路径首段/完整 URL），**用户不可写正则/捕获组**；
- eTLD+1 = 精简多段公共后缀表（~40-60 条，co.uk/com.cn/org.jp 类），命中多取一段；
- 出厂规则：`https://github.com/*/*`→路径前两段、`https://*/*`→域名主体；
- 触发 = urlInput blur/input 去抖 ~300ms，仅当标题框空或被上次自动值占据时写入，手改不覆盖；add/edit 弹窗同享；关闭时回退现状 hostname 兜底。

否决备选：纯正则规则（B 被用户显式否决——正则语法不面向使用者）；全量 PSL vendored（~100KB+ 数据为重，真实世界命中率增益不足）；naive 末两段（`foo.co.uk`→"co" 必错）；抓真实 `<title>`（D-005 负向——本功能不做网络抓取）。

## Consequences

- 正面: 规则列表 schema 清晰可扩展（追加预设类型不改结构）；match-pattern 子集与用户自举的语法直觉一致；零依赖；8 类提取覆盖 GitHub owner/repo 等高频场景。
- 负面/妥协: 精简后缀表非全量——冷门多段公共后缀上的域名主体会取错段（可后续补表）；match-pattern 子集不支持 path 中段 `*`、query 匹配，表达力低于完整规范。
- 中性/约束: `layout.settings` 新增规则存储形态（有序列表 `{pattern, type}` + 开关），属于持久 schema 契约——改形态须 expand/contract；提取类型枚举只允许"追加"不允许改语义；用户侧永不出现正则语法。

## Review

- 复核日期: 2026-11-14
- 复核项: 精简后缀表的真实误命中率；用户是否实际配置了出厂规则之外的条目（决定 B 正则是否值得复活）；8 类提取是否有第 9 类高频缺口。
- 复核结论: <待回填>
