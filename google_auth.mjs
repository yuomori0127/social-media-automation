/**
 * OAuth2 認証スクリプト
 * ブラウザでGoogleにログインし、token.jsonを生成します
 */
import { OAuth2Client } from 'google-auth-library';
import { writeFile } from 'fs/promises';
import { createServer } from 'http';
import { URL } from 'url';
import { exec } from 'child_process';
import { CLIENT_ID, CLIENT_SECRET, TOKEN_PATH, SPREADSHEET_ID } from './config.mjs';

const REDIRECT_URI = 'http://localhost:3000/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

const oauth2Client = new OAuth2Client({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('ブラウザで認証を開始します...');

// Open browser
const openCmd = process.platform === 'win32' ? `start "" "${authUrl}"` : `open "${authUrl}"`;
exec(openCmd);

// Local server to capture redirect
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3000');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('認証コードが見つかりません');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('✅ 認証成功！トークンを保存しました:', TOKEN_PATH);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>✅ 認証成功！このタブを閉じてください。</h1>');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ トークン取得失敗:', err.message);
    res.writeHead(500);
    res.end('認証失敗: ' + err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(3000, () => {
  console.log('認証待機中... ブラウザでGoogleアカウントを選択してください');
  console.log('（ブラウザが開かない場合は以下のURLにアクセスしてください）');
  console.log(authUrl);
});
