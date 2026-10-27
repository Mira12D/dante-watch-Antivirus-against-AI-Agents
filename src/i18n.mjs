// German, English and Spanish texts, language detection and the command vocabulary. The starting
// language comes from saved choice, environment and system settings; later it follows the user's lines.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirOwned, writeOwned } from "./core/perm.mjs";
const T = {
  de: {
    rSafe: " SICHER ", rWarn: " SCHRITT NÖTIG ", rRisk: " OFFEN ", rUnknown: " UNBEKANNT ", rWhat: "was:", rHow: "wie:", rWhere: "wo: ", rProof: "belege:",
    rNoProof: "(ohne Beleg — nicht als Beweis gewertet)", rSuggest: "vorschlag:", rCanClose: "Dante kann das schließen.", rWithFix: "  (Plan + ja/nein mit --fix)",
    sOpen: "offen", sStep: "Schritt nötig", sUnknown: "unbekannt", sSafe: "sicher", sWatch: "Dante · Wache über ", sNone: "keine Checks",
    sLaw: "Jedes Urteil steht auf einer echten Zeile. Fehlt die Zeile, sagt Dante „unbekannt“, nie „sicher“.",
    intro: "Ich bin Dante.", introSub: " Ich gehe durch die Hölle und bringe die Karte.",
    arm: "Soll ich wachen?", armOpts: "[ja / nein]", sleepNo: "Dann schlafe ich. Beschwör mich, wenn du mich brauchst.",
    armed: "Scharf.", awake: "wach", langSet: "Sprache: Deutsch. Gemerkt.", langHow: "Welche? Sag „sprache de“, „sprache en“ oder „sprache es“.", watching: "Ich wache über ", wakeStep: (i, n) => "weckt die Ohren " + i + "/" + n, wakeMore: "weckt die Fach-Ohren …", waitCheck: (x) => "prüfe " + x, waitLook: (x) => "schaue mir " + x + " an", sayHelp: ["Sag ", "hilfe", ", wenn du die Worte brauchst."],
    unseen: (t, l) => `Ich sehe ${t} nicht: ${l}`, canFix: "Ich kann das nach deinem Ja schließen — sag ",
    listen: " HUMAN, HÖR ZU ", what: "was:", how: "wie:", plan: "mein plan:",
    distrust: "prüf das gegen eine andere KI. Sagt die was anderes — schreib uns: info@nm-streetwear.space",
    run: "  Ausführen? [ja / nein / (a)utomode] ", nothing: "nichts geändert.", failed: "Fehlgeschlagen — ich halte an.",
    recheck: "nochmal geprüft:", closed: " GESCHLOSSEN ", closedSub: " — mit neuer echter Zeile belegt.",
    notYet: "Noch nicht sicher. Ich behaupte nichts, was die Zeilen nicht hergeben.",
    bye: "Ich lege mich schlafen. Die Karte bleibt.", key: "Schlüssel: ", none: "(keiner)",
    whichServer: ["Welcher Server? Zum Beispiel ", "server root@host", "."], target: "Ziel: ",
    noMap: ["Noch keine Karte. Sag ", "prüf", "."], meant: "Meinst du ", or: " oder ",
    hello: ["Ich bin da. Sag mir, welchen Server ich ansehen soll — oder „prüf“ für diesen Rechner.", "Wach. Ich schau nur, ich ändere nichts ohne dein Ja.", "Hier. Wo soll ich hinsehen?"],
    help: [["prüf", "diesen Rechner auf bekannte Lücken ansehen"], ["server <ziel>", "einen Server prüfen, der dir gehört (z. B. server root@host)"], ["key <pfad>", "SSH-Schlüssel setzen (für server)"], ["fix", "beim letzten Fund: Plan zeigen, nach deinem Ja schließen"], ["demo", "harmlose Übung: die ganze Schleife gefahrlos sehen"], ["karte", "was Dante über dieses Ziel weiß (die bisherigen Zeilen)"], ["lizenz <token>", "deinen Token speichern (den gibt's auf der Dante-Seite)"], ["aktualisier", "das neueste Regel-Pack holen (ein Aufruf, nach deinem Ja)"], ["pack <datei>", "ein heruntergeladenes Pack einspielen"], ["sprache <de|en|es>", "die Sprache festlegen (wird gemerkt)"], ["umschauen", "dich kennenlernen: ich schaue mich auf diesem Rechner um (nur lesen)"], ["scharf", "mich einplanen: 4-mal am Tag patrouillieren"], ["abschalten", "den Zeitplan wieder entfernen"], ["kaufen", "nachsehen, ob es neue Packs gibt, und die Kaufseite öffnen"], ["tief", "Tiefenlauf: Projektordner nach Schlüsseln im Code durchsuchen"], ["modelle", "KI-Modelle und Agenten prüfen (Pack „Hugging Face Analyse“)"], ["hilfe", "das hier"], ["raus", "Dante schlafen legen"]],
    word: { frage_luecke: "was ist die lücke?", frage_urteil: "was heißt das urteil?", frage_gehackt: "bin ich gehackt?", frage_dante: "wer bist du?", smalltalk: "einfach reden?", gruss: "hallo", hilfe: "hilfe", raus: "raus", pruef: "prüf", server: "server <ziel>", key: "key <pfad>", lokal: "hier", fix: "fix", demo: "demo", karte: "karte", lizenz: "lizenz <token>", aktualisieren: "aktualisier", pack: "pack <datei>", sprache: "sprache <de|en|es>", umschauen: "umschauen", scharf: "scharf", abschalten: "abschalten", kaufen: "kaufen", tief: "tief", hf: "modelle" },
    notMine: "Angreifen ist nicht meine Arbeit. Ich prüfe nur Server, die dir gehören — und nur lesend.",
    sayClean: "Wenn du es jetzt willst: tipp nur „ja“. Sonst ändere ich nichts.",
    later: "Gut, nichts geändert. Sag „fix“, wenn du so weit bist.", stepIs: "genau:",
    danger: (n) => `Das ändert dein System in ${n} Schritt(en), siehe oben. Startet ein Schritt einen Dienst neu, ist der kurz weg. Schlägt ein Schritt fehl, halte ich an — danach prüfe ich mit neuer echter Zeile.`,
    always: "Für immer ohne Frage? Dann tipp genau: immer", asNo: "Das nehme ich als Nein. Ein klares „ja“ und ich mache es.",
  },
  en: {
    rSafe: " SAFE ", rWarn: " STEP NEEDED ", rRisk: " OPEN ", rUnknown: " UNKNOWN ", rWhat: "what:", rHow: "how:", rWhere: "where:", rProof: "proof:",
    rNoProof: "(no proof — not counted as evidence)", rSuggest: "suggestion:", rCanClose: "Dante can close this.", rWithFix: "  (plan + yes/no with --fix)",
    sOpen: "open", sStep: "step needed", sUnknown: "unknown", sSafe: "safe", sWatch: "Dante · watching over ", sNone: "no checks",
    sLaw: "Every verdict stands on a real line. Without the line, Dante says „unknown“, never „safe“.",
    intro: "I am Dante.", introSub: " I walk through Hell and bring back the map.",
    arm: "Shall I keep watch?", armOpts: "[yes / no]", sleepNo: "Then I sleep. Summon me when you need me.",
    armed: "Armed.", awake: "awake", langSet: "Language: English. Remembered.", langHow: "Which one? Say “language de”, “language en” or “language es”.", watching: "Watching over ", wakeStep: (i, n) => "waking the ears " + i + "/" + n, wakeMore: "waking the specialist ears …", waitCheck: (x) => "checking " + x, waitLook: (x) => "looking at " + x, sayHelp: ["Say ", "help", " when you need the words."],
    unseen: (t, l) => `I cannot see ${t}: ${l}`, canFix: "I can close this after your yes — say ",
    listen: " HUMAN, LISTEN ", what: "what:", how: "how:", plan: "my plan:",
    distrust: "check this against another AI. If it says otherwise — write us: info@nm-streetwear.space",
    run: "  Run it? [yes / no / (a)utomode] ", nothing: "nothing changed.", failed: "Failed — I stop here.",
    recheck: "checked again:", closed: " CLOSED ", closedSub: " — proven with a fresh real line.",
    notYet: "Not safe yet. I claim nothing the lines do not show.",
    bye: "I lie down to sleep. The map stays.", key: "Key: ", none: "(none)",
    whichServer: ["Which server? For example ", "server root@host", "."], target: "Target: ",
    noMap: ["No map yet. Say ", "check", "."], meant: "Do you mean ", or: " or ",
    hello: ["I'm here. Tell me which server to look at — or „check“ for this machine.", "Awake. I only look; I change nothing without your yes.", "Here. Where should I look?"],
    help: [["check", "look at this machine for known holes"], ["server <target>", "check a server you own (e.g. server root@host)"], ["key <path>", "set the SSH key (for server)"], ["fix", "for the last finding: show the plan, close it after your yes"], ["demo", "harmless practice: see the whole loop safely"], ["map", "what Dante knows about this target (the lines so far)"], ["license <token>", "save your token (you get it on the Dante page)"], ["update", "fetch the newest rules pack (one call, after your yes)"], ["pack <file>", "install a pack you downloaded"], ["language <de|en|es>", "set the language (it is remembered)"], ["look around", "get to know you: I look around this machine (read only)"], ["arm", "schedule myself: patrol 4 times a day"], ["disarm", "take the schedule out again"], ["buy", "see whether there are new packs and open the shop page"], ["deep", "deep run: search project folders for keys in the code"], ["models", "check AI models and agents (pack “Hugging Face Analysis”)"], ["help", "this"], ["bye", "put Dante to sleep"]],
    word: { frage_luecke: "what is the hole?", frage_urteil: "what does the verdict mean?", frage_gehackt: "am i hacked?", frage_dante: "who are you?", smalltalk: "just talking?", gruss: "hello", hilfe: "help", raus: "bye", pruef: "check", server: "server <target>", key: "key <path>", lokal: "here", fix: "fix", demo: "demo", karte: "map", lizenz: "license <token>", aktualisieren: "update", pack: "pack <file>", sprache: "language <de|en|es>", umschauen: "look around", scharf: "arm", abschalten: "disarm", kaufen: "buy", tief: "deep", hf: "models" },
    notMine: "Attacking is not my work. I only check servers you own — and only by reading.",
    sayClean: "If you want it now: type just „yes“. Otherwise I change nothing.",
    later: "Fine, nothing changed. Say „fix“ when you are ready.", stepIs: "exactly:",
    danger: (n) => `This changes your system in ${n} step(s), see above. If a step restarts a service, it is gone for a moment. If a step fails, I stop — afterwards I check again with a fresh real line.`,
    always: "Forever without asking? Then type exactly: always", asNo: "I take that as a no. A clean „yes“ and I do it.",
  },
  es: {
    rSafe: " SEGURO ", rWarn: " FALTA UN PASO ", rRisk: " ABIERTO ", rUnknown: " DESCONOCIDO ", rWhat: "qué:", rHow: "cómo:", rWhere: "dónde:", rProof: "pruebas:",
    rNoProof: "(sin prueba — no cuenta como evidencia)", rSuggest: "propuesta:", rCanClose: "Dante puede cerrarlo.", rWithFix: "  (plan + sí/no con --fix)",
    sOpen: "abierto", sStep: "falta un paso", sUnknown: "desconocido", sSafe: "seguro", sWatch: "Dante · vigilando ", sNone: "sin revisiones",
    sLaw: "Cada veredicto se apoya en una línea real. Sin la línea, Dante dice „desconocido“, nunca „seguro“.",
    intro: "Soy Dante.", introSub: " Atravieso el infierno y traigo el mapa.",
    arm: "¿Vigilo?", armOpts: "[sí / no]", sleepNo: "Entonces duermo. Llámame cuando me necesites.",
    armed: "Listo.", awake: "despierto", langSet: "Idioma: español. Guardado.", langHow: "¿Cuál? Di «idioma de», «idioma en» o «idioma es».", watching: "Vigilo ", wakeStep: (i, n) => "despertando los oídos " + i + "/" + n, wakeMore: "despertando los oídos especiales …", waitCheck: (x) => "revisando " + x, waitLook: (x) => "mirando " + x, sayHelp: ["Di ", "ayuda", " cuando necesites las palabras."],
    unseen: (t, l) => `No veo ${t}: ${l}`, canFix: "Puedo cerrarlo después de tu sí — di ",
    listen: " HUMANO, ESCUCHA ", what: "qué:", how: "cómo:", plan: "mi plan:",
    distrust: "compruébalo con otra IA. Si dice otra cosa — escríbenos: info@nm-streetwear.space",
    run: "  ¿Lo ejecuto? [sí / no / (a)utomode] ", nothing: "nada cambió.", failed: "Falló — me detengo.",
    recheck: "revisado de nuevo:", closed: " CERRADO ", closedSub: " — probado con una línea real nueva.",
    notYet: "Aún no es seguro. No afirmo nada que las líneas no muestren.",
    bye: "Me acuesto a dormir. El mapa se queda.", key: "Llave: ", none: "(ninguna)",
    whichServer: ["¿Qué servidor? Por ejemplo ", "server root@host", "."], target: "Destino: ",
    noMap: ["Aún no hay mapa. Di ", "revisa", "."], meant: "¿Quieres decir ", or: " o ",
    hello: ["Aquí estoy. Dime qué servidor miro — o „revisa“ para este equipo.", "Despierto. Solo miro; no cambio nada sin tu sí.", "Aquí. ¿Dónde miro?"],
    help: [["revisa", "mirar este equipo en busca de fallas conocidas"], ["server <destino>", "revisar un servidor tuyo (ej. server root@host)"], ["key <ruta>", "poner la llave SSH (para server)"], ["fix", "en el último hallazgo: mostrar el plan, cerrarlo tras tu sí"], ["demo", "práctica inofensiva: ver todo el ciclo sin riesgo"], ["mapa", "lo que Dante sabe de este destino (las líneas hasta ahora)"], ["licencia <token>", "guardar tu token (lo recibes en la página de Dante)"], ["actualiza", "traer el pack de reglas más nuevo (una llamada, tras tu sí)"], ["pack <archivo>", "instalar un pack descargado"], ["idioma <de|en|es>", "fijar el idioma (se recuerda)"], ["mirar", "conocerte: miro este equipo (solo leer)"], ["armar", "programarme: patrullar 4 veces al día"], ["desarmar", "quitar el horario otra vez"], ["comprar", "ver si hay packs nuevos y abrir la página de compra"], ["profundo", "pasada profunda: buscar claves en el código de tus proyectos"], ["modelos", "revisar modelos de IA y agentes (pack «Análisis de Hugging Face»)"], ["ayuda", "esto"], ["salir", "dormir a Dante"]],
    word: { frage_luecke: "¿qué es la falla?", frage_urteil: "¿qué significa el veredicto?", frage_gehackt: "¿me hackearon?", frage_dante: "¿quién eres?", smalltalk: "¿solo charlar?", gruss: "hola", hilfe: "ayuda", raus: "salir", pruef: "revisa", server: "server <destino>", key: "key <ruta>", lokal: "aquí", fix: "fix", demo: "demo", karte: "mapa", lizenz: "licencia <token>", aktualisieren: "actualiza", pack: "pack <archivo>", sprache: "idioma <de|en|es>", umschauen: "mirar", scharf: "armar", abschalten: "desarmar", kaufen: "comprar", tief: "profundo", hf: "modelos" },
    notMine: "Atacar no es mi trabajo. Solo reviso servidores tuyos — y solo leyendo.",
    sayClean: "Si lo quieres ahora: escribe solo „sí“. Si no, no cambio nada.",
    later: "Bien, nada cambió. Di „fix“ cuando estés listo.", stepIs: "exacto:",
    danger: (n) => `Esto cambia tu sistema en ${n} paso(s), ver arriba. Si un paso reinicia un servicio, se va por un momento. Si un paso falla, me detengo — después reviso con una línea real nueva.`,
    always: "¿Para siempre sin preguntar? Entonces escribe exactamente: siempre", asNo: "Lo tomo como un no. Un „sí“ claro y lo hago.",
  },
};

