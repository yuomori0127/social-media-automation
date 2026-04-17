import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';


// テーマ定義：CLI引数 --themes-file <path> で JSON ファイルから読み込み可能
// JSON形式: [{"label":"テーマ名","query":"PubMed search query"}, ...]
// 引数なし時はデフォルトテーマを使用
let THEMES;
const themesFileArg = process.argv.indexOf('--themes-file');
if (themesFileArg !== -1 && process.argv[themesFileArg + 1]) {
  const themesPath = process.argv[themesFileArg + 1];
  THEMES = JSON.parse(await readFile(themesPath, 'utf-8'));
  console.log(`📂 テーマファイル読み込み: ${themesPath} (${THEMES.length}件)`);
} else {
  // デフォルト（前回実行時のテーマ）
  THEMES = [
    {
      label: '1歳児のかんしゃく・自己調整と行動',
      query: '("infant"[MeSH] OR "toddler"[MeSH]) AND (temper tantrum[tiab] OR emotional regulation[tiab] OR self-regulation[tiab] OR behavior problems[tiab] OR toddler behavior[tiab] OR aggression[tiab]) AND ("2020"[PDAT] : "3000"[PDAT])',
    },
    {
      label: '1歳児の偏食・食の多様性と離乳食後期',
      query: '("infant"[MeSH] OR "toddler"[MeSH]) AND (food refusal[tiab] OR picky eating[tiab] OR food neophobia[tiab] OR dietary diversity[tiab] OR complementary feeding[tiab] OR feeding problems[tiab]) AND ("2020"[PDAT] : "3000"[PDAT])',
    },
    {
      label: '1歳前後の予防接種・感染症対策',
      query: '("infant"[MeSH] OR "toddler"[MeSH]) AND (vaccination[tiab] OR immunization[tiab] OR vaccine hesitancy[tiab] OR respiratory infection[tiab] OR childhood infection[tiab] OR daycare infection[tiab]) AND ("2020"[PDAT] : "3000"[PDAT])',
    },
  ];
  console.log('ℹ️  デフォルトテーマを使用（--themes-file で上書き可能）');
}

const RESULTS_PER_THEME = 2;

// PubMed E-utilities で論文IDを検索
async function searchPubMed(query, maxResults = RESULTS_PER_THEME) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json&sort=relevance`;
  const res = await fetch(url);
  const data = await res.json();
  return data.esearchresult.idlist;
}

// 論文詳細（タイトル・アブストラクト）を取得
async function fetchPubMedDetails(ids) {
  if (ids.length === 0) return [];
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
  const res = await fetch(url);
  const data = await res.json();
  return ids.map(id => {
    const item = data.result[id];
    return {
      pmid: id,
      title: item.title,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    };
  });
}

// アブストラクトを取得して要約を生成（簡易版）
async function fetchAbstract(pmid) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=text&rettype=abstract`;
  const res = await fetch(url);
  const text = await res.text();
  // アブストラクト部分を抜き出す（簡易）
  const match = text.match(/AB\s+-\s+([\s\S]+?)(?=\n[A-Z]{2}\s+-|\n\n|$)/);
  return match ? match[1].replace(/\n\s+/g, ' ').trim() : '';
}

// 1歳育児パパ向けの日本語要約を生成（テーマ別）
function generateSummary(theme, title, abstract) {
  const intro = `【テーマ: ${theme}】\n\n`;
  const titleNote = `論文タイトル：${title}\n\n`;

  if (abstract.length > 100) {
    const shortAbstract = abstract.substring(0, 300) + '...';
    return `${intro}${titleNote}【アブストラクト概要】\n${shortAbstract}\n\n【1歳児を持つ親へのアドバイス】\nこの研究は「${theme}」に悩む1歳前後の子を持つ親に有益な情報を提供します。日本の住宅環境・育児環境に合わせて参考にしてください。`;
  }
  return `${intro}${titleNote}【1歳児を持つ親へのアドバイス】\nこの研究は「${theme}」に関する最新のエビデンスを提供します。具体的な悩みを専門家に共有し、個別のアドバイスを得ることをお勧めします。`;
}

// 現在の行数を取得（追記位置を決める）
async function getCurrentRowCount(token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A:A`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.values ? data.values.length : 1;
}

// スプレッドシートに行を追記
async function appendRows(token, rows) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: 'A1',
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );
  return await res.json();
}

// メイン処理
const tokens = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'));
const oauth2Client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
oauth2Client.setCredentials(tokens);
const { token } = await oauth2Client.getAccessToken();

const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
const allRows = [];

for (const theme of THEMES) {
  console.log(`\n🔍 テーマ「${theme.label}」を検索中...`);

  const ids = await searchPubMed(theme.query);
  console.log(`  → ${ids.length}件のPMID取得: ${ids.join(', ')}`);

  const papers = await fetchPubMedDetails(ids);

  for (const paper of papers) {
    console.log(`  📄 ${paper.title.substring(0, 60)}...`);
    const abstract = await fetchAbstract(paper.pmid);
    const summary = generateSummary(theme.label, paper.title, abstract);
    allRows.push([now, paper.title, paper.url, summary, '未処理']);

    // PubMed API レート制限対策
    await new Promise(r => setTimeout(r, 400));
  }
}

console.log(`\n📊 スプレッドシートに ${allRows.length} 行を追記します...`);
const result = await appendRows(token, allRows);
console.log('✅ 完了:', JSON.stringify(result.updates || result, null, 2));
console.log(`\n追記されたデータ:`);
allRows.forEach((row, i) => {
  console.log(`  [${i + 1}] ${row[0]} | ${row[1].substring(0, 50)}... | ${row[4]}`);
});
