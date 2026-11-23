// Which model each coding-agent session runs: the one the person is on, in full, then every
// other one, most urgent first, each with its sub-agents as a tree under it.
// Herdr gives the sessions and their state. Their model, effort, ultracode, context and
// sub-agents are read from what the over9k sidebar already keeps in ~/.cache/over9k (it runs
// claude-info.py and subagents.sh every few seconds); Antigravity's come from over9k's
// agy-info.py and agy-subagents.py, run here, and Codex's from its terminal title or config.
import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, spaces, panes, focused, layout, props, theme, run, exec, home, appHome, readTextFile, checking } from "herdr";
import { EFFORTS, effortLevel, span, ago, cksum, parseSubs, clean, codexDefaults, argvModel, kind, details, sortSessions, pickCurrent, foldSubs, folderName, parseTasks, scheduled, taskBadge, taskWhen, demoData } from "./lib.js";

const MOD = "sessions";
const POLL_MS = 5000;
const STATUS = { working: "작업 중", blocked: "확인 필요", done: "완료", idle: "대기" };
const TASK = { shell: "셸 작업", monitor: "모니터", cron: "예약", wakeup: "예약" }; // a background task's kind
const GUT = 16;   // the icon column, and one tree level's guide
const RAIL = 7;   // the guide line's x in it: under the icon's middle
const SUB_H = 20; // a sub-agent's line
const CHEVRON = (open) => `mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`;
const ABOUT_EFFORT = "추론 강도(effort): 답하기 전에 생각하는 깊이. 높을수록 꼼꼼하지만 느리고 토큰을 더 써요.";
const ABOUT_ULTRA = "Claude Code의 /effort ultracode 모드. 작업마다 서브에이전트 워크플로로 교차 검증까지 해서, 가장 꼼꼼하고 토큰을 가장 많이 써요.";
const ABOUT_CONTEXT = "컨텍스트 창을 채운 정도. 가득 차면 대화가 압축돼요.";
const ABOUT_TASKS = "에이전트가 띄워 둔 백그라운드 작업(셸 명령, 모니터)이나 예약이에요. 에이전트가 쉬는 중이어도 계속 돌아요.";
const ABOUT_CACHE = "프롬프트 캐시가 남은 시간. 지나면 다음 메시지가 대화 전체를 다시 읽어 토큰이 더 들어요.";

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
function effortMark(t, id, effort, { h = 10, color = t.foreground, text = t.muted, word = true } = {}) {
  const level = effortLevel(effort);
  if (level == null) return null;
  const w = h > 10 ? 3 : 2.5;
  return h_flex().id(id).flex_none().gap(4).items_center().tooltip(`추론 강도 ${effort} (${level}/5)`)
    .child(h_flex().h(h).gap(1.5).items_end().children(EFFORTS.map((_, i) =>
      div().w(w).h(Math.round(h * (0.4 + 0.15 * i) * 2) / 2).rounded(1).bg(i < level ? color : alpha(t.muted, "40")))))
    .when(word, (el) => el.child(div().text_color(text).child(effort.toLowerCase())));
}

function ultraBadge(t, id, label = "ULTRA") {
  const c = t.ansi5 ?? t.accent;
  return div().id(id).flex_none().flex().items_center().h(15).px(5).rounded(4).bg(alpha(c, "2e"))
    .text_size(9.5).font_bold().text_color(c).child(label).tooltip(ABOUT_ULTRA);
}

// Context used: a small meter and its percent, warmer as it fills (as the usage block above).
function contextMeter(t, id, pct, width = 28) {
  const color = pct >= 85 ? t.blocked : pct >= 60 ? t.working : t.muted;
  return h_flex().id(id).flex_none().gap(4).items_center().tooltip(`컨텍스트 ${pct}% 사용`)
    .child(div().w(width).h(4).rounded(2).bg(alpha(t.muted, "40")).overflow_hidden()
      .child(div().h_full().rounded(2).bg(color).w(`${Math.min(100, Math.max(pct, 4))}%`)))
    .child(div().text_color(color).child(`${pct}%`));
}

