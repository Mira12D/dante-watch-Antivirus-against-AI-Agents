// Small shared helpers of the parsers (package A). Pure functions, no I/O.

export const DAY = 864e5;
/** Whole days between a timestamp (ms) and now; null when the date is unknown. */
export const ageDays = (ms, now) => (Number.isFinite(ms) ? Math.max(0, Math.floor((now - ms) / DAY)) : null);

/**
 * A line may be shown as evidence, but never with a secret in it. Cron lines and command lines love to carry
 * tokens, so values behind secret-ish names, URL passwords and long token-like runs are blanked.
 */
export function redact(s) {
  return String(s || "")
    .replace(/\r$/, "")
    .replace(/(--?(?:password|passwd|pass|token|secret|api-?key)[=\s]+)\S+/gi, "$1***")
    .replace(/\b((?:pass(?:word|wd)?|pwd|token|secret|api[_-]?key|auth|bearer|key)\s*[=:]\s*)\S+/gi, "$1***")
    .replace(/\bBearer\s+\S+/gi, "Bearer ***")
    .replace(/(\w+:\/\/[^\s:/@]+):[^\s@/]+@/g, "$1:***@")
    .replace(/[A-Za-z0-9+_=-]{32,}/g, "***");
}

/** "127.0.0.53%lo:53" | "[::1]:80" | "*:22" | ":::22" -> { host, port } */
export function splitAddr(a) {
  const s = String(a || "");
  const i = s.lastIndexOf(":");
  if (i < 0) return { host: s, port: NaN };
  const host = s.slice(0, i).replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  return { host, port: Number(s.slice(i + 1)) };
}

/** Which door does the address open: only this machine, every interface, or one specific network address. */
export function bindOf(host) {
  const h = String(host || "").toLowerCase();
  if (h === "" || h === "*" || h === "0.0.0.0" || h === "::" || h === "0:0:0:0:0:0:0:0") return "all";
  if (/^127\./.test(h) || h === "::1" || h === "localhost" || /^::ffff:127\./.test(h)) return "loopback";
  return "lan";
}

// IPv4 + IPv6 sockets of one program, or the same entry seen by two probes, are one fact
const dedupe = (facts, keyOf) => {
  const seen = new Set();
  return facts.filter((f) => { const k = keyOf(f); if (k === null) return true; if (seen.has(k)) return false; seen.add(k); return true; });
};
export const uniqueListen = (facts) => dedupe(facts, (f) => [f.proto, f.port, f.bind, f.proc].join("|"));
export const uniquePersist = (facts) => dedupe(facts, (f) => (f.kind === "persist" && f.where !== "authorized_keys" ? f.where + "|" + f.entry : null));

const MAIL_PORTS = new Set([25, 110, 143, 465, 587, 993, 995, 2525]);
/**
 * Mail doors from the listen facts (only ones that are not loopback-only), plus the local MTA if one was found.
 * mtaAlone: report an MTA even without open ports (not on macOS, where sendmail/postfix binaries are always there).
 */
export function mailFacts(listen, mta, mtaAlone) {
  const open = listen.filter((f) => f.proto === "tcp" && MAIL_PORTS.has(f.port) && f.bind !== "loopback");
  if (open.length) return [{ kind: "mail", ports: [...new Set(open.map((f) => f.port))].sort((a, b) => a - b), mta: mta ? mta.name : null, line: open[0].line }];
  if (mta && mtaAlone) return [{ kind: "mail", ports: [], mta: mta.name, line: mta.line }];
  return [];
}
/** Output of the MTA probe (paths of found binaries, one per line) -> { name, line } | null */
export function parseMta(text) {
  const line = String(text || "").split("\n").map((x) => x.trim()).find((x) => x.startsWith("/"));
  return line ? { name: line.split("/").pop(), line } : null;
}

/** crontab -l output -> persist facts. Only the schedule and the redacted command are kept. */
export function parseCron(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\r$/, "").trim();
    if (!line || line.startsWith("#") || /^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)) continue;
    const m = /^(@\w+|(?:\S+\s+){4}\S+)\s+(.+)$/.exec(line);
    if (!m || (!m[1].startsWith("@") && !/^[\d*/,\-A-Za-z]+(\s+[\d*/,\-A-Za-z]+){4}$/.test(m[1]))) continue;
    const safe = redact(line);
    out.push({ kind: "persist", where: "cron", entry: safe.slice(0, 120), ageDays: null, line: safe });
  }
  return out;
}

