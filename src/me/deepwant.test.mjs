import test from "node:test";
import assert from "node:assert/strict";
import { wantsDeep } from "./deepwant.mjs";
import { wantsKeys } from "./keyswant.mjs";

test("Geheimnisse im Code/Projekt suchen -> Tiefenlauf (true)", () => {
  for (const l of [
    "find any leaked secrets in my projects",
    "can you check my repos for committed API keys",
    "Ich hab Angst dass irgendwo Passwörter oder Keys in meinen Projekten rumliegen – check das",
    "durchsuch meinen code nach tokens",
    "I think I accidentally committed some API keys to one of my repos",
    "scan my codebase for hardcoded passwords",
    "busca secretos en mi código",
  ]) assert.equal(wantsDeep(l), true, l);
});

test("nicht Tiefenlauf (false) und Trennung vom Schlüssel-Check", () => {
  for (const l of ["prüf meinen rechner", "wie geht es dir", "mach einen bericht", "update"]) assert.equal(wantsDeep(l), false, l);
  // the SSH-access phrasings go to the key check, not the deep run
  for (const l of ["wer hat noch einen schlüssel", "which ssh keys are on this server", "who still has access"]) {
    assert.equal(wantsDeep(l), false, "deep? " + l);
    assert.equal(wantsKeys(l), true, "keys? " + l);
  }
});
