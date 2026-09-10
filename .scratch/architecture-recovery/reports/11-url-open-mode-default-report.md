# 11 url-open-mode-default 实施报告 — 2026-09-10

窗口: 子窗口实施代理 (ticket 11, Wave4)
分支: `ticket-11-url-open-mode` (独立栈, 与其他 wave4 票并行)
Commit: `qwo` feat(settings): urlOpenMode defaults to sameTab, preserve stored newTab (ticket 11)
状态: code-done, CI-open (Playwright 全量绿走 CI 派发, spec.md Wave4 Testing Decisions: local node --check + report)

## 一、变更摘要 (delta 对照)

1. **默认与缺键 migrate → sameTab**: `ntp/utils.js` defaultLayout.settings.urlOpenMode
   'newTab' → 'sameTab'。migrateLayout 的 settings 展开合并
   (`{ ...defaults.settings, ...raw.settings }`) 因此天然把缺键存量布局迁到 sameTab,
   存量显式值原样胜出 → **保留已存 newTab** 自动成立 (含 v2 布局路径)。
2. **同步全部 fallback**: 三处 `|| 'newTab'` 全部改为 `|| 'sameTab'` —
   `ntp/ntp.js` openBookmarkUrl (原 L623), `ntp/settings-ui.js` syncSettingsDOM (L35)。
   残留 grep 核查: 代码面 `'newTab'` 字面量只剩合法显式选项逻辑 (settings-ui change
   映射 `value === 'sameTab' ? 'sameTab' : 'newTab'`、popups/ntp 的 newTab 分支)。
3. **popups 未设置分支不再走 FF browserSettings**: `ntp/popups.js` renderBookmarks
   点击处理中, 原 "unset → 查 browserSettings.openBookmarksInNewTabs" 的 14 行 legacy
   分支删除, 缺键与 'sameTab' 统一落到当前标签导航 (tabs.update / window.location);
   仅显式 'newTab' 走新标签 (tabs.create / window.open)。async IIFE 因不再有 await
   改回同步 IIFE。
4. **设置 UI**: syncSettingsDOM 缺键 fallback 显示 Current Tab; BX-DEV-120 三处注释
   (ntp.js L307/L619, settings-ui.js L139, popups.js L41) 同步改写为 sameTab 默认语义。
   index.html 未改 (选项静态顺序不违反验收: 面板可见前必经 syncSettingsDOM 同步)。
5. **测试 seam**: `__boxingDebug.openBookmarkUrl` 暴露 (先例: BX-DEV-126 loadFavicon)。

## 二、文件面

| 文件 | 变更 |
|---|---|
| ntp/utils.js | defaultLayout 一行 |
| ntp/ntp.js | fallback + 2 注释 + debug 暴露 |
| ntp/settings-ui.js | fallback + 1 注释 |
| ntp/popups.js | 打开分支重写 (−18/+9 行) |
| test/tests/boxing-settings-persist.spec.ts | Bug3-b/c 更新 + T11-a..d 新增 |

未触碰: 其他票文件 (render.js / favicon.js / index.html / _locales 均零改动)。

## 三、验收对照 (issues/11-url-open-mode-default.md)

| 验收项 | 结果 |
|---|---|
| 空 storage / 新 profile: urlOpenMode 视作 sameTab, 书签点击 → 当前标签导航 | ✅ 代码 ✅ (T11-a 默认值, T11-c 打开路径断言; CI 绿待收) |
| 存量 urlOpenMode:'newTab' 仍为新标签 | ✅ 代码 ✅ (T11-b migrateLayout 保留断言, T11-d 新标签打开路径) |
| 设置 UI 默认显示 Current Tab | ✅ 代码 ✅ (T11-c Bug3-c selectVal=sameTab, 走 applyExternalLayout 真同步路径) |
| 跨 tab onChanged 后不回退成 newTab | ✅ 代码 ✅ (Bug3-c: 双侧缺键 remote apply 后 select 仍 sameTab) |
| Playwright 默认值 + 打开路径断言; 涉及文件 node --check 绿 | ✅ node --check 4/4; ⏳ Playwright 绿待 CI |

## 四、本机验证 (CI-only 政策: 不跑本机 build/Playwright)

- `node --check`: utils.js / ntp.js / settings-ui.js / popups.js 全 exit 0。
- `git diff --check`: clean (LF-only, 无空白问题)。
- migrateLayout/defaultLayout 纯函数 sandbox 断言 6/6 PASS: 默认=sameTab, null/缺键→sameTab,
  显式 newTab (v3/v2 路径) 保留, 显式 sameTab 保留。
- codegraph sync 完成 (Modified 7)。
- 打开路径测试设计: T11-c 以 hash 片段导航 (无网络依赖, 当前页 URL 可断言); T11-d 以
  window.open spy (file:// 车道无 chrome.tabs, 与既有 spec 同型)。

## 五、残留风险

1. **CI 门未闭合**: 全量 Playwright (含 T11-a..d + Bug3 改造) 需大脑推送本分支触发
   workflow 取证 (与 01-08 的 code-done CI-open 同型)。
2. **存量用户的"隐式 newTab"**: 旧版本 defaultLayout 会把 'newTab' 写进用户 settings 并
   持久化, 升级后 migrateLayout 视作显式偏好保留 — 与票面 "保留已存 newTab" 一致, 但部分
   从未主动设置过的用户升级后仍是新标签 (需手动切一次 Current Tab)。产品侧已裁决
   (spec Wave4 "保留已存 newTab"), 无迁移启发式。
3. popups.js 中 FF browserSettings 分支移除后, `typeof browser` 引用在本文件消失 —
   若有 lint 规则假设该全局可用, 无影响 (只读删除)。

## 六、版本控制

遵循 WORKFLOW §4.2。
