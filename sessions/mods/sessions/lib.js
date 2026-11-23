// What the sessions panel computes, without Herdr or GPUI, so node can test it:
// node lib.test.mjs

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
// 1..5 on the effort scale; 0 for none/minimal, null when it isn't one.
export function effortLevel(e) {
  const i = EFFORTS.indexOf((e ?? "").toLowerCase());
  return i >= 0 ? i + 1 : /^(none|minimal)$/i.test(e ?? "") ? 0 : null;
}

// "claude-opus-5-5" -> "Opus 5.5" (as over9k's claude-info.py); other names stay.
export function modelName(id) {
  if (!id) return null;
  const m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id);
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ""}` : id;
}

// "방금", "3분", "2시간", "4일": how long `sec` seconds are.
export function span(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간`;
  return `${Math.floor(s / 86400)}일`;
}
export const ago = (sec) => (sec < 60 ? "방금" : `${span(sec)} 전`);

// POSIX `cksum` of a string's UTF-8 bytes: over9k names each transcript's subagent
// cache by it (subagents.sh: subagents-$(printf '%s' "$1" | cksum)).
export function cksum(text) {
  const bytes = [];
  const enc = encodeURIComponent(text);
  for (let i = 0; i < enc.length; i++) {
    if (enc[i] === "%") { bytes.push(parseInt(enc.slice(i + 1, i + 3), 16)); i += 2; } else bytes.push(enc.charCodeAt(i));
  }
  let crc = 0;
  const feed = (b) => {
    crc ^= b << 24;
    for (let k = 0; k < 8; k++) crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1;
  };
  for (const b of bytes) feed(b);
  for (let n = bytes.length; n > 0; n = Math.floor(n / 256)) feed(n & 0xff);
  return (~crc) >>> 0;
}

// over9k's subagent lines (subagents.sh, agy-subagents.py), tab-separated: id, last write,
// description, type, model, start, context tokens, effort, window, done. Newest first.
export function parseSubs(text, { header = false } = {}) {
  return (text ?? "").split("\n").slice(header ? 1 : 0).filter((l) => l.includes("\t")).map((l) => {
    const [id, at, desc, type, model, start, , effort, , done] = l.split("\t");
    return { id, name: desc || type || "서브에이전트", type: type || null, model: modelName(model) || null,
      effort: effort || null, startedAt: Number(start) || null, lastAt: Number(at) || null, done: done === "1" };
  }).sort((a, b) => Number(a.done) - Number(b.done) || (b.lastAt ?? 0) - (a.lastAt ?? 0));
}

// over9k's background-task lines (tasks.sh) after their key line, tab-separated: kind (shell,
// monitor, cron, wakeup), id, what it is, start, a cron job's schedule or a wakeup's time
// (seconds), and a shell's or monitor's output file. Only what hasn't ended is listed.
export function parseTasks(text) {
  return (text ?? "").split("\n").slice(1).filter((l) => l.includes("\t")).map((l) => {
    const [kind, id, desc, start, when, output] = l.split("\t");
    return { kind, id, name: desc || null, startedAt: Number(start) || null, when: when || null, output: output || null };
  });
}

// A cron job or a wakeup waits for its time; a shell or a monitor runs now.
export const scheduled = (task) => task.kind === "cron" || task.kind === "wakeup";

// A session's line on its background tasks: how many run now, else how many wait.
export function taskBadge(tasks) {
  const all = tasks ?? [], running = all.filter((k) => !scheduled(k)).length;
  return running ? `작업 ${running}개 진행 중` : all.length ? `예약 ${all.length}개` : null;
}

// Beside a task: how long it has run ("3시간째"), or how long until a wakeup ("12분 뒤"). A
// cron job's schedule is words of its own ("Every 2 hours at :13"): the tooltip's.
export function taskWhen(task, now) {
  if (task.kind === "wakeup") {
    const left = Number(task.when) ? Number(task.when) - now : null;
    return left == null ? "" : left < 60 ? "곧" : `${span(left)} 뒤`;
  }
  if (scheduled(task) || !task.startedAt) return "";
  return now - task.startedAt < 60 ? "방금" : `${span(now - task.startedAt)}째`;
}

// clean() and codexTitle() are adapted from herdr-over9k's agent-name.js
// (MIT License, Copyright (c) 2026 the Over9k authors; see THIRD-PARTY-NOTICES.md).
// Drops what an agent puts before its title (a status glyph or spinner).
export const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}~/]+/u, "").trim();

