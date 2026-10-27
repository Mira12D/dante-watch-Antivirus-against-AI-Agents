import test from "node:test";
import assert from "node:assert/strict";
import { wantsSysInfo, wantsGoingOn } from "./sysq.mjs";
import { wantsStatus, wantsServerList, wantsHealth, wantsFind } from "./servers.mjs";

test("Fragen nach dem System werden in jeder Sprache erkannt", () => {
  for (const l of ["was ist mein system", "welcher ist mein mac?", "was für ein rechner ist das", "welches betriebssystem hab ich", "wie viel ram hab ich", "wie voll ist meine platte", "zeig mir die systeminfo", "system info", "what machine is this", "which os am i running", "what is my mac", "how much memory do i have", "show system info", "qué sistema tengo", "qué ordenador es este", "cuánta memoria tengo", "qué versión de linux es"]) assert.equal(wantsSysInfo(l, false), true, l);
});
test("'was ist da los' fragt nach dem, was gerade passiert", () => {
  for (const l of ["was ist da los", "was geht auf dem server ab", "was läuft gerade auf meinem rechner", "warum ist der so langsam", "wer ist gerade eingeloggt", "welche ports sind offen", "what's going on on my server", "what is running right now", "why is it so slow", "who is logged in", "which ports are open", "qué pasa en mi servidor", "qué está corriendo ahora", "por qué va tan lento", "quién está conectado", "qué puertos están abiertos"]) assert.equal(wantsGoingOn(l, false), true, l);
});
test("die vier Fragearten bleiben getrennt", () => {
  const kinds = (l) => [wantsSysInfo(l, false) && "info", wantsGoingOn(l, false) && "los", wantsStatus(l, false) && "status", wantsServerList(l, false) && "liste", wantsHealth(l, false) && "gesund", wantsFind(l, false) && "finden"].filter(Boolean);
  assert.deepEqual(kinds("was ist mein system"), ["info"]); assert.deepEqual(kinds("was ist da los"), ["los"]);
  assert.deepEqual(kinds("wie geht es meinen servern"), ["status"]); assert.deepEqual(kinds("kennst du meine server"), ["liste"]);
  assert.deepEqual(kinds("dieser server gesund"), ["gesund"]); assert.deepEqual(kinds("finde meine server"), ["finden"]);
  for (const l of ["prüfe meinen server", "ist php sicher", "wie spät ist es", "hi", "was ist ein webshell"]) assert.deepEqual(kinds(l).filter((k) => k === "info" || k === "los"), [], l);
});

import { wantsAllSystems } from "./sysq.mjs";
test("'was kannst du mir über meine systeme sagen' meint alle Rechner auf einmal", () => {
  for (const l of ["was kannst du mir über meine systeme sagen?", "erzähl mir was über meine rechner", "gib mir einen überblick über alle meine systeme", "was weißt du über meine maschinen", "tell me about my systems", "what can you tell me about my machines", "give me an overview of all my systems", "dime algo de mis sistemas", "qué sabes de mis equipos", "dame un resumen de mis sistemas"]) assert.equal(wantsAllSystems(l, false), true, l);
  for (const l of ["was ist mein system", "sind meine systeme sicher", "prüfe meine systeme", "wie geht es meinen servern", "what is my system"]) assert.equal(wantsAllSystems(l, false), false, l);
});
