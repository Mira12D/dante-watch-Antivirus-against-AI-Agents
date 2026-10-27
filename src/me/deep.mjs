// Deep run: reads project folders for secrets and follows up on hits. Started weekly by the schedule
// or with `tief`. It takes ~/.dante/deep.lock first; patrol and other deep runs skip while it is held.
// Results go to the diary under "<target>·tief" so they stay apart from the light patrol.
import { homedir } from "node:os";
import { job } from "../ui/job.mjs";
import { activeBattery } from "../checks/battery.mjs";
import { read as readUser } from "./user.mjs";
import { append, readAll, compact, changesOf, lastRun } from "./diary.mjs";
import { acquire } from "./lock.mjs";
import { pool } from "./pool.mjs";

const expand = (p) => String(p || "").replace(/^~(?=\/)/, homedir());

export async function deep({ log = console.log, run = job, limit = 600000 } = {}) {
  const gate = acquire("deep", "tief");
  if (!gate.ok) { log(`${new Date().toISOString()} deep: barrier closed by pid ${gate.by.pid || "?"} since ${gate.by.t || "?"} - skipped`); return 0; }
  try {
    const user = readUser();
    const ids = activeBattery().deep.map((c) => c.id);
    if (!ids.length) { log("deep: no deep checks"); return 0; }
    const targets = [{ name: "local", target: null }, ...((user && user.servers) || []).filter((s) => s.patrol).map((s) => ({ name: s.alias, target: { host: s.target, key: expand(s.key) || null } }))];
    let exit = 0;
    const diary = readAll();
    await pool(targets, async (tg) => {
      const t = new Date().toISOString(), name = tg.name + "·tief";
      let res;
      try { res = await run({ kind: "checks", ids, limit }, tg.target); } catch (e) { res = { reached: false, line: String((e && e.message) || e) }; }
      if (!res.reached) { append({ kind: "run", deep: true, target: name, reached: false, line: String(res.line || "").slice(0, 140), results: [], changes: [] }); log(`${t} ${name} unreached: ${res.line}`); return; }
      const results = compact(res.results), changes = changesOf(lastRun(diary, name), results);
      append({ kind: "run", deep: true, target: name, reached: true, results, changes });
      const n = (v) => results.filter((r) => r.v === v).length;
      log(`${t} ${name} checked=${results.length} risk=${n("risk")} warn=${n("warn")} unknown=${n("unknown")}`);
      if (n("risk")) exit = 2;
    });
    return exit;
  } finally { gate.release(); }
}
