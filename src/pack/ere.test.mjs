import test from "node:test";
import assert from "node:assert/strict";
import { toJs, literalOf, automaton } from "./ere.mjs";

test("POSIX-Klassen werden übersetzt", () => {
  const r = toJs("pass[[:space:]]*=[[:space:]]*['\"][A-Za-z0-9]{8,}['\"]");
  assert.ok(r.test(`pass = "abcd1234xyz"`)); assert.ok(!r.test("pass = x"));
  assert.ok(toJs("AKIA[0-9A-Z]{16}").test("k=AKIAJ3KQ9XNLPW7TRVZB"));
  assert.ok(toJs("^[[:alnum:]]{4}$").test("ab12"));
});
test("Unbekanntes wird nicht geraten", () => {
  assert.equal(toJs("a[[:foo:]]b"), null);
  assert.equal(toJs("abc[def"), null);
});
test("Bracket mit Backslash und ]", () => {
  assert.ok(toJs("x[^]]+y").test("xabcy"));
  assert.ok(toJs("[\\.]abc").test("\\abc"));
});
test("längster fester Text", () => {
  assert.equal(literalOf("AKIA[0-9A-Z]{16}"), "AKIA");
  assert.equal(literalOf("SG\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9]{32}"), "SG.");
  assert.equal(literalOf("-----BEGIN ([A-Z]+ )?PRIVATE KEY-----"), "PRIVATE KEY-----");
});
test("optionale Zeichen und Alternativen zählen nicht", () => {
  assert.equal(literalOf("ab*c"), "a"); assert.equal(literalOf("x(a|b)yyyy"), "yyyy"); assert.equal(literalOf("a|bbbb"), "");
});
test("Aho-Corasick findet alle Wörter in einem Durchgang", () => {
  const find = automaton(["AKIA", "ghp_", "sk_live_", "he", "she"]);
  assert.deepEqual([...find("x AKIAxx sk_live_ shell")].sort(), [0, 2, 3, 4]);
  assert.deepEqual([...find("nothing at all")], []);
});
