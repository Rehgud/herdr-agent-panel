// Which model each coding-agent session runs: the one the person is on, in full, then every
// other one, most urgent first, each with its sub-agents as a tree under it.
// Herdr gives the sessions and their state. Their model, effort, ultracode, context and
// sub-agents are read from what the over9k sidebar already keeps in ~/.cache/over9k (it runs
// claude-info.py and subagents.sh every few seconds); Antigravity's come from over9k's
// agy-info.py and agy-subagents.py, run here, and Codex's from its terminal title or config.
import { View, div, image, svg, PathBuilder } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, spaces, panes, focused, layout, props, settings, theme, run, exec, home, appHome, readTextFile, checking } from "herdr";
import { TEXT, EFFORTS, effortLevel, span, ago, elapsed, cksum, parseSubs, clean, codexDefaults, argvModel, kind, details, sortSessions, pickCurrent, foldSubs, folderName, parseTasks, scheduled, taskBadge, taskWhen, placeTree, demoData } from "./lib.js";

const MOD = "sessions";
const POLL_MS = 5000;
const GUT = 16;   // the icon column, and one tree level's guide
const RAIL = 7;   // the guide line's x in it: under the icon's middle
const SUB_H = 20; // a sub-agent's line
const NODE_H = 38; // a box in the diagram
const ROW = 46;    // a diagram row: a box and the gap under it
const GAP_X = 20;  // between the diagram's columns: room for the curves
const ROOT_W = 88; // the diagram's machine box: room for "이 컴퓨터"
const VIEWS = ["list", "diagram"];
const CHEVRON = (open) => `mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`;
const pickLang = (v) => (v === "en" || v === "ko" ? v : null);
// The mod runtime has no Intl or navigator, so macOS's first preferred language decides.
async function detectLang() {
  const r = await exec("defaults", ["read", "-g", "AppleLanguages"]).catch(() => null);
  const first = /^\s*"?([\w-]+)"?,?\s*$/m.exec((r?.stdout ?? "").replace("(", ""))?.[1] ?? "";
  return first.toLowerCase().startsWith("ko") ? "ko" : "en";
}

// has() and showing() are adapted from agent-flow's main.js
// (MIT License, Copyright (c) 2026 MarcozVD; see THIRD-PARTY-NOTICES.md).
// Whether a copy in the layout is on screen (as agent-flow asks): copies stay alive hidden,
// and reading files for a closed panel is work for nothing.
function has(node) {
  return node?.content?.mod === MOD || (node?.children ?? []).some(has);
}
function showing(node) {
  if (node?.content?.mod === MOD) return true;
  return (node?.children ?? []).some((c) => !c.hidden && (node.type !== "stack" || node.active === c.id) && showing(c));
}
const visible = () => props()?.overlay || panes().some((p) => p.mod === MOD) || !has(layout()) || showing(layout());

const alpha = (color, aa) => (/^#[0-9a-f]{6}$/i.test(color ?? "") ? color + aa : color);
const json = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };

// A program's icon from the app's table: a one-color glyph or a picture; without one, an
// agent's or a plain program's.
function icon(p, size, color) {
  if (!p?.icon) return svg(p && !p.agent ? "icons/shell.svg" : "icons/agent.svg").size(size).flex_none().text_color(color);
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// Effort as five rising bars, as many lit as its place on the scale, then its word.
function effortMark(t, tx, id, effort, { h = 10, color = t.foreground, text = t.muted, word = true } = {}) {
  const level = effortLevel(effort);
  if (level == null) return null;
  const w = h > 10 ? 3 : 2.5;
  return h_flex().id(id).flex_none().gap(4).items_center().tooltip(tx.effortTip(effort, level))
    .child(h_flex().h(h).gap(1.5).items_end().children(EFFORTS.map((_, i) =>
      div().w(w).h(Math.round(h * (0.4 + 0.15 * i) * 2) / 2).rounded(1).bg(i < level ? color : alpha(t.muted, "40")))))
    .when(word, (el) => el.child(div().text_color(text).child(effort.toLowerCase())));
}

function ultraBadge(t, tx, id, label = "ULTRA") {
  const c = t.ansi5 ?? t.accent;
  return div().id(id).flex_none().flex().items_center().h(15).px(5).rounded(4).bg(alpha(c, "2e"))
    .text_size(9.5).font_bold().text_color(c).child(label).tooltip(tx.aboutUltra);
}

// Context used: a small meter and its percent, warmer as it fills (as the usage block above).
function contextMeter(t, tx, id, pct, width = 28) {
  const color = pct >= 85 ? t.blocked : pct >= 60 ? t.working : t.muted;
  return h_flex().id(id).flex_none().gap(4).items_center().tooltip(tx.contextTip(pct))
    .child(div().w(width).h(4).rounded(2).bg(alpha(t.muted, "40")).overflow_hidden()
      .child(div().h_full().rounded(2).bg(color).w(`${Math.min(100, Math.max(pct, 4))}%`)))
    .child(div().text_color(color).child(`${pct}%`));
}

// A state as its mark: a spinner while working, a pulsing pill when it needs the person,
// a dot once done, a ring while idle. `label`: with its word.
function statusMark(t, tx, status, label = false) {
  const color = t[status] ?? t.dim;
  const word = (el) => (label ? h_flex().flex_none().gap(5).items_center().child(el).child(div().text_size(11).font_medium().text_color(color).child(tx.status[status] ?? tx.status.none)) : el);
  if (status === "working") return word(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900));
  if (status === "blocked") return div().flex_none().flex().items_center().h(17).px(6).rounded(5).bg(alpha(t.blocked, "2e"))
    .text_size(10.5).font_semibold().text_color(t.blocked).child(tx.status.blocked).loop("opacity", { from: 0.55, to: 1, period: 1400 });
  if (status === "done") return word(div().size(7).mx(2.5).flex_none().rounded(4).bg(color));
  return word(div().size(7).mx(2.5).flex_none().rounded(4).border(1.5).border_color(color));
}

