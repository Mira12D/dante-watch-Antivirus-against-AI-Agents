// Naive Bayes classifier for what the user typed: returns an intent and a probability. No network.
// Four feature kinds are counted from the example library: first word, words, word pairs, letter
// triples (so typos like "prüff" or "chek" still land). A feature shared by many intents counts for
// less, which makes filler words fall out without a stop-word list. Below the confidence threshold it
// answers "unklar" and returns the two best candidates instead of guessing.

const WEIGHT = { f: 1.5, w: 1, b: 1, c: 0.25 };
const ALPHA = 0.5;      // smoothing: an unseen pairing is rare, not impossible
const SHARP = 2;        // measured on the held-out set: 1 -> too shy, ≥2.5 -> only bolder, not wiser
export const SURE = 0.6;     // below this the router asks instead of acting
// Risk-weighted: an intent that only ANSWERS (a question, small talk, a greeting) may speak from
// SURE_ANSWER on - a wrong answer is wrong text, never a deed. Actions keep SURE.
// Measured on the held-out sentences: 135 of 146 question misses had the right intent on top, only under 60 %.
export const ANSWER_ONLY = new Set(["frage_luecke", "frage_urteil", "frage_gehackt", "frage_dante", "smalltalk", "gruss", "hilfe", "unklar"]);
export let SURE_ANSWER = Number(process.env.DANTE_SURE_ANSWER || 0.4);
export const sureFor = (intent) => (ANSWER_ONLY.has(intent) ? SURE_ANSWER : SURE);
export const KNOWN = 0.35;   // below this share of known evidence the line is "outside the bib"

const strip = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "");

// Real values become their slot, so "server root@1.2.3.4" and "server me@box" teach the same thing.
export function mark(text) {
  return String(text)
    .replace(/\b[\w.-]+@[\w.-]+\b/g, " {ziel} ")
    .replace(/(^|\s)(~|\.{0,2})\/\S+/g, " {pfad} ")
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, " {ziel} ");
}

export function tokens(text) {
  return strip(mark(text).toLowerCase()).match(/\{\w+\}|[a-z0-9]+/g) || [];
}

export function features(text) {
  const t = tokens(text);
  const out = [];
  if (t.length) out.push(["f:" + t[0], WEIGHT.f]);
  for (let i = 0; i < t.length; i++) {
    out.push(["w:" + t[i], WEIGHT.w]);
    if (i) out.push(["b:" + t[i - 1] + "_" + t[i], WEIGHT.b]);
    if (t[i][0] !== "{") {
      const g = "^" + t[i] + "$";
      for (let j = 0; j + 3 <= g.length; j++) out.push(["c:" + g.slice(j, j + 3), WEIGHT.c]);
    }
  }
  return out;
}

// The model only keeps raw counts, so it can learn one line at a time (the build server loop adds a
// line the moment it finds a gap and checks again right away). Everything derived - balance,
// filler-word weight, trust - is worked out at the moment of hearing, from those counts.
// balance: every intent weighs the same in total, so one huge intent ("unklar", 10× the others)
// keeps its breadth of words but stops winning by sheer mass. Measured on the bib, not guessed.
// trust: a feature seen once ("prüff" in one single line) gets a fifth of its weight, full weight
// from TRUST sightings on - one example must not turn into "99.9 % sure".
const TRUST = 5; // measured: 3 still let one "prüff"-line decide alone, 5 does not

export function model({ balance = true, trust = TRUST } = {}) {
  return { intents: {}, seen: {}, spread: {}, n: 0, v: 0, balance, trust };
}

export function learn(m, { intent, text }) {
  const k = (m.intents[intent] ||= { docs: 0, total: 0, f: {} });
  k.docs++; m.n++;
  for (const [f, w] of features(text)) {
    if (!k.f[f]) { k.f[f] = 0; m.spread[f] = (m.spread[f] || 0) + 1; }
    k.f[f] += w; k.total += w;
    if (!m.seen[f]) m.v++;
    m.seen[f] = (m.seen[f] || 0) + 1;
  }
  return m;
}

