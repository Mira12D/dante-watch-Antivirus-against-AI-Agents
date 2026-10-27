import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { activeBattery, mergeRules, rulesWith, BATTERY } from "./battery.mjs";
import { BUILTIN } from "../pack/builtin.mjs";
import { packsDir } from "../pack/pack.mjs";
import { signPack } from "../../bib/pack-sign.mjs";
import { setLang } from "../i18n.mjs";
import { loc } from "./loc.mjs";

const k = generateKeyPairSync("ed25519");
const PRIV = k.privateKey.export({ type: "pkcs8", format: "pem" }), PUB = k.publicKey.export({ type: "spki", format: "pem" });
const rule = (id, names) => ({ id, know: "secrets", type: "path_exposed", title: "Regel " + id, names, i18n: { en: { title: "Rule " + id }, es: { title: "Regla " + id } } });
const pack = (serial, rules) => JSON.stringify(signPack({ v: 1, serial, issued: "2026-10-25", expires: "2999-01-01", rules }, PRIV));
const ids = (b) => b.map((c) => c.id).join(",");
const withHome = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), "dante-")), old = process.env.DANTE_HOME; process.env.DANTE_HOME = dir;
  try { return fn(); } finally { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(dir, { recursive: true }); }
};
const put = (name, text) => { mkdirSync(packsDir(), { recursive: true }); writeFileSync(join(packsDir(), name), text); };

test("ohne Packs läuft nur der eingebaute Stand, ohne Hinweis", () => {
  withHome(() => { const r = activeBattery({ publicKey: PUB }); assert.equal(ids(r.battery), ids(BATTERY)); assert.deepEqual(r.notices, []); });
});
test("manipulierte Dateien stürzen nichts ab: eingebauter Stand plus ein Hinweis je Datei", () => {
  withHome(() => {
    put("pack-1.json", "{nope"); put("pack-2.json", JSON.stringify({ v: 1, serial: 2, expires: "2999-01-01", rules: [], sig: "AAAA" })); put("pack-3.json", "[]"); put("pack-4.json", "");
    const r = activeBattery({ publicKey: PUB });
    assert.equal(ids(r.battery), ids(BATTERY)); assert.deepEqual(r.packs, []);
    assert.deepEqual(r.notices.map((n) => n.code).sort(), ["bad_json", "bad_json", "format", "signature"]);
  });
});
test("mehrere Packs: neue Regeln kommen dazu, die neueste Nummer gewinnt bei gleicher id", () => {
  withHome(() => {
    put("pack-5.json", pack(5, [rule("secrets", [".fuenf"]), rule("nur5", [".a"])]));
    put("pack-2.json", pack(2, [rule("secrets", [".zwei"]), rule("nur2", [".b"])]));
    const { battery, packs } = activeBattery({ publicKey: PUB });
    assert.deepEqual(packs.map((p) => p.serial), [2, 5]);
    assert.equal(ids(battery), "php2shell,secrets,webshell,sshd,nur2,nur5,rechte");
    assert.deepEqual(rulesWith(packs).find((r) => r.id === "secrets").names, [".fuenf"]);
  });
});
test("mergeRules: gleiche id ersetzt, neue id kommt dazu, null/undefined sind erlaubt", () => {
  const m = mergeRules(BUILTIN.rules, [{ ...BUILTIN.rules[1], names: [".x"] }, { ...BUILTIN.rules[1], id: "neu", names: [".y"] }]);
  assert.equal(m.length, BUILTIN.rules.length + 1);
  assert.deepEqual(m.find((r) => r.id === "secrets").names, [".x"]);
  assert.equal(mergeRules(BUILTIN.rules, null).length, BUILTIN.rules.length);
  assert.equal(mergeRules(BUILTIN.rules).length, BUILTIN.rules.length);
});
test("Sprache: dieselbe Regel spricht Deutsch, Englisch und Spanisch, fehlende Sprache fällt auf Deutsch zurück", () => {
  const r = BUILTIN.rules.find((x) => x.id === "secrets");
  try {
    setLang("de"); assert.match(loc(r).title, /Geheimnisse/); assert.match(loc(r).bad, /für alle lesbar/);
    setLang("en"); assert.match(loc(r).title, /secrets/i); assert.match(loc(r).bad, /readable by everyone/);
    setLang("es"); assert.match(loc(r).title, /Secretos/); assert.match(loc(r).ok_how, /Se revisaron/);
    setLang("en"); assert.equal(loc({ title: "Nur Deutsch", msg: { bad: "Schlecht" } }).bad, "Schlecht");
  } finally { setLang("de"); }
});

import { splitExposed } from "./secrets.mjs";
test("Sicherungskopie einer öffentlichen Seite ist ein Hinweis, ein Dump oder eine Config-Kopie ein Risiko", () => {
  const r = splitExposed(["/var/www/a/index.html.bak", "/var/www/a/sitemap.xml.bak", "/var/www/a/llms.txt.bak", "/var/www/a/db.sql", "/var/www/a/wp-config.php.bak", "/var/www/a/.env", "/var/www/a/dump.sql.gz"]);
  assert.deepEqual(r.soft.map((p) => p.split("/").pop()), ["index.html.bak", "sitemap.xml.bak", "llms.txt.bak"]);
  assert.deepEqual(r.hard.map((p) => p.split("/").pop()), ["db.sql", "wp-config.php.bak", ".env", "dump.sql.gz"]);
});
