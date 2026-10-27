// Windows: output text of the fixed PowerShell probes (see collect.mjs) -> facts. Pure; every fact keeps its real line.
// Every probe line is "<letter>|field|field...", so lines of other kinds (the OK marker, errors) are simply skipped.
// NOT tested on a real Windows machine: the fixtures are written from the known formats of the cmdlets.
import { bindOf, redact, mailFacts, uniqueListen, uniquePersist } from "./util.mjs";

const rows = (text, letter) =>
  String(text || "").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.startsWith(letter + "|"))
    .map((l) => ({ line: l, f: l.split("|").slice(1) }));

/** L|address|port|process  (Get-NetTCPConnection -State Listen) */
export function parseListen(text) {
  const out = [];
  for (const { line, f } of rows(text, "L")) {
    const port = Number(f[1]);
    if (!Number.isInteger(port) || port <= 0) continue;
    out.push({ kind: "listen", proto: "tcp", port, bind: bindOf(String(f[0] || "").replace(/%.*$/, "")), proc: f[2] ? f[2] : null, line: redact(line) });
  }
  return out;
}

/** T|\Path\Name|State  (Get-ScheduledTask outside \Microsoft\). Arguments of the tasks are never read. */
export function parseTasks(text) {
  return rows(text, "T").filter(({ f }) => f[0]).map(({ line, f }) => ({ kind: "persist", where: "scheduled-task", entry: f[0], ageDays: null, line: redact(line) }));
}

/** S|Location|Name  (Win32_StartupCommand; the Command column is left out because it can hold secrets) */
export function parseStartup(text) {
  return rows(text, "S").filter(({ f }) => f[1]).map(({ line, f }) => ({
    kind: "persist",
    where: /startup/i.test(f[0]) && !/\\Run/i.test(f[0]) ? "startup-folder" : /\bRun/i.test(f[0]) ? "run-key" : "login-item",
    entry: f[1], ageDays: null, line: redact(line),
  }));
}

/** R|key|value name  (HKCU/HKLM ...\CurrentVersion\Run: names only, the values are commands and stay unread) */
export function parseRunKeys(text) {
  return rows(text, "R").filter(({ f }) => f[1]).map(({ line, f }) => ({ kind: "persist", where: "run-key", entry: (/^HKLM/i.test(f[0]) ? "HKLM " : "HKCU ") + f[1], ageDays: null, line: redact(line) }));
}

/** F|file name|age in days  (files in the user's Startup folder) */
export function parseStartupDir(text) {
  return rows(text, "F").filter(({ f }) => f[0]).map(({ line, f }) => {
    const d = Number(f[1]);
    return { kind: "persist", where: "startup-folder", entry: f[0], ageDays: f[1] !== "" && Number.isFinite(d) ? d : null, line: redact(line) };
  });
}

/** A|name|enabled|SID for users, G|DOMAIN\name for the Administrators group (SID S-1-5-32-544). RID 501 is the Guest. */
export function parseAccounts(users, admins) {
  const adminSet = new Set(rows(admins, "G").map(({ f }) => String(f[0]).split("\\").pop().toLowerCase()));
  const out = [];
  for (const { line, f } of rows(users, "A")) {
    const [name, enabled, sid] = f;
    if (!name) continue;
    const login = /^true$/i.test(enabled || "");
    const admin = adminSet.has(name.toLowerCase());
    const guest = /-501$/.test(sid || "");
    if (login || admin) out.push({ kind: "account", name, login, admin, guest, line: redact(line) });
  }
  return out;
}

/** D|folder|age in days per old file -> stale facts. Windows keeps no trustworthy last-opened date, so usedKnown is false. */
export function parseStale(text) {
  const dirs = new Map();
  for (const { line, f } of rows(text, "D")) {
    const days = Number(f[1]);
    if (!f[0] || !Number.isFinite(days)) continue;
    const g = dirs.get(f[0]) || { n: 0, days, line };
    g.n++;
    if (days > g.days) { g.days = days; g.line = line; }
    dirs.set(f[0], g);
  }
  return [...dirs].map(([dir, g]) => ({ kind: "stale", dir, count: g.n, oldestDays: g.days, usedKnown: false, line: redact(g.line) }));
}

/** M|service name for a mail server service (Exchange, SMTP) */
export function parseMtaWin(text) {
  const r = rows(text, "M")[0];
  return r ? { name: r.f[0], line: r.line } : null;
}

/** sections: probe id -> output text (only probes that could be read). Returns all facts. */
export function parse(s) {
  const listen = uniqueListen(parseListen(s.listen));
  const facts = [...listen];
  if (s.tasks !== undefined) facts.push(...parseTasks(s.tasks));
  if (s.startup !== undefined) facts.push(...parseStartup(s.startup));
  if (s.runkeys !== undefined) facts.push(...parseRunKeys(s.runkeys));
  if (s.startupdir !== undefined) facts.push(...parseStartupDir(s.startupdir));
  if (s.stale !== undefined) facts.push(...parseStale(s.stale));
  if (s.users !== undefined && s.admins !== undefined) facts.push(...parseAccounts(s.users, s.admins));
  if (s.listen !== undefined) facts.push(...mailFacts(listen, parseMtaWin(s.mta), true));
  return uniquePersist(facts);
}
