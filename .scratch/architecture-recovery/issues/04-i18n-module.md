# 04 — i18n 抽离为模块

**What to build:** ntp.js 内的 i18n 字典 / fallback / i18nStore 相关代码抽为独立 ES module, 对外暴露明确接口; ntp.js 通过 import 消费。14 语言行为不变。

**Blocked by:** 03

**Status:** done (2026-09-01, ticket 04 agent)

- [x] i18n 模块文件独立, ntp.js 不再内嵌字典 — ntp/i18n.js (286 行) = ntp.js i18n 块 (marker `── i18n store` → `── DOM refs`, 切割时 L243-496) 逐字节搬移 (整段 -2 缩进, round-trip 校验), 内含 I18N_FALLBACK 全量字典 (含 v3.6 追加段) / loadI18nStore / i18n / applyI18n / currentLang / SUPPORTED_LANGS; i18nStore 与 I18N_FALLBACK module-private (拆分前块外 0 引用, callgraph-report §5 #3 防漂移要求字典与 store 同模块)。接口面: `initI18n({api,debug,debugErr})` 注入 (SEC-01 mock 留守 ntp.js) + `export {loadI18nStore, i18n, applyI18n}` + live bindings `export let currentLang` / `export const SUPPORTED_LANGS`; ntp.js 头部 import + L249 `initI18n(...)` 一行, 116 处 i18n() 调用点与 3 处 currentLang 只读点零改动
- [x] 语言切换与 fallback 行为经测试/手动验证不变 — 新增 test/tests/boxing-i18n-module.spec.ts 4 测试: (1) 源码契约 (字典不再内嵌 ntp.js); (2) 强制 fetch 失败 → catch 分支回退 en + I18N_FALLBACK 渲染 + currentLang 复位; (3) subset locale → per-key fallback + export-let live binding 经 __boxingDebug.state().lang 观测 (ja→de 切换链); (4) 检查点: en→ja→zh_CN→ar 三语言真实翻译切换 (期望值动态读自 _locales 磁盘文件, 自校验), 3 语言渲染 3 个不同串。boxing-v3.spec.ts 2 处源码断言 (loadI18nStore/SUPPORTED_LANGS) 同步迁至 i18n.js。检查点切换 ≥3 语言达成 (见上一条测试 4)
- [x] `npm test` + `npm run build` 绿 — npm test **419 passed (6.2m, SUITE_EXIT=0, chromium+firefox 双车道零失败**, 411 基线 + 本票新增 8 项 = i18n spec 4 测试 × 双车道); npm run build DONE_BUILD, dist/boxing-chrome/ntp/i18n.js 与 dist/boxing-firefox/ntp/i18n.js 双树落位, 双 dist ntp.js import 在位; node --check ntp.js/i18n.js 双绿; git diff --check 干净。(过程记录: 前两次全套件分别 40F/9F 均为并行窗口套件叠加负载的 workers 饥饿 — 失败名单逐轮轮换且 solo 全绿, 静默机器第三次 419 全绿; 失败名单与本票 spec 零重叠)

---

## 处置结论 (子窗口 → 大脑, 2026-09-01)

1. **交付物**: ntp/i18n.js (286 行, verbatim 搬移 254 行块 + initI18n 注入器 + export 头尾); ntp/ntp.js 5746→5500 行 (import 行 + 6 行 tombstone 注释 + initI18n 调用, 块原位删除); boxing-i18n-module.spec.ts 新增 (4 测试); boxing-v3.spec.ts 断言迁移。搬移按 WORKFLOW §6 票03 处方走 node 脚本 (marker 唯一性 + 块头块尾断言 + 缩进 round-trip + 注入点计数断言 + 写后自验 + 失败回滚快照), 零手抄。
2. **注入面设计**: 块内跨作用域标识符经逐点 probe 仅 3 处 — `api.runtime?.getURL` / `debug(` / `debugErr(` 各恰 1 次。initI18n 一次性注入 `__api/__debug/__debugErr` (未注入时 logger 为 no-op, 不炸)。SEC-01 mock 留守 ntp.js, 模块只收解析后的句柄。ESM live binding 使 currentLang/SUPPORTED_LANGS 的块外只读点 (state()/init log/onboarding picker) 无需任何改动。
3. **file:// fetch 边界勘误 (票03 教训修正)**: probe 实证 chromium file:// 下 `--allow-file-access-from-files` 只解封 module 脚本加载, `fetch(_locales/**)` 仍 CORS 阻断 (相对/绝对路径均 Failed to fetch)。因此 i18n 源码断言测试与 fetch 型测试改用 fetch stub 服务磁盘真实 locale 字节 (expected 值动态读自 _locales, 自校验), 真实 fetch 路径由扩展上下文验证兜底。已写入 WORKFLOW §6。
4. **验证证据**: node --check ×2 绿; `npm run build` DONE_BUILD (双 dist 树含 i18n.js); i18n 新 spec chromium 车道 4/4 绿; boxing-v3 + boxing-i18n 合跑 19 passed; 全套件 419 项终态绿 (条目 3); git diff --check 干净。I18N_FALLBACK 内既有重复键 (dblclickCreateHint 等) 是搬移前既有债, verbatim 保留未清洗 (later-key-wins 语义不变), 已在模块头注释立牌防误清。
5. **版本控制 (§4.2)**: branch `arch-recovery-04-i18n`; ntp.js 提交采用票05 教训的 hunk 认领 (只取 i18n 相关 hunk, 不卷 05 未提交改动); 分支栈到 05 之上 (05 改动同文件, 04 依赖其 utils import 语义)。未 push。
6. **并行窗口交叉记录 (供大脑复核)**: (i) 05 窗口在共享工作树持续编辑 ntp.js 期间, 04 以原子脚本动刀 (read-modify-write 间隔 <100ms, 前后快照对照), 双方改动无覆盖; (ii) boxing-v3.spec.ts 的 clampToEdge/migrateLayout 断言因 05 搬移符号后未及迁移而卡共享门禁, 04 车道代为迁移到 utils.js 断言 (注释注明 "asserted by 04 lane", 归属票 05) — 若 05 窗口后续也改此测试, 以其为准合并; (iii) 05 窗口对 ntp.js 的 L5 import 行与 04 的 import 行相邻同 hunk, 提交时按 hunk 边界认领。
7. **偏离/勘误**: 无功能偏离。勘误一条: 票03 WORKFLOW §6 "file:// 调试/测试车道因此保活" 的表述边界已修正 (脚本加载保活, 运行时 fetch 仍断), 详见处置结论 3。
