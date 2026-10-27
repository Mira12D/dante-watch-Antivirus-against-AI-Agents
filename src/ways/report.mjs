// The report: Markdown in ~/.dante/reports/YYYY-MM-DD.md. Every finding carries its evidence lines.
// The builder only ever receives assessments (levels + reason lines + card texts), never raw values; as a
// second wall, anything that looks like a secret is blanked in the output anyway.
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { resolve, join, sep } from "node:path";

const LEVELS = ["hoch", "mittel", "niedrig", "unbekannt"];
const T = {
  de: { title: "Dante-Bericht", mach: "Maschine", none: "nichts", lv: { hoch: "Hoch", mittel: "Mittel", niedrig: "Niedrig", unbekannt: "Unbekannt (nicht lesbar, keine Aussage)" }, ev: "Belege", what: "Was ist das", why: "Warum Angreifer es mögen", normal: "Normal ist", red: "Warnzeichen", fix: "Behebung (nur Text, ändert nichts von allein)", isNew: "neu seit dem letzten Besuch", dev: "weicht vom Üblichen ab", opts: "Deine drei Möglichkeiten", o1: "Dante räumt auf, nach einem klaren Ja zu einem vorher gezeigten Befehl.", o2: "Du machst es selbst, mit der Behebung oben.", o3: "Du rufst Virgil (npx virgil-cli) und gibst ihm diesen Bericht.", ai: "Für deine KI", aiHint: "Diesen Absatz 1:1 in eine KI kopieren. Er enthält keine Geheimnisse.", aiLead: (os, n) => `Ich nutze ${os}. Ein Sicherheitswächter hat auf meinem Rechner ${n} Wege gefunden, die ein Angreifer gehen könnte. Jede Aussage hat ihre echte Zeile als Beleg.`, aiTask: "Aufgabe: Erkläre mir jeden Fund einfach, sage was davon wirklich zu tun ist und was normal ist, und gib mir für jeden nötigen Schritt den genauen Befehl mit Hinweis, was er ändert. Ändere nichts ohne mein Ja. Gib keine Zugangsdaten aus und frage nicht danach." },
  en: { title: "Dante report", mach: "Machine", none: "none", lv: { hoch: "High", mittel: "Medium", niedrig: "Low", unbekannt: "Unknown (not readable, no claim)" }, ev: "Evidence", what: "What it is", why: "Why attackers like it", normal: "Normal is", red: "Red flag", fix: "Fix (text only, changes nothing by itself)", isNew: "new since last visit", dev: "deviates from the usual", opts: "Your three options", o1: "Dante cleans up, after a clear yes to a command shown first.", o2: "You do it yourself, using the fix above.", o3: "You call Virgil (npx virgil-cli) and hand him this report.", ai: "For your AI", aiHint: "Copy this paragraph 1:1 into an AI. It contains no secrets.", aiLead: (os, n) => `I use ${os}. A security watchman found ${n} paths on my machine that an attacker could take. Every statement carries its real line as evidence.`, aiTask: "Task: Explain each finding simply, tell me what really needs doing and what is normal, and give me the exact command for each needed step with a note on what it changes. Change nothing without my yes. Do not print credentials and do not ask for them." },
  es: { title: "Informe de Dante", mach: "Máquina", none: "nada", lv: { hoch: "Alto", mittel: "Medio", niedrig: "Bajo", unbekannt: "Desconocido (no legible, sin afirmación)" }, ev: "Pruebas", what: "Qué es", why: "Por qué le gusta a un atacante", normal: "Lo normal es", red: "Señal de alarma", fix: "Arreglo (solo texto, no cambia nada solo)", isNew: "nuevo desde la última visita", dev: "se desvía de lo habitual", opts: "Tus tres opciones", o1: "Dante ordena, tras un sí claro a un comando mostrado antes.", o2: "Lo haces tú, con el arreglo de arriba.", o3: "Llamas a Virgil (npx virgil-cli) y le das este informe.", ai: "Para tu IA", aiHint: "Copia este párrafo tal cual en una IA. No contiene secretos.", aiLead: (os, n) => `Uso ${os}. Un vigilante de seguridad encontró ${n} caminos en mi equipo que un atacante podría tomar. Cada afirmación lleva su línea real como prueba.`, aiTask: "Tarea: Explícame cada hallazgo de forma sencilla, dime qué hay que hacer de verdad y qué es normal, y dame el comando exacto para cada paso necesario indicando qué cambia. No cambies nada sin mi sí. No muestres credenciales ni las pidas." },
};

