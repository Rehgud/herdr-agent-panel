// node lib.test.mjs (needs the system's cksum)
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import * as L from "./lib.js";

const { en, ko } = L.TEXT;
const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
assert.deepEqual(keys(en), keys(ko), "TEXT.en and TEXT.ko have the same keys");

// cksum matches the system's, ASCII and not.
for (const s of ["/Users/me/.claude/projects/-Users-me/0f8e1c2a-0000-4000-8000-123456789abc.jsonl", "", "a", "한글 경로/x.jsonl", "x".repeat(300)]) {
  const sys = Number(execSync("cksum", { input: s }).toString().split(" ")[0]);
  assert.equal(L.cksum(s), sys, `cksum ${JSON.stringify(s.slice(0, 20))}`);
}
assert.equal(L.cksum("123456789"), 930766865); // the POSIX check value

assert.equal(L.modelName("claude-opus-5-5"), "Opus 5.5");
assert.equal(L.modelName("claude-fable-5-2"), "Fable 5.2");
assert.equal(L.modelName("us.anthropic.claude-haiku-5-5-v1:0"), "Haiku 5.5");
assert.equal(L.modelName("claude-sonnet-5"), "Sonnet 5");
assert.equal(L.modelName("Gemini 4 Argon"), "Gemini 4 Argon");
assert.equal(L.modelName(""), null);

assert.deepEqual(["low", "medium", "high", "xhigh", "max", "Medium", "minimal", "none", null, "weird"].map(L.effortLevel), [1, 2, 3, 4, 5, 2, 0, 0, null, null]);
assert.deepEqual([0, 59, 60, 3599, 3600, 86400 * 3].map((s) => L.span(s, ko)), ["방금", "방금", "1분", "59분", "1시간", "3일"]);
assert.deepEqual([0, 59, 60, 3599, 3600, 86400 * 3].map((s) => L.span(s, en)), ["just now", "just now", "1m", "59m", "1h", "3d"]);
assert.equal(L.ago(30, ko), "방금"); assert.equal(L.ago(125, ko), "2분 전");
assert.equal(L.ago(30, en), "just now"); assert.equal(L.ago(125, en), "2m ago");
assert.equal(L.elapsed(30, ko), "방금"); assert.equal(L.elapsed(3 * 3600, ko), "3시간째");
assert.equal(L.elapsed(30, en), "just now"); assert.equal(L.elapsed(3 * 3600, en), "3h");

// over9k's cache: a key line, then rows; running first, then newest.
const cache = "v7 1 2 3\nagent-a\t100\tOld done\tgeneral-purpose\tclaude-opus-5-5\t50\t1\txhigh\t200000\t1\nagent-b\t300\tRunning\tclaude-code-guide\tclaude-haiku-5-5\t250\t1\tmedium\t200000\t0\nagent-c\t200\tNew done\tgeneral-purpose\tclaude-fable-5-2\t150\t1\t\t200000\t1\n";
const subs = L.parseSubs(cache, { header: true, tx: ko });
assert.deepEqual(subs.map((s) => s.id), ["agent-b", "agent-c", "agent-a"]);
assert.deepEqual(subs[0], { id: "agent-b", name: "Running", type: "claude-code-guide", model: "Haiku 5.5", effort: "medium", startedAt: 250, lastAt: 300, done: false });
assert.equal(subs[1].effort, null);
assert.equal(L.parseSubs("c2\t10\t\t\tGemini\t5\t0\tmedium\t1\t0", { tx: ko })[0].name, "서브에이전트");
assert.equal(L.parseSubs("c2\t10\t\t\tGemini\t5\t0\tmedium\t1\t0", { tx: en })[0].name, "Sub-agent");
assert.deepEqual(L.parseSubs(""), []); assert.deepEqual(L.parseSubs(null), []);
assert.equal(L.parseSubs("c1\t10\t\tsubagent\tGemini 4 Argon\t5\t0\tmedium\t1048576\t0")[0].model, "Gemini 4 Argon");
assert.deepEqual(L.foldSubs(subs, false), { live: [subs[0]], done: [], finished: 2, more: 0 });
assert.deepEqual(L.foldSubs(subs, true, 1), { live: [subs[0]], done: [subs[1]], finished: 2, more: 1 });

