// Builds the classifiers ("ears") from the language library shipped as src/bib/bib.json:
// category -> intent -> [line, level, language]. Levels: G bulk run, E1 general phrasing, E2 personal
// phrasing, E3 a user line with personal values replaced by placeholders.
// Intents are ranked across all categories at once; a category-first pass confused more lines in tests.
// The example lines are generated; no real user input is stored here.
import { readFileSync } from "node:fs";
import { train, classify, tokens, sureFor, KNOWN } from "./router.mjs";
import { wash } from "./wash.mjs";
import { loadNet, predict } from "./net.mjs";
import { PROBE } from "./probe.mjs";
import { SYS_PROBE, MUSTER_PROBE, WISSEN_PROBE } from "./system.mjs";

let bib = null;
const load = () => (bib ||= JSON.parse(readFileSync(new URL("./bib.json", import.meta.url), "utf8")));
export const rowsOf = (cats) => cats.flatMap((c) => Object.entries(load().cats[c] || {}).flatMap(([intent, xs]) => xs.map(([text]) => ({ text, intent }))));
export const bibDate = () => load().date;
// Three neurons: the counting ear (bayes), the net, and the combiner (bayes^a · net^b, fitted on
// lines neither saw). WAY decides who may act:
//   bayes - the counting ear alone
//   einig - act only when both ears are sure on their own and say the same; else ask back
//   kombi - the combiner's joint probability decides
// The ranked list a human sees ("Meinst du ...?") always comes from the joint probability.
// Measured per ear on the held-out sentences: ohr  bayes 131/138 · 1 wrong · einig 130 · 0 wrong · kombi 131 · 3 wrong
//                            janein bayes 30/33 · einig 30/33 · kombi 33/33 (it can never say yes)
const WAYS = { ohr: "einig", janein: "kombi", system: "einig", muster: "einig", wissen: "einig" };
export const setWay = (w) => { WAYS.ohr = WAYS.janein = WAYS.system = WAYS.muster = WAYS.wissen = w; };
const ears = {};
let nets = null;
// Exact memory: a line that stands 1:1 in the bib - washed, so
// "server root@1.2.3.4" meets "server {ZIEL}" - is known, no probability in between. This is what
// makes E3 work: the trust rule keeps one line from deciding for OTHER lines, not for itself.
const exactKey = (t) => tokens(wash(t).text).join(" ");
// The domain ears (system, muster, wissen) sit behind the main ear's gap. Each also learns the lines of
// the OTHER domains as "unklar", so it stays silent on what is not its own and the order they are asked
// in does not matter. NEG says whose lines those are.
export const NEG = { system: ["muster", "wissen"], muster: ["systemwissen", "wissen"], wissen: ["muster", "systemwissen"] };
// ...and a fixed sample of everyday lines ("not Dante's work", small talk), so "write my essay" or "what is
// the weather" never wakes a domain ear. The sample is chosen by a hash of the line: the same bib gives
// the same rows, so the nets stay reproducible.
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const EVERYDAY = [["nichtdante", 4], ["smalltalk", 5]]; // [category, keep one line in n]
export const negRows = (name) => !NEG[name] ? [] : [
  ...NEG[name].flatMap((c) => Object.values(load().cats[c] || {}).flatMap((xs) => xs.map(([text]) => ({ text, intent: "unklar" })))),
  ...EVERYDAY.flatMap(([c, n]) => Object.values(load().cats[c] || {}).flatMap((xs) => xs.filter(([text]) => fnv(text) % n === 0).map(([text]) => ({ text, intent: "unklar" })))),
];
function hear(name, cats, extra, line) {
  const WAY = WAYS[name];
  const e = (ears[name] ||= (() => { const rows = [...extra, ...rowsOf(cats), ...negRows(name)]; const mem = new Map(rows.map((r) => [exactKey(r.text), r.intent])); return { m: train(rows), mem }; })());
  const known = e.mem.get(exactKey(line));
  if (known) return { intent: known, p: 1, known: 1, ranked: [{ intent: known, p: 1 }], exact: true };
  const b = classify(e.m, line, { all: true });
  const raw = (nets ||= JSON.parse(readFileSync(new URL("./net.json", import.meta.url), "utf8")))[name];
  if (WAY === "bayes" || !raw) return { ...b, ranked: b.ranked.slice(0, 3) };
  const net = (e.net ||= loadNet(raw)), { a, b: bw } = raw.comb;
  const pn = Object.fromEntries(predict(net, line).map((x) => [x.intent, x.p]));
  const s = b.ranked.map((x) => [x.intent, a * Math.log(x.p + 1e-9) + bw * Math.log((pn[x.intent] ?? 0) + 1e-9)]);
  const top = Math.max(...s.map((x) => x[1])), z = s.reduce((p, x) => p + Math.exp(x[1] - top), 0);
  const ranked = s.map(([intent, v]) => ({ intent, p: Math.exp(v - top) / z })).sort((x, y) => y.p - x.p);
  const netTop = Object.entries(pn).sort((x, y) => y[1] - x[1])[0];
  const netSure = netTop[1] >= sureFor(netTop[0]) && netTop[0] !== "unklar" ? netTop[0] : "unklar";
  const joint = ranked[0].p >= sureFor(ranked[0].intent) && b.known >= KNOWN && ranked[0].intent !== "unklar" ? ranked[0].intent : "unklar";
  const intent = WAY === "kombi" ? joint : b.intent === netSure ? b.intent : "unklar";
  return { intent, p: ranked[0].p, known: b.known, ranked: ranked.slice(0, 3), bayes: b.intent, net: netSure };
}
export const hearMain = (line) => hear("ohr", ["befehle", "fragen", "smalltalk", "nichtdante"], PROBE, line);
export const hearConsent = (line) => hear("janein", ["fixgespraech"], [], line);
// The third ear: only system knowledge (the sixth bib). The main ear decides it is a system job
// (pruef/server), THEN this ear picks the move: fingerabdruck / finde_php / pruef_php2shell / beleg /
// fix_php2shell. Kept apart from the five language bibs on purpose - no E1/E2/E3, family is a slot.
export const hearSystem = (line) => hear("system", ["systemwissen"], SYS_PROBE, line);
// The fourth ear: the Muster-Bib - the watchman's "go and look for what's wrong" moves. Also sits
// behind the main ear's gap; conservative (einig) so plain talk is never pulled into a patrol.
export const hearMuster = (line) => hear("muster", ["muster"], MUSTER_PROBE, line);
// The fifth ear: the Fachwissen-Bib - when a person asks Dante to EXPLAIN (what he watches, one topic,
// what stands out, what is normal). It learns the way of asking; the topic comes from the cards.
export const hearWissen = (line) => hear("wissen", ["wissen"], WISSEN_PROBE, line);

