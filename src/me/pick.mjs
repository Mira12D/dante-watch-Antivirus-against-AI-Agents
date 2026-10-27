// Resolves "check my server" without an address from what is known: this machine, servers from
// user.md, or hosts from known_hosts if there are none. The user answers with a number or part of a name.
// A host taken from known_hosts is only a name, so the login user is asked before connecting.
import { validHost } from "../core/sh.mjs";

export const LOCAL_RE = /\b(mac|macbook|imac|laptop|notebook|rechner|computer|pc|ordenador|equipo|port[aá]til|machine|hier|lokal|local|this machine)\b/i;
export const CHECK_VERB = /pr[uü]f|p[uü]rf|[uü]berpr|check|scan|schau|sieh|test|revis|mira|analy|look|untersuch|durchleucht|vigil/i;
export const SERVER_ASK = /\b(mein(en|e|)|my|mi)\s+(server|servidor)\b/i;
export const PLACEHOLDER = /^(<?(ziel|target|destino|host|ip|adresse|address|direcci[oó]n)>?|server|servidor)$/i;

/** "überprüfe meinen mac", "meinen mac ?" → this machine. A host or a path in the line means something else. */
export function wantsLocal(line, hasTarget) {
  if (hasTarget || !LOCAL_RE.test(line)) return false;
  return CHECK_VERB.test(line) || /^\s*(mein(en|e|)|mi|my)\s+\S+\s*\??\s*$/i.test(line);
}
/** "prüfe meinen server" with no target in it. */
export const wantsServerPick = (line, hasTarget) => !hasTarget && SERVER_ASK.test(line) && !LOCAL_RE.test(line.replace(/server|servidor/gi, ""));
/** the word after "server" is no host but a placeholder ("server ziel", "server <ziel>") or not a valid host at all */
export const badTarget = (to) => !to || PLACEHOLDER.test(String(to).trim().split(/\s+/)[0]) || !validHost(String(to).replace(/^[A-Za-z0-9_.-]+@/, "").trim()) && !validHost(String(to).trim());

export const SHOW = 8;    // how many entries one list shows; with many machines the person narrows by typing a part of a name

export function options({ servers = [], hints = [] }) {
  const out = [{ kind: "local" }];
  if (servers.length > 1) out.push({ kind: "all", count: servers.length });
  for (const s of servers) out.push({ kind: "server", alias: s.alias, target: s.target, key: s.key || null, os: s.os || "" });
  if (!servers.length) for (const h of hints.slice(0, 6)) out.push({ kind: "hint", host: h });
  return out;
}
/** a number, "mac"/"hier", "alle", or part of a server's name or address. Several matches → { kind: "many", list }. */
export function choose(answer, opts) {
  const a = String(answer || "").trim().toLowerCase();
  if (!a) return null;
  if (/^\d{1,3}$/.test(a)) return opts[Number(a) - 1] || null;
  if (/^(alle|alles|all|todos|todo|everything|jeden)$/.test(a)) return opts.find((o) => o.kind === "all") || null;
  if (LOCAL_RE.test(a) || /^(dieser|diesen|este|this)\b/.test(a)) return opts[0];
  const hits = opts.filter((o) => o.kind === "server" || o.kind === "hint").filter((o) => [o.alias, o.target, o.host].some((x) => x && x.toLowerCase().includes(a)));
  return hits.length === 1 ? hits[0] : hits.length > 1 ? { kind: "many", list: hits } : null;
}

const label = (M, o) => (o.kind === "local" ? M.pickLocal : o.kind === "all" ? M.pickAll(o.count) : o.kind === "server" ? M.pickServer(o) : M.pickHint(o.host));
function show(io, M, list) {
  list.slice(0, SHOW + 2).forEach((o, i) => io.say("   " + (i + 1) + ") " + label(M, o)));
  if (list.length > SHOW + 2) io.say("   " + M.pickMore(list.length - (SHOW + 2)));
}

// io: mt, say, dim, askFree(prompt). The numbers always refer to the list that is on screen.
export async function pickFlow(io, opts) {
  const M = io.mt();
  let list = opts;
  io.say("  " + M.pickHead);
  show(io, M, list);
  for (let tries = 0; tries < 4; tries++) {
    const o = choose(await io.askFree(M.pickAsk), list);
    if (!o) { io.say("  " + M.pickAgain); continue; }
    if (o.kind === "many") { list = o.list; io.say("  " + M.pickNarrow(list.length)); show(io, M, list); continue; }
    if (o.kind !== "hint") return o;
    const user = (await io.askFree(M.pickUser)).trim() || "root";
    const target = /^[A-Za-z0-9_.-]+$/.test(user) ? `${user}@${o.host}` : "";
    if (!target || !validHost(target)) { io.say("  " + M.pickAgain); continue; }
    return { kind: "server", alias: o.host, target, key: null, os: "" };
  }
  return null;
}
