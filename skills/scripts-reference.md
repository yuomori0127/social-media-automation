# スクリプト リファレンス

tech エージェントが参照するスキルファイル。各スクリプトの仕様・実行方法・よくあるエラーをまとめたもの。

---

## 共通設定

```
SPREADSHEET_ID  = <SPREADSHEET_ID>
CLIENT_ID       = <GOOGLE_CLIENT_ID>
CLIENT_SECRET   = <GOOGLE_CLIENT_SECRET>
TOKEN_PATH      = <PROJECT_DIR>/token.json
作業ディレクトリ = <PROJECT_DIR>/
```

---

## run_theme_search.mjs

### 目的
テーマ定義 → PubMed 検索 → スプレッドシート追記

### 実行前に必要な操作
`THEMES` 配列を今回のテーマで上書きすること。

```javascript
// このブロックを書き換える
THEMES = [
  { label: 'テーマ名（日本語）', query: 'PubMed search query in English' },
  { label: '...', query: '...' },
  { label: '...', query: '...' },
];
```

### 実行
```
node run_theme_search.mjs
```

### 正常出力の例
```
🔍 テーマ「夜泣き」を検索中...
  → 2件のPMID取得: 12345678, 87654321
  📄 Behavioral sleep intervention...
📊 スプレッドシートに 6 行を追記します...
✅ 完了: { ... }
```

### エラーと対処

| エラー | 原因 | 対処 |
|-------|------|------|
| `invalid_grant` | OAuthトークン期限切れ | `notify_error.ps1` を呼んで中断 |
| `fetch failed` | ネットワーク接続なし | 30秒待ってリトライ（最大2回） |
| `idlist: []` | クエリにヒットなし | そのテーマをスキップして次へ |

---

## read_sheets.mjs

### 目的
スプレッドシートの A1:Z200 を全読み取りして JSON で返す

### 実行
```
node read_sheets.mjs
```

### 出力
標準出力に JSON。E列の値で「未処理」行を特定する。

### スプレッドシートの列構成

| 列 | 内容 |
|----|------|
| A | 実行日時 |
| B | 論文タイトル（英語） |
| C | PubMed URL |
| D | 一次要約 |
| E | ステータス（未処理 / 処理済） |
| F | noteタイトル（記事タイトルのみ） |
| G | X長文ポスト（600〜900字・1投稿） |
| H | noteタイトル＋見出し構成 |
| I | note全文 |
| J | noteバナー画像パス（ローカル絶対パス） |
| K | YouTube Shortsスクリプト（60〜180秒・Hook/本文/CTA形式） |
| L | Higgsfieldビジュアルプロンプト（シーン別3〜5個） |
| M | YouTubeステータス（未投稿 / 編集中 / 投稿済） |

---

## write_sheets.mjs

### 目的
指定行の F〜J 列に値を書き込み、E列を「処理済」に更新するサンプルスクリプト

### 注意
このファイルはサンプル。実際の書き込みは同等の fetch コードを直接実行する（行番号を動的に指定するため）。

### 書き込み API パターン
```javascript
// F〜M 列への書き込み
// F=noteタイトル, G=X長文ポスト, H=noteタイトル+見出し, I=note全文, J=バナー画像パス
// K=Shortsスクリプト, L=Higgsfieldプロンプト, M=YouTubeステータス
PUT https://sheets.googleapis.com/v4/spreadsheets/{ID}/values/{RANGE}?valueInputOption=RAW
Body: { range: "F{row}:M{row}", majorDimension: "ROWS", values: [[noteTitle, xLongPost, noteOutline, noteBody, bannerPath, shortsScript, higgsfieldPrompts, '未投稿']] }

// E列のステータス更新
PUT https://sheets.googleapis.com/v4/spreadsheets/{ID}/values/E{row}?valueInputOption=RAW
Body: { range: "E{row}", majorDimension: "ROWS", values: [["処理済"]] }
```

---

## google_auth.mjs

### 目的
Google OAuth の再認証。トークンが期限切れになったときに手動で実行する。

### 実行（ユーザーが手動で行う）
```
node google_auth.mjs
```
ブラウザが開くのでGoogleアカウントでログインする。
完了後に `TOKEN_PATH` に新しいトークンが保存される。

### ⚠️ 注意
この操作は自動化できない（ブラウザ操作が必要）。
`notify_error.ps1` で通知した後、ユーザーが手動で実行する。

---

## notify_error.ps1

### 目的
エラー発生時にWindowsトースト通知とログ記録を行う

### 実行
```
powershell -File "<PROJECT_DIR>\notify_error.ps1" -Message "エラー内容"
```

### 生成するファイル
- `logs/error_notify.log`：エラー履歴
- `logs/ERROR_要確認.txt`：対処方法付きのフラグファイル（確認後削除）

---

## よくある実行エラー

### `Cannot find module 'google-auth-library'`
```
cd <PROJECT_DIR>
npm install
```

### `SyntaxError: Cannot use import statement`
Node.js のバージョンが古い。`node --version` で v18以上を確認する。

### `ECONNREFUSED` / `ETIMEDOUT`
ネットワーク接続の問題。30秒待ってリトライする。