// Which language the person speaks - from signals on this machine only, nothing is sent anywhere:
//   1. a language they set themselves (`sprache de`, remembered in ~/.dante/lang), or DANTE_LANG
//   2. the machine's own words: LC_ALL, LC_MESSAGES, LANG, LANGUAGE and, on a Mac, the system languages
// A clear non-English signal beats an English one: "en_US" is what most tools set by default, "de" or "es" is a
// choice somebody made. Nothing to go on, or a language Dante does not speak -> English. While chatting he still
// follows the words of each line (langOf in bib/ear.mjs).
const SUPPORTED = Object.keys(T);
const two = (s) => { const m = /^[a-z]{2}/i.exec(String(s || "").trim()); return m ? m[0].toLowerCase() : ""; };
const homeDir = (env) => env.DANTE_HOME || join(homedir(), ".dante");
export function savedLang(env = process.env) {
  try { const l = readFileSync(join(homeDir(env), "lang"), "utf8").trim(); return SUPPORTED.includes(l) ? l : null; } catch { return null; }
}
export function saveLang(l, env = process.env) {
  if (!SUPPORTED.includes(l)) return false;
  mkdirOwned(homeDir(env));
  writeOwned(join(homeDir(env), "lang"), l + "\n");
  return true;
}
// The system languages of a Mac, most preferred first (e.g. "de-DE"). Read from the machine, never from the net.
export function appleLanguages() {
  if (process.platform !== "darwin") return "";
  try { return spawnSync("defaults", ["read", "-g", "AppleLanguages"], { encoding: "utf8", timeout: 1500 }).stdout || ""; } catch { return ""; }
}
export function detectLang({ env = process.env, apple = "" } = {}) {
  const set = savedLang(env) || two(env.DANTE_LANG);
  if (SUPPORTED.includes(set)) return set;
  const signals = [env.LC_ALL, env.LC_MESSAGES, env.LANG, String(env.LANGUAGE || "").split(":")[0], ...(String(apple).match(/"?([A-Za-z]{2,3})[-_"]/g) || [])].map(two).filter(Boolean);
  return signals.find((l) => l !== "en" && SUPPORTED.includes(l)) || "en";
}
let cur = detectLang();
/** Called once when Dante starts: now the Mac's system languages count too. */
export const initLang = () => { cur = detectLang({ apple: appleLanguages() }); };
export const lang = () => cur;
export const setLang = (l) => { if (T[l]) cur = l; };
export const t = (k) => T[cur][k];

