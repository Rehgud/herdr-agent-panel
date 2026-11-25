// What the sessions panel computes, without Herdr or GPUI, so node can test it:
// node lib.test.mjs

// Every word the panel shows, per language; a number in a phrase makes it a function.
export const TEXT = {
  en: {
    status: { working: "Working", blocked: "Needs you", done: "Done", idle: "Idle", none: "No status" },
    task: { shell: "Shell", monitor: "Monitor", cron: "Scheduled", wakeup: "Scheduled" },
    aboutEffort: "Reasoning effort: how much the model thinks before it answers. Higher is more thorough, but slower and uses more tokens.",
    aboutUltra: "Claude Code's /effort ultracode mode. Every task runs a sub-agent workflow that cross-checks the work, so it is the most thorough mode and uses the most tokens.",
    aboutContext: "How full the context window is. When it fills up, the conversation is compacted.",
    aboutTasks: "Background work the agent started (shell commands, monitors) or scheduled. It keeps running while the agent is idle.",
    aboutCache: "Time left on the prompt cache. Once it expires, the next message rereads the whole conversation and uses more tokens.",
    effortTip: (effort, level) => `Reasoning effort ${effort} (${level}/5)`,
    contextTip: (pct) => `Context ${pct}% used`,
    legendTip: "Explains the effort, ULTRACODE and context indicators",
    tabN: (n) => `Tab ${n}`,
    doneN: (n) => `${n} done`,
    moreN: (n) => `${n} more`,
    justNow: "just now",
    minutes: (n) => `${n}m`, hours: (n) => `${n}h`, days: (n) => `${n}d`,
    agoOf: (span) => `${span} ago`,
    runFor: (span) => span,
    untilIn: (span) => `in ${span}`,
    soon: "soon",
    running: (n) => (n === 1 ? "1 task running" : `${n} tasks running`),
    scheduledN: (n) => `${n} scheduled`,
    failed: "Failed",
    newSession: "New session",
    modelUnknown: "Model unknown",
    guessed: "Default",
    guessedTip: "The default model from Codex's config.toml. It may differ if you changed the model in the session.",
    hintOther: "This agent doesn't report its model",
    hintFirst: "The model and context appear after the first reply",
    replied: (ago) => `Replied ${ago}`,
    cacheExpired: "Cache expired",
    cacheSoon: "Cache expiring",
    cacheLeft: (span) => `Cache ${span}`,
    cacheExample: "Cache 52m",
    emptyTitle: "No agent sessions running",
    emptyBody: "Start Claude Code, Antigravity or Codex in a terminal to see which model each session runs.",
    current: "Current session",
    guide: "Legend",
    others: "Other sessions",
    all: "All sessions",
    list: "List",
    diagram: "Diagram",
    shapes: { ltr: "Columns", indent: "Indented", org: "Org chart" },
    thisComputer: "This computer",
    sessionsN: (n) => (n === 1 ? "1 session" : `${n} sessions`),
    noneHere: "No agent sessions in this space",
    noOthers: "No other sessions",
    subagent: "Sub-agent",
    demo: { review: "Cross-check the changes", expiry: "Look into session expiry", login: "Map the login flow", test: "Find why the test fails", deps: "Check dependency versions", train: "Train on the full dataset",
      fix: "Fix logins that expire too early", rate: "Add rate limiting", docs: "Update the API docs", tune: "Tune the training run" },
  },
  ko: {
    status: { working: "작업 중", blocked: "확인 필요", done: "완료", idle: "대기", none: "상태 없음" },
    task: { shell: "셸 작업", monitor: "모니터링", cron: "예약", wakeup: "예약" },
    aboutEffort: "추론 강도(effort): 답하기 전에 생각하는 깊이. 높을수록 꼼꼼하지만 느리고 토큰을 더 써요.",
    aboutUltra: "Claude Code의 /effort ultracode 모드. 작업마다 서브에이전트 워크플로로 교차 검증까지 해서, 가장 꼼꼼하고 토큰을 가장 많이 써요.",
    aboutContext: "컨텍스트 창을 채운 정도. 가득 차면 대화가 압축돼요.",
    aboutTasks: "에이전트가 띄워 둔 백그라운드 작업(셸 명령, 모니터)이나 예약이에요. 에이전트가 쉬는 중이어도 계속 돌아요.",
    aboutCache: "프롬프트 캐시가 남은 시간. 지나면 다음 메시지가 대화 전체를 다시 읽어 토큰이 더 들어요.",
    effortTip: (effort, level) => `추론 강도 ${effort} (${level}/5)`,
    contextTip: (pct) => `컨텍스트 ${pct}% 사용`,
    legendTip: "추론 강도·ULTRACODE·컨텍스트 표시가 무슨 뜻인지 보여 줘요",
    tabN: (n) => `탭 ${n}`,
    doneN: (n) => `완료 ${n}개`,
    moreN: (n) => `${n}개 더`,
    justNow: "방금",
    minutes: (n) => `${n}분`, hours: (n) => `${n}시간`, days: (n) => `${n}일`,
    agoOf: (span) => `${span} 전`,
    runFor: (span) => `${span}째`,
    untilIn: (span) => `${span} 뒤`,
    soon: "곧",
    running: (n) => `작업 ${n}개 진행 중`,
    scheduledN: (n) => `예약 ${n}개`,
    failed: "실패",
    newSession: "새 세션",
    modelUnknown: "모델 확인 전",
    guessed: "기본값",
    guessedTip: "Codex 설정(config.toml)의 기본 모델이에요. 세션 안에서 바꿨다면 다를 수 있어요.",
    hintOther: "이 에이전트는 모델 정보를 알려 주지 않아요",
    hintFirst: "첫 응답이 오면 모델과 컨텍스트가 표시돼요",
    replied: (ago) => `응답 ${ago}`,
    cacheExpired: "캐시 만료",
    cacheSoon: "캐시 곧 만료",
    cacheLeft: (span) => `캐시 ${span}`,
    cacheExample: "캐시 52분",
    emptyTitle: "실행 중인 에이전트 세션이 없어요",
    emptyBody: "터미널에서 Claude Code, Antigravity, Codex를 시작하면 어떤 모델로 돌고 있는지 여기에 표시돼요.",
    current: "현재 세션",
    guide: "범례",
    others: "다른 세션",
    all: "전체 세션",
    list: "List",
    diagram: "Diagram",
    shapes: { ltr: "가로형", indent: "계단형", org: "조직도" },
    thisComputer: "이 컴퓨터",
    sessionsN: (n) => `세션 ${n}개`,
    noneHere: "이 스페이스에는 에이전트 세션이 없어요",
    noOthers: "다른 세션이 없어요",
    subagent: "서브에이전트",
    demo: { review: "변경 사항 교차 검토", expiry: "세션 만료 처리 조사", login: "로그인 흐름 파악", test: "실패한 테스트 원인 찾기", deps: "의존성 버전 확인", train: "전체 데이터로 학습 실행",
      fix: "로그인이 일찍 풀리는 문제 수정", rate: "요청 속도 제한 추가", docs: "API 문서 갱신", tune: "학습 설정 조정" },
  },
};

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

