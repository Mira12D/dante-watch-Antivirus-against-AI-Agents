import test from "node:test";
import assert from "node:assert/strict";
import { wantsLocal, wantsServerPick, badTarget, options, choose, pickFlow } from "./pick.mjs";
import { pool } from "./pool.mjs";
import { mt } from "./texts.mjs";
import { setLang } from "../i18n.mjs";

test("mein Mac ist dieser Rechner — auch mit Tippfehlern und ohne Verb", () => {
  for (const l of ["überprüfe meinen mac", "schau meinen mac an", "Meinen mac ?", "check my macbook", "revisa mi ordenador", "pürf meinen laptop", "scan my machine"]) assert.equal(wantsLocal(l, false), true, l);
  assert.equal(wantsLocal("überprüfe meinen mac", true), false);       // a target in the line means something else
  for (const l of ["prüfe meinen server", "wie geht es dir", "was ist php2shell"]) assert.equal(wantsLocal(l, false), false, l);
});
test("'mein server' ohne Adresse wird aus dem Wissen beantwortet", () => {
  for (const l of ["prüfe meinen server", "pürfe meinen server", "meinen server", "check my server", "revisa mi servidor"]) assert.equal(wantsServerPick(l, false), true, l);
  assert.equal(wantsServerPick("prüfe server root@host", true), false);
  assert.equal(wantsServerPick("prüfe meinen mac server", false), false);
});
test("Platzhalter und Unsinn sind kein Ziel", () => {
  for (const b of ["", "ziel", "<ziel>", "ziel shh", "target", "-oProxyCommand=x", "a b c"]) assert.equal(badTarget(b), true, b);
  for (const g of ["root@host", "my-server.example.com", "10.0.0.5", "ubuntu@1.2.3.4"]) assert.equal(badTarget(g), false, g);
});
const SERVERS = Array.from({ length: 40 }, (_, i) => ({ alias: `web-${String(i).padStart(2, "0")}`, target: `root@10.0.0.${i}`, key: null, os: "Ubuntu" }));
test("Auswahl: Nummer, Name, 'alle', Teil des Namens (mehrere → eingrenzen)", () => {
  const o = options({ servers: SERVERS });
  assert.equal(o[0].kind, "local"); assert.equal(o[1].kind, "all"); assert.equal(o[1].count, 40);
  assert.equal(choose("1", o).kind, "local"); assert.equal(choose("mac", o).kind, "local"); assert.equal(choose("alle", o).kind, "all");
  assert.equal(choose("web-07", o).alias, "web-07");
  const many = choose("web-1", o); assert.equal(many.kind, "many"); assert.equal(many.list.length, 10);
  assert.equal(choose("gibtesnicht", o), null); assert.equal(choose("", o), null);
});
test("ohne bekannte Server werden Hosts aus known_hosts angeboten, nur als Namen", () => {
  const o = options({ servers: [], hints: ["a.example.com", "b.example.com"] });
  assert.deepEqual(o.map((x) => x.kind), ["local", "hint", "hint"]);
});
test("Ablauf: 40 Server, der Mensch grenzt ein und wählt", async () => {
  setLang("de");
  const said = [], answers = ["web-3", "web-31"];
  const io = { mt, say: (l) => said.push(l), askFree: async () => answers.shift() };
  const o = await pickFlow(io, options({ servers: SERVERS }));
  assert.equal(o.kind, "server"); assert.equal(o.alias, "web-31");
  assert.ok(said.some((l) => /weitere/.test(l)), "bei vielen Zielen wird die Liste gekürzt");
  assert.ok(said.some((l) => /passen/.test(l)), "und nach dem Teil des Namens eingegrenzt");
});
test("Ablauf: Hinweis-Host fragt nach dem Benutzer, bevor irgendetwas verbindet", async () => {
  setLang("de");
  const answers = ["2", "deploy"];
  const io = { mt, say: () => {}, askFree: async () => answers.shift() };
  const o = await pickFlow(io, options({ servers: [], hints: ["h.example.com"] }));
  assert.equal(o.target, "deploy@h.example.com");
});
test("Pool: höchstens N gleichzeitig, ein Fehler stoppt die anderen nicht", async () => {
  let now = 0, peak = 0;
  const res = await pool(Array.from({ length: 50 }, (_, i) => i), async (i) => { now++; peak = Math.max(peak, now); await new Promise((r) => setTimeout(r, 5)); now--; if (i === 7) throw new Error("tot"); return i; }, 6);
  assert.ok(peak <= 6, "peak " + peak); assert.equal(res.length, 50);
  assert.equal(res[7].ok, false); assert.equal(res.filter((r) => r.ok).length, 49);
});
