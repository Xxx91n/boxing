# Report — 04 Sync 页视觉分组 (T-39 / 04-sync-ui)

**票**: fix(sync-ui): visually separate shared settings from WebDAV/GitHub configs
**GitHub**: https://github.com/Xxx91n/boxing/issues/4
**Milestone**: 2026.9.12
**状态**: 实施完成, 待 CI 验证 (CI-only 政策)
**版本控制**: 遵循 WORKFLOW §4.2

## 变更摘要

把 Sync & Backup 单页扁平混排的 8 个 `modal__section` 重组为三张带标题的卡片,
逻辑零改动 (sync-engine.js 互斥不动), 纯 presentation 分组:

- **ntp/index.html** (`#tab-sync` 内 `#remote-backup-zone`):
  - 新增 **Shared** 卡片 (`<div class="sync-group">`) 收拢 4 个 provider-agnostic 字段
    (Sync Level / File Name / Auto-Backup / Sync Now) + 标题 `<h4 data-i18n="syncGroupShared">`.
  - **WebDAV** 配置由 `<section class="modal__section" id="webdav-config">` 改为
    `<div class="sync-group sync-group--provider" id="webdav-config" hidden>`, 内置标题
    `<h4 data-i18n="syncWebDAV">`; `id` 保留在 sync-engine.js 切换的同一元素上, 标题随
    `hidden` 一同显隐 (无需新 JS 绑定).
  - **GitHub Gist** 配置同理 (`id="gist-config"`, 标题 `syncGitHubGist`).
  - 字段 ID / `data-i18n` 全保留; provider 互斥仍由 sync-engine.js:55-59 的 `.hidden` 切换驱动.
- **ntp/settings.css**: 替换旧 BX-DEV-133 sibling-margin 规则为 `.sync-group` 卡片样式块:
  `display:flex` + 卡片 padding/border/radius, **`.sync-group[hidden]{display:none}`** (BX-DEV-020
  hidden pair — 没有它 `display:flex` 会盖过 `hidden` 属性, provider 互斥会视觉泄漏双显),
  `.sync-group__title` (大写小标题 + 分隔线), `.sync-group .btn{margin:0}` (镜像 `.modal__section .btn`).
  这些选择器是 settings-panel-only, 不触 `.large-box`/`.small-box`, 不受 BX-CSS-DUAL-WRITE 约束.
- **ntp/i18n.js**: 新增 `I18N_FALLBACK.syncGroupShared = 'Shared settings'` (file:// 测试车道 fallback).
- **_locales/<14>/messages.json**: 新增 `syncGroupShared` 键, 14 locale 全部翻译 + JSON.parse 校验通过 (A7 14-locale 对等 OK).
- **test/tests/boxing-sync-ui-grouping.spec.ts** (新增): 5 个 Playwright 断言覆盖 3 条验收项.

## 验收对照 (issues/04-sync-ui.md)

- [x] **Shared vs WebDAV vs Gist visually grouped in Sync & Backup tab**
  → 三张 `.sync-group` 卡片 + 三处 `.sync-group__title` 标题; spec `toHaveCount(3)` 断言.
- [x] **Switching provider never shows both configs (Playwright assert)**
  → spec "Switching provider never shows both" 循环 7 次切换断言 `webdavVisible && gistVisible === false`;
  并由 `.sync-group[hidden]` CSS pair 兜底视觉互斥 (display:flex 不再盖过 hidden).
- [x] **Local provider still hides remote-backup-zone**
  → sync-engine.js `remoteBackupZone.hidden = (p!=='webdav' && p!=='gist')` 不变;
  `#remote-backup-zone` 保持 block (未加 display:flex), `hidden` 原生生效;
  spec "Local provider hides the remote-backup-zone entirely" 断言 zone + 两 provider 卡均 hidden.

## 测试结果 (CI-only 政策: 本机零测试复跑)

- `node --check ntp/i18n.js` → **SYNTAX OK**
- `node --check ntp/sync-engine.js` → **SYNTAX OK** (未改, sanity)
- `git diff --check` → **CLEAN** (无 CRLF/空白污染; 仓库 LF 源)
- 14 locale `messages.json` `JSON.parse` → **全部合法**, `syncGroupShared` 14/14 对等
- index.html 结构: `divBalance` (开 `<div` 数 === 闭 `</div>` 数) **PASS**; 无 `</div>>`
- Playwright spec: 已照 boxing-webdav.spec.ts 的已验证 file:// 模式编写 (bootWithMockRuntime + resetBoxing 原样复用).
  **本地未执行** (CI-only 用户指令 2026-09-04 + 票29/31 教训: 零本地复跑); 绿状态以 CI run 为准, 由大脑 Agent 派发 CI 验证分支.

## 残留风险

1. **CI 验证待派发**: 新 spec 的 5 条断言未在本机执行; 推断依据 = 复用 boxing-webdav.spec.ts 同款 mock + reset 模式 + 互斥逻辑是纯 DOM `hidden` 切换 (sync-engine.js:55-59, 该模式被既有 boxing-webdav 测试每日验证). 若 CI 红则返修启动器重开窗口.
2. **i18n 翻译质量**: `syncGroupShared` 的 14 locale 翻译为标准译法 (ja 共通設定, ko 공유 설정, de Gemeinsame Einstellungen, ru Общие настройки 等); 非机器批量, 可由母语复核微调.
3. **`syncGroupShared` 是新增运行时键** (非 manifest 键); 不触发 T-38 store i18n 的 `__MSG_` 通路, 与该票正交.
4. **视觉间距**: provider 卡片字段间距从 `.modal__section` 的 `gap:space-2` 变为 `.sync-group` 的 `gap:space-3` (略增呼吸感), 主观可接受; 如需收窄可调 `.sync-group` gap.
5. **未触 T-40 scroll**: backdrop-filter / scrollOwners 死断言属 T-40, 本票不动; `.settings-content` 滚动规则保留原样.

## 教训 (写回 WORKFLOW §6)

- **div 深度扫描正则须含闭合 `>`**: 用 `/<\\/?div\\b[^>]*>/g` (带尾 `>`), 否则 `re.lastIndex` 落在 `</div` 的 `>` 之前, `slice(endIdx)` 会把原闭合 `>` 再拼回, 产生 `</div>>` 畸形. 首轮我用 `[^>]*` (无尾 `>`) 写入后 `</div>>`, 被写后重读 (windows_file_integrity_protocol 强制的 "成功写入≠完整性") 抓到; 修复 = 逐字替换 `</div>>`→`</div>` + `divBalance` 整文件配对断言兜底. 教训名: **BX-EXPLORE-DIVSCAN** — 写后必重读接合处, 正则匹配标签须含尾 `>`.

## 范围声明

仅改本票 5 类文件 (ntp/index.html, ntp/settings.css, ntp/i18n.js, 14×_locales/messages.json, 新增 spec + 本报告). 其他 diff 文件 (build.yml / README / TRANSLATIONS / docs/i18n/README.* / icons / gen-i18n-readme.js / boxing-state-sync.spec.ts / 01-icons-report.md 等) 属并行窗口 (T-36/T-37/T-38/T-40), 未触碰未认领.
