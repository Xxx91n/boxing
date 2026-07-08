# Boxing v3 大规模修复与增强 — 设计规格

> 状态：已确认 | 日期：2026-07-08
> 基于 brainstorming 会话，所有 17 项需求已确认

---

## 1. 架构变更概览

**策略**：方案 2 — 一次性重写 NTP 三个核心文件（html/css/js），集成全部修复与增强。

**文件变更清单**：

| 操作 | 文件 | 说明 |
|------|------|------|
| 重写 | `ntp/index.html` | 新增 settings-modal，移除 pin-bar hero 区域，移除 options 独立页面引用 |
| 重写 | `ntp/ntp.css` | 全量重写：modal 样式、resize handle、zoom 控件、边缘 clamp、拖拽修正 |
| 重写 | `ntp/ntp.js` | 全量重写：17 项修复/增强集成，自定义 i18n store，手动书签输入 |
| 删除 | `options/options.html` | 不再需要独立设置页 |
| 删除 | `options/options.css` | 同上 |
| 重写 | `options/options.js` | 改为设置数据管理模块（在 ntp.js 中内联） |
| 补充 | `_locales/*/messages.json` | 扩充全部 UI 文案 |
| 更新 | `manifest.json` | 精简 permissions，修复 service_worker |
| 更新 | `.gitignore` | 添加 .codegraph/ 排除 |
| 更新 | `README.md` | 更新为 Boxing v3 |
| 新增 | `.codegraph/` | codegraph index |
| 不变 | `design-system.css` | 保持现有 token 体系 |
| 不变 | `background.js` | 极小 service worker 保留 |
| 不变 | `popup/` | 暂不触及 |

---

## 2. 逐需求详细设计

### (1) 修复设置页白色背景

**当前 bug**：`options/options.html` 头部 `options__head` 使用 `background: var(--color-elevated)` (`#EDE5D8`)，但浏览器默认背景为白色，导致 header 看起来有白色缝隙或不匹配。

**修复**：设置页改为 ntp 内嵌 modal（见(3)），modal 面板用 `var(--color-elevated)`，半透明米色遮罩 `rgba(242,237,229,0.85)`，整体融合 beige 设计。

### (2) 实现 i18n 语言切换

**关键决策**：`chrome.i18n.getMessage()` 无法运行时切换语言（它跟随浏览器 UI 语言）。采用**自定义 i18n store**（方案 B）。

**实现**：
- `ntp.js` 初始化时从 `chrome.storage.sync` 读 `selectedLanguage`，默认 `'en'`
- 通过 `fetch` 加载 `_locales/{language}/messages.json` 到内存 `i18nStore`
- `i18n(key)` 函数从 `i18nStore` 读取对应消息
- `applyI18n()` 遍历所有 `[data-i18n]` 元素，用 i18n store 重新赋值
- 设置 modal 内语言下拉切换 → 写 `selectedLanguage` → `reloadI18n()` → 重渲染

**i18n store 结构**：
```js
let i18nStore = {};  // { "brandName": "Boxing", "emptyCanvasTitle": "No large boxes yet", ... }
let currentLang = 'en';
```

### (3) 设置改为同页弹窗

**移除 `options/` 目录**，设置功能全部进入 NTP 主页面。

**`ntp/index.html` 新增元素**：
```html
<div id="settings-modal" class="modal-overlay" hidden>
  <div class="modal" role="dialog" aria-label="Settings">
    <div class="modal__head">
      <h2 class="modal__title">Settings</h2>
      <button class="modal__close btn btn--ghost" aria-label="Close">×</button>
    </div>
    <div class="modal__body">
      <!-- Language -->
      <section class="modal__section">
        <label class="modal__label">Language</label>
        <select id="lang-select">
          <option value="en">English</option>
          <option value="zh_CN">中文</option>
          <option value="ja">日本語</option>
        </select>
      </section>
      <!-- Remember last position -->
      <section class="modal__section">
        <label class="checkbox-label">
          <input type="checkbox" id="remember-last-pos" checked>
          <span>Remember last position</span>
        </label>
        <p class="modal__hint">Automatically reopen the last visited large box on new tabs</p>
      </section>
      <!-- Others -->
      ...
    </div>
  </div>
</div>
```

**打开/关闭**：`settingsBtn` 点击 → `toggleModal()`；`modal__close` / `backdrop click` / `Escape` 键关闭。

### (4) 修复主页显示 bug

**四个子 bug**：

