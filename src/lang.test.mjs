import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectLang, saveLang, savedLang } from "./i18n.mjs";

const empty = mkdtempSync(join(tmpdir(), "dante-lang-"));   // a folder with no saved choice
const D = (env, apple = "") => detectLang({ env: { DANTE_HOME: empty, ...env }, apple });
const APPLE_DE = '(\n    "de-DE",\n    "en-DE"\n)', APPLE_ES = '(\n    "es-ES",\n    "en-ES"\n)', APPLE_EN = '(\n    "en-US"\n)';

test("die Sprache der Maschine: LANG de/es/en", () => {
  assert.equal(D({ LANG: "de_DE.UTF-8" }), "de"); assert.equal(D({ LANG: "es_ES.UTF-8" }), "es"); assert.equal(D({ LANG: "en_GB.UTF-8" }), "en");
  assert.equal(D({ LC_ALL: "es_MX.UTF-8", LANG: "en_US.UTF-8" }), "es");
});
test("ein deutliches Nicht-Englisch schlägt ein englisches Signal: en_US ist nur der Standard der Werkzeuge", () => {
  assert.equal(D({ LANG: "en_US.UTF-8" }, APPLE_DE), "de");                // a German Mac, a terminal that says en_US
  assert.equal(D({ LANG: "en_US.UTF-8" }, APPLE_ES), "es");
  assert.equal(D({ LANG: "de_DE.UTF-8" }, APPLE_EN), "de");
  assert.equal(D({ LANG: "en_US.UTF-8" }, APPLE_EN), "en");
});
test("nichts zu gehen, oder eine Sprache, die Dante nicht spricht → Englisch (nie geraten)", () => {
  assert.equal(D({}), "en"); assert.equal(D({ LANG: "C" }), "en"); assert.equal(D({ LANG: "POSIX" }), "en");
  assert.equal(D({ LANG: "fr_FR.UTF-8" }), "en"); assert.equal(D({ LANG: "pt_BR.UTF-8" }, '(\n    "pt-BR"\n)'), "en");
});
test("LANGUAGE (eine Liste) und eine zweite Systemsprache zählen", () => {
  assert.equal(D({ LANGUAGE: "de:en" }), "de");
  assert.equal(D({ LANG: "C" }, '(\n    "fr-FR",\n    "es-ES"\n)'), "es");   // the first language among those Dante knows
});
test("DANTE_LANG und die selbst festgelegte Sprache gewinnen immer, auch gegen alles andere", () => {
  assert.equal(D({ DANTE_LANG: "es", LANG: "de_DE.UTF-8" }, APPLE_DE), "es");
  const dir = mkdtempSync(join(tmpdir(), "dante-lang-"));
  try {
    assert.equal(savedLang({ DANTE_HOME: dir }), null);
    assert.equal(saveLang("fr", { DANTE_HOME: dir }), false);               // not a language Dante speaks
    assert.equal(saveLang("es", { DANTE_HOME: dir }), true);
    assert.equal(savedLang({ DANTE_HOME: dir }), "es");
    assert.equal(detectLang({ env: { DANTE_HOME: dir, LANG: "de_DE.UTF-8", DANTE_LANG: "en" }, apple: APPLE_DE }), "es");   // saved beats everything
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
