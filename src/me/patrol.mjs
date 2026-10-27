// Patrol started by the schedule. Runs the light battery on this machine and on every approved server
// (a few in parallel), writes the diary and notes what changed since the previous run. Read-only; the
// only connections are ssh to servers listed in user.md. Log: ~/.dante/patrol.log.
import { homedir } from "node:os";
import { job } from "../ui/job.mjs";
import { activeBattery } from "../checks/battery.mjs";
import { read as readUser } from "./user.mjs";
import { append, readAll, compact, changesOf, lastRun } from "./diary.mjs";
import { acquire, holder } from "./lock.mjs";
import { pool } from "./pool.mjs";

const expand = (p) => String(p || "").replace(/^~(?=\/)/, homedir());

export async function patrol({ log = console.log, run = job, limit = 180000 } = {}) {
  // The deep run closes the motorway: a patrol that sees the barrier steps aside at once and does not wait.
  const by = holder("deep");
  if (by) { log(`${new Date().toISOString()} patrol: deep run is on the road (pid ${by.pid}) - skipped`); return 0; }
  const gate = acquire("patrol", "patrol");   // two patrols never pile up on each other either
  if (!gate.ok) { log(`${new Date().toISOString()} patrol: another patrol is running (pid ${gate.by.pid || "?"}) - skipped`); return 0; }
  try { return await patrolRun({ log, run, limit }); } finally { gate.release(); }
}

async function patrolRun({ log, run, limit }) {
  const user = readUser();
  const ids = activeBattery().battery.map((c) => c.id);
  const targets = [{ name: "local", target: null }, ...((user && user.servers) || []).filter((s) => s.patrol).map((s) => ({ name: s.alias, target: { host: s.target, key: expand(s.key) || null } }))];
  let exit = 0;
  // Many machines at once (at most DANTE_PARALLEL, default 6): a slow or dead host holds one slot, not the run. The
  // last run of a target is read once, before the first result is written, so the parallel workers never race on it.
  const diary = readAll();
  await pool(targets, async (tg) => {
    const t = new Date().toISOString();
    let res;
    try { res = await run({ kind: "checks", ids, limit }, tg.target); } catch (e) { res = { reached: false, line: String((e && e.message) || e) }; }
    if (!res.reached) { append({ kind: "run", target: tg.name, reached: false, line: String(res.line || "").slice(0, 140), results: [], changes: [] }); log(`${t} ${tg.name} unreached: ${res.line}`); return; }
    const results = compact(res.results), changes = changesOf(lastRun(diary, tg.name), results);
    append({ kind: "run", target: tg.name, reached: true, results, changes });
    const n = (v) => results.filter((r) => r.v === v).length;
    log(`${t} ${tg.name} checked=${results.length} risk=${n("risk")} warn=${n("warn")} unknown=${n("unknown")}${changes.length ? " changed=" + changes.map((c) => `${c.id}:${c.from || "new"}>${c.to}`).join(",") : ""}`);
    if (n("risk")) exit = 2;
  });
  return exit;
}
