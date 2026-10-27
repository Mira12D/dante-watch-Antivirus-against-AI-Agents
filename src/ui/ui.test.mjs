import test from "node:test";
import assert from "node:assert/strict";
import { WORDMARK, startLines, danteLines } from "../mascot.mjs";
import { quip } from "./quips.mjs";
import { waitFor } from "./wait.mjs";
import { job } from "./job.mjs";
import { tipAt, clockText, TIPS } from "../ticker.mjs";
import { setLang } from "../i18n.mjs";

const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

test("Schriftzug: vier Zeilen, liest sich als D-A-N-T-E, passt in ein schmales Fenster", () => {
  assert.equal(WORDMARK.length, 4);
  assert.ok(Math.max(...WORDMARK.map((l) => l.length)) <= 40);
  const joined = WORDMARK.join("\n");
  for (const shape of ["|   \\", "/_\\", "| \\| |", "|_   _|", "| __|", "|___/", "|___|"]) assert.ok(joined.includes(shape), shape);
});
test("Start: Schwert-Dante (9 Zeilen), Schriftzug, der Satz darunter", () => {
  assert.equal(danteLines().length, 9);
  const lines = startLines("Ich bin Dante.").map(plain);
  assert.ok(lines.some((l) => l.includes("Ich bin Dante.")));
  assert.ok(lines.filter((l) => /[▀▄]/.test(l)).length >= 9);
  assert.ok(lines.filter((l) => l.includes("___")).length >= 2);
});
test("Sprüche in allen drei Sprachen, und sie wechseln", () => {
  for (const l of ["de", "en", "es"]) {
    setLang(l);
    const seen = new Set(); for (let i = 0; i < 33 * 80; i++) seen.add(quip()); // the saying changes every 33rd call: 80 draws out of 12
    assert.ok(seen.size >= 5 && [...seen].every((q) => q.length > 10), l);
  }
  setLang("de");
});
test("Tipps: jede Sprache hat welche, sie rotieren; die Uhr zeigt Datum und Alter", () => {
  for (const l of ["de", "en", "es"]) { assert.ok(TIPS[l].length >= 8); assert.notEqual(tipAt(0, l), tipAt(1, l)); }
  assert.match(clockText(), /^(bib \d\d\.\d\d\. · \d+d|bib \d+d · !) · v\d+\.\d+\.\d+$/);   // date, age and the running version
  // the tip about the network must not claim "sends nothing" any more: the only call is the one the person starts
  for (const l of ["de", "en", "es"]) assert.ok(!TIPS[l].some((t) => /sendet nichts|sends nothing|no envía nada/i.test(t)), l);
});
test("Warteanzeige ohne Terminal: gibt das Ergebnis zurück, lässt console.log in Ruhe, auch bei Fehlern", async () => {
  const log = console.log;
  assert.equal(await waitFor("x", async () => 42), 42);
  assert.equal(console.log, log);
  await assert.rejects(waitFor("x", async () => { throw new Error("kaputt"); }), /kaputt/);
  assert.equal(console.log, log);
});
test("Worker: die Prüfungen laufen in einem eigenen Thread und liefern alle Ergebnisse", async () => {
  const r = await job({ kind: "checks", ids: ["php2shell", "secrets", "webshell", "sshd", "rechte"] }, null);
  assert.equal(r.reached, true);
  assert.deepEqual(r.results.map((x) => x.id), ["php2shell", "secrets", "webshell", "sshd", "rechte"]);
  assert.ok(r.results.every((x) => ["safe", "warn", "risk", "unknown"].includes(x.verdict)));
  // the local shell is bash on macOS/Linux and cmd.exe on Windows: each gets its own syntax for "print to stderr, exit 3"
  const e = await job({ kind: "exec", scripts: ["echo eins", process.platform === "win32" ? "echo zwei 1>&2 & exit /b 3" : "echo zwei >&2; exit 3"], timeout: 5000 }, null);
  assert.equal(e.outs[0].out, "eins"); assert.equal(e.outs[1].ok, false); assert.match(e.outs[1].err, /zwei/);
});
test("Worker: ein Ziel, das nicht antwortet, wird als nicht erreicht gemeldet (nie als sicher)", async () => {
  const r = await job({ kind: "checks", ids: ["php2shell"] }, { host: "nobody@127.0.0.1:9", key: null });
  assert.equal(r.reached, false); assert.ok(r.line);
});

test("pack <Gerätedatei> wird nie gelesen (kein Endlos-Lesen von /dev/zero)", { skip: process.platform === "win32" }, async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("node", ["-e", `
    import("node:fs").then(({ statSync }) => { const st = statSync("/dev/zero"); console.log(st.isFile(), st.size); });`], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), "false 0");   // the guard in installFile rests on exactly this: a device is no file
});
