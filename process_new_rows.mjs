import { readFile } from 'fs/promises';
import { OAuth2Client } from 'google-auth-library';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';


const tokens = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'));
const oauth2Client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
oauth2Client.setCredentials(tokens);
const { token } = await oauth2Client.getAccessToken();

async function writeRow(rowNum, noteTitle, xLongPost, noteOutline, noteFull, bannerPath = '', shortsScript = '', higgsfieldPrompts = '') {
  // F=noteタイトル, G=X長文ポスト, H=noteタイトル+見出し, I=note全文, J=バナー画像パス
  // K=Shortsスクリプト, L=Higgsfieldプロンプト, M=YouTubeステータス
  const range = `F${rowNum}:M${rowNum}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values: [[noteTitle, xLongPost, noteOutline, noteFull, bannerPath, shortsScript, higgsfieldPrompts, '未投稿']] }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

async function updateStatus(rowNum) {
  const range = `E${rowNum}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values: [['処理済']] }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

const rows = [43, 44, 45, 46, 47, 48];

for (const rowNum of rows) {
  console.log(`\n処理中: 行${rowNum}`);
  const content = JSON.parse(await readFile(new URL(`./row_content/row${rowNum}.json`, import.meta.url), 'utf-8'));
  await writeRow(rowNum, content.xPost, content.xThread, content.noteOutline, content.noteFull);
  await updateStatus(rowNum);
  console.log(`  ✅ 行${rowNum} 完了`);
}

console.log('\n🎉 全行処理完了！');
