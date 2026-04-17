# remotion-captions

動画にテロップを自動生成するツールです。  
OpenAI Whisper で音声を解析し、台本の各行に正確なタイムスタンプを紐づけます。

---

## このツールの全体像

### 何をするツールか

```
動画ファイル (MP4)
    +
台本テキスト (script.txt)
    ↓
① 音声解析（Whisper API）
    ↓
② タイムスタンプ自動生成
    ↓
③ Remotion でテロップ合成
    ↓
テロップ付き動画 (MP4)
```

「動画」と「台本」を用意するだけで、テロップのタイミングを自動で計算し、デザイン済みのテロップを乗せた動画を書き出します。AfterEffectsやPremiere Proは不要です。

---

## Remotion とは何か

**Remotion は「Reactコードで動画を作る」フレームワークです。**

通常、動画編集ソフトはGUIで操作しますが、Remotionでは動画の中身をTypeScript（React）のコードで記述します。

### 具体的に何が嬉しいのか

| 従来の動画編集ソフト | Remotion |
|---|---|
| マウスでテロップを配置 | コードでテロップを定義 |
| テンプレートを毎回手作業で編集 | コードなので自動化できる |
| フォント・色・位置を毎回合わせる | デザインは1回書けば永続 |
| 100本作るには100回作業 | 台本とタイムスタンプを差し替えるだけ |

このプロジェクトでは「テロップのデザイン・アニメーション」をコード（`src/components/Subtitle.tsx`）として1回定義しています。あとは毎回 `script.txt` を書き換えるだけで、同じクオリティのテロップが自動生成されます。

### Remotion の動作原理

Remotionは動画を「フレームの連続」として扱います。

- 動画が30fps（1秒30コマ）なら、1秒目はフレーム0〜29
- Reactコンポーネントが「現在フレーム番号」を受け取り、そのフレームに表示すべき内容をレンダリング
- それを全フレーム分繰り返して、静止画を連結した動画として書き出す

たとえばテロップの「フェードイン」は、フレーム番号に応じて `opacity: 0 → 1` に変化するReactコードとして書かれています。

---

## http://localhost:3000 で何が起きているか

`npm start` を実行すると **Remotion Studio** というブラウザUIが起動します。

```
npm start
  └─ Remotion Studio を起動
       └─ http://localhost:3000 でサーバーが立ち上がる
            └─ ブラウザで動画プレビューが表示される
```

### localhost:3000 で見えるもの

| 画面の要素 | 説明 |
|---|---|
| 動画プレイヤー | テロップ付き動画のリアルタイムプレビュー |
| タイムライン | 再生位置を手動で動かせる |
| コンポジション一覧 | 「CaptionVideo」という名前で登録されている |
| プロパティパネル | 動画のサイズ・FPS・フレーム数など |

### localhost:3000/CaptionVideo とは

`CaptionVideo` は `src/Root.tsx` で定義した**コンポジション（動画の設計図）の名前**です。

```typescript
// src/Root.tsx
<Composition
  id="CaptionVideo"   ← これがURLの /CaptionVideo に対応
  component={CaptionVideo}
  ...
/>
```

このURLにアクセスすると、Remotion Studio が `CaptionVideo` コンポーネントを選択した状態で開きます。プレビューで確認できる内容は：

- `public/video.mp4` が背景動画として再生される
- `src/data/captions.ts` に書かれたタイムスタンプ通りにテロップが切り替わる
- テロップはフェードイン＋スライドアップのアニメーション付きで表示される

### ファイルを変更したときの自動更新

Remotion Studio は**ホットリロード**に対応しています。

- `src/data/captions.ts` が書き換わる → ブラウザのプレビューが自動更新
- `src/components/Subtitle.tsx` を編集 → デザインがリアルタイムで反映

つまり `python scripts/script_align.py` を実行して `captions.ts` が上書きされると、Studio を再起動しなくてもブラウザ上のプレビューが自動で変わります。

---

## 処理の流れ（詳細）

```
[1] transcribe_words.py を実行
    │
    ├─ ffmpeg で video.mp4 → audio.wav（音声のみ抽出）
    │
    └─ OpenAI Whisper API に audio.wav を送信
         │
         └─ 単語レベルのタイムスタンプを取得
              例: { word: "慣らし", start: 0.52, end: 0.88 }
                  { word: "保育",   start: 0.88, end: 1.20 }
                  ...
         └─ whisper_words_raw.json に保存

[2] script_align.py を実行
    │
    ├─ script.txt を読み込み（台本の各行）
    │
    ├─ keywords.txt を読み込み（ハイライト対象）
    │
    ├─ 台本テキストと Whisper の単語列を「文字レベル」で照合
    │   （句読点・記号を除いた正規化文字列で比較）
    │
    ├─ 各テロップ行の「開始秒・終了秒」を計算
    │
    ├─ キーワードに <b>タグ</b> を付与（黄色ハイライト用）
    │
    └─ src/data/captions.ts を生成
         例: { text: "「慣らし<b>保育</b>が...",
               startMs: 520, endMs: 3100, ... }

[3] Remotion Studio / render
    │
    ├─ captions.ts を読み込み
    │
    ├─ 各テロップを Sequence コンポーネントでタイムライン上に配置
    │   （startMs → startFrame に変換）
    │
    ├─ SubtitlePage が各フレームで現在のテロップをレンダリング
    │   ・calcFontSize() でテキスト長に応じてフォントサイズを自動調整
    │   ・spring() アニメーションで滑らかなフェードイン
    │
    └─ [プレビュー] ブラウザで確認
       [書き出し]   全フレームをChromiumで描画 → MP4として結合
```

