import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign, createPrivateKey } from "node:crypto";
import { verifyPack, loadPacks, canonical, MAX_BYTES, packsDir } from "./pack.mjs";
import { signPack } from "../../bib/pack-sign.mjs";
import { validateRules, missingTexts } from "./rules.mjs";
import { BUILTIN } from "./builtin.mjs";
import { fileURLToPath } from "node:url";

const k = generateKeyPairSync("ed25519");
const PRIV = k.privateKey.export({ type: "pkcs8", format: "pem" });
const PUB = k.publicKey.export({ type: "spki", format: "pem" });
const other = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
// What a hacked factory could do: sign a body that signPack would have refused.
const signUnchecked = (b) => ({ ...b, sig: sign(null, Buffer.from(canonical(b)), createPrivateKey(PRIV)).toString("base64") });
const NOW = new Date("2026-11-01T00:00:00Z");
const T = (title) => ({ title });
const rules = () => [
  { id: "php2shell", type: "version_cve", title: "PHP2Shell", cve: ["CVE-2026-109618"], aliases: ["php2shell"], probe: "php", fixed: { "8.2": 35, "8.3": 36 }, i18n: { en: T("PHP2Shell"), es: T("PHP2Shell") } },
  { id: "env-open", know: "secrets", type: "path_exposed", title: "Offene .env", names: [".env", "*.sql"], i18n: { en: T("Open .env"), es: T(".env abierto") } },
  { id: "shell-markers", know: "webshell", type: "file_pattern", title: "Webshell", glob: "*.php", patterns: [{ name: "eval b64", re: "eval\\(base64_decode", i18n: { en: "eval b64", es: "eval b64" } }], i18n: { en: T("Webshell"), es: T("Webshell") } },
  { id: "ssh-root", know: "sshd", type: "sshd_setting", title: "Root-Login", settings: [{ key: "permitrootlogin", bad: ["yes"] }], i18n: { en: T("Root login"), es: T("Acceso de root") } },
];
const body = (o = {}) => ({ v: 1, serial: 5, issued: "2026-10-30", expires: "2026-11-27", title: "Test pack", title_de: "Testpack", rules: rules(), ...o });
const ok = (b, opts = {}) => verifyPack(JSON.stringify(signPack(b, PRIV)), { publicKey: PUB, now: NOW, ...opts });

