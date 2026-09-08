# Ticket 36 Report — English Store Screenshot Capture

- 日期: 2026-09-08 (本地 2026-09-09 凌晨提交)
- 子窗口: Ticket 36 实施窗
- 分支: `ticket-36-store-screenshots`,提交 `zkx` (GitButler,未 push — 遵循 WORKFLOW §4.2)
- 权威验收来源: `.scratch/architecture-recovery/issues/36-english-store-screenshot-capture.md` + handoff 所指 spec 完成定义

## 结论

五张英文 1280x800 商店截图已由持久化 Playwright 命令从真实扩展 UI 重新截取并替换已跟踪
PNG;像素与语义双重验证通过;截图脚本提交至测试工具;本票闭环待大脑/人工复核。

## 验收项逐条证据

### 1. A persisted Playwright capture command creates all five screenshots in the documented filenames

- 命令: `node test/tests/take-store-screenshots.mjs` (已提交于 `test/tests/take-store-screenshots.mjs`, sha256 前16位 `90971eb752cd0711`)
- 运行输出 (两次运行均成功, 末次为打磨重截):
  ```
  state before shot 1: {"boxes":3,...,"lang":"en","fontSize":14}
  Screenshot 1 (canvas): captured
  Screenshot 2 (boxes): captured, small boxes visible = 2
  Screenshot 3 (connections): captured, lines = 2
  Screenshot 4 (settings): captured (appearance tab)
  Screenshot 5 (bookmarks): captured, edit popup open
  All 5 screenshots captured to D:\Aworker\crx\boxing\docs\store-assets\screenshots
  ```
- 输出文件名与 `docs/store-assets/screenshots/README.md` 规定逐一对应:
  screenshot-1-canvas / 2-boxes / 3-connections / 4-settings / 5-bookmarks (.png)

### 2. Each capture is approximately 1280x800 and has nonblank pixels

自写 PNG 解码器 (zlib inflate + 还原滤波) 全像素统计, 五图全部 PASS:

| 文件 | 尺寸 | 色型 | 唯一色数 | 主色占比 | 判定 |
|---|---|---|---|---|---|
| screenshot-1-canvas.png | 1280x800 | RGB8 | 914 | 56.71% | PASS |
| screenshot-2-boxes.png | 1280x800 | RGB8 | 838 | 60.25% | PASS |
| screenshot-3-connections.png | 1280x800 | RGB8 | 980 | 56.63% | PASS |
| screenshot-4-settings.png | 1280x800 | RGB8 | 787 | 91.15% | PASS |
| screenshot-5-bookmarks.png | 1280x800 | RGB8 | 1197 | 56.05% | PASS |

非空白判据: 唯一色数 > 100 且主色占比 < 99.5%。全部满足 (设置弹窗图主色占比高属
正常 — 大面积米色弹窗底色, 但 787 个唯一色证明内容丰富非空白)。
mtimes 证实为本次新截 (2026-09-08T16:34:5xZ)。

sha256 前16位存档:
- e62c8ef9db9fcccf screenshot-1-canvas.png
- 87c4eb9e5a1f0610 screenshot-2-boxes.png
- dadba759e96e99c8 screenshot-3-connections.png
- 37deea7c05ae6d77 screenshot-4-settings.png
- 816ab91840eb1d47 screenshot-5-bookmarks.png

### 3. Canvas, boxes, connections, settings, and bookmark editing screenshots correspond to their labels

逐张人工目视 (Read 工具读图) 复核:

1. **canvas**: 主画布, 三个大盒子 (Projects / Research / Reading), 顶栏搜索框 +
   "3 large boxes" 计数, 底部快捷键提示 — 与 "Main canvas view — several boxes" 相符。
2. **boxes**: Research 盒详情 (面包屑 "Research"), Papers 小盒含 Rendering
   Performance / Canvas Handbook 两条书签, Notes 小盒含 Architecture Notes, 列表视图
   — 与 "Box detail — bookmarks in list view" 相符。
