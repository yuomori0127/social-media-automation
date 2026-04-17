import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';


const tokens = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'));
const oauth2Client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
oauth2Client.setCredentials(tokens);
const { token } = await oauth2Client.getAccessToken();

const xPost = `「育児の悩みは一人で抱えないで」ノルウェーの論文が証明。
保健センターで専門家に"具体的に"相談した親ほど育児ストレスが減ることが明らかに。
「食事どう？」じゃなく「豆腐しか食べない」のように詳しく話すのがコツ。
1歳3ヶ月の子を持つ親御さん、次の健診で試してみて。`;

const xThread = `【1/5】
育児の悩みを「なんとなく」しか話せていない親御さん、多いと思います。

「ちゃんと食べてるか不安で…」
「寝つきが悪くて…」

でも実は、その"なんとなく"が問題解決を遅らせているかもしれません。

ノルウェーの研究が、親の相談スタイルと育児サポートの関係を明らかにしました🧵

【2/5】
📄 Navigating parenthood（ノルウェー乳幼児健診・質的研究）

保健センターを利用した親たちへの調査でわかったこと：

✅ 具体的な悩みを話した親ほど有効なサポートを受けられた
✅「どんな場面で困るか」まで話すと専門家のアドバイスの質が上がる
✅ 漠然とした相談は、漠然としたアドバイスしか返ってこない

相談は"質"が命。

【3/5】
2024年12月生まれ = 今ちょうど1歳3ヶ月。

この時期の親がよく悩むこと：
・好き嫌いが出てきた（偏食）
・夜泣き・寝ぐずり
・言葉が遅い気がする
・転びすぎ？歩き方が心配

どれも「なんとなく不安」で終わりがち。
でも"具体的に"言語化するだけで、保健師さんのアドバイスが変わります。

【4/5】
今日からできる「相談の質を上げる3ステップ」

1️⃣ いつ起きるか
→「夜10〜12時の間に泣く」

2️⃣ どのくらいか
→「週4〜5回、30分以上続く」

3️⃣ 何を試したか
→「授乳も抱っこも効かない」

この3点を伝えるだけで、保健師・小児科医の対応が変わります。

【5/5】
「専門家に相談するほど育児は楽になる」

でも相談の仕方を知らないと、その恩恵は半減します。

次の健診・育児相談の前に、気になることを3行メモするだけでOK。

論文が証明した最強の育児ハックは
「具体的に話すこと」でした。`;

const noteOutline = `【タイトル案】
ノルウェーの論文が証明。1歳児の育児が楽になる「相談の仕方」とは

【見出し構成】
1. はじめに ― 育児の悩みを「うまく相談できていない」親が多い理由
2. 論文紹介 ― ノルウェーの研究が明らかにした「相談の質」と育児サポートの関係
3. 1歳3ヶ月の子を持つ親が今抱えがちな悩みトップ5
4. 具体的な相談ができると何が変わるのか
5. 今日からできる「相談の質を上げる3ステップ」
6. まとめ ― 最強の育児ハックは「言語化する習慣」`;

// F2:M2 に書き込み（2行目 = 最初のデータ行）
// F=noteタイトル, G=X長文ポスト, H=noteタイトル+見出し, I=note全文, J=バナー画像パス
// K=Shortsスクリプト, L=Higgsfieldプロンプト, M=YouTubeステータス
const writeRes = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/F2:M2?valueInputOption=RAW`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: 'F2:M2',
      majorDimension: 'ROWS',
      values: [[xPost, xThread, noteOutline, '', '', '', '', '未投稿']],  // ← サンプル。実際は [noteTitle, xLongPost, noteOutline, noteFull, bannerPath, shortsScript, higgsfieldPrompts, youtubeStatus]
    }),
  }
);
const writeData = await writeRes.json();
console.log('書き込み結果:', JSON.stringify(writeData, null, 2));

// E2 のステータスを「処理済」に更新
const statusRes = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/E2?valueInputOption=RAW`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: 'E2',
      majorDimension: 'ROWS',
      values: [['処理済']],
    }),
  }
);
const statusData = await statusRes.json();
console.log('ステータス更新結果:', JSON.stringify(statusData, null, 2));
