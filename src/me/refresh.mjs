// Keeps user.md current. The file records the last refresh; after REFRESH_DAYS Dante asks to look again,
// and `update` does the same. Findings are merged: what the user wrote or switched on stays, new
// servers join with the patrol off until the user agrees.
import { confirm } from "./onboard.mjs";

export const REFRESH_DAYS = 20;      // how long user.md stays fresh
export const REMIND_EVERY_DAYS = 3;  // after a "no" he does not ask again for this long

const days = (from, to) => Math.floor((Date.parse(to) - Date.parse(from)) / 864e5);

/** Is it time to ask? today = "YYYY-MM-DD". A file without a date counts from the day it was created. */
export function due(user, today) {
  const last = user.updated || user.created;
  if (!last || days(last, today) < REFRESH_DAYS) return false;
  return !user.reminded || days(user.reminded, today) >= REMIND_EVERY_DAYS;
}
export const ageDays = (user, today) => { const last = user.updated || user.created; return last ? Math.max(0, days(last, today)) : 0; };

// What is new on this machine since the file was written.
export function compare(user, f) {
  const haveHost = new Set(user.servers.map((s) => s.alias)), haveProject = new Set(user.projects);
  return {
    hosts: f.hosts.filter((h) => !haveHost.has(h.alias)),
    projects: f.projects.filter((p) => !haveProject.has(p)),
    systemChanged: !!f.system && f.system !== user.system,
  };
}

export async function refreshFlow(io, user) {
  const M = () => io.mt();
  const since = user.updated || user.created || "";
  const f = await io.look();
  const d = compare(user, f);
  io.say("  " + M().refreshHead(since));
  if (!d.hosts.length && !d.projects.length && !d.systemChanged) io.say("  " + M().refreshNothing);
  if (d.systemChanged) io.say("  " + M().refreshSystem(f.system));
  if (d.projects.length) io.say("  " + M().refreshProjects(d.projects.join(", ")));
  if (d.hosts.length) io.say("  " + M().refreshHosts(d.hosts.map((h) => h.alias).join(", ")));

  // merge: keep everything the person has, add what is new
  user.system = f.system || user.system;
  user.projects = [...user.projects, ...d.projects].slice(0, 30);
  const added = d.hosts.map((h) => ({ alias: h.alias, target: h.target, key: h.key, os: "", patrol: false }));
  user.servers = [...user.servers, ...added];
  if (added.length && (await confirm(io, M().refreshHostsAsk(added.map((s) => s.alias).join(", ")), M().explainLook))) {
    for (const s of added) {
      const r = await io.probe(s);
      if (r.ok) { s.os = r.label; s.patrol = true; io.say("  " + M().probed(s.alias, r.label, r.php)); } else io.say("  " + M().notReached(s.alias, M().sshWhy(r.code, r.line)));
    }
  }
  user.updated = io.today(); user.reminded = "";
  io.writeUser(user);
  io.diary({ kind: "act", what: "look", detail: "update" });
  io.say("  " + M().refreshed(REFRESH_DAYS));
  return d;
}

// At start, when his clock has run out: ask once (then at most every few days) whether to look again.
// Returns true when the person said yes and the refresh ran.
export async function clockFlow(io, user) {
  const today = io.today();
  if (!due(user, today)) return false;
  io.say("  " + io.mt().staleMe(ageDays(user, today)));
  if (!(await confirm(io, io.mt().askRefresh, io.mt().explainLook))) {
    user.reminded = today; io.writeUser(user);   // he asked; he will not ask again for a few days
    return false;
  }
  await refreshFlow(io, user);
  return true;
}
