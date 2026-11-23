// AI plan usage at a glance: Claude Code's limits and Antigravity's quota buckets, as bars with
// reset countdowns. The overall limits come from the file each status line saves on every refresh
// (~/.claude/statusline-usage.sh, ~/.gemini/antigravity-cli/statusline-usage.sh); Claude's
// per-model weekly limits (Fable, ...) from Claude Code's own /usage (plan-usage.py), which the
// status line doesn't carry. Per-model rows fold away under "모델별".
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { home, appHome, readTextFile, watchFolder, exec, theme, checking, layout, settings, run, props } from "herdr";

const SOURCES = {
  claude: { dir: ".claude/state", file: "statusline-latest.json" },
  agy: { dir: ".cache/agy-statusline", file: "latest.json" },
};
const WINDOW = { five_hour: "5시간", seven_day: "7일", "5h": "5시간", "7d": "7일", weekly: "7일" };
// agy's quota groups: gemini-* for every Gemini model, 3p-* shared by Claude and GPT in agy.
const AGY_GROUP = { gemini: "Gemini", "3p": "Claude·GPT" };
const MOD = "ai-usage";
// The token split's model colors, warm like Claude's own palette (the theme has no orange or beige).
export const MODEL_COLOR = { fable: "#e5484d", opus: "#f0883e", sonnet: "#f2c94c", haiku: "#e6d5a8" };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

// "2시간 5분", "3일 4시간", "12분"
export function span(sec) {
  const s = Math.max(0, Math.round(sec));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return h ? `${d}일 ${h}시간` : `${d}일`;
  if (h) return m ? `${h}시간 ${m}분` : `${h}시간`;
  return `${Math.max(m, 1)}분`;
}

// One limit: pct used (0-100; 0 once its reset has passed, whatever the file still says) and
// seconds left to its reset (null when unknown or passed).
export function limit(usedPct, resetSec, nowSec) {
  if (usedPct == null || Number.isNaN(Number(usedPct))) return null;
  const over = resetSec != null && resetSec <= nowSec;
  return { pct: over ? 0 : Math.min(100, Math.max(0, Math.round(usedPct))), left: resetSec == null || over ? null : resetSec - nowSec };
}

// "default_claude_max_5x" -> "Max 5x"; claude_max -> "Max", claude_pro -> "Pro".
export function claudePlan(account) {
  const tier = /max_(\d+x)/.exec(account?.organizationRateLimitTier ?? "");
  if (tier) return `Max ${tier[1]}`;
  return { claude_max: "Max", claude_pro: "Pro" }[account?.organizationType] ?? null;
}

// "claude-fable-5-2" -> "Fable 5.2", "claude-opus-4-5-20251101" -> "Opus 4.5".
export function modelName(id) {
  const m = /^claude-([a-z]+)-(\d+)-(\d{1,2})(?!\d)/.exec(id ?? "");
  return m ? `${cap(m[1])} ${m[2]}.${m[3]}` : id;
}

// Each model's share of the tokens model-usage.py counted in a window, biggest first.
export function modelSplit(tokens) {
  const by = {};
  for (const [id, n] of Object.entries(tokens ?? {})) {
    const name = modelName(id);
    by[name] ??= { id, name, tokens: 0 };
    by[name].tokens += n;
  }
  const all = Object.values(by).filter((p) => p.tokens > 0).sort((a, b) => b.tokens - a.tokens);
  const sum = all.reduce((s, p) => s + p.tokens, 0);
  return all.map((p) => ({ ...p, pct: Math.round((p.tokens / sum) * 100) }));
}

// The shared limits from the status line: five_hour, seven_day.
export function claudeRows(rl, nowSec) {
  return ["five_hour", "seven_day"].map((k) => ({
    label: `Claude ${WINDOW[k]}`,
    lim: limit(rl?.[k]?.used_percentage, Number(rl?.[k]?.resets_at) || null, nowSec),
  }));
}

// Per-model limits from /usage (plan-usage.py): "Current week (Fable)" -> "Fable 7일".
export function claudeModelRows(windows, nowSec) {
  return (windows ?? []).filter((w) => w.model)
    .map((w) => ({ label: `${w.model} ${WINDOW[w.window] ?? w.window}`, lim: limit(w.pct, w.resets_at ?? null, nowSec) }));
}

