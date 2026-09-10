# Report — 03 store-i18n (__MSG_ 多语言商店检测 / T-38)

**票**: feat(i18n-store): __MSG_ placeholders + extensionName/Description in 14 locales
**GitHub**: https://github.com/Xxx91n/boxing/issues/3
**Milestone**: 2026.9.12
**状态**: 实施完成 (code-done), 待 CI 验证 (CI-only 政策: build/A7 正式跑与 Playwright 全套走 CI)
**版本控制**: 遵循 WORKFLOW §4.2 (分支 03-store-i18n @ kky, 锚定于 fix-release-pipeline 之上 — manifest.json 第 5 行与其存在依赖, 按依赖恢复定式锚定栈后一次提交成功)
**atomcode 会话**: ad1703d5-7855-4381-a24d-386b48b23cb0 (续跑锚定, WORKFLOW §6 票28 约定)

## 变更摘要

1. **_locales/<14 locale>/messages.json**: 每个文件追加恰好两键 (只追加, 不动任何既有键):
   - `extensionName` — message 全部为 "Boxing" (品牌名, 14 语言统一; Edge name 上限 45 字符内), 带译者 description 元数据。
   - `extensionDescription` — message 为逐语言撰写的本地化描述 (en 复用原 manifest 131 字符文本, 逐字节一致), 带译者 description 元数据。
   - 文件格式保持: LF、无 BOM、2 空格缩进、结尾换行; ticket 04 的 `syncGroupShared` 键原样保留 (14/14 校验)。
2. **manifest.json**: `name` → `__MSG_extensionName__`, `description` → `__MSG_extensionDescription__`。`default_locale: "en"` 已存在 (有 _locales 目录时三家商店均强制要求, 无需新增)。其余字段零改动 (canonical 对比验证); `short_name` 按票面范围保持硬编码。
3. **test/tests/boxing-v3.spec.ts**: manifest 解析断言迁移 — `expect(manifest.name).toBe('Boxing')` →
   `__MSG_extensionName__` + `__MSG_extensionDescription__` + `default_locale === 'en'` 三断言 (spec.md Testing Decisions 指定本票交付 "a manifest parse assertion that name/description are __MSG_ placeholders"; 源码断言型测试随契约同步迁移, WORKFLOW §6 票04 教训)。

## 质检自检 (动手前)

按质检要求先自检复核主 Agent 结论, 结论成立后从零实施:
- extensionName/extensionDescription: **0/14** (14 locale 各 217 键, 无 extension* 键) — 与 reports/40-wave1-brain-review.md FAIL 结论一致。
- manifest: name="Boxing" 硬编码, description 硬编码 131 字符 — FAIL 结论一致。
- 无本票分支、无本票报告 — NOT-STARTED 结论一致。

## 14 locale 键计数证据 (改后)

A7 等价只读校验 (复刻 .github/scripts/build.mjs validateI18nKeys 逻辑, CI-only 政策下本地不跑构建):
**0 missing / 0 extra / 14 locale 键集完全平价, 每 locale 219 键 (217+2), 14/14 extensionName+extensionDescription 在位**:

| locale | keys | extensionName | extensionDescription 字符数 |
|---|---|---|---|
| ar | 219 | "Boxing" | 127 |
| de | 219 | "Boxing" | 132 |
| en | 219 | "Boxing" | 131 (复用原 manifest 文本, 逐字节相等) |
| es | 219 | "Boxing" | 126 |
| fr | 219 | "Boxing" | 126 |
| hi | 219 | "Boxing" | 131 |
| ja | 219 | "Boxing" | 66 |
| ko | 219 | "Boxing" | 79 |
| pt_BR | 219 | "Boxing" | 126 |
| ru | 219 | "Boxing" | 117 |
| th | 219 | "Boxing" | 130 |
| vi | 219 | "Boxing" | 126 |
| zh_CN | 219 | "Boxing" | 62 |
| zh_TW | 219 | "Boxing" | 62 |

全部 ≤132 (写入前 PRE-WRITE 断言门强制; 首轮 hi=137/vi=133 被拦截, 修文案后重过, 零字节写入无回滚)。

## manifest 前后对比

```diff
-  "name": "Boxing",
+  "name": "__MSG_extensionName__",
   "short_name": "Boxing",
-  "description": "Hierarchical infinite-canvas bookmark organizer with a calm beige design. Organize bookmarks into labeled boxes; list & grid views.",
+  "description": "__MSG_extensionDescription__",
   "default_locale": "en",
```

无关字段 canonical 对比零变化; 写后字节回读 16/16 文件全等。

## 调研核对 (atomcode-research, handoff 指定必做)

