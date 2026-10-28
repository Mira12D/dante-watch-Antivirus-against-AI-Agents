import test from "node:test";
import assert from "node:assert/strict";
import { parseFingerprints, sameKeys, collect, judge, validHostName, keysFromScan, scanHost, storedKeys } from "./hostkey.mjs";
import { createHash } from "node:crypto";

const L = (type, fp) => `256 ${fp} 203.0.113.9 (${type})`;
const OLD = [L("ED25519", "SHA256:old1"), L("RSA", "SHA256:old2"), L("ECDSA", "SHA256:old3")].join("\n");
const NEW = [L("ED25519", "SHA256:new1"), L("RSA", "SHA256:new2"), L("ECDSA", "SHA256:new3")].join("\n");
const scan = (keys, banner = "SSH-2.0-OpenSSH_10.2p1 Ubuntu-2ubuntu3.8") => `# 203.0.113.9:22 ${banner}\n${keys}`;
const io = (here, there, stored = OLD) => ({ local: async (cmd) => ({ out: /ssh-keygen -F/.test(cmd) ? "# Host 203.0.113.9 found: line 4\n" + stored : here, ok: true }), there: async (s) => (there[s] ? { out: there[s], ok: true } : { out: "", ok: false }) });

test("Fingerabdrücke werden gelesen, Kommentarzeilen und Rauschen ignoriert", () => {
  const k = parseFingerprints("# Host x found: line 3\n" + OLD + "\nquatsch");
  assert.deepEqual(k.map((x) => x.type), ["ED25519", "RSA", "ECDSA"]); assert.equal(k[0].fp, "SHA256:old1");
  assert.equal(sameKeys(k, [...k].reverse()), true); assert.equal(sameKeys(k, []), false);
});
test("Neu aufgesetzter Server: alle Typen neu, von zwei Orten dasselbe -> Hinweis, aber nie 'sicher'", async () => {
  const c = await collect(io(scan(NEW), { web: scan(NEW) }), { host: "203.0.113.9", others: ["web"] });
  const j = judge(c);
  assert.equal(j.level, "hint"); assert.ok(j.facts.some((f) => f.k === "allChanged")); assert.ok(j.facts.some((f) => f.k === "agree")); assert.ok(!j.facts.some((f) => f.k === "differ"));
  assert.deepEqual(j.proof, { type: "ED25519", fp: "SHA256:new1" }); assert.equal(c.now.banner, "SSH-2.0-OpenSSH_10.2p1 Ubuntu-2ubuntu3.8");
});
test("Jemand dazwischen: von hier ein anderer Schlüssel als von dem anderen Server -> Achtung", async () => {
  const c = await collect(io(scan(NEW), { web: scan([L("ED25519", "SHA256:evil1"), L("RSA", "SHA256:evil2"), L("ECDSA", "SHA256:evil3")].join("\n")) }), { host: "203.0.113.9", others: ["web"] });
  const j = judge(c); assert.equal(j.level, "attention"); assert.ok(j.facts.some((f) => f.k === "differ"));
});
test("Nur ein Typ geändert: auffälliger als ein Neuaufbau", async () => {
  const mixed = [L("ED25519", "SHA256:old1"), L("RSA", "SHA256:new2"), L("ECDSA", "SHA256:old3")].join("\n");
  const j = judge(await collect(io(scan(mixed), {}), { host: "203.0.113.9" })); assert.equal(j.level, "attention"); assert.ok(j.facts.some((f) => f.k === "someChanged"));
});
test("Ohne zweiten Standort: schwächere Aussage; nichts lesbar: unbekannt", async () => {
  const j = judge(await collect(io(scan(NEW), {}), { host: "203.0.113.9" })); assert.equal(j.level, "hint"); assert.ok(j.facts.some((f) => f.k === "oneView"));
  const u = judge(await collect(io("", {}), { host: "203.0.113.9" })); assert.equal(u.level, "unknown");
});
test("ein unerreichbarer zweiter Standort zählt nicht als Zustimmung", async () => {
  const j = judge(await collect(io(scan(NEW), {}), { host: "203.0.113.9", others: ["tot"] })); assert.ok(j.facts.some((f) => f.k === "oneView") && !j.facts.some((f) => f.k === "agree"));
});
test("Host-Namen mit Shell-Zeichen werden nie ausgeführt", async () => {
  for (const bad of ["x; touch /tmp/p", "$(id)", "-oProxyCommand=x", "a b"]) assert.equal(validHostName(bad), false, bad);
  const c = await collect(io("", {}), { host: "x; touch /tmp/p" }); assert.equal(c.invalid, true);
});

