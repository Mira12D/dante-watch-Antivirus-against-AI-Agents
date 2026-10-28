import test from "node:test";
import assert from "node:assert/strict";
import { textPdf } from "./pdf.mjs";

const str = (b) => b.toString("latin1");

test("textPdf: Buffer mit PDF-Rahmen", () => {
  const b = textPdf({ title: "Titel", lines: ["eins", "zwei"] });
  assert.ok(Buffer.isBuffer(b));
  const s = str(b);
  assert.ok(s.startsWith("%PDF-1.4"));
  assert.ok(s.trimEnd().endsWith("%%EOF"));
  assert.match(s, /\/MediaBox \[0 0 595 842\]/);
  assert.match(s, /Helvetica-Bold/);
  assert.match(s, /WinAnsiEncoding/);
});

test("textPdf: Umlaute und Sonderzeichen als cp1252", () => {
  const s = str(textPdf({ title: "x", lines: ["äöüßÄÖÜéñáíóú¿¡€"] }));
  assert.ok(s.includes("e4f6fcdfc4d6dce9f1e1edf3fabfa180".toLowerCase()));
});

test("textPdf: xref-Offsets stimmen", () => {
  const b = textPdf({ title: "T", lines: ["a"] });
  const s = str(b);
  const start = Number(/startxref\n(\d+)/.exec(s)[1]);
  assert.ok(s.slice(start).startsWith("xref"));
  const entries = [...s.slice(start).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  entries.forEach((off, i) => assert.ok(s.slice(off).startsWith(`${i + 1} 0 obj`)));
});

test("textPdf: viele Zeilen ergeben mehrere Seiten", () => {
  const lines = Array.from({ length: 200 }, (_, i) => "Zeile " + i);
  const s = str(textPdf({ title: "T", lines }));
  const n = Number(/\/Count (\d+)/.exec(s)[1]);
  assert.ok(n >= 3);
  assert.equal((s.match(/\/Type \/Page /g) || []).length, n);
});

test("textPdf: lange Zeilen werden umbrochen, leere Eingabe geht", () => {
  assert.ok(textPdf({ title: "", lines: [] }).length > 100);
  assert.ok(textPdf({ title: "T", lines: ["w".repeat(500)] }).length > 100);
});
