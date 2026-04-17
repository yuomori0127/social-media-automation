"""
generate_banner.py
==================
noteバナー生成スクリプト（1280×670px）
白背景・黒テキスト・中央寄せのシンプルデザイン

使い方:
  python generate_banner.py --title "タイトル"

パイプラインからの呼び出し例:
  python generate_banner.py --title "野菜を口から出すのは食感が原因だった" --output "./images/banners/20260324_row52.png"
"""

import argparse
import re
from pathlib import Path
from datetime import datetime

from PIL import Image, ImageDraw, ImageFont

# ─────────────────────────────────────────────────────────────────────────────
# 定数
# ─────────────────────────────────────────────────────────────────────────────
W, H        = 1280, 670
FONT_JP     = "C:/Windows/Fonts/NotoSansJP-VF.ttf"
BG_COLOR    = (255, 255, 255)          # 白背景
TEXT_COLOR  = (30, 30, 30)             # ほぼ黒
MARGIN_X    = 120                      # 左右マージン
LINE_SPACING_RATIO = 0.38              # フォントサイズに対する行間の比率


def wrap_text(text: str, font: ImageFont.FreeTypeFont,
              draw: ImageDraw.ImageDraw, max_width: int) -> list[str]:
    """max_width に収まるように1文字ずつ折り返す。"""
    lines, current = [], ""
    for ch in text:
        test = current + ch
        w = draw.textlength(test, font=font)
        if w > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = test
    if current:
        lines.append(current)
    return lines


def generate_banner(title: str, category: str | None = None,
                    output_path: str | None = None) -> str:
    """
    バナーを生成して output_path に保存する。
    output_path が None の場合は ./images/banners/<日付>_<スラグ>.png に保存する。
    生成したファイルパスを返す。
    """
    # ── ASCII数字・記号を全角に変換（フォント豆腐対策） ──────────────────────
    TO_FULLWIDTH = str.maketrans(
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "０１２３４５６７８９ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ"
        "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ",
    )
    title = title.translate(TO_FULLWIDTH)

    # ── 出力パス決定 ────────────────────────────────────────────────────────
    if output_path is None:
        slug = re.sub(r"[^\w\u3000-\u9fff]", "_", title)[:30]
        date = datetime.now().strftime("%Y%m%d")
        out_dir = Path(__file__).parent / "images" / "banners"
        out_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(out_dir / f"{date}_{slug}.png")
    else:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # ── キャンバス（白背景） ─────────────────────────────────────────────────
    img  = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # ── フォントサイズを文字数で自動調整 ────────────────────────────────────
    title_len = len(title)
    if title_len <= 14:
        title_size = 96
    elif title_len <= 20:
        title_size = 82
    elif title_len <= 28:
        title_size = 70
    elif title_len <= 36:
        title_size = 62
    else:
        title_size = 54

    f_title = ImageFont.truetype(FONT_JP, title_size)

    # ── テキスト折り返し ────────────────────────────────────────────────────
    max_text_w = W - MARGIN_X * 2
    lines      = wrap_text(title, f_title, draw, max_text_w)

    # ── 縦中央揃え ──────────────────────────────────────────────────────────
    line_h  = int(title_size * (1 + LINE_SPACING_RATIO))
    total_h = title_size + line_h * (len(lines) - 1)   # 最終行は行間不要
    start_y = (H - total_h) // 2

    # ── 各行を水平中央揃えで描画 ────────────────────────────────────────────
    for i, line in enumerate(lines):
        line_w = draw.textlength(line, font=f_title)
        x = (W - line_w) // 2
        y = start_y + i * line_h
        draw.text((x, y), line, font=f_title, fill=TEXT_COLOR)

    # ── 保存 ────────────────────────────────────────────────────────────────
    img.save(output_path, dpi=(150, 150))
    return output_path


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="noteバナー生成（1280×670px）")
    parser.add_argument("--title",    required=True, help="記事タイトル")
    parser.add_argument("--category", default=None,  help="未使用（互換性維持のため残存）")
    parser.add_argument("--output",   default=None,  help="出力ファイルパス（省略時は自動）")
    args = parser.parse_args()

    saved = generate_banner(args.title, args.category, args.output)
    print(f"BANNER_PATH: {saved}")
