import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { patrol } from "./patrol.mjs";
import { write } from "./user.mjs";
import { readAll } from "./diary.mjs";

const sandbox = () => { const d = mkdtempSync(join(tmpdir(), "dante-p-")), old = process.env.DANTE_HOME; process.env.DANTE_HOME = d; return () => { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(d, { recursive: true, force: true }); }; };
const res = (v) => ({ id: "secrets", title: "s", verdict: v, evidence: [{ grounded: true, line: "zeile " + v }] });
// a fake runner: answers per target, and records what it was asked
const fakeRun = (answers) => { const asked = []; const f = async (task, target) => { asked.push(target ? target.host : "local"); const a = answers[target ? target.host : "local"]; if (a instanceof Error) throw a; return a(task); }; f.asked = asked; return f; };

test("Patrouille ohne user.md: nur dieser Rechner; Tagebuch bekommt einen Lauf mit Zeile und Ergebnis", async () => {
  const done = sandbox();
  try {
    const logs = [], run = fakeRun({ local: (t) => ({ reached: true, results: t.ids.map((id) => ({ ...res("safe"), id })) }) });
    assert.equal(await patrol({ log: (l) => logs.push(l), run }), 0);
    assert.deepEqual(run.asked, ["local"]);
    const e = readAll();
    assert.equal(e.length, 1); assert.equal(e[0].kind, "run"); assert.equal(e[0].reached, true); assert.ok(e[0].results.length >= 5);
    assert.match(logs[0], /local checked=\d+ risk=0 warn=0 unknown=0$/);
  } finally { done(); }
});
test("Patrouille mit Servern: nur die freigegebenen, mit Schlüsselpfad; ein Server, der nicht antwortet, ist 'nicht erreicht', nie 'sicher'", async () => {
  const done = sandbox();
  try {
    write({ name: "x", servers: [{ alias: "a", target: "root@203.0.113.10", key: "~/.ssh/k", os: "", patrol: true }, { alias: "b", target: "root@203.0.113.20", key: "", os: "", patrol: false }, { alias: "c", target: "root@203.0.113.30", key: "", os: "", patrol: true }], projects: [], patrol: { armed: true, times: [] } });
    const run = fakeRun({ local: (t) => ({ reached: true, results: [] }), "root@203.0.113.10": () => ({ reached: true, results: [res("safe")] }), "root@203.0.113.30": new Error("timeout after 180000 ms") });
    await patrol({ log: () => {}, run });
    assert.deepEqual(run.asked, ["local", "root@203.0.113.10", "root@203.0.113.30"]);   // b was not approved
    const e = readAll();
    assert.equal(e.find((x) => x.target === "c").reached, false); assert.equal(e.find((x) => x.target === "c").results.length, 0);
  } finally { done(); }
});
test("Veränderung zwischen zwei Läufen wird festgehalten; ein offener Fund gibt Exit-Code 2", async () => {
  const done = sandbox();
  try {
    const logs = []; let v = "safe";
    const run = fakeRun({ local: () => ({ reached: true, results: [res(v)] }) });
    await patrol({ log: (l) => logs.push(l), run });
    v = "risk";
    assert.equal(await patrol({ log: (l) => logs.push(l), run }), 2);
    const runs = readAll().filter((x) => x.kind === "run");
    assert.deepEqual(runs[1].changes, [{ id: "secrets", from: "safe", to: "risk" }]);
    assert.match(logs[1], /risk=1 .*changed=secrets:safe>risk/);
  } finally { done(); }
});