// One row per bucket agy reports, Gemini before Claude·GPT; `model` marks per-model buckets
// (gemini-argon-wtu-weekly -> "Gemini Argon 7일"), the rest are a whole group's.
export function agyRows(q, nowSec) {
  const used = (b) => {
    const t = Date.parse(b?.reset_time ?? "");
    return limit((1 - (b?.remaining_fraction ?? 1)) * 100, Number.isNaN(t) ? null : t / 1000, nowSec);
  };
  const order = (g) => { const i = Object.keys(AGY_GROUP).indexOf(g); return i < 0 ? 99 : i; };
  return Object.keys(q ?? {})
    .map((k) => { const parts = k.split("-"); return { k, group: parts[0], win: parts.at(-1), model: parts.length > 2 ? parts[1] : "" }; })
    .sort((a, b) => order(a.group) - order(b.group) || (a.model ? 1 : 0) - (b.model ? 1 : 0) || a.k.localeCompare(b.k))
    .map(({ k, group, win, model }) => ({
      label: [AGY_GROUP[group] ?? cap(group), cap(model), WINDOW[win] ?? win].filter(Boolean).join(" "),
      lim: used(q[k]),
      model: Boolean(model),
      group,
    }));
}

// This block's id in the shown layout, to size it to its content.
function blockId(node) {
  if (node?.content?.mod === MOD) return node.id;
  for (const c of node?.children ?? []) { const id = blockId(c); if (id) return id; }
  return null;
}

export default class AiUsage extends View {
  init(_props, cx) {
    this.data = {};
    this.savedAt = {};
    this.claudePlan = null;
    this.plan = null;
    this.split = null;
    this.open = { claude: false, agy: false };
    if (props()?.demo) { this.demo(Date.now() / 1000); return; }
    try { Object.assign(this.open, JSON.parse(localStorage.getItem("open") ?? "{}")); } catch { /* defaults */ }
    cx.spawn(async (cx) => {
      const text = await readTextFile(`${home()}/.claude.json`).catch(() => null);
      try { this.claudePlan = claudePlan(JSON.parse(text ?? "null")?.oauthAccount); } catch { /* plan stays unnamed */ }
      cx.notify();
    });
    for (const name of Object.keys(SOURCES)) {
      this.reload(name, cx);
      if (checking()) continue;
      const dir = `${home()}/${SOURCES[name].dir}`;
      cx.spawn(async (cx) => { for (;;) { await watchFolder(dir); this.reload(name, cx); } });
    }
    if (checking()) return;
    // Countdowns and "n분 전" move on their own between refreshes.
    cx.timer.every(30000, (cx) => cx.notify());
    // Every 30s (the user's pick): /usage takes ~4s and no tokens; the split reads only new lines.
    cx.timer.after(1000, (cx) => this.refreshPlan(cx));
    cx.timer.every(30000, (cx) => this.refreshPlan(cx));
    cx.timer.after(2000, (cx) => this.refreshSplit(cx));
    cx.timer.every(30000, (cx) => this.refreshSplit(cx));
  }

  // props().demo: made-up limits frozen at `now`, for screenshots and a recipe's checks. Both
  // "모델별" folds start open unless props().open says otherwise ({ claude: false }). Nothing
  // is read, run or watched, and the layout's block isn't resized.
  demo(now) {
    const at = (sec) => new Date((now + sec) * 1000).toISOString();
    const week = now + 3 * 86400 + 4 * 3600;
    this.demoNow = now;
    this.open = { claude: true, agy: true, ...props().open };
    this.claudePlan = "Max 5x";
    this.savedAt = { claude: now - 20, agy: now - 240 };
    this.data = {
      claude: { rate_limits: { five_hour: { used_percentage: 38, resets_at: now + 2 * 3600 + 300 }, seven_day: { used_percentage: 64, resets_at: week } } },
      agy: { plan_tier: "Google AI Pro", quota: {
        "gemini-5h": { remaining_fraction: 0.88, reset_time: at(4 * 3600 + 600) },
        "gemini-weekly": { remaining_fraction: 0.73, reset_time: at(5 * 86400 + 2 * 3600) },
        "gemini-argon-wtu-weekly": { remaining_fraction: 0.54, reset_time: at(5 * 86400 + 2 * 3600) },
        "3p-5h": { remaining_fraction: 0.85, reset_time: at(3600 + 2400) },
        "3p-weekly": { remaining_fraction: 0.13, reset_time: at(86400 + 6 * 3600) },
      } },
    };
    this.plan = { windows: [{ model: "Fable", window: "7d", pct: 21, resets_at: week }] };
    this.split = {
      five: modelSplit({ "claude-opus-5-5": 71, "claude-fable-5-2": 18, "claude-sonnet-5-5": 8, "claude-haiku-5-5": 3 }),
      seven: modelSplit({ "claude-opus-5-5": 58, "claude-fable-5-2": 24, "claude-sonnet-5-5": 12, "claude-haiku-5-5": 6 }),
    };
  }

