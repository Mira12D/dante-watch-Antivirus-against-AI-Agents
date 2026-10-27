import test from "node:test";
import assert from "node:assert/strict";
import { onboard, armFlow, disarmFlow, confirm, nextRun } from "./onboard.mjs";
import { mt } from "./texts.mjs";
import { setLang } from "../i18n.mjs";

// A scripted conversation: the answers are given in order; everything Dante says is collected.
function scene({ answers = [], free = [], facts, probe = () => ({ ok: true, label: "Ubuntu 26.04", php: "" }), install = () => ({ ok: true }), armed = false, lang = "de" } = {}) {
  setLang(lang);
  const out = { says: [], asked: [], user: null, diary: [], installed: 0, removed: 0 };
  const a = [...answers], fr = [...free];
  const YES = /^(ja|yes|sí|si|y|j|ok|klar)$/i, NO = /^(nein|no|n|nö)$/i, WHAT = /^(was\?|what\?|qué\?)$/i;
  return { out, io: {
    mt, say: (l) => out.says.push(l), dim: (x) => x, lang: () => lang, today: () => "2026-10-26", now: () => new Date(2026, 9, 26, 7, 30),
    ask: async (q) => { out.asked.push(q); return a.shift() ?? ""; }, askFree: async (q) => { out.asked.push(q); return fr.shift() ?? ""; },
    decide: (x) => (YES.test(x.trim()) ? "yes" : NO.test(x.trim()) ? "no" : WHAT.test(x.trim()) ? "what" : "unclear"),
    look: async () => facts || { name: "Test Person", nameSource: "git", system: "macOS 26 (arm64)", hosts: [{ alias: "kueche", target: "root@203.0.113.10", key: "~/.ssh/k" }, { alias: "kasse", target: "deploy@203.0.113.20", key: "" }], hints: ["h1"], projects: ["alpha", "beta"], tools: [] },
    probe: async (s) => probe(s), writeUser: (u) => { out.user = JSON.parse(JSON.stringify(u)); }, userPath: () => "~/.dante/user.md",
    diary: (e) => out.diary.push(e.what), plan: () => ({ kind: "launchd", file: "/Users/u/Library/LaunchAgents/x.plist" }),
    install: (p) => { out.installed++; return install(p); }, remove: () => { out.removed++; }, isArmed: () => armed,
  } };
}
const said = (o) => o.says.join("\n");