| Bug | 根因 | 修复 |
|-----|------|------|
| null 大盒子 | `layout` 初始值为 `{ version: 2, boxes: [] }`，但 `storage.sync.get` 未返回预期值时 boxes 可能为 undefined → `layout.boxes.length` 抛错 | storage 加载后强制 `layout.boxes = layout.boxes || []` |
| 加号无反应 | 加号绑定到全角 `＋`（U+FF0B）而非半角 `+`（U+002B），且事件监听已绑定但可能因为 Firefox storage API 未返回导致逻辑短路 | 改加号按钮 html 用半角 `+`；storage 加载失败时保留默认初始 layout |
| 大盒子默认展开问题 | `renderCanvas()` 渲染了所有 body（含 chips），用户不希望如此 | 移除 body 渲染；大盒子仅显示 bar（320x220 body 显示占位提示） |
| 多余书签行（固定/📁） | `renderPinBar()` 从 `bookmarksTree` 渲染根文件夹 | 移除 pin-bar 整行，移除 `loadBookmarks()` 中的 `renderPinBar()` 调用 |

### (5) 双键点击创建盒子

**实现**：`dblclick` 事件监听在 `canvasEl` 和 `innerSurface` 上。判断逻辑：

```js
canvasEl.addEventListener('dblclick', (e) => {
  // 如果点在大盒子区域内 → 进入大盒子（不创建）
  const targetBox = e.target.closest('.large-box');
  if (targetBox) {
    enterLargeBox(targetBox.dataset.id);
    return;
  }
  // 否则在 canvas 空白区域 → 创建新大盒子
  addLargeBoxAt(e.clientX, e.clientY);
});
```

inner surface 的逻辑类似：空白处 dblclick → 创建小盒子。

### (6) 改名字区域禁止拖拽和点击进入

**实现**：contentEditable 标题栏在 mousedown 事件中阻止冒泡，防止被 bar 的 dragstart 捕获。

```js
title.addEventListener('mousedown', (e) => {
  e.stopPropagation();  // 阻止被 bar 的 draggable 捕获
});
// 标题栏 CSS：pointer-events 控制
.large-box__title { cursor: text; }
.large-box__title[contenteditable="true"]:focus { pointer-events: auto; }
```

标题栏的 click 事件不再触发 `enterLargeBox()`。

### (7) 拖拽起点修复

**当前 bug**：`onDragStart` 用 `el.getBoundingClientRect()`（视口坐标）计算起点，但 ghost 位置和实际位置不符。

**修复**：
```js
function onDragStart(e, type, id) {
  const el = e.target.closest(...);
  // 用 CSS 属性的绝对位置（相对于 canvas/inner surface）
  dragState.origX = parseInt(el.style.left, 10) || 0;
  dragState.origY = parseInt(el.style.top, 10) || 0;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  // ghost 位置 = canvas surface 的 getBoundingClientRect 起点 + origX/Y
}
```

### (8) 盒子边缘处理

**实现**：拖拽结束时的 clamp 逻辑：

```js
function clampToContainer(x, y, w, h, containerW, containerH) {
  return {
    x: Math.max(0, Math.min(x, containerW - w)),
    y: Math.max(0, Math.min(y, containerH - h))
  };
}
```

`onDragEnd` 中：大盒子 clamp 到 `canvasSurface` 尺寸，小盒子 clamp 到 `innerSurface` 尺寸。canvas 尺寸动态扩展（不设上限）。

---

### (9) 右下角缩放控件

**实现**：canvas 和 innerSurface 右下角各放一个 zoom 控件：

```html
<div class="zoom-controls">
  <button class="zoom-btn" data-zoom="out">◇</button>
  <span class="zoom-value">100%</span>
  <button class="zoom-btn" data-zoom="in">◇</button>
</div>
```

缩放通过 CSS `transform: scale()` 应用在 `.canvas__surface` / `.inner__surface` 上。缩放级别：50%, 75%, 90%, 100%, 125%, 150%。存储在 `settings.zoomLevel`。

### (10) 盒子大小可拖拽调整

**实现**：每个盒子的右下角加 resize handle（8×8 dot icon），监听 mousedown 进入 resize 模式：

```css
.box-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
  background: var(--color-muted);
  border-radius: 0 0 var(--radius-card) 0;
  opacity: 0.4;
}
```

拉拽时改变 `el.style.width` / `el.style.height`（snap 到 5px grid），最小宽高保护：large ≥ 200×120, small ≥ 120×80。

