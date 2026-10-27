import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReport, writeReport, scrub } from "./report.mjs";
import { isOwnerOnly } from "../core/perm.mjs";

const A = [
  { id: "listen:5432", way: "Port 5432 (postgres) auf allen Schnittstellen", level: "hoch", reasons: ["tcp *:5432 LISTEN postgres", "Bindung: alle Schnittstellen"], isNew: true, deviates: true,
    card: { what: { de: "Datenbank-Port", en: "DB port" }, why: { de: "Angriffsziel Nr. 1" }, normal: { de: "nur loopback" }, redflag: { de: "0.0.0.0" }, fix: { de: "listen_addresses='localhost' setzen (ändert postgresql.conf)" } } },
  { id: "persist:cron", way: "Cron-Eintrag", level: "mittel", reasons: ["*/5 * * * * /tmp/x.sh"], isNew: null, deviates: false, card: null },
  { id: "x", way: "Remote-Login", level: "unbekannt", reasons: ["systemsetup: keine Rechte"], isNew: null, deviates: false, card: null },
  { id: "l", way: "Port 631 loopback", level: "niedrig", reasons: ["tcp 127.0.0.1:631"], isNew: false, deviates: false, card: null },
];
test("Bericht: Überschrift, vier Abschnitte, Belegzeilen, Karte, Optionen, KI-Block", () => {
  const r = buildReport({ date: "2026-10-27", os: "macOS 15", assessments: A, summary: "4 Wege", lang: "de" });
  assert.match(r, /^# Dante-Bericht 2026-10-27/);
  for (const h of ["## Hoch (1)", "## Mittel (1)", "## Niedrig (1)", "## Unbekannt"]) assert.ok(r.includes(h), h);
  assert.ok(r.includes("`tcp *:5432 LISTEN postgres`")); assert.ok(r.includes("`systemsetup: keine Rechte`"));
  assert.ok(r.includes("Datenbank-Port") && r.includes("Angriffsziel Nr. 1") && r.includes("ändert postgresql.conf"));
  assert.match(r, /neu seit dem letzten Besuch/);
  assert.match(r, /1\. Dante räumt auf[\s\S]*2\. Du machst es selbst[\s\S]*3\. Du rufst Virgil/);
  const ki = r.split("<!-- BEGIN-KI -->")[1].split("<!-- END-KI -->")[0];
  assert.ok(r.includes("## Für deine KI") && ki.includes("macOS 15") && ki.includes("tcp *:5432 LISTEN postgres") && ki.includes("Aufgabe:"));
  assert.ok(!ki.includes("tcp 127.0.0.1:631"), "niedrig steht nicht im KI-Absatz");
});
test("Bericht: Englisch und Spanisch, fehlende Kartensprache fällt zurück", () => {
  assert.match(buildReport({ date: "d", os: "x", assessments: A, lang: "en" }), /For your AI/);
  assert.match(buildReport({ date: "d", os: "x", assessments: A, lang: "es" }), /Para tu IA/);
  assert.ok(buildReport({ date: "d", os: "x", assessments: A, lang: "en" }).includes("DB port"));
});
test("Bericht: kein schlüsselartiger Text, auch wenn eine Zeile ihn versehentlich trägt", () => {
  const fake = "sk-live_ABCDEF1234567890ABCDEF1234567890";
  const dirty = [{ id: "k", way: "Datei", level: "hoch", reasons: [`.env: STRIPE=${fake}`, "password=hunter2hunter2", "AKIAABCDEFGHIJKLMNOP", "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk\n-----END OPENSSH PRIVATE KEY-----"], isNew: null, deviates: false, card: { what: { de: `x ${fake}` } } }];
  const r = buildReport({ date: "d", os: "linux", assessments: dirty });
  for (const s of [fake, "hunter2hunter2", "AKIAABCDEFGHIJKLMNOP", "b3BlbnNzaC1rZXk"]) assert.ok(!r.includes(s), s);
  assert.ok(r.includes(".env:"));
  assert.equal(scrub("harmlos: 127.0.0.1:631"), "harmlos: 127.0.0.1:631");
});
test("writeReport: 0600/0700, Pfad bleibt in home", () => {
  const h = mkdtempSync(join(tmpdir(), "dante-r-"));
  try {
    const p = writeReport(h, "2026-10-27", "# x\n");
    assert.equal(p, join(h, "reports", "2026-10-27.md")); assert.equal(readFileSync(p, "utf8"), "# x\n");
    assert.notEqual(isOwnerOnly(p), false); assert.notEqual(isOwnerOnly(join(h, "reports")), false);
    for (const bad of ["../../etc/x", "2026-10-27/../../a", "x", "2026-10-27.md", "/etc/passwd", ""]) assert.throws(() => writeReport(h, bad, "t"), /refused/, bad);
    assert.throws(() => writeReport("", "2026-10-27", "t"), /refused/);
  } finally { rmSync(h, { recursive: true, force: true }); }
});
