// Knowledge cards (built in and from packs): what a topic is, why it matters, what stands out, what is
// normal, how Dante checks, what to do. Finds the card a question refers to and answers in at most four
// lines. States knowledge only, never a result.
import { lang } from "../i18n.mjs";
import { BUILTIN } from "./builtin.mjs";

// lower case, no accents, ß->ss, everything else that is not a letter or digit -> one space
export const norm = (s) => String(s).replace(/ß/g, "ss").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// the built-in cards, plus the cards of the installed packs (a later pack's card replaces one with the same id)
export function cardsOf(packs) {
  const byId = new Map(BUILTIN.know.map((c) => [c.id, c]));
  for (const p of packs || []) for (const c of p.know || []) byId.set(c.id, c);
  return [...byId.values()];
}

// The card whose alias occurs in the line; the longest alias wins ("php shell" beats "shell").
export function findCard(line, cards) {
  const t = " " + norm(line) + " ";
  let best = null, score = 0;
  for (const c of cards) for (const a of c.aliases) {
    const n = norm(a);
    if (n && t.includes(" " + n + " ") && n.length > score) { best = c; score = n.length; }
  }
  return best;
}

// Which side of a topic is asked about. Plain words per language, checked on the normalised line.
const FACETS = [
  ["todo", /\b(was tun|was tu\w* ich|was kann ich|dagegen|was mach\w*|was soll\w*|beheb\w*|schliess\w*|repar\w*|fixen|loesen|what (should|do|can) i do|how (do|can) i (fix|close|solve|repair)|fix it|que hago|como (arreglo|soluciono|cierro|reparo)|que debo)\b/],
  ["how", /\b(wie pruf\w*|wie such\w*|wie find\w*|woher weisst?|woran siehst|wie funktioniert|wie gehst|how do you (check|look|find|know|test)|how does (it|this) work|como (lo |la |los |las )?(revisas|buscas|compruebas|comprueba|sabes|funciona\w*)|de donde sabes)\b/],
  ["normal", /\b(normal\w*|unauffall\w*|auffall\w*|verdachtig\w*|erkenn\w*|aussieh\w*|aussehen|suspicious|stands? out|looks? like|spot|sospechos\w*|raro|rara|aspecto|se ve|llama la atencion|como se ve|reconozco|reconocer)\b/],
  ["why", /\b(warum|wieso|weshalb|gefahrlich\w*|schlimm|why|dangerous|risky|por que|peligros\w*|riesgo)\b/],
];
export function facetOf(line) {
  const t = norm(line);
  for (const [name, re] of FACETS) if (re.test(t)) return name;
  return "basic";
}

const T = {
  de: { job: "Mein Job: Server, die dir gehören, nur lesend prüfen — und jedes Urteil auf eine echte Zeile stellen.", watch: "Ich achte auf:", more: "Frag mich „was ist <Thema>?“ oder „woran erkenne ich das?“. Mit „prüf alles“ gehe ich die Runde.",
        hint: "Frag mich auch: „woran erkenne ich das?“ · „wie prüfst du das?“ · „was tue ich dagegen?“", unknown: "Dazu habe ich keine Karte. Ich kann dir erklären:" },
  en: { job: "My job: look at servers you own, read-only — and put every verdict on a real line.", watch: "I watch for:", more: "Ask me “what is <topic>?” or “what stands out?”. Say “check everything” and I make the round.",
        hint: "Ask me too: “what stands out?” · “how do you check this?” · “what do I do about it?”", unknown: "I have no card for that. I can explain:" },
  es: { job: "Mi trabajo: mirar servidores tuyos, solo leyendo — y apoyar cada veredicto en una línea real.", watch: "Vigilo:", more: "Pregúntame «¿qué es <tema>?» o «¿qué llama la atención?». Di «revisa todo» y hago la ronda.",
        hint: "Pregúntame también: «¿qué llama la atención?» · «¿cómo lo compruebas?» · «¿qué hago al respecto?»", unknown: "No tengo una tarjeta para eso. Puedo explicarte:" },
};
// the short names of the topics (the part before the dash), at most n, then "· +k"
const titles = (cards, n = 6) => {
  const L = lang(), t = cards.map((c) => (c[L] || c.de).title.split(" — ")[0]);
  return t.slice(0, n).join(" · ") + (t.length > n ? ` · +${t.length - n}` : "");
};

// intent "job": what do you watch / what is your job. intent "thema": explain one topic.
// card = the card to explain (found in the line, or the one of the last finding).
export function answer({ intent, line, cards, card }) {
  const L = lang(), X = T[L] || T.en;
  if (intent === "job") return { title: null, lines: [X.job, X.watch + " " + titles(cards), X.more] };
  if (!card) return { title: null, lines: [X.unknown + " " + titles(cards)] };
  const k = card[L] || card.de, facet = facetOf(line);
  const pick = { basic: ["what", "why"], why: ["why", "signs"], normal: ["signs", "normal"], how: ["how"], todo: ["todo"] }[facet];
  return { title: k.title, lines: pick.map((f) => k[f]), hint: facet === "basic" ? X.hint : null };
}
