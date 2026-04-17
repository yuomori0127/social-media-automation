#!/usr/bin/env python3
"""
process_batch.py - Processes content_batch.json:
1. Generates banners via generate_banner.py
2. Writes F-J columns to Google Sheets
3. Sets E column to "処理済"
"""

import json
import subprocess
import sys
import os
import time
import urllib.request
import urllib.parse
import urllib.error

# ── Config ──────────────────────────────────────────────────────────────────
from pathlib import Path
BASE_DIR = Path(__file__).parent

# .env 読み込み
_env_path = BASE_DIR / ".env"
if _env_path.exists():
    with open(_env_path, encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ[_k.strip()] = _v.strip()

def _required(key):
    val = os.environ.get(key)
    if not val:
        raise ValueError(f"環境変数 {key} が設定されていません。.env を確認してください。")
    return val

BATCH_JSON    = str(BASE_DIR / "content_batch.json")
TOKEN_PATH    = str(BASE_DIR / "token.json")
SPREADSHEET_ID = _required("SPREADSHEET_ID")
CLIENT_ID      = _required("GOOGLE_CLIENT_ID")
CLIENT_SECRET  = _required("GOOGLE_CLIENT_SECRET")
DATE_STR = "20260410"
TOKEN_URL = "https://oauth2.googleapis.com/token"
MAX_RETRIES = 3

# ── OAuth Token Refresh ──────────────────────────────────────────────────────
def get_access_token():
    with open(TOKEN_PATH, "r", encoding="utf-8") as f:
        token_data = json.load(f)

    refresh_token = token_data.get("refresh_token")
    if not refresh_token:
        raise ValueError("No refresh_token found in token file")

    body = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }).encode("utf-8")

    req = urllib.request.Request(TOKEN_URL, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode("utf-8"))

    access_token = result.get("access_token")
    if not access_token:
        raise ValueError(f"Failed to get access_token: {result}")

    # Update token file with new access token
    token_data["access_token"] = access_token
    if "expiry_date" in result:
        token_data["expiry_date"] = result["expiry_date"]
    with open(TOKEN_PATH, "w", encoding="utf-8") as f:
        json.dump(token_data, f, indent=2)

    print(f"[AUTH] Got fresh access token (length={len(access_token)})")
    return access_token

# ── Sheets API Write ─────────────────────────────────────────────────────────
def sheets_put(access_token, range_notation, values):
    """PUT a single range to Google Sheets."""
    sheet_name_encoded = "%E3%82%B7%E3%83%BC%E3%83%881"  # シート1 URL-encoded
    range_encoded = urllib.parse.quote(f"シート1!{range_notation}")
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}"
        f"/values/{range_encoded}?valueInputOption=RAW"
    )

    body = json.dumps({
        "range": f"シート1!{range_notation}",
        "majorDimension": "ROWS",
        "values": values
    }).encode("utf-8")

    req = urllib.request.Request(url, data=body, method="PUT")
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    return result

def write_row_with_retry(access_token, row, f, g, h, i, banner_path):
    """Write F:J and E columns with retry logic."""
    fj_range = f"F{row}:J{row}"
    e_range = f"E{row}"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # Write F:J
            sheets_put(access_token, fj_range, [[f, g, h, i, banner_path]])
            print(f"  [ROW {row}] F:J written OK")

            # Write E
            sheets_put(access_token, e_range, [["処理済"]])
            print(f"  [ROW {row}] E (処理済) written OK")
            return True, None
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            err_msg = f"HTTPError {e.code}: {body[:200]}"
            print(f"  [ROW {row}] Attempt {attempt} failed: {err_msg}")
            if e.code in (401, 403):
                # Token may have expired - refresh and retry
                print(f"  [ROW {row}] Refreshing token...")
                try:
                    access_token = get_access_token()
                except Exception as te:
                    print(f"  [ROW {row}] Token refresh failed: {te}")
        except Exception as e:
            err_msg = str(e)
            print(f"  [ROW {row}] Attempt {attempt} failed: {err_msg}")

        if attempt < MAX_RETRIES:
            time.sleep(2)

    return False, err_msg