---

## 初回セットアップ（最初の1回だけ）

```bash
cd remotion-captions
npm install
```

---

## 2回目以降の手順（動画ごとに実施）

### ステップ1：素材を用意する

| ファイル | 内容 |
|---|---|
| `public/video.mp4` | テロップを乗せたい動画（上書きコピー） |
| `scripts/script.txt` | 台本テキスト（1行 = テロップ1枚） |
| `scripts/keywords.txt` | 黄色でハイライトするキーワード（1行 = 1語）※省略可 |

**script.txt の書き方例：**
```
冒頭のキャッチコピーをここに書く
2枚目のテロップをここに書く
3枚目のテロップをここに書く
詳しくはnoteで。フォローで続報も届けます。
```

**keywords.txt の書き方例：**
```
ハイライトしたいキーワード
別のキーワード
```

---

### ステップ2：音声文字起こし（Whisper API）

```bash
python scripts/transcribe_words.py
```

- `public/video.mp4` から音声を抽出し、Whisper API で単語レベルのタイムスタンプを取得します。
- 結果は `scripts/whisper_words_raw.json` に保存されます。
- **OpenAI APIキーが必要です**（`.env` に設定済みであればOK）。

---

### ステップ3：タイムスタンプ生成

```bash
python scripts/script_align.py
```

- Whisper の結果と台本を照合し、各テロップの開始・終了時刻を計算します。
- `src/data/captions.ts` が**自動で上書き**されます。
- Remotion Studio が起動中であれば、**ブラウザが自動更新**されます。

---

### ステップ4：プレビューで確認

```bash
npm start
```

ブラウザで http://localhost:3000 を開いてください。  
（すでに起動中の場合は、そのままブラウザを確認してください）

---

### ステップ5：動画を書き出す

```bash
npx remotion render CaptionVideo output/video_with_captions.mp4
```

---

## ファイル構成

```
remotion-captions/
├── public/
│   └── video.mp4               ← 動画をここに置く（毎回上書き）
├── scripts/
│   ├── script.txt              ← 台本（毎回書き換える）
│   ├── keywords.txt            ← ハイライトキーワード（任意・毎回書き換える）
│   ├── transcribe_words.py     ← Whisper実行スクリプト（触らない）
│   ├── script_align.py         ← アライメントスクリプト（触らない）
│   ├── audio.wav               ← 自動生成（触らない）
│   └── whisper_words_raw.json  ← 自動生成（触らない）
├── src/
│   ├── Root.tsx                ← Remotionのコンポジション定義（触らない）
│   ├── CaptionVideo.tsx        ← 動画＋テロップの組み合わせ（触らない）
│   ├── data/
│   │   └── captions.ts         ← 自動生成（触らない）
│   └── components/
│       └── Subtitle.tsx        ← テロップのデザイン（触らない）
├── .env                        ← APIキー（触らない）
└── README.md                   ← この説明書
```

---

## テロップのデザイン仕様

| 項目 | 仕様 |
|---|---|
| フォント | Noto Sans JP / 太さ900 |
| 基本フォントサイズ | 68px（長い行は自動縮小、最小34px） |
| 文字色 | 白（#FFFFFF） |
| 縁取り | 赤（#FF0000）8方向 5px |
| キーワード色 | 黄（#FFFF00） |
| キーワード縁取り | 黒（#000000）8方向 5px |
| テロップ位置 | 画面下部8% |
| 出現アニメーション | フェードイン＋スライドアップ（最初の1枚はスキップ） |

---

## トラブルシューティング

**`insufficient_quota` エラーが出る**  
→ OpenAI APIの残高不足です。https://platform.openai.com/billing でチャージしてください。

**テロップのタイミングがずれている**  
→ `scripts/script.txt` の行数と話している内容がずれていないか確認してください。1行が長すぎる場合は2行に分割すると精度が上がります。

**Remotion Studioが起動しない**  
→ `npm install` を再実行してください。

**`zod` のバージョン警告が出る**  
→ 動作には影響しません。無視してOKです。
