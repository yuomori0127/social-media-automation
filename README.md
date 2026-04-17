# 育児発信コンテンツ自動生成パイプライン

1歳児を持つ親向けに、育児の悩みをPubMed論文のエビデンスで解決するコンテンツを自動生成し、X（Twitter）とnoteに発信するワークフロー。

---

## 全体の流れ

```
① /run コマンドでコンテンツ生成
   PubMed論文 → X投稿 / note / Shortsスクリプト → Googleスプレッドシートに書き込み

② テロップ動画を作る（remotion-captions）
   video.mp4 + script.txt を置いて run_all.py を実行 → テロップ付きMP4を書き出し
```

---

## セットアップ

### 必要なもの

- Node.js 18以上
- Python 3.9以上
- ffmpeg
- OpenAI APIキー
- Google Cloud OAuthクライアント（Sheets / Drive スコープ）

### インストール

```bash
git clone https://github.com/yuomori0127/social-media-automation.git
cd social-media-automation
npm install

cd remotion-captions && npm install && cd ..
```

### 環境変数

`.env.example` をコピーして `.env` を作成する。

```bash
cp .env.example .env
```

```
OPENAI_API_KEY=sk-proj-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SPREADSHEET_ID=...
```

`remotion-captions/.env` にも同じ `OPENAI_API_KEY` が必要（Whisper・キーワード生成で使用）。

### Google認証

```bash
node google_auth.mjs
```

ブラウザが開くのでGoogleアカウントでログインする。`token.json` が生成されれば完了。トークンが期限切れになったら再実行する。

---

## ① コンテンツ生成（X / note / Shorts）

Claude Code で `/run` コマンドを実行するだけで、論文検索からスプレッドシート書き込みまで全自動で行われる。

### スプレッドシート構造

| 列 | 内容 |
|---|---|
| A | 実行日時 |
| B | 論文タイトル |
| C | 論文URL（PubMed） |
| D | 一次要約（英語アブストラクト） |
| E | ステータス（未処理 / 処理済） |
| F | noteタイトル |
| G | X長文ポスト（600〜900字・1投稿） |
| H | noteタイトル＋見出し構成 |
| I | note全文（1500字以上・Markdown） |
| J | noteバナー画像パス |
| K | YouTube Shortsスクリプト（60〜180秒） |
| L | Higgsfieldビジュアルプロンプト（英語） |
| M | YouTubeステータス（未投稿 / 編集中 / 投稿済） |

### バナー画像を単体で作りたいとき

```bash
python generate_banner.py --title "タイトル" --output "./images/banners/YYYYMMDD_rowXX.png"
```

---

## ② テロップ付き動画（remotion-captions）

動画と台本を置いて1コマンドを実行するだけで、Whisperが自動でタイミングを計算しテロップ付きMP4を書き出す。

### 手順

#### Step 1：素材を用意する

以下の2ファイルを `input/` フォルダに置くだけ。他は自動生成される。

| ファイル | 内容 |
|---|---|
| `remotion-captions/input/video.mp4` | テロップを乗せたい動画 |
| `remotion-captions/input/script.txt` | 台本テキスト |

**script.txt の書き方：**
- 1行 = テロップ1枚として表示される
- 改行位置は適当で OK。13文字を超える行は自動的に折り返される
- 句読点（。、！？）の直後で優先的に区切られる

```
慣らし保育で泣いてる子を見て、自分も辛くなってた。
でも調べたら、これ愛着形成に必要なプロセスだったんです。
論文によると分離不安のピークは8〜18ヶ月。
より詳しい情報はnoteやXで。フォローお願いします。
```

**keywords.txt は不要。** スクリプトがOpenAI APIでハイライトキーワードを自動生成する。

#### Step 2：一括実行

```bash
cd remotion-captions
python scripts/run_all.py
```

実行されること：

| ステップ | 処理 |
|---|---|
| Step 0 | 前回の成果物を `sessions/YYYYMMDD_HHMMSS/` に自動バックアップ |
| Step 0.5 | `input/video.mp4` → `public/`、`input/script.txt` → `scripts/` にコピー |
| Step 1 | ffmpegで音声抽出 → Whisper APIで単語レベルのタイムスタンプ取得 |
| Step 1.5 | script.txt からキーワードをAI自動生成 → `keywords.txt` に保存 |
| Step 2 | 台本とWhisperを照合 → `src/data/captions.ts` を生成 |

#### Step 3：プレビューで確認

```bash
npx remotion studio
```

ブラウザで `http://localhost:3000/CaptionVideo` を開く。`captions.ts` を編集するとホットリロードで即反映される。

#### Step 4：MP4を書き出す

```bash
npx remotion render CaptionVideo output/video_with_captions.mp4
```

### タイミングの手動調整

`src/data/captions.ts` の `startMs` / `endMs`（ミリ秒）を直接編集する。

```ts
{
  text: "テキスト",
  startMs: 500,   // 0.5秒から表示開始
  endMs: 5000,    // 5秒で非表示
},
```

### テロップのデザイン

`src/components/Subtitle.tsx` で一元管理している。

| 項目 | 設定値 |
|---|---|
| テキスト色 | 白（`#FFFFFF`） |
| アウトライン色 | 赤（`#FF0000`） |
| キーワードハイライト色 | 黄（`#FFFF00`） |
| フォント | Noto Sans JP・太さ900 |
| フォントサイズ | 80px（長い行は自動縮小、最小34px） |
| テロップ位置 | 画面下部 |
| 先頭2行 | 赤背景ボックスで中央表示（フック） |

### バックアップの内容

```
remotion-captions/sessions/
└── 20260417_143022/
    ├── video.mp4
    ├── audio.wav
    ├── script.txt
    ├── keywords.txt
    ├── whisper_words_raw.json
    ├── captions.ts
    └── output/
```

過去セッションのファイルを元の場所に戻せば、その回の状態を再現できる。

### ファイル構成

```
remotion-captions/
├── input/
│   ├── video.mp4               ← 毎回ここに置く
│   └── script.txt              ← 毎回ここに置く
├── public/
│   └── video.mp4               ← 自動コピー（Remotion用）
├── scripts/
│   ├── script.txt              ← 自動コピー
│   ├── keywords.txt            ← 自動生成
│   ├── run_all.py              ← 一括実行スクリプト
│   ├── transcribe_words.py     ← Whisper実行
│   ├── script_align.py         ← タイムスタンプ合わせ
│   ├── audio.wav               ← 自動生成
│   └── whisper_words_raw.json  ← 自動生成
├── src/
│   ├── Root.tsx
│   ├── CaptionVideo.tsx
│   ├── data/captions.ts        ← 自動生成
│   └── components/Subtitle.tsx ← テロップデザイン
└── .env                        ← OPENAI_API_KEY
```

### トラブルシューティング

**テロップのタイミングがずれている**  
→ `captions.ts` を直接編集して `startMs` / `endMs` を手動調整する。

**`insufficient_quota` エラーが出る**  
→ OpenAI APIの残高不足。https://platform.openai.com/billing でチャージする。

**Remotion Studioが起動しない**  
→ `npm install` を再実行する。

**`invalid_grant` / `Token expired` エラーが出る**  
→ `node google_auth.mjs` を実行してトークンを再取得する。

---

## 自動実行

`auto_run.bat` をWindowsタスクスケジューラに登録することで定期実行が可能。

```bash
powershell -ExecutionPolicy Bypass -File register_task.ps1
```

---

## ライセンス

MIT
