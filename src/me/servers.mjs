// "Do you know my servers?": answered from what Dante has found, not from the classifier's guess. The list comes
// from user.md (servers found in ~/.ssh/config at the first meeting) or, with none, the host names in known_hosts.
// For a server he has not looked at yet he can knock and read what runs there (OS, PHP): read-only, after a yes.
import { confirm } from "./onboard.mjs";
import { CHECK_VERB, LOCAL_RE } from "./pick.mjs";

// Word boundaries that understand accents: JS \b treats "é" as a non-letter, which breaks "qué" and "muéstrame".
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const SERVER = W("servers?|servern|servidor(?:es)?|rechner[n]?|maschinen?|machines?|m[aá]quinas?|hosts?");
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

export const describe = (s, M) => `${s.alias} - ${s.target}${s.os ? " · " + s.os : " · " + M.srvUnseen}`;

// io: mt, say, dim, ask, decide, probe(server) -> { ok, label, php }, writeUser
export async function serversFlow(io, user, hints = [], { all = false } = {}) {
  const M = io.mt(), servers = (user && user.servers) || [];
  if (!servers.length) {
    io.say("  " + (hints.length ? M.srvHintsOnly(hints.slice(0, all ? 200 : 8).join(", ") + (!all && hints.length > 8 ? ` (+${hints.length - 8})` : "")) : M.srvNone));
    return;
  }
  io.say("  " + M.srvHead(servers.length));
  for (const s of servers) io.say("   " + describe(s, M));
  const unseen = servers.filter((s) => !s.os);
  if (!unseen.length) { io.say("  " + io.dim(M.srvHowTo)); return; }
  if (!(await confirm(io, M.srvKnockAsk(unseen.length), M.explainKnock, { lenient: true }))) { io.say("  " + io.dim(M.srvHowTo)); return; }
  for (const s of unseen) {
    const r = await io.probe(s);
    if (r.ok) { s.os = r.label + (r.php ? " · PHP " + r.php : ""); io.say("  " + M.probed(s.alias, r.label, r.php)); }
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
