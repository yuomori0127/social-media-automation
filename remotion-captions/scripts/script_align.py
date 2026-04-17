"""
台本ベースのタイムスタンプアライメント → src/data/captions.ts 出力
台本は scripts/script.txt から読み込みます（1行 = テロップ1枚）。

キーワードのハイライトは scripts/keywords.txt に記載します（1行 = 1キーワード）。
keywords.txt が存在しない場合はハイライトなしで出力します。
"""
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"

# --- 台本読み込み ---
script_path = SCRIPTS_DIR / "script.txt"
if not script_path.exists():
    print(f"Error: {script_path} が見つかりません", file=sys.stderr)
    sys.exit(1)
SCRIPT_LINES = [
    line for line in script_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
]
print(f"台本を読み込みました（{len(SCRIPT_LINES)}行）")

# --- キーワード読み込み（任意） ---
keywords_path = SCRIPTS_DIR / "keywords.txt"
if keywords_path.exists():
    KEYWORDS = [
        line.strip() for line in keywords_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    # 長い順にソート（二重タグ防止）
    KEYWORDS = sorted(KEYWORDS, key=len, reverse=True)
    print(f"キーワードを読み込みました（{len(KEYWORDS)}件）")
else:
    KEYWORDS = []
    print("keywords.txt が見つかりません。ハイライトなしで出力します。")

# --- 正規化 ---
STRIP_PATTERN = re.compile(r'[。、！？・…×「」『』【】（）,.!?\s\-\uff0d\u30fc——]')

def normalize(text: str) -> str:
    return STRIP_PATTERN.sub("", text)

def add_keyword_tags(text: str) -> str:
    """キーワードに <b> タグ付け（長い順・二重タグ防止）"""
    if not KEYWORDS:
        return text
    result = text
    placeholders = {}
    for i, kw in enumerate(KEYWORDS):
        placeholder = f"\x00KW{i}\x00"
        placeholders[placeholder] = f"<b>{kw}</b>"
        result = result.replace(kw, placeholder)
    for ph, tagged in placeholders.items():
        result = result.replace(ph, tagged)
    return result

def main():
    raw_path = SCRIPTS_DIR / "whisper_words_raw.json"
    if not raw_path.exists():
        print(f"Error: {raw_path} が見つかりません。先に transcribe_words.py を実行してください。", file=sys.stderr)
        sys.exit(1)

    with open(raw_path, encoding="utf-8") as f:
        data = json.load(f)

    words = data.get("words", [])
    if not words:
        print("Error: words が空です", file=sys.stderr)
        sys.exit(1)

    # --- 正規化文字ストリーム構築 ---
    whisper_chars = []
    for w in words:
        word_text = normalize(w["word"])
        if not word_text:
            continue
        start, end, n = w["start"], w["end"], len(word_text)
        for i, ch in enumerate(word_text):
            whisper_chars.append((start + (end - start) * i / n, ch))

    total_whisper_norm_len = len(whisper_chars)

    # --- 台本の正規化と先頭位置計算 ---
    script_norm_lines = [normalize(line) for line in SCRIPT_LINES]
    total_script_norm_len = len("".join(script_norm_lines))

    line_start_positions = []
    pos = 0
    for norm_line in script_norm_lines:
        line_start_positions.append(pos)
        pos += len(norm_line)

    def script_pos_to_time(char_pos: int) -> float:
        if total_script_norm_len == 0:
            return 0.0
        idx = round(char_pos / total_script_norm_len * total_whisper_norm_len)
        idx = max(0, min(idx, total_whisper_norm_len - 1))
        return whisper_chars[idx][0]

    # --- アライメント実行 ---
    captions = []
    for i, (line, line_pos) in enumerate(zip(SCRIPT_LINES, line_start_positions)):
        start_time = script_pos_to_time(line_pos)
        end_time = (
            script_pos_to_time(line_start_positions[i + 1])
            if i + 1 < len(SCRIPT_LINES)
            else words[-1]["end"]
        )
        start_ms = round(start_time * 1000)
        end_ms = round(end_time * 1000)
        tagged_text = add_keyword_tags(line)
        captions.append({
            "text": tagged_text,
            "startMs": start_ms,
            "endMs": end_ms,
            "timestampMs": start_ms,
            "confidence": 1,
        })
        print(f"[{i+1}] {start_ms}ms - {end_ms}ms: {line[:40]}")

    # --- captions.ts 出力 ---
    out_path = PROJECT_ROOT / "src" / "data" / "captions.ts"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    ts_lines = [
        'import type { Caption } from "@remotion/captions";',
        "",
        "export const CAPTIONS: Caption[] = [",
    ]
    for cap in captions:
        ts_lines += [
            "  {",
            f'    text: {json.dumps(cap["text"], ensure_ascii=False)},',
            f'    startMs: {cap["startMs"]},',
            f'    endMs: {cap["endMs"]},',
            f'    timestampMs: {cap["timestampMs"]},',
            f'    confidence: {cap["confidence"]},',
            "  },",
        ]
    ts_lines += ["];", ""]

    out_path.write_text("\n".join(ts_lines), encoding="utf-8")
    print(f"\ncaptions.ts を出力しました: {out_path}")

if __name__ == "__main__":
    main()
