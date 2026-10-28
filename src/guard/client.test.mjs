import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import { identity, saveToken, guardStatus, labelOf, decoyFile, DECOY_KINDS, maybeNudge, enrollArgs, decoyArgs } from "./client.mjs";

const home = () => mkdtempSync(join(tmpdir(), "gc-"));
const file = (h) => join(h, "guard.json");

test("Dante vergibt sich selbst eine ID und ein Geheimnis, stabil über Aufrufe", () => {
  const h = home(), f = file(h);
  const a = identity(f), b = identity(f);
  assert.match(a.id, /^[A-Za-z0-9_-]{16,}$/);
  assert.match(a.secret, /^[A-Za-z0-9_-]{16,}$/);
  assert.equal(a.id, b.id);                        // beim zweiten Mal dieselbe
  assert.equal(guardStatus(f).enrolled, true);
  assert.equal(guardStatus(f).active, false);      // noch kein Token
  rmSync(h, { recursive: true, force: true });
});

test("nur ein echt signierter Token für DIESE ID schaltet aktiv; Fremd-/Fake-Token nicht", () => {
  const h = home(), f = file(h), id = identity(f).id;
  const { privateKey } = generateKeyPairSync("ed25519");
  // dieser Testschlüssel ist NICHT der Produktschlüssel -> verifyToken lehnt ab
  const mk = (forId, until) => { const m = `${forId}.${until}`; return m + "." + edSign(null, Buffer.from(m), privateKey).toString("base64url"); };
  assert.equal(saveToken(f, mk(id, Date.now() + 1e9)), null);     // falscher Schlüssel
  assert.equal(saveToken(f, "quatsch"), null);
  assert.equal(guardStatus(f).active, false);
  rmSync(h, { recursive: true, force: true });
});

test("Label stimmt mit der Server-Formel überein (Terminal und Mail zeigen dasselbe)", () => {
  assert.equal(labelOf("Zxe0123456789abcd"), "dante-4728");
});

test("Köderdatei trägt die Trip-URL und wird nie über eine bestehende Datei geschrieben", () => {
  const h = home(), url = "https://api.nm-streetwear.space/dante/t/ABC123";
  for (const kind of Object.keys(DECOY_KINDS)) {
    const d = decoyFile(kind, url, h);
    assert.ok(d.content.includes(url), kind + " enthält die URL");
    assert.equal(d.exists, false);
  }
  // eine bestehende Datei meldet exists=true (der Aufrufer überschreibt dann nicht)
  const d = decoyFile("env", url, h);
  writeFileSync(d.path, "real");
  assert.equal(decoyFile("env", url, h).exists, true);
  rmSync(h, { recursive: true, force: true });
});

test("Nörgel höchstens einmal am Tag, nie wenn aktiv", () => {
  const h = home(), f = file(h); identity(f);
  assert.equal(maybeNudge(f, "2026-10-27", 0.1), true);          // erster Tag, Wurf niedrig -> zeigen
  assert.equal(maybeNudge(f, "2026-10-27", 0.1), false);         // gleicher Tag -> nicht nochmal
  assert.equal(maybeNudge(f, "2026-10-28", 0.9), false);         // hoher Wurf -> still, aber Datum gesetzt
  assert.equal(maybeNudge(f, "2026-10-28", 0.1), false);         // selber Tag, schon gesetzt
  rmSync(h, { recursive: true, force: true });
});

test("die curl-Argumente zeigen auf die richtigen Endpunkte und tragen id/secret", () => {
  const e = enrollArgs("https://x/dante", "ID", "SEC");
  assert.ok(e.at(-1).endsWith("/dante/guard/hello"));
  assert.ok(e.includes(JSON.stringify({ id: "ID", secret: "SEC" })));
  const d = decoyArgs("https://x/dante", "ID", "SEC", ".env", "env");
  assert.ok(d.at(-1).endsWith("/dante/api/guard/decoy"));
  assert.ok(d.includes(JSON.stringify({ id: "ID", secret: "SEC", label: ".env", kind: "env" })));   // the kind travels to the server
});
