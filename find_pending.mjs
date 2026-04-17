import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';


const tokens = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'));
const oauth2Client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
oauth2Client.setCredentials(tokens);
const { token } = await oauth2Client.getAccessToken();

const res = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:E50`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await res.json();
const rows = data.values || [];

console.log(`Total rows: ${rows.length}`);
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const status = row[4] || '';
  if (status === '未処理') {
    const rowNum = i + 1;
    const title = (row[1] || '').substring(0, 80);
    const summary = (row[3] || '').substring(0, 100);
    console.log(`\nRow ${rowNum} [未処理]`);
    console.log(`  Title: ${title}`);
    console.log(`  Summary: ${summary}`);
  }
}
