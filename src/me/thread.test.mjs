// The follow-up layer: a few kinds of follow-up, recognised once, sent to the topic of the last answer - in German, English and Spanish.
// A new request must never be taken for a follow-up, and a follow-up without a topic must go nowhere.
import test from "node:test";
import assert from "node:assert/strict";
import { actOf, route } from "./thread.mjs";

const SETS = {
  more: ["welche noch ?", "und die anderen?", "noch mehr?", "weitere?", "which others?", "any more?", "and the others", "y los otros", "algo más"],
  these: ["was sind diese server ?", "was sind die server?", "was können die?", "was könenn die ?", "what are these servers", "what can they do", "what can these do?", "qué son estos servidores", "qué pueden hacer", "qué pueden esos"],
  doit: ["mach du es", "mach das", "mach es", "machs", "mach du", "mach das bitte", "erledige das", "do it", "you do it", "do it please", "go ahead", "fix it", "hazlo tú", "hazlo", "haz tú", "entferne den alten eintrag", "remove the old entry"],
  why: ["warum?", "wieso das?", "warum ist das so", "why?", "why is that", "how come", "por qué?", "por qué es así"],
  explain: ["erklär das", "erklär mir das bitte", "kannst du das erklären", "wie meinst du das", "explain", "explain that please", "tell me more", "what do you mean", "explica eso", "qué quieres decir", "qué significa"],
  again: ["nochmal", "noch mal bitte", "mach nochmal", "again", "once more", "otra vez", "de nuevo", "repítelo"],
  details: ["was sind die 3 hinweise ?", "was sind die hinweise", "welche hinweise", "zeig mir die details", "details", "what are the 3 notes", "what are the findings", "show me the details", "qué son los avisos", "muéstrame los detalles"],
  bad: ["ist das schlimm?", "ist das gefährlich", "wie schlimm ist das", "is that bad", "is it dangerous?", "how bad is it", "es grave?", "qué tan grave"],
};
// words that must NEVER be a follow-up: they are new requests (or smalltalk) in the same languages
const NEW = ["prüf meinen server", "mach den check", "mach den test auf meinem server", "check my computer", "do the check", "check the second one", "welche server habe ich", "which servers do i have", "hazlo bien", "wer bist du", "hi", "hilfe", "help", "ich möchte wissen warum mein server langsam ist und was ich dagegen tun kann", "server root@203.0.113.7", "wer hat noch einen schlüssel zum server", "scan everything on the machine", "revisa todo", "erkläre mir wie ein sshd funktioniert und warum root login schlecht ist"];

test("jede Nachfrage wird erkannt (DE/EN/ES), mit Tippfehlern und Satzzeichen", () => {
  for (const [act, lines] of Object.entries(SETS)) for (const l of lines) assert.equal(actOf(l), act, `${act}: ${l}`);
});
test("neue Wünsche werden NIE für Nachfragen gehalten", () => {
  for (const l of NEW) assert.equal(actOf(l), null, l);
});
test("route: dieselbe Nachfrage geht je nach Thema woanders hin, ohne Thema nirgends", () => {
  assert.equal(route("more", "servers"), "servermore");
  assert.equal(route("these", "servers"), "serverthese");
  assert.equal(route("again", "servers"), "serverliste");
  assert.equal(route("doit", "hostkey"), "hostkeyfix");
  assert.equal(route("why", "hostkey"), "hostkeywhy");
  assert.equal(route("bad", "hostkey"), "hostkeywhy");
  assert.equal(route("doit", "findings", { hasFix: true, hasOpen: true }), "fix");
  assert.equal(route("doit", "findings", { hasFix: false, hasOpen: false }), null, "nichts zu schließen: nichts tun");
  assert.equal(route("why", "findings", { hasFix: true, hasOpen: true }), "howfix");
  assert.equal(route("bad", "findings", { hasFix: false, hasOpen: true }), "recap");
  assert.equal(route("bad", "findings", { hasFix: false, hasOpen: false }), null, "alles sicher: nichts zu erklären");
  assert.equal(route("again", "findings"), "pruef");
  assert.equal(route("more", "findings", { hasOpen: true }), "recap");
  for (const act of Object.keys(SETS)) assert.equal(route(act, null), null, act + " ohne Thema");
  assert.equal(route("doit", "servers"), null, "'mach du es' nach einer Serverliste ist kein Auftrag");
  assert.equal(route("doit", "servers", { changedHost: true }), "hostkeyfix", "aber ein offener Host-Schlüssel-Schritt bleibt offen, auch nach einer Liste dazwischen");
  assert.equal(route("doit", "fleet", { changedHost: true }), "hostkeyfix");
  assert.equal(route("doit", "fleet", { changedHost: false }), null);
  assert.equal(route("details", "fleet"), "fleetdetail");
  assert.equal(route("these", "fleet"), "fleetdetail");
  assert.equal(route("again", "fleet"), "serverscheck");
});
test("das gleiche 'mach du es' hat in drei Sprachen dasselbe Ziel", () => {
  for (const l of ["mach du es", "do it", "hazlo tú"]) assert.equal(route(actOf(l), "hostkey"), "hostkeyfix", l);
  for (const l of ["warum?", "why?", "por qué?"]) assert.equal(route(actOf(l), "hostkey"), "hostkeywhy", l);
  for (const l of ["welche noch?", "which others?", "y los otros"]) assert.equal(route(actOf(l), "servers"), "servermore", l);
});
