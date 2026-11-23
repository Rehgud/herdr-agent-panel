#!/usr/bin/env python3
# Claude's plan limits as Claude Code's own /usage reports them — including per-model weekly
# limits like "Current week (Fable)", which the status line JSON doesn't carry. `claude -p /usage`
# runs no model (0 tokens). Prints {"at": s, "windows": [{key, model, window, pct, resets_at}]}.
import json, os, re, subprocess, sys, time
from datetime import datetime
from zoneinfo import ZoneInfo

LINE = re.compile(r"^Current (session|week)(?: \(([^)]+)\))?: (\d+(?:\.\d+)?)% used(?: · resets (.+?) \(([^)]+)\))?\s*$")


def reset_epoch(text, tz, now):
    # "Nov 29 at 6:59am" (no year): the next such moment from now
    try:
        zone = ZoneInfo(tz)
        year = datetime.fromtimestamp(now, zone).year
        # "6:59am", or "7am" on the hour
        fmt = "%b %d %I:%M%p %Y" if ":" in text else "%b %d %I%p %Y"
        for y in (year, year + 1):
            t = datetime.strptime(f"{text.replace(' at ', ' ').upper()} {y}", fmt).replace(tzinfo=zone).timestamp()
            if t > now - 86400:
                return int(t)
    except Exception:
        return None


def parse(result, now):
    out = []
    for line in (result or "").splitlines():
        m = LINE.match(line.strip())
        if not m:
            continue
        kind, scope, pct, reset, tz = m.groups()
        model = None if scope in (None, "all models") else scope
        out.append({
            "key": f"{'five_hour' if kind == 'session' else 'seven_day'}{'_' + model.lower() if model else ''}",
            "model": model,
            "window": "5h" if kind == "session" else "7d",
            "pct": float(pct),
            "resets_at": reset_epoch(reset, tz, now) if reset else None,
        })
    return out


def main():
    now = time.time()
    cwd = os.path.expanduser("~/.cache/ai-usage")
    os.makedirs(cwd, exist_ok=True)
    r = subprocess.run(["claude", "-p", "/usage", "--no-session-persistence", "--output-format", "json"],
                       cwd=cwd, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=90)
    windows = parse(json.loads(r.stdout).get("result", ""), now)
    if not windows:
        sys.exit("no usage lines in claude /usage output")
    print(json.dumps({"at": int(now), "windows": windows}))


if __name__ == "__main__":
    main()
