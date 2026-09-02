# 收口后第二轮调研 → 立票建议（brain 窗口，2026-09-02）

## 依据
- 本地实物：模块尺寸/导出面/quarantine 现状（ctx node 扫描）
- 联网调研：ctx source=atomcode-arch-maturity（13 searches / 12 全文 / 三引擎）
- 既有 backlog：handoff 8 条

## 结论：现有架构符合业界成熟模板，不推倒重来
tldraw 组合根注入 = initRenderFacade 模式；storage 单写门面 = Chrome 官方 + tldraw store 模式；quarantine 双 config = minware/playwrightsolutions/timdeschryver/QASkills 2026 标准形态；glossary+ADR = Fowler Ubiquitous Language 完整形态。

## 建议立的新票（3 张，按优先级）

### 票 A — render.js 二期拆分（强建议，Worth exploring）
切口（业界先例背书，excalidraw PR#9285 / tldraw 分层）：
1. 纯几何/索引下沉 utils.js：dsuFind/dsuMake/dsuUnion、clampCanvasPan、zoomAtPoint 数学部分、boxMidPoint（延伸 screenToWorld 先例）
2. conn 图层整体拆 conn-layer.js：acquireLineEl/recycleLineEl/renderConnections/updateSvgLine —— 必须连 __linePool/__connRefreshRAF/__dsuDirty 一起带走（culling/LOD/调度同源）
3. 弹窗 DOM 构件拆 popups.js：showBookmarkEditPopup/showAddBookmarkPopup/renderBookmarks 及其 drag handlers（不碰画布变换不变量）
**不拆**：画布变换不变量组、DOM 构建+事件绑定组（业界共识留在一起）。
反模式警示（dev.to 实录）：拆完暴露 this 绑定/初始化顺序/CSS 顺序三坑 → 沿用 WORKFLOW §6 十层自验。

### 票 B — quarantine 车道治理补强（小票，直接照搬）
1. 每个 @quarantine 标签挂 ticket 号（49 处中已有 19 处 tag，逐个挂 issue 引用）
2. 修复/退役时限：30 天规则（minware 建议）写入 ticket 或注释
3. CI 增加每日定时 job 跑 quarantine 车道生成报告（continue-on-error: true，QASkills/playwrightsolutions 模式）
4. （可选，高投入）自动解封 auto-quarantine —— YAGNI 标记，先不做

### 票 C — ADR 治理补强（极小票）
下一条 ADR 起加显式 "Consequences + 30 天后复核" 小节（joelparkerhenderson 模板库 + MADR 4.0）。一次性文档更新，无代码。

## 不建议立项（YAGNI 裁决）
- render.js 按行数再拆：行数不是拆分依据（Charemza moving-part / paulrberg LOC-is-discovery），只按上述三条不变量切口
- 引入 DI 库/框架：组合根注入已是标准形态
- Momentum/Infinity 对标：闭源不可核，放弃此调研线
- 同步 outbox/revision vector（backlog 4）与 undo（backlog 3）：维持原 backlog，等用户拍板

## 待用户裁决（原 backlog 中本次确认仍存在的）
1. ADR-0017 YAGNI vs value-comparison guard 票
2. ADR-0018 undo（tldraw HistoryManager 结论已在 ctx source=atomcode 历史）
3. LWW→outbox 队列
4. i18n-003/005/006 build 校验器
5. WebDAV 远端手验
6. WORKFLOW §5 六条偏离裁决
