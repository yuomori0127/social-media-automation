# 育児発信コンテンツ自動生成パイプライン

1歳児を持つ親向けに、育児の悩みをPubMed論文のエビデンスで解決するコンテンツを自動生成し、X（Twitter）とnoteに発信するワークフロー。

```
PubMed論文
    ↓
OpenAI API でコンテンツ生成
    ↓
Googleスプレッドシートに書き込み
    ↓
テロップ付き動画（remotion-captions）
```

---

## 生成物一覧

| 生成物 | 仕様 |
|---|---|
| X長文ポスト | 600〜900字・1投稿（Xプレミアム向け） |
| noteタイトル＋見出し構成 | 4〜7セクション |
| note全文 | 1500字以上・Markdown形式 |
| noteバナー画像 | 1280×670px |
| YouTube Shortsスクリプト | 60〜180秒・Hook/本文/CTA形式 |
| Higgsfieldビジュアルプロンプト | シーン別3〜5個・英語 |
| テロップ付き動画 | MP4・Whisper自動タイミング |

---

## セットアップ

### 必要なもの

- Node.js 18以上
- Python 3.9以上
- ffmpeg（`transcribe_words.py` で使用）
- OpenAI APIキー
- Google Cloud OAuthクライアント（Sheets / Drive スコープ）

### インストール

```bash
git clone https://github.com/yuomori0127/social-media-automation.git
cd social-media-automation
npm install

# テロップ動画サブプロジェクト
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

`remotion-captions/.env` にも同じ `OPENAI_API_KEY` が必要（Whisper APIで使用）。

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

## コンテンツ生成

### 主要スクリプト

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

## テロップ付き動画（remotion-captions）

動画ファイルと台本テキストを用意するだけで、Whisper APIがタイミングを自動計算し、テロップ付きMP4を書き出す。AfterEffectsやPremiere Proは不要。

### 仕組み

```
public/video.mp4  +  scripts/script.txt
        ↓
① transcribe_words.py
   ffmpegで音声抽出 → Whisper APIで単語レベルのタイムスタンプ取得
   → scripts/whisper_words_raw.json
        ↓
② script_align.py
   台本テキストとWhisperの単語列を照合 → 各行の開始・終了秒を計算
   → src/data/captions.ts（自動生成）
        ↓
③ Remotion Studio でプレビュー / render でMP4書き出し
```

Remotionは「ReactコードでHTMLを動画に変換する」フレームワーク。テロップのデザインとアニメーションをコードで1回定義すれば、台本を差し替えるだけで毎回同じクオリティの動画が自動生成される。

### 使い方（動画1本ごとの手順）

#### Step 1：素材を用意する

| ファイル | 内容 |
|---|---|
| `remotion-captions/public/video.mp4` | テロップを乗せたい動画（上書きコピー） |
| `remotion-captions/scripts/script.txt` | 台本テキスト（1行 = テロップ1枚） |
| `remotion-captions/scripts/keywords.txt` | 黄色ハイライトするキーワード（1行 = 1語、省略可） |

`script.txt` の書き方：
```
冒頭のキャッチコピーをここに書く
2枚目のテロップをここに書く
3枚目のテロップをここに書く
詳しくはnoteで。フォローで続報も届けます。
```

#### Step 2：文字起こし＋タイムスタンプ生成（一括実行）

```bash
cd remotion-captions
python scripts/run_all.py
```

実行前に前回の成果物を `sessions/YYYYMMDD_HHMMSS/` へ自動バックアップしてから、以下を順番に実行する。

1. `transcribe_words.py` — ffmpegで音声抽出 → Whisper APIで単語レベルのタイムスタンプ取得
2. `script_align.py` — 台本と照合して `src/data/captions.ts` を生成

Remotion Studioが起動中であればブラウザが自動更新される。

> 個別実行したい場合は `python scripts/transcribe_words.py` / `python scripts/script_align.py` を直接呼ぶ。

**バックアップの保存先**

```
remotion-captions/sessions/
└── 20260417_143022/     ← 実行日時
    ├── script.txt
    ├── keywords.txt
    ├── whisper_words_raw.json
    └── captions.ts
```

#### Step 4：プレビューで確認

```bash
npx remotion studio
```

ブラウザで http://localhost:3000/CaptionVideo を開く。ファイルを編集すると**ホットリロード**で即反映される。

#### Step 5：MP4を書き出す

```bash
npx remotion render CaptionVideo output/video_with_captions.mp4
```

---

### テロップのカスタマイズ

#### タイミングの手動調整

`src/data/captions.ts` の `startMs` / `endMs`（ミリ秒）を直接編集する。Studio を開いたままファイルを保存するとリアルタイムで反映される。

```ts
{
  text: "テキスト",
  startMs: 500,   // 0.5秒から表示開始
  endMs: 5000,    // 5秒で非表示
},
```

#### 文字色・フォントの変更

`src/components/Subtitle.tsx` で一元管理している。

| 項目 | デフォルト値 |
|---|---|
| 通常テキスト色 | `#FFFFFF`（白） |
| アウトライン色 | `#FF0000`（赤） |
| `<b>`タグの色（キーワード） | `#FFFF00`（黄） |
| フォント | Noto Sans JP・太さ900 |
| 基本フォントサイズ | 68px（長い行は自動縮小、最小34px） |
| テロップ位置 | 画面下部8% |
| 出現アニメーション | フェードイン＋スライドアップ |

`captions.ts` 内で `<b>キーワード</b>` で囲むと黄色で強調表示される。

#### ファイル構成

```
remotion-captions/
├── public/
│   └── video.mp4               ← 動画をここに置く（毎回上書き）
├── scripts/
│   ├── script.txt              ← 台本（毎回書き換える）
│   ├── keywords.txt            ← ハイライトキーワード（任意）
│   ├── transcribe_words.py     ← Whisper実行スクリプト
│   ├── script_align.py         ← アライメントスクリプト
│   ├── audio.wav               ← 自動生成
│   └── whisper_words_raw.json  ← 自動生成
├── src/
│   ├── Root.tsx                ← Remotionのコンポジション定義
│   ├── CaptionVideo.tsx        ← 動画＋テロップの組み合わせ
│   ├── data/captions.ts        ← 自動生成（タイムスタンプ）
│   └── components/Subtitle.tsx ← テロップのデザイン定義
└── .env                        ← OPENAI_API_KEY
```

### トラブルシューティング

**`insufficient_quota` エラーが出る**  
→ OpenAI APIの残高不足。https://platform.openai.com/billing でチャージする。

**テロップのタイミングがずれている**  
→ `script.txt` の1行が長すぎる場合は2行に分割すると精度が上がる。`captions.ts` を直接編集して手動調整も可能。

**Remotion Studioが起動しない**  
→ `npm install` を再実行する。

**`zod` のバージョン警告が出る**  
→ 動作に影響しないため無視してよい。

---

## 自動実行

`auto_run.bat` をWindowsタスクスケジューラに登録することで定期実行が可能。

```bash
powershell -ExecutionPolicy Bypass -File register_task.ps1
```

---

## ライセンス

MIT
