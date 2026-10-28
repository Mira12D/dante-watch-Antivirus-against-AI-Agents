// What Dante says AFTER checking. A verdict on its own is a table; what makes it a companion is the sentence
// after it: what it means for you, and what to do next. Only from what was really found - no invented facts.
//
// Matrix: verdict (safe | warn | risk | unknown) x machine (mac | server) x what is at stake
//   (the check's own fix, an SSH door, a copy on disk, anything else). DE / EN / ES.
import { SAFE, WARN, RISK, UNKNOWN } from "../core/check.mjs";
import { lang } from "../i18n.mjs";

// kind of finding, read from the check id + its title. A hint for tone, never a claim about the world.
export function kindOf(r = {}) {
  const s = (String(r.id || "") + " " + String(r.title || "")).toLowerCase();
  if (/schluessel|key/.test(s)) return "key";
  if (/backup|sicherung|kopie/.test(s)) return "copy";
  if (/demo|uebung|übung/.test(s)) return "demo";
  return "other";
}

const L = (de, en, es) => {
  const l = lang();
  return l === "en" ? en : l === "es" ? es : de;
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// how many of each verdict - the sentence depends on whether this is the only hole or one of twenty
function tally(results = []) {
  const t = { safe: 0, warn: 0, risk: 0, unknown: 0, all: results.length };
  for (const r of results) if (r && t[r.verdict] !== undefined) t[r.verdict]++;
  return t;
}

// The whole comment after a check run: one line on the picture, then one sentence per finding worth a word.
// results = the same array the session already builds ({ c, r } or plain r). machine = "mac" | "server" | "".
export function comment(results = [], { machine = "", target = "localhost" } = {}) {
  const rows = results.map((x) => (x && x.r ? x.r : x)).filter(Boolean);
  if (!rows.length) return [];
  const mac = machine === "mac" || /mac|darwin|macos/i.test(String(machine));
  const where = target === "localhost" ? (mac ? L("deinem Mac", "your Mac", "tu Mac") : L("diesem Rechner", "this machine", "este equipo")) : L(target, target, target);
  const n = tally(rows);
  const out = [];

  if (n.risk === 0 && n.unknown === 0) {
    out.push(n.warn > 0
      ? L(`Auf ${where}: nichts offen — ${n.warn} Punkt${n.warn === 1 ? "" : "e"} will noch einen Schritt.`,
          `On ${where}: nothing open — ${n.warn} item${n.warn === 1 ? "" : "s"} still want${n.warn === 1 ? "s" : ""} a step.`,
          `En ${where}: nada abierto — ${n.warn} punto${n.warn === 1 ? "" : "s"} aún pide${n.warn === 1 ? "" : "n"} un paso.`)
      : L(`Auf ${where}: nichts offen.`, `On ${where}: nothing open.`, `En ${where}: nada abierto.`));
  } else if (n.risk > 0) {
    out.push(n.risk === 1
      ? L(`Auf ${where}: eine Tür steht offen.`, `On ${where}: one door is open.`, `En ${where}: una puerta está abierta.`)
      : L(`Auf ${where}: ${n.risk} Türen stehen offen.`, `On ${where}: ${n.risk} doors are open.`, `En ${where}: ${n.risk} puertas están abiertas.`));
  } else {
    out.push(L(`Auf ${where}: nichts bewiesen — ${n.unknown} Punkt${n.unknown === 1 ? "" : "e"} konnte ich nicht wirklich sehen.`,
      `On ${where}: nothing proven — I could not really see ${n.unknown} item${n.unknown === 1 ? "" : "s"}.`,
      `En ${where}: nada probado — no pude ver de verdad ${n.unknown} punto${n.unknown === 1 ? "" : "s"}.`));
  }

  // per finding: what it means for YOU + the next step. Safe findings only get a word when there is reason to.
  const risky = rows.filter((r) => r.verdict === RISK || (r.verdict === WARN && r.fix));
  for (const r of risky.slice(0, 4)) {
    const k = kindOf(r);
    if (r.verdict === RISK) {
      out.push(k === "key"
        ? L("Wer einen dieser Schlüssel hat, kommt rein — ohne Passwort. Zeig sie jemandem, der sie kennt, und nimm raus, was nicht dir gehört.",
            "Whoever holds one of these keys gets in — no password. Show them to someone who knows them and take out what is not yours.",
            "Quien tenga una de estas claves entra — sin contraseña. Enséñalas a quien las conozca y quita lo que no sea tuyo.")
        : k === "copy"
          ? L("Die Kopie verrät nicht viel, kann aber alte Reste tragen. Wenn du sie nicht brauchst: weg damit.",
              "The copy does not reveal much, but it can carry old leftovers. If you do not need it: gone.",
              "La copia no revela mucho, pero puede llevar restos viejos. Si no la necesitas: fuera.")
          : L("Das ist ein echter Weg rein. Schließen lohnt jetzt, nicht später.",
              "That is a real way in. Closing it is worth it now, not later.",
              "Eso es una vía real de entrada. Cerrarlo vale ahora, no luego."));
    } else {
      out.push(L("Kein Notfall, aber ein Rest, den du besser zumachst.", "Not an emergency, but a leftover better closed.", "No es urgencia, pero un resto mejor cerrado."));
    }
  }
  for (const r of rows.filter((r) => r.verdict === UNKNOWN).slice(0, 2)) {
    out.push(L("Was ich nicht sehen konnte, behaupte ich nicht sicher — das bleibt offen, bis ich hinschauen darf.",
      "What I could not see I will not call safe — it stays open until I may look.",
      "Lo que no pude ver no lo llamo seguro — queda abierto hasta que pueda mirar."));
  }
  if (n.risk === 0 && n.unknown === 0 && n.safe > 0) {
    out.push(pick(L(
      ["Die geprüften Punkte halten. Kein Beleg für eine offene Tür.", "Alles Geprüfte hält — und ich habe es gesehen, nicht geraten."],
      ["The checked points hold. No evidence of an open door.", "Everything checked holds — and I saw it, did not guess."],
      ["Los puntos revisados aguantan. Sin prueba de una puerta abierta.", "Todo lo revisado aguanta — y lo vi, no lo adiviné."])));
  }
  return out;
}

export default { comment, kindOf };