assert.deepEqual(L.codexTitle("Fix login | gpt-6-luna high | Context 12% used"), { model: "gpt-6-luna", effort: "high", context: 12, task: "Fix login" });
assert.equal(L.codexTitle("codex").model, null);
assert.deepEqual(L.codexDefaults('model = "gpt-6-luna"\nmodel_reasoning_effort = "medium"\n[tui]\nmodel = "no"\n'), { model: "gpt-6-luna", effort: "medium" });
assert.deepEqual(L.codexDefaults(null), { model: null, effort: null });
assert.equal(L.clean("✳ Herdr mod 설명"), "Herdr mod 설명"); assert.equal(L.clean("⠋ - Thinking"), "Thinking"); assert.equal(L.clean("[web] x"), "[web] x");

assert.deepEqual(["claude-code", "codex", "antigravity", "pi"].map((app) => L.kind({ app })), ["claude", "codex", "agy", "other"]);
assert.equal(L.kind({ app: null, program: { key: "claude" } }), "claude");

// Claude Code: over9k's file as it is; a fresh session is all null.
const cc = { model: "Opus 5.5", id: "claude-opus-5-5", effort: "xhigh", ultracode: true, lastAt: 10, context: 34, cacheUntil: 3610, transcript: "x.jsonl" };
assert.deepEqual(L.details({ app: "claude-code" }, { saved: cc }), { model: "Opus 5.5", effort: "xhigh", ultracode: true, context: 34, lastAt: 10, cacheUntil: 3610, guessed: false, title: null });
assert.equal(L.details({ app: "claude-code" }, { saved: { model: null, effort: null, ultracode: false, lastAt: null, context: null, cacheUntil: null } }).model, null);
assert.equal(L.details({ app: "claude-code" }, {}).model, null);
// Antigravity: agy-info.py, with the context of the status line's conversation only.
const agy = { model: "Gemini 4 Argon", id: "Gemini 4 Argon (Medium)", effort: "medium", agent: "antigravity", context: null, lastAt: 99, conversation: "c1", title: "Refactor Parser" };
const latest = { conversation_id: "c1", context_window: { used_percentage: 1.56 } };
assert.deepEqual(L.details({ app: "antigravity" }, { agy, latest }), { model: "Gemini 4 Argon", effort: "medium", ultracode: false, context: 2, lastAt: 99, cacheUntil: null, guessed: false, title: "Refactor Parser" });
assert.equal(L.details({ app: "antigravity" }, { agy, latest: { ...latest, conversation_id: "other" } }).context, null);
assert.equal(L.details({ app: "antigravity" }, { agy: { ...agy, model: null, effort: null, conversation: null }, latest }).model, null);
// A stale Claude Code file for the terminal isn't agy's.
assert.equal(L.details({ app: "antigravity" }, { saved: cc, agy: { ...agy, model: null, effort: null } }).model, null);
assert.equal(L.details({ app: "antigravity" }, { saved: cc, agy }).context, null);
// over9k's own agy status line file fills what agy-info.py leaves null.
assert.equal(L.details({ app: "antigravity" }, { saved: { agent: "antigravity", model: "Gemini 3.8 Flash", effort: "low", context: 41.2, lastAt: 5 }, agy: { ...agy, lastAt: null } }).context, 41);
assert.equal(L.details({ app: "antigravity" }, { saved: { agent: "antigravity", model: "Gemini 3.8 Flash", effort: "low", context: 41.2, lastAt: 5 } }).model, "Gemini 3.8 Flash");
// Codex: its title when it carries the model, else config.toml's defaults, marked as such.
assert.equal(L.details({ app: "codex", title: "T | gpt-6-luna high | Context 3% used" }, { codex: { model: "x", effort: "low" } }).guessed, false);
assert.deepEqual(L.details({ app: "codex", title: "codex" }, { codex: { model: "gpt-6-luna", effort: "medium" } }), { model: "gpt-6-luna", effort: "medium", ultracode: false, context: null, lastAt: null, cacheUntil: null, guessed: true, title: null });
assert.equal(L.details({ app: "pi", title: "pi" }, { codex: { model: "gpt-6-luna" } }).model, null);

