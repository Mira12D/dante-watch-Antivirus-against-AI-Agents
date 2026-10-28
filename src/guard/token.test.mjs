import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import { verifyToken } from "./token.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "pem" });
const make = (id, until) => { const m = `${id}.${until}`; return m + "." + edSign(null, Buffer.from(m), privateKey).toString("base64url"); };

test("ein echt signierter Token wird gelesen; until kommt zurück", () => {
  const id = "AbC0123456789xyz", until = Date.now() + 30 * 86400000;
  const r = verifyToken(make(id, until), pub);
  assert.deepEqual(r, { id, until });
});
test("verfälschter oder erfundener Token gilt nicht (kein Abschalten des Nörgelns per Fake)", () => {
  const id = "AbC0123456789xyz", until = Date.now() + 86400000;
  const tok = make(id, until);
  assert.equal(verifyToken(tok.slice(0, -2) + "xx", pub), null);          // Signatur verdreht
  assert.equal(verifyToken(`${id}.${until + 999}.` + tok.split(".")[2], pub), null); // until manipuliert
  assert.equal(verifyToken("irgendwas", pub), null);
  assert.equal(verifyToken(make(id, until)), null);                       // mit dem ECHTEN (anderen) Produktschluessel: ungueltig
});
