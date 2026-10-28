// "Do you know my servers?": answered from what Dante has found, not from the classifier's guess. The list comes
// from user.md (servers found in ~/.ssh/config at the first meeting) or, with none, the host names in known_hosts.
// For a server he has not looked at yet he can knock and read what runs there (OS, PHP): read-only, after a yes.
import { confirm } from "./onboard.mjs";
import { CHECK_VERB, LOCAL_RE } from "./pick.mjs";

// Word boundaries that understand accents: JS \b treats "é" as a non-letter, which breaks "qué" and "muéstrame".
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const SERVER = W("servers?|servern|servidor(?:es)?|vps|vserver|root-?server|droplet|rechner[n]?|maschinen?|machines?|m[aá]quinas?|hosts?");
const KNOW_VERB = W("kenn\\p{L}*|wei(?:ß|ss)t?|gefunden|know|found|did you find|conoc\\p{L}*|encontr\\p{L}*");
const LIST_VERB = W("hast du|siehst|welche|was f[uü]r|zeig\\p{L}*|liste\\p{L}*|aufz[aä]hl\\p{L}*|which|what|list|show|see|cu[aá]les|qu[eé]|mu[eé]str\\p{L}*|lista\\p{L}*");
const MINE = W("mein\\p{L}*|m(?:ie|ei|ni)\\p{L}*|my|mis?|von mir|i have|have i|ich habe|habe ich|ich hab|hab ich|tengo");
/** "welche server habe ich", "which servers do I have", "cuáles son mis servidores": asks for the servers themselves (plural) */
export const asksWhichServers = (line) => W("welche (?:meiner |deiner )?server|was f[uü]r server|which (?:of my )?servers|what servers|qu[eé] servidores|cu[aá]les (?:son )?(?:mis )?servidores").test(line);

/** "kennst du meine server", "which servers did you find", "qué servidores conoces". Not a request to check one. */
export const wantsServerList = (line, hasTarget) => !hasTarget && SERVER.test(line) && !CHECK_VERB.test(line) && (W("servers?|servern|servidor(?:es)?|hosts?").test(line) || KNOW_VERB.test(line)) && (KNOW_VERB.test(line) || (asksWhichServers(line) && (MINE.test(line) || /\b(habe|hab|have|tengo)\b/i.test(line))) || (LIST_VERB.test(line) && MINE.test(line) && !W("welcher|which one").test(line)));

const FIND_VERB = W("find\\p{L}*|such\\p{L}*|sp[uü]r\\p{L}*|entdeck\\p{L}*|aufsp\\p{L}*|discover|search|look for|busca\\p{L}*|encuentra\\p{L}*|descubre\\p{L}*");
const PAST_OR_ASK = W("did|have|has|hast|hat|haben|welche|which|cu[aá]les|qu[eé]|was|wie viele|how many|cu[aá]ntos");
/** "finde meine server", "find my servers", "busca mis servidores": go and look for them (an action, not a question). */
export const wantsFind = (line, hasTarget) => !hasTarget && SERVER.test(line) && FIND_VERB.test(line) && !PAST_OR_ASK.test(line) && !CHECK_VERB.test(line);

const STATUS = W("wie geht\\p{L}*|wie l[aä]uft\\p{L}*|wie steht\\p{L}*|wie sieht\\p{L}* aus|status|alles ok|l[aä]uft alles|how are|how is|how's|everything ok|everything fine|c[oó]mo est[aá]n|c[oó]mo van|c[oó]mo andan|todo bien|estado");
/** "wie geht's meinen servern", "how are my servers doing", "cómo están mis servidores": look at all known servers. */
export const wantsStatus = (line, hasTarget) => !hasTarget && SERVER.test(line) && STATUS.test(line) && !CHECK_VERB.test(line);

// "meine server" / "all my servers": several machines, so the answer is a check of every known server, not of the current target
const PLURAL = W("meine server|meinen servern|meiner server|alle server|alle meine server|alle meinen server|all my servers|all of my servers|all servers|my servers|mis servidores|todos mis servidores|todos los servidores");
const SAFETY = W("sicher\\p{L}*|gesund|in ordnung|sauber|ok|okay|safe|secure|healthy|clean|fine|seguros?|sanos?|bien|limpios?|gecheckt|gepr[uü]ft|checked|revisados?|comprobados?");
/** "sind meine server sicher gecheckt?", "check all my servers", "¿están seguros mis servidores?": every known server gets checked */
export const wantsServersCheck = (line, hasTarget) => !hasTarget && PLURAL.test(line) && (CHECK_VERB.test(line) || SAFETY.test(line)) && !KNOW_VERB.test(line) && !FIND_VERB.test(line) && !PAST_OR_ASK.test(line.replace(W("sind|are|est[aá]n"), ""));