const list = [
  { address: "t1", status: "idle", seq: 9, space: "s1", tab: "a" }, { address: "t2", status: "working", seq: 2, space: "s1", tab: "a" },
  { address: "t3", status: "blocked", seq: 1, space: "s2", tab: "b" }, { address: "t4", status: "done", seq: 5, space: "s2", tab: "c" },
  { address: "t5", status: "working", seq: 7, space: "s2", tab: "c" }, { address: "t6", status: null, seq: 99, space: "s3", tab: "d" },
];
assert.deepEqual(L.sortSessions(list).map((a) => a.address), ["t3", "t5", "t2", "t4", "t1", "t6"]);
assert.equal(L.pickCurrent(list, { terminal: "t4", space: "s2", tab: "c" }).address, "t4");
assert.equal(L.pickCurrent(list, { terminal: "t99", space: "s2", tab: "c" }).address, "t5"); // a shell focused: the tab's latest
assert.equal(L.pickCurrent(list, { terminal: null, space: "s1", tab: "zz" }).address, "t1"); // a mod tab: the space's latest
assert.equal(L.pickCurrent(list, { terminal: null, agent: "t3", space: "s2", tab: "zz" }).address, "t3");
assert.equal(L.pickCurrent(list, { terminal: null, space: "none", tab: "zz" }), null);
assert.equal(L.pickCurrent([], null), null);
// In the shown tab the focused pane's agent wins over a later one, and over Herdr's chosen agent elsewhere in the space.
assert.equal(L.pickCurrent([...list, { address: "t7", status: "idle", seq: 1, space: "s2", tab: "c", focused: true }], { terminal: "t99", agent: "t3", space: "s2", tab: "c" }).address, "t7");
assert.equal(L.pickCurrent(list, { terminal: "t99", agent: "t3", space: "s2", tab: "c" }).address, "t5");
assert.equal(L.pickCurrent(list, { terminal: null, agent: "t1", space: "s2", tab: "zz" }).address, "t5"); // chosen in another space: not it
assert.deepEqual(L.argvModel(["agy", "-p", "hi", "--model", "Gemini 4 Argon (Medium)"]), { model: "Gemini 4 Argon", effort: "medium" });
assert.deepEqual(L.argvModel(["agy", "--model=Gemini 3.8 Flash", "--effort", "High"]), { model: "Gemini 3.8 Flash", effort: "high" });
assert.deepEqual(L.argvModel(["claude", "--model", "claude-opus-5-5"]), { model: "Opus 5.5", effort: null });
assert.deepEqual(L.argvModel(["agy", "-p", "use --model"]), { model: null, effort: null });
assert.deepEqual(L.argvModel(["agy", "--model"]), { model: null, effort: null });
assert.deepEqual(L.argvModel(undefined), { model: null, effort: null });
// Finished ones newest first, whatever order they came in.
assert.deepEqual(L.foldSubs([{ id: 1, done: true, lastAt: 5 }, { id: 2, done: true, lastAt: 9 }, { id: 3, done: false }], true).done.map((s) => s.id), [2, 1]);
// The folder a session started in names it; home is "~".
assert.equal(L.folderName("/Users/me/my-project", "/Users/me"), "my-project");
assert.equal(L.folderName("/Users/me/", "/Users/me"), "~");
assert.equal(L.folderName(null, "/Users/me"), null);
assert.equal(L.folderName("/", "/Users/me"), "/");

// over9k's task cache: a key line, then what still runs or waits.
const bg = L.parseTasks("v8 1 2 3\nshell\tb1\tRun the suite\t940\t\t/tmp/x/b1.out\nmonitor\tm1\t\t100\t\t/tmp/x/m1.out\ncron\tc1\tCheck the deploy\t500\tEvery 2 hours at :13\t\nwakeup\tw1\tLook again\t900\t1720\t\n");
assert.deepEqual(bg.map((k) => k.kind), ["shell", "monitor", "cron", "wakeup"]);
assert.deepEqual(bg[0], { kind: "shell", id: "b1", name: "Run the suite", startedAt: 940, when: null, output: "/tmp/x/b1.out" });
assert.deepEqual(bg[2], { kind: "cron", id: "c1", name: "Check the deploy", startedAt: 500, when: "Every 2 hours at :13", output: null });
assert.equal(bg[1].name, null);
assert.deepEqual(L.parseTasks("v8 1 2 3\n"), []); assert.deepEqual(L.parseTasks(null), []);
assert.deepEqual(bg.map(L.scheduled), [false, false, true, true]);
assert.equal(L.taskBadge(bg, ko), "작업 2개 진행 중"); assert.equal(L.taskBadge(bg.slice(2), ko), "예약 2개");
assert.equal(L.taskBadge(bg, en), "2 tasks running"); assert.equal(L.taskBadge(bg.slice(0, 1), en), "1 task running"); assert.equal(L.taskBadge(bg.slice(2), en), "2 scheduled");
assert.equal(L.taskBadge([], ko), null); assert.equal(L.taskBadge(undefined, en), null);
// Running: for how long; a wakeup: how long until; a cron job's schedule isn't a time.
assert.deepEqual(bg.map((k) => L.taskWhen(k, 1000, ko)), ["1분째", "15분째", "", "12분 뒤"]);
assert.deepEqual(bg.map((k) => L.taskWhen(k, 1000, en)), ["1m", "15m", "", "in 12m"]);
assert.equal(L.taskWhen(bg[0], 950, ko), "방금"); assert.equal(L.taskWhen(bg[3], 1700, ko), "곧");
assert.equal(L.taskWhen(bg[0], 950, en), "just now"); assert.equal(L.taskWhen(bg[3], 1700, en), "soon");
assert.equal(L.taskWhen({ kind: "wakeup", when: null }, 1000, ko), ""); assert.equal(L.taskWhen({ kind: "shell", startedAt: null }, 1000, en), "");
// A resting session with a task still running goes over the finished and idle ones, under the working.
assert.deepEqual(L.sortSessions(list, (a) => a.address === "t1").map((a) => a.address), ["t3", "t5", "t2", "t1", "t4", "t6"]);
assert.deepEqual(L.sortSessions(list, (a) => a.address === "t2").map((a) => a.address), ["t3", "t5", "t2", "t4", "t1", "t6"]);

