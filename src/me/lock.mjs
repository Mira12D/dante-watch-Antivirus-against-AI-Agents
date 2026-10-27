// Lock file for long runs. The holder writes pid, host and time; anyone who finds a live lock skips
// instead of waiting. A lock whose process is gone, or older than MAX_HOURS, is treated as stale and
// taken over.
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import { homeDir } from "./home.mjs";
import { mkdirOwned } from "../core/perm.mjs";

export const MAX_HOURS = 3;
const file = (name) => join(homeDir(), name + ".lock");
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };

/** Who holds the barrier right now? null = free (also when the key is stale). */
export function holder(name, { now = Date.now() } = {}) {
  let key;
  try { key = JSON.parse(readFileSync(file(name), "utf8")); } catch { return null; }
  if (!key || typeof key.pid !== "number" || !key.t) return null;
  if (now - Date.parse(key.t) > MAX_HOURS * 36e5) return null;
  if (key.host === hostname() && !alive(key.pid)) return null;
  return key;
}

/** Close the barrier. Returns { ok:true, release } or { ok:false, by } when someone else holds it. */
export function acquire(name, what = name) {
  mkdirOwned(homeDir());
  const mine = JSON.stringify({ pid: process.pid, host: hostname(), t: new Date().toISOString(), what });
  for (let tries = 0; tries < 2; tries++) {
    try { writeFileSync(file(name), mine, { flag: "wx", mode: 0o600 }); break; }
    catch {
      const by = holder(name);
      if (by) return { ok: false, by };
      try { unlinkSync(file(name)); } catch { /* someone else was faster */ }   // stale key: take it over
      if (tries) return { ok: false, by: holder(name) || { what: "?" } };
    }
  }
  let done = false;
  const release = () => { if (done) return; done = true; try { if (existsSync(file(name)) && JSON.parse(readFileSync(file(name), "utf8")).pid === process.pid) unlinkSync(file(name)); } catch { /* gone already */ } };
  process.once("exit", release);
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(s, () => { release(); process.exit(130); });
  return { ok: true, release };
}
