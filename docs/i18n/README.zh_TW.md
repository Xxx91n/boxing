<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · **繁體中文** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

層級化無限畫布書籤管理器，米白極簡設計。

Boxing 將瀏覽器新分頁變為視覺化書籤工作區。不再是扁平資料夾，而是在無限畫布上用標籤盒子組織書籤 — 拖曳、連結、巢狀排列，按你的思維空間組織。可以理解為 Obsidian 畫布遇見書籤管理。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing 畫布總覽" width="1280">
</picture>

## 目錄

- [功能](#功能)
- [截圖](#截圖)
- [品牌資產](#品牌資產)
- [安裝](#安裝)
- [使用](#使用)
- [隱私](#隱私)
- [開發](#開發)
- [貢獻](#貢獻)
- [授權](#授權)

## 功能

**無限畫布** — 自由平移和縮放（Ctrl+滾輪）。在單一畫布上建立無限盒子。用連線表示盒子間的關係。設定父子關係 — 移動父盒子時子盒子跟隨移動。

**兩級層級** — 大盒子包含小盒子，小盒子包含書籤。點擊盒子進入其子畫布。麵包屑導航顯示路徑。可任意深度巢狀。

**書籤管理** — 每個盒子有自己的書籤集合，支援列表和網格檢視。新增、編輯、刪除，操作簡潔。可在目前分頁或新分頁開啟（可設定）。拖曳排序。

**連線** — 盒子間的視覺 SVG 連線。Alt+點擊連線刪除（可設定：單擊或雙擊）。父子移動傳播，帶彈性邊界約束。

**設計與主題** — 米白/奶油色極簡美學。深色模式，自動跟隨系統。可調字型和縮放。方角/圓角切換。

**14 種語言** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi，自動偵測瀏覽器語言。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="盒子層級與書籤" width="1280">
</picture>

## 截圖

| 畫布 | 盒子與書籤 | 連線 |
|---|---|---|
| ![畫布](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![盒子與書籤](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![連線](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| 設定 | 書籤編輯 |
|---|---|
| ![設定](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![書籤編輯](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## 品牌資產

淺色/深色 logo、擴充功能圖示、favicon、商店圖塊與變體展示均收錄於 [`docs/brand/`](../../docs/brand/)（24 個檔案，來自 `box_png` 資產套件），可直接複用於商店 listing、文件與 GitHub 社群預覽圖。

## 安裝

> [!TIP]
> 預建置安裝套件已發布於 GitHub Releases：[最新版本](https://github.com/Xxx91n/boxing/releases/latest) 提供 `boxing-chrome-<version>.zip` / `.crx`、`boxing-firefox-<version>.zip` / `.xpi` 與 `SHA256SUMS.txt`。商店上架仍在推進中（Edge 進行中，Chrome Web Store 延後至 Edge 上線，AMO 暫無公開列表），發布版 `.xpi` 即 Firefox 自架安裝途徑。

### Chrome / Edge (Chromium)

**從 Release 安裝套件安裝（無需建置工具）**

1. 從[最新版本](https://github.com/Xxx91n/boxing/releases/latest)下載 `boxing-chrome-<version>.zip` 並解壓縮
2. 開啟 `chrome://extensions`（或 `edge://extensions`）
3. 啟用**開發者模式**（右上角開關）
4. 點擊**載入未封裝的擴充功能**，選擇解壓縮後的 `boxing-chrome/` 目錄

**從原始碼建置**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**從 Release 安裝套件安裝**

1. 從[最新版本](https://github.com/Xxx91n/boxing/releases/latest)下載 `boxing-firefox-<version>.xpi` 並在 Firefox 中開啟——經 AMO 簽章的組建可直接安裝；未簽章組建僅能在 Firefox Developer Edition/Nightly 載入
2. 或下載 `boxing-firefox-<version>.zip` 解壓縮後，在 `about:debugging#/runtime/this-firefox` 點擊**載入暫時的附加元件**並選擇解壓縮後的 `manifest.json`

**從原始碼建置**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> 僅從原始碼建置需要 Node.js 與 npm；自 GitHub Release 安裝套件安裝則不需要。商店上架完成後即可一鍵安裝。

## 使用

- **雙擊**空白畫布 → 建立新盒子
- **拖曳**盒子標題列 → 移動盒子
- **Ctrl+滾輪** → 縮放畫布（30% 到 200%）
- **拖曳**空白畫布 → 平移
- **右鍵** → 返回父級畫布
- **點擊**盒子 → 進入子畫布
- 從盒子邊緣中點 **拖曳** → 連結到另一個盒子
- **Alt+點擊**連線 → 刪除連線
- 盒子上的 **星號** → 標記為父盒子（子盒子跟隨移動）
- **圖釘** → 鎖定盒子位置
- 畫布右上角 **圓圈按鈕** → 取消固定進入全螢幕模式

## 隱私

- 所有資料本地儲存在 `chrome.storage.local` — 除非你設定了可選的雲端備份，否則不會離開你的裝置
- 可選的 WebDAV / GitHub Gist 備份是唯一的對外網路使用
- 無分析、無追蹤、無第三方服務
- 100% 開源（Apache-2.0）— 可稽核每一行原始碼
- 完整隱私政策：[docs/privacy-policy.md](../../docs/privacy-policy.md)

## 開發

### 前置條件

- Node.js >= 18
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
npm test          # Playwright 測試（Chrome + Firefox）
```

詳見 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解完整開發指南。

## 貢獻

歡迎貢獻！詳見 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解環境設定、工作流程和程式碼風格。

## 授權

Apache-2.0 — 見 [LICENSE](../../LICENSE)
