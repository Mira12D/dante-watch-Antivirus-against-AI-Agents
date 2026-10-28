import test from "node:test";
import assert from "node:assert/strict";
import { wantsWatchStatus, wantsSafeMe } from "./asks.mjs";
import { wantsWatch } from "./guardwant.mjs";
import { actOf, route } from "./thread.mjs";

test("Fragen nach dem Zustand des Wachschutzes sagen den Zustand und starten nichts (DE/EN/ES)", () => {
  for (const l of ["ist der wachschutz an ?", "ist der wachschutz aktiv", "läuft der wachschutz", "ist mein wachschutz schon an", "is the watch on", "is the bait watch active?", "watch status", "está activa la vigilancia", "¿está activa la vigilancia?"]) assert.equal(wantsWatchStatus(l), true, l);
  for (const l of ["wachschutz", "schalt den wachschutz ein", "leg einen köder aus", "set up a honeypot", "turn the watch on", "hi", "wie geht's"]) assert.equal(wantsWatchStatus(l), false, l);
  assert.equal(wantsWatch("ich will den wachschutz"), true, "das Anschalten bleibt, wo es hingehört");
});
test("'bin ich sicher?' heißt: diesen Rechner ansehen (DE/EN/ES)", () => {
  for (const l of ["ok bin ich sicher?", "bin ich sicher", "und bin ich sicher ?", "am i safe", "ok am I secure?", "estoy seguro", "bin ich denn sicher?"]) assert.equal(wantsSafeMe(l), true, l);
  for (const l of ["sind meine server sicher", "ist php sicher", "bin ich gehackt", "ist mein server sicher", "am i hacked", "prüf mich"]) assert.equal(wantsSafeMe(l), false, l);
});
test("'was heißt das?' nach einer Serverliste erklärt die Liste (DE/EN/ES)", () => {
  for (const l of ["was heißt das?", "what do you mean", "qué significa", "erklär das", "explain that"]) assert.equal(route(actOf(l), "servers"), "serverexplain", l);
});
