# AI Usage

A panel block that shows how much of your Claude Code and Antigravity plans you have used: one bar per limit with the time left until it resets, Claude's per-model weekly limits (such as Fable), and, collapsed under "모델별", each Claude model's share of tokens across the current windows. The labels are in Korean.

![AI Usage](preview.png)

## What you see

Top to bottom, 12px padding, on the theme `background`, with a 1px `border` line at the bottom:

1. **Claude Code section.** A 14px semibold title "Claude Code", a small gray pill with the plan ("Max 5x"), and on the right how long ago the data was updated ("방금", "3분 전").
   - Rows, 18px tall, 11px text, in fixed columns: label (104px) · bar (flexible, 5px tall, rounded, `raised` track) · percent (32px) · time to reset (60px, muted, e.g. "2시간 5분").
   - "Claude 5시간", "Claude 7일", then one row per model limit that Claude Code's `/usage` reports, e.g. "Fable 7일".
   - Bars are `accent`, `working` from 60% and `blocked` from 85%.
   - A fold row "▸ 모델별". When expanded, it shows "토큰 비중 5시간" and "토큰 비중 7일": stacked bars split by model, and a legend with a dot, the model name and its share. Model colors: Fable `#e5484d`, Opus `#f0883e`, Sonnet `#f2c94c`, Haiku `#e6d5a8`.
2. **A 1px divider.**
3. **Antigravity section.** Title "Antigravity" and the plan pill ("Google AI Pro").
   - Rows for every Gemini bucket agy reports: "Gemini 5시간", "Gemini 7일", and per-model ones such as "Gemini Argon 7일".
   - A fold "▸ 모델별 2" holding the buckets agy runs Claude and GPT on: "Claude·GPT 5시간", "Claude·GPT 7일".

Empty states: "Claude Code를 한 번 실행하면 표시돼요", "agy에서 한 번 대화하면 표시돼요".

## How it behaves

- The block resizes itself to its content (`layout.resize` on its own layout node), so collapsing a section gives the space back to the block below.
- Fold states are remembered per block instance in `localStorage`.
- A window whose reset time has passed shows 0% until new data arrives.
- Refresh: the status line files are watched (`watchFolder`) and updates appear immediately; `/usage` and the token split run every 30 seconds; countdowns redraw every 30 seconds.

## Built from

- `mods/ai-usage/main.js`: the view. `herdr` functions: `home`, `appHome`, `readTextFile`, `watchFolder`, `exec`, `theme`, `checking`, `layout`, `settings`, `run`. Command: `layout.resize`.
- `mods/ai-usage/plan-usage.py`: runs `claude -p "/usage" --no-session-persistence --output-format json` (no model call, no tokens) and parses lines like `Current week (Fable): 6% used · resets Nov 29 at 7am (Asia/Seoul)`.
- `mods/ai-usage/model-usage.py`: sums input + cache-creation + output tokens per Claude model per hour from `~/.claude/projects/**/*.jsonl` (sub-agents included), reading only new lines (cache in `~/.cache/ai-usage/`).
- Data files written by the status line scripts in `extras/`:
  - `~/.claude/state/statusline-latest.json` (Claude Code `rate_limits`)
  - `~/.cache/agy-statusline/latest.json` (agy `quota`, `plan_tier`)
- The plan pill for Claude comes from `oauthAccount.organizationRateLimitTier` in `~/.claude.json`.
- `props().demo` renders fixed mock numbers instead of live data for screenshots, with both folds expanded; `props().open` (for example `{"claude": false}`) overrides the folds, and `props().width` sets a fixed width. A demo copy reads no files, runs no commands, and leaves the layout untouched.

## Watch out

- Claude Code's status line JSON has no per-model limits; only `/usage` shows them. Don't infer Fable's limit from the token split.
- `/usage` prints reset times both as `6:59am` and, on the hour, as `7am`. Parse both.
- agy sends `quota` only after the first request of a session; keep the last quota when a status line arrives without one.
- Two reads of the same agy bucket can disagree; the agy script keeps, per bucket, the later reset window and, within one window, the higher usage.
- Claude Code writes one log entry per content block of a reply with the same message ID; count each ID once.
- macOS only as written (`stat -f`).

## Done when

- `herdr-app check mods/ai-usage` passes.
- With a Claude Code session running, the Claude rows show the same percentages as Claude Code's `/usage`, and a Fable row appears when `/usage` lists one.
- Opening "모델별" grows the block and closing it shrinks it, with no gap or clipping.
- After one agy request, the Antigravity rows show the Gemini buckets, and the Claude·GPT rows sit inside the fold.
