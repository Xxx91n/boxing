# 09 — AGENTS.md 薄化 · 子窗口收工报告 (子窗口 → 大脑)

- 日期: 2026-09-01
- 状态: **done** — issues/09 验收 3/3 勾选 (勾选动作已含于 docs commit); 本文件为收口用完整版
- 分支: `arch-recovery-09-agents-md-thinning` (anchor 于栈顶 arch-recovery-08-persist-render 之上, 全链 08→07→04→06→05→03→02→01 为其祖先)
- 提交: docs `qss` / 6e51afe (AGENTS.md + CONTEXT.md + issues/09 + WORKFLOW §6, 单 commit 收口; 报告文件随后 amend 进同一 commit)

## 交付物

| 文件 | 变化 | 内容 |
|---|---|---|
| AGENTS.md | 251 行/28,164 B → **184 行/18,632 B** (净 -80 行 diff: -81/+13 中含指针改写) | 删 BX-DEV-001..020 全表 + i18n-DEV 9 行表 + BX-EXPLORE-005..009/139/140 + Debug 表 + CSS Token 表 + Architecture 节; 保留行改写指针; 新增 "NTP module map" 节 (8 模块 + 承担面声明) |
| CONTEXT.md | 1 行 | L70 悬空指针 "See AGENTS.md BX-EXPLORE-005" → "Implementation carried by the drag handlers in ntp/render.js" |
| issues/09-agents-md-thinning.md | 新文件 + 3/3 勾 | 验收单全勾 |
| WORKFLOW.md | +1 行 | §6 票09 教训 (悬空引用面三件套) |

## 每条被删规则 → 替代承担者 (验收项 1, commit message 同文)

| 被删规则 | 承担者 (动手前逐一实证存在) |
|---|---|
| BX-DEV-001..010 (UI 行为) | render.js/persist.js 实现本身 + boxing-zoom/v3/settings-persist 等 E2E (UI 行为可从 E2E 断言推断) |
| BX-DEV-011 (禁依赖) | 与保留 Hard Rules CRX-R-009/010 完全重复 → 删重复 |
| BX-DEV-012 (brand__mark) | 死法: 代码中 brand__mark 已不存在 → git history |
| BX-DEV-013 (CSS 双写) | A8 校验器 (.github/scripts/build.mjs, ADR-0005) + 保留的 docs/css-dual-write-convention.md 节 (含标记要求全文) |
| BX-DEV-014/017/018 + BX-EXPLORE-005..008 | render.js conn-layer/LOD stroke/connById Map/scheduleConnRefresh 实现 + docs/agents/critical-lessons.md 条目 8+10 + ADR-0004 |
| BX-DEV-015/016 (SUPERSEDED 行) | 本身已标注失效 → git history + critical-lessons.md |
| BX-DEV-019 (DSU) | state.js/render.js DSU 实现 + boxing-conn-dsu.spec.ts (11 case) + ADR-0007 |
| BX-DEV-020 (hidden 配对) | boxing-canvas-hidden.spec.ts 显式回归守卫 (describe 自标 BX-DEV-020) + base.css [hidden] fallback |
| BX-DEV-139 (conn 删除) | boxing-conn-delete-action.spec.ts + ADR-0006 |
| BX-DEV-140 (主题包) | persist.js THEME_PACKS/applyTheme + boxing-accent-theme.spec.ts + ADR-0012 |
| BX-EXPLORE-009 (函数名拼写) | ESM import 面使拼错名在加载期即炸 (ReferenceError 不再静默于 catch) + storage.js 门面 + 保留 SEC-08 |
| BX-I18N-001/002 | A7 校验器 (build.mjs 14 locale 键平价, ADR-0005) |
| BX-I18N-004 | ntp/i18n.js 模块 + boxing-i18n-module.spec.ts 源码契约测试 (断言字典在 i18n.js、不在 ntp.js) |
| BX-I18N-DEV 9 行表 | 与前表近重复 → 并入保留行 + 上述同承担者; DEV-009 (切语言重渲染) → 三语切换测试 |
| BX-DEBUG-001..003 | 代码自证 (DEBUG 常量) + 保留 Build and Verification 表 (node --check/npm test 行) |
| CSS Token Baseline 表 | docs/DESIGN.md (ADR-0008 三层 token) |
| Architecture (v3.7) 节 | 新 NTP module map + docs/adr/0007 |

