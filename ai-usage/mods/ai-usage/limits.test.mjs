// node limits.test.mjs
import assert from "node:assert/strict";
import { planLimits, agyUsage } from "./limits.js";

// /usage's whole-plan windows become the status line's rate_limits; per-model ones stay out.
assert.deepEqual(planLimits([
  { model: null, window: "5h", pct: 10, resets_at: 100 },
  { model: null, window: "7d", pct: 21, resets_at: 200 },
  { model: "Fable", window: "7d", pct: 15, resets_at: 200 },
]), { five_hour: { used_percentage: 10, resets_at: 100 }, seven_day: { used_percentage: 21, resets_at: 200 } });
assert.equal(planLimits([{ model: "Fable", window: "7d", pct: 15 }]), null);
assert.equal(planLimits(null), null);

// agy's /usage lines, as it printed them on 2026-11-25, plus a model's own bucket.
const out = [
  "Gemini Models\tWeekly Limit Remaining\t94%\t2026-12-01T05:47:35Z",
  "Gemini Models\tFive Hour Limit Remaining\t99%\t2026-11-25T12:04:51Z",
  "Claude and GPT models\tWeekly Limit Remaining\t98%\t2026-11-30T05:16:35Z",
  "Claude and GPT models\tFive Hour Limit Remaining\t100%\t2026-11-25T12:48:36Z",
  "Gemini Argon models\tWeekly Limit Remaining\t54%\t2026-12-01T05:47:35Z",
  "",
].join("\n");
assert.deepEqual(agyUsage(out), {
  "gemini-weekly": { remaining_fraction: 0.94, reset_time: "2026-12-01T05:47:35Z" },
  "gemini-5h": { remaining_fraction: 0.99, reset_time: "2026-11-25T12:04:51Z" },
  "3p-weekly": { remaining_fraction: 0.98, reset_time: "2026-11-30T05:16:35Z" },
  "3p-5h": { remaining_fraction: 1, reset_time: "2026-11-25T12:48:36Z" },
  "gemini-argon-weekly": { remaining_fraction: 0.54, reset_time: "2026-12-01T05:47:35Z" },
});
assert.equal(agyUsage("Not signed in"), null);
assert.equal(agyUsage(""), null);
console.log("limits ok");
