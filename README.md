# 育児発信コンテンツ自動生成パイプライン

1歳児を持つ親向けに、育児の悩みをPubMed論文のエビデンスで解決するコンテンツを自動生成し、X（Twitter）とnoteに発信するワークフロー。

---

## 概要

PubMedから育児関連論文を取得し、OpenAI APIでコンテンツを生成。結果をGoogleスプレッドシートに書き込む。

| 生成物 | 仕様 |
|---|---|
| X長文ポスト | 600〜900字・1投稿（Xプレミアム向け） |
| noteタイトル＋見出し構成 | 4〜7セクション |
| note全文 | 1500字以上・Markdown形式 |
| noteバナー画像 | 1280×670px |
| YouTube Shortsスクリプト | 60〜180秒・Hook/本文/CTA形式 |
| Higgsfieldビジュアルプロンプト | シーン別3〜5個・英語 |

---

## セットアップ

### 必要なもの

- Node.js 18以上
- Python 3.9以上
- OpenAI APIキー
- Google Cloud OAuthクライアント（Sheets / Drive スコープ）

### インストール

```bash
git clone https://github.com/yuomori0127/social-media-automation.git
cd social-media-automation
npm install

# remotion-captions サブプロジェクト
cd remotion-captions && npm install && cd ..
```

### 環境変数の設定

`.env.example` をコピーして `.env` を作成する。

```bash
cp .env.example .env
```

`.env` を編集：

```
OPENAI_API_KEY=sk-proj-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SPREADSHEET_ID=...
```

### Google認証

```bash
node google_auth.mjs
```

ブラウザが開くのでGoogleアカウントでログインする。`token.json` が生成されれば完了。

---

## スプレッドシート構造

| 列 | 内容 |
|---|---|
| A | 実行日時 |
| B | 論文タイトル |
| C | 論文URL（PubMed） |
| D | 一次要約（英語アブストラクト） |
| E | ステータス（未処理 / 処理済） |
| F | noteタイトル |
| G | X長文ポスト |
| H | noteタイトル＋見出し構成 |
| I | note全文 |
| J | noteバナー画像パス |
| K | YouTube Shortsスクリプト |
| L | Higgsfieldビジュアルプロンプト |
| M | YouTubeステータス |

---

## 主要スクリプト

| スクリプト | 役割 |
|---|---|
| `process_pending.mjs` | 未処理行を取得してコンテンツ生成・書き込みまで一括実行 |
| `run_theme_search.mjs` | テーマ指定でPubMed論文を検索してスプレッドシートに追加 |
| `generate_banner.py` | noteバナー画像を生成（1280×670px） |
| `process_batch.py` | バッチ処理（複数行まとめて処理） |
| `google_auth.mjs` | Google OAuth2認証・`token.json` 生成 |
| `read_sheets.mjs` | スプレッドシート読み込み |
| `write_sheets.mjs` | スプレッドシート書き込み |

### バナー生成

```bash
python generate_banner.py --title "タイトル" --output "./images/banners/YYYYMMDD_rowXX.png"
```

---

## 自動実行

`auto_run.bat` をWindowsタスクスケジューラに登録することで定期実行が可能。

```bash
# タスクスケジューラへの登録
powershell -ExecutionPolicy Bypass -File register_task.ps1
```

---

## remotion-captions

YouTube Shorts用の字幕付き動画を生成するサブプロジェクト。Remotion（React）ベース。

```bash
cd remotion-captions
npx remotion studio  # ブラウザでプレビュー（localhost:3000）
npx remotion render CaptionVideo output/output.mp4  # MP4書き出し
```

### 字幕タイミングの手動調整

`src/data/captions.ts` の `startMs` / `endMs`（ミリ秒）を直接編集する。Studio を開いたままファイルを保存するとホットリロードで即反映される。

```ts
{
  text: "テキスト",
  startMs: 500,   // 0.5秒から表示開始
  endMs: 5000,    // 5秒で非表示
},
```

### 文字色・フォントの変更

`src/components/Subtitle.tsx` で一元管理している。

| 項目 | 変数／プロパティ | デフォルト値 |
|---|---|---|
| 通常テキスト色 | `color` (SubtitlePage) | `#FFFFFF`（白） |
| アウトライン色 | `makeOutlineShadow` の第1引数 | `#FF0000`（赤） |
| `<b>`タグの色 | `color` (renderTaggedText) | `#FFFF00`（黄） |
| フォント | `fontFamily` | `Noto Sans JP` |
| 基本フォントサイズ | `BASE_FONT_SIZE` | `68px` |

`captions.ts` 内でキーワードを `<b>テキスト</b>` で囲むと黄色で強調表示される。

---

## ライセンス

MIT
