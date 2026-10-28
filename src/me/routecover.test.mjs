// Every line the 100-question run misrouted must now be caught by the right matcher (after stripping a greeting).
import test from "node:test";
import assert from "node:assert/strict";
import { wantsDeep } from "./deepwant.mjs";
import { wantsKeys } from "./keyswant.mjs";
import { wantsWatch } from "./guardwant.mjs";
import { wantsReport, wantsCheck, wantsExplain, wantsCapabilities, wantsWhatRunning, stripGreeting } from "./morewants.mjs";

const M = { deep: wantsDeep, keys: wantsKeys, watch: wantsWatch, report: wantsReport, check: wantsCheck, explain: wantsExplain, help: wantsCapabilities, running: wantsWhatRunning };
// route a line the way the session will: greeting stripped, then the specific matchers before the general check
const ORDER = ["deep", "keys", "watch", "report", "explain", "help", "running", "check"];
const route = (line) => { const l = stripGreeting(line); for (const k of ORDER) if (M[k](l)) return k; return "none"; };

const CASES = [
  ["Ich glaube, ich habe irgendwo einen API-Key im Projekt liegen – findest du den?", "deep"],
  ["Schreib am Ende bitte einen Bericht von dem Durchlauf.", "report"],
  ["Mach mal so eine Falle, die mir Bescheid gibt, wenn einer dran war.", "watch"],
  ["Bau mir eine Watch-Datei, ich will wissen, ob jemand reinschaut.", "watch"],
  ["Guten Morgen, kannst du mal einen Rundum-Check machen?", "check"],
  ["Kannst du in meinen Projekten nach aus Versehen committeten Passwörtern suchen?", "deep"],
  ["Schreib am Ende einen Bericht von dem ganzen Lauf, ja?", "report"],
  ["Ich hab Angst, dass ich mal nen API-Key gepusht hab, findest du den?", "deep"],
  ["Fass mal alles zusammen und schreib mir das als Bericht.", "report"],
  ["Go ahead and write up a report of this run for me.", "report"],
  ["Check the box for me and let me know if it's clean.", "check"],
  ["Give me the rundown on the current machine state.", "check"],
  ["Drop a bait file somewhere and email me if anyone touches it.", "watch"],
  ["Write up a report of everything you just checked so I have it on record.", "report"],
  ["Explain to me what exactly you're watching and why.", "explain"],
  ["Can you tell me who can still log into that old server?", "keys"],
  ["Set a watch on the admin share and let me know if it gets used.", "watch"],
  ["I need a summary of this run, can you make one?", "report"],
  ["Good morning, can you give this machine a once-over?", "check"],
  ["Ich glaub, ich hab irgendwo einen API-Key committet – findest du den?", "deep"],
  ["Kannst du so eine Art Stolperfalle aufstellen, die mich alarmiert?", "watch"],
  ["Ich will wissen, ob ich versehentlich Secrets in den Code geschrieben habe.", "deep"],
  ["Kannst du prüfen, ob in meinen Configs Secrets drinstehen?", "deep"],
  ["Schau bitte in meinem Projekt nach, ob da irgendwo Tokens offen liegen.", "deep"],
  ["Erklär mir bitte, was du alles überwachen kannst.", "explain"],
  ["Finde mal raus, ob ich irgendwo aus Versehen einen API-Key eingecheckt habe.", "deep"],
  ["Schreib mir bitte einen Rapport von deinem Durchlauf.", "report"],
  ["Hi, kurze Frage: Was kannst du für mich tun?", "help"],
  ["Kannst du so ne Art Wachhund-Datei aufstellen, die mir Bescheid gibt?", "watch"],
  ["Huch, ich glaub ich hab irgendwo nen API-Key rumliegen – findest du den?", "deep"],
  ["Wer kommt denn noch mit alten Schlüsseln auf die Maschine?", "keys"],
  ["Erzähl mal, was du so alles im Blick hast und warum.", "explain"],
  ["I need to know which people can still SSH in here.", "keys"],
  ["Can you leave a little trap file that pings me if it gets opened?", "watch"],
  ["List everyone whose key still works on this box.", "keys"],
  ["What am I even running on right now?", "running"],
  ["Can you leave a trap file that pings me if it's used?", "watch"],
];

test("alle misgerouteten Zeilen treffen jetzt den richtigen Matcher", () => {
  const miss = [];
  for (const [line, want] of CASES) { const got = route(line); if (got !== want) miss.push(`${line}  ->  got ${got}, want ${want}`); }
  assert.deepEqual(miss, [], "noch daneben:\n" + miss.join("\n"));
});

test("normale Sätze lösen keinen der neuen Matcher aus", () => {
  for (const l of ["prüf meinen rechner", "wie geht es dir", "hallo", "ja", "nein", "update bitte", "was ist mein system"]) {
    const l2 = stripGreeting(l);
    assert.equal(wantsReport(l2) || wantsExplain(l2), false, l);
  }
});