// One level of a tree line: a rail passing by ("pipe"), a branch to this row ("tee"), the
// last branch ("end"), or nothing under a parent that has ended ("none").
function guide(t, shape) {
  const line = t.input ?? t.border;
  return div().relative().w(GUT).h(SUB_H).flex_none()
    .when(shape === "pipe" || shape === "tee", (el) => el.child(div().absolute().left(RAIL).top(0).w(1).h(SUB_H).bg(line)))
    .when(shape === "tee", (el) => el.child(div().absolute().left(RAIL).top(SUB_H / 2).w(GUT - RAIL - 1).h(1).bg(line)))
    .when(shape === "end", (el) => el.child(div().absolute().left(RAIL).top(0).w(GUT - RAIL - 1).h(SUB_H / 2 + 1).border_l(1).border_b(1).rounded_bl(5).border_color(line)));
}

// The line under the title while the current session works: a light that sweeps left to right
// and starts over, since loop() only swings there and back. Its own view, so a pass redraws only it.
const SWEEP_MS = 1600;
class Sweep extends View {
  init(_props, cx) {
    this.pass = 0;
    this.across = false;
    this.width = 368;
    if (checking()) return;
    cx.timer.every(SWEEP_MS, (cx) => {
      if (!visible()) return;
      this.pass += 1;
      this.across = false;
      cx.notify();
      // A new element is drawn where it starts; only the target after that slides.
      cx.timer.after(50, (cx) => { this.across = true; cx.notify(); });
    });
  }

  render() {
    return div().id("sweep").relative().size_full()
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .child(div().id(`sweep-${this.pass}`).absolute().top(0).w(72).h(2).rounded(1).bg(theme().working)
        .left(this.across ? this.width : -72).transition("left", { duration: SWEEP_MS - 100, easing: "ease-in-out" }));
  }
}

const tabLabel = (a, tx) => (/^\d+$/.test(a.tab_name ?? "") ? tx.tabN(a.tab_name) : a.tab_name);

