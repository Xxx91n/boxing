<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · **日本語** · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

階層型の無限キャンバスブックマークマネージャー。ベージュ基調のミニマルデザイン。

Boxing は、ブラウザの新しいタブを視覚的なブックマークワークスペースに変えます。フラットなフォルダ管理ではなく、無限のキャンバス上にラベル付きのボックスを配置してブックマークを整理できます — ドラッグ、接続、入れ子構造により、思考の通りに空間配置できます。Obsidian のブックマーク管理キャンバスのような感覚です。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing キャンバス概要" width="1280">
</picture>

## 目次

- [機能](#機能)
- [スクリーンショット](#スクリーンショット)
- [インストール](#インストール)
- [使い方](#使い方)
- [プライバシー](#プライバシー)
- [開発](#開発)
- [貢献](#貢献)
- [ライセンス](#ライセンス)

## 機能

**無限キャンバス** : 自由なパンとズーム（Ctrl+ホイール操作）。1つのキャンバスにボックスを無制限に作成。ボックス間の関係を接続線で表現。親子関係を設定 — 親ボックスの移動に合わせて子ボックスも追従。

**2段階の階層構造** : 大ボックスの中に小ボックス、小ボックスの中にブックマークを格納。ボックスをクリックするとそのサブキャンバスへ移動。パンくずリストで現在位置を表示。階層は何段階でもネスト可能。

**ブックマーク管理** : 各ボックスごとにブックマークを管理でき、リスト表示とグリッド表示に対応。追加、編集、削除もスムーズ。現在のタブまたは新しいタブで開く設定が可能（設定可能）。ドラッグによる並べ替え。

**接続線** : ボックス間を視覚的なSVGラインで接続。Alt+クリックで線を削除（設定可能：シングルクリックまたはダブルクリック）。親子間の移動連動と伸縮性のある境界制限。

**デザインとテーマ** : ベージュ/クリーム色のミニマルなデザイン。ダークモード（システム設定に自動連動）。フォントサイズと拡大率の調整可能。角丸/直角の切り替え。

**14言語対応** : en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi（ブラウザの言語設定を自動検出）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="ボックス階層とブックマーク" width="1280">
</picture>

## スクリーンショット

| キャンバス | ボックスとブックマーク | 接続線 |
|---|---|---|
| ![キャンバス](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![ボックスとブックマーク](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![接続線](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| 設定 | ブックマーク編集 |
|---|---|
| ![設定](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![ブックマーク編集](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## インストール

> [!IMPORTANT]
> **公式ストアページからのインストールを推奨します**。正確なインストール手順および現在公開されているストアの最新版情報は [英語版 README — Install](../../README.md#install) を参照してください。
> GitHub Releases は**ユーザー向けの更新履歴（チェンジログ）**としてのみ利用されます: [最新バージョン](https://github.com/Xxx91n/boxing/releases/latest)。

### Firefox（正式インストール）

1. [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/ja/firefox/addon/boxing-newtab/) を開きます
2. **Add to Firefox** をクリックし、ブラウザの案内に従ってインストールを完了します

### Edge / Chromium（正式インストール）

1. [Edge アドオン — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi) を開きます
2. **入手** / **Get** をクリックしてインストールを完了します（Chromium系ブラウザはEdgeストアページをご利用ください）

### 開発者向け: ソースコードからのビルド

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge: `chrome://extensions` → デベロッパーモード → **パッケージ化されていない拡張機能を読み込む** → `dist/boxing-chrome/` を選択
- Firefox: `about:debugging#/runtime/this-firefox` → **一時的なアドオンを読み込む...** → `dist/boxing-firefox/manifest.json` を選択

> [!NOTE]
> ビルド生成物の zip は**ストア公開またはローカルデバッグ用**です。一般ユーザー向けの正式なインストール手順ではありません。通常利用は上記のストアリンクからインストールしてください。
> 署名は各ストアによって行われます。本リポジトリの GitHub Releases では `.xpi` / `.crx` の配布を**行っていません**。

## 使い方

- 空白キャンバスを**ダブルクリック** → 新規ボックス作成
- ボックスのタイトルバーを**ドラッグ** → ボックス移動
- **Ctrl+ホイール** → キャンバスの拡大・縮小（30%〜200%）
- 空白キャンバスを**ドラッグ** → 平行移動（パン）
- **右クリック** → 親キャンバスに戻る
- ボックスを**クリック** → 子キャンバスに入る
- ボックスの端の中央から**ドラッグ** → 別のボックスと接続
- 接続線を **Alt+クリック** → 接続線を削除
- ボックス上の**星アイコン** → 親ボックスとしてマーク（子ボックスが連動して移動）
- **ピン留め** → ボックスの位置を固定
- キャンバス右上の**丸ボタン** → 固定を解除して全画面モードに移行

## プライバシー

[docs/privacy-policy.md](../../docs/privacy-policy.md)

## 開発

### 前提条件

- Node.js 24.22.1
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
npm test          # Playwright テスト (Chrome + Firefox)
```

開発ガイドの詳細は [CONTRIBUTING.md](../../CONTRIBUTING.md) を参照してください。

## 貢献

貢献を歓迎します！環境構築、開発フロー、コードスタイルについては [CONTRIBUTING.md](../../CONTRIBUTING.md) を参照してください。

## ライセンス

[Apache-2.0](../../LICENSE)