test("erstes Treffen: EINE Frage, dann nur Aussagen - user.md steht, nichts angeklopft, nichts eingetragen", async () => {
  let probed = 0;
  const { io, out } = scene({ answers: ["ja"], probe: () => { probed++; return { ok: true }; } });
  const r = await onboard(io);
  assert.equal(r.armed, false); assert.equal(probed, 0); assert.equal(out.installed, 0); assert.equal(out.asked.length, 1);
  assert.match(said(out), /hier bin ich gelandet/); assert.match(said(out), /macOS 26/); assert.match(said(out), /kueche, kasse/); assert.match(said(out), /alpha, beta/);
  assert.match(said(out), /Ich nenne dich Test Person/); assert.match(said(out), /welche Server habe ich/);
  assert.deepEqual(out.user.servers.map((s) => [s.alias, s.os, s.patrol]), [["kueche", "", false], ["kasse", "", false]]);
  assert.equal(out.user.patrol.armed, false); assert.deepEqual(out.diary, ["look"]);
});
test("Nein zum Umschauen: nichts gelesen, nichts geschrieben, kein Zeitplan", async () => {
  const { io, out } = scene({ answers: ["nein"] });
  assert.deepEqual(await onboard(io), { declined: true });
  assert.equal(out.user, null); assert.equal(out.installed, 0); assert.deepEqual(out.diary, []); assert.match(said(out), /umschauen/);
});
test("'Was machst du da?' bekommt eine Erklärung, beim zweiten Mal nur die Kurzfassung", async () => {
  const { io, out } = scene({ answers: ["was?", "was?", "ja"] });
  await onboard(io);
  assert.match(said(out), /Inhalte lese ich nicht, und ich sende nichts/); assert.match(said(out), /Kurz: „ja“ = ich mache es/);
  assert.equal(said(out).split("Inhalte lese ich nicht").length - 1, 1, "die lange Erklärung nur einmal");
});
test("Unverständliches wird nachgefragt und zählt dann als Nein - nie als Ja", async () => {
  assert.equal(await confirm(scene({ answers: ["hm", "vielleicht", "mal sehen"] }).io, "Frage?"), false);
  const { io, out } = scene({ answers: ["hm", "ja"] });
  assert.equal(await confirm(io, "Frage?"), true); assert.match(said(out), /„j“ für ja oder „n“ für nein/);
});
test("eine neue Bitte statt einer Antwort: die Frage fällt weg, die Zeile wird die nächste Eingabe, kein 'ohne Gedächtnis'", async () => {
  const { io, out } = scene({ answers: ["wie viel ram hat dieser rechner eigentlich und läuft was"] });
  io.queue = []; io.decide = async (x) => (/ram/.test(x) ? "other" : "yes");
  const r = await onboard(io);
  assert.deepEqual(r, { declined: true }); assert.deepEqual(io.queue, ["wie viel ram hat dieser rechner eigentlich und läuft was"]);
  assert.ok(!/ohne Gedächtnis/.test(said(out)));
});
test("kein Name bekannt: es wird nichts erfunden", async () => {
  const { io, out } = scene({ answers: ["ja"], facts: { name: "", system: "macOS", hosts: [], hints: [], projects: [] } });
  await onboard(io); assert.ok(!/Ich nenne dich/.test(said(out))); assert.equal(out.user.name, "");
});
test("Scharfschalten bleibt ein eigener Befehl: Ja trägt ein, Nein nicht, ein Fehler wird genannt", async () => {
  let s = scene({ answers: ["ja", "ja"] }); const u = { servers: [{ alias: "kueche", patrol: true }], patrol: {} };
  assert.equal(await armFlow(s.io, u), true); assert.equal(s.out.installed, 1);
  s = scene({ answers: ["nein"] }); assert.equal(await armFlow(s.io, { servers: [], patrol: {} }), false); assert.equal(s.out.installed, 0); assert.match(said(s.out), /Sag „scharf“/);
  s = scene({ answers: ["ja", "ja"], install: () => ({ ok: false, why: "launchctl: nicht erlaubt" }) }); assert.equal(await armFlow(s.io, { servers: [], patrol: {} }), false); assert.match(said(s.out), /nicht erlaubt.*nichts eingetragen/);
});
test("schon scharf: nichts wird noch einmal eingetragen; Abschalten nimmt ihn raus", async () => {
  let s = scene({ armed: true }); assert.equal(await armFlow(s.io, { servers: [], patrol: {} }), true); assert.equal(s.out.installed, 0); assert.match(said(s.out), /schon scharf/);
  assert.equal(s.out.user.patrol.armed, true);   // a second look around must not unset it in user.md
  s = scene({ armed: true }); const u = { servers: [], patrol: { armed: true, times: ["00:00"], since: "x" } };
  assert.equal(await disarmFlow(s.io, u), true); assert.equal(s.out.removed, 1); assert.equal(s.out.user.patrol.armed, false); assert.deepEqual(s.out.diary, ["disarm"]);
  s = scene({ armed: false }); assert.equal(await disarmFlow(s.io, u), false); assert.match(said(s.out), /nicht scharf/);
});
test("in allen drei Sprachen: dieselbe Geschichte, jeweils in der Sprache des Menschen", async () => {
  for (const [lang, landed, hint] of [["de", /gelandet/, /welche Server habe ich/], ["en", /landed/, /which servers do I have/], ["es", /aterrizado/, /qué servidores tengo/]]) {
    const { io, out } = scene({ answers: ["ja"], lang }); await onboard(io);
    assert.match(said(out), landed); assert.match(said(out), hint); assert.equal(out.asked.length, 1);
  }
  setLang("de");
});
test("nächster Lauf: vor 06:00 heute 06:00, nach 18:00 morgen 00:00", () => {
  assert.deepEqual(nextRun(new Date(2026, 9, 26, 3, 0)), { when: "today", time: "06:00" });
  assert.deepEqual(nextRun(new Date(2026, 9, 26, 18, 0, 1)), { when: "tomorrow", time: "00:00" });
});
