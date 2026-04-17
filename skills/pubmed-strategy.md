# PubMed 検索戦略ガイド

researcher エージェントが論文を検索するときに参照するスキルファイル。

---

## 基本クエリ構文

| 演算子 | 使い方 | 例 |
|--------|--------|-----|
| `AND` | 両方含む | `infant sleep AND intervention` |
| `OR` | どちらか含む | `toddler OR infant` |
| `NOT` | 除外 | `NOT preterm` |
| `"..."` | フレーズ完全一致 | `"night waking"` |
| `[tiab]` | タイトル・アブストラクトを検索 | `sleep[tiab]` |
| `[MeSH]` | 医学主題見出しで検索 | `"Infant Care"[MeSH]` |

### 年齢フィルター（必ず付ける）
```
"infant"[MeSH] OR "toddler"[MeSH]
```
または検索フィルターで「Infant: birth-23 months」「Child: 2-5 years」を指定。

### 期間フィルター（推奨）
直近5年の論文を優先する：
```
AND ("2020"[PDAT] : "3000"[PDAT])
```

---

## 1歳育児テーマ別クエリテンプレート

| テーマ | 推奨クエリ |
|--------|-----------|
| 夜泣き・睡眠 | `infant sleep behavioral intervention night waking 12 months RCT` |
| 離乳食・偏食 | `infant feeding picky eating food acceptance intervention 12 24 months` |
| 言葉の発達 | `infant language development vocabulary acquisition parent intervention` |
| イヤイヤ期 | `toddler tantrum self-regulation emotional development intervention` |
| 発達全般 | `infant development milestone intervention parent-child interaction` |
| 保育園慣らし | `infant childcare separation anxiety attachment secure base` |
| 転倒・安全 | `infant fall prevention home safety intervention` |
| スクリーンタイム | `infant toddler screen time cognitive development guidelines` |

---

## 論文の採用基準

以下をすべて満たす論文を優先する：

1. **研究デザイン**：RCT（ランダム化比較試験）、システマティックレビュー、コホート研究を優先。事例報告・意見論文は除く
2. **対象年齢**：0〜24ヶ月を中心とした研究。36ヶ月まで許容
3. **エビデンス抽出可能性**：数値（効果量、期間、頻度など）が本文またはアブストラクトに含まれる
4. **日本適用可能性**：欧米の研究でも日本の育児環境に置き換えられる内容か
5. **エンジニア向け**：数値・フロー・ステップで説明できる内容か

---

## 採用を避けるケース

- アブストラクトが空または極端に短い（100字未満）
- 製薬企業や特定製品と利益相反が明示されている
- テーマと関連性が薄い（キーワードは一致するが内容が違う）
- 日本語ネイティブには馴染みのない文化的背景が強すぎる

---

## PubMed URL 形式

取得した論文の URL は以下の形式で記録する：
```
https://pubmed.ncbi.nlm.nih.gov/{PMID}/
```
