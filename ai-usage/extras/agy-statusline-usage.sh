#!/bin/sh
# Status line (stacked under agy's own): saves the full stdin JSON (incl. quota) for the Herdr
# usage panel, prints a short summary of the model group in use (gemini, or 3p for Claude/GPT).
out="$HOME/.cache/agy-statusline/latest.json"
mkdir -p "$(dirname "$out")"
in=$(cat)
# The newest() merge is adapted from herdr-over9k's agy-statusline.sh
# (MIT License, Copyright (c) 2026 the Over9k authors).
# Reads of the same bucket disagree a little between refreshes, and a fresh session sends no
# quota at all: keep the newest window per bucket, the most used within one, and the last quota.
saved=$(jq -c '.quota // {}' "$out" 2>/dev/null); [ -n "$saved" ] || saved={}
printf '%s' "$in" | jq -c --argjson saved "$saved" '
  def newest($old):
    if $old == null or (.reset_time // "") > ($old.reset_time // "") then .
    elif (.reset_time // "") < ($old.reset_time // "") then $old
    elif ($old.remaining_fraction // 1) < (.remaining_fraction // 1) then .remaining_fraction = $old.remaining_fraction
    else . end;
  .quota = (if .quota then (.quota | with_entries(.key as $k | .value |= newest($saved[$k]))) else $saved end)' \
  > "$out.tmp" 2>/dev/null && mv "$out.tmp" "$out" || rm -f "$out.tmp"
printf '%s' "$in" | jq -r '
  (.quota // {}) as $q
  | (if (.model.display_name // "" | test("^Gemini"; "i")) then "gemini" else "3p" end) as $g
  | [ ($q["\($g)-5h"] // empty | "5h \((1 - (.remaining_fraction // 1)) * 100 | floor)%"),
      ($q["\($g)-weekly"] // empty | "7d \((1 - (.remaining_fraction // 1)) * 100 | floor)%") ]
  | join(" | ")' 2>/dev/null