test("das eingebaute Pack und alle ausgelieferten Packs: gültig UND in drei Sprachen vollständig", () => {
  assert.equal(validateRules(BUILTIN.rules), null); assert.equal(missingTexts(BUILTIN.rules, BUILTIN.know), null);
  const dir = fileURLToPath(new URL("../../bib/packs/", import.meta.url));
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^pack-\d+\.json$/.test(f)) : [];
  for (const f of files) {
    const p = JSON.parse(readFileSync(dir + f, "utf8"));
    assert.equal(validateRules(p.rules), null, f); assert.equal(missingTexts(p.rules, p.know, BUILTIN.know), null, f);   // every rule is explainable
    assert.ok(p.title && p.title_de, f + ": Titel EN und DE");
  }
});
test("ein echtes Pack geht durch", () => { const r = ok(body()); assert.equal(r.ok, true); assert.equal(r.pack.serial, 5); });
test("canonical ist unabhängig von der Schlüsselreihenfolge", () => assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), canonical({ a: [2, { c: 2, d: 1 }], b: 1 })));
test("ein geändertes Zeichen bricht die Signatur (Code signature)", () => {
  const p = signPack(body(), PRIV); p.rules[0].fixed["8.2"] = 1;
  assert.equal(verifyPack(JSON.stringify(p), { publicKey: PUB, now: NOW }).code, "signature");
});
test("fremder Schlüssel, ohne Signatur, kaputtes JSON, zu groß: je ein eigener Code", () => {
  assert.equal(verifyPack(JSON.stringify(signPack(body(), other)), { publicKey: PUB, now: NOW }).code, "signature");
  const { sig, ...nosig } = signPack(body(), PRIV);
  assert.equal(verifyPack(JSON.stringify(nosig), { publicKey: PUB, now: NOW }).code, "no_sig");
  assert.equal(verifyPack("{nope", { publicKey: PUB }).code, "bad_json");
  assert.equal(verifyPack("x".repeat(MAX_BYTES + 1), { publicKey: PUB }).code, "too_big");
  assert.equal(verifyPack(JSON.stringify({ v: 2 }), { publicKey: PUB }).code, "format");
});
test("abgelaufen wird abgelehnt und nennt das Datum", () => { const r = ok(body({ expires: "2026-10-31" })); assert.equal(r.code, "expired"); assert.equal(r.detail, "2026-10-31"); });
test("Titel und free müssen sauber sein", () => {
  assert.equal(ok(body({ title: "x".repeat(81) })).code, "fields");
  assert.equal(ok(body({ free: "ja" })).code, "fields");
  assert.equal(ok(body({ free: true })).ok, true);
});
test("unbekannter Regeltyp: die Fabrik signiert nicht, und ein trotzdem signiertes Pack wird abgelehnt", () => {
  const b = body(); b.rules.push({ id: "evil", type: "run_command", title: "x", cmd: "rm -rf /", i18n: { en: T("x"), es: T("x") } });
  assert.throws(() => signPack(b, PRIV), /nicht erlaubt/);
  assert.equal(verifyPack(JSON.stringify(signUnchecked(b)), { publicKey: PUB, now: NOW }).code, "rule");
  const c = body(); c.rules[0].probe = "bash";
  assert.equal(verifyPack(JSON.stringify(signUnchecked(c)), { publicKey: PUB, now: NOW }).code, "rule");
});
test("die Fabrik signiert keine Regel ohne Englisch und Spanisch", () => {
  const b = body(); delete b.rules[1].i18n.es;
  assert.throws(() => signPack(b, PRIV), /Text fehlt.*env-open.*es/);
  const c = body(); delete c.rules[2].patterns[0].i18n;
  assert.throws(() => signPack(c, PRIV), /Text fehlt.*eval b64/);
  const d = body(); d.rules[1].msg = { bad: "Schlecht" };
  assert.throws(() => signPack(d, PRIV), /Text fehlt.*bad/);
});
test("loadPacks: alle gültigen Packs, älteste zuerst; abgelehnte Dateien mit Code, ohne Absturz", () => {
  const dir = mkdtempSync(join(tmpdir(), "dante-")), old = process.env.DANTE_HOME; process.env.DANTE_HOME = dir;
  try {
    assert.deepEqual(loadPacks({ publicKey: PUB }), { packs: [], notices: [] });
    mkdirSync(packsDir(), { recursive: true });
    const put = (name, text) => writeFileSync(join(packsDir(), name), text);
    put("pack-7.json", JSON.stringify(signPack(body({ serial: 7 }), PRIV)));
    put("pack-2.json", JSON.stringify(signPack(body({ serial: 2 }), PRIV)));
    put("pack-9.json", JSON.stringify(signPack(body({ serial: 9, expires: "2026-10-01" }), PRIV)));   // expired
    put("pack-4.json", JSON.stringify(signPack(body({ serial: 5 }), PRIV)));                           // name lies about the serial
    put("pack-3.json", "{nope");
    put("notes.txt", "not a pack");
    const r = loadPacks({ publicKey: PUB, now: NOW });
    assert.deepEqual(r.packs.map((p) => p.serial), [2, 7]);
    assert.deepEqual(r.notices.map((n) => n.file + ":" + n.code).sort(), ["pack-3.json:bad_json", "pack-4.json:format", "pack-9.json:expired"]);
  } finally { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(dir, { recursive: true, force: true }); }
});

test("ein Pack, das ein neueres Dante braucht, wird klar so abgelehnt (nicht als 'ungültige Regel')", async () => {
  const { atLeast } = await import("../version.mjs");
  assert.equal(atLeast("0.1.2", "0.1.2"), true); assert.equal(atLeast("0.2.0", "0.1.9"), true); assert.equal(atLeast("0.1.2", "0.1.3"), false); assert.equal(atLeast("", "0.1.0"), false);
});

test("needs_client: ein neueres Dante wird verlangt, ein passendes lässt das Pack durch", () => {
  const unknownType = { id: "hf-x", type: "model_check", title: "Zukunft", i18n: { en: T("Future"), es: T("Futuro") } };   // a rule type this Dante does not know
  // the factory of a FUTURE Dante signs it (ours would refuse the unknown type), so sign without the check here
  const new1 = verifyPack(JSON.stringify(signUnchecked(body({ needs_client: "0.2.0", rules: [...rules(), unknownType] }))), { publicKey: PUB, now: NOW, version: "0.1.2" });
  assert.equal(new1.ok, false); assert.equal(new1.code, "needs"); assert.equal(new1.detail, "0.2.0");   // told plainly, not "invalid rule"
  assert.equal(ok(body({ needs_client: "0.1.2" }), { version: "0.1.2" }).ok, true);
  assert.equal(ok(body({ needs_client: "0.1.0" }), { version: "0.1.2" }).ok, true);
  assert.equal(ok(body({ needs_client: "abc" }), { version: "9.9.9" }).code, "fields");
  assert.equal(ok(body(), { version: "0.0.1" }).ok, true);   // a pack that asks for nothing always fits
});