3. **connections**: 画布上 Projects—Research—Reading 之间两条真实 SVG 连线
   (dbg.connCount()=2 DOM 断言) — 与 "Connection lines — boxes linked" 相符。
4. **settings**: 设置弹窗 Appearance 标签, Color Theme 五色板 / FONT SIZE 滑杆(14px) /
   ZOOM 滑杆(100%) / Dark Mode / Square Corners — 与 "theme, font, zoom options" 相符。
5. **bookmarks**: 预填书签编辑对话框 (标题 "Rendering Performance" + URL
   "https://web.dev/explore/rendering-perfor…" + Save/Delete/Cancel 按钮) — 与
   "Bookmark editing — add/edit dialog" 相符。

首轮截图曾发现三处美观瑕疵 (Reading 标题截断 / Papers 小盒被内层头裁切 / Notes 与
Papers 重叠遮住第二条书签), 修种子坐标后重截并复验通过 — 体现 "correspond to labels"
不以首捕为准, 以终版图为准。

### 4. The capture command is committed to the test tooling and does not depend on manually pasted images

- 脚本位于测试目录 `test/tests/take-store-screenshots.mjs`, 以 ESM 提交 (node --check 通过)。
- 依赖链: `playwright` (repo devDependency) + `dist/boxing-chrome` (built dist) —
  运行时通过 `--load-extension` 加载扩展, chrome://newtab 打开真实 NTP。
- 内容来源全部为运行中的扩展 DOM 种子 (`window.__boxingDebug` 门面 + 真实 UI 点击),
  无任何手工贴图/占位图路径。首捕与重捕均由该命令独立完成, 可复现。
- dist 时效: dist/boxing-chrome/manifest.json mtime 2026-09-07 晚于全部 ntp/ 源文件
  (版本 2026.8.21 与源一致) — 本机零构建, 符合 CI-only 构建政策。

### 5. English UI language is used for capture

- 脚本在种子阶段写入 `layout.settings.selectedLanguage = 'en'` 并 saveLayout + reload,
  使 persist.loadSettings() 用英文启动 i18n store。
- 运行时断言: 截图前 `__boxingDebug.state()` 返回 `"lang":"en"` (运行日志可见)。
- 视觉证据: 五图所有可见文案均为英文 (Search bookmarks… / Add small boxes / Settings /
  Color Theme / Save / Delete / Cancel / footer 快捷键提示等)。

## 版本控制 (WORKFLOW §4.2)

- `but diff` 认领本票 6 个 change id (5 PNG + 1 脚本) →
  `but commit -b ticket-36-store-screenshots -m "feat(store-assets): ticket 36 - recapture
  five English store screenshots via Playwright (1280x800)" ws ynw kzz yzp ur qp`
  → 提交 `zkx`。
- 打磨重截后: `but amend -t ticket-36-store-screenshots ws ynw kzz ur qp` (screenshot-4
  字节未变自动无 diff) → zkx 更新为终版内容。
- 未 push, 未开 PR; 其他窗口的未提交改动 (.scratch round7 工件 / dev-chrome / dev-firefox)
  未卷入本票提交。

## 票内边界声明

- 只动了 `docs/store-assets/screenshots/*.png` (5) 与 `test/tests/take-store-screenshots.mjs` (1)。
- 未改扩展运行时代码; 未动其他票文件; 本报告是票完成后唯一新增的 .scratch 产物。

## 残余与移交

- screenshot-4-settings.png 主色占比 91.15% (米色底), 商店侧如嫌底色占比高, 可后续在
  Appearance 标签内把 Dark Mode 勾选态或主题选中态做进画面进一步增加对比 — 非验收必需。
- 票 37 (README release/install claims) 依赖本票: 截图证据已就绪, 可开工。
- 本报告按 handoff 要求于改动完成后写入; 未 push。
