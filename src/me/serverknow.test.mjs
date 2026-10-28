// 0.1.25: Dante recognises and labels the person's servers. What he SAW (facts, with the day), what the PERSON called it (their words),
// the key (checked or not) - three sources, never merged. Nothing is guessed from services ("nginx + Postgres" is not "the till").
import test from "node:test";
import assert from "node:assert/strict";
import { parseOverview, facts, whatRuns } from "./overview.mjs";
import { serverLine, parseServerLine, parse, serialize } from "./user.mjs";
import { describe, serverIn, serverAbout, serverRole, aboutLines } from "./servers.mjs";
import { saidKeyPath, assignKeyFlow } from "./keys.mjs";
import { mt } from "./texts.mjs";
import { setLang } from "../i18n.mjs";

const OUT = `OS=Debian GNU/Linux 12 (bookworm)
ID=debian
KERNEL=Linux 6.1.0
ARCH=x86_64
PHP=PHP 8.2.7 (cli)
WEB=nginx 
PORTS=22,80,443,5432
SVC=nginx,postgresql,fail2ban
DOCKER=redis,app
SITES=default,shop.example.com
DB=PostgreSQL 15.5
MEM=4GB
DISK=80G / 41%
UP=3 days`;

test("1 Überblick: Dienste, Ports, Docker, Seiten, Datenbank werden gelesen und nichts davon ist eine Rolle", () => {
  const kv = parseOverview(OUT), f = facts(kv);
  assert.deepEqual(f.ports, ["22", "80", "443", "5432"]);
  assert.deepEqual(f.docker, ["redis", "app"]);
  assert.deepEqual(f.sites, ["default", "shop.example.com"]);
  assert.deepEqual(f.db, ["PostgreSQL 15.5"]);
  for (const lang of ["de", "en", "es"]) {
    const w = whatRuns(kv, lang);
    assert.match(w, /nginx/); assert.match(w, /PostgreSQL 15\.5/);
    assert.doesNotMatch(w, /kasse|till|caja|shop-server|payment/i, "aus Diensten wird keine Rolle");
  }
});

test("3 Gedächtnis: Rolle (deine Worte), Gesehenes (mit Tag) und geprüfter Schlüssel überleben user.md, getrennt", () => {
  const s = { alias: "Stranger-Chat", target: "root@203.0.113.54", key: "~/.ssh/deploy_key", os: "Debian 12", patrol: false, role: "Kasse", what: "nginx, PostgreSQL 15.5", seen: "2026-10-28", keyChecked: true };
  const line = serverLine(s);
  assert.match(line, /rolle: Kasse \(du\)/); assert.match(line, /gesehen: nginx, PostgreSQL 15\.5 \(2026-10-28\)/); assert.match(line, /schlüssel: geprüft/);
  const back = parse(serialize({ servers: [s] })).servers[0];
  assert.equal(back.role, "Kasse"); assert.equal(back.what, "nginx, PostgreSQL 15.5"); assert.equal(back.seen, "2026-10-28"); assert.equal(back.keyChecked, true);
  assert.equal(back.os, "Debian 12"); assert.equal(back.key, "~/.ssh/deploy_key");
  const parsed = parseServerLine("x", "root@h · key - · Ubuntu 26.04 · patrouille: nein");
  assert.equal(parsed.role, undefined); assert.equal(parsed.what, undefined, "ein alter Eintrag ohne die neuen Felder bleibt heil");
  setLang("de");
  const d = describe(s, mt());
  assert.match(d, /Kasse \(deine Worte\)/); assert.match(d, /nginx, PostgreSQL 15\.5 \(gesehen 2026-10-28\)/);
  assert.match(describe({ alias: "a", target: "t" }, mt()), /noch nicht angesehen/);
});

const SV = [{ alias: "web", target: "root@203.0.113.10", os: "Ubuntu 26.04", what: "nginx, PHP", seen: "2026-10-28", role: "Shop" }, { alias: "db", target: "admin@203.0.113.11", os: "Debian 12" }, { alias: "mail", target: "root@203.0.113.12" }];

