// Linux: output text of the fixed probes (see collect.mjs) -> facts. Pure; every fact keeps the real line it came from.
import { bindOf, splitAddr, redact, parseCron, parseLs, parseAuthKeys, parseStale, parseMta, mailFacts, uniqueListen, uniquePersist } from "./util.mjs";

/** `ss -ltnupH` -> listen facts. Without root the process column is missing; then proc is null, not a guess. */
export function parseSs(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const t = line.trim().split(/\s+/);
    if (t.length < 4) continue;
    // with a Netid column: tcp LISTEN 0 4096 local peer [users]; without: LISTEN 0 4096 local peer
    const hasNetid = /^(tcp|udp)/.test(t[0]);
    const proto = hasNetid ? (t[0].startsWith("udp") ? "udp" : "tcp") : "tcp";
    const state = hasNetid ? t[1] : t[0];
    if (state !== "LISTEN" && state !== "UNCONN") continue;
    const local = t[hasNetid ? 4 : 3];
    if (!local) continue;
    const { host, port } = splitAddr(local);
    if (!Number.isInteger(port) || port <= 0) continue;
    const p = /users:\(\("([^"]+)"/.exec(line);
    out.push({ kind: "listen", proto, port, bind: bindOf(host), proc: p ? p[1] : null, line: redact(line) });
  }
  return out;
}

/** `ls -l --time-style=long-iso` over /etc/cron.* : the files in there run by themselves on a schedule. */
export function parseCronDirs(text, now) {
  return parseLs(text, now, (dir, name) => {
    const m = /^\/etc\/(cron\.(?:d|hourly|daily|weekly|monthly))$/.exec(dir);
    if (!m || name === ".placeholder" || /^README/i.test(name)) return null;
    return { where: "cron", entry: m[1] + "/" + name };
  });
}

/** `systemctl list-timers --all --no-legend`: the column layout varies, the unit name ending in .timer is stable. */
export function parseTimers(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = /(\S+\.timer)\b/.exec(line);
    if (m) out.push({ kind: "persist", where: "systemd-timer", entry: m[1], ageDays: null, line: redact(line.trim()) });
  }
  return out;
}

const NO_LOGIN = /\/(nologin|false|sync|shutdown|halt)$/;
/** passwd = /etc/passwd, groups = `getent group sudo wheel admin`. The password field is never copied. */
export function parseAccounts(passwd, groups) {
  const admins = new Set();
  for (const raw of String(groups || "").split("\n")) {
    const f = raw.trim().split(":");
    if (f.length >= 4 && f[3]) f[3].split(",").forEach((n) => admins.add(n.trim()));
  }
  const out = [];
  for (const raw of String(passwd || "").split("\n")) {
    const f = raw.replace(/\r$/, "").split(":");
    if (f.length < 7 || !f[0] || f[0].startsWith("#")) continue;
    const shell = f[6].trim();
    const login = !!shell && !NO_LOGIN.test(shell);
    const admin = f[2] === "0" || admins.has(f[0]);
    if (!login && !admin) continue;
    // field 2 may hold a hash on old systems; show it as x always
    const line = [f[0], "x", ...f.slice(2)].join(":");
    out.push({ kind: "account", name: f[0], login, admin, guest: /^guest$/i.test(f[0]), line: redact(line) });
  }
  return out;
}

/** sections: probe id -> output text (only probes that could be read). Returns all facts. */
export function parse(s, now = Date.now()) {
  const listen = uniqueListen(parseSs(s.listen));
  const facts = [...listen];
  if (s.cron !== undefined) facts.push(...parseCron(s.cron));
  if (s.crondirs !== undefined) facts.push(...parseCronDirs(s.crondirs, now));
  if (s.timers !== undefined) facts.push(...parseTimers(s.timers));
  if (s.authkeys !== undefined) facts.push(...parseAuthKeys(s.authkeys, now));
  if (s.stale !== undefined) facts.push(...parseStale(s.stale, now));
  if (s.passwd !== undefined && s.admingroups !== undefined) facts.push(...parseAccounts(s.passwd, s.admingroups));
  if (s.listen !== undefined) facts.push(...mailFacts(listen, parseMta(s.mta), true));
  return uniquePersist(facts);
}