# ── Banner Generation ────────────────────────────────────────────────────────
def generate_banner(row, title):
    output_rel = f"./images/banners/{DATE_STR}_row{row}.png"
    output_abs = os.path.abspath(
        os.path.join(BASE_DIR, "images", "banners", f"{DATE_STR}_row{row}.png")
    )

    cmd = [
        sys.executable,
        os.path.join(BASE_DIR, "generate_banner.py"),
        "--title", title,
        "--output", output_rel
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=BASE_DIR,
            timeout=60
        )
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if result.returncode != 0:
            print(f"  [BANNER row{row}] FAILED (returncode={result.returncode})")
            if stderr:
                print(f"  [BANNER row{row}] stderr: {stderr[:200]}")
            return False, ""

        # Extract path from "BANNER_PATH: <path>" if present
        for line in stdout.splitlines():
            if line.startswith("BANNER_PATH:"):
                banner_path = line.split(":", 1)[1].strip()
                print(f"  [BANNER row{row}] OK -> {banner_path}")
                return True, banner_path

        # If file exists, return absolute path
        if os.path.exists(output_abs):
            print(f"  [BANNER row{row}] OK (file exists) -> {output_abs}")
            return True, output_abs

        print(f"  [BANNER row{row}] stdout: {stdout[:200]}")
        print(f"  [BANNER row{row}] File not found at {output_abs}")
        return False, ""

    except subprocess.TimeoutExpired:
        print(f"  [BANNER row{row}] TIMEOUT")
        return False, ""
    except Exception as e:
        print(f"  [BANNER row{row}] Exception: {e}")
        return False, ""

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("process_batch.py starting")
    print("=" * 60)

    # Load batch data (fix unescaped quotes in JSON if present)
    with open(BATCH_JSON, "r", encoding="utf-8") as f:
        content = f.read()
    # Fix known JSON issue: unescaped double quotes around 典型的
    content = content.replace('"典型的"', '\\"典型的\\"')
    batch = json.loads(content)
    print(f"Loaded {len(batch)} rows from content_batch.json")

    # Get access token
    print("\n[AUTH] Getting access token...")
    try:
        access_token = get_access_token()
    except Exception as e:
        print(f"[AUTH] FATAL: {e}")
        sys.exit(1)

    banner_success = 0
    banner_fail = 0
    write_success = 0
    write_fail = 0
    write_fail_reasons = []

    for entry in batch:
        row = entry["row"]
        f_val = entry.get("f", "")
        g_val = entry.get("g", "")
        h_val = entry.get("h", "")
        i_val = entry.get("i", "")

        print(f"\n{'='*50}")
        print(f"Processing row {row}: {f_val[:50]}...")

        # 1. Generate banner (title from I列 first # heading, fallback to F列)
        banner_title = f_val
        for line in i_val.splitlines():
            line = line.strip()
            if line.startswith("# "):
                banner_title = line.lstrip("# ").strip()
                break
        print(f"  Generating banner...")
        ok, banner_path = generate_banner(row, banner_title)
        if ok:
            banner_success += 1
        else:
            banner_fail += 1
            banner_path = ""

        # 2. Write to Sheets
        print(f"  Writing to Sheets...")
        success, err = write_row_with_retry(
            access_token, row, f_val, g_val, h_val, i_val, banner_path
        )
        if success:
            write_success += 1
        else:
            write_fail += 1
            write_fail_reasons.append(f"row{row}: {err}")

    # Summary
    print(f"\n{'='*60}")
    print("PROCESSING COMPLETE")
    print(f"{'='*60}")
    print(f"BANNER_RESULT: 成功{banner_success}件、失敗{banner_fail}件")
    if write_fail_reasons:
        reasons_str = "; ".join(write_fail_reasons)
        print(f"WRITE_RESULT: 成功{write_success}件、失敗{write_fail}件（{reasons_str}）")
    else:
        print(f"WRITE_RESULT: 成功{write_success}件、失敗{write_fail}件")

if __name__ == "__main__":
    main()
