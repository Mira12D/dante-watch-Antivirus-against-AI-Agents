import test from "node:test";
import assert from "node:assert/strict";
import { cardsOf, findCard, facetOf, answer, norm } from "./know.mjs";
import { BUILTIN } from "./builtin.mjs";
import { validateKnow, CARD_LANGS, CARD_KEYS } from "./rules.mjs";
import { setLang } from "../i18n.mjs";

const cards = cardsOf([]);
const inLang = (l, fn) => { setLang(l); try { return fn(); } finally { setLang("de"); } };

test("jede eingebaute Regel hat eine Karte, und alle Karten sind in drei Sprachen vollständig", () => {
  assert.equal(validateKnow(BUILTIN.know), null);
  const ids = new Set(BUILTIN.know.map((c) => c.id));
  for (const r of BUILTIN.rules) assert.ok(ids.has(r.know || r.id), r.id);
  assert.ok(ids.has("rechte"));   // the permissions check has no rule, but it has a card
  for (const c of BUILTIN.know) for (const l of CARD_LANGS) for (const k of CARD_KEYS) assert.ok(c[l][k].length > 20, `${c.id}.${l}.${k}`);
});
test("norm: ohne Akzente, ß als ss, Satzzeichen weg", () => { assert.equal(norm("Hintertür!  Straße?"), "hintertur strasse"); assert.equal(norm(".env"), "env"); });
test("Thema finden: Akzente egal, längster Alias gewinnt, nichts Passendes → null", () => {
  assert.equal(findCard("was ist eine Hintertür", cards).id, "webshell");
  assert.equal(findCard("was ist eine hintertuer", cards).id, "webshell");
  assert.equal(findCard("what is a php shell", cards).id, "php2shell");      // "php shell" beats "shell"
  assert.equal(findCard("ist meine .env offen", cards).id, "secrets");
  assert.equal(findCard("cómo funcionan los permisos", cards).id, "rechte");
  assert.equal(findCard("wie ist das wetter", cards), null);
  assert.equal(findCard("phpmyadmin", cards), null);                          // "php" must not match inside a longer word
});
test("Facette der Frage in drei Sprachen", () => {
  const f = (q) => facetOf(q);
  assert.equal(f("was ist eine webshell"), "basic"); assert.equal(f("what is a webshell"), "basic"); assert.equal(f("qué es una webshell"), "basic");
  assert.equal(f("woran erkenne ich das"), "normal"); assert.equal(f("what stands out here"), "normal"); assert.equal(f("qué llama la atención"), "normal"); assert.equal(f("ist das normal"), "normal");
  assert.equal(f("warum ist das gefährlich"), "why"); assert.equal(f("why is that dangerous"), "why"); assert.equal(f("por qué es peligroso"), "why");
  assert.equal(f("wie prüfst du das"), "how"); assert.equal(f("how do you check this"), "how"); assert.equal(f("cómo lo compruebas"), "how");
  assert.equal(f("was tue ich dagegen"), "todo"); assert.equal(f("what do i do about it"), "todo"); assert.equal(f("qué hago al respecto"), "todo");   // the three hints Dante prints
  assert.equal(f("was soll ich tun"), "todo"); assert.equal(f("what should i do"), "todo"); assert.equal(f("qué hago"), "todo");
});
test("Antworten: höchstens vier Zeilen, in jeder Sprache anders, nie leer", () => {
  const seen = new Set();
  for (const l of CARD_LANGS) inLang(l, () => {
    for (const c of cards) for (const q of ["was ist das", "woran erkenne ich das", "warum gefährlich", "wie prüfst du", "what should i do"]) {
      const a = answer({ intent: "thema", line: q, cards, card: c });
      const n = (a.title ? 1 : 0) + a.lines.length + (a.hint ? 1 : 0);
      assert.ok(a.lines.length >= 1 && n <= 4, `${l} ${c.id} ${q}: ${n}`);
      assert.ok(a.lines.every((x) => x && x.length > 10));
    }
    seen.add(answer({ intent: "thema", line: "was ist das", cards, card: cards[0] }).lines[0]);
  });
  assert.equal(seen.size, 3);
});
test("Job-Antwort nennt alle Themen; unbekanntes Thema nennt, was er erklären kann", () => {
  for (const l of CARD_LANGS) inLang(l, () => {
    const job = answer({ intent: "job", line: "", cards });
    assert.equal(job.lines.length, 3); assert.ok(job.lines[1].includes("PHP2Shell") && job.lines[1].includes("SSH"));
    const none = answer({ intent: "thema", line: "wetter", cards, card: null });
    assert.equal(none.lines.length, 1); assert.ok(none.lines[0].includes("SSH"));
  });
});
test("Ein Pack kann eine Karte ersetzen und neue bringen", () => {
  const mine = { ...BUILTIN.know[0], de: { ...BUILTIN.know[0].de, title: "Neu" } };
  const extra = { ...BUILTIN.know[1], id: "extra", aliases: ["zusatz"] };
  const merged = cardsOf([{ know: [mine] }, { know: [extra] }]);
  assert.equal(merged.length, BUILTIN.know.length + 1);
  assert.equal(merged.find((c) => c.id === BUILTIN.know[0].id).de.title, "Neu");
  assert.equal(findCard("was ist zusatz", merged).id, "extra");
});