// Words that are about Dante's own schedule. A line with one of them is never "end the session", whatever the
// main ear heard ("schalt dich scharf" sounds like "schalt dich aus" to it): a hard bolt, no probability.
export const SETUP_WORDS = /\b(scharf\w*|arm yourself|armed|armar|disarm\w*|desarm\w*|patrouill\w*|patrol\w*|patrull\w*|zeitplan\w*|schedul\w*|horario|automatisch\w*|automatic\w*|automátic\w*|von selbst|on your own|por tu cuenta)\b/i;

// The domain ears behind the main ear's gap, in the order they are asked. Each knows what is not its
// own (the negative class), so the first one that speaks is the right one. null = none of them.
export function hearDomain(line) {
  for (const [ear, f] of [["muster", hearMuster], ["system", hearSystem], ["wissen", hearWissen]]) {
    const r = f(line);
    if (r.intent !== "unklar") return { ear, intent: r.intent, p: r.p };
  }
  return null;
}

// German, English or Spanish? A handful of telling words per language picks the answer's tongue.
// Boundaries that understand accents (JS \b would split "qué" at the accent).
const tell = (words) => new RegExp("(?<![\\p{L}])(?:" + words + ")(?![\\p{L}])|[¿¡ñ]", "giu");
const TELL = {
  es: tell("que|qué|mi|mis|tu|tus|el|las|como|cómo|por favor|hola|esto|eso|está|estoy|puedes|quiero|tengo|servidor|servidores|seguro|gracias|hackearon|conoces|cuáles|cuales|dónde|quién|revisa|mira|muéstrame|ayuda|bien|todos|máquinas|sí|vale|adelante|porque|pero|muy|nada|algo|ahora|puede"),
  en: tell("the|is|my|what|how|why|you|are|did|do|does|this|that|it|i|me|can|someone|safe|hacked|anywhere|even|wont|servers|know|find|found|which|list|show|machines|any|have|yes|please|hello|thanks|want|need|just|tell|your|with|not|and|but"),
  de: tell("der|die|das|ist|mein|meine|meinen|meiner|was|wie|warum|du|bin|ich|mir|mich|dir|dich|kann|jemand|sicher|gehackt|nicht|und|heißt|überhaupt|kennst|welche|hast|gefunden|zeig|zeige|prüf|prüfe|gesund|ordnung|dieser|diesen|von|auf|ja|nein|bitte|aber|also|gut|danke|es|sie|ihnen|ihr|schauen|schau|erlaube|noch|schon|doch|mal|nur|dann|dass|wenn|oder|auch|sehr|sind|habe|hab|möchte|will|wo|wer|wann|mit|für|ein|eine|einen|dem|den|im|am|zu"),
};
// No telling word at all ("fix", "demo") -> the fallback, so one bare command does not flip him. A tie keeps the language he is in.
export const langOf = (line, fallback = "de") => {
  const counts = Object.entries(TELL).map(([k, re]) => [k, (String(line).match(re) || []).length]);
  const top = Math.max(...counts.map((x) => x[1]));
  if (top === 0) return fallback;
  const lead = counts.filter((x) => x[1] === top).map((x) => x[0]);
  return lead.includes(fallback) ? fallback : lead[0];
};
