import test from "node:test";
import assert from "node:assert/strict";
import { idleCommand, parseIdle, shouldAppear, scheduleCommands, localDay } from "./daily.mjs";

const MAC = `+-o IOHIDSystem  <class IOHIDSystem, id 0x100000332>
    {
      "HIDIdleTime" = 4231000000
      "HIDParameters" = {"HIDClickTime"=500000000}
    }`;
test("Idle parsen: Mac (ns), Windows (Zahl), Linux (xprintidle ms, IdleHint)", () => {
  assert.equal(parseIdle("mac", MAC), 4.231);
  assert.equal(parseIdle("windows", "37,5\r\n"), 37.5); assert.equal(parseIdle("windows", "12.25"), 12.25);
  assert.equal(parseIdle("linux", "90000\n"), 90);
  assert.equal(parseIdle("linux", "IdleHint=no\n"), 0); assert.equal(parseIdle("linux", "IdleHint=yes\n"), 120);
});
test("Idle unlesbar = null, nie geraten", () => {
  for (const [os, t] of [["mac", "nothing"], ["mac", ""], ["windows", "Fehler: x"], ["linux", "Failed to get session"], ["linux", null], ["bsd", "5"]]) assert.equal(parseIdle(os, t), null);
});
test("Idle-Befehle sind lesend und ohne Netz", () => {
  for (const os of ["mac", "windows", "linux"]) assert.doesNotMatch(idleCommand(os), /curl|wget|ssh|http|Invoke-WebRequest|rm |del /);
  assert.match(idleCommand("mac"), /IOHIDSystem/); assert.match(idleCommand("linux"), /IdleHint/);
  const enc = idleCommand("windows").split(" ").pop();
  assert.match(Buffer.from(enc, "base64").toString("utf16le"), /GetLastInputInfo/);
});
test("shouldAppear Tabelle", () => {
  const now = new Date(2026, 9, 27, 14, 0, 0), day = localDay(now);
  assert.equal(day, "2026-10-27");
  const t = (o) => shouldAppear({ os: "mac", now, stamp: "2026-10-26", snoozedUntil: null, idleSeconds: 5, ...o });
  assert.equal(t({}).appear, true);
  assert.equal(t({ idleSeconds: null }).appear, false); assert.match(t({ idleSeconds: null }).why, /unknown/);
  assert.equal(t({ idleSeconds: NaN }).appear, false);
  assert.equal(t({ idleSeconds: 119.9 }).appear, true); assert.equal(t({ idleSeconds: 120 }).appear, false);
  assert.equal(t({ stamp: day }).appear, false);
  assert.equal(t({ snoozedUntil: new Date(2026, 9, 27, 23, 0) }).appear, false);
  assert.equal(t({ snoozedUntil: new Date(2026, 9, 27, 9, 0) }).appear, true);
  assert.equal(t({ stamp: "2026-10-27", now: new Date(2026, 9, 28, 0, 5) }).appear, true);
  assert.equal(t({ stamp: undefined }).appear, true);
});
test("Zeitplan: Text vor dem Ja, keine Netz-Verben, 30 Minuten", () => {
  const o = { nodePath: "/usr/local/bin/node", scriptPath: "/opt/d ante/cli.mjs" };
  for (const os of ["mac", "linux", "windows"]) {
    const s = scheduleCommands(os, { ...o, home: "/home/u" });
    assert.ok(s.install.length && s.remove.length);
    const all = [s.show, ...s.install, ...s.remove].join("\n");
    assert.doesNotMatch(all, /\b(curl|wget|nc|ncat|ssh|scp|ftp|telnet|Invoke-WebRequest|Invoke-RestMethod|http|https)\b/i);
    assert.ok(s.show.includes(s.install[0]) && s.show.includes(s.remove[0]));
  }
  assert.match(scheduleCommands("mac", o).install.join("\n"), /<integer>1800<\/integer>/);
  assert.match(scheduleCommands("linux", o).install.join("\n"), /OnUnitActiveSec=30min/);
  assert.match(scheduleCommands("linux", { ...o, kind: "cron" }).install[0], /\*\/30 \* \* \* \*/);
  assert.match(scheduleCommands("windows", { nodePath: "C:\\Program Files\\nodejs\\node.exe", scriptPath: "C:\\d\\cli.mjs" }).install[0], /\/SC MINUTE \/MO 30/);
  assert.match(scheduleCommands("linux", o).install.join("\n"), /'\/opt\/d ante\/cli.mjs'/);
});
test("Zeitplan: Windows-Pfad mit Anführungszeichen wird abgelehnt; unbekanntes OS wirft", () => {
  assert.throws(() => scheduleCommands("windows", { nodePath: 'C:\\a"b', scriptPath: "x" }));
  assert.throws(() => scheduleCommands("amiga", { nodePath: "a", scriptPath: "b" }));
});
