# Report — 10 点击标题全选

- 日期: 2026-09-10
- 票面: issues/10-title-select-all.md · handoff: handoffs/10-title-select-all.md · 调查: 43-2026-09-12-wave4-investigation.md P2
- 阻塞: 09 — create-render-decouple 已完成（reports/09-create-render-decouple-report.md），本票只动 render.js 的 title 块，创建管线零触碰。
- 版本控制: 遵循 WORKFLOW §4.2（本票改动已落独立票分支提交；不推送、不开 PR）。

> **落点说明（并行窗口竞争，2026-09-10）**: 本票三个文件（ntp/render.js title 块、
> test/tests/boxing-title-select-all.spec.ts、本报告）在按 §4.2 落独立票分支提交时，
> 与并行 ticket-13 窗口的提交发生竞争——其提交先行把本窗口未提交改动一并收走，
> 内容已完整入库，且与本窗口验证版本逐字节一致（提交后 diff 为空，node --check / 行尾 /
> 计数守卫均在该内容上通过）。按本票硬约束「不改写他人提交」，本窗口未做任何历史手术，
> 独立票分支归位留给主 Agent 决定（GitButler 支持按文件从既有提交拆分挪移）。
> 本票分支 10-title-select-all 上另含本落点说明自身的一条报告更新提交。

## 改动

1. ntp/render.js · 新增共享 helper `selectAllTitleText(el)`（helpers 区，紧邻 getLargeBox）:
   focus → Range.selectNodeContents → Selection.removeAllRanges/addRange。
   平台标准 API，Chrome/Firefox 双车道一致；不引入 execCommand('selectAll')。
2. ntp/render.js · large-box title mousedown（原 L427）: `title.focus()` → `selectAllTitleText(title)`。
3. ntp/render.js · small-box title mousedown（原 L813）: 同上。
4. ntp/render.js · inner crumb title（_enterLargeBox 内，原 L671）: mousedown 补
   `selectAllTitleText(innerCrumbTitle)`（即补 focus + 全选，delta 之「crumb 补 focus」）。
5. ntp/render.js · crumb 补 `onkeydown`（Enter → preventDefault+blur 走 onblur 保存；
   Escape → 还原 lb.title + blur）——AC3 对三处表面统一生效所必需；用属性赋值而非
   addEventListener，因 innerCrumbTitle 是持久元素、_enterLargeBox 每次进入都会重挂，
   避免监听器堆叠。large/small 的 Enter/Escape 原本已有，不动。
6. 新增 test/tests/boxing-title-select-all.spec.ts（4 用例，见下）。
7. 本报告。

未做: 不碰 09 的创建管线（addLargeBox*/addSmallBoxAt 无 diff）；不改 SEC-03 paste 处理器；
  不修 innerCrumbTitle mousedown/paste 监听器随 _enterLargeBox 重挂的既有堆积问题（非本票范围）。

## 测试（boxing-title-select-all.spec.ts）

种子: applyExternalLayout 注入 1 大盒（title Alpha，child S1 title Beta）——沿用
conn-dsu / settings-persist 先例；mousedown 用合成事件（票 27 跨车道惯例），文本输入用
真实键盘打到已聚焦 contenteditable。

- 用例1 large: 点击标题 → selection 字符串 === 'Alpha'、焦点在 .large-box__title、
  盒子 boundingBox 不变（AC1+AC4）；键入 'Gamma' 整名替换 → Enter → layout.boxes[0].title
  === 'Gamma'（blur 保存）；再点 → 全选 'Gamma' → 键入 'X' → Escape → DOM 与 layout 均还原（AC3）。
- 用例2 small: enterLargeBox 后点击 .small-box__title → selection === 'Beta'、不拖拽；
  替换 'Delta' + Enter 保存至 children[0].title；Escape 还原（AC1+AC3+AC4）。
- 用例3 crumb: 点击 #inner-crumb-title → selection === 'Alpha' 且 activeElement 的 id ===
  'inner-crumb-title'（修复前 mousedown 连 focus 都没有——AC2）；Enter 保存、Escape 还原（AC3）。
- 用例4 源码契约: helper 定义恰 1 处；三个接入点 (title×2 + innerCrumbTitle×1)；crumb
  onkeydown 存在；SEC-03 纯文本 paste 恰 3 处；`await saveLayout` 不存在、`void saveLayout();`
  恰 3 处（09 管线不回归）。

车道说明: 与 focus-steal 同惯例走 file:// mock NTP；本机按 2026-09-04 CI-only 构建政策
不跑 Playwright，全绿以 CI run 为准。

## 本机验证

- `node --check ntp/render.js` 绿；`node --check ntp/ntp.js` 绿（票面 AC5 语法项）。
- 行尾 LF、无 BOM；`git diff --check` 干净。
- codegraph sync: 源码改动后增量索引已跑。
- 创建管线守卫: 全文件 `await saveLayout` = 0、`void saveLayout();` = 3（与 09 报告一致）。

## 验收对照

| AC | 状态 | 证据 |
|---|---|---|
| 点击大/小标题 → selection === 标题文本 | code-done CI-open | 用例1/2 + 改动2-3 |
| crumb 全选并获焦 | code-done CI-open | 用例3 + 改动4 |
| 键入替换；Escape 还原；Enter blur 保存 | code-done CI-open | 用例1/2/3 + 改动5（crumb 补齐） |
| 不触发拖拽；SEC-03 paste 保留 | code-done | boundingBox 相等断言 + 用例4 源码契约（paste 处理器零 diff） |
| Playwright selection 断言；node --check | node --check 绿；Playwright CI-open | 用例1-3 + 本机语法检查 |

## 残留风险

- 用例依赖真实键盘对 contenteditable 的选区替换语义；若某 CI 车道键入不生效，用例4 的
  源码契约仍能守住接入面，行为断言可降级为 selection-only（先例：票 27 车道收敛）。
- crumb 全选后焦点在标题上，Escape 还原同时 blur——与 large/small 行为一致，无新语义。
- innerCrumbTitle 的 mousedown/paste addEventListener 堆叠是 09 之前既有问题，未在本票处理；
  onkeydown 用属性赋值故不新增堆叠。
