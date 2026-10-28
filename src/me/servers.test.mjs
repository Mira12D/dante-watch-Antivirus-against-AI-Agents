import test from "node:test";
import assert from "node:assert/strict";
import { wantsServerList, wantsHealth, wantsFind, wantsStatus, wantsMore, wantsServersCheck, serversFlow, findFlow } from "./servers.mjs";
import { mt } from "./texts.mjs";
import { setLang } from "../i18n.mjs";
import { historyTargets, knownHosts } from "./recon.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("die Frage nach den eigenen Servern wird in jeder Sprache erkannt", () => {
  for (const l of ["kennst du meine server", "kennst du meien server", "welche server hast du gefunden", "was für server hab ich", "zeig mir meine server", "weißt du welche rechner ich habe",
    "do you know my servers", "which servers did you find", "list my servers",
    "qué servidores conoces", "cuáles son mis servidores", "conoces mis servidores", "muéstrame mis servidores"]) assert.equal(wantsServerList(l, false), true, l);
  for (const l of ["prüfe meinen server", "check my server", "revisa mi servidor", "server root@host", "wie spät ist es", "ist mein server offen"]) assert.equal(wantsServerList(l, false), false, l);
  assert.equal(wantsServerList("kennst du meine server", true), false);
});
test("Gesundheitsfragen zum aktuellen Ziel führen zu einer Prüfung", () => {
  for (const l of ["dieser server in ordnung?", "dieser server gesund?", "ist mein mac sicher", "mein rechner sauber?", "is this server safe", "is my server ok", "este servidor está bien", "mi equipo está seguro"]) assert.equal(wantsHealth(l, false), true, l);
  for (const l of ["kennst du meine server", "wie geht es dir", "ist php sicher", "server root@host sicher?"]) assert.equal(wantsHealth(l, l.includes("@")), false, l);
});
const USER = { servers: [{ alias: "web", target: "root@203.0.113.10", os: "Ubuntu 26.04 · PHP 8.3" }, { alias: "db", target: "admin@203.0.113.11", os: "" }] };
function io(answers, probe) {
  setLang("de"); const said = [], a = [...answers], wrote = [];
  return { said, wrote, mt, say: (l) => said.push(l), dim: (x) => x, ask: async () => a.shift() ?? "", decide: (x) => (/^(ja|yes)$/i.test(x.trim()) ? "yes" : /^(nein|no)$/i.test(x.trim()) ? "no" : "unclear"), probe, writeUser: (u) => wrote.push(JSON.parse(JSON.stringify(u))), diary: () => {} };
}
test("Liste zeigt System und PHP, und markiert, was noch nicht angesehen ist", async () => {
  const x = io(["nein"], async () => ({ ok: true }));
  await serversFlow(x, JSON.parse(JSON.stringify(USER)), []);
  const t = x.said.join("\n");
  assert.match(t, /2 Server/); assert.match(t, /web - root@203\.0\.113\.10 · Ubuntu 26\.04 · PHP 8\.3/); assert.match(t, /db - admin@203\.0\.113\.11 · noch nicht angesehen/);
  assert.equal(x.wrote.length, 0, "ohne Ja schreibt er nichts");
});
test("nach einem Ja klopft er nur bei den unbekannten an und merkt sich das Ergebnis", async () => {
  const seen = [];
  const x = io(["ja"], async (s) => { seen.push(s.alias); return { ok: true, label: "Debian 13", php: "8.4.1" }; });
  const u = JSON.parse(JSON.stringify(USER));
  await serversFlow(x, u, []);
  assert.deepEqual(seen, ["db"]); assert.equal(u.servers[1].os, "Debian 13 · PHP 8.4.1"); assert.equal(x.wrote.length, 1);
});
test("ohne Server: known_hosts-Namen als Hinweis, sonst klare Auskunft", async () => {
  const a = io([], null); await serversFlow(a, { servers: [] }, ["h1.example.com", "h2.example.com"]);
  assert.match(a.said.join("\n"), /known_hosts.*h1\.example\.com/);
  const b = io([], null); await serversFlow(b, { servers: [] }, []);
  assert.match(b.said.join("\n"), /noch keinen Server/);
});

