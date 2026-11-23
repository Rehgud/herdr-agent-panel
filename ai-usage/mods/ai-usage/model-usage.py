#!/usr/bin/env python3
# Tokens per Claude model per hour from local Claude Code transcripts (sub-agents included), for
# the usage panel's per-model split. Claude's plan limits are shared by every model, so this is
# the only way to see what Fable, Opus, ... took of them. Incremental: each file is read from
# where the last run stopped. Args: window start times (unix s). Prints [{model: tokens}, ...].
import json, os, sys, time
from datetime import datetime

ROOT = os.path.expanduser("~/.claude/projects")
CACHE = os.path.expanduser("~/.cache/ai-usage/model-tokens.json")
KEEP = 8 * 86400


def hour_of(ts):
    try:
        return int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()) // 3600 * 3600
    except Exception:
        return None


def scan(files, now):
    seen = set()
    for dirpath, _, names in os.walk(ROOT):
        for n in names:
            if not n.endswith(".jsonl"):
                continue
            p = os.path.join(dirpath, n)
            try:
                st = os.stat(p)
            except OSError:
                continue
            if now - st.st_mtime > KEEP:
                continue
            seen.add(p)
            ent = files.get(p)
            if not ent or st.st_size < ent["offset"]:  # new, or rewritten from the top
                ent = {"offset": 0, "last": None, "hours": {}}
            if st.st_size > ent["offset"]:
                with open(p, "rb") as f:
                    f.seek(ent["offset"])
                    data = f.read()
                end = data.rfind(b"\n") + 1  # whole lines only; a half-written one waits
                for line in data[:end].splitlines():
                    if b'"usage"' not in line:
                        continue
                    try:
                        o = json.loads(line)
                    except Exception:
                        continue
                    m = o.get("message") or {}
                    u, model = m.get("usage"), m.get("model")
                    if not isinstance(u, dict) or not model or not model.startswith("claude-"):
                        continue
                    # One reply is logged once per content block with the same id and usage.
                    mid = m.get("id") or o.get("requestId")
                    if mid and mid == ent["last"]:
                        continue
                    ent["last"] = mid
                    h = hour_of(o.get("timestamp") or "")
                    if h is None:
                        continue
                    tok = (u.get("input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0) + (u.get("output_tokens") or 0)
                    k = f"{h}|{model}"
                    ent["hours"][k] = ent["hours"].get(k, 0) + tok
                ent["offset"] += end
            ent["hours"] = {k: v for k, v in ent["hours"].items() if int(k.split("|", 1)[0]) > now - KEEP}
            files[p] = ent
    return {p: e for p, e in files.items() if p in seen}


def totals(files, start):
    out = {}
    first = int(start) // 3600 * 3600  # the window's first hour counts whole
    for e in files.values():
        for k, v in e["hours"].items():
            h, model = k.split("|", 1)
            if int(h) >= first:
                out[model] = out.get(model, 0) + v
    return out


def main():
    now = time.time()
    try:
        with open(CACHE) as f:
            files = json.load(f).get("files", {})
    except Exception:
        files = {}
    files = scan(files, now)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    tmp = CACHE + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"files": files}, f)
    os.replace(tmp, CACHE)
    print(json.dumps([totals(files, float(a)) for a in sys.argv[1:]]))


if __name__ == "__main__":
    main()
