// Pack factory tool (runs on the kitchen server, never shipped): signs a pack body with the private
// key. The body gets its serial, issue date and expiry from the caller, not from here.
// usage: node pack-sign.mjs <body.json> <out.json> [privateKey.pem]
import { sign, createPrivateKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { canonical } from "../src/pack/pack.mjs";
import { validateRules, validateKnow, missingTexts } from "../src/pack/rules.mjs";
import { BUILTIN } from "../src/pack/builtin.mjs";

export function signPack(body, privatePem) {
  const why = validateRules(body.rules);
  if (why) throw new Error("Regel ungültig: " + why);
  const badKnow = validateKnow(body.know);
  if (badKnow) throw new Error("Karte ungültig: " + badKnow);
  const gap = missingTexts(body.rules, body.know, BUILTIN.know);
  if (gap) throw new Error("Text fehlt (jede Regel braucht Englisch und Spanisch): " + gap);
  const { sig, ...b } = body;
  const s = sign(null, Buffer.from(canonical(b)), createPrivateKey(privatePem)).toString("base64");
  return { ...b, sig: s };
}

if (process.argv[1] && process.argv[1].endsWith("pack-sign.mjs") && process.argv[2]) {
  const [body, out, key] = process.argv.slice(2);
  writeFileSync(out, JSON.stringify(signPack(JSON.parse(readFileSync(body, "utf8")), readFileSync(key, "utf8"))));
  console.log("signiert →", out);
}
