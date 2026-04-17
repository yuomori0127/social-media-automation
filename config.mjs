/**
 * 共通設定ファイル
 * 機密値は .env から読み込みます。.env.example を参考に .env を作成してください。
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env 読み込み
const envPath = path.join(__dirname, '.env');
try {
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    process.env[key] = val;
  }
} catch {
  // .env が存在しない場合は process.env をそのまま使用
}

function required(key) {
  const val = process.env[key];
  if (!val) throw new Error(`環境変数 ${key} が設定されていません。.env を確認してください。`);
  return val;
}

export const SPREADSHEET_ID  = required('SPREADSHEET_ID');
export const CLIENT_ID       = required('GOOGLE_CLIENT_ID');
export const CLIENT_SECRET   = required('GOOGLE_CLIENT_SECRET');
export const OPENAI_API_KEY  = required('OPENAI_API_KEY');

// トークンファイルのパス（プロジェクト直下の token.json）
export const TOKEN_PATH = path.join(__dirname, 'token.json');

// プロジェクトルート
export const PROJECT_ROOT = __dirname;
