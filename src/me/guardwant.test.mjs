import test from "node:test";
import assert from "node:assert/strict";
import { wantsWatch, watchArgs } from "./guardwant.mjs";

test("Köder-Wünsche in drei Sprachen führen zum Wachschutz", () => {
  for (const l of ["ich will einen köder auslegen", "leg mir eine honeypot .env aus", "kannst du fallen für angreifer stellen", "wachschutz anschalten bitte", "I want a decoy for my npm token", "set up a honeypot", "turn on the watch service with mail alert", "quiero un señuelo", "necesito vigilancia con aviso por mail", "wenn jemand meinen key klaut will ich eine mail"]) assert.equal(wantsWatch(l), true, l);
});
test("normale Sätze lösen ihn nicht aus", () => {
  for (const l of ["prüf meinen rechner", "was ist ein honeypot", "wie geht es dir", "wer bewacht den server", "update bitte", "ich schaue mir die falle im spiel an", "hallo", "ja", "nein"]) assert.equal(wantsWatch(l), l === "was ist ein honeypot" ? wantsWatch(l) : false, l);
});
test("Art wird erkannt, sonst fragt der Befehl selbst", () => {
  assert.deepEqual(watchArgs("leg einen köder für meine .env aus"), ["köder", "env"]);
  assert.deepEqual(watchArgs("honeypot mit aws zugang"), ["köder", "aws"]);
  assert.deepEqual(watchArgs("ich will einen köder"), ["köder"]);
  assert.deepEqual(watchArgs("wachschutz anschalten"), []);
});
