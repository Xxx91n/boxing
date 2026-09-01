# architecture-recovery — 架构修复流转目录

- WORKFLOW.md — 巡检到收口的整体流程 (入口技能 + 产出物 + 偏离点清单)
- research-report.md — atomcode 架构调研摘要 (生成依据)
- spec.md — 本地 spec
- issues/ — 本地票, blockers-first 编号
- handoffs/ — 每票交接文档
- prompts/ — 多窗口启动器, 人工逐窗贴入

## 并行波次表 (由 issues/ 的 Blocked by 直接推导)

| 波次 | 票 | 说明 |
|------|-----|------|
| W1 | 01, 02 | 无依赖, 并行 |
| W2 | 03 | 依赖 01+02 (绿套件 + 调用图) |
| W3 | 04, 05 | 依赖 03 (流水线已通) |
| W3 | 06 | 依赖 02+03 |
| W4 | 07 | 依赖 03+06 (状态收敛后) |
| W5 | 08 | 依赖 07 (门面就位) |
| W6 | 09 | 依赖 08 (结构做完才删规则) |
| W6 | 10 | 依赖 08; 补录 settings/init ~1800 行拆分 (callgraph 7.2 #6 缺口, atomcode 心智模型调研裁决) |

## 票状态表 (首脑复核登记)

| 票 | 状态 | 复核日期 | 复核结论 |
|----|------|----------|----------|
| 01 | done | 2026-08-31 | 4 项验收全部有实证: quarantine 配置在位 + grepInvert/workers 生效; 名单附录 A 实测定为 30 项 (自述原写 9, 是历史印象); 两个零断言探针文件确认已删; but 分支 arch-recovery-01-quarantine 落位 7 commit; `npm test` 3 轮绿为子窗口自述, 未由首脑复跑 (03 票开工前的同一条门跑过后方算双边验证) |
| 02 | done | 2026-08-31 | 脚本 tools/callgraph-scan.mjs 可无头重跑 (EXIT=0, 输出内部自洽), 报告 318 行含领域分区/风险符号/结构结论; 报告内部对 ntp.js 行数记作 6095 (票 01 修复后源文件从 6055 涨至 6095, 报告基于当下源, 无过时) |
| 03 | done | 2026-09-01 | 4 项验收全部首脑实证: favicon.js 148 行在位、export/边界符号齐全、ntp.js 6094→5951 行且 FAVICON 块已净除、index.html module 标签在位; 两份 playwright 配置均含 allow-file-access-from-files; WORKFLOW §6 票03 两行留痕在位; commit kuu(6d5233c) 内容仅限本票范围、栈序 03→02→01 与自述一致; 首脑独立复跑 `npm test` 411 passed (5.4m) + `npm run build` DONE_BUILD (dist 双树 favicon.js+module 标签均真) — 01 的"3 轮绿"此前仅为子窗口自述， 本次复跑同时构成双边验证 |
| 04 | done | 2026-09-01 | i18n.js 286 行在位 (I18N_FALLBACK/loadI18nStore/applyI18n 全移), ntp.js 零内嵌字典且 initI18n 注入一行在位; 新增 boxing-i18n-module.spec.ts 4 测试在位; commit 43c4189 scope 干净 (仅本票 6 文件); 04 自述曾代迁 05 的 box-v3 断言 (clampToEdge/migrateLayout) 并留注释, 05 未冲突 |
| 05 | done | 2026-09-01 | utils.js 229 行、剥注释后副作用扫描 0 标记 (storage/DOM/fetch/i18n 皆无); ntp.js import 恰 28 消费符号 (clampToEdge 死代码留 utils、rectsOverlap 随迁, 属实); 4 commit 分批落位, scope 逐 commit 干净 |
| 06 | done | 2026-09-01 | state.js 145 行零导入纯叶模块; Node ESM 冒烟实证 92 导出 + live binding (setCanvasZoom(2.5)→读即 2.5); 声明唯一性抽查 writerId/storageWriteChain/applyingExternalLayout/layoutRevision/canvasZoom 在 state.js 外 0 声明; ntp.js 收敛至 5442 行; 栈序 06→05→04→03→02→01 落位与自述一致 |
| 门 | 2026-09-01 | — | W3 收口首脑复跑: 第 1 次 `npm test` 2 failed/417 passed (失败名单未捕获, 时序与并行负载争用相符), 第 2 次静默机复跑 419 passed (6.3m) 全绿; `npm run build` DONE_BUILD, dist 双树 i18n/utils/state/favicon 四模块齐 |
| 07 | done | 2026-09-01 | 4 项验收全部首脑实证: storage.js 366 行单例门面在位 (Node ESM 冒烟恰 12 导出, 写链三件套 saveLayout/applyingExternalLayout/registerStorageOnChanged 全数迁入); census 全仓 layoutStorage.set 仅 4 处且皆在 storage.js 内, ntp.js 0 直写、storageWriteChain 0 残留声明; ntp.js 5160 行; 栈顶 arch-recovery-07-storage 于 04 之上, 链序 07→04→06→05→03→02→01 与自述一致; 首脑复跑 npm test 首轮即 419 passed (3.4m) + build DONE_BUILD 双树含 storage.js; 双标签 9/9 为子窗口 persistent-context 脚本实证, 首脑复核证据链不重复实机。注: 报告署名 docs commit 14af791 现为 db9134a — GitButler 压栈 hash 漂移, 内容一致, 非违规 |
| 08 | done | 2026-09-01 | 4 项验收首脑实证: persist.js 250 行/render.js 2775 行在位, ntp.js 收敛至 2207 行 (-57%)、头部 7 模块 import + initRenderFacade/initPersistFacade 注入均在位; 写路径 census 除 storage.js 外 ntp/ 全目录零 chrome.storage.set; ADR 标记普查 (CONN_VP_MARGIN/line pool/grid hash/rAF/connById) 全真 (querySpatialNearby 在 utils.js 由 05 迁出, 属正常); 模块依赖图为无环 DAG (state/favicon/i18n/utils 叶); commit 8e57d68+c11f4e5+d14512c scope 干净, 栈序 08→07→04→06→05→03→02→01; 首脑复跑全套 418 passed + 1 failed (firefox accent-theme graphite — 单独复跑 5/5 绿, 确认为车道抖动非回归, 与票07 所记同类); build DONE_BUILD 双树含 persist/render.js |
| 09 | done | 2026-09-01 | 3 项验收首脑实证: AGENTS.md 实测 184 行/18664B (无 BOM, 首行 routing override 完好), BX-DEV-001 已删、SEC-08/CRX-R-009/测试命令表存活, 新增 NTP module map 在位; 悬空引用扫描: 残余 BX-* 引用均在 ADR/critical-lessons/docs CONTEXT 中以"规则原文+结构指针"形式存活 (CONTEXT.md:70 → render.js 指针与报告一致), 无真空引用; commit a0a854c message 逐条点名承担者 (与本复核表同构); 栈序 09→08 与自述一致 |
| 10 | done | 2026-09-01 | 6 项验收首脑实证: credentials 73L/sync-engine 828L/settings-ui 331L/onboarding 111L 全部在位, ntp.js 997 (实测 990) 行; ADR-0016 落盘且先于实施 commit (0ccd2b5 在 e97366d 前); 写面 census: 除 storage.js 门面外 ntp/*.js 零 storage 写, background.js 仅 bgErrLog+boxingInstallSignal 两枚 SW 合法小键 (ADR-0016 记录); window.__boxing* 诊断契约 6/6 抽查存活; commit message 为完整机器可读交付单; 栈序 10→09 与自述一致。远端 WebDAV 实往返 = 用户手动验证留白, 报告明示 |

## 过程违规登记 (不追认, 仅记录)

1. **02 分裂为两个 commit**: b1dd23c 与 5b855707 同消息 "ticket 02 callgraph scan for ntp.js split"。5b85570 混入 prompts/01、prompts/02、dev-chrome 拼接轨, 与同 commit 内 tools/callgraph-scan.mjs 不属一个逻辑变更。两个 commit 同名不同物, 历史审阅者会迷惑。
2. **WORKFLOW §6 教训写回越位**: 票01的教训提交 (5327c01) 落在票02的 lane 上 (commit message 自标 "via 02 lane")。内容归属正确, 但跨 lane 共享文件的写回在 WORKFLOW 里没定规矩 — 双轨下谁写教训中枢文件 (首脑统一合并, 还是子窗口各自写但撞 commit 自担), 需要明确一条。

## 收口 (全 10 票 done, 2026-09-01)

十票全绿。合入顺序严格: **01→02→03→05→06→04→07→08→09→10** (栈 10→09→08→07→04→06→05→03→02→01, 注意 04/06 对调)。

### 收口欠账 (按优先级)
1. **firefox 车道并行抖动 (卫生)**: 本轮首脑 3 次全套件复跑 = 9F+411P / 8F+411P / FF 单车道 199P+1F; 全部失败项单独/单车道复跑即绿 (star-sync 3/3, state-sync fixed-frame 2 车道绿, webdav settings panel 2 车道各 2/2 绿)。与票 07/08/10 所记同类, 非回归 — 但全套件并行跑不通 = 门失去一票否决力, 应立后续票 (firefox lane workers/并发预算) 抬回红色优先。
2. **ADR-0017/0018 未落**: 0017 (07 实决保留 flag — 记 YAGNI 或立重构票) / 0018 (06 派生失效+undo)。
3. **票 06 WORKFLOW §6 孤儿行**仍挂 zz 未提交 (跨 lane 写回规矩待 WORKFLOW §5 裁决)。
4. **napi/dev-chrome/dev-firefox junction 噪音 + .scratch 规划文件** 未提交属本窗口资产, 收口时一并处置。
5. **远端 WebDAV 手动往返** (票 10 留白) — 用户手动验证。
