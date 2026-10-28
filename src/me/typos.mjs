// Fixed spelling help for the words that carry a request ("chek", "servres", "pruef", "mak"). Local, no probability, no learning:
// a short list of exact misspellings, plus "one letter off" for longer command words (a swapped or a wrong or a missing letter,
// never an extra one, so a real word like "welcher" is left alone). Names, addresses, paths and anything with digits or symbols
// are never touched, and a capitalised word inside a sentence ("ich heiße Mak") is a name.
const EXACT = {
  chek: "check", cehck: "check", chck: "check", chekc: "check", cheack: "check", cheak: "check", scna: "scan", sacn: "scan",
  mak: "mac", mack: "mac", macc: "mac", safee: "safe", sfae: "safe", saef: "safe", ky: "key", kye: "key",
  pruef: "prüf", pruf: "prüf", pruefe: "prüfe", pruefen: "prüfen", pruefs: "prüfs", schluessel: "schlüssel", schlussel: "schlüssel",
  koeder: "köder", laeuft: "läuft", passwoerter: "passwörter", geheimnisse: "geheimnisse", zeig: "zeig", serveer: "server", servr: "server", srver: "server",
  revisr: "revisa", servidr: "servidor",
};
const VOCAB = ["check", "report", "server", "servers", "secure", "machine", "computer", "laptop", "which", "running", "update", "please",
  "whether", "hacked", "secrets", "projects", "folder", "status", "servidor", "servidores", "seguro", "claves", "informe", "revisa",
  "prüfe", "schlüssel", "bericht", "rechner", "welche", "läuft", "projekte", "geheimnisse", "sicher", "zeige", "bitte", "meinen", "maschine", "passwörter", "köder"];
const SET = new Set(VOCAB);

// is `w` exactly one swapped pair, one wrong letter or one MISSING letter away from `v` (not one extra letter)?
function near(w, v) {
  if (w === v) return true;
  if (w.length === v.length) {
    let diff = [];
    for (let i = 0; i < w.length; i++) if (w[i] !== v[i]) { diff.push(i); if (diff.length > 2) return false; }
    if (diff.length === 1) return true;                                                     // one wrong letter
    return diff.length === 2 && diff[1] === diff[0] + 1 && w[diff[0]] === v[diff[1]] && w[diff[1]] === v[diff[0]];   // a swapped pair
  }
  if (w.length === v.length - 1) {                                                          // a missing letter
    for (let i = 0; i < v.length; i++) if (v.slice(0, i) + v.slice(i + 1) === w) return true;
  }
  return false;
}

export function fixTypos(line) {
  const s = String(line || "");
  if (!s || s.length > 200) return s;
  return s.replace(/[A-Za-zÄÖÜäöüß]+/g, (w, at, whole) => {
    const before = whole[at - 1], after = whole[at + w.length];
    if (/[\d@./~:_\-]/.test(before || "") || /[\d@/~:_]/.test(after || "") || (after === "." && /[A-Za-z]/.test(whole[at + w.length + 1] || ""))) return w;   // part of an address, path, flag or number
    const low = w.toLowerCase();
    if (w !== low && at > 0 && w[0] !== w[0].toLowerCase()) return w;                       // a capitalised word inside a sentence is a name
    if (EXACT[low]) { const r = EXACT[low]; return w[0] !== low[0] ? r[0].toUpperCase() + r.slice(1) : r; }
    if (low.length < 6 || SET.has(low)) return w;
    const hit = VOCAB.filter((v) => v.length >= 5 && near(low, v));
    return hit.length === 1 ? (w[0] !== low[0] ? hit[0][0].toUpperCase() + hit[0].slice(1) : hit[0]) : w;
  });
}
