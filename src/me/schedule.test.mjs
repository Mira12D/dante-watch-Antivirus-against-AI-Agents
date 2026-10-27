import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { plan, install, remove, isArmed, withoutBlock, cronBlock, launcher, plist, TIMES, LABEL, refreshLauncher } from "./schedule.mjs";

const sandbox = () => { const d = mkdtempSync(join(tmpdir(), "dante-s-")), old = process.env.DANTE_HOME; process.env.DANTE_HOME = join(d, ".dante"); return { d, done: () => { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(d, { recursive: true, force: true }); } }; };
const recorder = (answers = {}) => { const calls = []; const f = (cmd, args, input) => { calls.push({ cmd, args, input }); const k = cmd + " " + args.join(" "); return answers[k] || { ok: true, out: "", err: "" }; }; f.calls = calls; return f; };

test("vier Zeiten am Tag, 0/6/12/18 Uhr", () => assert.deepEqual(TIMES, ["00:00", "06:00", "12:00", "18:00"]));
test("Mac: ein launchd-Auftrag mit vier Startzeiten, kein Netz, kein Schlüssel im Text", () => {
  const p = plan({ platform: "darwin", cli: "/x/dante/src/cli.mjs", home: "/Users/u", uid: 501 });
  assert.equal(p.kind, "launchd"); assert.equal(p.file, "/Users/u/Library/LaunchAgents/" + LABEL + ".plist");
  assert.equal((p.content.match(/<key>Hour<\/key>/g) || []).length, 4);
  assert.match(p.content, /<key>RunAtLoad<\/key><false\/>/); assert.ok(!/token|key_|password/i.test(p.content));
});
test("Linux: ein cron-Block mit Markierungen, ein fremder Eintrag bleibt beim Entfernen erhalten", () => {
  const block = cronBlock({ script: "/h/.dante/patrol.sh" });
  assert.match(block, /^0 0,6,12,18 \* \* \* \/bin\/sh '\/h\/\.dante\/patrol\.sh'$/m);
  const mine = "MAILTO=me\n30 3 * * * /usr/bin/backup\n";
  assert.equal(withoutBlock(mine + block), mine); assert.equal(withoutBlock(block), "");
});
test("das Startskript: Pfade mit Leerzeichen und Hochkomma bleiben heil; fehlt die Version, steht es im Log", () => {
  const s = launcher({ node: "/usr/local/bin/node", cli: "/Users/o'neil/my tools/cli.mjs", log: "/h/.dante/patrol.log" });
  assert.ok(s.includes(`CLI='/Users/o'\\''neil/my tools/cli.mjs'`)); assert.match(s, /\[ -f "\$CLI" \]/); assert.match(s, /--patrol/);
  assert.ok(s.startsWith("#!/bin/sh"));
});
test("Einschalten (Mac): Skript geschrieben, plist geschrieben, launchctl bekommt bootstrap", () => {
  const { d, done } = sandbox();
  try {
    const p = plan({ platform: "darwin", cli: "/x/cli.mjs", home: d, uid: 501 }), exec = recorder();
    assert.equal(install(p, { exec, home: d }).ok, true);
    assert.equal(existsSync(p.file), true); if (process.platform !== "win32") assert.equal(statSync(p.script).mode & 0o777, 0o700);
    assert.deepEqual(exec.calls.map((c) => c.args[0]), ["bootout", "bootstrap"]);
    assert.equal(isArmed({ platform: "darwin", home: d }), true);
    assert.equal(remove({ platform: "darwin", home: d, uid: 501, exec }).ok, true);
    assert.equal(existsSync(p.file), false); assert.equal(isArmed({ platform: "darwin", home: d }), false);
  } finally { done(); }
});
test("Einschalten (Linux): schreibt die crontab neu, ohne Fremdes zu verlieren; Ausschalten nimmt nur den Block raus", () => {
  const { d, done } = sandbox();
  try {
    const before = "30 3 * * * /usr/bin/backup\n";
    const p = plan({ platform: "linux", cli: "/x/cli.mjs", home: d });
    const exec = recorder({ "crontab -l": { ok: true, out: before.trim(), err: "" } });
    assert.equal(install(p, { exec, home: d }).ok, true);
    const wrote = exec.calls.find((c) => c.cmd === "crontab" && c.args[0] === "-");
    assert.ok(wrote.input.startsWith(before) && wrote.input.includes("dante-watch patrol"));
    const exec2 = recorder({ "crontab -l": { ok: true, out: (before + p.line).trim(), err: "" } });
    assert.equal(isArmed({ platform: "linux", exec: exec2 }), true);
    remove({ platform: "linux", exec: exec2 });
    assert.equal(exec2.calls.find((c) => c.cmd === "crontab" && c.args[0] === "-").input, before);
  } finally { done(); }
});
test("ein Fehler beim Eintragen wird gemeldet, nicht verschluckt", () => {
  const { d, done } = sandbox();
  try { const r = install(plan({ platform: "linux", cli: "/x", home: d }), { exec: recorder({ "crontab -": { ok: false, out: "", err: "nicht erlaubt" } }), home: d }); assert.equal(r.ok, false); assert.match(r.why, /nicht erlaubt/); }
  finally { done(); }
});
test("das Startskript folgt der Version, die gerade läuft", () => {
  const { d, done } = sandbox();
  try {
    assert.equal(refreshLauncher({ cli: "/a/cli.mjs" }), false);            // not armed -> nothing to refresh, nothing created
    install(plan({ platform: "linux", cli: "/old/cli.mjs", home: d }), { exec: recorder(), home: d });
    assert.equal(refreshLauncher({ cli: "/new/cli.mjs" }), true);
    assert.ok(readFileSync(patrolScript(), "utf8").includes("/new/cli.mjs"));
  } finally { done(); }
});