  refreshPlan(cx) {
    if (this.planning) return;
    this.planning = true;
    cx.spawn(async (cx) => {
      const r = await exec("python3", ["-I", `${appHome()}/mods/${MOD}/plan-usage.py`], { timeout: 120000 }).catch(() => null);
      this.planning = false;
      try { this.plan = JSON.parse(r?.stdout ?? ""); cx.notify(); } catch { /* keep the last one */ }
    });
  }

  refreshSplit(cx) {
    const rl = this.data.claude?.rate_limits;
    const five = rl?.five_hour?.resets_at ? rl.five_hour.resets_at - 5 * 3600 : null;
    const seven = rl?.seven_day?.resets_at ? rl.seven_day.resets_at - 7 * 86400 : null;
    if (!five || !seven || this.splitting) return;
    this.splitting = true;
    cx.spawn(async (cx) => {
      const r = await exec("python3", ["-I", `${appHome()}/mods/${MOD}/model-usage.py`, String(five), String(seven)]).catch(() => null);
      this.splitting = false;
      try {
        const [f, s] = JSON.parse(r?.stdout ?? "");
        this.split = { five: modelSplit(f), seven: modelSplit(s) };
        cx.notify();
      } catch { /* keep the last split */ }
    });
  }

  reload(name, cx) {
    const path = `${home()}/${SOURCES[name].dir}/${SOURCES[name].file}`;
    cx.spawn(async (cx) => {
      const text = await readTextFile(path).catch(() => null);
      if (!text) return;
      let d;
      try { d = JSON.parse(text); } catch { return; } // mid-write: the next change brings it
      if (name === "agy" && !Object.keys(d.quota ?? {}).length) return; // no request yet: keep the last
      this.data[name] = d;
      const st = await exec("stat", ["-f", "%m", path]).catch(() => null);
      this.savedAt[name] = Number(st?.stdout?.trim()) || this.savedAt[name];
      cx.notify();
    });
  }

  toggle(name, cx) {
    this.open[name] = !this.open[name];
    try { localStorage.setItem("open", JSON.stringify(this.open)); } catch { /* not remembered */ }
    cx.notify();
  }

  // The block follows its content's height, so folding gives the space back to the panel below.
  fit(height) {
    if (this.demoNow) return; // a demo is no block of the layout: the real panel's size isn't its to set
    const px = Math.ceil(height / (settings().zoom || 1));
    if (Math.abs(px - (this.fitted ?? 0)) < 2) return;
    const id = blockId(layout());
    if (!id) return;
    this.fitted = px;
    run("layout.resize", { id, px });
  }