test("'finde meine server' ist eine Handlung, 'welche hast du gefunden' eine Frage", () => {
  for (const l of ["finde meine server", "such mal meine server", "spür meine rechner auf", "find my servers", "discover my machines", "busca mis servidores", "encuentra mis servidores"]) assert.equal(wantsFind(l, false), true, l);
  for (const l of ["welche server hast du gefunden", "which servers did you find", "have you found my servers", "kennst du meine server", "prüfe meinen server"]) assert.equal(wantsFind(l, false), false, l);
});
test("'wie geht's meinen Servern' will einen Überblick über alle", () => {
  for (const l of ["wie geht es meinen servern", "wie geht's meinen servern", "wie läuft es bei meinen servern", "alles ok bei meinen servern", "status meiner server", "how are my servers doing", "cómo están mis servidores"]) assert.equal(wantsStatus(l, false), true, l);
  for (const l of ["kennst du meine server", "finde meine server", "prüfe meinen server", "wie geht es dir"]) assert.equal(wantsStatus(l, false), false, l);
});
test("Finden: Neues aus der ssh-Konfiguration kommt in user.md, mit ausgeschalteter Streife", async () => {
  const x = io(["nein"], async () => ({ ok: true }));
  const u = JSON.parse(JSON.stringify(USER));
  await findFlow(x, u, { hosts: [{ alias: "web", target: "root@203.0.113.10", key: "" }, { alias: "mail", target: "admin@203.0.113.12", key: "~/.ssh/id_ed25519" }], hints: ["old.example.com"] });
  assert.deepEqual(u.servers.map((s) => s.alias), ["web", "db", "mail"]);
  const mail = u.servers[2]; assert.equal(mail.patrol, false); assert.equal(mail.os, "");
  const t = x.said.join("\n");
  assert.match(t, /\(2 Einträge\) und deine known_hosts \(1 lesbare/); assert.match(t, /Neu eingetragen \(Streife aus\): mail/);
});
test("Finden: nichts Neues wird so gesagt", async () => {
  const x = io(["nein"], async () => ({ ok: true }));
  await findFlow(x, JSON.parse(JSON.stringify(USER)), { hosts: [{ alias: "web", target: "root@203.0.113.10", key: "" }], hints: [] });
  assert.match(x.said.join("\n"), /nichts Neues/);
});

function homeWith(files) {
  const h = mkdtempSync(join(tmpdir(), "dante-hist-")); mkdirSync(join(h, ".ssh"));
  for (const [f, c] of Object.entries(files)) writeFileSync(join(h, f), c);
  return h;
}
test("Verlauf: nur Ziele und Schlüsselname, das häufigste zuerst, kein Code-Hosting, nichts anderes", () => {
  const h = homeWith({ ".zsh_history": [
    ": 1761400000:0;ssh -i /HOME/.ssh/k1 root@203.0.113.10", ": 1761400001:0;ssh root@203.0.113.10 'cat /etc/secret_file'", ": 1761400002:0;ssh root@203.0.113.10",
    ": 1761400003:0;scp ./a.txt deploy@web.example.com:/srv/", ": 1761400004:0;git clone git@github.com:owner/repo.git", ": 1761400005:0;ssh git@github.com", ": 1761400006:0;echo password=hunter2 root@203.0.113.99",
    "ssh admin@[2001:db8::5]", ": 1761400007:0;ls -la" ].join("\n").replace(/\/HOME/g, "") });
  const r = historyTargets(h);
  assert.deepEqual(r.map((x) => [x.target, x.count]), [["root@203.0.113.10", 3], ["deploy@web.example.com", 1], ["admin@2001:db8::5", 1]]);
  assert.equal(r[0].key, "/.ssh/k1");
  assert.ok(!JSON.stringify(r).includes("hunter2") && !JSON.stringify(r).includes("secret_file"), "nichts aus dem Rest der Zeile");
  rmSync(h, { recursive: true, force: true });
});
test("known_hosts: Code-Hosting ist kein Server, und keine frühe Kürzung auf 10", () => {
  const lines = ["github.com ssh-ed25519 AAAA", ...Array.from({ length: 25 }, (_, i) => `203.0.113.${i + 1} ssh-ed25519 AAAA`), "|1|abc=|def= ssh-rsa AAAA"].join("\n");
  const h = homeWith({ ".ssh/known_hosts": lines });
  const r = knownHosts(h);
  assert.equal(r.length, 25); assert.ok(!r.includes("github.com")); assert.ok(r.includes("203.0.113.25"));
  rmSync(h, { recursive: true, force: true });
});
test("Finden: erst nach einem Ja liest er den Verlauf, trägt Ziele mit Schlüssel ein und lässt die Streife aus", async () => {
  let read = 0;
  const x = io(["ja", "ja", "nein"], async () => ({ ok: true }));
  const u = { servers: [] };
  await findFlow(x, u, { hosts: [], hints: ["203.0.113.10", "198.51.100.7"], readHistory: async () => { read++; return [{ target: "root@203.0.113.10", host: "203.0.113.10", user: "root", key: "~/.ssh/k1", count: 74 }, { target: "root@203.0.113.20", host: "203.0.113.20", user: "root", key: "", count: 5 }]; } });
  assert.equal(read, 1);
  assert.deepEqual(u.servers.map((s) => [s.target, s.key, s.patrol]), [["root@203.0.113.10", "~/.ssh/k1", false], ["root@203.0.113.20", "", false]]);
  const t = x.said.join("\n");
  assert.match(t, /root@203\.0\.113\.10 - 74-mal · Schlüssel ~\/\.ssh\/k1/);
  assert.ok(!/198\.51\.100\.7.*Fest eingetragen/.test(t));
});
test("Finden: ohne Ja bleibt der Verlauf ungelesen", async () => {
  let read = 0;
  const x = io(["nein"], async () => ({ ok: true }));
  await findFlow(x, { servers: [] }, { hosts: [], hints: [], readHistory: async () => { read++; return []; } });
  assert.equal(read, 0);
});

test("'welche server habe ich' fragt nach der Liste, 'welcher server ist das' nach dem System", async () => {
  const { wantsSysInfo } = await import("./sysq.mjs");
  for (const l of ["welche server habe ich", "welche server hab ich", "which servers do i have", "cuáles son mis servidores", "qué servidores tengo"]) { assert.equal(wantsServerList(l, false), true, l); assert.equal(wantsSysInfo(l, false), false, l); }
  for (const l of ["welcher server ist das", "was für ein server ist das", "what kind of server is this"]) { assert.equal(wantsServerList(l, false), false, l); assert.equal(wantsSysInfo(l, false), true, l); }
});
test("Nachfragen zur Liste: 'welche noch?', 'und die anderen?', 'which others?'", () => {
  for (const l of ["welche noch ?", "und die anderen?", "noch mehr?", "weitere?", "which others?", "any more?", "and the others", "y los otros", "algo más"]) assert.equal(wantsMore(l), true, l);
  for (const l of ["welche server habe ich", "prüfe meinen server", "wie geht es dir", "ich möchte noch mehr über webshells erfahren und wie sie funktionieren"]) assert.equal(wantsMore(l), false, l);
});
test("'mehr' zeigt alle Hosts statt der ersten acht", async () => {
  const hints = Array.from({ length: 12 }, (_, i) => `h${i}.example.com`);
  const a = io([], null); await serversFlow(a, { servers: [] }, hints); assert.match(a.said.join(" "), /\(\+4\)/);
  const b = io([], null); await serversFlow(b, { servers: [] }, hints, { all: true }); assert.ok(b.said.join(" ").includes("h11.example.com") && !/\(\+/.test(b.said.join(" ")));
});

test("'sind meine server sicher gecheckt?' prüft ALLE bekannten Server, nie nur den lokalen Rechner", () => {
  for (const l of ["sind meine server sicher gecheckt?", "super sind meine server sicher gecheckt?", "check all my servers", "are my servers safe", "están seguros mis servidores", "prüf alle meine server", "sind alle meine server ok"]) { assert.equal(wantsServersCheck(l, false), true, l); assert.equal(wantsHealth(l, false), false, "keine Gesundheitsfrage zum aktuellen Ziel: " + l); }
  for (const l of ["dieser server in ordnung?", "is my mac safe", "prüfe meinen server", "kennst du meine server", "finde meine server", "welche server habe ich"]) assert.equal(wantsServersCheck(l, false), false, l);
});

test("Footer-Tipp und Alterszeile sagen 'update', in jeder Sprache", async () => {
  const { tipAt, OLD } = await import("../ticker.mjs");
  const all = (lang) => Array.from({ length: 12 }, (_, i) => tipAt(i, lang)).join("\n");
  assert.match(all("de"), /Sag „update“/); assert.match(all("en"), /Say “update”/); assert.match(all("es"), /Di «actualiza»/);
  for (const l of ["de", "en", "es"]) { assert.match(OLD[l](20), /update|actualiza/); assert.ok(!/npx dante-watch@latest/.test(OLD[l](20))); }
});
test("'wie gehts bro' ist eine Begrüßung, kein Blick auf alle Server", async () => {
  const { namesMachines } = await import("./servers.mjs");
  for (const l of ["wie gehts bro", "wie gehts", "na wie läuft", "how are you bro", "qué tal bro", "alles klar?"]) assert.equal(namesMachines(l), false, l);
  for (const l of ["wie gehts meinen servern", "wie läuft die kiste", "how are my servers", "cómo están mis servidores", "alles ok bei allen?"]) assert.equal(namesMachines(l), true, l);
});
