import test from "node:test";
import assert from "node:assert/strict";
import { collect, scriptFor, splitSections, WAY_PROBES } from "./collect.mjs";

// no write / delete / network / process-control verbs in any snippet
const BAD_UNIX = /\b(rm|mv|cp|curl|wget|nc|ncat|tee|chmod|chown|kill|pkill|(?<!getent group )sudo|dd|mkdir|touch|ln|scp|ssh(?=\s)|ftp|telnet|sed -i|truncate|install|launchctl (load|unload|bootstrap|kickstart)|systemctl (start|stop|enable|disable|restart))\b/;
const BAD_PS = /\b(Set|Remove|New|Start|Stop|Invoke|Add|Clear|Out|Move|Copy|Rename|Restart|Enable|Disable|Register|Unregister|Install|Send|Write|Import|Export)-[A-Za-z]/i;
// output redirection is only allowed as the "discard errors / merge errors" forms
const stripRedirect = (s) => s.replace(/2>\/dev\/null/g, "").replace(/2>&1/g, "");

test("WAY_PROBES: every snippet is read-only (no write, delete, network, kill, redirect)", () => {
  for (const [os, probes] of Object.entries(WAY_PROBES)) {
    assert.ok(Object.keys(probes).length >= 8, os);
    for (const [id, snip] of Object.entries(probes)) {
      const s = stripRedirect(snip);
      assert.ok(!s.includes(">"), `${os}/${id}: redirect`);
      if (os === "windows") {
        assert.ok(!BAD_PS.test(s), `${os}/${id}: PowerShell verb`);
        assert.ok(!snip.includes('"'), `${os}/${id}: double quote would break the -Command string`);
      } else {
        assert.ok(!BAD_UNIX.test(s), `${os}/${id}: ${(BAD_UNIX.exec(s) || [])[0]}`);
      }
    }
  }
});

test("scripts: unix has one marker per probe, windows is one powershell -Command", () => {
  for (const os of ["mac", "linux"]) {
    const sc = scriptFor(os);
    for (const id of Object.keys(WAY_PROBES[os])) assert.ok(sc.includes(`echo '@@${id}'`), id);
    assert.ok(sc.endsWith("echo '@@end'"));
  }
  const w = scriptFor("windows");
  assert.ok(w.startsWith('powershell -NoProfile -NonInteractive -Command "'));
  assert.ok(w.endsWith(`'@@end'"`));
  assert.equal(w.split('"').length, 3); // exactly the two wrapping quotes
  for (const id of Object.keys(WAY_PROBES.windows)) assert.ok(w.includes(`'@@${id}'`), id);
  assert.throws(() => scriptFor("plan9"));
});

test("authorized_keys snippet prints no key material (only type and comment fields)", () => {
  for (const os of ["mac", "linux"]) {
    const s = WAY_PROBES[os].authkeys;
    assert.ok(s.includes('print "key|" $i "|" c'));
    assert.ok(!/\bcat\b/.test(s)); // never dumps the file
  }
});

test("splitSections handles CRLF and keeps empty sections empty", () => {
  const r = splitSections("@@a\r\nx\r\n\r\n@@b\r\n\r\n@@end\r\n");
  assert.deepEqual(r, { a: "x", b: "" });
});

// a runner that answers like a Mac where some probes work and some do not
const MAC_OUT = [
  "@@listen", "COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME", "node 1 me 20u IPv4 0x2 0t0 TCP *:3000 (LISTEN)", "",
  "@@launchctl", "", // printed nothing -> gap
  "@@launchdirs", "ls: /Users/me/Library/LaunchAgents: No such file or directory", "ls: /Library/LaunchAgents: No such file or directory",
  "total 0", "", // dirs without plists: readable, no facts
  "@@cron", "no crontab for me", "",
  "@@authkeys", "unreadable", "",
  "@@stale", "", // nothing old is a legitimate answer
  "@@users", "me  /bin/zsh", "",
  "@@admins", "", // missing -> accounts cannot be judged
  "@@guest", "The domain/default pair of (/Library/Preferences/com.apple.loginwindow, GuestEnabled) does not exist", "",
  "@@mta", "",
  "@@end",
].join("\n");

test("collect: unreadable probes go to gaps, never to facts; readable-but-empty ones do not", async () => {
  const seen = [];
  const r = await collect("mac", (script) => { seen.push(script); return Promise.resolve({ out: MAC_OUT, err: "", code: 0 }); }, { now: Date.parse("2026-10-27T12:00:00") });
  assert.equal(seen.length, 1);
  assert.equal(r.os, "mac");
  assert.deepEqual(r.facts.map((f) => f.kind), ["listen"]);
  const text = r.gaps.join("\n");
  assert.match(text, /loaded launchd jobs: could not be read \(no output\)/);
  assert.match(text, /authorized_keys: could not be read \(not readable/);
  assert.match(text, /admin group/);
  assert.match(text, /guest account: could not be read \(only error output\)/);
  assert.ok(!/user crontab|old files|launchd agent|mail server|listening/.test(text));
  assert.equal(r.facts.some((f) => f.kind === "account"), false); // admins unknown: no accounts claimed
});

test("collect: runner that fails or throws makes every probe a gap and no fact", async () => {
  for (const runner of [() => ({ out: "", err: "no shell", code: -1 }), () => { throw new Error("boom"); }, async () => undefined]) {
    const r = await collect("linux", runner);
    assert.deepEqual(r.facts, []);
    assert.equal(r.gaps.length, Object.keys(WAY_PROBES.linux).length);
  }
});

test("collect: a script cut off half way marks the missing probes as gaps", async () => {
  const r = await collect("linux", () => ({ out: "@@listen\ntcp LISTEN 0 4096 0.0.0.0:22 0.0.0.0:* users:((\"sshd\",pid=1,fd=3))\n\n@@cron\nno crontab for me\n", err: "", code: 124 }));
  assert.equal(r.facts.length, 1);
  assert.ok(r.gaps.some((g) => /systemd timers: could not be read \(probe did not run\)/.test(g)));
  assert.ok(!r.gaps.some((g) => /listening ports|user crontab/.test(g)));
});

test("collect (windows): OK marker means read, ERR or missing marker means gap", async () => {
  const out = [
    "@@listen", "L|0.0.0.0|135|svchost", "OK",
    "@@tasks", "OK", // read, no non-Microsoft tasks
    "@@startup", "ERR",
    "@@runkeys", "R|HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run|Spotify", "OK",
    "@@startupdir", "OK",
    "@@stale", "OK",
    "@@users", "A|me|True|S-1-5-21-1-1001", "OK",
    "@@admins", "G|PC\\me", "OK",
    "@@end",
  ].join("\r\n"); // mta never ran
  const r = await collect("windows", () => ({ out, err: "", code: 0 }));
  assert.deepEqual(r.facts.map((f) => f.kind).sort(), ["account", "listen", "persist"]);
  assert.ok(r.gaps.some((g) => /startup commands: could not be read \(cmdlet failed\)/.test(g)));
  assert.ok(r.gaps.some((g) => /mail server: could not be read \(probe did not run\)/.test(g)));
  assert.equal(r.gaps.length, 2);
});
