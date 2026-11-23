# Sessions

A panel block that shows, for every coding-agent session, which model it runs and its reasoning effort: the current session prominently at the top, every other session in two lines below, and under each one a tree of the sub-agents it started. The labels are in English or Korean, following your macOS language setting.

![Sessions](preview.png)

## What you see

1. **Current session**, with a "Guide ›" toggle on the right that opens a short legend.
   - Line 1: program icon, the session's name (the folder it was started in; `~` for home), and its status on the right ("Working" with a spinner while working).
   - Line 2: the model in 16px semibold ("Opus 5.5"), a five-step effort meter with its label ("xhigh"), an "ULTRACODE" badge when that mode is on, and the program name on the right.
   - Line 3: a small context meter with its percentage, "space › tab", the time since its last reply, and how long its prompt cache lasts.
   - While the session is working, a short pulse of light runs left to right along a 2px line under the header, restarting from the left every 1.6 seconds.
2. **Other sessions** with a count. Each session takes two lines: name, relative time and a status dot; then model, effort meter and context meter, with the space name on the right when it differs from the folder name. Sessions awaiting your input come first, followed by working, done, and idle, newest first within each group.
3. **Sub-agent tree** under each session: a 1px guide rail from the parent's icon, one line per sub-agent (status dot, name, model, effort meter, elapsed time). Running ones are bright; finished ones fold into "N done".
4. **Background work.** Commands that a Claude Code session left running in the background (such as a training script or a monitor) appear on their own lines in the session's tree with their elapsed time. The session also shows an "N tasks running" badge ("N scheduled" when only scheduled prompts remain) even when the agent itself is idle. These sessions sort above idle ones.

## How it behaves

- Clicking a session runs `agent.focus` on its terminal. Clicking a sub-agent that has its own terminal (started with `hc run`) runs `terminal.peek`.
- Hovering a meter or badge explains it.
- It refreshes every 5 seconds and reads files only while visible on screen.
- Language: `props().lang` (`"en"` or `"ko"`) if set; otherwise Korean when the first entry of `defaults read -g AppleLanguages` starts with `ko`, English for anything else. The last detected language is kept in `localStorage`. All labels for both languages live in one `TEXT` table in `lib.js`.

## Built from

- `mods/sessions/main.js` (view, polling) and `mods/sessions/lib.js` (pure helpers, tested by `lib.test.mjs` with `node lib.test.mjs`).
- `herdr` functions: `agents`, `terminals`, `spaces`, `panes`, `focused`, `layout`, `props`, `theme`, `run`, `exec`, `home`, `appHome`, `readTextFile`, `checking`. Commands: `agent.focus`, `terminal.peek`.
- Sessions and their state come from `agents()`. Sub-agents started with `hc run` come from `terminals()` (`parent`).
- Model, effort, ULTRACODE mode, context and cache times for Claude Code come from the over9k sidebar's cache, `~/.cache/over9k/agents/<terminal>.json`. Claude Code's own sub-agents come from `~/.cache/over9k/subagents-<cksum of the transcript path>`, and its unfinished background commands from `~/.cache/over9k/tasks-<same cksum>` (over9k's `tasks.sh`: one task per line with tab-separated fields: kind, id, description, start time, schedule, output file).
- Antigravity details come from running over9k's `agy-info.py` and `agy-subagents.py` (read-only), only while an agy session is listed. Codex details come from its terminal title, or the defaults in `~/.codex/config.toml`.
- `props().demo` renders mock sessions for screenshots instead of live data, and clicks in a demo copy trigger no commands; `props().width` sets a fixed width, and `props().lang` picks the language (English by default).

## Watch out

- It depends on [herdr-over9k](https://github.com/herunan/herdr-over9k) being installed and on screen; without it, models appear as "Model unknown".
- `loop()` only swings a value back and forth. For a one-way sweep, the line is its own nested view (`cx.new`) that draws a new element at the left on each pass and moves it with `transition("left", ...)`, so only that view is redrawn.
- The over9k sub-agent file is named by the POSIX `cksum` of the transcript path; the JS implementation must match the system `cksum` output (see the test).
- A new Claude Code session has no model until its first reply.
- Codex was checked with demo data only.

## Done when

- `herdr-app check mods/sessions` passes and `node mods/sessions/lib.test.mjs` prints `lib ok`.
- With over9k installed and a Claude Code session running, the current session shows its model and effort as Claude Code reports them.
- Starting `hc run -- agy` from that session shows an Antigravity line in its sub-agent tree within about 10 seconds.
