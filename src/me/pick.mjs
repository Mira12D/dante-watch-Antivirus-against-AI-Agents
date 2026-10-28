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
// "der zweite", "the last one", "el tercero": the place in a list, said in words. Cardinals ("drei") only count in a short answer
// to "Nummer oder Name"; ordinals count anywhere in a line. Two different places in one line ("die drei, nein die zwei") are no answer.
const ORD = [[/^(erst(e|en|er|es)?|first|primer[oa]?|1st)$/, 1], [/^(zweit(e|en|er|es)?|second|segund[oa]|2nd)$/, 2], [/^(dritt(e|en|er|es)?|third|tercer[oa]?|3rd)$/, 3], [/^(viert(e|en|er|es)?|fourth|cuart[oa]|4th)$/, 4], [/^(f[uü]nft(e|en|er|es)?|fuenft(e|en|er|es)?|fifth|quint[oa]|5th)$/, 5]];
const LAST = /^(letzt(e|en|er|es)?|last|[uú]ltim[oa])$/;
const CARD = { eins: 1, one: 1, uno: 1, zwei: 2, two: 2, dos: 2, drei: 3, three: 3, tres: 3, vier: 4, four: 4, cuatro: 4, "fünf": 5, fuenf: 5, five: 5, cinco: 5 };
export function placeIn(text, size, { cardinals = false } = {}) {
  const found = new Set();
  for (const w of String(text).toLowerCase().split(/[^\p{L}\d]+/u).filter(Boolean)) {
    const o = ORD.find(([re]) => re.test(w));
    if (o) found.add(o[1]); else if (LAST.test(w)) found.add(size); else if (cardinals && CARD[w]) found.add(CARD[w]);
  }
  const [n] = found;
  return found.size === 1 && n >= 1 && n <= size ? n : null;
}
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hostPart = (t) => String(t || "").replace(/^[^@]*@/, "");
// a server named somewhere in the line: its alias or its address as a whole word ("nimm db", "203.0.113.12 halt")
const namedIn = (a0, opts) => {
  const a = a0.replace(/[.,;:!?]+(?=\s|$)/g, " ");   // "check db." - the full stop ends the sentence, it is not part of a host name
  const hits = opts.filter((o) => o.kind === "server" || o.kind === "hint").filter((o) => [o.alias, hostPart(o.target), o.host].some((x) => x && x.length >= 2 && new RegExp(`(^|[^\\w.-])${esc(x.toLowerCase())}($|[^\\w.-])`).test(a)));
  return hits.length === 1 ? hits[0] : null;
};

/** a number, "mac"/"hier", "alle", or part of a server's name or address. Several matches → { kind: "many", list }. */
export function choose(answer, opts) {
  const a = String(answer || "").trim().toLowerCase().replace(/[\s!?.,;:)]+$/, "");   // "3!!", "2." are a number
  if (!a) return null;
  if (/^\d{1,3}$/.test(a)) return opts[Number(a) - 1] || null;
  if (/^(alle|alles|all|todos|todo|everything|jeden)$/.test(a)) return opts.find((o) => o.kind === "all") || null;
  if (LOCAL_RE.test(a) || /^(dieser|diesen|este|this)\b/.test(a)) return opts[0];
  const hits = opts.filter((o) => o.kind === "server" || o.kind === "hint").filter((o) => [o.alias, o.target, o.host].some((x) => x && x.toLowerCase().includes(a)));
  if (hits.length) return hits.length === 1 ? hits[0] : { kind: "many", list: hits };
  const named = namedIn(a, opts);
  if (named) return named;
  const n = placeIn(a, opts.length, { cardinals: a.split(/\s+/).length <= 4 });
  return n ? opts[n - 1] : null;
}

// "mach mal bei dem zweiten", "nimm db", "the last one" after a list of machines: which one of the list? Only for a line that is about
// a machine (short, or with a machine word or a check verb), never for "der erste Schritt" or "the second finding".
const MACHINE = /server|servidor|rechner|maschine|machine|kiste|box|host|equipo|m[aá]quina|computer|ordenador|nimm|nehm|take|toma|coge|pr[uü]f|check|revisa|mira|schau|mach|haz|do\b/i;
const NOT_A_MACHINE = /schritt|step|paso|fund|befund|finding|hallazgo|punkt|point|punto|frage|question|pregunta|wort|word|palabra|befehl|command|comando|antwort|answer|respuesta|satz|sentence|frase|liste?\b|list\b/i;
const OTHER = /(^|[^\p{L}])(ander(e|en|er|es)?|other|otr[oa])(?![\p{L}])/u;
// A question about a machine ("welche ip hat db?", "cuál es, el segundo o el último") wants an answer, not a check.
const QUESTION = /(^|[^\p{L}])(cu[aá]l|welche\w*|which|qu[eé]|what|was|wo|where|d[oó]nde|warum|wieso|why|por qu[eé]|is there|gibt es|hay)(?![\p{L}])/u;
// a place counts with its article ("den zweiten", "the last one", "el otro"), so "revisa este equipo primero" (first = beforehand) does not
const ART = "(?:der|die|den|dem|das|the|el|la|lo|los|las)";
const PLACE_WORD = /^(erst|zweit|dritt|viert|f[uü]nft|fuenft|letzt)(e|en|er|es)?$|^(first|second|third|fourth|fifth|last)$|^(primer|segund|tercer|cuart|quint|[uú]ltim)[oa]?$/;
const withArticle = (l) => l.split(/[^\p{L}\d]+/u).filter(Boolean).some((w, i, ws) => PLACE_WORD.test(w) && i > 0 && new RegExp(`^${ART}$`).test(ws[i - 1]));
export function pickInLine(line, choices, current = null) {
  const l = String(line || "").toLowerCase().trim(), words = l.split(/\s+/).length;
  if (!choices || !choices.length || NOT_A_MACHINE.test(l) || QUESTION.test(l) || (l.includes("?") && words > 4)) return null;
  if (!(words <= 6 || MACHINE.test(l))) return null;
  // "und der andere": of two machines, the one that is not the current one
  const servers = choices.filter((c) => c.kind === "server");
  if (OTHER.test(l) && new RegExp(`${ART}\\s+(ander|other|otr)`).test(l) && current && servers.length === 2 && servers.some((c) => c.target === current)) return servers.find((c) => c.target !== current);
  // a name counts with a check verb or alone ("nimm db", "check db", "db")
  const named = namedIn(l, choices);
  if (named && named.kind === "server" && (words <= 3 || /nimm|nehm|take|toma|coge|pr[uü]f|check|revisa|mira|schau|scan/.test(l))) return named;
  const n = (words <= 2 || withArticle(l)) ? placeIn(l, choices.length) : null;
  return n && choices[n - 1].kind !== "hint" ? choices[n - 1] : null;
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
    const raw = await io.askFree(M.pickAsk);
    const o = choose(raw, list);
    // a line that is no choice and reads like a request ("my name is ...", "was sind die hinweise ?") is not an answer: the pick is dropped and the line is the next input
    if (!o && io.queue && /\s\S+\s/.test(raw.trim()) && !/^\d+$/.test(raw.trim())) { io.queue.push(raw.trim()); io.pickDropped = true; return null; }
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
