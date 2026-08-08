<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · **日本語** · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md)
<!-- README-I18N:END -->

# Boxing

階層型無限キャンバスのブックマークオーガナイザー。ベージュミニマリストデザイン。

Boxing はブラウザの新しいタブページをビジュアルなブックマークワークスペースに変えます。フラットなフォルダの代わりに、無限キャンバス上にラベル付きボックスを作成し、ブックマークを整理します — ドラッグ、接続、ネストして、あなたの思考通りに配置できます。Obsidian キャンバスとブックマークが出会ったようなものです。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing キャンバス概要" width="1280">
</picture>

> [!NOTE]
> これはプレースホルダーです。メインキャンバスのボックスと接続を示す実際のスクリーンショットに置き換えてください。

## 目次

- [機能](#features)
- [インストール](#install)
- [**ダブルクリック** 空白キャンバス → 新規ボックス作成,**ドラッグ** ボックスタイトルバー → ボックス移動,**Ctrl+スクロール** → キャンバスズーム（30%〜200%）,**ドラッグ** 空白キャンバス → パン,**右クリック** → 親キャンバスレベルに戻る,**クリック** ボックス → サブキャンバスに入る,ボックスの辺の中点から **ドラッグ** → 別のボックスに接続,**Alt+クリック** 接続線 → 削除,ボックスの **スター** → 親ボックスとしてマーク（子が一緒に移動）,**ピン** → ボックス位置をロック,キャンバス右上の **丸いボタン** → ヘッダーのピン解除でフルスクリーン](#usage)
- [すべてのデータは `chrome.storage.local` にローカル保存 — オプションのクラウドバックアップを設定しない限りデバイスから出ません,オプションの WebDAV / GitHub Gist バックアップが唯一の外部ネットワーク通信です,アナリティクスなし、トラッキングなし、サードパーティサービスなし,100% オープンソース（Apache-2.0）— すべてのコードを監査可能,プライバシーポリシー：[docs/privacy-policy.md](../../docs/privacy-policy.md)](#privacy)
- [開発](#development)
- [貢献](#contributing)
- [ライセンス](#license)

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

> [!NOTE]
> これはプレースホルダーです。ボックス階層とブックマーク管理を示す実際のスクリーンショットに置き換えてください。

## インストール

### Chrome / Edge (Chromium)

1. 最新の [リリース ZIP](https://github.com/Xxx91n/boxing/releases) をダウンロード
2. フォルダに解凍
3. `chrome://extensions`（または `edge://extensions`）を開く
4. 右上の **デベロッパーモード** を有効化
5. **パッケージ化されていない拡張機能を読み込む** をクリックし、解凍したフォルダを選択

### Firefox

1. 最新の [リリース XPI](https://github.com/Xxx91n/boxing/releases) をダウンロード
2. `about:addons` を開く
3. 歯車アイコン → **ファイルからアドオンをインストール**
4. ダウンロードした XPI ファイルを選択

> [!TIP]
> エンドユーザーに Node.js や npm は不要です。それらは開発用のみです。

## **ダブルクリック** 空白キャンバス → 新規ボックス作成,**ドラッグ** ボックスタイトルバー → ボックス移動,**Ctrl+スクロール** → キャンバスズーム（30%〜200%）,**ドラッグ** 空白キャンバス → パン,**右クリック** → 親キャンバスレベルに戻る,**クリック** ボックス → サブキャンバスに入る,ボックスの辺の中点から **ドラッグ** → 別のボックスに接続,**Alt+クリック** 接続線 → 削除,ボックスの **スター** → 親ボックスとしてマーク（子が一緒に移動）,**ピン** → ボックス位置をロック,キャンバス右上の **丸いボタン** → ヘッダーのピン解除でフルスクリーン

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

## すべてのデータは `chrome.storage.local` にローカル保存 — オプションのクラウドバックアップを設定しない限りデバイスから出ません,オプションの WebDAV / GitHub Gist バックアップが唯一の外部ネットワーク通信です,アナリティクスなし、トラッキングなし、サードパーティサービスなし,100% オープンソース（Apache-2.0）— すべてのコードを監査可能,プライバシーポリシー：[docs/privacy-policy.md](../../docs/privacy-policy.md)

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

<!-- README-I18N:START:FOOTER -->
> Translations: [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END:FOOTER -->
