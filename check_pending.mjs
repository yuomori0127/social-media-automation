import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';


const tokens = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'));
const oauth2Client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
oauth2Client.setCredentials(tokens);
const { token } = await oauth2Client.getAccessToken();

const res = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:E30`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await res.json();
data.values.forEach((row, i) => {
  const rowNum = i + 1;
  const status = row[4] || '';
  if (status === '未処理') {
    console.log(`\n=== Row ${rowNum} [${status}] ===`);
    console.log('Title:', row[1]);
    console.log('URL:', row[2]);
    console.log('Summary:', (row[3] || '').substring(0, 200));
  }
});
