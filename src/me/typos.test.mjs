import test from "node:test";
import assert from "node:assert/strict";
import { fixTypos } from "./typos.mjs";

test("Tippfehler bei Wörtern, die einen Wunsch tragen, werden korrigiert (DE/EN/ES)", () => {
  for (const [a, b] of [
    ["chek my mak bro", "check my mac bro"], ["are my servres safe", "are my servers safe"], ["show me teh servers", "show me teh servers"], ["scna my laptpo", "scan my laptop"],
    ["pruef mal meinen mak bruder", "prüf mal meinen mac bruder"], ["zeig mir die serveer", "zeig mir die server"], ["wer hat schluessel zum server", "wer hat schlüssel zum server"],
    ["leg nen koeder aus", "leg nen köder aus"], ["was laeuft da", "was läuft da"], ["revisa mi servidr", "revisa mi servidor"], ["sinn meine server safe", "sinn meine server safe"],
    ["chek mi mak", "check mi mac"],
  ]) assert.equal(fixTypos(a), b, a);
});
test("Namen, Adressen, Pfade und echte Wörter bleiben unberührt", () => {
  for (const l of ["ich heiße Mak", "my name is Chek", "server root@203.0.113.7", "key ~/.ssh/id_ed25519", "prüfe 203.0.113.54", "welcher server ist das", "welche noch ?", "reports please", "bitte mach das", "was ist ein serverraum", "check my computer", "the secure way", "hi", "", "scam", "ich habe mak.txt"])
    assert.equal(fixTypos(l), l, l);
});
