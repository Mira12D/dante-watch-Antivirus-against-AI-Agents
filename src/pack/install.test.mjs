import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync, spawn } from "node:child_process";
import { signPack } from "../../bib/pack-sign.mjs";
import { installPack, installMany, saveLicense, readLicense, fetchPacks, licenseFile, TOKEN_IN_LINE } from "./install.mjs";
import { packFile, packsDir } from "./pack.mjs";
import { isOwnerOnly } from "../core/perm.mjs";

const k = generateKeyPairSync("ed25519");
const PRIV = k.privateKey.export({ type: "pkcs8", format: "pem" });
const PUB = k.publicKey.export({ type: "spki", format: "pem" });
const TOKEN = "dnt_" + "aB3-_".repeat(7).slice(0, 32);
const rule = (id, names = [".x"]) => ({ id, know: "secrets", type: "path_exposed", title: "Regel " + id, names, i18n: { en: { title: "Rule " + id }, es: { title: "Regla " + id } } });
const mk = (serial, rules, o = {}) => ({ v: 1, serial, issued: "2026-10-25", expires: "2999-01-01", rules, ...o });
const pack = (serial, rules, o) => JSON.stringify(signPack(mk(serial, rules, o), PRIV));
const inHome = (fn) => async () => {
  const dir = mkdtempSync(join(tmpdir(), "dante-"));
  const old = process.env.DANTE_HOME; process.env.DANTE_HOME = dir;
  try { await fn(dir); } finally { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(dir, { recursive: true, force: true }); }
};
const O = { publicKey: PUB };

test("Lizenz: nur ein echt aussehender Token wird gespeichert, nur für den Besitzer lesbar", inHome(() => {
  assert.equal(saveLicense("kaputt"), false); assert.equal(existsSync(licenseFile()), false);
  assert.equal(saveLicense("dnt_zu_kurz"), false);
  assert.equal(saveLicense(TOKEN), true);
  assert.equal(readLicense(), TOKEN);
  assert.notEqual(isOwnerOnly(licenseFile()), false);
}));
test("Lizenz-Datei mit Müll liefert keinen Token", inHome(() => { saveLicense(TOKEN); writeFileSync(licenseFile(), "rm -rf /\n"); assert.equal(readLicense(), null); }));
test("Ein eingefügter Token wird mitten im Satz erkannt, aber nicht in längeren Zeichenketten", () => {
  assert.equal(("hier mein token: " + TOKEN + " danke").match(TOKEN_IN_LINE)[0], TOKEN);
  assert.equal(TOKEN.match(TOKEN_IN_LINE)[0], TOKEN);
  assert.equal(("lizenz " + TOKEN + "zusatz").match(TOKEN_IN_LINE), null);
  assert.equal("dnt_kurz".match(TOKEN_IN_LINE), null);
});