import { wantsMitm, describe } from "./hostkey.mjs";
import { mt } from "./texts.mjs";
import { setLang } from "../i18n.mjs";
test("die Frage 'ist jemand dazwischen' wird erkannt", () => {
  for (const l of ["ist jemand dazwischen", "check mal ob jemand dazwischen ist", "man in the middle?", "kann das ein mitm sein", "der host key hat sich geändert", "der schlüssel hat sich geändert", "is someone in between", "could someone be intercepting this", "the key has changed", "¿hay alguien en medio?", "la clave ha cambiado", "cambio de clave del servidor"]) assert.equal(wantsMitm(l), true, l);
  for (const l of ["prüfe meinen server", "welche server habe ich", "was ist mein system", "hi", "wie geht es dir"]) assert.equal(wantsMitm(l), false, l);
});
test("Der Bericht ist in drei Sprachen vollständig und nennt den Beweis-Weg", async () => {
  const c = await collect(io(scan(NEW), { web: scan(NEW) }), { host: "203.0.113.9", others: ["web"] });
  for (const lang of ["de", "en", "es"]) { setLang(lang); const t = describe(judge(c), c, mt()).join("\n"); assert.match(t, /SHA256:new1/); assert.match(t, /ssh_host_ed25519_key\.pub/); assert.ok(!/undefined/.test(t), lang); }
});

test("beide Ausgabeformen von ssh-keygen werden gelesen (-lf und -F host -l)", () => {
  const a = parseFingerprints("# Host 203.0.113.9 found: line 8 \n203.0.113.9 ED25519 SHA256:old1\n# Host 203.0.113.9 found: line 9 \n203.0.113.9 RSA SHA256:old2");
  assert.deepEqual(a.map((k) => [k.type, k.fp]), [["ED25519", "SHA256:old1"], ["RSA", "SHA256:old2"]]);
});

const blob = Buffer.from("fake-key-blob-1");
const fpOf = (b) => "SHA256:" + createHash("sha256").update(b).digest("base64").replace(/=+$/, "");
const scanOut = `203.0.113.9 ssh-ed25519 ${blob.toString("base64")}\n203.0.113.9 ssh-rsa ${Buffer.from("rsa-blob").toString("base64")}`;

test("exec-Weg: ssh-keyscan stdout+stderr in Node gelesen, Fingerabdruck selbst berechnet, keine Shell", async () => {
  const calls = [];
  const exec = (c, a) => { calls.push([c, a]); if (c === "ssh-keygen") return { out: "203.0.113.9 ED25519 SHA256:old1", err: "", ok: true }; return { out: scanOut, err: "# 203.0.113.9:22 SSH-2.0-OpenSSH_9.6\n", ok: true }; };
  const c = await collect({ exec, there: async () => ({ out: "", ok: false }) }, { host: "203.0.113.9" });
  assert.deepEqual(calls[0], ["ssh-keygen", ["-F", "203.0.113.9", "-l"]]);
  assert.deepEqual(calls[1], ["ssh-keyscan", ["-T", "8", "-t", "ed25519,rsa,ecdsa", "203.0.113.9"]]);
  assert.equal(c.now.banner, "SSH-2.0-OpenSSH_9.6");
  assert.deepEqual(c.now.keys.map((k) => [k.type, k.fp]), [["ED25519", fpOf(blob)], ["RSA", fpOf(Buffer.from("rsa-blob"))]]);
  assert.deepEqual(c.old, [{ bits: 0, fp: "SHA256:old1", type: "ED25519" }]);
  assert.equal(judge(c).level, "hint");
});

test("exec-Weg: feindlicher Host kommt als EIN Argument an, 'collect' lehnt ihn vorher ab, '-' am Anfang wird nie ausgeführt", async () => {
  const calls = [];
  const exec = (c, a) => { calls.push([c, a]); return { out: "", err: "", ok: true }; };
  scanHost(exec, "a;rm -rf x"); storedKeys(exec, "a;rm -rf x");
  assert.ok(calls.length === 2 && calls.every((x) => x[1].includes("a;rm -rf x")));
  assert.ok(calls.every((x) => !x[1].some((p) => p !== "a;rm -rf x" && /[;]/.test(p))));
  calls.length = 0;
  assert.deepEqual(scanHost(exec, "-oProxyCommand=x"), { banner: "", keys: [] });
  assert.deepEqual(storedKeys(exec, "-oProxyCommand=x"), []);
  const c = await collect({ exec, there: async () => ({}) }, { host: "a;rm -rf x" });
  const d = await collect({ exec, there: async () => ({}) }, { host: "-x" });
  assert.ok(c.invalid && d.invalid); assert.equal(calls.length, 0);
});

test("keysFromScan ignoriert Müll", () => { assert.deepEqual(keysFromScan("# x\nfoo bar\n"), []); });
test("geänderter Host-Schlüssel: einmal fragen, dann eine Woche merken (nachgesehen oder nein)", async () => {
  const { mitmMemory } = await import("./hostkey.mjs");
  const now = new Date("2026-10-27T12:00:00Z"), h = "203.0.113.18";
  assert.equal(mitmMemory([], h, now).ask, true);
  assert.equal(mitmMemory([{ kind: "act", what: "hostkey", detail: h, level: "hint", t: "2026-10-26T10:00:00Z" }], h, now).last.level, "hint");
  assert.equal(mitmMemory([{ kind: "act", what: "hostkey_no", detail: h, t: "2026-10-27T08:00:00Z" }], h, now).ask, false);
  assert.equal(mitmMemory([{ kind: "act", what: "hostkey_no", detail: "other.host", t: "2026-10-27T08:00:00Z" }], h, now).ask, true);
  assert.equal(mitmMemory([{ kind: "act", what: "hostkey", detail: h, t: "2026-10-10T08:00:00Z" }], h, now).ask, true);   // older than a week: ask again
});
