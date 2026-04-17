"""
テロップ生成パイプライン（バックアップ付き一括実行）

実行するたびに前回の成果物を sessions/YYYYMMDD_HHMMSS/ に退避してから
transcribe_words.py → script_align.py を順番に実行する。

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

BACKUP_TARGETS = [
    SCRIPTS_DIR / "script.txt",
    SCRIPTS_DIR / "keywords.txt",
    SCRIPTS_DIR / "whisper_words_raw.json",
    PROJECT_ROOT / "src" / "data" / "captions.ts",
]


def backup_previous_run() -> Path | None:
    existing = [p for p in BACKUP_TARGETS if p.exists()]
    if not existing:
        print("バックアップ対象ファイルが見つかりません。初回実行としてスキップします。")
        return None

    session_dir = SESSIONS_DIR / datetime.now().strftime("%Y%m%d_%H%M%S")
    session_dir.mkdir(parents=True, exist_ok=True)

    for src in existing:
        dst = session_dir / src.name
        shutil.copy2(src, dst)
        print(f"  バックアップ: {src.name} → sessions/{session_dir.name}/")

    print(f"バックアップ完了: {session_dir}")
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
        print(f"前回のデータ: {session_dir}")
    print("次のステップ: npx remotion studio でプレビューを確認してください。")


if __name__ == "__main__":
    main()
