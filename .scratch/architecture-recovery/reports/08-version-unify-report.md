# 08 version-unify 实施报告 — 2026-09-10

窗口: 子窗口实施代理 (ticket 08, Wave2 frontier)
分支: `ticket-08-version-unify` (stack 于 `01-icons` 之上, 全链含 fix-release-pipeline + 03-store-i18n)
Commit: `ovo` chore(release): unify version strings to 2026.9.12 + fix version_name injection (ticket 08)
状态: code-done, CI-open (build/Playwright 证据走 CI 派发, 2026-09-04 CI-only 政策)

## 一、变更摘要

1. 全部版本字符串 2026.9.9 → 2026.9.12 (manifest version+version_name, package.json,
   package-lock.json 根字段 ×2, README 徽章, AGENTS.md, CHANGELOG 新节)。
2. `build.mjs`: `BOXING_BUILD_VERSION` 现同时覆盖 `version` 与 `version_name` (修复附带 bug)。
3. settings 页脚双保险: `ntp/index.html` 静态值 v3.6.6 → v2026.9.12 +
   `settings-ui.js` bindSettingsUi() 运行时从 `chrome.runtime.getManifest().version_name` 注入。
4. 03 的 `__MSG_` name/description 未回退 (manifest L3/L5 原样); 02 的 Install 文案未回退 (仅动徽章数字)。

## 二、版本字符串前后对照表

| 位置 | 前 | 后 | 证据 |
|---|---|---|---|
| manifest.json L6 version | 2026.9.9 | 2026.9.12 | node JSON.parse 断言 PASS |
| manifest.json L51 version_name | 2026.9.9 | 2026.9.12 | node JSON.parse 断言 PASS |
| manifest.json name/description | `__MSG_extensionName__` / `__MSG_extensionDescription__` | 不变 (03 成果保留) | node 断言 PASS |
| package.json L3 | 2026.9.9 | 2026.9.12 | node 断言 PASS |
| package-lock.json L3+L9 | 2026.9.9 | 2026.9.12 | 与 package.json 同步 (票29 npm ci 教训) |
| README.md L32 徽章 (alt+src ×2) | 2026.9.9 | 2026.9.12 | grep 实证 |
| CHANGELOG.md | 最高节 2026.9.9 | 新增 `[2026.9.12] - 2026-09-12` 节 (Changed/Fixed) | diff L8-28 |
| AGENTS.md L125 | manifest version 2026.9.9 | 2026.9.12 | grep 实证 |
| ntp/index.html L311 页脚 | Boxing v3.6.6 | Boxing v2026.9.12 + 运行时注入 | 见 §四 |

## 三、build.mjs version_name 覆盖证据

`.github/scripts/build.mjs` (原 L64, 现 L64-69):

```js
  if (process.env.BOXING_BUILD_VERSION) {
    m.version = process.env.BOXING_BUILD_VERSION;
    // Ticket 08: calver injection must cover version_name too, otherwise dist ships a
    // stale display version (AMO/Edge surface version_name; source manifest declares it).
    if ("version_name" in m) m.version_name = process.env.BOXING_BUILD_VERSION;
  }
```

`"version_name" in m` 守卫保持契约最小化: 源 manifest 声明 version_name 才注入,
不凭空为不声明它的分支新增字段。消费面核查: `.github/workflows/build.yml:91` 与
`scripts/build-release.js:17` 均以 env 透传, 无需改动。

## 四、页脚修复证据

`ntp/settings-ui.js` bindSettingsUi() 头部新增 (commit `ovo`):

```js
    try {
      const versionEl = document.querySelector('.modal__version');
      const manifest = globalThis.chrome?.runtime?.getManifest?.();
      const ver = manifest?.version_name || manifest?.version;
      if (versionEl && ver) versionEl.textContent = 'Boxing v' + ver;
    } catch { /* keep static fallback */ }
```

- 真扩展上下文 (chrome-extension://) 下页脚 = manifest version_name → 永不再漂移;
  CI 若以 BOXING_BUILD_VERSION 注入 dist, 页脚自动跟随 dist manifest。
- file:// mock 车道无扩展 API → `globalThis.chrome?.` 可选链静默落空, 保留静态
  v2026.9.12 fallback; 只读不写全局, 符合 SEC-01。
- ADR-0016 合规: 纯展示读取, 不经 storage, 不违反 settings-ui 持久化门面约束。

## 五、验收对照 (issues/08-version-unify.md)

| 验收项 | 结果 |
|---|---|
| manifest/package/README badge/CHANGELOG/AGENTS.md/settings footer = 2026.9.12 | ✅ tick |
| build.mjs overrides version_name as well as version | ✅ tick |
| npm run build green; no leftover v3.6.6 footer | ⏳ 页脚半边 ✅ (零 v3.6.6 残留, 历史层除外); build 绿待 CI |

## 六、测试结果 (本机静态验证; CI-only 政策下不跑本机 build/Playwright)

- node 自检断言 22/22 PASS: manifest/package/lock JSON.parse + 字段值 + __MSG_ 保留 +
  页脚静态+注入 + build.mjs 双覆盖正则 + 9 个改动文件 LF-only 字节扫描。
- `node --check`: settings-ui.js / build.mjs / ntp.js 全 exit 0。
- `git diff --check`: clean (无行尾/空白问题)。
- 残留 grep: `2026.9.9` 仅存于 docs/store-assets/store-listings-2026-09.md 与 CHANGELOG/
  docs/history 历史节; `v3.6.6` 代码面 (html/js/ts) 零残留; `test/` 无版本字符串断言耦合
  (开工前 grep modal__version/v3.6.6/2026.9.9/version_name/BOXING_BUILD_VERSION 均零命中)。

## 七、残留风险

1. **CI 门未闭合**: `npm run build` + Playwright 全量绿须由大脑推送本分支触发 workflow
   取证 (与 01/03/04/05/07 的 DONE-CI-OPEN 同型)。build.mjs 改动影响打包路径, CI 必须覆盖。
2. **store-listings-2026-09.md 未刷**: investigation §2 列了"刷新", 但它是 2026.9.9 提交
   周期的历史记录 (zip 名/签名记录), 且 2026.9.12 的 CI artifacts 尚未产出 — 改写会使
   提交指引指向不存在的文件 (票37 "claims 必须对齐现实" 教训)。留给 2026.9.12 实际提交流程
   重写该 runbook, 或主 Agent 裁决。本票未动 (非 delta 路径锚点)。
3. **version 字段格式**: 2026.9.12 为三段, Chrome/Firefox 均合法; AMO 版本不可复用 —
   2026.9.12 未被占用属未联网核实项 (调研依赖标"低", 提交 AMO 前需人工核对)。
4. 版本徽章链接目标 `docs/publishing-guide.md` 未复核内容是否含旧版本号 (grep 无 2026.9.9 命中, 视为干净)。

## 八、教训 (候选 §6 回收)

- GitButler 多栈仓库中, "branch new --anchor <dep>" 只覆盖单栈依赖; 本票实际依赖链跨
  fix-release-pipeline(pws 版本号) + 03-store-i18n(kky __MSG_ 上下文), 且工作区存在多条
  独立栈时 `--above <栈顶分支>` 才满足全部祖先 — 报错提示可能循环指回旧位置, 需读
  `but status` 树形分组自行定位栈顶 (票10 教训的跨栈变体)。