- **default_locale**: 有 `_locales` 目录即必填 (Chrome i18n 官方 + MDN "Mandatory Contingent" + Edge 同 Chromium 契约) — 本仓已满足。
- **Edge Partner Center 探测机制**: 依据 manifest `__MSG_` 引用 + default_locale + 各 locale messages.json 对应键枚举语言; 官方 FAQ 明诊断 "单语言 = manifest 硬编码字符串" — 本票修复的正是该病因。已知缺陷窗口 Edge #169: 上传后需人工确认语言列表。
- **AMO**: 完全支持 `__MSG_` + default_locale (MDN 同模式; 历史 #2521 已 verified_fixed); addons-linter 对缺 `message` 字段是 **error** 级 — 新键两键均带 message。
- **132 字符归属勘误**: 132 是 **Chrome Web Store item summary / manifest description** 的上限, 非 Edge 独有规定 (Edge 仪表盘 listing 长描述是另一字段: 250–10,000)。票面 "Edge 硬限" 表述按 ≤132 执行不受影响 (132 是跨店最紧的 manifest description 口径), 记录勘误不推翻约束。
- **名称上限**: AMO 50 / CWS 75 / Edge 45 — "Boxing" (6) 全部合规。

## 验收对照 (issues/03-store-i18n.md)

- [x] All 14 _locales have extensionName and extensionDescription (desc <=132 chars) → 上表 14/14, A7 等价平价 0/0。
- [x] manifest name/description use __MSG_ placeholders → name=__MSG_extensionName__, description=__MSG_extensionDescription__, default_locale=en。
- [x] A7 validator + npm run build green → A7 等价只读校验 PASS (0 missing/0 extra); **npm run build 按 2026-09-04 CI-only 政策不在本机执行**, 正式 build+A7 证据由 CI 产生 (OPEN-CI, 与 01/04/05 同状态); build.mjs 对 name/description 无改写逻辑 (只注入 browserSettings/version), dist 生成将原样携带占位符。

## 测试结果

- 本地只读: 14 locale JSON.parse 14/14 通过; A7 等价平价 PASS; manifest/spec 断言迁移 PASS; git diff --check 干净 (纯 LF, 无行尾回归); diff 面 16 文件 +119/−3。
- CI 待验 (CI-only): npm run build (内含 A7 正式跑) + Playwright 全套 (boxing-v3 的 manifest 断言 + boxing-i18n-module 等)。本票无运行时 UI 改动, 高风险面为 manifest 契约断言, 已本地静态验证。

## 残留风险

1. `short_name` 仍为硬编码 "Boxing" — atomcode 建议 localize (extensionShortName), 但票面明确 "只追加 extension* 两键", 未纳入本票; 可作后续小票。
2. Edge 仪表盘每语言 listing 长描述 (≥250 字符/语言) 是人工仪表盘义务, 与 manifest 键正交, 本票不覆盖 (store-listings-2026-09.md 已有 EN/zh-CN 文案)。
3. Edge #169 探测 bug 窗口: 上传包后需在 Partner Center 人工确认语言列表为 14 项。
4. de 描述恰好 132 字符: 已按 JS UTF-16 code unit 计数校验, 与商店计数口径一致; 若未来商店改按 grapheme 计数亦只会更宽松。

## 教训

- PRE-WRITE 断言门 (写前全量校验, 失败零写入) 首轮即拦截 hi/vi 超限 — 与 WORKFLOW §6 票11 "断言先想清正确状态" 一脉; 文案长度约束必须在写前机检, 不能写后人读。
- 跨分支文件依赖 (manifest.json ↔ fix-release-pipeline) 在提交时原子报错且零副作用; 按报错 Hint 锚定栈后原样重试即成功 — 票10 恢复定式再次生效。
- GitButler 代码分支堆到 docs 分支之上会触发多合并基 cherry-pick 内部错误 ("Failed to merge bases while cherry picking", apply/finish 均失败且 but undo 难以穿越): 根因是 docs 基线携带 2026.8.21 古董 manifest, 与 fix-release-pipeline 现代线在同名文件形成 4 合并基。恢复定式 = resolve cancel --force (工作区解决内容可由 git 对象确定性重建时安全) + 逐笔 but undo 回滚到搬移前 + 文档 hunk 走独立 docs 锚定分支 (本票: ticket-03-issue-mirror)。教训: 跨栈文件依赖的票, 文档镜像与代码提交分栈落盘, 不把代码分支堆上 docs 分支。
- GitButler hunk 级提交使本票 commit 树内 locale 键数 = 218 (216 基线 + 2 本票), syncGroupShared (票04 hunk) 不在本票 commit 内而归 04-sync-ui 分支 — 这是正确的 hunk 所有权模型, 工作树应用态才是 219 键全集; 并行票验收时以 "本票 delta + 所有权排除" 口径核对, 不以工作树全集口径。
