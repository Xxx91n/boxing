<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · **日本語** · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

階層型無限キャンバスのブックマークオーガナイザー。ベージュミニマリストデザイン。

Boxing はブラウザの新しいタブページをビジュアルなブックマークワークスペースに変えます。フラットなフォルダの代わりに、無限キャンバス上にラベル付きボックスを作成し、ブックマークを整理します — ドラッグ、接続、ネストして、あなたの思考通りに配置できます。Obsidian キャンバスとブックマークが出会ったようなものです。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing キャンバス概要" width="1280">
</picture>

## 目次

- [機能](#機能)
- [スクリーンショット](#スクリーンショット)
- [ブランドアセット](#ブランドアセット)
- [インストール](#インストール)
- [使い方](#使い方)
- [プライバシー](#プライバシー)
- [開発](#開発)
- [貢献](#貢献)
- [ライセンス](#ライセンス)

## 機能

**無限キャンバス** — 自由にパンとズーム（Ctrl+スクロール）。1つのキャンバスに無制限のボックスを作成。線で接続して関係を表示。親子関係を設定 — 親ボックスを動かすと子ボックスも追従。

**2階層構造** — 大きなボックスの中に小さなボックス、小さなボックスの中にブックマーク。ボックスをクリックしてサブキャンバスに入る。パンくずナビでパスを表示。必要な深さまでネスト可能。

**ブックマーク管理** — 各ボックスに独自のブックマークコレクション（リスト＆グリッド表示）。追加、編集、削除がシンプルなダイアログで。現在のタブまたは新規タブで開く（設定可能）。ドラッグで並べ替え。

**接続** — ボックス間のビジュアル SVG 接続線。Alt+クリックで線を削除（設定可能：シングルクリックまたはダブルクリック）。親子移動伝播、弾性境界クランプ付き。

**デザイン＆テーマ** — ベージュ/クリームのミニマル美学。ライト/ダークモード、システム自動検出。フォントサイズとズーム調整可能。角丸/角張の切り替え。

**14言語対応** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi、ブラウザ言語の自動検出。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="ボックス階層とブックマーク" width="1280">
</picture>

## スクリーンショット

| キャンバス | ボックスとブックマーク | 接続ライン |
|---|---|---|
| ![キャンバス](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![ボックスとブックマーク](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![接続ライン](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| 設定 | ブックマーク編集 |
|---|---|
| ![設定](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![ブックマーク編集](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## ブランドアセット

ライト/ダークのロゴ、拡張機能アイコン、ファビコン、ストアタイル、バリエーション紹介は [`docs/brand/`](../../docs/brand/) に同梱されています（`box_png` アセットキット由来の 24 ファイル）。ストア掲載物、ドキュメント、GitHub ソーシャルプレビューにそのまま再利用できます。

## インストール

> [!TIP]
> プリビルドのインストールパッケージは GitHub Releases で公開中です。[最新版リリース](https://github.com/Xxx91n/boxing/releases/latest) には `boxing-chrome-<version>.zip` / `.crx`、`boxing-firefox-<version>.zip` / `.xpi`、`SHA256SUMS.txt` が含まれます。ストア掲載は準備中（Edge は進行中、Chrome Web Store は Edge 公開後、AMO に公開掲載なし）のため、Firefox はリリースの `.xpi` を直接ご利用いただけます。

### Chrome / Edge (Chromium)

**リリースパッケージからインストール（ビルド工具不要）**

1. [最新版リリース](https://github.com/Xxx91n/boxing/releases/latest) から `boxing-chrome-<version>.zip` をダウンロードして解凍する
2. `chrome://extensions`（または `edge://extensions`）を開く
3. **開発者モード**（右上のトグル）を有効にする
4. **ファイルをロード** をクリックし、解凍した `boxing-chrome/` フォルダを選択する

**ソースからビルド**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**リリースパッケージからインストール**

1. [最新版リリース](https://github.com/Xxx91n/boxing/releases/latest) から `boxing-firefox-<version>.xpi` をダウンロードし、Firefox で開く — AMO 署名済みビルドは直接インストールできます。無署名ビルドは Firefox Developer Edition/Nightly でのみ読み込めます
2. または `boxing-firefox-<version>.zip` を解凍し、`about:debugging#/runtime/this-firefox` で **一時アドオンとして読み込む** を選んで解凍先の `manifest.json` を指定する

**ソースからビルド**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Node.js と npm が必要になるのはソースからのビルドのみで、GitHub Release のパッケージからのインストールには不要です。ストア掲載後はワンクリックでインストールできます。

## 使い方

- **ダブルクリック** 空白キャンバス → 新規ボックス作成
- **ドラッグ** ボックスタイトルバー → ボックス移動
- **Ctrl+スクロール** → キャンバスズーム（30%〜200%）
- **ドラッグ** 空白キャンバス → パン
- **右クリック** → 親キャンバスレベルに戻る
- **クリック** ボックス → サブキャンバスに入る
- ボックスの辺の中点から **ドラッグ** → 別のボックスに接続
- **Alt+クリック** 接続線 → 削除
- ボックスの **スター** → 親ボックスとしてマーク（子が一緒に移動）
- **ピン** → ボックス位置をロック
- キャンバス右上の **丸いボタン** → ヘッダーのピン解除でフルスクリーン

## プライバシー

- すべてのデータは `chrome.storage.local` にローカル保存 — オプションのクラウドバックアップを設定しない限りデバイスから出ません
- オプションの WebDAV / GitHub Gist バックアップが唯一の外部ネットワーク通信です
- アナリティクスなし、トラッキングなし、サードパーティサービスなし
- 100% オープンソース（Apache-2.0）— すべてのコードを監査可能
- プライバシーポリシー：[docs/privacy-policy.md](../../docs/privacy-policy.md)

## 開発

### 前提条件

- Node.js >= 18
- npm

### セットアップ

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### ビルド

```bash
npm run build     # 開発ビルド → dist/boxing-chrome + dist/boxing-firefox
npm test          # Playwright テスト（Chrome + Firefox）
```

完全な開発ガイドは [CONTRIBUTING.md](../../CONTRIBUTING.md) を参照してください。

## 貢献

貢献を歓迎します！セットアップ、ワークフロー、コードスタイルは [CONTRIBUTING.md](../../CONTRIBUTING.md) を参照してください。

## ライセンス

Apache-2.0 — [LICENSE](../../LICENSE) を参照