### (11) 设置中「保留上次位置」选项

**实现**：settings modal 中 `remember-last-pos` checkmark。默认 `true`。

- 如果 `true`：`init()` 结束后自动进入 `lastLargeBoxId`（从 storage 中读取）
- 如果 `false`：始终停留在 canvas 视图
- 每次 `enterLargeBox()` 时写入 `lastLargeBoxId`
- `exitToCanvas()` 时写入 `null`

### (12) 大盒子序号命名

**实现**：`layout.nextLargeIndex` 计数器。新建大盒子时：

```js
const index = layout.nextLargeIndex || (layout.boxes.length + 1);
layout.nextLargeIndex = index + 1;
const title = i18n('newLargeBoxNumbered', [index]);
// → "大盒子 1" / "Large box 1" / "大ボックス 1"
```

小盒子同理：每个 large box 内独立 `nextSmallIndex`。

### (13) 小盒子尺寸增大

```js
// 旧：
const SMALL_W = 200, SMALL_H = 140;
// 新：
const SMALL_W = 280, SMALL_H = 220;
```

CSS `.small-box` 同步更新 width/height。列表模式更多行数，grid 模式 3 列（考虑 280px 宽度）。

### (14) 全套语言 i18n 同步

所有 UI 文案必须通过 i18n store 渲染。扩充 `_locales/{en,zh_CN,ja}/messages.json` 覆盖：

| Key | EN | ZH | JA |
|-----|-----|-----|-----|
| `settingsTitle` | Settings | 设置 | 設定 |
| `settingsLanguage` | Language | 语言 | 言語 |
| `rememberLastPos` | Remember last position | 保留上次位置 | 最後の位置を記憶 |
| `rememberLastPosHint` | Reopen last large box on new tabs | 新标签页自动打开上次的大盒子 | 新しいタブで最後の大ボックスを開く |
| `newLargeBoxNumbered` | Large box $1$ | 大盒子 $1$ | 大ボックス $1$ |
| `newSmallBoxNumbered` | Small box $1$ | 小盒子 $1$ | 小ボックス $1$ |
| `dblclickHint` | Double-click to add box | 双击添加盒子 | ダブルクリックでボックス追加 |
| `addBookmark` | Add bookmark | 添加书签 | ブックマーク追加 |
| `zoomLabel` | Zoom | 缩放 | ズーム |
| `resizeHint` | Drag corner to resize | 拖拽右下角调整大小 | 角をドラッグしてサイズ変更 |
| `maxBoxesReached` | Maximum 1000 boxes | 最多 1000 个盒子 | 最大 1000 ボックス |
| `emptyBodyHint` | Double-click to add small boxes | 双击添加小盒子 | ダブルクリックで小ボックス追加 |
| ... | 完整覆盖所有 UI 文字 | | |

### (15) codegraph index + .gitignore + README 更新

- `codegraph init` 在 `D:\Aworker\crx\boxing` 目录生成 `.codegraph/` 索引
- `.gitignore` 添加 `.codegraph/` 行排除索引
- `README.md` 改为 Boxing v3 版（更新项目描述、结构说明、双层级架构）

### (16) git push 到远程仓库

```bash
git add -A
git commit -m "feat: Boxing v3 — full redesign with 17 fixes and enhancements"
git push origin master
```

### (17) Playwright 实时调试开发

开发流程：
1. 加载扩展到 Playwright Chromium（通过 `chrome-devtools` MCP 或 Playwright test）
2. 打开新标签页（`chrome://newtab`）
3. 截图验证 UI 渲染
4. 修改代码 → 重载扩展 → 再截图
5. 循环直到所有 17 项通过

---

## 3. 数据结构设计

### layout (chrome.storage.sync → boxingLayout)

```ts
{
  version: 3,                    // v2 → v3
  boxes: LargeBox[],
  nextLargeIndex: number,        // 大盒子序号计数器
  lastLargeBoxId: string | null, // 上次所在大盒子
  settings: {
    selectedLanguage: string,    // 'en' | 'zh_CN' | 'ja'
    rememberLastPos: boolean,    // default true
    zoomLevel: number,           // 1.0 = 100%
    darkMode: boolean,           // reserved, disabled
    fontSize: number             // 14 (not actively used)
  }
}
```

### LargeBox

