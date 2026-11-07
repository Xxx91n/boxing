<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · **繁體中文** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

階層化無限畫布書籤管理器，米白極簡設計。

Boxing 將瀏覽器新分頁轉變為視覺化書籤工作區。不再是扁平資料夾，而是在無限畫布上用標籤盒子組織書籤 — 拖曳、連接、嵌套，按你的思維空間排列。可以理解為 Obsidian 的書籤管理畫布。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing 畫布總覽" width="1280">
</picture>

## 目錄

- [功能](#功能)
- [截圖](#截圖)
- [安裝](#安裝)
- [使用](#使用)
- [隱私](#隱私)
- [開發](#開發)
- [貢獻](#貢獻)
- [授權條款](#授權條款)

## 功能

**無限畫布** : 自由平移與縮放（Ctrl+滾輪）。在單個畫布上建立無限盒子。用連線表示盒子間的關係。設定父子關係 — 移動父盒子時子盒子隨之移動。

**兩級階層** : 大盒子包含小盒子，小盒子包含書籤。點擊盒子進入其子畫布。階層路徑導覽（麵包屑）顯示路徑。可任意深度嵌套。

**書籤管理** : 每個盒子擁有自己的書籤集合，支援清單與網格檢視。新增、編輯、刪除，操作簡潔。可在目前分頁或新分頁開啟（可自訂）。拖曳排序。

**連線** : 盒子間的視覺化 SVG 連線。Alt+點擊連線以刪除（可自訂：按一下或按兩下）。父子移動連動，帶有彈性邊界限制。

**設計與主題** : 米白／奶油色極簡美學。深色模式，自動跟隨系統。可調整字型大小與縮放比例。方角／圓角切換。

**14 種語言** : en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi，自動偵測瀏覽器語言。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="盒子階層與書籤" width="1280">
</picture>

## 截圖

| 畫布 | 盒子與書籤 | 連線 |
|---|---|---|
| ![畫布](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![盒子與書籤](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![連線](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| 設定 | 書籤編輯 |
|---|---|
| ![設定](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![書籤編輯](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## 安裝

> [!IMPORTANT]
> **請透過官方商店頁面安裝**（推薦）。權威安裝步驟與目前已發布的商店版本維護在 [英文 README — Install](../../README.md#install)。
> GitHub Releases 僅作為**面向使用者的版本更新日誌**：[最新版本](https://github.com/Xxx91n/boxing/releases/latest)。

### Firefox（正式安裝）

1. 開啟 [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/zh-TW/firefox/addon/boxing-newtab/)
2. 點擊 **Add to Firefox**，按瀏覽器提示完成安裝

### Edge / Chromium（正式安裝）

1. 開啟 [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. 點擊 **取得** / **Get** 完成安裝（Chromium 系列瀏覽器請使用 Edge 商店頁面）

### 開發者：從原始碼建置

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge：`chrome://extensions` → 開發人員模式 → **載入未打包項目** → 選擇 `dist/boxing-chrome/`
- Firefox：`about:debugging#/runtime/this-firefox` → **載入暫時附加元件** → 選擇 `dist/boxing-firefox/manifest.json`

> [!NOTE]
> 建置產物 zip 供**商店上傳或本機偵錯**，不是面向使用者的正式安裝管道。正式安裝請走上方商店連結。
> 簽章由應用程式商店完成；本儲存庫 GitHub Release **不再**分發 `.xpi` / `.crx`。

## 使用

- **按兩下**空白畫布 → 建立新盒子
- **拖曳**盒子標題列 → 移動盒子
- **Ctrl+滾輪** → 縮放畫布（30% 至 200%）
- **拖曳**空白畫布 → 平移
- **按一下右鍵** → 返回父級畫布
- **按一下**盒子 → 進入子畫布
- 從盒子邊緣中點 **拖曳** → 連接到另一個盒子
- **Alt+按一下**連線 → 刪除連線
- 盒子上的 **星號** → 標記為父盒子（子盒子隨之移動）
- **圖釘** → 鎖定盒子位置
- 畫布右上角 **圓形按鈕** → 取消固定進入全螢幕模式

## 隱私

[docs/privacy-policy.md](../../docs/privacy-policy.md)

## 開發

### 必要條件

- Node.js 24.22.1
- npm

### 設定

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### 建置

```bash
npm run build     # 開發建置 → dist/boxing-chrome + dist/boxing-firefox
npm test          # Playwright 測試 (Chrome + Firefox)
```

詳見 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解完整開發指南。

## 貢獻

歡迎貢獻！詳見 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解環境設定、工作流程與程式碼風格。

## 授權條款

[Apache-2.0](../../LICENSE)