// Second wall: blank anything that looks like a secret. Evidence lines should never carry values anyway.
const SECRET = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}/g,
  /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\b(ghp|gho|ghs|github_pat|xox[abprs]|glpat)[-_][A-Za-z0-9_-]{16,}/g,
  /\b(password|passwd|passphrase|secret|token|api[_-]?key|apikey|auth)\b(\s*[=:]\s*)\S+/gi,
  /\b[A-Fa-f0-9]{40,}\b/g,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}(?![A-Za-z0-9])/g,
];
export const scrub = (s) => SECRET.reduce((acc, re) => acc.replace(re, (m, a, b) => (b !== undefined && /^\s*[=:]\s*$/.test(b) ? `${a}${b}[verborgen]` : "[verborgen]")), String(s ?? ""));

const pick = (v, lang) => (v == null ? "" : typeof v === "string" ? v : v[lang] || v.en || v.de || "");
const oneLine = (s) => scrub(s).replace(/\s*\n\s*/g, " ").trim();

export function buildReport({ date, os, assessments = [], summary, lang = "de" } = {}) {
  const t = T[lang] || T.de, lg = T[lang] ? lang : "de";
  const by = Object.fromEntries(LEVELS.map((l) => [l, assessments.filter((a) => a.level === l)]));
  const out = [`# ${t.title} ${date}`, "", `${t.mach}: ${oneLine(os)}`];
  if (summary) out.push("", oneLine(summary));
  for (const l of LEVELS) {
    out.push("", `## ${t.lv[l]} (${by[l].length})`);
    if (!by[l].length) { out.push("", `- ${t.none}`); continue; }
    for (const a of by[l]) {
      out.push("", `### ${oneLine(a.way || a.id)}`);
      const flags = [a.isNew === true ? t.isNew : null, a.deviates ? t.dev : null].filter(Boolean);
      if (flags.length) out.push("", `_${flags.join("; ")}_`);
      out.push("", `**${t.ev}:**`, ...(a.reasons?.length ? a.reasons : ["-"]).map((r) => "- `" + oneLine(r).replace(/`/g, "'") + "`"));
      const c = a.card;
      if (c) for (const [k, label] of [["what", t.what], ["why", t.why], ["normal", t.normal], ["redflag", t.red], ["fix", t.fix]]) {
        const v = oneLine(pick(c[k], lg));
        if (v) out.push("", `**${label}:** ${v}`);
      }
    }
  }
  out.push("", `## ${t.opts}`, "", `1. ${t.o1}`, `2. ${t.o2}`, `3. ${t.o3}`);
  const real = assessments.filter((a) => a.level !== "niedrig");
  out.push("", "---", "", `## ${t.ai}`, "", `> ${t.aiHint}`, "", "<!-- BEGIN-KI -->", t.aiLead(oneLine(os), assessments.length));
  for (const a of real) out.push("", `- [${a.level}] ${oneLine(a.way || a.id)}: ` + (a.reasons || []).map(oneLine).join(" | "));
  out.push("", t.aiTask, "<!-- END-KI -->", "");
  return out.join("\n");
}

/** Writes <home>/reports/<date>.md (file 0600, dir 0700). Refuses anything that would land outside home. */
export function writeReport(home, date, text) {
  if (!home || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error("report refused: bad date");
  const base = resolve(home), dir = join(base, "reports"), file = resolve(dir, date + ".md");
  if (!file.startsWith(dir + sep)) throw new Error("report refused: path outside home");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* not ours to change */ }
  writeFileSync(file, scrub(text) === String(text) ? String(text) : scrub(text), { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}