// A state as its mark: a spinner while working, a pulsing pill when it needs the person,
// a dot once done, a ring while idle. `label`: with its word.
function statusMark(t, status, label = false) {
  const color = t[status] ?? t.dim;
  const word = (el) => (label ? h_flex().flex_none().gap(5).items_center().child(el).child(div().text_size(11).font_medium().text_color(color).child(STATUS[status] ?? "상태 없음")) : el);
  if (status === "working") return word(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900));
  if (status === "blocked") return div().flex_none().flex().items_center().h(17).px(6).rounded(5).bg(alpha(t.blocked, "2e"))
    .text_size(10.5).font_semibold().text_color(t.blocked).child(STATUS.blocked).loop("opacity", { from: 0.55, to: 1, period: 1400 });
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

const tabLabel = (a) => (/^\d+$/.test(a.tab_name ?? "") ? `탭 ${a.tab_name}` : a.tab_name);

export default class Sessions extends View {
  init(_props, cx) {
    this.saved = {};   // terminal -> over9k's file for it
    this.agy = {};     // terminal -> agy-info.py's answer
    this.latest = null; // Antigravity's newest status line input
    this.codex = null; // Codex's configured model and effort
    this.subs = {};    // terminal -> its agent's own sub-agents
    this.tasks = {};   // terminal -> what its agent runs in the background, or has scheduled
    this.open = new Set(); // sessions whose finished sub-agents show
    this.width = 368;
    try { this.legend = localStorage.getItem("legend") === "on"; } catch { this.legend = false; }
    // props().demo: made-up sessions, frozen at their start (screenshots, a recipe's checks).
    // Nothing is read or run for them, and clicks go nowhere.
    this.demo = props()?.demo ? demoData(Date.now() / 1000) : null;
    if (this.demo) Object.assign(this, { saved: this.demo.saved, subs: this.demo.subs, tasks: this.demo.tasks });
    if (checking() || this.demo) return;
    this.refresh(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    // "3분 전" moves on by itself between changes.
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
        const saved = {}, subs = {}, tasks = {};
        for (const a of local) {
          const i = json(await read(`${cache}/agents/${a.address}.json`));
          if (!i) continue;
          saved[a.address] = i;
          if (!i.transcript) continue;
          // Claude Code's own sub-agents, and what it runs in the background: over9k's answers
          // for that transcript (subagents.sh, tasks.sh).
          const sum = cksum(i.transcript);
          const list = parseSubs(await read(`${cache}/subagents-${sum}`), { header: true });
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
          const list = parseSubs(r?.stdout);
          if (list.length) subs[a.address] = list;
        }
        const codex = local.some((a) => kind(a) === "codex") ? codexDefaults(await read(`${home()}/.codex/config.toml`)) : null;
        const raw = JSON.stringify([saved, agy, latest?.conversation_id, latest?.context_window?.used_percentage, codex, subs, tasks]);
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

  // The lines under a session: running sub-agents, then the finished ones behind a fold.
  subRows(t, nodes, owner, now, lead = []) {
    const open = this.open.has(owner);
    const { live, done, finished, more } = foldSubs(nodes, open);
    const items = [...live.map((n) => ({ n })), ...(finished ? [{ fold: finished }] : []), ...done.map((n) => ({ n })), ...(more ? [{ more }] : [])];
    return items.flatMap((item, i) => {
      const last = i === items.length - 1;
      const line = h_flex().h(SUB_H).flex_none().px(6).items_center().text_size(11).children([...lead, last ? "end" : "tee"].map((g) => guide(t, g)));
      if (item.fold) return [line.id(`fold-${owner}`).gap(3).cursor_pointer().text_color(t.dim).hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => { open ? this.open.delete(owner) : this.open.add(owner); cx.notify(); })
        .child(svg(CHEVRON(open)).size(10).flex_none().ml(1))
        .child(`완료 ${item.fold}개`)];
      if (item.more) return [line.child(div().pl(16).text_color(t.dim).child(`그 밖에 ${item.more}개`))];
      const n = item.n;
      if (n.task) {
        // A background task is no agent: its mark is what it is (a shell's prompt, a clock for
        // a scheduled one), its kind stands where a model would, then how long it has run.
        const waits = scheduled(n), what = TASK[n.kind] ?? n.kind, when = taskWhen(n, now);
        return [line.id(`task-${owner}-${n.id}`).gap(6)
          .tooltip([[what, n.name].filter(Boolean).join(" · "), n.kind === "cron" ? n.when : null, n.output].filter(Boolean).join("\n"))
          .child(h_flex().w(8).ml(2).flex_none().justify_center().when(!waits, (el) => el.loop("opacity", { from: 0.45, to: 1, period: 1200 }))
            .child(svg(`mods/workspace-chrome/${waits ? "clock" : "terminal"}.svg`).size(11).flex_none().text_color(waits ? t.muted : t.working)))
          .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.foreground).child(n.name ?? what))
          .when(Boolean(n.name), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.muted).child(what)))
          .when(Boolean(when), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child(when)))];
      }
      const running = n.status === "working", failed = n.done && n.status === "blocked";
      const color = failed ? t.blocked : n.done ? t.dim : t[n.status] ?? t.dim;
      // Its model, else the program it is (unless that's already its name).
      const what = n.model ?? (n.type && n.program && n.type !== n.name ? n.type : null);
      const when = n.done ? (n.lastAt ? ago(now - n.lastAt) : "") : n.startedAt ? `${span(now - n.startedAt)}${now - n.startedAt < 60 ? "" : "째"}` : "";
      const row = line.id(`sub-${owner}-${n.id}`).gap(6).tooltip([n.type, n.name].filter(Boolean).join(" · "))
        // A terminal of its own: to its pane if it was given one, else a peek at it.
        .when(Boolean(n.terminal), (el) => el.cursor_pointer().rounded(5).hover((s) => s.bg(t.hover))
          .on_click(() => this.go(this.listed.has(n.terminal) ? "agent.focus" : "terminal.peek", { terminal: n.terminal })))
        .child(h_flex().w(8).ml(2).flex_none().justify_center()
          .child(running ? div().size(6).rounded(3).bg(color).loop("opacity", { from: 0.35, to: 1, period: 1200 })
            : (n.done && !failed) || n.status === "idle" ? div().size(6).rounded(3).border(1).border_color(color) : div().size(6).rounded(3).bg(color)))
        .when(Boolean(n.program), (el) => el.child(icon(n.program, 12, n.done ? t.dim : t.foreground)))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(n.done ? t.dim : t.foreground).child(n.name))
        .when(failed, (el) => el.child(div().flex_none().text_size(10.5).text_color(t.blocked).child("실패")))
        .when(Boolean(what), (el) => el.child(div().flex_none().max_w(120).truncate().text_size(10.5).text_color(n.done ? t.dim : t.muted).child(what)))
        .when(Boolean(n.model), (el) => el.child(effortMark(t, `sub-effort-${owner}-${n.id}`, n.effort, { h: 8, color: n.done ? t.dim : t.muted, word: false }) ?? div().w(18.5).flex_none()))
        .when(Boolean(n.ultracode), (el) => el.child(ultraBadge(t, `sub-ultra-${owner}-${n.id}`)))
        .when(Boolean(when), (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child(when)));
      return [row, ...this.subRows(t, n.children, n.id, now, [...lead, last ? "none" : "pipe"])];
    });
  }

  // One session: its icon with the tree's rail under it, its lines beside, its sub-agents
  // below. `hero`: the current one, with the model large and everything known about it.
  session(t, a, terms, tabs, now, hero = false) {
    const d = this.facts(a);
    const nodes = this.tree(a.address, terms);
    const live = d.title || clean(a.title);
    const named = live && live !== a.program?.name && live.toLowerCase() !== a.program?.key && live !== a.address;
    // Named by the folder it was started in (the terminal's, not the agent's later cd); the
    // session's own title stays in the tooltip.
    const folder = folderName(terms.find((k) => k.address === a.address)?.cwd, home());
    const name = folder ?? (named ? live : "새 세션");
    const quiet = a.status === "idle" || !a.status;
    const tab = tabs.get(a.tab);
    const at = d.lastAt ?? (tab?.changed_at ? tab.changed_at / 1000 : null);
    const id = hero ? "hero" : `s-${a.address}`;
    const dot = () => div().flex_none().text_color(t.dim).child("·");
    // Its background tasks, said on its own line too: the agent may rest while they run.
    const bg = this.tasks[a.address] ?? [], busy = this.working(a.address);
    const tasks = (el) => (bg.length ? el.child(div().id(`${id}-tasks`).flex_none().flex().items_center().h(15).px(5).rounded(4)
      .bg(alpha(busy ? t.working : t.muted, "2e")).text_size(10).font_medium().text_color(busy ? t.working : t.muted)
      .child(taskBadge(bg)).tooltip(ABOUT_TASKS)) : el);

    const model = d.model
      ? div().min_w(0).truncate().text_color(d.guessed ? t.muted : t.foreground).child(d.model)
      : div().min_w(0).truncate().text_color(t.dim).child("모델 확인 전");
    const marks = (el) => el
      .when(d.guessed, (el) => el.child(div().id(`${id}-guess`).flex_none().text_size(10).text_color(t.dim).child("기본값").tooltip("Codex 설정(config.toml)의 기본 모델이에요. 세션 안에서 바꿨다면 다를 수 있어요.")))
      .when(effortLevel(d.effort) != null, (el) => el.child(effortMark(t, `${id}-effort`, d.effort, hero ? { h: 12, text: t.foreground } : {})))
      .when(d.ultracode, (el) => el.child(ultraBadge(t, `${id}-ultra`, hero ? "ULTRACODE" : "ULTRA")));

    let lines;
    if (hero) {
      const left = d.cacheUntil == null ? null : d.cacheUntil - now;
      const hint = d.model ? null : kind(a) === "other" ? "이 에이전트는 모델 정보를 알려 주지 않아요" : "첫 응답이 오면 모델과 컨텍스트가 표시돼요";
      lines = v_flex().flex_1().min_w(0).gap(3).pb(4).overflow_hidden()
        .child(tasks(h_flex().h(18).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(13).font_weight(600).text_color(folder || named ? t.foreground : t.muted).child(name)))
          .child(statusMark(t, a.status, true)))
        .child(marks(h_flex().h(22).gap(8).items_center().text_size(11)
          .child(model.text_size(16).font_weight(600)))
          .child(div().flex_1().min_w(0).truncate().text_right().text_color(t.muted).child(a.program?.name ?? a.app ?? "")))
        .child(h_flex().h(16).gap(6).items_center().text_size(11).text_color(t.muted)
          .when(d.context != null, (el) => el.child(contextMeter(t, "hero-context", d.context, 34)).child(dot()))
          .child(div().min_w(0).truncate().child([a.space_name, tabLabel(a)].filter(Boolean).join(" › ")))
          .when(Boolean(hint), (el) => el.child(dot()).child(div().flex_none().text_color(t.dim).child(hint)))
          .when(d.lastAt != null, (el) => el.child(dot()).child(div().flex_none().child(`응답 ${ago(now - d.lastAt)}`)))
          .when(left != null, (el) => el.child(dot()).child(div().id("hero-cache").flex_none().tooltip(ABOUT_CACHE)
            .text_color(left <= 0 ? t.blocked : t.muted).child(left <= 0 ? "캐시 만료" : left < 60 ? "캐시 곧 만료" : `캐시 ${span(left)}`))));
    } else {
      lines = v_flex().flex_1().min_w(0).gap(1).overflow_hidden()
        .child(tasks(h_flex().h(18).gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(quiet ? t.muted : t.foreground).child(name)))
          .when(a.status === "working", (el) => el.child(div().flex_none().text_size(11).font_medium().text_color(t.working).child(STATUS.working)))
          .when(a.status !== "working" && a.status !== "blocked" && at != null, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(span(now - at))))
          .child(h_flex().flex_none().min_w(14).justify_center().child(statusMark(t, a.status))))
        .child(marks(h_flex().h(16).gap(8).items_center().text_size(11).text_color(t.muted)
          .child(model.flex_none().max_w(150).font_medium()))
          .when(d.context != null, (el) => el.child(contextMeter(t, `${id}-context`, d.context, 20)))
          .child(div().flex_1().min_w(0).truncate().text_right().text_color(t.dim).child(a.space_name && a.space_name !== folder ? a.space_name : "")));
    }

    return v_flex().flex_none()
      .child(h_flex().id(id).items_stretch().gap(8).px(6).py(hero ? 2 : 4).rounded(6).cursor_pointer()
        .when(!hero && a.status === "working", (el) => el.bg(alpha(t.working, "14")))
        .hover((s) => s.bg(t.hover))
        .tooltip(`${name}${folder && named ? ` · ${live}` : ""}\n${[a.program?.name, a.space_name, tabLabel(a), a.address].filter(Boolean).join(" · ")}`)
        .on_click(() => this.go("agent.focus", { terminal: a.address }))
        .child(div().relative().w(GUT).flex_none()
          .child(h_flex().h(18).justify_center().child(icon(a.program, hero ? 16 : 14, t.foreground)))
          .when(nodes.length > 0, (el) => el.child(div().absolute().left(RAIL).top(21).bottom(hero ? -2 : -4).w(1).bg(t.input ?? t.border))))
        .child(lines))
      .children(this.subRows(t, nodes, a.address, now));
  }

  legendBox(t) {
    const text = (s) => div().flex_1().min_w(0).child(s);
    return v_flex().mx(6).mb(10).px(10).py(8).gap(7).rounded(6).bg(t.raised).text_size(11).text_color(t.muted)
      .child(h_flex().flex_wrap().gap_x(10).gap_y(4).items_center().children(EFFORTS.map((e) => effortMark(t, `legend-${e}`, e, { text: t.foreground }))))
      .child(div().child(ABOUT_EFFORT))
      .child(h_flex().gap(8).items_start().child(div().pt(1).child(ultraBadge(t, "legend-ultra"))).child(text(ABOUT_ULTRA)))
      .child(h_flex().gap(8).items_start().child(div().h(16).flex().items_center().child(contextMeter(t, "legend-context", 35))).child(text(ABOUT_CONTEXT)))
      .child(h_flex().gap(8).items_start().child(div().flex_none().text_color(t.foreground).child("캐시 52분")).child(text(ABOUT_CACHE)));
  }

  render() {
    const t = theme();
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
    const root = v_flex().id("root").size_full().when(Boolean(demo && props().width), (el) => el.w(props().width)).bg(t.background).text_color(t.foreground)
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } });
    if (!list.length) return root.items_center().justify_center().gap(6).px(28)
      .child(svg("icons/agent.svg").size(26).text_color(t.dim).mb(4))
      .child(div().text_size(13).font_weight(600).text_color(t.foreground).child("실행 중인 에이전트 세션이 없어요"))
      .child(div().text_size(11).text_center().text_color(t.muted).child("터미널에서 Claude Code, Antigravity, Codex를 시작하면 어떤 모델로 돌고 있는지 여기에 표시돼요."));

    return root.child(v_flex().id("sessions-scroll").flex_1().min_h(0).px(6).py(12).overflow_y_scrollbar()
      .child(header(title("현재 세션"), div().flex_1(),
        h_flex().id("legend-toggle").h(20).px(6).gap(3).items_center().rounded(5).cursor_pointer().text_size(11)
          .text_color(this.legend ? t.foreground : t.muted).when(this.legend, (el) => el.bg(t.raised)).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .tooltip("추론 강도·ULTRACODE·컨텍스트 표시가 무슨 뜻인지 보여 줘요")
          .on_click((_e, cx) => {
            this.legend = !this.legend;
            try { localStorage.setItem("legend", this.legend ? "on" : "off"); } catch { /* not remembered */ }
            cx.notify();
          })
          .child("안내").child(svg(CHEVRON(this.legend)).size(10).flex_none())))
      .when(this.legend, (el) => el.child(this.legendBox(t)))
      // The line under the title runs while the current session works.
      .child(div().relative().h(2).mx(6).mb(6).flex_none().rounded(1).overflow_hidden().when(working, (el) => el.bg(alpha(t.working, "24"))
        .child(div().absolute().top(0).w(72).h(2).rounded(1).bg(t.working).loop("left", { from: -72, to: this.width, period: 3200 }))))
      .child(current ? this.session(t, current, terms, tabs, now, true) : note("이 스페이스에는 에이전트 세션이 없어요"))
      .child(div().h(1).mx(6).my(12).flex_none().bg(t.border))
      .child(header(title("다른 세션"),
        others.length ? div().px(6).py(1).rounded(4).bg(t.raised).text_size(11).text_color(t.muted).child(String(others.length)) : null,
        div().flex_1(),
        count("blocked") ? div().text_size(11).text_color(t.blocked).child(`${STATUS.blocked} ${count("blocked")}`) : null,
        count("working") ? div().text_size(11).text_color(t.working).child(`${STATUS.working} ${count("working")}`) : null))
      .when(!others.length, (el) => el.child(note("다른 세션이 없어요")))
      .child(v_flex().gap(2).children(others.map((a) => this.session(t, a, terms, tabs, now)))));
  }
}
