// Reading each plan's limits without its agent open, without Herdr, so node can test it:
// node limits.test.mjs

// The whole Claude plan's limits from /usage (plan-usage.py), in the status line's shape: /usage
// runs every 30 seconds whether or not a Claude Code session is open, the status line only while one is.
export function planLimits(windows) {
  const all = (windows ?? []).filter((w) => !w.model);
  const pick = (win) => all.find((w) => w.window === win);
  const as = (w) => (w ? { used_percentage: w.pct, resets_at: w.resets_at } : undefined);
  return pick("5h") || pick("7d") ? { five_hour: as(pick("5h")), seven_day: as(pick("7d")) } : null;
}

// Antigravity's buckets from `agy -p "/usage"`, one tab-separated line each
// ("Gemini Models\tFive Hour Limit Remaining\t99%\t2026-11-25T12:04:51Z"), in the status line's
// quota shape: gemini-5h, 3p-weekly, and a model's own (Gemini Argon models -> gemini-argon-weekly).
export function agyUsage(text) {
  const quota = {};
  for (const line of String(text ?? "").split("\n")) {
    const [group = "", limit = "", pct = "", reset = ""] = line.split("\t");
    const left = /^(\d+(?:\.\d+)?)%$/.exec(pct.trim());
    const win = /five hour/i.test(limit) ? "5h" : /week/i.test(limit) ? "weekly" : null;
    if (!left || !win) continue;
    const name = /^gemini models$/i.test(group.trim()) ? "gemini" : /claude and gpt/i.test(group) ? "3p"
      : group.trim().toLowerCase().replace(/ models?$/, "").replace(/[^a-z0-9]+/g, "-");
    quota[`${name}-${win}`] = { remaining_fraction: Number(left[1]) / 100, reset_time: reset.trim() || null };
  }
  return Object.keys(quota).length ? quota : null;
}
