// What the conversation remembers, and what to do with a line nobody understood. Pure functions over a small state, so the
// session loop only asks. The state lives in memory for one session and is never written anywhere.
const W = (re) => new RegExp("(?:^|[^\\p{L}])(?:" + re + ")(?![\\p{L}])", "iu");

// The memory is a ring: the newest line comes in, the one past MEMORY drops out.
export const MEMORY = 100;
export const newConv = () => ({ turns: [], asked: null, askedRun: 0 });

// One line per turn: what the person said, what Dante took it for, how it was answered.
export function note(conv, line, intent, route) {
  conv.turns.push({ line: String(line).slice(0, 200), intent, route });
  while (conv.turns.length > MEMORY) conv.turns.shift();
}

// Words in the line (a long line is a story or a trap, not a command).
export const wordCount = (line) => String(line).trim().split(/\s+/).filter(Boolean).length;
export const LONG = 14;

// A line nobody understood. Guesses count only when they are close to sure; a guess is not asked twice in a row;
// a long line gets one plain request to say it short instead of a menu of percentages.
export function fallback(conv, line, ranked) {
  const guesses = (ranked || []).filter((x) => x.intent !== "unklar" && x.p >= 0.3).slice(0, 2).filter((g, i) => i === 0 || g.p >= 0.25);
  if (wordCount(line) > LONG && !(guesses[0] && guesses[0].p >= 0.6)) { conv.asked = null; return { kind: "long" }; }
  if (!guesses.length) { conv.asked = null; return { kind: "none" }; }
  if (conv.asked === guesses[0].intent) { conv.askedRun++; conv.asked = null; return { kind: "again" }; }
  conv.asked = guesses[0].intent; conv.askedRun = 0;
  return { kind: "ask", guesses };
}
// A line that was understood resets the ask-back memory.
export const understood = (conv) => { conv.asked = null; };

// "what did I say a moment ago / what did you answer" - answered from the turns, never from invention.
export const wantsRecap = (line) => W("(?:was|what|qu[eé]) (?:habe ich|hab ich|did i|dije|hab' ich) (?:dir )?(?:eben|gerade|vorhin|just|a moment ago|antes|hace un momento)|(?:was|what|qu[eé]) (?:hast du|did you|dijiste)(?: say| sagen| gesagt| answer)? (?:eben|gerade|vorhin|just|a moment ago|antes)|(?:was|what) war (?:meine|deine) letzte|zähl.{0,20}antworten|what was (?:my|your) last|cu[aá]l fue (?:mi|tu) [uú]ltim").test(line);
export function recap(conv, lang) {
  const t = conv.turns.slice(-3);   // closed turns only: the current line is not "before"
  if (!t.length) return { de: ["Bisher nichts. Wir fangen gerade an."], en: ["Nothing yet. We are just starting."], es: ["Todavía nada. Acabamos de empezar."] }[lang];
  const head = { de: "Zuletzt hast du gesagt:", en: "Lately you said:", es: "Últimamente dijiste:" }[lang];
  return [head, ...t.map((x) => `  «${x.line.length > 80 ? x.line.slice(0, 80) + "…" : x.line}» → ${x.route}${x.intent ? " / " + x.intent : ""}`)];
}

