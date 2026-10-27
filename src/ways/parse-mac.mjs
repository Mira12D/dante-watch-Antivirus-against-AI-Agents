// macOS: output text of the fixed probes (see collect.mjs) -> facts. Pure; every fact keeps the real line it came from.
import { bindOf, splitAddr, redact, parseCron, parseLs, parseAuthKeys, parseStale, parseMta, mailFacts, uniqueListen, uniquePersist } from "./util.mjs";

/** `lsof -nP -iTCP -sTCP:LISTEN` -> listen facts. A line without "(LISTEN)" or without a port is not a listener. */
export function parseLsof(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const t = line.trim().split(/\s+/);
    const i = t.indexOf("(LISTEN)");
    if (i < 1 || t[0] === "COMMAND") continue;
    const { host, port } = splitAddr(t[i - 1]);
    if (!Number.isInteger(port) || port <= 0) continue;
    // lsof writes spaces in names as \x20
    const proc = t[0].replace(/\\x20/g, " ") || null;
    out.push({ kind: "listen", proto: "tcp", port, bind: bindOf(host), proc, line: redact(line) });
  }
  return out;
}

/** `ls -lT` over the three launchd folders. Everything in there starts by itself, so every .plist is a way in. */
export function parseLaunchDirs(text, now) {
  return parseLs(text, now, (dir, name) => {
    if (!name.endsWith(".plist")) return null;
    return { where: /LaunchDaemons/.test(dir) ? "launchd-daemon" : /LaunchAgents/.test(dir) ? "launchd-agent" : null, entry: name };
  }).filter((f) => f.where);
}

/** `launchctl list` (tab separated: PID Status Label). Apple's own jobs are the system itself and are left out. */
export function parseLaunchctl(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const t = line.split(/\s+/);
    if (t.length < 3 || t[0] === "PID") continue;
    const label = t[2];
    if (!label || /^(com\.apple\.|application\.|0x)/.test(label)) continue;
    out.push({ kind: "persist", where: "launchd-loaded", entry: label, ageDays: null, line: redact(line) });
  }
  return out;
}

/** users = `dscl . -list /Users UserShell`, admins = "GroupMembership: a b c", guest = "1" | "0" */
export function parseAccounts(users, admins, guest) {
  const adminSet = new Set(String(admins || "").replace(/^\s*GroupMembership:/, "").trim().split(/\s+/).filter(Boolean));
  const out = [];
  for (const raw of String(users || "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const [name, shell] = line.trim().split(/\s+/);
    if (!name || name.startsWith("_") || name === "daemon" || name === "nobody") continue;
    const login = !!shell && !/\/(false|nologin)$/.test(shell);
    const admin = adminSet.has(name);
    if (login || admin) out.push({ kind: "account", name, login, admin, guest: false, line: redact(line) });
  }
  const g = String(guest || "").trim();
  if (g === "1") out.push({ kind: "account", name: "Guest", login: true, admin: false, guest: true, line: "GuestEnabled = 1" });
  return out;
}

/** sections: probe id -> output text (only probes that could be read). Returns all facts. */
export function parse(s, now = Date.now()) {
  const listen = uniqueListen(parseLsof(s.listen));
  const facts = [...listen];
  if (s.launchdirs !== undefined) facts.push(...parseLaunchDirs(s.launchdirs, now));
  if (s.launchctl !== undefined) facts.push(...parseLaunchctl(s.launchctl));
  if (s.cron !== undefined) facts.push(...parseCron(s.cron));
  if (s.authkeys !== undefined) facts.push(...parseAuthKeys(s.authkeys, now));
  if (s.stale !== undefined) facts.push(...parseStale(s.stale, now));
  if (s.users !== undefined && s.admins !== undefined) facts.push(...parseAccounts(s.users, s.admins, s.guest));
  // macOS always ships sendmail/postfix binaries, so an MTA alone says nothing here; open mail ports do
  if (s.listen !== undefined) facts.push(...mailFacts(listen, parseMta(s.mta), false));
  return uniquePersist(facts);
}