const THIS = W("dieser|diesen|dieses|der|den|das|mein\\p{L}*|this|my|the|este|esta|mi");
const MACHINE = W("server|rechner|mac|macbook|maschine|kiste|box|system|laptop|machine|servidor|equipo|ordenador|sistema");
const HEALTH = W("in ordnung|ok|okay|gesund|sicher|sauber|fit|heil|alles gut|healthy|fine|safe|clean|secure|all good|bien|sano|seguro|limpio|todo bien");
/** "dieser server in ordnung?", "is my mac safe", "este servidor está bien": a health question about the current target. */
export const wantsHealth = (line, hasTarget) => !hasTarget && !PLURAL.test(line) && THIS.test(line) && MACHINE.test(line) && HEALTH.test(line) && !KNOW_VERB.test(line) && !LIST_VERB.test(line.replace(W("ist|is|est[aá]"), ""));

// alias - target · role (whose words) · what really runs (with the day) · system.
// Nothing is merged: a role is always marked as the person's, what runs is always marked as seen, and a server
// that was never visited says so instead of guessing.
export const describe = (s, M) => {
  const bits = [];
  if (s.role) bits.push(s.role + " " + M.srvRoleBy);
  if (s.what) bits.push(s.what + (s.seen ? " " + M.srvSeenOn(s.seen) : ""));
  if (s.os) bits.push(s.os);
  if (!bits.length) bits.push(M.srvUnseen);
  return `${s.alias} - ${s.target} · ${bits.join(" · ")}`;
};