// The exact inverse of learn - the build server takes a line back out when it proved too broad.
export function unlearn(m, { intent, text }) {
  const k = m.intents[intent];
  if (!k) return m;
  k.docs--; m.n--;
  for (const [f, w] of features(text)) {
    k.f[f] -= w; k.total -= w;
    if (k.f[f] <= 1e-9) { delete k.f[f]; if (--m.spread[f] <= 0) delete m.spread[f]; }
    if (--m.seen[f] <= 0) { delete m.seen[f]; m.v--; }
  }
  if (k.docs <= 0) delete m.intents[intent];
  return m;
}

export function train(samples, opts) {
  const m = model(opts);
  for (const s of samples) learn(m, s);
  return m;
}

export function classify(m, text, { sharp = SHARP, all = false } = {}) {
  const names = Object.keys(m.intents);
  const n = names.length;
  const totals = names.map((c) => m.intents[c].total);
  const target = totals.slice().sort((a, b) => a - b)[Math.floor(n / 2)];
  const scale = names.map((c, i) => (m.balance ? target / totals[i] : 1));
  const weight = (f) => (m.seen[f] ? Math.min(1, m.seen[f] / m.trust) * Math.log(1 + n / m.spread[f]) / Math.log(1 + n) : 0);
  const fs = features(text).map(([f, w]) => [f, w * weight(f)]).filter(([, w]) => w > 0);
  // "known" is judged per word: a typo counts as known when most of its letter triples are
  const knownWord = (t) => {
    if (m.seen["w:" + t]) return true;
    if (t[0] === "{") return false;
    const g = "^" + t + "$";
    let hit = 0, all = 0;
    for (let j = 0; j + 3 <= g.length; j++, all++) if (m.seen["c:" + g.slice(j, j + 3)]) hit++;
    return all > 0 && hit / all >= 0.5;
  };
  const words = tokens(text);
  const known = words.length ? words.filter(knownWord).length / words.length : 0;
  // Complement: judge each intent by how badly the line fits all the OTHERS. Big intents
  // (400 lines) then stop swallowing small ones (160 lines) - "ich geh jetzt" stays "raus".
  const restTotal = names.reduce((a, c, i) => a + scale[i] * totals[i], 0);
  const rest = fs.map(([f]) => names.reduce((a, c, i) => a + scale[i] * (m.intents[c].f[f] || 0), 0));
  const raw = names.map((c, i) => {
    const k = m.intents[c];
    const tot = restTotal - scale[i] * k.total;
    let s = 0;
    fs.forEach(([f, w], j) => { s -= w * Math.log((rest[j] - scale[i] * (k.f[f] || 0) + ALPHA) / (tot + ALPHA * m.v)); });
    return s * sharp;
  });
  const top = Math.max(...raw);
  const ex = raw.map((r) => Math.exp(r - top));
  const z = ex.reduce((a, b) => a + b, 0);
  const ranked = names.map((c, i) => ({ intent: c, p: ex[i] / z })).sort((a, b) => b.p - a.p);
  const best = ranked[0];
  const sure = best.p >= sureFor(best.intent) && known >= KNOWN && best.intent !== "unklar";
  return { intent: sure ? best.intent : "unklar", p: best.p, known, ranked: all ? ranked : ranked.slice(0, 3) };
}

// "this machine" in any of the three languages - a slot, not an intent: "check local" is a check
// whose target is here. A word list decides it, no probability in between.
const LOCAL = /(^|\s)(lokal|local|localhost|hier|here|aqu[ií]|diese[nm]? (rechner|laptop|mac|pc)|meine?[nm]? (rechner|laptop|mac|pc)|this (machine|computer|box|laptop|mac|pc)|my (own )?(machine|computer|box|laptop|mac|pc)|mi (compu|computadora|pc|equipo|laptop|mac)|este equipo|esta (compu|computadora|pc))(?=$|[\s,.!?])/i;

// The value a command needs (target / key path / local), read from the raw line - never invented.
export function slots(text) {
  const ziel = String(text).match(/\b[\w.-]+@[\w.-]+\b/) || String(text).match(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  const pfad = String(text).match(/(?:^|\s)((?:~|\.{0,2})\/\S+)/);
  return { ziel: ziel ? ziel[0] : null, pfad: pfad ? pfad[1] : null, lokal: LOCAL.test(String(text)) };
}
