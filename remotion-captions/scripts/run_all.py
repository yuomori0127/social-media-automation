"""
テロップ生成パイプライン（バックアップ付き一括実行）

実行するたびに前回の成果物を sessions/YYYYMMDD_HHMMSS/ に退避してから
transcribe_words.py → script_align.py を順番に実行する。

バックアップ対象:
  public/video.mp4                ← 素材動画
  scripts/audio.wav               ← 抽出済み音声
  scripts/script.txt              ← 台本
  scripts/keywords.txt            ← ハイライトキーワード
  scripts/whisper_words_raw.json  ← Whisper生データ
  src/data/captions.ts            ← 生成済みキャプション
  output/                         ← レンダリング済みMP4（あれば）

Usage:
    python scripts/run_all.py
"""
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
SESSIONS_DIR = PROJECT_ROOT / "sessions"

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

    run_script("transcribe_words.py")
    run_script("script_align.py")

    print(f"\n{'='*50}")
    print("=== 完了 ===")
    if session_dir:
        print(f"前回のデータ: sessions/{session_dir.name}/")
    print("次のステップ: npx remotion studio でプレビューを確認してください。")


if __name__ == "__main__":
    main()
