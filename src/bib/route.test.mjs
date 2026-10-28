import test from "node:test";
import assert from "node:assert/strict";
import { hearMain, hearDomain, SETUP_WORDS } from "./ear.mjs";
import { wantsSysInfo, wantsGoingOn } from "../me/sysq.mjs";

// Held-out lines per domain ear, in German, English and Spanish: what each ear must catch, and what must
// never wake one. A line that is not Dante's work must stay out of every domain ear (no accidental scan).
const KEEP = new Set(["raus", "gruss", "hilfe", "key", "server", "lokal", "demo", "karte", "pruef", "fix", "smalltalk", "frage_luecke", "frage_urteil", "frage_gehackt", "frage_dante"]);
function route(line) {
  // the plain system questions are caught by their words before any ear is asked (see session.mjs)
  if (wantsGoingOn(line, false)) return "muster:was_los";
  if (wantsSysInfo(line, false)) return "muster:meinsystem";
  const m = hearMain(line);
  if (m.intent !== "unklar" && KEEP.has(m.intent)) return "main:" + m.intent;
  const d = hearDomain(line);
  return d ? d.ear + ":" + d.intent : "gap";
}
// a question about a named topic may be taken over by its card in the session even if the main ear heard frage_*
const right = (got, want) => got === want || (want.startsWith("wissen:") && got.startsWith("main:frage_")) || (want === "gap" && got.startsWith("main:"));
const SETS = {
 "System (Was ist mein System?)": [
  ["was ist mein system","muster:meinsystem"],["welches system läuft hier","muster:meinsystem"],["auf welchem betriebssystem bin ich","muster:meinsystem"],["erklär mir mein system","muster:meinsystem"],["was für ein server ist das","muster:meinsystem"],["zeig mir was auf dem server läuft","muster:was_los"],["welche distro ist das","muster:meinsystem"],["sag mir was das für ne kiste ist","muster:meinsystem"],
  ["what is my system","muster:meinsystem"],["which system is this","muster:meinsystem"],["what os am i on","muster:meinsystem"],["explain my system to me","muster:meinsystem"],["what kind of server is this","muster:meinsystem"],["show me what runs on this server","muster:was_los"],["which distro is this","muster:meinsystem"],["tell me what this box is","muster:meinsystem"],
  ["cuál es mi sistema","muster:meinsystem"],["qué sistema es este","muster:meinsystem"],["en qué sistema operativo estoy","muster:meinsystem"],["explícame mi sistema","muster:meinsystem"],["qué tipo de servidor es este","muster:meinsystem"],["muéstrame qué corre en el servidor","muster:was_los"],["qué distro es esta","muster:meinsystem"],["dime qué máquina es esta","muster:meinsystem"],
 ],
 "Runde und Sorgen (Muster)": [
  ["prüf mal alles durch","muster:patrouille"],["mach die komplette runde","muster:patrouille"],["check everything","muster:patrouille"],["revisa todo","muster:patrouille"],
  ["hat mir wer ne hintertür reingelegt","muster:webshell"],["any backdoor files on my server","muster:webshell"],["hay una puerta trasera","muster:webshell"],
  ["ist meine .env für alle offen","muster:secrets"],["is my .env public","muster:secrets"],["está mi .env expuesto","muster:secrets"],
  ["kann man sich als root per passwort einloggen","muster:sshd"],["can root log in with a password","muster:sshd"],["puede root entrar con contraseña","muster:sshd"],
  ["welche dateien sind für alle beschreibbar","muster:rechte"],["world writable files","muster:rechte"],["archivos escribibles por todos","muster:rechte"],
 ],
 "Erklären (Fachwissen)": [
  ["was überwachst du","wissen:job"],["was ist dein job","wissen:job"],["what do you watch","wissen:job"],["what is your job","wissen:job"],["qué vigilas","wissen:job"],["cuál es tu trabajo","wissen:job"],
  ["was ist eine webshell","wissen:thema"],["woran erkenne ich offene geheimnisse","wissen:thema"],["warum ist root login gefährlich","wissen:thema"],["wie prüfst du ssh","wissen:thema"],["ist das normal","wissen:thema"],["was tue ich dagegen","wissen:thema"],
  ["what is a webshell","wissen:thema"],["what stands out about open secrets","wissen:thema"],["why is root login dangerous","wissen:thema"],["how do you check ssh","wissen:thema"],["is that normal","wissen:thema"],["what do i do about it","wissen:thema"],
  ["qué es una webshell","wissen:thema"],["qué llama la atención en los permisos","wissen:thema"],["por qué es peligroso el login de root","wissen:thema"],["cómo compruebas ssh","wissen:thema"],["es normal esto","wissen:thema"],["qué hago al respecto","wissen:thema"],
 ],
 "Bleibt woanders (darf KEIN Domain-Ohr werden)": [
  ["hi","main:gruss"],["wie gehts dir","main:smalltalk"],["erzähl einen witz","main:smalltalk"],["prüf mal","main:pruef"],["server root@1.2.3.4","main:server"],["fix","main:fix"],["raus","main:raus"],["hilfe","main:hilfe"],
  ["wie wird das wetter","gap"],["übersetz das ins englische","gap"],["wer hat das spiel gewonnen","gap"],["what time is it","gap"],["cuánto cuesta un vuelo a madrid","gap"],["ich brauche rezeptideen für heute abend","gap"],["plan my week","gap"],["recomiéndame una película","gap"],["wie funktioniert ein verbrennungsmotor","gap"],["what is the best programming language","gap"],["schreib mir eine mail","gap"],["bestell mir pizza","gap"],["write my essay","gap"],["what is the capital of france","gap"],["haz mi tarea","gap"],["danke dir","main:smalltalk"],
 ],
};

