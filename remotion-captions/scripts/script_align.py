"""
台本ベースのタイムスタンプアライメント → src/data/captions.ts 出力

アルゴリズム:
  1. Whisper単語を正規化文字ストリームに展開（文字ごとのタイムスタンプ）
  2. 各台本行の冒頭・中間・後半をWhisperテキストから順番に検索
     （前の行の終了位置より後ろだけを対象にする）
  3. 見つかった位置のタイムスタンプを開始時刻として使用
  4. Whisperに存在しない行（冒頭が多い）は 0ms を割り当てる

キーワードのハイライトは scripts/keywords.txt に記載（1行 = 1キーワード）。
"""
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Shorts幅（1080px × 0.86）÷ 日本語1文字幅（80px × 0.92）≒ 12.6
MAX_CHARS_PER_LINE = 13

def wrap_lines(lines: list[str]) -> list[str]:
    """長い行を MAX_CHARS_PER_LINE 以内に分割する。句読点の直後で優先的に区切る。"""
    result = []
    for line in lines:
        if len(line) <= MAX_CHARS_PER_LINE:
            result.append(line)
            continue
        BREAK_AFTER = set("。、！？…")
        current = ""
        for ch in line:
            current += ch
            if len(current) >= MAX_CHARS_PER_LINE:
                result.append(current)
                current = ""
            elif ch in BREAK_AFTER and len(current) >= 5:
                result.append(current)
                current = ""
        if current:
            result.append(current)
    return result


# --- 台本読み込み ---
script_path = SCRIPTS_DIR / "script.txt"
if not script_path.exists():
    print(f"Error: {script_path} が見つかりません", file=sys.stderr)
    sys.exit(1)
_raw_lines = [l for l in script_path.read_text(encoding="utf-8").splitlines() if l.strip()]
SCRIPT_LINES = wrap_lines(_raw_lines)
print(f"台本を読み込みました（{len(_raw_lines)}行 → 折り返し後 {len(SCRIPT_LINES)}行）")

# --- キーワード読み込み（任意） ---
keywords_path = SCRIPTS_DIR / "keywords.txt"
if keywords_path.exists():
    KEYWORDS = sorted(
        [l.strip() for l in keywords_path.read_text(encoding="utf-8").splitlines() if l.strip()],
        key=len, reverse=True,
    )
    print(f"キーワードを読み込みました（{len(KEYWORDS)}件）")
else:
    KEYWORDS = []
    print("keywords.txt が見つかりません。ハイライトなしで出力します。")

# --- 正規化（句読点・記号・空白を除去） ---
STRIP_PATTERN = re.compile(
    r'[。、！？・…×「」『』【】（）(),.!?\s\-\uff0d\u30fc——\u300c\u300d\u3010\u3011]'
)

def normalize(text: str) -> str:
    return STRIP_PATTERN.sub("", text)

def add_keyword_tags(text: str) -> str:
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


def build_whisper_char_stream(words: list) -> tuple:
    """Whisper単語リスト → [(start_time, char), ...] と正規化済み文字列"""
    chars = []
    for w in words:
        word_text = normalize(w["word"])
        if not word_text:
            continue
        start, end, n = w["start"], w["end"], len(word_text)
        for i, ch in enumerate(word_text):
            chars.append((start + (end - start) * i / n, ch))
    return chars, "".join(c for _, c in chars)


# 短い文字列は誤マッチが多いため、この長さ未満の検索は行わない
MIN_MATCH_LEN = 6


def search_line(norm_line: str, whisper_str: str, whisper_chars: list, from_pos: int):
    """
    norm_line の冒頭・1/4・1/2の3箇所からサブ文字列を取り出し、
    whisper_str の from_pos 以降で検索する。
    見つかれば (start_time, next_from_pos)、見つからなければ (None, from_pos) を返す。
    """
    n = len(norm_line)
    for offset in [0, n // 4, n // 2]:
        remaining = n - offset
        if remaining < MIN_MATCH_LEN:
            continue
        for length in range(min(12, remaining), MIN_MATCH_LEN - 1, -1):
            window = norm_line[offset:offset + length]
            idx = whisper_str.find(window, from_pos)
            if idx != -1:
                # マッチ位置から offset 文字前が行の推定開始位置（from_pos を下回らない）
                est_start_idx = max(from_pos, idx - offset)
                return whisper_chars[est_start_idx][0], idx + len(window)
    return None, from_pos


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

    whisper_chars, whisper_str = build_whisper_char_stream(words)
    print(f"Whisper文字数（正規化後）: {len(whisper_str)}")

    # --- 各台本行を順番に検索 ---
    search_pos = 0
    line_start_times: list = []

    for line in SCRIPT_LINES:
        norm = normalize(line)
        t, search_pos = search_line(norm, whisper_str, whisper_chars, search_pos)
        line_start_times.append(t)

    # --- Whisperに存在しない行を補間 ---
    # 冒頭のNone群: 0ms から最初に見つかった時刻まで等分
    # 中間のNone群: 前後の見つかった時刻の間を等分
    # 末尾のNone群: 最後に見つかった時刻から最終単語終了時刻まで等分
    last_ms = words[-1]["end"] * 1000
    n_lines = len(line_start_times)
    i = 0
    while i < n_lines:
        if line_start_times[i] is None:
            j = i
            while j < n_lines and line_start_times[j] is None:
                j += 1
            count = j - i
            left_t = (line_start_times[i - 1] * 1000) if i > 0 else 0.0
            right_t = (line_start_times[j] * 1000) if j < n_lines else last_ms
            if i == 0:
                # 冒頭: 0ms スタートで等分
                for k in range(count):
                    line_start_times[i + k] = right_t * k / count / 1000
            else:
                # 中間・末尾: 前後の間を等分
                for k in range(count):
                    line_start_times[i + k] = (left_t + (right_t - left_t) * (k + 1) / (count + 1)) / 1000
            i = j
        else:
            i += 1

    # --- キャプション生成 ---
    captions = []
    for i, (line, start_time) in enumerate(zip(SCRIPT_LINES, line_start_times)):
        end_time = line_start_times[i + 1] if i + 1 < len(line_start_times) else words[-1]["end"]
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
        status = "✓" if start_time > 0 else "⚠0ms推定"
        print(f"[{i+1}] {start_ms}ms - {end_ms}ms {status}: {line[:45]}")

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