test("5 'was ist der zweite' geht an DEINE Server (DE/EN/ES) und antwortet aus Rolle und Gesehenem", () => {
  for (const [l, want] of [["was ist der zweite", "db"], ["was ist der erste?", "web"], ["was läuft auf dem letzten", "mail"], ["what is the second one", "db"], ["what is db", "db"], ["what is the last one", "mail"], ["qué es el segundo", "db"], ["qué es el primero", "web"], ["para qué es mail", "mail"]])
    assert.equal(serverAbout(l, SV)?.alias, want, l);
  // ohne Bezug auf einen Server bleibt die Frage beim Rechner selbst
  for (const l of ["welcher server ist das", "was für ein server ist das", "what kind of server is this", "was ist ein server", "prüf den zweiten", "check the second one"]) assert.equal(serverAbout(l, SV), null, l);
  setLang("de");
  const a = aboutLines(SV[0], mt()).join("\n");
  assert.match(a, /Du nennst ihn: Shop \(deine Worte\)/); assert.match(a, /Da läuft: nginx, PHP \(gesehen 2026-10-28\)/);
  const b = aboutLines(SV[1], mt()).join("\n");
  assert.match(b, /nicht gesagt/); assert.match(b, /noch nichts/);
  setLang("en"); assert.match(aboutLines(SV[0], mt()).join("\n"), /You call it: Shop \(your words\)/);
  setLang("es"); assert.match(aboutLines(SV[0], mt()).join("\n"), /Tú lo llamas: Shop/);
});

test("5 Rolle merken: 'der zweite ist die Kasse' - nur deine Worte, keine Fragen und keine Zustände", () => {
  for (const [l, srv, role] of [["der zweite ist die kasse", "db", "kasse"], ["db ist meine datenbank", "db", "datenbank"], ["the last one is the mailserver", "mail", "mailserver"], ["web is the shop", "web", "shop"], ["el segundo es la caja", "db", "caja"]]) {
    const r = serverRole(l, SV); assert.equal(r?.server.alias, srv, l); assert.equal(r.role.toLowerCase(), role, l);
  }
  for (const l of ["der zweite ist offline", "web is down", "ist der zweite die kasse?", "was ist der zweite", "mein rechner ist die kasse", "the second one is ok"]) assert.equal(serverRole(l, SV), null, l);
});

test("serverIn: Ort mit Artikel oder Alias, sonst nichts", () => {
  assert.equal(serverIn("der dritte", SV).alias, "mail"); assert.equal(serverIn("zweite", SV), null, "ohne Artikel kein Ort");
  assert.equal(serverIn("der fünfte", SV), null, "es gibt keinen fünften");
});

test("4 Schlüssel-Gegenprobe: erst ein Login-Versuch, geprüft nur wenn er klappt; ein kaputter Schlüssel ersetzt nichts", async () => {
  assert.equal(saidKeyPath("nimm ~/.ssh/deploy_key für den zweiten"), "~/.ssh/deploy_key");
  assert.equal(saidKeyPath("use ~/.ssh/k1 for db."), "~/.ssh/k1");
  assert.equal(saidKeyPath("nimm den schlüssel"), "");
  for (const lang of ["de", "en", "es"]) {
    setLang(lang);
    for (const good of [true, false]) {
      const say = [], u = { servers: [{ alias: "db", target: "admin@h", key: "~/.ssh/old", keyChecked: true }] };
      let wrote = 0;
      await assignKeyFlow({ mt, say: (l) => say.push(l), today: () => "2026-10-28", writeUser: () => wrote++, diary: () => {},
        tryKey: async () => (good ? { ok: true } : { ok: false, why: "denied", line: "Permission denied (publickey)" }) }, u, "~/.ssh/new", async () => u.servers[0]);
      if (good) { assert.equal(u.servers[0].key, "~/.ssh/new"); assert.equal(u.servers[0].keyChecked, true); }
      else { assert.equal(u.servers[0].key, "~/.ssh/old", "der alte, funktionierende Eintrag bleibt"); assert.equal(u.servers[0].keyChecked, true); assert.match(say.join(" "), /NOT|NICHT|NO /); }
      assert.equal(wrote, 1);
    }
  }
});

