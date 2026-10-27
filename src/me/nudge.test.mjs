import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { due, newPacks, openCommand, nudgeFlow, readAsked, curlShown, NUDGE_DAYS, SNOOZE_DAYS, CATALOG_URL } from "./nudge.mjs";
import { mt } from "./texts.mjs";
import { setLang } from "../i18n.mjs";

const CAT = { ok: true, packs: [{ serial: 1, title: "Secrets", title_de: "Geheimnisse", free: true, cents: 0 }, { serial: 2, title: "Webshells", title_de: "Webshell-Kennungen", free: false, cents: 80 }, { serial: 3, title: "SSH", title_de: "SSH", free: false, cents: 400 }, { serial: 4, title: "Neu", title_de: "Neu", free: false, cents: 400 }] };
function scene({ answers = [], catalog = CAT, have = [1], open = { ok: true }, lang = "de", days = 31 } = {}) {
  setLang(lang);
  const dir = mkdtempSync(join(tmpdir(), "dante-n-")), old = process.env.DANTE_HOME; process.env.DANTE_HOME = dir;
  const out = { says: [], asked: [], fetched: 0, opened: 0, dir };
  const a = [...answers];
  const io = { mt, say: (l) => out.says.push(l), dim: (x) => x, lang: () => lang, today: () => "2026-11-30", knowledgeDays: () => days,
    ask: async (q) => { out.asked.push(q); return a.shift() ?? ""; }, decide: (x) => (/^(ja|yes|sí)$/i.test(x.trim()) ? "yes" : /^(nein|no)$/i.test(x.trim()) ? "no" : "unclear"),
    fetchCatalog: async () => { out.fetched++; return catalog; }, installedSerials: () => have, openPage: async () => { out.opened++; return open; } };
  out.done = () => { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(dir, { recursive: true, force: true }); };
  return { io, out };
}
const said = (o) => o.says.join("\n");

test("drei Tage nach dem Kennenlernen fragt er einmal, nie vorher, nie ein zweites Mal", () => {
  assert.equal(due({ knowledgeDays: 1, lastAsked: "", today: "2026-11-30", created: "2026-11-28" }), false);
  assert.equal(due({ knowledgeDays: 1, lastAsked: "", today: "2026-11-30", created: "2026-11-27" }), true);
  assert.equal(due({ knowledgeDays: 1, lastAsked: "2026-11-30", today: "2026-12-01", created: "2026-11-27" }), false);
});

