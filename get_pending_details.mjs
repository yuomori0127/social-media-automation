import { OAuth2Client } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';


const tokens = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'));
const oauth2Client = new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
oauth2Client.setCredentials(tokens);
const { token } = await oauth2Client.getAccessToken();

const res = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A32:D37`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await res.json();
const rows = data.values || [];

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const rowNum = 32 + i;
  console.log(`\n=== Row ${rowNum} ===`);
  console.log(`Title: ${row[1] || ''}`);
  console.log(`URL: ${row[2] || ''}`);
  console.log(`Summary: ${row[3] || ''}`);
  console.log('---');
}
