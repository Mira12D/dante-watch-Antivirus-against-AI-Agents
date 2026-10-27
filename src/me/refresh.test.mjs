import test from "node:test";
import assert from "node:assert/strict";
import { due, ageDays, compare, refreshFlow, clockFlow, REFRESH_DAYS } from "./refresh.mjs";
import { mt } from "./texts.mjs";
import { setLang } from "../i18n.mjs";

const mkUser = (o = {}) => ({ name: "Alex", created: "2026-10-01", updated: "2026-10-01", system: "macOS 26 (arm64)", servers: [{ alias: "kueche", target: "root@203.0.113.10", key: "~/.ssh/k", os: "Ubuntu 26.04", patrol: true }], projects: ["alpha"], patrol: { armed: true, times: ["00:00"], since: "2026-10-01" }, ...o });
const facts = (o = {}) => ({ name: "x", system: "macOS 26 (arm64)", hosts: [{ alias: "kueche", target: "root@203.0.113.10", key: "~/.ssh/k" }], hints: [], projects: ["alpha"], tools: [], ...o });
function scene({ look, answers = [], probe = () => ({ ok: true, label: "Debian 12", php: "" }), lang = "de" } = {}) {
  setLang(lang);
  const out = { says: [], asked: [], user: null, diary: [] }, a = [...answers];
  return { out, io: {
    mt, say: (l) => out.says.push(l), today: () => "2026-10-26", lang: () => lang,
    ask: async (q) => { out.asked.push(q); return a.shift() ?? ""; },
    decide: (x) => (/^(ja|yes|sí)$/i.test(x.trim()) ? "yes" : /^(nein|no)$/i.test(x.trim()) ? "no" : "unclear"),
    look: async () => look, probe: async (s) => probe(s), writeUser: (u) => { out.user = JSON.parse(JSON.stringify(u)); }, diary: (e) => out.diary.push(e.what + ":" + (e.detail || "")),
  } };
}
const said = (o) => o.says.join("\n");

test("die Uhr: frisch bis 19 Tage, ab 20 fällig; ohne Datum zählt der Tag des Anlegens", () => {
  const u = mkUser();
  assert.equal(REFRESH_DAYS, 20);
  assert.equal(due(u, "2026-10-20"), false);   // 19 days
  assert.equal(due(u, "2026-10-21"), true);    // 20 days
  assert.equal(due(mkUser({ updated: undefined }), "2026-10-25"), true);   // counted from "angelegt"
  assert.equal(due({ servers: [], projects: [] }, "2026-10-26"), false);   // no date at all: nothing to count from
  assert.equal(ageDays(u, "2026-10-26"), 25);
});
test("nach einem Nein fragt er nicht wieder, bevor drei Tage um sind", () => {
  const u = mkUser({ reminded: "2026-10-26" });
  assert.equal(due(u, "2026-10-27"), false); assert.equal(due(u, "2026-10-28"), false); assert.equal(due(u, "2026-10-29"), true);
});
test("Vergleich: neue Server und Projekte, geändertes System; Bekanntes zählt nicht", () => {
  const d = compare(mkUser(), facts({ hosts: [{ alias: "kueche" }, { alias: "neu", target: "u@h" }], projects: ["alpha", "beta"], system: "macOS 27 (arm64)" }));
  assert.deepEqual(d.hosts.map((h) => h.alias), ["neu"]); assert.deepEqual(d.projects, ["beta"]); assert.equal(d.systemChanged, true);
  const same = compare(mkUser(), facts()); assert.deepEqual([same.hosts, same.projects, same.systemChanged], [[], [], false]);
});
test("Auffrischen: Eigenes bleibt (Patrouille-Schalter, Notizen), Neues kommt dazu, Datum wird gestellt", async () => {
  const { io, out } = scene({ look: facts({ hosts: [{ alias: "kueche", target: "root@203.0.113.10", key: "~/.ssh/k" }, { alias: "neu", target: "u@203.0.113.50", key: "" }], projects: ["alpha", "beta"] }), answers: ["ja"] });
  const user = mkUser(); await refreshFlow(io, user);
  assert.deepEqual(out.user.servers.map((s) => [s.alias, s.patrol, s.os]), [["kueche", true, "Ubuntu 26.04"], ["neu", true, "Debian 12"]]);
  assert.deepEqual(out.user.projects, ["alpha", "beta"]); assert.equal(out.user.updated, "2026-10-26"); assert.equal(out.user.patrol.armed, true);
  assert.deepEqual(out.diary, ["look:update"]); assert.match(said(out), /Neue Server.*neu/); assert.match(said(out), /Neue Projekte: beta/);
});
test("ohne Ja zum Anklopfen: der neue Server steht in der Datei, aber nicht in der Patrouille — und es wird nirgends angeklopft", async () => {
  let knocked = 0; const { io, out } = scene({ look: facts({ hosts: [{ alias: "kueche", target: "root@203.0.113.10", key: "" }, { alias: "neu", target: "u@h", key: "" }] }), answers: ["nein"], probe: () => { knocked++; return { ok: true }; } });
  await refreshFlow(io, mkUser());
  assert.equal(knocked, 0); assert.deepEqual(out.user.servers.map((s) => [s.alias, s.patrol]), [["kueche", true], ["neu", false]]);
});
test("nichts Neues: er sagt es und stellt trotzdem die Uhr", async () => {
  const { io, out } = scene({ look: facts() });
  await refreshFlow(io, mkUser());
  assert.match(said(out), /Nichts Neues auf diesem Rechner/); assert.equal(out.user.updated, "2026-10-26"); assert.deepEqual(out.asked, []);
});
test("die Uhr beim Start: nicht fällig → keine Frage; fällig + Ja → auffrischen; fällig + Nein → merkt sich den Tag", async () => {
  let s = scene({ look: facts() }); assert.equal(await clockFlow(s.io, mkUser({ updated: "2026-10-20" })), false); assert.deepEqual(s.out.asked, []);
  s = scene({ look: facts(), answers: ["ja"] }); assert.equal(await clockFlow(s.io, mkUser()), true);
  assert.match(said(s.out), /25 Tagen nicht mehr bei dir umgeschaut/); assert.equal(s.out.user.updated, "2026-10-26");
  s = scene({ look: facts(), answers: ["nein"] }); assert.equal(await clockFlow(s.io, mkUser()), false);
  assert.equal(s.out.user.reminded, "2026-10-26"); assert.equal(s.out.user.updated, "2026-10-01");   // the file is not marked fresh by a no
});
test("in allen drei Sprachen", async () => {
  for (const [lang, re] of [["de", /Nichts Neues auf diesem Rechner/], ["en", /Nothing new on this machine/], ["es", /Nada nuevo en este equipo/]]) {
    const { io, out } = scene({ look: facts(), lang }); await refreshFlow(io, mkUser()); assert.match(said(out), re);
  }
  setLang("de");
});
