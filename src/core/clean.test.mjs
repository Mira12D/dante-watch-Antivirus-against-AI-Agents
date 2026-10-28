import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clean, guardOutput } from "./clean.mjs";
import { findFiles, readText, execProgram } from "./fsx.mjs";

const ESC = "\x1b";
test("Steuerzeichen aus fremdem Text: Bildschirm löschen, Titel, Zwischenablage, Zeilen überschreiben, Umkehr-Zeichen", () => {
  for (const evil of [`${ESC}[2J${ESC}[Hok`, `${ESC}]0;gehackt\x07ok`, `${ESC}]52;c;AAAA${ESC}\\ok`, `ok\r  SICHER  alles gut`, `a‮b`, `${ESC}[8mversteckt`, `${ESC}Pq${ESC}\\x`, "x\x07y\x00z\x9b31m"]) {
    const c = clean(evil);
    assert.equal(/[\x00-\x08\x0b-\x1f\x7f-\x9f‪-‮\r]/.test(c), false, JSON.stringify(evil));
  }
  assert.equal(clean("zeile1\n\tzeile2"), "zeile1\n\tzeile2");        // Zeilenumbruch und Tab bleiben
  assert.equal(clean(`${ESC}[2Jab`), "[2Jab");                          // sichtbarer, harmloser Rest
});

test("Ausgabe-Wächter: eigene Farben bleiben, alles andere fällt", () => {
  assert.equal(guardOutput(`${ESC}[41;37m OFFEN ${ESC}[0m`), `${ESC}[41;37m OFFEN ${ESC}[0m`);
  assert.equal(guardOutput(`${ESC}[2J${ESC}]0;t\x07x`), "[2Jx");
  assert.equal(guardOutput(`${ESC}[1;2;3m`), `${ESC}[1;2;3m`);               // Farb-/Stilfolgen sind unsere eigenen
  assert.equal(guardOutput(`ok\rSICHER`), "okSICHER");
});

test("Dateiname mit Escape-Folge: findFiles und readText geben nur reinen Text zurück", () => {
  const d = mkdtempSync(join(tmpdir(), "dante-clean-"));
  mkdirSync(join(d, "w"));
  const name = `.env${ESC}[2J${ESC}]0;x\x07.bak`;
  try { writeFileSync(join(d, "w", name), "KEY=1\n"); } catch { return; }      // Dateisystem erlaubt den Namen nicht -> nichts zu prüfen
  const r = findFiles([join(d, "w")], { names: ["*.bak"], worldReadable: false });
  for (const f of r.files) assert.equal(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(f), false);
  writeFileSync(join(d, "t.txt"), `PermitRootLogin no${ESC}[2J\r\nSICHER\n`);
  assert.equal(/[\x00-\x08\x0b-\x1f]/.test(readText(join(d, "t.txt")).text.replace(/\n/g, "")), false);
  const e = execProgram(process.execPath, ["-e", `process.stdout.write("a${"\\x1b"}[2Jb${"\\x1b"}]0;t${"\\x07"}c")`]);
  assert.equal(e.out, "a[2Jbc");
});

test("Pfade in Fix-Befehlen stehen in Anführungszeichen: ein Dateiname kann keinen Befehl einschmuggeln", async () => {
  const { shq, shqAll } = await import("./clean.mjs");
  const { spawnSync } = await import("node:child_process");
  const evil = "x'; touch /tmp/dante-pwn-test; '.env";
  const r = spawnSync("bash", ["-c", "printf '%s\\n' " + shq(evil)], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), evil);                                  // bleibt EIN Wort, nichts wird ausgeführt
  assert.equal(shqAll(["a b", "c"]), "'a b' 'c'");
});