test("Installieren: ein Pack landet als eigene Datei, nichts wird überschrieben", inHome(() => {
  const r = installPack(pack(3, [rule("a")]), O);
  assert.equal(r.ok, true); assert.equal(JSON.parse(readFileSync(packFile(3), "utf8")).serial, 3);
  assert.equal(existsSync(packFile(3) + ".tmp"), false);
  const again = installPack(pack(3, [rule("anders", [".y"])]), O);   // same serial, other content: never replaces
  assert.equal(again.ok, false); assert.equal(again.same, true);
  assert.deepEqual(JSON.parse(readFileSync(packFile(3), "utf8")).rules.map((x) => x.id), ["a"]);
}));
test("Installieren: Fälschung, fremder Schlüssel, Abgelaufenes werden abgelehnt, es entsteht keine Datei", inHome(() => {
  const forged = JSON.parse(pack(9, [rule("a")])); forged.rules[0].names = [".evil"];
  const foreign = JSON.stringify(signPack(mk(9, [rule("a")]), generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" })));
  for (const [raw, code] of [[JSON.stringify(forged), "signature"], [foreign, "signature"], [pack(9, [rule("a")], { expires: "2020-01-01" }), "expired"], ["nope", "bad_json"]]) {
    const r = installPack(raw, O); assert.equal(r.ok, false); assert.equal(r.code, code);
  }
  assert.equal(existsSync(packsDir()), false);
}));
test("Mehrere Packs: in Reihenfolge der Nummer, Diff nennt neu und geändert, zweiter Lauf überspringt alles", inHome(() => {
  const raws = [pack(5, [rule("secrets", [".env", ".neu"])]), pack(2, [rule("neu1")]), pack(4, [rule("neu2")])];
  const r = installMany(raws, O);
  assert.deepEqual(r.installed.map((p) => p.serial), [2, 4, 5]);
  assert.deepEqual(r.diff.added.map((x) => x.id).sort(), ["neu1", "neu2"]);
  assert.deepEqual(r.diff.changed.map((x) => x.id), ["secrets"]);
  assert.deepEqual(readdirSync(packsDir()).sort(), ["pack-2.json", "pack-4.json", "pack-5.json"]);
  const second = installMany(raws, O);
  assert.deepEqual(second.installed, []); assert.deepEqual(second.skipped, [2, 4, 5]);
  const forged = JSON.parse(pack(8, [rule("x")])); forged.rules[0].names = [".evil"];
  const third = installMany([pack(7, [rule("n7")]), JSON.stringify(forged)], O);
  assert.deepEqual(third.installed.map((p) => p.serial), [7]); assert.equal(third.refused.length, 1); assert.equal(third.refused[0].code, "signature");
}));
test("Ein neues Pack lässt alte Packs unangetastet", inHome(() => {
  installMany([pack(1, [rule("a")]), pack(2, [rule("b")])], O);
  const before = readFileSync(packFile(1), "utf8");
  installMany([pack(3, [rule("c")])], O);
  assert.equal(readFileSync(packFile(1), "utf8"), before); assert.equal(existsSync(packFile(2)), true);
}));

// ---- the one fetch, against a test server in its OWN process with the real curl -------------------
// (fetchPacks blocks its process while curl runs, so a server in the same process could never answer)
const haveCurl = (() => { try { execSync("command -v curl", { stdio: "ignore" }); return true; } catch { return false; } })();
const CHILD = `const s = require("node:http").createServer((q, r) => {
  console.log("AUTH " + (q.headers.authorization || ""));
  const big = Number(process.env.BIG);
  r.writeHead(Number(process.env.CODE), big ? { "Content-Length": big } : {});
  r.end(big ? "x".repeat(big) : process.env.BODY);
}).listen(0, "127.0.0.1", () => console.log("PORT " + s.address().port));`;
function serve({ code = 200, body = "", big = 0 }) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, ["-e", CHILD], { env: { ...process.env, CODE: String(code), BODY: body, BIG: String(big) } });
    let buf = "", up = false;
    c.stdout.on("data", (d) => {
      buf += d; const m = /PORT (\d+)/.exec(buf);
      if (m && !up) { up = true; resolve({ url: "http://127.0.0.1:" + m[1] + "/dante/packs", auth: () => (/AUTH (.*)/.exec(buf) || [])[1], stop: () => c.kill() }); }
    });
  });
}
const tick = () => new Promise((r) => setTimeout(r, 150));
const bundle = (...ps) => '{"packs":[' + ps.join(",") + "]}";

test("Abruf: ein Aufruf, Token als Bearer, ganzes Bündel kommt, Installation klappt", { skip: !haveCurl }, inHome(async () => {
  saveLicense(TOKEN);
  const srv = await serve({ body: bundle(pack(1, [rule("a")]), pack(2, [rule("b")]), pack(3, [rule("c")])) });
  const r = fetchPacks({ url: srv.url }); await tick(); srv.stop();
  assert.equal(srv.auth(), "Bearer " + TOKEN);
  assert.equal(r.ok, true); assert.equal(r.raws.length, 3);
  assert.deepEqual(installMany(r.raws, O).installed.map((p) => p.serial), [1, 2, 3]);
}));
test("Abruf: 401 unbekannt, 403 gesperrt, 429 zu viel kommen als Status zurück, ohne Datei", { skip: !haveCurl }, inHome(async () => {
  saveLicense(TOKEN);
  for (const code of [401, 403, 429]) {
    const srv = await serve({ code, body: '{"error":"x"}' });
    const r = fetchPacks({ url: srv.url }); srv.stop();
    assert.equal(r.ok, false); assert.equal(r.code, code); assert.equal(r.raws, undefined);
  }
}));
test("Abruf: Müll mit Status 200 wird nicht angenommen", { skip: !haveCurl }, inHome(async () => {
  saveLicense(TOKEN);
  for (const body of ["kein json", '{"packs":"nope"}', "[]"]) {
    const srv = await serve({ body }); const r = fetchPacks({ url: srv.url }); srv.stop();
    assert.equal(r.ok, false); assert.equal(r.badBody, true);
  }
}));
test("Abruf: keine Lizenz → kein Aufruf; kein Server → Code 0; zu große Antwort wird verworfen", { skip: !haveCurl }, inHome(async () => {
  assert.equal(fetchPacks({ url: "http://127.0.0.1:9/x" }).noLicense, true);
  saveLicense(TOKEN);
  const none = fetchPacks({ url: "http://127.0.0.1:9/x" });
  assert.equal(none.ok, false); assert.equal(none.code, 0);
  const srv = await serve({ big: 5000000 }); const r = fetchPacks({ url: srv.url }); srv.stop();
  assert.equal(r.ok, false);
}));
