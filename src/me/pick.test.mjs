import test from "node:test";
import assert from "node:assert/strict";
import { wantsLocal, wantsServerPick, badTarget, options, choose, pickFlow, pickInLine } from "./pick.mjs";
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
test("Nummer oder Name: auch '3!!', 'die drei', 'der letzte', die Adresse mitten im Satz", () => {
  const opts = options({ servers: [], hints: ["203.0.113.10", "203.0.113.12"] });
  for (const a of ["3!!", "3.", "die drei", "der letzte", "203.0.113.12 halt", "mensch die letzte nummer, die 3", "el último", "the third"]) assert.equal(choose(a, opts).host, "203.0.113.12", a);
  assert.equal(choose("ähm die drei... nein warte, die zwei", opts), null);   // two places in one line: no answer, he asks again
});
test("'mach mal bei dem zweiten', 'nimm db', 'und der andere?' nach der Serverliste", () => {
  const sv = [{ kind: "server", alias: "web", target: "root@203.0.113.10" }, { kind: "server", alias: "db", target: "admin@203.0.113.11" }];
  for (const l of ["ja mach mal bei dem zweiten", "ja mach, aber nur den zweiten, den db", "nimm db", "the last one", "el segundo servidor", "check the second server"]) assert.equal((pickInLine(l, sv) || {}).alias, "db", l);
  assert.equal(pickInLine("und der andere?", sv, "root@203.0.113.10").alias, "db");
  assert.equal(pickInLine("and the other one?", sv, "admin@203.0.113.11").alias, "web");
  for (const l of ["wie mache ich den ersten schritt", "the second finding", "erklär das dritte wort", "hallo", "und der andere?", "was war die erste frage"]) assert.equal(pickInLine(l, sv), null, l);
});
test("aus dem Lab: Fragen über einen Rechner prüfen ihn nicht, 'primero' ohne Artikel ist kein Platz", () => {
  const sv = [{ kind: "server", alias: "web", target: "root@203.0.113.10" }, { kind: "server", alias: "db", target: "admin@203.0.113.11" }];
  for (const l of ["pero cuál es el nombre, el segundo o el último", "vale, revisa este equipo primero, a ver si está limpio", "sorry - i mean: is there any key for the db box or none at all?",
    "so the db box is just unreachable, not missing a key?", "wait, db? i didn't even ask about db yet. is db one of my servers or are you guessing?",
    "und der andere rechner, db – wo liegt der überhaupt, welche ip?", "ähm... ja so halb, und der zweite rechner da, was is mit dem?",
    "no, eso es el mismo otra vez. me refiero a otro, uno que funcione. ¿qué máquinas me has visto?", "perdona, pero no me has contestado lo de root... y ahora esto otro del directorio web? o qué"]) assert.equal(pickInLine(l, sv, "root@203.0.113.10"), null, l);
  for (const [l, a] of [["the first one", "web"], ["no, the last one you showed me, the server thing", "db"], ["das hab ich doch schon gesagt, der zweite! prüfe den zweiten jetzt", "db"],
    ["second means db. check db. go", "db"], ["ok. jetzt web prüfen: offene ports, updates, cves. kurz.", "web"], ["pues apagado o con cortafuegos, vale. mira el otro", "db"]]) assert.equal((pickInLine(l, sv, "root@203.0.113.10") || {}).alias, a, l);
});