test("fällig ab 30 Tage altem Wissen, danach eine Woche Ruhe", () => {
  assert.equal(NUDGE_DAYS, 30); assert.equal(SNOOZE_DAYS, 7);
  assert.equal(due({ knowledgeDays: 29, lastAsked: "", today: "2026-11-30" }), false);
  assert.equal(due({ knowledgeDays: 30, lastAsked: "", today: "2026-11-30" }), true);
  assert.equal(due({ knowledgeDays: 40, lastAsked: "2026-11-25", today: "2026-11-30" }), false);
  assert.equal(due({ knowledgeDays: 40, lastAsked: "2026-11-23", today: "2026-11-30" }), true);
});
test("Katalog gegen das, was er schon hat: nur Fehlendes, neueste zuerst", () => {
  assert.deepEqual(newPacks(CAT, [1, 3]).map((p) => p.serial), [4, 2]);
  assert.deepEqual(newPacks(CAT, [1, 2, 3, 4]), []); assert.deepEqual(newPacks(null, []), []);
});
test("der curl ist öffentlich: kein Token, nur der Katalog", () => { assert.match(curlShown(), /^curl -sS --max-time 15 https:\/\/api\.nm-streetwear\.space\/dante\/catalog$/); assert.ok(!/token|Bearer|Authorization/i.test(curlShown())); assert.equal(CATALOG_URL.endsWith("/dante/catalog"), true); });
test("Seite öffnen: Mac open, Linux xdg-open, sonst nichts — Hochkomma bleiben heil", () => {
  assert.equal(openCommand("https://x/y", "darwin"), "open 'https://x/y'"); assert.match(openCommand("https://x/y", "linux"), /^xdg-open /); assert.equal(openCommand("https://x", "win32"), null);
  assert.equal(openCommand("https://x/a'b", "darwin"), "open 'https://x/a'\\''b'");
});
test("alles mit Ja: curl, neue Packs mit Preis, Seite geöffnet; er merkt sich den Tag", async () => {
  const { io, out } = scene({ answers: ["ja", "ja"] });
  try {
    assert.equal(await nudgeFlow(io), true);
    assert.equal(out.fetched, 1); assert.equal(out.opened, 1); assert.equal(readAsked(), "2026-11-30");
    assert.match(said(out), /31 Tage alt/); assert.match(said(out), /Nr\. 4 · Neu · 4,00 €/); assert.match(said(out), /Nr\. 2 · Webshell-Kennungen · 0,80 €/); assert.match(said(out), /Seite in deinem Browser geöffnet/);
    assert.ok(!said(out).includes("Nr. 1"));      // the free pack he has is not offered again
  } finally { out.done(); }
});
test("Nein zum curl: nichts abgerufen, nichts geöffnet, trotzdem für eine Woche Ruhe", async () => {
  const { io, out } = scene({ answers: ["nein"] });
  try { assert.equal(await nudgeFlow(io), false); assert.equal(out.fetched, 0); assert.equal(out.opened, 0); assert.equal(readAsked(), "2026-11-30"); assert.match(said(out), /in einer Woche/); }
  finally { out.done(); }
});
test("nichts Neues im Katalog: er sagt es und fragt nicht nach der Seite", async () => {
  const { io, out } = scene({ answers: ["ja"], have: [1, 2, 3, 4] });
  try { await nudgeFlow(io); assert.match(said(out), /auf dem neuesten Stand/); assert.equal(out.asked.length, 1); assert.equal(out.opened, 0); }
  finally { out.done(); }
});
test("Katalog nicht erreichbar, oder Seite wird nicht geöffnet: ehrliche Meldung, die URL zum Selbstöffnen", async () => {
  let s = scene({ answers: ["ja"], catalog: { ok: false } });
  try { await nudgeFlow(s.io); assert.match(said(s.out), /Katalog war nicht erreichbar/); } finally { s.out.done(); }
  s = scene({ answers: ["ja", "ja"], open: { ok: false } });
  try { assert.equal(await nudgeFlow(s.io), false); assert.match(said(s.out), /keinen Browser öffnen\. Die Seite: https:\/\/api\.nm-streetwear\.space\/dante\//); } finally { s.out.done(); }
});
test("kein Ja zum Öffnen: Seite bleibt zu", async () => {
  const { io, out } = scene({ answers: ["ja", "nein"] });
  try { assert.equal(await nudgeFlow(io), false); assert.equal(out.opened, 0); } finally { out.done(); }
});
test("'kaufen' (force): ohne den Satz über das Alter, sonst derselbe Weg", async () => {
  const { io, out } = scene({ answers: ["ja", "ja"], days: 3 });
  try { await nudgeFlow(io, { force: true }); assert.ok(!said(out).includes("Tage alt")); assert.equal(out.opened, 1); } finally { out.done(); }
});
test("in allen drei Sprachen, Preise mit Komma außer Englisch", async () => {
  for (const [lang, re] of [["de", /Neu im Katalog: .*4,00 €/], ["en", /New in the catalog: .*4\.00 €/], ["es", /Nuevo en el catálogo: .*4,00 €/]]) {
    const { io, out } = scene({ answers: ["ja", "ja"], lang }); try { await nudgeFlow(io); assert.match(said(out), re); } finally { out.done(); }
  }
  setLang("de");
});

import { expiredDue } from "./nudge.mjs";
test("abgelaufenes Pack: er fragt höchstens einmal am Tag", () => {
  assert.equal(expiredDue("", "2026-10-27"), true);               // never asked
  assert.equal(expiredDue("2026-10-27", "2026-10-27"), false);    // already today
  assert.equal(expiredDue("2026-10-26", "2026-10-27"), true);     // yesterday: again
});
