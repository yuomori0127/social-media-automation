"""
テロップ動画をレンダリングして out/YYYYMMDD.mp4 に保存する。

Usage:
    python render.py
"""
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
OUT_DIR = PROJECT_ROOT / "out"
OUT_DIR.mkdir(exist_ok=True)

output = OUT_DIR / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"

print(f"レンダリング開始 → {output}")
result = subprocess.run(
    ["npx", "remotion", "render", "CaptionVideo", str(output)],
    cwd=PROJECT_ROOT,
    shell=True,
)
sys.exit(result.returncode)