**保留原样 (验收项 2)**: CRX Hard Rules 15 条、Build/Playwright/Workflow 命令表、codegraph 规则 BX-EXPLORE-001..004 (无结构承担者, 不可推断)、i18n-003/005/006 (placeholders/fallback 覆盖/data-i18n 匹配 — 无结构校验器; 005 行内 ntp.js→ntp/i18n.js 路径修正)、**SEC 系列逐字节保真** (脚本 endsWith 断言)、Manifest 契约/Critical Lessons/Perf Anti-Patterns/Version History/ADR 指针节。

## 悬空引用修复 (验收项 3, 检查点发现)

| 位置 | 问题 | 处置 |
|---|---|---|
| CONTEXT.md:70 | "See AGENTS.md BX-EXPLORE-005" 指向已删规则 | → 指向 ntp/render.js 拖拽处理实现 |
| AGENTS.md Build 表 | `node --check ntp.js` — 根目录无 ntp.js (已迁 ntp/) | → `node --check ntp/ntp.js` |
| AGENTS.md 路由冻结块 | "ntp.js ~3.3k lines" 陈旧 (实为 2207) | → "ntp/*.js ES modules (entry ntp.js ~2.2k lines)" |

检查点三件套: 残余全文复读 + 全仓规则 ID 引用 grep (CONTEXT/docs/agents/test) + 唯一内容断言 spec 单跑 — 缺一不可 (教训见 WORKFLOW §6)。

## 验收证据

| 验收项 | 证据 |
|---|---|
| commit message 点名承担者 | 6e51afe message 含全表 (上节同文) |
| SEC + 不可推断约定原样 | 手术脚本 20 项断言: secBlock endsWith 字节级 + CRX-R/命令表/codegraph 行 startsWith 逐条 |
| 残余引用全部有效 | 复读 + grep + boxing-build-pipeline spec 6/6 (其断言 AGENTS.md 含 BX-MANIFEST-004b/stale — 两串均存活) |
| 门禁 | node --check ×9 模块 OK; 全量 npm test 418 passed + 1 firefox 车道抖动 (boxing-zoom-dblclick, 单跑复绿 3/3, 与票07/08 先例同类); git diff --check 干净; 本票纯文档零源码改动, build 不适用 |

## 版本控制轨迹 (§4.2)

- 首次 commit 被拒: WORKFLOW.md 行级依赖 arch-recovery-02-callgraph → 按票07 教训 anchor 栈顶 `but branch new arch-recovery-09-agents-md-thinning --above arch-recovery-08-persist-render` 后落位 (未用 deprecated --anchor 时被 Hint 提示, 换 --above)。
- WORKFLOW.md 票06 孤儿 §6 行 (未提交): 按票05/07 隔离法暂摘→提交→原样还回 — **该孤儿行现仍在 zz 未提交区, 归票06/大脑收口处置**, 本票未代提交; 本票自己 §6 行随 6e51afe 入库。
- 未 push, 未开 PR。

## 给大脑的收口注意

1. merge/落库顺序: 09 在 08 之上 (08→09), 其余不变; 未 push。
2. zz 未提交区遗留 (非本票): 票06 WORKFLOW 孤儿行 1 条; dev-chrome (M/D junction) + dev-firefox (A junction) 为构建 junction 噪音; .scratch README/handoffs/prompts/issues-10 等未跟踪文件与票10 车道共用, 未触碰。
3. spec 断言耦合提醒: boxing-build-pipeline.spec.ts 以 readFileSync 断言 AGENTS.md 含 "BX-MANIFEST-004b"+"stale" — 后续任何再薄化 AGENTS.md 的票, 动手前先 grep test 里的内容断言 (WORKFLOW 票04 教训的 AGENTS.md 变体)。
4. i18n-003/005/006 与 BX-EXPLORE-001..004 是残余两大块: 前者可由 build.mjs 增补 placeholders/data-i18n 校验器后删 (建议开后续票), 后者取决于 codegraph 是否长期保留。
