<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · **简体中文** · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

层级化无限画布书签管理器,米白极简设计。

Boxing 将浏览器新标签页变为可视化书签工作区。不再是扁平文件夹,而是在无限画布上用标签盒子组织书签 — 拖拽、连接、嵌套,按你的思维空间排列。可以理解为 Obsidian 画布遇见书签管理。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing 画布总览" width="1280">
</picture>

## 目录

- [功能](#功能)
- [截图](#截图)
- [品牌资产](#品牌资产)
- [安装](#安装)
- [使用](#使用)
- [隐私](#隐私)
- [开发](#开发)
- [贡献](#贡献)
- [许可证](#许可证)

## 功能

**无限画布** — 自由平移和缩放(Ctrl+滚轮)。在单个画布上创建无限盒子。用连线表示盒子间的关系。设置父子关系 — 移动父盒子时子盒子跟随移动。

**两级层级** — 大盒子包含小盒子,小盒子包含书签。点击盒子进入其子画布。面包屑导航显示路径。可任意深度嵌套。

**书签管理** — 每个盒子有自己的书签集合,支持列表和网格视图。添加、编辑、删除,操作简洁。可在当前标签页或新标签页打开(可配置)。拖拽排序。

**连线** — 盒子间的可视化 SVG 连线。Alt+点击连线删除(可配置:单击或双击)。父子移动传播,带弹性边界约束。

**设计与主题** — 米白/奶油色极简美学。深色模式,自动跟随系统。可调字号和缩放。方角/圆角切换。

**14 种语言** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi,自动检测浏览器语言。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="盒子层级与书签" width="1280">
</picture>

## 截图

| 画布 | 盒子与书签 | 连线 |
|---|---|---|
| ![画布](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![盒子与书签](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![连线](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| 设置 | 书签编辑 |
|---|---|
| ![设置](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![书签编辑](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## 品牌资产

浅色/深色 logo、扩展图标、favicon、商店图块与变体展示均收录于 [`docs/brand/`](../../docs/brand/)（24 个文件，来自 `box_png` 资产套件），可直接复用于商店 listing、文档与 GitHub 社交预览图。

## 安装

> [!IMPORTANT]
> **请通过官方商店页面安装**（推荐）。权威安装步骤与当前已发布的商店版本维护在 [英文 README — Install](../../README.md#install) 与 [发行状态页](../../docs/release-status.md)。
> GitHub Releases 仅作为**面向用户的更新日志**：[最新版本](https://github.com/Xxx91n/boxing/releases/latest).

### Firefox（正式安装）

1. 打开 [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/)
2. 点击 **Add to Firefox**，按浏览器提示完成安装

### Edge / Chromium（正式安装）

1. 打开 [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. 点击 **Get** / **获取** 完成安装（Chromium 系请使用 Edge 商店页面）

### 开发者：从源码构建

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge：`chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选 `dist/boxing-chrome/`
- Firefox：`about:debugging#/runtime/this-firefox` → **临时载入附加组件** → 选 `dist/boxing-firefox/manifest.json`

> [!NOTE]
> 构建产物 zip 供**商店上传或本地调试**，不是用户正式安装渠道。正式安装请走上方商店链接。
> 签名由商店完成；本仓 GitHub Release **不再**分发 `.xpi` / `.crx`。

## 使用

- **双击**空白画布 → 创建新盒子
- **拖拽**盒子标题栏 → 移动盒子
- **Ctrl+滚轮** → 缩放画布(30% 到 200%)
- **拖拽**空白画布 → 平移
- **右键** → 返回父级画布
- **点击**盒子 → 进入子画布
- 从盒子边缘中点 **拖拽** → 连接到另一个盒子
- **Alt+点击**连线 → 删除连线
- 盒子上的 **星标** → 标记为父盒子(子盒子跟随移动)
- **图钉** → 锁定盒子位置
- 画布右上角 **圆圈按钮** → 取消固定进入全屏模式

## 隐私

- 所有数据本地存储在 `chrome.storage.local` — 除非你配置了可选的云备份,否则不会离开你的设备
- 可选的 WebDAV / GitHub Gist 备份是唯一的出站网络访问
- 无分析、无追踪、无第三方服务
- 100% 开源(Apache-2.0)— 可审计每一行代码
- 完整隐私政策: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## 开发

### 前置条件

- Node.js >= 18
- npm

### 设置

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### 构建

```bash
npm run build     # 开发构建 → dist/boxing-chrome + dist/boxing-firefox
npm test          # Playwright 测试 (Chrome + Firefox)
```

详见 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解完整开发指南。

## 贡献

欢迎贡献! 详见 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解环境配置、工作流和代码风格。

## 许可证

Apache-2.0 — 见 [LICENSE](../../LICENSE)
