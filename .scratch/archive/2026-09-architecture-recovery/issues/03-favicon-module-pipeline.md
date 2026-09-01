# 03 — 首模块流水线: favicon 块抽离 + ESM 切换

**What to build:** ntp/index.html 切到 `<script type="module">`; ntp.js 尾部 favicon 缓存块 (可读 URL 校验 / CDN 竞速 / 双层 TTL 缓存 / storage 持久化) 抽为独立 ES module 并被 ntp.js import。整条模块流水线 (加载链 / build cat 步骤 / Playwright / 双浏览器) 首次全绿。file:// mock 的 CORS 失效被显式处理或记录。

**Blocked by:** 01, 02

**Status:** done (2026-08-31, ticket 03 agent)

- [x] ntp/index.html 使用 `<script type="module">` 且功能无回归 — L390 `<script type="module" src="ntp.js">`; 无回归实证: `npm test` 411 passed (4.2m) + 双浏览器扩展上下文验证 (chromium dist 扩展 chrome-extension:// + firefox dist)
- [x] favicon 模块独立成文件, ntp.js 通过 import 使用, 原有行为不变 — ntp/favicon.js (148 行, L5949-6094 逐字节搬移: FAVICON_SOURCES 4-CDN 竞速 / Promise.any / fastestCDN 会话锁 / 双层 TTL 7d-90d / FAV_MAX_ENTRIES 2000 / localStorage 持久化); ntp.js 头部 `import { loadFavicon } from './favicon.js'`; 调用点 (renderBookmarks L3018) 与 `__boxingDebug.loadFavicon` 钩子原样保留
- [x] file:// mock 的处理方式在 commit message 或 WORKFLOW §6 留痕 — spec 方案 (a) 保留 mock 可运行: 实证 chromium 默认 CORS 封锁 file:// module (origin 'null'), `--allow-file-access-from-files` 解封; firefox 同目录 module 原生放行。playwright 两个配置的 chromium 项目已加 flag; 留痕见 WORKFLOW §6 (票03行) + commit message
- [x] `npm test` + `npm run build` 绿; Chrome 与 Firefox 各手动开一次 NTP 验证 — npm test 411 passed (4.2m, ESM rewiring 后 checkpoint); npm run build DONE_BUILD (dist 双树含 favicon.js + module 标签); 双浏览器 NTP 实开验证: chromium 加载 dist 扩展 (service worker + `__boxingDebug.loadFavicon` Promise.any 在位), firefox dist file:// 打开 0 pageerror; quarantine 车道冒烟 (boxing-debug file:// 全流程) 亦绿

---

## 处置结论 (子窗口 → 大脑, 2026-08-31)

1. **交付物**: ntp/favicon.js (148 行) = ntp.js 尾段 favicon 块 (原 L5949-6094, IIFE `})();` 之后) 逐字节搬移 + `export { loadFavicon }`; ntp.js 头部 `import { loadFavicon } from './favicon.js'`, 6094→5950 行; index.html 切 `<script type="module" src="ntp.js">` (module 自带 defer 语义)。favicon.js 仅依赖浏览器全局 (localStorage/Image/performance/URL), 与主 IIFE 零共享状态 — 与票02 报告结论 7.2 #5 一致。
2. **file:// mock 决议** (spec 首票项): 选方案 (a) 保留。probe 实证: chromium file:// 下 module 默认 CORS 封锁 (origin 'null'), `--allow-file-access-from-files` 解封; firefox 同目录 file:// module 原生放行无需 pref。两个 playwright 配置 (主 + quarantine) 的 chromium 项目均已加 flag, 411 测试的 file:// 车道保活。留痕: commit message 专段 + WORKFLOW §6 (票03两行)。
3. **验证证据**: checkpoint `npm test` 411 passed (4.2m, rewiring 后、build 层改动前); `npm run build` DONE_BUILD (dist 双树含 favicon.js + module 标签; build.mjs 零改动 — copyTree 整树复制天然兼容 ESM); 双浏览器扩展上下文 BOTH-OK (chromium 加载 dist 真扩展经 chrome-extension:// + firefox 打开 dist file://, `loadFavicon`/Promise.any 在位, 0 pageerror); quarantine 车道冒烟 (boxing-debug file:// 全流程) 绿; `node --check` × 2 / `git diff --check` 干净。
4. **版本控制 (§4.2)**: branch `arch-recovery-03-favicon`, commit `kuu`。提交两次被拒 — 本票改动同时依赖 01 (playwright 配置同文件) 与 02 (WORKFLOW.md 行) 的既有提交; 按 GitButler skill 处方 `but move --above` 先把 02 压到 01 之上、再把 03 压到 02 之上, 线性栈 `03→02→01` 后落位 (仅改父级, 未重写历史)。**收口注意: 03 不能与 01/02 并行独立合入, 合入顺序必须 01→02→03。** 未 push。
5. **偏离/勘误** (供首脑复核登记): 无功能偏离。勘误两条: (i) 票02 报告 §5 favicon 桶仅记 1 符号 (probe) 是漏报 — 真块为 IIFE 外尾段 (FAVICON_SOURCES/fastestCDN/getFaviconUrl/raceCDN/isValidPublicUrl/faviconCache/TTL 常量/loadFavicon 等 10 符号), 已写入 WORKFLOW §6; (ii) 用户手工复验时曾见 "清单文件缺失" 报错, 根因是子窗口验证脚本 ROOT 路径少一层 boxing (指向 D:\Aworker\crx\dist), 非产物缺陷, 修正后 BOTH-OK。
6. **工作区遗留 (非本票, 未触碰)**: .scratch 规划文档 (04-10 票/spec/report/README) 与 dev-chrome junction 仍未提交, 属大脑窗口资产; 临时脚本已按协议清理。
