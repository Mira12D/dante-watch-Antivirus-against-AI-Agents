import test from "node:test";
import assert from "node:assert/strict";
import { MEMORY, newConv, note, fallback, wantsRecap, wantsCodeProof, recap } from "./conv.mjs";

test("a far guess is not asked, a close one is, and not twice in a row", () => {
  const c = newConv();
  assert.equal(fallback(c, "blabla", [{ intent: "frage_urteil", p: 0.17 }]).kind, "none");
  assert.equal(fallback(c, "kurz", [{ intent: "frage_urteil", p: 0.45 }]).kind, "ask");
  assert.equal(fallback(c, "kurz", [{ intent: "frage_urteil", p: 0.45 }]).kind, "again");
  assert.equal(fallback(c, "kurz", [{ intent: "frage_urteil", p: 0.45 }]).kind, "ask");   // after "again" it may try once more
});
test("a long line is asked to be said short, unless the guess is sure", () => {
  const c = newConv(), long = Array(20).fill("wort").join(" ");
  assert.equal(fallback(c, long, [{ intent: "frage_urteil", p: 0.5 }]).kind, "long");
  assert.equal(fallback(c, long, [{ intent: "frage_urteil", p: 0.7 }]).kind, "ask");
});
test("recap and code proof lines", () => {
  for (const l of ["was habe ich dir eben gesagt", "what did you say a moment ago", "qué dije antes"]) assert.equal(wantsRecap(l), true, l);
  for (const l of ["prüfe meinen server", "was ist ein webshell"]) assert.equal(wantsRecap(l), false, l);
  for (const l of ["Wo genau im Code steht, dass du nur liest?", "where in the code does it say you only read", "dónde en el código dice que solo lees"]) assert.equal(wantsCodeProof(l), true, l);
  for (const l of ["wo ist mein server", "prüfe den code meiner app"]) assert.equal(wantsCodeProof(l), false, l);
  const c = newConv(); note(c, "hallo", "gruss", "main"); assert.match(recap(c, "de").join("\n"), /hallo/);
});
test("the memory is a ring of 100: the 101st line pushes out the first", () => {
  const c = newConv();
  for (let i = 1; i <= MEMORY + 1; i++) note(c, "zeile " + i, "x", "main");
  assert.equal(c.turns.length, 100);
  assert.equal(c.turns[0].line, "zeile 2");
  assert.equal(c.turns[99].line, "zeile 101");
});

import { wantsHowFix, menuPick } from "./conv.mjs";
test("'wie mache ich den Schritt' meint den offenen Schritt, nicht eine neue Prüfung", () => {
  for (const l of ["der schritt nötig wie mache ichd en ?".replace("ichd en", "ich den"), "wie mache ich das", "wie behebe ich das", "was muss ich jetzt tun", "how do I fix this", "what should I do now", "cómo lo arreglo", "qué hago"]) assert.equal(wantsHowFix(l), true, l);
  for (const l of ["prüfe meinen server", "wie spät ist es", "was ist ein webshell", "wie geht es dir"]) assert.equal(wantsHowFix(l), false, l);
});
test("'prüfe die 4' gehört zur Liste, die gerade auf dem Bildschirm war", () => {
  assert.equal(menuPick("prüfe die 4", 5), 4); assert.equal(menuPick("nimm die 2", 5), 2); assert.equal(menuPick("check number 3", 5), 3);
  assert.equal(menuPick("prüfe die 9", 5), null);           // not in the list
  assert.equal(menuPick("server root@10.0.0.4", 5), null);   // an address is no menu pick
  assert.equal(menuPick("prüfe php 8.3", 5), null);
});
