import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';


const tokens = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'));
const oauth2Client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
oauth2Client.setCredentials(tokens);
const { token } = await oauth2Client.getAccessToken();

const res = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:Z200`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await res.json();

const rows = data.values || [];
const unprocessed = [];

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const status = row[4]; // E column (index 4)
  const title = row[1] || '';
  if ((status === '未処理' || (!status && title)) && title) {
    const summary = (row[3] || '').substring(0, 200);
    unprocessed.push({ rowNum: i + 1, title, summary });
  }
}

console.log(`未処理行数: ${unprocessed.length}件`);
console.log('行一覧:');
unprocessed.forEach(r => {
  console.log(`- 行番号: ${r.rowNum}, タイトル: "${r.title}", 要約(D列): "${r.summary}"`);
});
