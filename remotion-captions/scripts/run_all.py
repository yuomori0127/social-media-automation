"""
テロップ生成パイプライン（バックアップ付き一括実行）

【使い方】
  1. input/video.mp4   に素材動画を置く
  2. input/script.txt  に台本テキストを置く
  3. python scripts/run_all.py を実行する

実行するたびに前回の成果物を sessions/YYYYMMDD_HHMMSS/ に退避してから
transcribe_words.py → script_align.py を順番に実行する。

Usage:
    python scripts/run_all.py
"""
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
SESSIONS_DIR = PROJECT_ROOT / "sessions"
INPUT_DIR = PROJECT_ROOT / "input"

# 単体ファイルのバックアップ対象
BACKUP_FILES = [
    PROJECT_ROOT / "public" / "video.mp4",
    SCRIPTS_DIR / "audio.wav",
    SCRIPTS_DIR / "script.txt",
    SCRIPTS_DIR / "keywords.txt",
    SCRIPTS_DIR / "whisper_words_raw.json",
    PROJECT_ROOT / "src" / "data" / "captions.ts",
]

# フォルダごとバックアップする対象（中身が存在する場合のみ）
BACKUP_DIRS = [
    PROJECT_ROOT / "output",
]


def backup_previous_run() -> Path | None:
    existing_files = [p for p in BACKUP_FILES if p.exists()]
    existing_dirs = [p for p in BACKUP_DIRS if p.exists() and any(p.iterdir())]

    if not existing_files and not existing_dirs:
        print("バックアップ対象ファイルが見つかりません。初回実行としてスキップします。")
        return None

    session_dir = SESSIONS_DIR / datetime.now().strftime("%Y%m%d_%H%M%S")
    session_dir.mkdir(parents=True, exist_ok=True)

    for src in existing_files:
        dst = session_dir / src.name
        shutil.copy2(src, dst)
        size_mb = src.stat().st_size / 1024 / 1024
        print(f"  バックアップ: {src.name} ({size_mb:.1f}MB) → sessions/{session_dir.name}/")

    for src_dir in existing_dirs:
        dst_dir = session_dir / src_dir.name
        shutil.copytree(src_dir, dst_dir)
        print(f"  バックアップ: {src_dir.name}/ → sessions/{session_dir.name}/{src_dir.name}/")

    print(f"バックアップ完了: sessions/{session_dir.name}/")
    return session_dir


def copy_inputs() -> None:
    """input/ の素材を各処理スクリプトが期待する場所にコピーする。"""
    mapping = {
        INPUT_DIR / "video.mp4":   PROJECT_ROOT / "public" / "video.mp4",
        INPUT_DIR / "script.txt":  SCRIPTS_DIR / "script.txt",
    }
    for src, dst in mapping.items():
        if not src.exists():
            print(f"  警告: {src.relative_to(PROJECT_ROOT)} が見つかりません。スキップします。")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        size_mb = src.stat().st_size / 1024 / 1024
        print(f"  コピー: {src.relative_to(PROJECT_ROOT)} → {dst.relative_to(PROJECT_ROOT)} ({size_mb:.1f}MB)")


def load_openai_client():
    """環境変数を読み込んで OpenAI クライアントを返す。キーがなければ None。"""
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None
    import openai
    return openai.OpenAI(api_key=api_key)


def _merge_broken_katakana(lines: list[str]) -> list[str]:
    """次の行が長音符「ー」で始まる場合のみ前行に結合する。"""
    result = []
    for line in lines:
        if result and line.startswith('\u30FC'):  # ー（長音符）
            result[-1] = result[-1] + line
        else:
            result.append(line)
    return result