// "just now", "3m", "2h", "4d" (ko: "방금", "3분", "2시간", "4일"): how long `sec` seconds are.
export function span(sec, tx) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return tx.justNow;
  if (s < 3600) return tx.minutes(Math.floor(s / 60));
  if (s < 86400) return tx.hours(Math.floor(s / 3600));
  return tx.days(Math.floor(s / 86400));
}
export const ago = (sec, tx) => (sec < 60 ? tx.justNow : tx.agoOf(span(sec, tx)));
// How long something has run: "3h" (ko: "3시간째").
export const elapsed = (sec, tx) => (sec < 60 ? tx.justNow : tx.runFor(span(sec, tx)));

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
export function parseSubs(text, { header = false, tx } = {}) {
  return (text ?? "").split("\n").slice(header ? 1 : 0).filter((l) => l.includes("\t")).map((l) => {
    const [id, at, desc, type, model, start, , effort, , done] = l.split("\t");
    return { id, name: desc || type || tx.subagent, type: type || null, model: modelName(model) || null,
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

// One line of what an agent wrote: its first line with the Markdown marks taken off.
export function oneLine(text) {
  const line = String(text ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.replace(/^(#+|[-*>]|\d+\.)\s+/, "").replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").slice(0, 200) || null;
}

// What a Claude Code session is doing now, from the end of its transcript (JSON lines, the first
// one possibly cut): its latest step as it described it (a command's or sub-agent's
// description, its open to-do, the first line of what it said), or the request it was just
// given if it hasn't answered it yet.
export function activity(text) {
  const lines = String(text ?? "").split("\n").slice(1).reverse();
  for (const l of lines) {
    let e;
    try { e = JSON.parse(l); } catch { continue; }
    const content = e.message?.content;
    if (e.type === "user" && !e.isMeta) {
      const said = typeof content === "string" ? content : (content ?? []).find((b) => b.type === "text")?.text;
      if (said && !/^\s*</.test(said)) return oneLine(said); // <command-name>, <local-command-...>: not a request
      continue;
    }
    if (e.type !== "assistant" || !Array.isArray(content)) continue;
    for (const b of [...content].reverse()) {
      if (b.type === "tool_use") {
        const todo = b.name === "TodoWrite" ? (b.input?.todos ?? []).find((t) => t.status === "in_progress") : null;
        const step = todo?.activeForm ?? b.input?.description;
        if (step) return oneLine(step);
      }
      if (b.type === "text" && b.text?.trim()) return oneLine(b.text);
    }
  }
  return null;
}

// A cron job or a wakeup waits for its time; a shell or a monitor runs now.
export const scheduled = (task) => task.kind === "cron" || task.kind === "wakeup";

// A session's line on its background tasks: how many run now, else how many wait.
export function taskBadge(tasks, tx) {
  const all = tasks ?? [], running = all.filter((k) => !scheduled(k)).length;
  return running ? tx.running(running) : all.length ? tx.scheduledN(all.length) : null;
}

// Beside a task: how long it has run ("3h"), or how long until a wakeup ("in 12m"). A
// cron job's schedule is words of its own ("Every 2 hours at :13"): the tooltip's.
export function taskWhen(task, now, tx) {
  if (task.kind === "wakeup") {
    const left = Number(task.when) ? Number(task.when) - now : null;
    return left == null ? "" : left < 60 ? tx.soon : tx.untilIn(span(left, tx));
  }
  if (scheduled(task) || !task.startedAt) return "";
  return elapsed(now - task.startedAt, tx);
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

// A terminal still titled by the command that started it ("agy --dangerously-skip-permissions",
// "/usr/local/bin/claude"): its agent hasn't titled the session yet.
const COMMAND = { claude: "claude", codex: "codex", agy: "agy" };
export function commandTitle(title, a) {
  const first = String(title ?? "").trim().split(/\s+/)[0].split("/").pop().toLowerCase();
  return Boolean(first) && (first === a?.program?.key || first === COMMAND[kind(a)]);
}

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

// The diagram's boxes, left to right by depth: a leaf takes the next row, a parent sits level
// with the middle of its children, and half a row parts siblings down to depth `apart` (the
// sessions under a machine). `under(x)`: what x has under it. Rows are in row units; parents
// come before their children.
export function placeTree(roots, under, apart = 0) {
  const boxes = [];
  let row = 0;
  const place = (x, depth, parent) => {
    const box = { x, depth, parent, row: 0 };
    boxes.push(box);
    const kids = under(x).map((k, i) => { if (i && depth + 1 <= apart) row += 0.5; return place(k, depth + 1, box); });
    box.row = kids.length ? (kids[0].row + kids[kids.length - 1].row) / 2 : row++;
    return box;
  };
  roots.forEach((r, i) => { if (i) row += 0.5; place(r, 0, null); });
  return { boxes, rows: row, depth: Math.max(0, ...boxes.map((b) => b.depth)) };
}

// The diagram drawn downward: each box under the one before it, `indent` px further in per
// level, one more `gap` between siblings down to depth `apart` (the sessions). `height(x)`: a
// box's height. Boxes get left, top and h; `height` is the whole drawing's.
export function stackTree(roots, under, height, { indent = 24, gap = 6, apart = 1 } = {}) {
  const boxes = [];
  let y = 0;
  const place = (x, depth, parent, i) => {
    if (i && depth <= apart) y += gap;
    const box = { x, depth, parent, left: depth * indent, top: y, h: height(x) };
    boxes.push(box);
    y += box.h + gap;
    under(x).forEach((k, j) => place(k, depth + 1, box, j));
  };
  roots.forEach((r, i) => place(r, 0, null, i));
  return { boxes, height: Math.max(0, y - gap) };
}

// The diagram as an org chart: a row per level, each leaf `slot` px across, a parent centred
// over its children (placeTree's rows turned on their side). Boxes get left, top, w and h.
export function orgTree(roots, under, height, { slot, vgap = 28, gap = 8 }) {
  const { boxes, rows, depth } = placeTree(roots, under, 1);
  const level = [];
  for (const b of boxes) level[b.depth] = Math.max(level[b.depth] ?? 0, height(b.x));
  const tops = [];
  let y = 0;
  for (let d = 0; d <= depth; d++) { tops[d] = y; y += (level[d] ?? 0) + vgap; }
  for (const b of boxes) Object.assign(b, { left: b.row * slot + gap / 2, top: tops[b.depth], w: slot - gap, h: height(b.x) });
  return { boxes, width: rows * slot, height: Math.max(0, y - vgap) };
}

// The points of a drawn curve, for a ball to roll along it: a cubic (PathBuilder's
// cubic_bezier_to) or a quadratic (curve_to) Bézier, at n even steps of its parameter.
const lerpBezier = (pts, t) => (pts.length === 1 ? pts[0]
  : lerpBezier(pts.slice(1).map((p, i) => [pts[i][0] + (p[0] - pts[i][0]) * t, pts[i][1] + (p[1] - pts[i][1]) * t]), t));
export const bezierPoints = (ctrl, n = 16) => Array.from({ length: n + 1 }, (_, i) => lerpBezier(ctrl, i / n));

// A polyline cut into even steps of about `step` px: [{ x, y, s }], s the distance from its start.
export function resample(points, step = 6) {
  const out = [{ x: points[0][0], y: points[0][1], s: 0 }];
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], len = Math.hypot(bx - ax, by - ay);
    if (!len) continue;
    const n = Math.max(1, Math.round(len / step));
    for (let k = 1; k <= n; k++) out.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, s: s + (len * k) / n });
    s += len;
  }
  return out;
}

// Who just spoke between an agent and what it started. `prev`: key -> status at the last look;
// `items`: [{ key, status, startedAt }] now. "send" (the parent spoke) when a child starts
// working, brand new or on a new turn; "reply" when it stops. `gone`: the keys that vanished
// mid-work (a terminal removed as it exits): they replied too, as they went.
export function talkEvents(prev, items, now, fresh = 20) {
  const events = [], here = new Set();
  for (const { key, status, startedAt } of items) {
    here.add(key);
    const was = prev.get(key);
    const started = was === undefined ? status === "working" && startedAt != null && now - startedAt < fresh : was !== "working" && status === "working";
    if (started) events.push({ key, dir: "send" });
    else if (was === "working" && status !== "working") events.push({ key, dir: "reply" });
  }
  const gone = [...prev].filter(([key, status]) => !here.has(key) && status === "working").map(([key]) => key);
  return { events: [...events, ...gone.map((key) => ({ key, dir: "reply" }))], gone };
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
export function demoData(now, lang) {
  const names = TEXT[lang].demo;
  const program = (key, name) => ({ key, name, icon: `icons/${key}.svg`, tint: false, agent: true });
  const claude = program("claude", "Claude Code"), codex = program("codex", "Codex"), agy = program("antigravity", "Antigravity");
  const agent = (address, name, prog, app, status, seq, title = "") =>
    ({ address, app, program: prog, status, title, seq, space: `s-${address}`, space_name: name, tab: `tab-${address}`, tab_name: "1", focused: false });
  const sub = (id, name, model, effort, started, last, done) =>
    ({ id, name, type: "general-purpose", model, effort, startedAt: now - started, lastAt: now - last, done });
  const list = [
    // Each with the title its agent gave the session: Claude Code's terminal title (after its
    // spinner), Codex's thread, agy's conversation (in `saved` below).
    agent("d1", "my-app", claude, "claude-code", "working", 4, `✳ ${names.fix}`),
    agent("d2", "api-server", codex, "codex", "idle", 3, `${names.rate} | gpt-6-luna medium | Context 18% used`),
    agent("d3", "docs-site", agy, "antigravity", "done", 2),
    agent("d4", "ml-train", claude, "claude-code", "idle", 1, `✳ ${names.tune}`),
  ];
  return {
    now, list, focus: { terminal: "d1" },
    terms: [
      ...list.map((a) => ({ address: a.address, state: "live", cwd: `/demo/${a.space_name}` })),
      // Started by my-app's agent with `hc run`: shown under it.
      { address: "d5", parent: "d1", state: "live", status: "working", name: names.review, program: agy, agent: "antigravity",
        argv: ["agy", "-p", "review", "--model", "Gemini 4 Argon (Medium)"], created_ms: (now - 250) * 1000 },
    ],
    tabs: [{ id: "tab-d2", changed_at: (now - 12 * 60) * 1000 }],
    saved: {
      d1: { model: "Opus 5.5", effort: "xhigh", ultracode: false, context: 42, lastAt: now - 20, cacheUntil: now + 52 * 60 },
      d3: { agent: "antigravity", model: "Gemini 3.8 Flash", effort: "low", context: 27, lastAt: now - 8 * 60, title: names.docs },
      d4: { model: "Fable 5.2", effort: "high", ultracode: false, context: 63, lastAt: now - 25 * 60, cacheUntil: null },
    },
    subs: { d1: [
      sub("a1", names.expiry, "Opus 5.5", "xhigh", 95, 5, false),
      sub("a2", names.login, "Haiku 5.5", "medium", 900, 780, true),
      sub("a3", names.test, "Opus 5.5", "xhigh", 700, 520, true),
      sub("a4", names.deps, "Haiku 5.5", "low", 400, 330, true),
    ] },
    // The agent of ml-train rests while what it started still runs.
    tasks: { d4: [{ kind: "shell", id: "b1", name: names.train, startedAt: now - 3 * 3600 - 300, when: null, output: "/tmp/demo/tasks/b1.out" }] },
  };
}