// how many of each set must be right (the no-hijack set must be perfect)
const NEED = { "System (Was ist mein System?)": 22, "Runde und Sorgen (Muster)": 15, "Erklären (Fachwissen)": 22, "Bleibt woanders (darf KEIN Domain-Ohr werden)": 100 };
for (const [name, rows] of Object.entries(SETS)) {
  test(name, () => {
    const bad = rows.filter(([q, want]) => !right(route(q), want)).map(([q, want]) => `${q} → ${route(q)} (soll ${want})`);
    const need = Math.min(NEED[name], 100) === 100 ? rows.length : NEED[name];
    assert.ok(rows.length - bad.length >= need, `${rows.length - bad.length}/${rows.length} richtig, nötig ${need}:\n  ` + bad.join("\n  "));
  });
}

test("Zeitplan-Wörter sperren 'Dante beenden'; normale Abschiede bleiben Abschiede", () => {
  for (const q of ["schalt dich bitte scharf", "lauf von selbst mehrmals am tag", "arm yourself please", "stop the automatic patrol", "run on a schedule", "ponte en marcha con el horario", "nimm den zeitplan raus", "desarmar la patrulla"]) assert.ok(SETUP_WORDS.test(q), q);
  for (const q of ["raus", "tschüss", "mach aus", "bye", "exit", "adiós, solo quería mirar", "ich geh jetzt", "good night, see you tomorrow", "hasta luego", "schlaf gut", "that is all for today"]) assert.ok(!SETUP_WORDS.test(q), q);
});
test("Neue Wünsche (Umschauen, Zeitplan, Bericht) in drei Sprachen, mit Formulierungen außerhalb des Trainings", () => {
  const SET = {
    "muster:umschauen": ["schau dich mal bei mir um", "lern meinen rechner kennen", "sieh nach was auf meinem rechner ist", "look around my machine", "get to know my setup", "echa un vistazo a mi ordenador", "conoce mi sistema"],
    "muster:scharf": ["lauf ab jetzt mehrmals am tag von selbst", "arm yourself please", "run by yourself a few times a day", "check my machine on a schedule", "ponte en marcha por favor", "revisa mi equipo automáticamente varias veces al día"],
    "muster:abschalten": ["schalt dich wieder ab", "hör auf von selbst zu laufen", "entferne den automatischen lauf", "stop the automatic patrol", "stop running on your own", "remove the scheduled runs", "deja de correr solo", "quita la ejecución automática"],
    "wissen:bericht": ["was hast du in der zwischenzeit gemacht", "wie lief dein letzter durchlauf", "what have you done while i was away", "how did your last run go", "qué hiciste mientras no estaba", "hubo algo nuevo esta noche", "notaste algo raro", "cómo salió tu última ronda"],
  };
  const bad = [];
  for (const [want, qs] of Object.entries(SET)) for (const q of qs) { const got = route(q); if (!right(got, want)) bad.push(`${q} → ${got} (soll ${want})`); }
  const total = Object.values(SET).flat().length;
  assert.ok(bad.length <= 2, `${total - bad.length}/${total} richtig:\n  ` + bad.join("\n  "));
});

test("Aktionen (Schlüssel, Tiefenlauf, Wachschutz, Runde) in drei Sprachen, Formulierungen außerhalb des Trainings (28.10.)", () => {
  const SET = {
    "muster:schluessel": ["wer hat noch schlüssel zum server ?", "gibt es fremde ssh keys bei mir", "which keys can still get into my box", "quien mas puede entrar a mi servidor con llave"],
    "muster:tief": ["schau in meinen projekten nach passwörtern", "geh mal tief rein und such secrets", "look through all my repos for leaked keys", "revisa a fondo mis carpetas por contraseñas"],
    "muster:wachschutz": ["leg mir ne falle aus für angreifer", "bait files for my env please", "quiero un señuelo para mis claves", "schalt den wachschutz ein"],
    "muster:patrouille": ["check everything on the machine", "revisa todo de arriba a abajo"],
  };
  const bad = [];
  for (const [want, qs] of Object.entries(SET)) for (const q of qs) { const got = route(q); if (!right(got, want)) bad.push(`${q} → ${got} (soll ${want})`); }
  const total = Object.values(SET).flat().length;
  assert.ok(bad.length <= 1, `${total - bad.length}/${total} richtig:\n  ` + bad.join("\n  "));
});