def segment_script() -> None:
    """input/script.txt をGPTで意味の切れ目に分割し scripts/script.txt に書き込む。"""
    script_path = SCRIPTS_DIR / "script.txt"
    if not script_path.exists():
        print("  script.txt が見つかりません。スキップします。")
        return

    client = load_openai_client()
    if client is None:
        print("  OPENAI_API_KEY が見つかりません。セグメント分割をスキップします。")
        return

    raw = script_path.read_text(encoding="utf-8").strip()
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "YouTube Shorts用の字幕テキストを、画面に表示するテロップ単位に分割してください。\n"
                        "ルール:\n"
                        "- 1単位あたり15〜22文字を目安にする（2行で表示されることがある）\n"
                        "- 必ず文節・意味の切れ目で区切る。複合語・カタカナ語の途中で切らない\n"
                        "- 句点（。）や読点（、）の直後を優先的な区切り位置にする\n"
                        "- 文字数より自然な切り目を優先する\n"
                        "- 空行を入れない。1単位ずつ出力する\n"
                        "- テキストの内容を一切変えない。分割のみ行う"
                    ),
                },
                {"role": "user", "content": raw},
            ],
            temperature=0.2,
        )
        lines = [l for l in resp.choices[0].message.content.splitlines() if l.strip()]
        lines = _merge_broken_katakana(lines)
        script_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"  script.txt を再分割しました（{len(raw.splitlines())}行 → {len(lines)}行）")
    except Exception as e:
        print(f"  スクリプト分割に失敗しました（{e}）。元のまま続行します。")


def generate_keywords() -> None:
    """script.txt を読んで OpenAI でキーワードを自動生成し keywords.txt に保存する。"""
    script_path = SCRIPTS_DIR / "script.txt"
    keywords_path = SCRIPTS_DIR / "keywords.txt"

    if not script_path.exists():
        print("  script.txt が見つかりません。スキップします。")
        return

    client = load_openai_client()
    if client is None:
        print("  OPENAI_API_KEY が見つかりません。keywords.txt の自動生成をスキップします。")
        return

    try:
        script_text = script_path.read_text(encoding="utf-8").strip()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "以下のYouTube Shorts用字幕スクリプトから、視聴者の目を引くために"
                        "黄色くハイライトすべきキーワードを5〜10個抽出してください。"
                        "数字・専門用語・感情的なフレーズを優先してください。"
                        "1行に1キーワードだけ、キーワードのみを返してください。説明不要。"
                    ),
                },
                {"role": "user", "content": script_text},
            ],
            temperature=0.3,
        )
        keywords = [
            l.strip().lstrip("-・・ ").strip()
            for l in resp.choices[0].message.content.splitlines()
            if l.strip()
        ]
        keywords_path.write_text("\n".join(keywords) + "\n", encoding="utf-8")
        print(f"  keywords.txt を自動生成しました（{len(keywords)}件）: {', '.join(keywords)}")
    except Exception as e:
        print(f"  キーワード自動生成に失敗しました（{e}）。keywords.txt なしで続行します。")
        keywords_path.unlink(missing_ok=True)


def run_script(script_name: str) -> None:
    script_path = SCRIPTS_DIR / script_name
    print(f"\n{'='*50}")
    print(f"実行: {script_name}")
    print(f"{'='*50}")
    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        print(f"\nエラー: {script_name} が失敗しました（終了コード {result.returncode}）", file=sys.stderr)
        sys.exit(result.returncode)


def main():
    print("=== テロップ生成パイプライン開始 ===\n")

    print("【Step 0】前回の成果物をバックアップ中...")
    session_dir = backup_previous_run()

    print(f"\n{'='*50}")
    print("【Step 0.5】input/ から素材をコピー中...")
    copy_inputs()

    print(f"\n{'='*50}")
    print("【Step 0.7】スクリプトを字幕行に分割中...")
    segment_script()

    run_script("transcribe_words.py")

    print(f"\n{'='*50}")
    print("【Step 1.5】キーワード自動生成中...")
    generate_keywords()

    run_script("script_align.py")

    print(f"\n{'='*50}")
    print("=== 完了 ===")
    if session_dir:
        print(f"前回のデータ: sessions/{session_dir.name}/")
    print("次のステップ: npx remotion studio でプレビューを確認してください。")


if __name__ == "__main__":
    main()
