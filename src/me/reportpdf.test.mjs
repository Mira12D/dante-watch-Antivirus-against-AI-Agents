import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reportDoc, saveReport, copyToDownloads, downloadsDir } from "./reportpdf.mjs";

const RS = [
  { id: "a", title: "SSH", verdict: "warn", was: "Root darf per Passwort rein.", evidence: [{ claim: "PermitRootLogin", line: "yes", grounded: true }] },
  { id: "b", title: "Secrets", verdict: "safe", was: "Nichts offen.", evidence: [{ claim: "durchsucht", line: "keine Treffer", grounded: true }] },
  { id: "c", title: "PHP", verdict: "unknown", was: "Kein PHP.", evidence: [] },
];

test("reportDoc: Titel, Zusammenfassung mit Zählern, jeder Fund mit Beleg", () => {
  const d = reportDoc(RS, { target: "root@host", lang: "de", when: new Date("2026-10-27T06:41:00Z") });
  assert.match(d.title, /root@host/);
  assert.ok(d.lines.some((l) => /Zusammenfassung: 0 OFFEN · 1 SCHRITT NÖTIG · 1 UNBEKANNT · 1 SICHER/.test(l)));
  assert.ok(d.lines.some((l) => /\[SCHRITT NÖTIG\] SSH/.test(l)));
  assert.ok(d.lines.some((l) => /PermitRootLogin: yes/.test(l)));
  assert.ok(d.lines.some((l) => /2026-10-27 06:41 UTC/.test(l)));
});

test("reportDoc: Englisch und leere Liste", () => {
  assert.ok(reportDoc(RS, { lang: "en" }).lines.some((l) => /\[STEP NEEDED\] SSH/.test(l)));
  assert.ok(reportDoc([], { lang: "en" }).lines.some((l) => /No findings\./.test(l)));
});

test("saveReport schreibt eine echte PDF nach ~/.dante/reports", () => {
  const home = mkdtempSync(join(tmpdir(), "dante-rep-"));
  const p = saveReport(RS, { target: "localhost", home, when: new Date("2026-10-27T06:41:00Z") });
  assert.ok(p && existsSync(p));
  assert.ok(p.includes(join(".dante", "reports")));
  assert.equal(readFileSync(p).slice(0, 5).toString(), "%PDF-");
});

test("downloadsDir: ohne Downloads-Ordner null", () => {
  const home = mkdtempSync(join(tmpdir(), "dante-dl-"));
  assert.equal(downloadsDir(home), null);
});

test("copyToDownloads: mit vorhandenem Downloads, keine Überschreibung", async () => {
  const fs = await import("node:fs");
  const home = mkdtempSync(join(tmpdir(), "dante-dl2-"));
  fs.mkdirSync(join(home, "Downloads"));
  const src = saveReport(RS, { target: "x", home });
  const d1 = copyToDownloads(src, { home });
  const d2 = copyToDownloads(src, { home });
  assert.ok(d1 && existsSync(d1));
  assert.ok(d2 && d2 !== d1);                 // zweiter Lauf -> neuer Name, nichts überschrieben
  assert.match(d2, /-2\.pdf$/);
});
