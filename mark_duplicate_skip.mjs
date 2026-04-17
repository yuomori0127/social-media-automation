import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';


const tokens = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'));
const oauth2Client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
oauth2Client.setCredentials(tokens);
const { token } = await oauth2Client.getAccessToken();

// batchUpdate で行71〜74のE列を一括更新
// スプレッドシートの行番号はヘッダー行=1なので、行71は実際の71行目
const body = {
  valueInputOption: 'RAW',
  data: [
    { range: 'E71', majorDimension: 'ROWS', values: [['処理済（重複スキップ）']] },
    { range: 'E72', majorDimension: 'ROWS', values: [['処理済（重複スキップ）']] },
    { range: 'E73', majorDimension: 'ROWS', values: [['処理済（重複スキップ）']] },
    { range: 'E74', majorDimension: 'ROWS', values: [['処理済（重複スキップ）']] },
  ],
};

const res = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
);

const data = await res.json();

if (data.error) {
  console.error('ERROR:', JSON.stringify(data.error, null, 2));
  process.exit(1);
}

console.log('batchUpdate成功');
console.log('更新セル数:', data.totalUpdatedCells);
console.log('更新行数:', data.totalUpdatedRows);
console.log('詳細:', JSON.stringify(data.responses, null, 2));