// ---- Auskunft über DEINE Server: "was ist der zweite", "what is db", "qué es el último" -----------------------------
// A position with its article ("der zweite", "the last one", "el segundo") or an alias names one of the person's servers.
// Without such a reference the question stays about this machine (wantsSysInfo). The answer is read from what Dante keeps:
// the role is the person's word, what runs is what he saw on a day - never merged, never guessed.
const PLACES = [[/^(erst|first|primer)/, 1], [/^(zweit|second|segund)/, 2], [/^(dritt|third|tercer)/, 3], [/^(viert|fourth|cuart)/, 4], [/^(f[uü]nft|fuenft|fifth|quint)/, 5]];
const ARTICLE = /^(der|die|den|dem|das|the|el|la|lo|los|las)$/;
const LASTW = /^(letzt|last|[uú]ltim)/;
const words = (l) => String(l || "").toLowerCase().split(/[^\p{L}\d@._-]+/u).filter(Boolean);
/** the server a line points at by place ("der zweite") or alias; null if it points at none */
export function serverIn(line, servers) {
  const ws = words(line), n = (servers || []).length;
  if (!n) return null;
  for (let i = 1; i < ws.length; i++) {
    if (!ARTICLE.test(ws[i - 1])) continue;
    if (LASTW.test(ws[i])) return servers[n - 1];
    for (const [re, k] of PLACES) if (re.test(ws[i]) && k <= n) return servers[k - 1];
  }
  const named = servers.filter((s) => s.alias && s.alias.length >= 2 && ws.includes(s.alias.toLowerCase()));
  return named.length === 1 ? named[0] : null;
}
const ABOUT_Q = /(^|[^\p{L}])(was ist|was l[aä]uft|wof[uü]r|wozu|what is|what'?s|what runs|what does|qu[eé] es|qu[eé] corre|para qu[eé]|erz[aä]hl|tell me about|cu[eé]ntame)(?![\p{L}])/iu;
const CHECKY = /pr[uü]f|check|scan|revisa|untersuch|sicher\b|safe\b|seguro|fix|repar/i;
/** "was ist der zweite", "what is db", "erzähl mir was über den ersten": the server the person asks ABOUT, or null */
export function serverAbout(line, servers) {
  const l = String(line || "");
  if (!ABOUT_Q.test(l) || CHECKY.test(l) || l.length > 90) return null;
  return serverIn(l, servers);
}
const ROLE_RE = /(?:^|\s)(?:ist|is|es|hei(?:ß|ss)t|=)\s+(?:(?:die|der|das|mein(?:e|en)?|unser(?:e|en)?|the|my|our|el|la|mi|nuestr[oa])\s+)?([\p{L}\d][\p{L}\d ._-]{1,40})$/iu;
const ROLE_NOT = /^(offline|online|down|kaputt|tot|langsam|slow|ok|okay|sicher|safe|seguro|fertig|dran|da|das|hier|nicht|not|no|ja|yes|nein|s[ií]|ready|broken|rooted|gehackt|hacked)$/i;
/** "der zweite ist die kasse", "db is the database": { server, role } or null. The role is the person's own word. */
export function serverRole(line, servers) {
  const l = String(line || "").trim();
  if (l.includes("?") || ABOUT_Q.test(l) || l.length > 80) return null;
  const m = ROLE_RE.exec(l);
  if (!m) return null;
  const role = m[1].trim().replace(/[.!]+$/, ""), rw = role.split(/\s+/);
  if (rw.length > 4 || ROLE_NOT.test(role)) return null;
  const head = l.slice(0, m.index);
  const server = serverIn(head, servers);
  return server ? { server, role } : null;
}
/** what Dante can say about one server, from what he keeps - three kinds of statement, each marked */
export function aboutLines(s, M) {
  const out = [`${s.alias} - ${s.target}`];
  out.push(s.role ? `${M.srvAboutRole(s.role)} ${M.srvRoleBy}` : M.srvAboutNoRole);
  out.push(s.what ? `${M.srvAboutRuns(s.what)}${s.seen ? " " + M.srvSeenOn(s.seen) : ""}` : M.srvAboutUnseen);
  if (s.os) out.push(s.os);
  return out;
}

// io: mt, say, dim, ask, decide, probe(server) -> { ok, label, php }, writeUser
export async function serversFlow(io, user, hints = [], { all = false } = {}) {
  const M = io.mt(), servers = (user && user.servers) || [];
  if (!servers.length) {
    io.say("  " + (hints.length ? M.srvHintsOnly(hints.slice(0, all ? 200 : 8).join(", ") + (!all && hints.length > 8 ? ` (+${hints.length - 8})` : "")) : M.srvNone));
    return;
  }
  io.say("  " + M.srvHead(servers.length));
  for (const s of servers) io.say("   " + describe(s, M));
  // a door he already tried this session and could not open is not asked about again: he says what he knows instead
  const tried = servers.filter((s) => !s.os && io.unreachable && io.unreachable(s));
  for (const s of tried) io.say("  " + io.dim(M.srvTried(s.alias, M.sshWhy(io.unreachable(s), ""))));
  const unseen = servers.filter((s) => !s.os && !tried.includes(s));
  if (!unseen.length) { io.say("  " + io.dim(M.srvHowTo)); return; }
  if (!(await confirm(io, M.srvKnockAsk(unseen.length), M.explainKnock, { lenient: true }))) { io.say("  " + io.dim(M.srvHowTo)); return; }
  for (const s of unseen) {
    const r = await io.probe(s);
    // what he saw is kept, not just the system name: it is what he can describe the box with next time
    if (r.ok) {
      s.os = r.label + (r.php ? " · PHP " + r.php : "");
      if (r.what) { s.what = r.what; s.seen = (io.today && io.today()) || ""; }
      io.say("  " + M.probed(s.alias, r.label, r.php) + (r.what ? " " + M.probedWhat(r.what) : ""));
    }
    else io.say("  " + M.notReached(s.alias, M.sshWhy(r.code, r.line)));
  }
  io.writeUser(user);
  io.diary({ kind: "act", what: "servers" });
}

/**
 * "Find my servers": read the places a person's servers leave traces in (the ssh config, known_hosts) and add new ones
 * to user.md with the patrol off. found = { hosts: [{alias, target, key}], hints: [name] }.
 */
export async function findFlow(io, user, found) {
  const M = io.mt(), have = new Set(((user && user.servers) || []).flatMap((s) => [s.alias, s.target]));
  const fresh = (found.hosts || []).filter((h) => !have.has(h.alias) && !have.has(h.target));
  io.say("  " + M.findSources((found.hosts || []).length, (found.hints || []).length));
  if (fresh.length) {
    user.servers = [...(user.servers || []), ...fresh.map((h) => ({ alias: h.alias, target: h.target, key: h.key || "", os: "", patrol: false }))];
    io.writeUser(user);
    io.diary({ kind: "act", what: "servers-found" });
    io.say("  " + M.findNew(fresh.map((h) => h.alias).join(", ")));
  } else if ((user.servers || []).length) io.say("  " + M.findNothingNew);

  // The strongest trace is the shell history: where the person really logs in, as whom, with which key. Reading it
  // takes its own yes, and only the targets of ssh/scp/rsync lines are kept.
  let hints = found.hints || [];
  if (found.readHistory && (await confirm(io, M.findHistoryAsk, M.findHistoryWhy, { lenient: true }))) {
    const known = new Set((user.servers || []).flatMap((s) => [s.alias, s.target, (s.target || "").replace(/^.*@/, "")]));
    const cand = (await found.readHistory()).filter((h) => !known.has(h.target) && !known.has(h.host));
    if (!cand.length) io.say("  " + M.findHistoryNone);
    else {
      io.say("  " + M.findHistoryHead(cand.length));
      for (const h of cand.slice(0, 8)) io.say("   " + M.findHistoryLine(h));
      if (await confirm(io, M.findHistoryTake(Math.min(cand.length, 8)), M.findHistoryWhy)) {
        const take = cand.slice(0, 8);
        user.servers = [...(user.servers || []), ...take.map((h) => ({ alias: h.host, target: h.target, key: h.key || "", os: "", patrol: false }))];
        io.writeUser(user);
        io.diary({ kind: "act", what: "servers-from-history" });
        io.say("  " + M.findNew(take.map((h) => h.host).join(", ")));
      }
    }
    const taken = new Set((user.servers || []).map((s) => (s.target || "").replace(/^.*@/, "")));
    hints = hints.filter((h) => !taken.has(h));
  }
  await serversFlow(io, user, hints);
}

/** "welche noch?", "und die anderen?", "noch mehr?", "which others?", "¿y los otros?": a follow-up on the list just shown */
export const wantsMore = (line) => W("(?:und |aber )?(?:welche|which|cu[aá]les|qu[eé]) (?:noch|sonst|others?|m[aá]s|otros)|noch (?:welche|mehr|andere)|(?:die )?(?:anderen|weiteren|restlichen)|weitere|mehr|and (?:the )?(?:others?|more)|any (?:others?|more)|what else|more|others?|y (?:los )?(?:otros|dem[aá]s)|otros|m[aá]s|algo m[aá]s").test(line) && line.trim().split(/\s+/).length <= 5;

/** "was sind diese server?", "what are these servers", "¿qué son estos servidores?": a question about the list just shown */
export const wantsThese = (line) => W("(?:was|what|qu[eé]) (?:sind|ist|are|is|son|es) (?:denn |eigentlich |nochmal )?(?:diese|die|das|these|those|that|estos|esos|esas|estas)(?: \\p{L}+)? (?:server|rechner|maschinen|kisten|hosts?|servers|machines|boxes|servidores|equipos|m[aá]quinas)|(?:diese|these|those|estos|esos) (?:server|servers|rechner|hosts|servidores) (?:sind|are|son)\\b.*\\?|qu[eé] pueden hacer|(?:was|what|qu[eé]) (?:k[oö]n\\p{L}{1,4}|kann|can|pueden|puede)(?: \\p{L}+)? (?:die|diese|der|das|sie|they|these|those|it|ellos|ellas|estos|esos|esas|estas|meine|meinen|unsere|my|our|mis|nuestros)(?: \\p{L}+)?(?: (?:alles|denn|eigentlich))?\\b").test(String(line || "")) && String(line).length < 70;

/** "per SSH auf meinem Webserver nachsehen", "can you SSH into my VPS", "check my staging server over SSH": a remote machine is meant, but no target is named.
 *  It must NEVER fall back to this machine - Dante asks which one (the caller shows the server list). */
const REMOTE = W("ssh|vps|webserver|web-server|staging|stage|produktions?\\p{L}*|production|prod");
const REMOTE_ACT = W("verbind\\p{L}*|einlogg\\p{L}*|login|log in|log into|sign in|nachsehen|nachschau\\p{L}*|schau\\p{L}*|guck\\p{L}*|pr[uü]f\\p{L}*|check\\p{L}*|inspect|look|poking|poke|connect|let me in|lets me in|l[aä]sst mich|reinkomm\\p{L}*|conect\\p{L}*|entr\\p{L}*|revisa\\p{L}*|mira|comprueba\\p{L}*|entrar|accede\\p{L}*|nachsehen|reinschauen");
const REMOTE_NOT = W("schl[uü]ssel|keys?|llaves?|claves?|key-?gen|dazwischen|man-in-the-middle|mitm|find\\p{L}*|such\\p{L}*|search|busca\\p{L}*|config|konfig\\p{L}*|install\\p{L}*|what is|was ist|welche\\p{L}*|which|qu[eé] es|cu[aá]l\\p{L}*");
export const wantsRemote = (line, hasTarget) => !hasTarget && REMOTE.test(line) && REMOTE_ACT.test(line) && !REMOTE_NOT.test(line) && String(line).length < 140;

/** the line names machines at all ("wie gehts" alone is a greeting; "wie gehts den servern", "alles ok bei allen?" is about them) */
export const namesMachines = (line) => SERVER.test(line) || W("server\\p{L}*|kiste\\p{L}*|box(?:en)?|vps|flotte|fleet|allen|alle|all|todos|todas").test(line);