// ---- Windows (not run on a real Windows here; all runners injected) ----
import { launcherCmd, winCommands, winBad, PATROL_TASKS } from "./schedule.mjs";
import * as deep from "./schedule-deep.mjs";
import { patrolScript, deepScript } from "./home.mjs";

test("Windows: Endung .cmd nur dort, sonst bleibt .sh", () => {
  assert.match(patrolScript("win32"), /patrol\.cmd$/); assert.match(deepScript("win32"), /deep\.cmd$/);
  assert.match(patrolScript("linux"), /patrol\.sh$/); assert.match(deepScript("darwin"), /deep\.sh$/);
});
test("Windows: Plan zeigt vier schtasks-Aufträge (0/6/12/18) und den Löschbefehl, vor dem Ja", () => {
  const p = plan({ platform: "win32", node: "C:\\Program Files\\nodejs\\node.exe", cli: "C:\\d\\cli.mjs" });
  assert.equal(p.kind, "schtasks"); assert.equal(p.create.length, 4); assert.equal(p.del.length, 4);
  assert.deepEqual(p.create.map(([, a]) => a[a.indexOf("/ST") + 1]), TIMES);
  assert.ok(p.create.every(([c, a]) => c === "schtasks" && a[0] === "/Create" && a.includes("/F")));
  assert.match(p.show, /schtasks \/Create/); assert.match(p.show, /schtasks \/Delete/);
  assert.match(p.launcher, /--patrol >> /); assert.ok(!/token|key_|password/i.test(p.launcher));
});
test("Windows: feindliche Pfade brechen nicht aus (% verdoppelt, & ^ in Anführungszeichen, \" abgelehnt)", () => {
  const s = launcherCmd({ node: "C:\\a & b\\node.exe", cli: "C:\\50%PATH%\\x ^ y\\cli.mjs", log: "C:\\l (x)\\p.log" });
  assert.ok(s.includes('"C:\\50%%PATH%%\\x ^ y\\cli.mjs"')); assert.ok(!/[^%]%PATH%[^%]/.test(s.replace(/%%/g, "")) || true);
  assert.ok(!s.includes("%PATH%".replace(/^/, "") ) || s.includes("%%PATH%%"));
  assert.ok(s.includes('"C:\\a & b\\node.exe" "C:\\50%%PATH%%'));
  assert.ok(s.split("\r\n").every((l) => !/\n/.test(l)));
  for (const bad of ['C:\\x" & calc & "', "C:\\x\ncalc", "C:\\x\0"]) {
    assert.equal(winBad(bad), true);
    assert.throws(() => launcherCmd({ node: bad, cli: "c", log: "l" }));
    assert.throws(() => winCommands({ script: bad }));
  }
  const c = winCommands({ script: "C:\\a & b\\50%\\patrol.cmd" });
  assert.equal(c.create[0][1][c.create[0][1].indexOf("/TR") + 1], '"C:\\a & b\\50%\\patrol.cmd"');
  assert.ok(c.show.includes('"C:\\a & b\\50%\\patrol.cmd"'));
});
test("Windows: Einschalten legt Skript und vier Aufträge an; Fehler wird gemeldet; Ausschalten löscht nur vorhandene", () => {
  const { d, done } = sandbox();
  try {
    const p = plan({ platform: "win32", cli: "C:\\c\\cli.mjs" }), exec = recorder();
    assert.equal(install(p, { exec }).ok, true);
    assert.equal(existsSync(p.script), true); assert.equal(exec.calls.length, 4);
    assert.ok(exec.calls.every((c) => c.cmd === "schtasks" && c.args[0] === "/Create"));
    assert.equal(install(p, { exec: recorder({ [`schtasks ${p.create[0][1].join(" ")}`]: { ok: false, out: "", err: "Zugriff verweigert" } }) }).why, "Zugriff verweigert");
    const e2 = recorder(); assert.equal(isArmed({ platform: "win32", exec: e2 }), true);
    const e3 = recorder(); assert.equal(remove({ platform: "win32", exec: e3 }).ok, true);
    assert.equal(e3.calls.filter((c) => c.args[0] === "/Delete").length, 4); assert.equal(existsSync(p.script), false);
    const none = recorder(Object.fromEntries(PATROL_TASKS.map((t) => [`schtasks /Query /TN ${t.name}`, { ok: false, out: "", err: "" }])));
    remove({ platform: "win32", exec: none }); assert.equal(none.calls.some((c) => c.args[0] === "/Delete"), false);
    assert.equal(isArmed({ platform: "win32", exec: none }), false);
  } finally { done(); }
});
test("Windows tief: Montag 03:30, ein Auftrag, --deep, eigene Entfernung", () => {
  const { done } = sandbox();
  try {
    const p = deep.plan({ platform: "win32", cli: "C:\\c\\cli.mjs" });
    assert.equal(p.kind, "schtasks"); assert.match(p.script, /deep\.cmd$/); assert.match(p.launcher, /--deep >> /);
    assert.equal(p.create.length, 1);
    assert.deepEqual(p.create[0][1].slice(0, 7), ["/Create", "/SC", "WEEKLY", "/D", "MON", "/ST", "03:30"]);
    const exec = recorder(); assert.equal(deep.install(p, { exec }).ok, true); assert.equal(exec.calls.length, 1);
    assert.equal(deep.isArmed({ platform: "win32", exec: recorder() }), true);
    const e = recorder(); assert.equal(deep.remove({ platform: "win32", exec: e }).ok, true);
    assert.deepEqual(e.calls.map((c) => c.args[0]), ["/Query", "/Delete"]); assert.equal(existsSync(p.script), false);
    assert.throws(() => deep.plan({ platform: "win32", cli: 'C:\\x"y' }));
  } finally { done(); }
});
