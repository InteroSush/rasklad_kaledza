#!/usr/bin/env python3
"""Downloads the schedule from raspisanie.nikasoft.ru and writes site/data/schedule.json."""
import argparse, json, os, re, sys, time, urllib.request
from pathlib import Path

BASE = os.environ.get("NIKA_BASE", "https://raspisanie.nikasoft.ru")
SCHEDULE_ID = os.environ.get("SCHEDULE_ID", "25711519")
OUT = Path(__file__).resolve().parent.parent / "site" / "data" / "schedule.json"
KEEP = ["DUALWEEK", "WEEKDAYNUM", "LESSONSINDAY", "FIRSTLESSONNUM", "EXPORT_DATE", "EXPORT_TIME",
        "TEACHERS", "SUBJECTS", "CLASSES", "CLASS_COURSES", "ROOMS", "CLASSGROUPS", "PERIODS",
        "LESSON_TIMES", "LESSON_TIMES_BY_DAY", "CLASS_SCHEDULE", "CLASS_EXCHANGE",
        "TEACH_SCHEDULE", "TEACH_EXCHANGE", "HOLIDAY_TRANSFER"]

def get(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 schedule-sync"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as e:
            print(f"GET {url} failed ({attempt + 1}/3): {e}", file=sys.stderr)
            time.sleep(3)
    sys.exit(f"Could not download {url}")

def parse(text):
    i = text.index("var NIKA=")
    obj, _ = json.JSONDecoder().raw_decode(text[text.index("{", i):])
    return obj

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="local nika .js file (for testing, no network)")
    a = ap.parse_args()
    if a.file:
        name, raw = Path(a.file).name, Path(a.file).read_bytes()
    else:
        name = get(f"{BASE}/check/{SCHEDULE_ID}.html").decode("utf-8-sig").strip()
        if not re.fullmatch(r"[\w.-]+\.js", name):
            sys.exit(f"Unexpected check response: {name[:80]!r}")
        raw = get(f"{BASE}/static/public/{name}")
    nika = parse(raw.decode("utf-8-sig"))
    data = {k: nika[k] for k in KEEP if k in nika}
    data["source"] = name
    for k in ("CLASS_SCHEDULE", "TEACHERS", "CLASSES"):
        if not data.get(k):
            sys.exit(f"Parsed data has no {k}")
    new = json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    changed = new != old
    if changed:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(new, encoding="utf-8")
    print(f"{name}: {'updated' if changed else 'no changes'} ({len(new) // 1024} KB)")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")

if __name__ == "__main__":
    main()