```ts
{
  id: string,            // 'large-' + Date.now()
  title: string,         // '大盒子 1' etc
  x: number, y: number,
  width: number,          // default 320 (resizable)
  height: number,         // default 220 (resizable)
  nextSmallIndex: number, // 小盒子序号计数器
  children: SmallBox[]
}
```

### SmallBox

```ts
{
  id: string,            // 'small-' + Date.now()
  title: string,         // '小盒子 1' etc
  x: number, y: number,
  width: number,          // default 280 (resizable)
  height: number,         // default 220 (resizable)
  pinned: boolean,        // default true (always expanded)
  displayMode: 'list' | 'grid',
  bookmarks: Bookmark[]
}
```

### Bookmark

```ts
{
  id: string,            // 'bm-' + Date.now()
  title: string,         // user-entered title
  url: string            // user-entered URL
}
```

---

## 4. 存储迁移策略

v2→v3 «迁移»：`loadLayout()` 检测 `layout.version !== 3`，执行迁移：

```js
function migrateV2toV3(old) {
  return {
    version: 3,
    boxes: (old.boxes || []).map(b => ({
      ...b,
      width: b.width || LARGE_W,
      height: b.height || LARGE_H,
      nextSmallIndex: (b.children?.length || 0) + 1,
      children: (b.children || []).map(s => ({
        ...s,
        width: s.width || SMALL_W,
        height: s.height || SMALL_H,
        pinned: s.pinned !== false,  // default true in v3
        bookmarks: s.bookmarks || []
      }))
    })),
    nextLargeIndex: (old.boxes?.length || 0) + 1,
    lastLargeBoxId: null,
    settings: {
      selectedLanguage: 'en',
      rememberLastPos: true,
      zoomLevel: 1.0,
      darkMode: false,
      fontSize: 14
    }
  };
}
```

---

## 5. CSS 设计系统一致性

**保持 beige token 体系不变**（`design-system.css`）：
- `--color-canvas: #F4EFE5`
- `--color-surface: #F0EBE0`
- `--color-elevated: #EDE5D8`
- `--color-ink: #2D2822`
- `--color-muted: #8B8278`
- `--color-accent: #B05D3C`
- 所有间距/圆角/阴影 token 不变

**新增 token**（在 ntp.css 中定义）：
- `--color-modal-backdrop: rgba(240, 235, 224, 0.85)`

---

## 6. 边界条件与限制

| 约束 | 值 |
|------|-----|
| 最大大盒子数 | 1000 |
| 每个大盒子最大小盒子数 | 500 |
| 最大书签/小盒子 | 50 |
| 最小盒子宽度（大） | 200px |
| 最小盒子高度（大） | 120px |
| 最小盒子宽度（小） | 140px |
| 最小盒子高度（小） | 100px |
| 缩放范围 | 50% – 150% |
| Resize snap grid | 5px |
| Canvas snap grid | 24px |
| Inner snap grid | 16px |

---

## 7. 测试验证清单

| # | 验证项 | 方法 |
|---|--------|------|
| 1 | 设置 modal 无白色背景 | Playwright 截图，视觉对比 |
| 2 | 语言切换后 i18n 动态刷新 | 切换下拉 → 截图验证中文/日文 |
| 3 | 设置 modal 弹窗/dismiss | 点击齿轮→弹窗出现 → 点击 X 关闭 |
| 4 | 主页无 null 大盒子 | storage 初始化后无 console 错误 |
| 5 | 加号 + 能创建大盒子 | 点击 + → 新大盒子出现在 canvas |
| 6 | dblclick 创建盒子 | canvas 空白双击 → 大盒子出现 |
| 7 | 标题栏不触发拖拽 | 点击标题 → 进入编辑模式，不拖动 |
| 8 | 拖拽起点正确 | 拖拽盒子 → 鼠标在 bar 上，盒子不离原点 |
| 9 | 拖拽不超出边缘 | 拖到左上角 → clamp 到 (0,0) |
| 10 | 缩放控件功能 | 点击 zoom in → canvas scale 变化 |
| 11 | resize handle | 拖右下角 → 盒子变大 |
| 12 | 保留上次位置 | 进入大盒子 → 刷新 → 仍在该大盒子 |
| 13 | 大盒子序号命名 | 新建 → 显示"大盒子 1"、"大盒子 2" |
| 14 | 小盒子尺寸 | 视觉确认 280×220 |
| 15 | 三语言完整 | 切换语言后全页无英文残留 |
| 16 | codegraph 索引 | `.codegraph/` 存在 |
| 17 | README 更新 | 描述 Boxing v3 |