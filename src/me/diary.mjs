// Diary in ~/.dante/diary.jsonl, one JSON object per line. Kinds:
//   run      a patrol or check run on one target, with results and changes since the previous run
//   session  the user opened Dante (marks where "since your last visit" starts)
//   act      something done: looked around, armed or disarmed, installed packs, fixed something
// Only ids and evidence lines are stored, never file contents.
import { appendFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { diaryFile } from "./home.mjs";
import { mkdirOwned } from "../core/perm.mjs";

export function append(entry) {
  mkdirOwned(dirname(diaryFile()));
  const e = { t: new Date().toISOString(), ...entry };
  appendFileSync(diaryFile(), JSON.stringify(e) + "\n", { mode: 0o600 });
  return e;
}
export function readAll() {
  let text = ""; try { text = readFileSync(diaryFile(), "utf8"); } catch { return []; }
  const out = [];
  for (const l of text.split("\n")) { if (!l) continue; try { out.push(JSON.parse(l)); } catch { /* a broken line is skipped, never fatal */ } }
  return out;
}

// What the results of one run look like in the diary: id, verdict, the first real line (short).
export const compact = (results) => results.filter(Boolean).map((r) => ({ id: r.id, v: r.verdict, l: String(((r.evidence || []).find((e) => e.grounded) || {}).line || "").slice(0, 140) }));

// What changed against the run before on the same target: a verdict that moved, or a check that is new since then.
export function changesOf(prev, now) {
  if (!prev) return [];   // the first run has nothing to be compared with: no change, no noise
  const before = new Map((prev ? prev.results : []).map((r) => [r.id, r.v]));
  return now.filter((r) => before.get(r.id) !== r.v).map((r) => ({ id: r.id, from: before.get(r.id) || null, to: r.v }));
}
export const lastRun = (entries, target) => [...entries].reverse().find((e) => e.kind === "run" && e.target === target && e.reached);

// The facts behind "what happened?": everything after the person's last visit - the session mark before the one
// of the visit that is running now (`current`) - including what happened in this visit. No earlier visit: the
// whole diary.
export function facts(entries, { current } = {}) {
  const marks = entries.filter((e) => e.kind === "session" && (!current || e.t < current));
  const since = marks.length ? marks[marks.length - 1].t : "";
  const after = entries.filter((e) => e.kind !== "session" && (!since || e.t > since));
  const runs = after.filter((e) => e.kind === "run");
  const latest = new Map();
  for (const r of runs) latest.set(r.target, r);
  const open = [];
  for (const r of latest.values()) for (const x of r.results) if (r.reached && (x.v === "risk" || x.v === "warn")) open.push({ target: r.target, id: x.id, v: x.v, l: x.l });
  const unknown = [...latest.values()].flatMap((r) => (r.reached ? r.results.filter((x) => x.v === "unknown").map((x) => ({ target: r.target, id: x.id })) : [{ target: r.target, id: "*" }]));
  const news = runs.flatMap((r) => r.changes.filter((c) => c.to === "risk" || c.to === "warn").map((c) => ({ target: r.target, ...c })));
  const solved = runs.flatMap((r) => r.changes.filter((c) => (c.from === "risk" || c.from === "warn") && c.to === "safe").map((c) => ({ target: r.target, ...c })));
  const acts = after.filter((e) => e.kind === "act");
  return { since, runs: runs.length, targets: [...new Set(runs.map((r) => r.target))], first: runs[0] && runs[0].t, last: runs.length ? runs[runs.length - 1].t : "", open, unknown, news, solved, acts };
}
