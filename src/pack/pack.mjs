// Signed packs: extra rules on top of the package. A pack is data, never code. Files live in
// ~/.dante/packs/pack-<serial>.json and sit side by side. A pack is accepted only if it:
//   1. is small enough and valid JSON      4. has not expired
//   2. has a valid Ed25519 signature        5. fits the rule schema (rules.mjs)
//   3. carries a serial number              6. does not need a newer Dante than this one
// Failures are reported as a code (translated in texts.mjs) with a short German reason for logs.
import { verify, createPublicKey } from "node:crypto";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PUBLIC_KEY_PEM } from "./key.mjs";
import { VERSION, atLeast } from "../version.mjs";
import { validateRules, validateKnow } from "./rules.mjs";

export const MAX_BYTES = 512 * 1024;
const MAX_PACKS = 200;
export const home = () => process.env.DANTE_HOME || join(homedir(), ".dante");
export const packsDir = () => join(home(), "packs");
export const packFile = (serial) => join(packsDir(), `pack-${serial}.json`);

// Same bytes on both sides: keys sorted at every level, arrays keep their order.
export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

const no = (code, why, detail) => ({ ok: false, code, why, ...(detail ? { detail } : {}) });
const textOk = (s) => typeof s === "string" && s.length > 0 && s.length <= 80 && !/[\u0000-\u001f]/.test(s);

// raw = the file's text. opts: publicKey (PEM, tests only), now (Date).
// Returns { ok: true, pack } or { ok: false, code, why, detail? }.
export function verifyPack(raw, { publicKey = PUBLIC_KEY_PEM, now = new Date(), version = VERSION } = {}) {
  if (typeof raw !== "string" || raw.length > MAX_BYTES) return no("too_big", "zu groß");
  let pack;
  try { pack = JSON.parse(raw); } catch { return no("bad_json", "kein gültiges JSON"); }
  if (!pack || typeof pack !== "object" || pack.v !== 1) return no("format", "unbekanntes Format");
  if (typeof pack.sig !== "string") return no("no_sig", "keine Signatur");
  const { sig, ...body } = pack;
  let good = false;
  try { good = verify(null, Buffer.from(canonical(body)), createPublicKey(publicKey), Buffer.from(sig, "base64")); } catch { good = false; }
  if (!good) return no("signature", "Signatur stimmt nicht");
  if (!Number.isInteger(body.serial) || body.serial < 1) return no("serial", "Seriennummer fehlt");
  const exp = Date.parse(body.expires);
  if (!Number.isFinite(exp)) return no("no_expiry", "Ablaufdatum fehlt");
  if (exp <= now.getTime()) return no("expired", "abgelaufen am " + body.expires, body.expires);
  // A pack that needs a newer Dante (a new kind of rule) is told so, plainly, instead of being refused as "invalid rule".
  // The pack stays out of ~/.dante/packs; after the update the same `update` fetches it again.
  if (body.needs_client !== undefined) {
    if (typeof body.needs_client !== "string" || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(body.needs_client)) return no("fields", "Feld needs_client");
    if (!atLeast(version, body.needs_client)) return no("needs", "braucht Dante ab " + body.needs_client, body.needs_client);
  }
  for (const k of ["title", "title_de"]) if (body[k] !== undefined && !textOk(body[k])) return no("fields", "Feld " + k);
  if (body.free !== undefined && typeof body.free !== "boolean") return no("fields", "Feld free");
  const bad = validateRules(body.rules);
  if (bad) return no("rule", "Regel ungültig: " + bad, bad);
  const badKnow = validateKnow(body.know);
  if (badKnow) return no("rule", "Karte ungültig: " + badKnow, badKnow);
  return { ok: true, pack: body };
}

// Every valid pack in ~/.dante/packs, oldest serial first (so a newer pack's rule wins on the same
// id). notices lists the files that were refused, with the code and the file's serial from its name.
export function loadPacks({ now = new Date(), publicKey = PUBLIC_KEY_PEM } = {}) {
  const dir = packsDir();
  if (!existsSync(dir)) return { packs: [], notices: [] };
  const packs = [], notices = [];
  let files = [];
  try { files = readdirSync(dir).filter((f) => /^pack-\d+\.json$/.test(f)).slice(0, MAX_PACKS); } catch { return { packs: [], notices: [] }; }
  for (const f of files) {
    try {
      if (statSync(join(dir, f)).size > MAX_BYTES) { notices.push({ file: f, code: "too_big" }); continue; }
      const r = verifyPack(readFileSync(join(dir, f), "utf8"), { now, publicKey });
      if (!r.ok) notices.push({ file: f, code: r.code, detail: r.detail });
      else if (`pack-${r.pack.serial}.json` !== f) notices.push({ file: f, code: "format" }); // the name must say what the pack is
      else packs.push(r.pack);
    } catch { notices.push({ file: f, code: "unreadable" }); }
  }
  return { packs: packs.sort((a, b) => a.serial - b.serial), notices };
}