// The demo's made-up sessions, read as the panel reads real ones.
const demo = L.demoData(100000, "ko");
assert.equal(L.pickCurrent(demo.list, demo.focus).address, "d1");
assert.deepEqual(demo.list.map((a) => L.folderName(demo.terms.find((k) => k.address === a.address).cwd, "/Users/me")), ["my-app", "api-server", "docs-site", "ml-train"]);
assert.deepEqual(demo.list.map((a) => { const d = L.details(a, { saved: demo.saved[a.address] }); return [d.model, d.effort, d.context]; }),
  [["Opus 5.5", "xhigh", 42], ["gpt-6-luna", "medium", 18], ["Gemini 3.8 Flash", "low", 27], ["Fable 5.2", "high", 63]]);
assert.deepEqual(L.argvModel(demo.terms.find((k) => k.parent === "d1").argv), { model: "Gemini 4 Argon", effort: "medium" });
const folded = L.foldSubs(demo.subs.d1, false);
assert.deepEqual([folded.live.length, folded.done.length, folded.finished], [1, 0, 3]);
assert.equal(L.taskBadge(demo.tasks.d4, ko), "작업 1개 진행 중"); assert.equal(L.taskWhen(demo.tasks.d4[0], demo.now, ko), "3시간째");
const demoEn = L.demoData(100000, "en");
assert.deepEqual([demo.subs.d1.map((s) => s.name), demo.terms[4].name, demo.tasks.d4[0].name],
  [["세션 만료 처리 조사", "로그인 흐름 파악", "실패한 테스트 원인 찾기", "의존성 버전 확인"], "변경 사항 교차 검토", "전체 데이터로 학습 실행"]);
assert.deepEqual([demoEn.subs.d1.map((s) => s.name), demoEn.terms[4].name, demoEn.tasks.d4[0].name],
  [["Look into session expiry", "Map the login flow", "Find why the test fails", "Check dependency versions"], "Cross-check the changes", "Train on the full dataset"]);
assert.equal(L.taskBadge(demoEn.tasks.d4, en), "1 task running"); assert.equal(L.taskWhen(demoEn.tasks.d4[0], demoEn.now, en), "3h");
const busy = (a) => (demo.tasks[a.address] ?? []).some((k) => !L.scheduled(k));
assert.deepEqual(L.sortSessions(demo.list.slice(1), busy).map((a) => a.space_name), ["ml-train", "docs-site", "api-server"]);
// The diagram: a leaf per row, a parent level with the middle of its children, half a row
// between trees, depth counted from the sessions.
{
  const kids = { s1: ["a", "b", "c"], b: ["b1", "b2"], s2: [] };
  const { boxes, rows, depth } = L.placeTree(["s1", "s2"], (x) => kids[x] ?? []);
  const at = Object.fromEntries(boxes.map((b) => [b.x, [b.depth, b.row]]));
  assert.deepEqual(at, { s1: [0, 1.5], a: [1, 0], b: [1, 1.5], b1: [2, 1], b2: [2, 2], c: [1, 3], s2: [0, 4.5] });
  assert.deepEqual([rows, depth], [5.5, 2]);
  assert.equal(boxes.find((b) => b.x === "b1").parent.x, "b");
  assert.deepEqual(L.placeTree([], () => []), { boxes: [], rows: 0, depth: 0 });
  // apart = 1: the sessions under one machine are parted too, their sub-agents aren't.
  const one = L.placeTree(["pc"], (x) => ({ pc: ["s1", "s2"], s1: ["a", "b"] })[x] ?? [], 1);
  assert.deepEqual(Object.fromEntries(one.boxes.map((b) => [b.x, b.row])), { pc: 1.5, s1: 0.5, a: 0, b: 1, s2: 2.5 });
  assert.equal(one.rows, 3.5);
}
console.log("lib ok");