// Codex can title its terminal "<thread> | <model> <effort> | Context N% used".
export function codexTitle(title) {
  const out = { model: null, effort: null, context: null }, rest = [];
  for (const part of (title ?? "").split(" | ")) {
    const ctx = /^Context (\d+)% used$/.exec(part), model = /^(\S+) (none|minimal|low|medium|high|xhigh|max)$/.exec(part);
    if (ctx) out.context = Number(ctx[1]);
    else if (model) { out.model = model[1]; out.effort = model[2]; }
    else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(part)) rest.push(part);
  }
  return { ...out, task: out.model || out.context != null ? clean(rest.join(" | ")) : null };
}

// model and model_reasoning_effort from Codex's config.toml: what a session starts with.
export function codexDefaults(toml) {
  const top = (toml ?? "").split(/^\[/m)[0];
  const get = (k) => new RegExp(`^${k}\\s*=\\s*"([^"]+)"`, "m").exec(top)?.[1] ?? null;
  return { model: get("model"), effort: get("model_reasoning_effort") };
}

// What a command line says it runs with: `--model X` / `--model=X` and `--effort Y`; agy
// names both in one ("Gemini 4 Argon (Medium)").
export function argvModel(argv) {
  const list = Array.isArray(argv) ? argv.map(String) : [];
  const flag = (name) => {
    const i = list.findIndex((x) => x === `--${name}` || x.startsWith(`--${name}=`));
    return i < 0 ? null : list[i].includes("=") ? list[i].slice(name.length + 3) : list[i + 1] ?? null;
  };
  const m = /^(.*?) *\((Minimal|Low|Medium|High|Xhigh|Max)\)$/i.exec(flag("model") ?? "");
  return { model: modelName(m ? m[1] : flag("model")), effort: (flag("effort") ?? m?.[2] ?? null)?.toLowerCase() ?? null };
}

export const kind = (a) => {
  const s = `${a?.app ?? ""} ${a?.program?.key ?? ""}`.toLowerCase();
  return /claude/.test(s) ? "claude" : /codex/.test(s) ? "codex" : /antigravity|\bagy\b/.test(s) ? "agy" : "other";
};

// One agent's details from what was read for it. `saved`: over9k's file for its terminal
// (Claude Code's, or Antigravity's when its over9k status line is on); `agy`: agy-info.py's
// answer; `latest`: the newest agy status line input; `codex`: config.toml's defaults.
export function details(a, { saved, agy, latest, codex } = {}) {
  const none = { model: null, effort: null, ultracode: false, context: null, lastAt: null, cacheUntil: null, guessed: false, title: null };
  if (agy || saved?.agent === "antigravity") {
    // (A file Claude Code left for this terminal a moment ago says nothing about agy.)
    const kept = saved?.agent === "antigravity" ? saved : null;
    const i = { ...kept, ...Object.fromEntries(Object.entries(agy ?? {}).filter(([, v]) => v != null)) };
    // The status line's input names its conversation: only that one's context is known.
    const live = latest && i.conversation && latest.conversation_id === i.conversation ? latest : null;
    const ctx = live?.context_window?.used_percentage ?? kept?.context;
    return { ...none, model: i.model ?? null, effort: i.effort ?? null, context: ctx == null ? null : Math.round(ctx), lastAt: i.lastAt ?? null, title: i.title ?? null };
  }
  if (saved) return { ...none, model: saved.model ?? null, effort: saved.effort ?? null, ultracode: Boolean(saved.ultracode), context: saved.context ?? null, lastAt: saved.lastAt ?? null, cacheUntil: saved.cacheUntil ?? null };
  if (kind(a) === "codex") {
    const t = codexTitle(a.title);
    if (t.model) return { ...none, model: t.model, effort: t.effort, context: t.context, title: t.task };
    if (codex?.model) return { ...none, model: codex.model, effort: codex.effort, context: t.context, guessed: true };
  }
  return none;
}

const RANK = { blocked: 4, working: 3, done: 2, idle: 1 };
// The other sessions: the ones that need the person, then working, finished, idle; within
// each, the one that changed last first. `busy(a)`: its agent rests but a background task of
// its still runs, so it goes right under the working ones.
export const sortSessions = (list, busy = () => false) => {
  const rank = (a) => Math.max(RANK[a.status] ?? 0, busy(a) ? 2.5 : 0);
  return [...list].sort((a, b) => rank(b) - rank(a) || (b.seq ?? 0) - (a.seq ?? 0));
};

// The session the person is on: the focused terminal's agent, else the shown tab's (its
// focused one, else its latest), else the one Herdr counts as chosen in the shown space
// (agent.focus, an agent block), else that space's latest.
export function pickCurrent(list, f) {
  const latest = (xs) => xs.reduce((m, a) => (!m || (a.seq ?? 0) > (m.seq ?? 0) ? a : m), null);
  const here = list.filter((a) => f?.tab && a.tab === f.tab);
  return list.find((a) => f?.terminal && a.address === f.terminal)
    ?? here.find((a) => a.focused) ?? latest(here)
    ?? list.find((a) => f?.agent && a.address === f.agent && a.space === f.space)
    ?? latest(list.filter((a) => f?.space && a.space === f.space)) ?? null;
}

// A sub-agent list as shown: the running ones, then (folded unless open) the finished, newest
// first, at most `max` of them; `hidden` counts what a fold or the limit keeps back.
export function foldSubs(subs, open, max = 6) {
  const live = subs.filter((s) => !s.done), done = subs.filter((s) => s.done).sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
  const shown = open ? done.slice(0, max) : [];
  return { live, done: shown, finished: done.length, more: open ? done.length - shown.length : 0 };
}

// A session's name: the folder it was started in ("~" at home), as the user names sessions.
export function folderName(cwd, homeDir) {
  const raw = String(cwd ?? "");
  if (!raw) return null;
  const p = raw.replace(/\/+$/, "") || "/";
  if (homeDir && p === String(homeDir).replace(/\/+$/, "")) return "~";
  return p.split("/").pop() || "/";
}

// Made-up sessions for props().demo (screenshots, a recipe's checks), in the shapes the panel
// reads: agents(), terminals(), tabs, focused(), and over9k's files per terminal (saved, subs,
// tasks). Nobody's real folders, titles or numbers.
export function demoData(now) {
  const program = (key, name) => ({ key, name, icon: `icons/${key}.svg`, tint: false, agent: true });
  const claude = program("claude", "Claude Code"), codex = program("codex", "Codex"), agy = program("antigravity", "Antigravity");
  const agent = (address, name, prog, app, status, seq, title = "") =>
    ({ address, app, program: prog, status, title, seq, space: `s-${address}`, space_name: name, tab: `tab-${address}`, tab_name: "1", focused: false });
  const sub = (id, name, model, effort, started, last, done) =>
    ({ id, name, type: "general-purpose", model, effort, startedAt: now - started, lastAt: now - last, done });
  const list = [
    agent("d1", "my-app", claude, "claude-code", "working", 4),
    agent("d2", "api-server", codex, "codex", "idle", 3, "Add rate limiting | gpt-6-luna medium | Context 18% used"),
    agent("d3", "docs-site", agy, "antigravity", "done", 2),
    agent("d4", "ml-train", claude, "claude-code", "idle", 1),
  ];
  return {
    now, list, focus: { terminal: "d1" },
    terms: [
      ...list.map((a) => ({ address: a.address, state: "live", cwd: `/demo/${a.space_name}` })),
      // Started by my-app's agent with `hc run`: shown under it.
      { address: "d5", parent: "d1", state: "live", status: "working", name: "변경 사항 교차 검토", program: agy, agent: "antigravity",
        argv: ["agy", "-p", "review", "--model", "Gemini 4 Argon (Medium)"], created_ms: (now - 250) * 1000 },
    ],
    tabs: [{ id: "tab-d2", changed_at: (now - 12 * 60) * 1000 }],
    saved: {
      d1: { model: "Opus 5.5", effort: "xhigh", ultracode: false, context: 42, lastAt: now - 20, cacheUntil: now + 52 * 60 },
      d3: { agent: "antigravity", model: "Gemini 3.8 Flash", effort: "low", context: 27, lastAt: now - 8 * 60 },
      d4: { model: "Fable 5.2", effort: "high", ultracode: false, context: 63, lastAt: now - 25 * 60, cacheUntil: null },
    },
    subs: { d1: [
      sub("a1", "세션 만료 처리 조사", "Opus 5.5", "xhigh", 95, 5, false),
      sub("a2", "로그인 흐름 파악", "Haiku 5.5", "medium", 900, 780, true),
      sub("a3", "실패한 테스트 원인 찾기", "Opus 5.5", "xhigh", 700, 520, true),
      sub("a4", "의존성 버전 확인", "Haiku 5.5", "low", 400, 330, true),
    ] },
    // The agent of ml-train rests while what it started still runs.
    tasks: { d4: [{ kind: "shell", id: "b1", name: "전체 데이터로 학습 실행", startedAt: now - 3 * 3600 - 300, when: null, output: "/tmp/demo/tasks/b1.out" }] },
  };
}
