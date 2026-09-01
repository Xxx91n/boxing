# 06 — 共享状态收敛为 state 模块

**What to build:** ntp.js 闭包内的共享可变状态 (layout / revision / 抑制标志等, 按 02 票清单) 收敛为单一显式 state 模块。整个模块图内恰有一份状态: 要么 state 模块持有 (ESM 单例语义), 要么入口模块持有并于 init 注入 — 实施时二选一并写明理由。严禁两模块各持副本。

**Blocked by:** 02, 03

**Status:** done (2026-09-01, ticket 06 agent)

- [x] 调用图上的共享可变状态全部单点持有 — 57 符号全仓声明扫描: ntp/state.js 唯一持有点 (ntp.js/favicon/i18n/utils/index.html/background.js 全 0 decl); state.js 零导入纯叶模块; 120 写位点 (111 codemod + 9 decl-tail 补扫) 全部改写为 set*() setter, 57 符号裸写残留扫描 0
- [x] 选择 (b) state 模块单例, 决策理由写入 commit yuw (四条: 读位点免改写/单次求值排除双副本/init 序安全/叶模块无环 07-08 可复用)
- [x] 拖拽/缩放/多标签交互路径行为不变 — boxing-connections (41, 拖拽/连接/星标/跨标签) + boxing-v3 + viewstate/DSU 全量 419 passed; provisional line 3 项失败为 decl-tail 漏改所致, 修补后复绿
- [x] `npm test` 419 passed (4.5m) + `npm run build` DONE_BUILD (dist 双树 state.js 7708B) + Node ESM 冒烟 (92 导出, live binding 实证 setCanvasZoom(2.5)→读即 2.5)

---

## 处置结论 (子窗口 → 大脑, 2026-09-01)

1. **交付物**: ntp/state.js (145 行) = 票02 callgraph §5 state 桶 57 符号 (55 decl: export-let 35 / export-const 22) + handoff 点名的抑制标志族 (lastClick*/lastDrag*/lastEnter*/suppressInnerDblClickOnce, 分类器锚定遗漏落入 unclassified 桶者一并收敛); ntp.js 5442 行, 头部 import 92 绑定 (57 数据 + 35 setter), 120 写位点改写 set*(), 全部读位点不动 (live binding)。
2. **决策**: (b) state 模块单例。理由四条已写入 commit message: (1) ~55 符号 × 700+ 读位点, 注入方案连读也要改写, live binding 读零改动爆炸半径最小; (2) 模块图单次求值, 恰一份状态, 调研报告禁止的 "两模块各持副本各活各的" 被结构排除; (3) import 先于入口体求值, 处理器无 init 序风险; (4) 零导入叶模块无环, 票07/08 引用同一单例。
3. **验证证据**: 干跑 (dry) 与 apply 产物逐断言一致 (18 区域/57 符号/111 位点); 首轮 npm test 413+6 失败 (provisional line 几何) 定位为 decl-tail 漏改 — `const ci = clamp(...); innerPanX = ci.x;` 声明行守卫过宽跳过整行, 定点修补 5 行 9 位点后 419 passed 全绿; build DONE_BUILD; git diff --check 干净。
4. **版本控制 (§4.2)**: branch `arch-recovery-06-state`, commit `yuw`。提交被拒一次 (ntp.js 依赖票05 提交), 按 Hint 处方 `but branch new --above arch-recovery-05-utils` 建栈后落位 (栈序 06→05→04→03→02→01)。未 push。
5. **偏离/勘误** (供首脑复核登记): (i) codemod 首版整文件字符级 lexer 因注释撇号 (box's) / 除法歧义产生幻影字符串污染带被废弃, 改线级扫描 (正则字面量同线闭合感知 + 跨行 carry), 该教训写回 WORKFLOW §6; (ii) 票02 正则的 TOMBSTONE_TTL 是死名 (ntp.js 无此符号), 55 decl 而非 56; (iii) WORKFLOW §6 有两处行走漏 (票03 首行 + 票05 首行句尾逗号), 非本票引入未触碰。
6. **给 07/08 的接口提示**: storageWriteChain/applyingExternalLayout 已入 state.js, 票07 门面只 export saveLayout 语义不改持有; writerId (per-tab 会话身份) 也在 state.js, 跨标签防回环读它即可。