test("Gesprächsfaden: 'was sind diese server?' bezieht sich auf die Liste davor (DE/EN/ES), nicht auf Lücken oder Hilfe", async () => {
  const { wantsThese } = await import("./servers.mjs");
  for (const l of ["was sind diese server ?", "was sind die server?", "what are these servers", "what are those machines?", "qué son estos servidores", "¿qué son esos equipos?"]) assert.equal(wantsThese(l), true, l);
  for (const l of ["was ist die lücke", "was ist ein server", "check these servers", "prüfe diese server", "welche server habe ich", "what is a server", "wie geht es dir"]) assert.equal(wantsThese(l), false, l);
  for (const lang of ["de", "en", "es"]) { setLang(lang); assert.match(mt().srvThese, /known_hosts/); }
});

test("'was können die?' nach einer Serverliste fragt nach den Servern (auch mit Tippfehler), 'mach du es' übernimmt den offenen Schritt", async () => {
  const { wantsThese } = await import("./servers.mjs");
  const { wantsHostKeyFix } = await import("./hostkey.mjs");
  for (const l of ["was können die?", "was könenn die?", "was kann der?", "what can they do", "what can these do?", "qué pueden esos", "qué pueden hacer"]) assert.equal(wantsThese(l), true, l);
  for (const l of ["was kann ich tun", "was kannst du", "what can you do", "was ist die lücke", "was können wir tun", "help"]) assert.equal(wantsThese(l), false, l);
  for (const l of ["mach du es", "mach das", "mach es", "do it", "you do it", "hazlo tú", "hazlo", "entferne den alten eintrag", "remove the old entry"]) assert.equal(wantsHostKeyFix(l), true, l);
  for (const l of ["wer bist du", "mach den check", "ist jemand dazwischen", "was ist der zweite", "mach du es nicht?", "prüf meinen server"]) assert.equal(wantsHostKeyFix(l), false, l);
  for (const lang of ["de", "en", "es"]) { setLang(lang); const t = mt(); assert.ok(t.hkFixPlan("h").join(" ").includes("ssh-keygen -R h")); assert.ok(t.fleetWork(3).includes("3")); assert.ok(t.srvCanDo.length); }
});

test("'per SSH auf meinen Server' ohne Ziel fällt NIE auf diesen Rechner zurück (DE/EN/ES): Dante fragt, welchen Server", async () => {
  const { wantsRemote } = await import("./servers.mjs");
  for (const l of ["Verbind dich mal per SSH mit dem Server und schau, ob alles ok ist.", "Kannst du auf meinem Webserver per SSH nachsehen, ob da was komisch läuft?", "ssh auf meinen vps und nachsehen", "Check if my staging server still lets me in over SSH.", "Can you SSH into my VPS and tell me if anyone has been poking around?", "log into my production server over ssh and look around", "quiero que entres por ssh a mi vps y revises", "mira mi servidor de staging por ssh"]) assert.equal(wantsRemote(l, false), true, l);
  for (const l of ["wer hat noch einen ssh key", "finde meine server per ssh config", "was ist ssh", "prüf meinen server", "check my computer", "which servers do i have", "wie geht es meinen servern", "ist jemand dazwischen", "ssh-keygen -R host", "welche server habe ich", "hi"]) assert.equal(wantsRemote(l, false), false, l);
  assert.equal(wantsRemote("per ssh auf root@203.0.113.7 nachsehen", true), false, "mit Ziel ist es ein normaler Serverauftrag");
  for (const lang of ["de", "en", "es"]) { setLang(lang); assert.ok(mt().needServer.includes("server") || mt().needServer.includes("servidor")); assert.ok(mt().needServerWhich.length > 10); }
});
