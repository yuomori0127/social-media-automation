import { createReadStream, createWriteStream, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// .env 読み込み
const envPath = path.join(projectRoot, ".env");
const envContent = (await import("fs")).readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const SCRIPT_TEXT = `「慣らし保育がつらいとき、父親にできることって何？」
分離不安や慣らし保育の話は、なぜか「母と子」の話が中心になりがち。
でも、父親との愛着形成も子どもの発達に関わっているという研究がある。
母親との愛着が「安心して戻れる場所」として機能しやすいのに対し、父親との関係は「外の世界に向かう力」に関わりやすいという指摘がある。
帰宅後に思い切り遊ぶ、新しい場所に連れて行く——そういう関わりが、毎朝保育園に向かっていく足腰を作っているのかもしれない。
詳しくはnoteで。フォローで続報も届けます。`;

const videoPath = path.join(projectRoot, "public", "video.mp4");
const audioPath = path.join(projectRoot, "scripts", "audio.wav");
const outputPath = path.join(projectRoot, "scripts", "whisper_words_raw.json");

// 1. ffmpegで音声抽出
console.log("音声を抽出中...");
await new Promise((resolve, reject) => {
  const proc = spawn(ffmpegPath, [
    "-y",
    "-i", videoPath,
    "-vn",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    audioPath,
  ]);
  proc.stderr.on("data", (d) => process.stderr.write(d));
  proc.on("close", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`ffmpeg exited with code ${code}`));
  });
});
console.log("音声抽出完了:", audioPath);

// 2. Whisper API 呼び出し
console.log("Whisper APIを呼び出し中...");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transcription = await client.audio.transcriptions.create({
  file: createReadStream(audioPath),
  model: "whisper-1",
  response_format: "verbose_json",
  timestamp_granularities: ["word"],
  language: "ja",
  prompt: SCRIPT_TEXT,
});

await writeFile(outputPath, JSON.stringify(transcription, null, 2), "utf-8");
console.log("Whisper結果を保存しました:", outputPath);
console.log("単語数:", transcription.words?.length ?? 0);
