// The follow-up layer. A person asks a few kinds of things that only make sense next to what Dante just said:
// "which others?", "what are these?", "do it", "why?", "explain", "again", "is that bad?". They are few and always
// the same in shape; only WHAT they refer to changes. So they are recognised once (act), and sent to the topic of
// the last answer (route) - instead of one special rule per place. Pure, local, no probability: fixed words in
// German, English and Spanish, and only for short lines, so a new request is never taken for a follow-up.
import { wantsMore, wantsThese } from "./servers.mjs";

const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");

// "do it" must be the WHOLE line (so "mach den check" is a new request, not a hand-over)
const DO_IT = /^(?:mach(?:s)?(?: du)?(?: es| das)?(?: f[uü]r mich| bitte| mal)*|erledige(?: du)?(?: das| es)?|(?:you )?do it(?: for me| please)?|go ahead|fix it|please do|h[aá]zlo(?: t[uú])?(?: por m[ií])?|haz t[uú]|entferne den alten eintrag|l[oö]sche den alten eintrag|remove the old (?:entry|key)|ssh-keygen -r.*)$/u;
const WHY = W("warum|wieso|weshalb|wozu|why|how come|por qu[eé]|para qu[eé]");
const EXPLAIN = W("erkl[aä]r\\p{L}*|erz[aä]hl\\p{L}*|explain|tell me more|elaborate|explica\\p{L}*|cu[eé]ntame m[aá]s|wie meinst du das|was hei(?:ß|ss)t das|what do you mean|qu[eé] quieres decir|qu[eé] significa");
const AGAIN = W("nochmal|noch mal|nochmals|erneut|wiederhol\\p{L}*|again|once more|repeat|otra vez|de nuevo|rep[ií]te\\p{L}*");
const BAD = W("(?:ist|is|es) (?:das|that|it|esto|eso)? ?(?:schlimm|gef[aä]hrlich|kritisch|dramatisch|bad|dangerous|serious|critical|grave|peligroso|malo)|wie schlimm|how bad|qu[eé] tan grave|schlimm\\??|gef[aä]hrlich\\??");

// "was sind die 3 hinweise?", "what are the notes", "zeig die details": the items behind a count that was just shown
const DETAILS = W("was sind (?:die |diese |meine |alle )?(?:\\d+ )?(?:hinweise|funde|befunde|punkte|warnungen|meldungen|treffer)|welche (?:\\d+ )?(?:hinweise|funde|befunde|warnungen)|zeig(?:e)?(?: mir)?(?: bitte)? (?:die |alle )?(?:hinweise|details|funde|befunde|warnungen)|what are (?:the |these |those |my )?(?:\\d+ )?(?:notes|hints|findings|warnings|issues|results)|which (?:\\d+ )?(?:notes|hints|findings|warnings|issues)|show (?:me )?(?:the )?(?:notes|hints|details|findings|warnings)|qu[eé] son (?:los |las |esos |esas |mis )?(?:\\d+ )?(?:avisos|hallazgos|notas|advertencias)|cu[aá]les son (?:los |las )?(?:\\d+ )?(?:avisos|hallazgos|notas)|mu[eé]strame (?:los |las )?(?:avisos|detalles|hallazgos)|details?|detalles");
const short = (line) => String(line || "").trim().length <= 48;
const clean = (line) => String(line || "").trim().toLowerCase().replace(/[?!.,;:¿¡]+/g, " ").replace(/\s+/g, " ").trim();

/** which follow-up is this line? "more" | "these" | "details" | "doit" | "why" | "explain" | "again" | "bad" | null (a new request, or not short enough to be one) */
export function actOf(line) {
  if (!short(line)) return null;
  const l = clean(line);
  if (!l) return null;
  if (DETAILS.test(l) && l.split(" ").length <= 8) return "details";
  if (/tell me more|erz[aä]hl\p{L}* (?:mir )?mehr|cu[eé]ntame m[aá]s/iu.test(l)) return "explain";   // asks for the story, not for the next items
  if (/once more|one more time|noch ?mal|otra vez|de nuevo/iu.test(l) && l.split(" ").length <= 4) return "again";
  if (wantsMore(line)) return "more";
  if (wantsThese(line)) return "these";
  // "do it" is the whole line or its first words: "mach du es", "mach das", "do it please", "hazlo tú"
  if (DO_IT.test(l)) return "doit";
  if (BAD.test(l)) return "bad";
  if (WHY.test(l) && l.split(" ").length <= 5) return "why";
  if (EXPLAIN.test(l) && l.split(" ").length <= 7) return "explain";
  if (AGAIN.test(l) && l.split(" ").length <= 4) return "again";
  return null;
}

/**
 * Where does follow-up `act` go, given the topic of Dante's last answer? Returns the session's own intent name or null (no
 * route: the line goes on to the ears as usual).
 *   topic: "servers" | "hostkey" | "findings" | null     ctx: { hasFix, hasOpen }
 */
export function route(act, topic, ctx = {}) {
  if (!act || !topic) return null;
  switch (topic) {
    case "servers":
      if (act === "doit") return ctx.changedHost ? "hostkeyfix" : null;   // a host-key step is still open, whatever was shown in between
      return { more: "servermore", these: "serverthese", why: "serverexplain", explain: "serverexplain", details: "serverthese", again: "serverliste" }[act] || null;
    case "hostkey":
      return { doit: "hostkeyfix", why: "hostkeywhy", explain: "hostkeywhy", bad: "hostkeywhy" }[act] || null;
    case "fleet":   // the answer was a round over several servers
      if (act === "doit") return ctx.changedHost ? "hostkeyfix" : null;
      if (act === "again") return "serverscheck";
      if (act === "why" || act === "explain") return ctx.changedHost && !ctx.hasFleetNotes ? "hostkeywhy" : "fleetdetail";
      return { details: "fleetdetail", more: "fleetdetail", these: "fleetdetail", bad: "fleetdetail" }[act] || null;
    case "findings":
      if (act === "doit") return ctx.hasFix ? "fix" : ctx.changedHost ? "hostkeyfix" : null;
      if (act === "again") return "pruef";
      if (act === "more" || act === "details") return ctx.hasOpen ? "recap" : null;
      if (act === "why" || act === "explain" || act === "bad") return ctx.hasFix ? "howfix" : ctx.hasOpen ? "recap" : null;
      return null;
    default:
      return null;
  }
}