// "where in the code does it say that you only read" - the true answer is a pointer to real places.
export const wantsCodeProof = (line) => W("wo (?:genau )?(?:im|in dem) code|wo steht (?:im code|das|dass)|zeig (?:mir )?(?:die |den )?(?:stelle|code)|where in the code|show me the code|d[oó]nde (?:en el|est[aá] en el) c[oó]digo").test(line) && W("lies|liest|lesen|nur|read|reads|only|lee|lees|sólo|solo|ändere|änderst|change|changes|cambia|schreib\\w*|send\\w*|sendest|fetch|network|netz\\w*|call\\w*|ruf\\w*").test(line);
export const CODE_PROOF = {
  de: ["Prüf mich nach, das ist alles lesbarer Code:", "  • Alle Befehle laufen durch src/core/sh.mjs (Server per ssh) und src/core/fsx.mjs (dieser Rechner), nirgends sonst.", "  • Es gibt keinen HTTP-Client und kein fetch im Paket; die einzigen Netz-Aufrufe sind curl-Zeilen, die du vorher siehst und mit Ja startest: Pack-Abruf, Katalog, Versionsprüfung (README: „What Dante sends, reads and writes“).", "  • Geschrieben wird nur in ~/.dante/ und, nach deinem Ja, in den Zeitplan."],
  en: ["Check me, it is all readable code:", "  • Every command runs through src/core/sh.mjs (servers over ssh) and src/core/fsx.mjs (this machine), nowhere else.", "  • The package has no HTTP client and no fetch; the only network calls are curl lines you see first and start with a yes: pack download, catalog, version check (README: “What Dante sends, reads and writes”).", "  • Writing happens only in ~/.dante/ and, after your yes, in the schedule."],
  es: ["Compruébalo, todo es código legible:", "  • Todos los comandos pasan por src/core/sh.mjs (servidores por ssh) y src/core/fsx.mjs (esta máquina), en ningún otro sitio.", "  • El paquete no tiene cliente HTTP ni fetch; las únicas llamadas de red son líneas curl que ves antes y arrancas con un sí: descarga de packs, catálogo, comprobación de versión (README: «What Dante sends, reads and writes»).", "  • Solo se escribe en ~/.dante/ y, tras tu sí, en el horario."],
};
export const FALLBACK = {
  long: { de: "Das ist viel auf einmal. Sag es mir in einem Satz, was ich tun soll — oder „hilfe“.", en: "That is a lot at once. Tell me in one sentence what I should do — or “help”.", es: "Es mucho de golpe. Dime en una frase qué debo hacer — o «ayuda»." },
  again: { de: "Ich habe dich nicht verstanden, und raten bringt uns nicht weiter. Sag es anders, oder „hilfe“.", en: "I did not understand you, and guessing gets us nowhere. Put it another way, or “help”.", es: "No te he entendido y adivinar no ayuda. Dilo de otra forma, o «ayuda»." },
};

// "wie mache ich den Schritt?" - the person means the open step of the last check, not a new check.
export const wantsHowFix = (line) => W("wie (?:mach(?:e|t|st)?|erledige|setze|führe|fuehre) ich (?:den|das|die|es|dies\\w*)|wie (?:behebe|beheb|löse|loese|schließe|schliesse|fixe|repariere) ich|wie (?:kann|soll|muss) ich (?:das|den|es|die) (?:beheben|lösen|loesen|schließen|schliessen|machen|beseitigen)|was (?:muss|soll|kann) ich (?:jetzt |nun )?(?:tun|machen)|was (?:nun|jetzt) tun|how (?:do|can|should) i (?:do|fix|close|solve|resolve|handle) (?:that|this|it|the step)|how to (?:fix|close|solve) (?:that|this|it)|what (?:should|do|can|must) i do(?: now| about (?:that|this|it))?|c[oó]mo (?:lo |la )?(?:arreglo|soluciono|resuelvo|hago|cierro)|qu[eé] (?:hago|debo hacer|tengo que hacer)").test(line);

// "prüfe die 4" after a numbered list was shown: the number belongs to THAT list. -> the number, or null
export function menuPick(line, size) {
  const t = String(line).trim();
  const m = /(?:^|\s)(?:pr[uü]f\w*|check|revisa|nimm|nehme?|take|mach|nummer|nr\.?|number|n[uú]mero|option|die|den|the|el|la|#)\s*(?:die|den|das|nummer|nr\.?|number|the|el|la|n[uú]mero|#)?\s*#?(\d{1,2})\b/i.exec(t);
  const n = m ? Number(m[1]) : null;
  return n && n >= 1 && n <= size && !/@|\./.test(t) ? n : null;   // an address or a version number is not a menu pick
}
export const HOWFIX = {
  head: { de: "Zum offenen Schritt, ohne etwas zu ändern:", en: "About the open step, without changing anything:", es: "Sobre el paso abierto, sin cambiar nada:" },
  tail: { de: "Ich mache nichts, bevor du es willst. Sag „fix“, dann zeige ich den Plan noch einmal und frage nach deinem Ja.", en: "I do nothing until you want it. Say “fix” and I show the plan again and ask for your yes.", es: "No hago nada hasta que lo quieras. Di «fix» y te muestro el plan otra vez y pido tu sí." },
};