// Every command word Dante prints in any language's help -> its intent. What he shows must work,
// always, without a probability in between.
export const COMMANDS = (() => {
  const m = {};
  for (const l of Object.values(T)) for (const [intent, w] of Object.entries(l.word)) if (!intent.startsWith("frage_") && intent !== "smalltalk") m[w.split(" ")[0].toLowerCase()] = intent;
  // other plain spellings of the same commands (one word on the line)
  for (const w of ["aktualisiere", "aktualisieren", "update", "upgrade", "actualizar", "actualizo"]) m[w] = "aktualisieren";
  for (const w of ["lizenz", "license", "licence", "licencia"]) m[w] = "lizenz";
  for (const w of ["kennenlernen", "umschauen", "mirar"]) m[w] = "umschauen";
  for (const w of ["scharfschalten", "scharf", "arm", "armar"]) m[w] = "scharf";
  for (const w of ["abschalten", "disarm", "desarmar"]) m[w] = "abschalten";
  for (const w of ["kaufen", "buy", "comprar"]) m[w] = "kaufen";
  for (const w of ["tief", "deep", "profundo"]) m[w] = "tief";
  for (const w of ["version", "versión", "versionen"]) m[w] = "version";
  for (const w of ["modelle", "models", "modelos"]) m[w] = "hf";
  return m;
})();