const LS_MAC = /^[-l][rwxsStT-]{9}[@+.]?\s+\d+\s+\S+\s+\S+\s+\d+\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})\s+(.+)$/;
const LS_ISO = /^[-l][rwxsStT-]{9}[@+.]?\s+\d+\s+\S+\s+\S+\s+\d+\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/;
/**
 * Output of `ls -l` over several directories (macOS -lT, Linux --time-style=long-iso) -> persist facts.
 * map(dir, name) decides what a file means ({where, entry}) or null to skip it.
 */
export function parseLs(text, now, map) {
  const out = [];
  let dir = "";
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const h = /^(\/.*):$/.exec(line);
    if (h) { dir = h[1]; continue; }
    let name, ms;
    let m = LS_MAC.exec(line);
    if (m) { name = m[5]; ms = Date.parse(`${m[1]} ${m[2]} ${m[4]} ${m[3]}`); }
    else if ((m = LS_ISO.exec(line))) { name = m[3]; ms = Date.parse(`${m[1]}T${m[2]}`); }
    else continue;
    name = name.replace(/ -> .*$/, "");
    const w = map(dir, name);
    if (w) out.push({ kind: "persist", where: w.where, entry: w.entry, ageDays: ageDays(ms, now), line: redact(line) });
  }
  return out;
}

/**
 * The authorized_keys probe prints "absent" | "unreadable" | "present", "mtime|<epoch s>" and one "key|<type>|<comment>"
 * per key. Key material never leaves the machine, so there is none to copy.
 */
export function parseAuthKeys(text, now) {
  const out = [];
  let mtime = null;
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const t = /^mtime\|(\d+)$/.exec(line);
    if (t) { mtime = Number(t[1]) * 1000; continue; }
    const k = /^key\|([^|]*)\|(.*)$/.exec(line);
    if (!k) continue;
    const comment = redact(k[2]).trim();
    out.push({ kind: "persist", where: "authorized_keys", entry: (k[1] + (comment ? " " + comment : "")).trim(), ageDays: null, line: redact(line), _mtime: mtime });
  }
  // the file's change date is the only age the system gives, the same for every key in it
  return out.map(({ _mtime, ...f }) => ({ ...f, ageDays: ageDays(mtime, now) }));
}

// mdls prints "2024-03-01 10:00:00 +0000" or "(null)"
const parseMdls = (s) => {
  const t = String(s || "").trim();
  if (!t || t === "(null)") return NaN;
  return Date.parse(t.replace(/^(\S+) (\S+) ([+-]\d{2})(\d{2})$/, "$1T$2$3:$4"));
};
/**
 * Old files in user folders. Lines: "dir|mtime epoch s|last-used date or - ".
 * usedKnown is true only when EVERY counted file has a real last-opened date (macOS mdls); then the age is measured
 * from that date. Otherwise the age is the last change and the wording elsewhere must be "old", never "never used".
 */
export function parseStale(text, now) {
  const dirs = new Map();
  for (const raw of String(text || "").split("\n")) {
    const m = /^(\/[^|]*)\|(\d+)\|(.*)$/.exec(raw.replace(/\r$/, ""));
    if (!m) continue;
    const g = dirs.get(m[1]) || { n: 0, items: [] };
    g.n++;
    g.items.push({ mtime: Number(m[2]) * 1000, used: parseMdls(m[3]), line: raw.replace(/\r$/, "") });
    dirs.set(m[1], g);
  }
  const out = [];
  for (const [dir, g] of dirs) {
    const usedKnown = g.items.every((i) => Number.isFinite(i.used));
    const key = (i) => (usedKnown ? i.used : i.mtime);
    const oldest = g.items.reduce((a, b) => (key(b) < key(a) ? b : a));
    out.push({ kind: "stale", dir, count: g.n, oldestDays: ageDays(key(oldest), now), usedKnown, line: redact(oldest.line) });
  }
  return out;
}
