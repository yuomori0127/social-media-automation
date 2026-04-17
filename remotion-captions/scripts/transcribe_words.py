"""
Whisper word-level transcription using Python OpenAI client.
台本は scripts/script.txt から読み込みます（1行 = テロップ1枚）。
"""
import json
import os
import sys
import subprocess
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

# .env 読み込み
env_path = PROJECT_ROOT / ".env"
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

# 台本読み込み（script.txt）
script_path = PROJECT_ROOT / "scripts" / "script.txt"
if not script_path.exists():
    print(f"Error: {script_path} が見つかりません", file=sys.stderr)
    sys.exit(1)
SCRIPT_TEXT = script_path.read_text(encoding="utf-8").strip()
print(f"台本を読み込みました（{len(SCRIPT_TEXT.splitlines())}行）")

video_path = PROJECT_ROOT / "public" / "video.mp4"
audio_path = PROJECT_ROOT / "scripts" / "audio.wav"
output_path = PROJECT_ROOT / "scripts" / "whisper_words_raw.json"

# 1. ffmpeg で音声抽出
ffmpeg_bin = shutil.which("ffmpeg")
if not ffmpeg_bin:
    ffmpeg_static = PROJECT_ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"
    if ffmpeg_static.exists():
        ffmpeg_bin = str(ffmpeg_static)
    else:
        print("Error: ffmpeg が見つかりません", file=sys.stderr)
        sys.exit(1)

print(f"音声を抽出中...")
result = subprocess.run([
    ffmpeg_bin, "-y",
    "-i", str(video_path),
    "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
    str(audio_path),
], capture_output=True)
if result.returncode != 0:
    print(result.stderr.decode("utf-8", errors="replace"), file=sys.stderr)
    sys.exit(1)
print(f"音声抽出完了: {audio_path}")

# 2. Whisper API
import openai
client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

print("Whisper APIを呼び出し中...")
with open(audio_path, "rb") as f:
    transcription = client.audio.transcriptions.create(
        file=("audio.wav", f, "audio/wav"),
        model="whisper-1",
        response_format="verbose_json",
        timestamp_granularities=["word"],
        language="ja",
        prompt=SCRIPT_TEXT,
    )

data = transcription.model_dump()
output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Whisper結果を保存しました: {output_path}")
print(f"単語数: {len(data.get('words', []))}")