  render() {
    const t = theme();
    const now = this.demoNow ?? Date.now() / 1000;
    const row = ({ label, lim }) => {
      const pct = lim?.pct ?? 0;
      const color = !lim ? t.muted : pct >= 85 ? t.blocked : pct >= 60 ? t.working : t.accent;
      return h_flex().gap(8).items_center().text_size(11).h(18)
        .child(div().w(104).flex_none().text_color(t.foreground).child(label))
        .child(div().flex_1().min_w(24).h(5).rounded(3).bg(t.raised).overflow_hidden()
          .child(div().h_full().rounded(3).bg(color).w(`${pct}%`)))
        .child(div().w(32).flex_none().text_color(color).child(lim ? `${pct}%` : "—"))
        .child(div().w(60).flex_none().text_color(t.muted).child(lim?.left != null ? span(lim.left) : ""));
    };
    const colorOf = (id) => MODEL_COLOR[/^claude-([a-z]+)/.exec(id)?.[1]] ?? t.ansi7 ?? t.muted;
    // Same columns as a limit row: the bar starts and ends where theirs do.
    const stack = (label, parts) => h_flex().gap(8).items_center().text_size(11).h(18)
      .child(div().w(104).flex_none().text_color(t.muted).child(label))
      .child(h_flex().flex_1().min_w(24).h(5).rounded(3).bg(t.raised).overflow_hidden()
        .children(parts.map((p) => div().h_full().bg(colorOf(p.id)).w(`${p.pct}%`))))
      .child(div().w(100).flex_none());
    const legend = (parts) => h_flex().flex_wrap().gap(10).pl(112).text_size(11).text_color(t.muted)
      .children(parts.map((p) => h_flex().gap(4).items_center()
        .child(div().w(6).h(6).rounded(3).bg(colorOf(p.id)))
        .child(div().text_color(t.foreground).child(p.name))
        .child(div().child(`${p.pct}%`))));
    const sp = this.split;
    const splitView = sp?.seven.length
      ? v_flex().gap(4).mt(2)
        .child(stack("토큰 비중 5시간", sp.five)).child(stack("토큰 비중 7일", sp.seven)).child(legend(sp.seven))
      : null;

    // A section: its product and plan, the whole-plan rows, then "모델별" folding the per-model ones.
    const section = (name, product, plan, rows, modelRows, extra, empty) => {
      const at = this.savedAt[name];
      const age = at ? now - at : null;
      const open = this.open[name];
      const has = Boolean(this.data[name]);
      return v_flex().gap(4).flex_none()
        .child(h_flex().items_center().gap(8).mb(4)
          .child(div().text_size(14).font_weight(600).text_color(t.foreground).child(product))
          .when(Boolean(plan), (el) => el.child(div().px(6).py(1).rounded(4).bg(t.raised).text_size(11).text_color(t.muted).child(plan)))
          .child(div().flex_1())
          .child(div().text_size(11).text_color(t.muted).child(age == null ? "" : age < 90 ? "방금" : `${span(age)} 전`)))
        .when(!has, (el) => el.child(div().text_size(11).text_color(t.muted).child(empty)))
        .when(has, (el) => el.children(rows.map(row)))
        .when(has && (modelRows.length > 0 || Boolean(extra)), (el) => el
          .child(h_flex().id(`fold-${name}`).h(20).mt(2).gap(6).items_center().rounded(4).cursor_pointer()
            .text_size(11).text_color(t.muted).hover((s) => s.text_color(t.foreground))
            .on_click((_e, cx) => this.toggle(name, cx))
            .child(div().w(10).child(open ? "▾" : "▸"))
            .child(div().child("모델별"))
            .when(modelRows.length > 0, (el) => el.child(div().px(5).rounded(4).bg(t.raised).child(String(modelRows.length)))))
          .when(open, (el) => el.children(modelRows.map(row)).when(Boolean(extra), (el) => el.child(extra))));
    };

    const rl = this.data.claude?.rate_limits;
    const agy = this.data.agy;
    const agyAll = agyRows(agy?.quota, now);
    const content = v_flex().id("usage-content").w_full().flex_none().px(12).py(12).gap(12).border_b(1).border_color(t.border)
      .on_size_change((size) => this.fit(size.height))
      // Per-model limits (Fable 7일) are real limits: they sit with the plan's rows, not in the fold.
      .child(section("claude", "Claude Code", this.claudePlan, [...claudeRows(rl, now), ...claudeModelRows(this.plan?.windows, now)], [], splitView,
        "Claude Code를 한 번 실행하면 표시돼요"))
      .child(div().h(1).w_full().flex_none().bg(t.border))
      .child(section("agy", "Antigravity", agy?.plan_tier ?? null, // Gemini's rows (Argon's own limit too) on top; Claude·GPT, which agy runs on the side, in the fold.
        agyAll.filter((r) => r.group !== "3p"), agyAll.filter((r) => r.group === "3p"), null,
        "agy에서 한 번 대화하면 표시돼요"));
    // A demo can be given the width of the panel it is pictured as (props().width).
    return div().id("root").size_full().when(Boolean(this.demoNow && props().width), (el) => el.w(props().width))
      .bg(t.background).text_color(t.foreground).child(content);
  }
}
