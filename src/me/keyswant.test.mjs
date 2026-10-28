import test from "node:test";
import assert from "node:assert/strict";
import { wantsKeys } from "./keyswant.mjs";

test("fragt nach Zugang/Schlüsseln in drei Sprachen -> true", () => {
  for (const l of [
    "wer hat noch einen schlüssel zu meinem server",
    "wer kommt hier noch rein",
    "welche ssh-schlüssel gibt es",
    "zeig mir die authorized_keys",
    "who still has access to this box",
    "which ssh keys are on this server",
    "who has a key here",
    "quién tiene todavía acceso",
    "qué claves ssh hay",
  ]) assert.equal(wantsKeys(l), true, l);
});

test("normale Sätze -> false", () => {
  for (const l of [
    "prüf meinen rechner",
    "was ist mein system",
    "wie geht es dir",
    "mach einen bericht",
    "wer bist du",
    "update bitte",
    "hallo",
  ]) assert.equal(wantsKeys(l), false, l);
});