export default class Sessions extends View {
  init(_props, cx) {
    this.saved = {};   // terminal -> over9k's file for it
    this.agy = {};     // terminal -> agy-info.py's answer
    this.latest = null; // Antigravity's newest status line input
    this.codex = null; // Codex's configured model and effort
    this.subs = {};    // terminal -> its agent's own sub-agents
    this.tasks = {};   // terminal -> what its agent runs in the background, or has scheduled
    this.open = new Set(); // sessions whose finished sub-agents show
    this.sweep = cx.new(Sweep);
    this.lang = pickLang(props()?.lang);
    if (!this.lang && !props()?.demo) {
      // The last detection draws first so a Korean screen doesn't flash English.
      try { this.lang = pickLang(localStorage.getItem("lang")); } catch { /* English until detected */ }
      if (!checking()) cx.spawn(async (cx) => {
        this.lang = await detectLang();
        try { localStorage.setItem("lang", this.lang); } catch { /* not remembered */ }
        cx.notify();
      });
    }
    this.lang ??= "en";
    try { this.legend = localStorage.getItem("legend") === "on"; } catch { this.legend = false; }
    // List or diagram, as last picked; props().view picks it for a demo.
    try { this.view = props()?.view ?? localStorage.getItem("view"); } catch { /* the list */ }
    if (!VIEWS.includes(this.view)) this.view = "list";
    this.width = (props()?.width ?? 368) - 24; // the diagram's, until it is laid out
    // props().demo: made-up sessions, frozen at their start (screenshots, a recipe's checks).
    // Nothing is read or run for them, and clicks go nowhere.
    this.demo = props()?.demo ? demoData(Date.now() / 1000, this.lang) : null;
    if (this.demo) Object.assign(this, { saved: this.demo.saved, subs: this.demo.subs, tasks: this.demo.tasks });
    if (checking() || this.demo) return;
    this.refresh(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    // "3m ago" moves on by itself between changes.
    cx.timer.every(30000, (cx) => { if (visible()) cx.notify(); });
  }

  refresh(cx) {
    if (this.busy || !visible()) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const read = (path) => readTextFile(path).catch(() => null);
        const cache = `${home()}/.cache/over9k`, over9k = `${appHome()}/mods/over9k`;
        // Agents, and the terminals agents started (`hc run`): this computer's only.
        const all = [...agents(), ...terminals().filter((k) => k.parent && k.state === "live").map((k) => ({ ...k, app: k.report?.app ?? k.agent, plain: !(k.report || k.program?.agent) }))];
        const local = [...new Map(all.filter((a) => !a.address.includes("/")).map((a) => [a.address, a])).values()];
        const tx = TEXT[this.lang], saved = {}, subs = {}, tasks = {};
        for (const a of local) {
          const i = json(await read(`${cache}/agents/${a.address}.json`));
          if (!i) continue;
          saved[a.address] = i;
          if (!i.transcript) continue;
          // Claude Code's own sub-agents, and what it runs in the background: over9k's answers
          // for that transcript (subagents.sh, tasks.sh).
          const sum = cksum(i.transcript);
          const list = parseSubs(await read(`${cache}/subagents-${sum}`), { header: true, tx });
          if (list.length) subs[a.address] = list;
          const bg = parseTasks(await read(`${cache}/tasks-${sum}`));
          if (bg.length) tasks[a.address] = bg;
        }
        // Antigravity keeps nothing per terminal: over9k's script finds each agy's terminal
        // and conversation. Asked only while an agent that could be one is listed.
        let agy = {}, latest = null;
        if (local.some((a) => !a.plain && !saved[a.address]?.transcript && kind(a) !== "claude" && kind(a) !== "codex")) {
          agy = json((await exec("python3", ["-I", `${over9k}/agy-info.py`], { timeout: 10000 }).catch(() => null))?.stdout) ?? {};
          if (Object.keys(agy).length) latest = json(await read(`${home()}/.cache/agy-statusline/latest.json`));
        }
        for (const a of local) {
          const conversation = agy[a.address]?.conversation ?? (saved[a.address]?.agent === "antigravity" ? saved[a.address].conversation : null);
          if (!conversation) continue;
          const r = await exec("python3", ["-I", `${over9k}/agy-subagents.py`, a.address, conversation], { timeout: 10000 }).catch(() => null);
          const list = parseSubs(r?.stdout, { tx });
          if (list.length) subs[a.address] = list;
        }
        const codex = local.some((a) => kind(a) === "codex") ? codexDefaults(await read(`${home()}/.codex/config.toml`)) : null;
        const raw = JSON.stringify([this.lang, saved, agy, latest?.conversation_id, latest?.context_window?.used_percentage, codex, subs, tasks]);
        if (raw === this.raw) return;
        Object.assign(this, { raw, saved, agy, latest, codex, subs, tasks });
        cx.notify();
      } finally {
        this.busy = false;
      }
    });
  }

  // A click's command. A demo's sessions aren't there to go to.
  go(command, args) {
    if (!this.demo) run(command, args);
  }

  // Whether something a session's agent started still runs in the background, whatever the
  // agent itself is doing.
  working(address) {
    return (this.tasks[address] ?? []).some((k) => !scheduled(k));
  }

  facts(a) {
    return details(a, { saved: this.saved[a.address], agy: this.agy[a.address], latest: this.latest, codex: this.codex });
  }

  // What's under an agent: what it started in terminals of their own with `hc run` (another
  // agent to check its work, say; and what those started), then its own sub-agents, then its
  // background tasks (a shell command still running, a scheduled prompt).
  // A terminal that reports no state is running for as long as it lives.
  tree(address, terms, depth = 0) {
    const kids = depth > 3 ? [] : terms.filter((k) => k.parent === address).map((k) => {
      const live = k.state === "live";
      const d = this.facts({ address: k.address, app: k.report?.app ?? k.agent, program: k.program, title: k.title });
      const said = argvModel(k.foreground?.argv ?? k.argv);
      return { id: k.address, terminal: live ? k.address : null, program: k.program,
        name: k.name || k.template || d.title || clean(k.title) || k.program?.name || k.address,
        type: k.program?.name ?? null, model: d.model ?? said.model, effort: d.effort ?? said.effort, ultracode: d.ultracode,
        done: !live, status: !live ? (k.exit_code > 0 ? "blocked" : "done") : k.status === "error" ? "blocked" : k.status ?? "working",
        startedAt: k.created_ms ? k.created_ms / 1000 : null, lastAt: k.finished_ms ? k.finished_ms / 1000 : d.lastAt,
        children: live ? this.tree(k.address, terms, depth + 1) : [] };
    });
    return [...kids, ...(this.subs[address] ?? []).map((s) => ({ ...s, status: s.done ? "done" : "working", children: [] })),
      ...(this.tasks[address] ?? []).map((k) => ({ ...k, task: true, children: [] }))];
  }

  // What shows under a session or sub-agent: the running ones, then the finished ones behind a
  // fold, as the list and the diagram both draw it.
  under(nodes, owner) {
    const { live, done, finished, more } = foldSubs(nodes, this.open.has(owner));
    return [...live.map((n) => ({ n })), ...(finished ? [{ fold: finished, owner }] : []), ...done.map((n) => ({ n })), ...(more ? [{ more }] : [])];
  }

  toggleFold(owner, cx) {
    this.open.has(owner) ? this.open.delete(owner) : this.open.add(owner);
    cx.notify();
  }

  // A sub-agent's mark, and what stands beside its name: its model (else the program it is,
  // unless that's already its name) and how long it has run, or since it ended.
  subInfo(t, n, now) {
    const tx = TEXT[this.lang];
    const running = n.status === "working", failed = n.done && n.status === "blocked";
    const color = failed ? t.blocked : n.done ? t.dim : t[n.status] ?? t.dim;
    const dot = running ? div().size(6).rounded(3).bg(color).loop("opacity", { from: 0.35, to: 1, period: 1200 })
      : (n.done && !failed) || n.status === "idle" ? div().size(6).rounded(3).border(1).border_color(color) : div().size(6).rounded(3).bg(color);
    const what = n.model ?? (n.type && n.program && n.type !== n.name ? n.type : null);
    const when = n.done ? (n.lastAt ? ago(now - n.lastAt, tx) : "") : n.startedAt ? elapsed(now - n.startedAt, tx) : "";
    return { dot, failed, what, when };
  }

  // A sub-agent with a terminal of its own: to its pane if it was given one, else a peek at it.
  goSub(n) {
    this.go(this.listed.has(n.terminal) ? "agent.focus" : "terminal.peek", { terminal: n.terminal });
  }

  // The lines under a session: running sub-agents, then the finished ones behind a fold.
  subRows(t, nodes, owner, now, lead = []) {
    const tx = TEXT[this.lang], open = this.open.has(owner);
    const items = this.under(nodes, owner);
    return items.flatMap((item, i) => {
      const last = i === items.length - 1;
      const line = h_flex().h(SUB_H).flex_none().px(6).items_center().text_size(11).children([...lead, last ? "end" : "tee"].map((g) => guide(t, g)));
      if (item.fold) return [line.id(`fold-${owner}`).gap(3).cursor_pointer().text_color(t.dim).hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => this.toggleFold(owner, cx))
        .child(svg(CHEVRON(open)).size(10).flex_none().ml(1))
        .child(tx.doneN(item.fold))];
      if (item.more) return [line.child(div().pl(16).text_color(t.dim).child(tx.moreN(item.more)))];
      const n = item.n;
      if (n.task) {
        // A background task is no agent: its mark is what it is (a shell's prompt, a clock for
        // a scheduled one), its kind stands where a model would, then how long it has run.
        const waits = scheduled(n), what = tx.task[n.kind] ?? n.kind, when = taskWhen(n, now, tx);
        return [line.id(`task-${owner}-${n.id}`).gap(6)
          .tooltip([[what, n.name].filter(Boolean).join(" · "), n.kind === "cron" ? n.when : null, n.output].filter(Boolean).join("\n"))
          .child(h_flex().w(8).ml(2).flex_none().justify_center().when(!waits, (el) => el.loop("opacity", { from: 0.45, to: 1, period: 1200 }))
            .child(svg(`mods/workspace-chrome/${waits ? "clock" : "terminal"}.svg`).size(11).flex_none().text_color(waits ? t.muted : t.working)))
          .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.foreground).child(n.name ?? what))
          .when(Boolean(n.name), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.muted).child(what)))
          .when(Boolean(when), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child(when)))];
      }
      const { dot, failed, what, when } = this.subInfo(t, n, now);
      const row = line.id(`sub-${owner}-${n.id}`).gap(6).tooltip([n.type, n.name].filter(Boolean).join(" · "))
        .when(Boolean(n.terminal), (el) => el.cursor_pointer().rounded(5).hover((s) => s.bg(t.hover)).on_click(() => this.goSub(n)))
        .child(h_flex().w(8).ml(2).flex_none().justify_center().child(dot))
        .when(Boolean(n.program), (el) => el.child(icon(n.program, 12, n.done ? t.dim : t.foreground)))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(n.done ? t.dim : t.foreground).child(n.name))
        .when(failed, (el) => el.child(div().flex_none().text_size(10.5).text_color(t.blocked).child(tx.failed)))
        .when(Boolean(what), (el) => el.child(div().flex_none().max_w(120).truncate().text_size(10.5).text_color(n.done ? t.dim : t.muted).child(what)))
        .when(Boolean(n.model), (el) => el.child(effortMark(t, tx, `sub-effort-${owner}-${n.id}`, n.effort, { h: 8, color: n.done ? t.dim : t.muted, word: false }) ?? div().w(18.5).flex_none()))
        .when(Boolean(n.ultracode), (el) => el.child(ultraBadge(t, tx, `sub-ultra-${owner}-${n.id}`)))
        .when(Boolean(when), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child(when)));
      return [row, ...this.subRows(t, n.children, n.id, now, [...lead, last ? "none" : "pipe"])];
    });
  }

  // One session: its icon with the tree's rail under it, its lines beside, its sub-agents
  // below. `hero`: the current one, with the model large and everything known about it.
  // A session's name: the folder it was started in (the terminal's, not the agent's later cd),
  // else its title; that title and where it runs are its tooltip.
  naming(a, d, terms) {
    const tx = TEXT[this.lang];
    const live = d.title || clean(a.title);
    const named = live && live !== a.program?.name && live.toLowerCase() !== a.program?.key && live !== a.address;
    const folder = folderName(terms.find((k) => k.address === a.address)?.cwd, home());
    const name = folder ?? (named ? live : tx.newSession);
    const tip = `${name}${folder && named ? ` · ${live}` : ""}\n${[a.program?.name, a.space_name, tabLabel(a, tx), a.address].filter(Boolean).join(" · ")}`;
    return { named, folder, name, tip };
  }

  session(t, a, terms, tabs, now, hero = false) {
    const tx = TEXT[this.lang];
    const d = this.facts(a);
    const nodes = this.tree(a.address, terms);
    const { named, folder, name, tip } = this.naming(a, d, terms);
    const quiet = a.status === "idle" || !a.status;
    const tab = tabs.get(a.tab);
    const at = d.lastAt ?? (tab?.changed_at ? tab.changed_at / 1000 : null);
    const id = hero ? "hero" : `s-${a.address}`;
    const dot = () => div().flex_none().text_color(t.dim).child("·");
    // Its background tasks, said on its own line too: the agent may rest while they run.
    const bg = this.tasks[a.address] ?? [], busy = this.working(a.address);
    const tasks = (el) => (bg.length ? el.child(div().id(`${id}-tasks`).flex_none().flex().items_center().h(15).px(5).rounded(4)
      .bg(alpha(busy ? t.working : t.muted, "2e")).text_size(10).font_medium().text_color(busy ? t.working : t.muted)
      .child(taskBadge(bg, tx)).tooltip(tx.aboutTasks)) : el);

    const model = d.model
      ? div().min_w(0).truncate().text_color(d.guessed ? t.muted : t.foreground).child(d.model)
      : div().min_w(0).truncate().text_color(t.dim).child(tx.modelUnknown);
    const marks = (el) => el
      .when(d.guessed, (el) => el.child(div().id(`${id}-guess`).flex_none().text_size(10).text_color(t.dim).child(tx.guessed).tooltip(tx.guessedTip)))
      .when(effortLevel(d.effort) != null, (el) => el.child(effortMark(t, tx, `${id}-effort`, d.effort, hero ? { h: 12, text: t.foreground } : {})))
      .when(d.ultracode, (el) => el.child(ultraBadge(t, tx, `${id}-ultra`, hero ? "ULTRACODE" : "ULTRA")));

    let lines;
    if (hero) {
      const left = d.cacheUntil == null ? null : d.cacheUntil - now;
      const hint = d.model ? null : kind(a) === "other" ? tx.hintOther : tx.hintFirst;
      lines = v_flex().flex_1().min_w(0).gap(3).pb(4).overflow_hidden()
        .child(tasks(h_flex().h(18).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(13).font_weight(600).text_color(folder || named ? t.foreground : t.muted).child(name)))
          .child(statusMark(t, tx, a.status, true)))
        .child(marks(h_flex().h(22).gap(8).items_center().text_size(11)
          .child(model.text_size(16).font_weight(600)))
          .child(div().flex_1().min_w(0).truncate().text_right().text_color(t.muted).child(a.program?.name ?? a.app ?? "")))
        .child(h_flex().h(16).gap(6).items_center().text_size(11).text_color(t.muted)
          .when(d.context != null, (el) => el.child(contextMeter(t, tx, "hero-context", d.context, 34)).child(dot()))
          .child(div().min_w(0).truncate().child([a.space_name, tabLabel(a, tx)].filter(Boolean).join(" › ")))
          .when(Boolean(hint), (el) => el.child(dot()).child(div().flex_none().text_color(t.dim).child(hint)))
          .when(d.lastAt != null, (el) => el.child(dot()).child(div().flex_none().child(tx.replied(ago(now - d.lastAt, tx)))))
          .when(left != null, (el) => el.child(dot()).child(div().id("hero-cache").flex_none().tooltip(tx.aboutCache)
            .text_color(left <= 0 ? t.blocked : t.muted).child(left <= 0 ? tx.cacheExpired : left < 60 ? tx.cacheSoon : tx.cacheLeft(span(left, tx))))));
    } else {
      lines = v_flex().flex_1().min_w(0).gap(1).overflow_hidden()
        .child(tasks(h_flex().h(18).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(quiet ? t.muted : t.foreground).child(name)))
          .when(a.status === "working", (el) => el.child(div().flex_none().text_size(11).font_medium().text_color(t.working).child(tx.status.working)))
          .when(a.status !== "working" && a.status !== "blocked" && at != null, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(span(now - at, tx))))
          .child(h_flex().flex_none().min_w(14).justify_center().child(statusMark(t, tx, a.status))))
        .child(marks(h_flex().h(16).gap(8).items_center().text_size(11).text_color(t.muted)
          .child(model.flex_none().max_w(150).font_medium()))
          .when(d.context != null, (el) => el.child(contextMeter(t, tx, `${id}-context`, d.context, 20)))
          .child(div().flex_1().min_w(0).truncate().text_right().text_color(t.dim).child(a.space_name && a.space_name !== folder ? a.space_name : "")));
    }

    return v_flex().flex_none()
      .child(h_flex().id(id).items_stretch().gap(8).px(6).py(hero ? 2 : 4).rounded(6).cursor_pointer()
        .when(!hero && a.status === "working", (el) => el.bg(alpha(t.working, "14")))
        .hover((s) => s.bg(t.hover))
        .tooltip(tip)
        .on_click(() => this.go("agent.focus", { terminal: a.address }))
        .child(div().relative().w(GUT).flex_none()
          .child(h_flex().h(18).justify_center().child(icon(a.program, hero ? 16 : 14, t.foreground)))
          .when(nodes.length > 0, (el) => el.child(div().absolute().left(RAIL).top(21).bottom(hero ? -2 : -4).w(1).bg(t.input ?? t.border))))
        .child(lines))
      .children(this.subRows(t, nodes, a.address, now));
  }

  // The machine as a box on the left, its sessions in the next column, what each started and
  // its sub-agents further right, each joined to its parent by a curve: the current session
  // framed in the accent color, a line to something running drawn in the working color with a
  // pulse where it arrives.
  diagram(t, sessions, terms, now, current) {
    const tx = TEXT[this.lang];
    // One root per machine: a remote session's address starts with its machine's name.
    const machines = new Map();
    for (const a of sessions) {
      const on = a.address.includes("/") ? a.address.split("/")[0] : "";
      if (!machines.has(on)) machines.set(on, { machine: on, sessions: [] });
      machines.get(on).sessions.push({ a, nodes: this.tree(a.address, terms) });
    }
    const under = (x) => (x.sessions ?? (x.a ? this.under(x.nodes, x.a.address) : x.n ? this.under(x.n.children, x.n.id) : []));
    const { boxes, rows, depth: deepest } = placeTree([...machines.values()], under, 1);
    // The machine's column is narrow (its box says little); the others share what's left.
    const depth = Math.max(1, deepest);
    const w = Math.max(60, Math.floor((this.width - ROOT_W - GAP_X * depth) / depth));
    const width = (b) => (b.depth ? w : ROOT_W);
    const left = (b) => (b.depth ? ROOT_W + GAP_X + (b.depth - 1) * (w + GAP_X) : 0), mid = (b) => b.row * ROW + NODE_H / 2;
    const runs = (b) => b.x.a?.status === "working" || b.x.n?.status === "working" || (b.x.n?.task && !scheduled(b.x.n));
    const frame = (b, id, border) => v_flex().id(id).absolute().left(left(b)).top(b.row * ROW).w(width(b)).h(NODE_H).px(8).gap(2).justify_center()
      .rounded(6).bg(t.background).border(1).border_color(border).overflow_hidden();
    const second = (...parts) => div().min_w(0).truncate().text_size(10.5).text_color(t.muted).child(parts.filter(Boolean).join(" · "));

    // The curves, one path per color.
    const strokes = new Map();
    for (const b of boxes.filter((b) => b.parent)) {
      const color = runs(b) ? t.working : t.input ?? t.border;
      const x1 = left(b.parent) + width(b.parent), y1 = mid(b.parent), x2 = left(b), y2 = mid(b);
      strokes.set(color, (strokes.get(color) ?? PathBuilder.stroke(1)).move_to(x1, y1).cubic_bezier_to(x2, y2, x1 + GAP_X / 2, y1, x2 - GAP_X / 2, y2));
    }
    const pulses = boxes.filter((b) => b.parent && runs(b)).map((b) =>
      div().absolute().left(left(b) - 3).top(mid(b) - 3).size(6).rounded(3).bg(t.working).loop("opacity", { from: 0.25, to: 1, period: 1200 }));

    const nodes = boxes.map((b) => {
      const { machine, a, n, fold, owner, more } = b.x;
      if (b.x.sessions) return frame(b, `d-machine-${machine}`, t.input ?? t.border).bg(t.raised)
        .tooltip(machine || tx.thisComputer)
        .child(h_flex().gap(5).items_center()
          .child(svg(`mods/workspace-chrome/${machine ? "server" : "monitor"}.svg`).size(12).flex_none().text_color(t.muted))
          .child(div().flex_1().min_w(0).truncate().text_size(12).font_medium().child(machine || tx.thisComputer)))
        .child(second(tx.sessionsN(b.x.sessions.length)));
      if (a) {
        const d = this.facts(a), { folder, named, name, tip } = this.naming(a, d, terms);
        const quiet = a.status === "idle" || !a.status;
        const border = a === current ? t.accent : a.status === "blocked" ? t.blocked : a.status === "working" ? t.working : t.border;
        return frame(b, `d-${a.address}`, border).when(a === current, (el) => el.border(1.5)).cursor_pointer().hover((s) => s.bg(t.hover))
          .tooltip(tip).on_click(() => this.go("agent.focus", { terminal: a.address }))
          .child(h_flex().gap(5).items_center()
            .child(icon(a.program, 12, t.foreground))
            .child(div().flex_1().min_w(0).truncate().text_size(12).font_medium().text_color(folder || named ? (quiet ? t.muted : t.foreground) : t.muted).child(name))
            .child(statusMark(t, tx, a.status)))
          .child(h_flex().gap(5).items_center().text_size(10.5)
            .child(div().min_w(0).truncate().text_color(d.model ? t.muted : t.dim).child(d.model ?? tx.modelUnknown))
            .when(effortLevel(d.effort) != null, (el) => el.child(effortMark(t, tx, `d-${a.address}-effort`, d.effort, { h: 8, color: t.muted, word: false })))
            // Narrow boxes keep the model's name over the context meter.
            .when(d.context != null && w >= 150, (el) => el.child(div().flex_1()).child(contextMeter(t, tx, `d-${a.address}-context`, d.context, 16))));
      }
      if (fold) return h_flex().id(`d-fold-${owner}`).absolute().left(left(b)).top(mid(b) - 11).h(22).px(8).gap(4).items_center()
        .rounded(11).border(1).border_color(t.border).bg(t.background).cursor_pointer().text_size(11).text_color(t.dim)
        .hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => this.toggleFold(owner, cx))
        .child(svg(CHEVRON(this.open.has(owner))).size(10).flex_none()).child(tx.doneN(fold));
      if (more) return div().absolute().left(left(b) + 8).top(mid(b) - 8).text_size(11).text_color(t.dim).child(tx.moreN(more));
      if (n.task) {
        const waits = scheduled(n), what = tx.task[n.kind] ?? n.kind;
        return frame(b, `d-task-${n.id}`, waits ? t.border : alpha(t.working, "80"))
          .tooltip([[what, n.name].filter(Boolean).join(" · "), n.kind === "cron" ? n.when : null, n.output].filter(Boolean).join("\n"))
          .child(h_flex().gap(5).items_center()
            .child(svg(`mods/workspace-chrome/${waits ? "clock" : "terminal"}.svg`).size(11).flex_none().text_color(waits ? t.muted : t.working))
            .child(div().flex_1().min_w(0).truncate().text_size(11.5).child(n.name ?? what)))
          .child(second(n.name ? what : null, taskWhen(n, now, tx)));
      }
      const { dot, failed, what, when } = this.subInfo(t, n, now);
      return frame(b, `d-sub-${n.id}`, failed ? t.blocked : n.status === "working" ? alpha(t.working, "80") : t.border)
        .tooltip([n.type, n.name].filter(Boolean).join(" · "))
        .when(Boolean(n.terminal), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => this.goSub(n)))
        .child(h_flex().gap(5).items_center()
          .child(h_flex().w(6).flex_none().justify_center().child(dot))
          .when(Boolean(n.program), (el) => el.child(icon(n.program, 11, n.done ? t.dim : t.foreground)))
          .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(n.done ? t.dim : t.foreground).child(n.name)))
        .child(second(failed ? tx.failed : null, what, when));
    });

    const paint = ([color, path]) => window.paint_path(path.build(), color).absolute().top(0).left(0).size_full();
    return div().id("diagram").relative().mx(6).mt(4).flex_none().h(Math.max(NODE_H, rows * ROW - (ROW - NODE_H)))
      .on_size_change((size, cx) => {
        const width = size.width / (settings().zoom || 1);
        if (Math.abs(width - this.width) >= 1) { this.width = width; cx.notify(); }
      })
      .children([...strokes].map(paint)).children(pulses).children(nodes);
  }

  // List or diagram: two buttons side by side, the shown one raised.
  viewToggle(t) {
    const tx = TEXT[this.lang];
    const button = (view) => div().id(`view-${view}`).h(18).px(7).flex().items_center().rounded(4).cursor_pointer().text_size(11)
      .text_color(this.view === view ? t.foreground : t.muted).when(this.view === view, (el) => el.bg(t.background))
      .hover((s) => s.text_color(t.foreground))
      .on_click((_e, cx) => {
        this.view = view;
        try { localStorage.setItem("view", view); } catch { /* not remembered */ }
        cx.notify();
      })
      .child(tx[view]);
    return h_flex().flex_none().p(2).gap(2).rounded(6).bg(t.raised).children(VIEWS.map(button));
  }

  legendBox(t) {
    const tx = TEXT[this.lang];
    const text = (s) => div().flex_1().min_w(0).child(s);
    return v_flex().mx(6).mb(10).px(10).py(8).gap(7).rounded(6).bg(t.raised).text_size(11).text_color(t.muted)
      .child(h_flex().flex_wrap().gap_x(10).gap_y(4).items_center().children(EFFORTS.map((e) => effortMark(t, tx, `legend-${e}`, e, { text: t.foreground }))))
      .child(div().child(tx.aboutEffort))
      .child(h_flex().gap(8).items_start().child(div().pt(1).child(ultraBadge(t, tx, "legend-ultra"))).child(text(tx.aboutUltra)))
      .child(h_flex().gap(8).items_start().child(div().h(16).flex().items_center().child(contextMeter(t, tx, "legend-context", 35))).child(text(tx.aboutContext)))
      .child(h_flex().gap(8).items_start().child(div().flex_none().text_color(t.foreground).child(tx.cacheExample)).child(text(tx.aboutCache)));
  }

  render() {
    const t = theme();
    const tx = TEXT[this.lang];
    const demo = this.demo;
    const now = demo?.now ?? Date.now() / 1000;
    const list = demo?.list ?? agents();
    const terms = demo?.terms ?? terminals();
    const tabs = new Map((demo?.tabs ?? spaces().flatMap((s) => s.tabs)).map((tab) => [tab.id, tab]));
    const current = pickCurrent(list, demo?.focus ?? focused());
    // An agent another listed agent started shows under that one.
    const listed = this.listed = new Set(list.map((a) => a.address));
    const nested = new Set(terms.filter((k) => k.state === "live" && k.parent && listed.has(k.parent)).map((k) => k.address));
    const others = sortSessions(list.filter((a) => a !== current && !nested.has(a.address)), (a) => this.working(a.address));
    const count = (s) => others.filter((a) => a.status === s).length;

    const title = (text) => div().text_size(14).font_weight(600).text_color(t.foreground).child(text);
    const header = (...kids) => h_flex().h(22).px(6).mb(6).gap(8).items_center().flex_none().children(kids.filter(Boolean));
    const note = (text) => div().px(6).pb(2).text_size(11).text_color(t.muted).child(text);
    const working = current?.status === "working";

    // A demo can be given the width of the panel it is pictured as (props().width).
    const root = v_flex().id("root").size_full().when(Boolean(demo && props().width), (el) => el.w(props().width)).bg(t.background).text_color(t.foreground);
    if (!list.length) return root.items_center().justify_center().gap(6).px(28)
      .child(svg("icons/agent.svg").size(26).text_color(t.dim).mb(4))
      .child(div().text_size(13).font_weight(600).text_color(t.foreground).child(tx.emptyTitle))
      .child(div().text_size(11).text_center().text_color(t.muted).child(tx.emptyBody));

    const diagram = this.view === "diagram";
    const total = others.length + (current ? 1 : 0);
    return root.child(v_flex().id("sessions-scroll").flex_1().min_h(0).px(6).py(12).overflow_y_scrollbar()
      .child(header(title(diagram ? tx.all : tx.current),
        diagram ? div().px(6).py(1).rounded(4).bg(t.raised).text_size(11).text_color(t.muted).child(String(total)) : null,
        div().flex_1(), this.viewToggle(t),
        h_flex().id("legend-toggle").h(20).px(6).gap(3).items_center().rounded(5).cursor_pointer().text_size(11)
          .text_color(this.legend ? t.foreground : t.muted).when(this.legend, (el) => el.bg(t.raised)).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .tooltip(tx.legendTip)
          .on_click((_e, cx) => {
            this.legend = !this.legend;
            try { localStorage.setItem("legend", this.legend ? "on" : "off"); } catch { /* not remembered */ }
            cx.notify();
          })
          .child(tx.guide).child(svg(CHEVRON(this.legend)).size(10).flex_none())))
      .when(this.legend, (el) => el.child(this.legendBox(t)))
      .when(diagram, (el) => el.child(this.diagram(t, [current, ...others].filter(Boolean), terms, now, current)))
      .when(!diagram, (el) => el
      // The line under the title runs while the current session works.
      .child(div().relative().h(2).mx(6).mb(6).flex_none().rounded(1).overflow_hidden().when(working, (el) => el.bg(alpha(t.working, "24"))
        .child(this.sweep)))
      .child(current ? this.session(t, current, terms, tabs, now, true) : note(tx.noneHere))
      .child(div().h(1).mx(6).my(12).flex_none().bg(t.border))
      .child(header(title(tx.others),
        others.length ? div().px(6).py(1).rounded(4).bg(t.raised).text_size(11).text_color(t.muted).child(String(others.length)) : null,
        div().flex_1(),
        count("blocked") ? div().text_size(11).text_color(t.blocked).child(`${tx.status.blocked} ${count("blocked")}`) : null,
        count("working") ? div().text_size(11).text_color(t.working).child(`${tx.status.working} ${count("working")}`) : null))
      .when(!others.length, (el) => el.child(note(tx.noOthers)))
      .child(v_flex().gap(2).children(others.map((a) => this.session(t, a, terms, tabs, now))))));
  }
}
