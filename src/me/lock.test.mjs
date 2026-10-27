import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import { acquire, holder, MAX_HOURS } from "./lock.mjs";

function home(fn) {
  const dir = mkdtempSync(join(tmpdir(), "dante-lk-")), old = process.env.DANTE_HOME; process.env.DANTE_HOME = dir;
  try { return fn(dir); } finally { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(dir, { recursive: true, force: true }); }
}

test("der erste sperrt, der zweite sieht die Sperre und setzt aus", () => home(() => {
  const a = acquire("deep", "tief");
  assert.equal(a.ok, true);
  const b = acquire("deep");
  assert.equal(b.ok, false); assert.equal(b.by.pid, process.pid); assert.equal(b.by.what, "tief");
  a.release();
  assert.equal(holder("deep"), null);
  const c = acquire("deep"); assert.equal(c.ok, true); c.release();
}));

test("eine tote Sperre (Absturz) blockiert nie", () => home((dir) => {
  writeFileSync(join(dir, "deep.lock"), JSON.stringify({ pid: 999999, host: hostname(), t: new Date().toISOString(), what: "tief" }));
  assert.equal(holder("deep"), null);
  const a = acquire("deep"); assert.equal(a.ok, true); a.release();
}));

test("eine zu alte Sperre wird übernommen, auch wenn der Prozess noch lebt", () => home((dir) => {
  const old = new Date(Date.now() - (MAX_HOURS + 1) * 36e5).toISOString();
  writeFileSync(join(dir, "deep.lock"), JSON.stringify({ pid: process.pid, host: hostname(), t: old, what: "tief" }));
  assert.equal(holder("deep"), null);
  const a = acquire("deep"); assert.equal(a.ok, true); a.release();
}));

test("kaputte Sperrdatei zählt als frei", () => home((dir) => {
  writeFileSync(join(dir, "deep.lock"), "müll");
  const a = acquire("deep"); assert.equal(a.ok, true); a.release();
}));
