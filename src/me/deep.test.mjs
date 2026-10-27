import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deep } from "./deep.mjs";
import { patrol } from "./patrol.mjs";
import { acquire, holder } from "./lock.mjs";
import * as ds from "./schedule-deep.mjs";
import { readAll } from "./diary.mjs";
import { deepScript } from "./home.mjs";

function home(fn) {
  const dir = mkdtempSync(join(tmpdir(), "dante-dp-")), old = process.env.DANTE_HOME, dry = process.env.DANTE_SCHEDULE_DRY;
  process.env.DANTE_HOME = dir; process.env.DANTE_SCHEDULE_DRY = "1";
  const done = () => { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; if (dry === undefined) delete process.env.DANTE_SCHEDULE_DRY; else process.env.DANTE_SCHEDULE_DRY = dry; rmSync(dir, { recursive: true, force: true }); };
  return Promise.resolve(fn(dir)).finally(done);
}
const fakeRun = (calls, verdict = "safe") => async (task) => { calls.push(task.ids.join(",")); return { reached: true, results: task.ids.map((id) => ({ id, verdict, evidence: [{ grounded: true, line: "echte Zeile" }] })) }; };

test("der Tiefenlauf sperrt die Autobahn: die Streife setzt aus und wartet nicht", () => home(async () => {
  const calls = [], logs = [];
  const gate = acquire("deep", "tief");           // the deep run is on the road
  const code = await patrol({ log: (l) => logs.push(l), run: fakeRun(calls) });
  assert.equal(code, 0); assert.equal(calls.length, 0);
  assert.match(logs.join("\n"), /deep run is on the road/);
  const again = await deep({ log: (l) => logs.push(l), run: fakeRun(calls) });   // a second deep run steps aside too
  assert.equal(again, 0); assert.equal(calls.length, 0);
  gate.release();
  assert.equal(await patrol({ log: () => {}, run: fakeRun(calls) }), 0);          // barrier open: the patrol runs
  assert.equal(calls.length, 1);
}));

test("der Tiefenlauf schreibt unter '<ziel>·tief', öffnet danach die Sperre und lässt die Streife in Ruhe", () => home(async () => {
  const calls = [];
  await deep({ log: () => {}, run: fakeRun(calls, "warn") });
  assert.deepEqual(calls, ["codegeheimnisse"]);
  const runs = readAll().filter((e) => e.kind === "run");
  assert.equal(runs.length, 1); assert.equal(runs[0].target, "local·tief"); assert.equal(runs[0].deep, true);
  assert.equal(holder("deep"), null);
  await patrol({ log: () => {}, run: fakeRun(calls) });
  assert.ok(readAll().some((e) => e.target === "local"), "die Streife schreibt unter 'local', getrennt");
}));

test("Sperre wird auch bei einem Absturz im Lauf freigegeben", () => home(async () => {
  const boom = async () => { throw new Error("kaputt"); };
  await deep({ log: () => {}, run: boom });
  assert.equal(holder("deep"), null);
  assert.equal(readAll().filter((e) => e.kind === "run")[0].reached, false);
}));

test("der Tiefenlauf hat seinen eigenen Zeitplan-Eintrag (Trockenlauf)", () => home(async (dir) => {
  const p = ds.plan({ platform: "linux", cli: "/x/cli.mjs" });
  assert.match(p.line, /30 3 \* \* 1/); assert.match(p.launcher, /--deep/);
  assert.equal(ds.isArmed(), false);
  assert.equal(ds.install(p).ok, true); assert.equal(ds.isArmed(), true);
  assert.ok(existsSync(deepScript()));
  const m = ds.plan({ platform: "darwin", cli: "/x/cli.mjs", home: dir });
  assert.match(m.content, /Weekday/); assert.match(m.file, /dante\.deep\.plist$/);
  ds.remove(); assert.equal(ds.isArmed(), false);
  assert.ok(!existsSync(deepScript()));
}));
