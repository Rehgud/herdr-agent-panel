#!/bin/sh
# Status line: saves the full stdin JSON (incl. plan usage limits) for Claude to read, prints a short summary.
out="$HOME/.claude/state/statusline-latest.json"
mkdir -p "$(dirname "$out")"
in=$(cat)
printf '%s' "$in" > "$out.tmp" && mv "$out.tmp" "$out"
printf '%s' "$in" | jq -r --slurpfile s "$HOME/.claude/settings.json" '
  # effort: live field first, else saved per-model / global default from settings.json
  (.effort.level // $s[0].modelSettings[.model.id].effortLevel // $s[0].effortLevel) as $e |
  [ ((.model.display_name // empty) + (if $e then " · effort: \($e)" else "" end)),
    (.rate_limits.five_hour.used_percentage | if . == null then empty else "5h \(. | floor)%" end),
    (.rate_limits.seven_day.used_percentage | if . == null then empty else "7d \(. | floor)%" end) ]
  | join(" | ")' 2>/dev/null
