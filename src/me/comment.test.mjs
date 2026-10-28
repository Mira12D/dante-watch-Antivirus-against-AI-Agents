// The comment after checking: verdict x machine x kind -> a sentence that means something for YOU.
import { test } from "node:test";
import assert from "node:assert/strict";
import { comment, kindOf } from "./comment.mjs";
import { SAFE, WARN, RISK, UNKNOWN } from "../core/check.mjs";
import { setLang } from "../i18n.mjs";

const look = (lines) => lines.join("\n");

test("kindOf liest Art aus id/titel", () => {
  assert.equal(kindOf({ id: "schluessel", title: "x" }), "key");
  assert.equal(kindOf({ id: "backup", title: "Sicherungskopie" }), "copy");
  assert.equal(kindOf({ id: "demo", title: "Übung" }), "demo");
  assert.equal(kindOf({ id: "php2shell", title: "PHP" }), "other");
});

test("alles sicher: sagt nichts offen und dass er es gesehen hat", () => {
  setLang("de");
  const out = look(comment([{ verdict: SAFE }, { verdict: SAFE }], { machine: "mac" }));
  assert.match(out, /nichts offen/);
  assert.doesNotMatch(out, /Tür steht offen/);
});

test("risk auf dem Mac: eine Tür offen, ohne Passwort bei Schlüsseln", () => {
  setLang("de");
  const out = look(comment([{ verdict: RISK, id: "schluessel", title: "SSH-Schlüssel" }], { machine: "mac" }));
  assert.match(out, /eine Tür steht offen/);
  assert.match(out, /ohne Passwort/);
});

test("unbekannt wird nie als sicher verkauft", () => {
  setLang("de");
  const out = look(comment([{ verdict: UNKNOWN, id: "x", title: "y" }], { machine: "server", target: "web1" }));
  assert.match(out, /nichts bewiesen/);
  assert.match(out, /nicht sehen konnte/);
  assert.doesNotMatch(out, /nichts offen/);
});

test("englisch und spanisch kommen raus", () => {
  setLang("en");
  assert.match(look(comment([{ verdict: RISK, id: "a", title: "b" }], { machine: "mac" })), /one door is open/);
  setLang("es");
  assert.match(look(comment([{ verdict: RISK, id: "a", title: "b" }], { machine: "mac" })), /una puerta está abierta/);
  setLang("de");
});

test("leer bleibt leer, {c,r}-Form wird verstanden", () => {
  assert.deepEqual(comment([], {}), []);
  setLang("de");
  assert.match(look(comment([{ c: {}, r: { verdict: SAFE } }], { machine: "mac" })), /nichts offen/);
});