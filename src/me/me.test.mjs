import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sshHosts, knownHosts, projects, lookAround, whoAmI } from "./recon.mjs";
import { serialize, parse, read, write, exists } from "./user.mjs";
import { parseOverview, OVERVIEW } from "./overview.mjs";
import { isOwnerOnly } from "../core/perm.mjs";

// a made-up home: an ssh config, known_hosts (some hashed), two git projects and one plain folder
function fakeHome() {
  const home = mkdtempSync(join(tmpdir(), "dante-home-"));
  mkdirSync(join(home, ".ssh"), { recursive: true });
  writeFileSync(join(home, ".ssh", "config"), [
    "# my servers", "Host kueche", "  HostName 203.0.113.10", "  User root", `  IdentityFile ${home}/.ssh/kueche_key`, "",
    "Host kasse blech", "  HostName 203.0.113.20", "  User deploy", "",
    "Host *", "  ServerAliveInterval 30", "", "Host git-*", "  User git",
  ].join("\n"));
  writeFileSync(join(home, ".ssh", "known_hosts"), ["|1|abc=|def= ssh-ed25519 AAAA", "203.0.113.10 ssh-ed25519 AAAA", "[198.51.100.7]:2222,198.51.100.7 ssh-rsa AAAA", "github.com,140.82.1.1 ssh-rsa AAAA", "# comment"].join("\n"));
  for (const p of ["alpha", "beta"]) { mkdirSync(join(home, p, ".git"), { recursive: true }); }
  mkdirSync(join(home, "Developer", "gamma", ".git"), { recursive: true });
  mkdirSync(join(home, "notes"), { recursive: true });
  mkdirSync(join(home, "Downloads", "skipme", ".git"), { recursive: true });
  return home;
}
const run = (cmd) => (cmd.includes("user.name") ? "Test Person" : "");

test("ssh config: Aliase, Ziel, Benutzer, Schlüsselpfad; Platzhalter-Hosts fallen weg", () => {
  const home = fakeHome();
  try {
    const h = sshHosts(home);
    assert.deepEqual(h.map((x) => x.alias), ["kueche", "kasse", "blech"]);
    assert.equal(h[0].target, "root@203.0.113.10"); assert.equal(h[0].key, "~/.ssh/kueche_key");   // the path, with ~, never the key itself
    assert.equal(h[1].target, "deploy@203.0.113.20"); assert.equal(h[1].key, "");
  } finally { rmSync(home, { recursive: true, force: true }); }
});
test("known_hosts: nur lesbare Einträge, ohne Config-Hosts, ohne Port-Klammern, ohne Code-Hosting (github.com)", () => {
  const home = fakeHome();
  try { assert.deepEqual(knownHosts(home, ["203.0.113.10"]), ["198.51.100.7", "140.82.1.1"]); }
  finally { rmSync(home, { recursive: true, force: true }); }
});
test("Projekte: Ordner mit .git, auch unter Developer, ohne Downloads, nur Namen", () => {
  const home = fakeHome();
  try { assert.deepEqual(projects(home).sort(), ["alpha", "beta", "gamma"]); }
  finally { rmSync(home, { recursive: true, force: true }); }
});
test("Umschauen ohne ssh-Dateien und ohne Projekte liefert leere Listen, nie einen Fehler", () => {
  const home = mkdtempSync(join(tmpdir(), "dante-home-"));
  try { const f = lookAround({ home, run }); assert.deepEqual([f.hosts, f.hints, f.projects], [[], [], []]); assert.equal(f.name, "Test Person"); assert.equal(f.nameSource, "git"); assert.ok(f.system.includes("(")); }
  finally { rmSync(home, { recursive: true, force: true }); }
});
test("der Name: Git zuerst, dann das System", () => {
  assert.deepEqual(whoAmI((c) => (c.includes("user.name") ? "Git Name" : "System Name")), { name: "Git Name", source: "git" });
  assert.equal(whoAmI((c) => (c.includes("user.name") ? "" : "System Name")).source, "system");
});
test("user.md: schreiben, wieder lesen, gleicher Inhalt; die Datei ist nur für den Besitzer lesbar", () => {
  const dir = mkdtempSync(join(tmpdir(), "dante-u-")), old = process.env.DANTE_HOME; process.env.DANTE_HOME = dir;
  try {
    assert.equal(exists(), false); assert.equal(read(), null);
    const u = { name: "Alex", lang: "de", created: "2026-10-26", system: "macOS 26.4.1 (arm64)",
      servers: [{ alias: "kueche", target: "root@203.0.113.10", key: "~/.ssh/k", os: "Ubuntu 26.04", patrol: true }, { alias: "kasse", target: "deploy@203.0.113.20", key: "", os: "", patrol: false }],
      projects: ["alpha", "beta"], patrol: { armed: true, times: ["00:00", "12:00"], since: "2026-10-26" } };
    write(u);
    assert.equal(exists(), true); assert.deepEqual(read(), u);
    assert.notEqual(isOwnerOnly(join(dir, "user.md")), false);
  } finally { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(dir, { recursive: true, force: true }); }
});
test("user.md: ein Satz, den der Mensch dazuschreibt, oder eine Zeile mit Zeilenumbruch bricht nichts", () => {
  const md = serialize({ name: "Eine\nZeile", servers: [], projects: [], patrol: { armed: false, times: [] } }) + "\nIch bin Alextafa und schreibe hier einfach etwas.\n- das hier ist kein Schlüssel-Wert\n";
  const u = parse(md);
  assert.equal(u.name, "Eine Zeile"); assert.deepEqual(u.servers, []); assert.equal(u.patrol.armed, false);
});
test("Systemübersicht: KEY=value, der Name des Systems kommt aus os-release oder dem Mac", () => {
  assert.equal(parseOverview("OS=Ubuntu 26.04.1 LTS\nID=ubuntu\nVER=26.04\nARCH=x86_64\nWEB=nginx ").label, "Ubuntu 26.04.1 LTS");
  assert.equal(parseOverview("OS=\nMAC=macOS 26.4.1\nID=").label, "macOS 26.4.1");
  assert.equal(parseOverview("").label, ""); assert.ok(OVERVIEW.includes("PRETTY_NAME"));
});

test("ein System mit ' · ' im Text (Ubuntu · PHP) verliert weder Text noch Streife-Flag", () => {
  const u = { name: "A", lang: "de", created: "2026-01-01", updated: "2026-01-01", system: "x", servers: [{ alias: "web", target: "root@h", key: "", os: "Ubuntu 26.04 · PHP 8.3", patrol: true }, { alias: "db", target: "a@b", key: "~/.ssh/k", os: "", patrol: false }], projects: [], patrol: { armed: false, times: [], since: "" } };
  const back = parse(serialize(u));
  assert.deepEqual(back.servers.map((s) => [s.alias, s.os, s.patrol, s.key]), [["web", "Ubuntu 26.04 · PHP 8.3", true, ""], ["db", "", false, "~/.ssh/k"]]);
});

import { osName } from "./recon.mjs";
test("osName ohne Shell: darwin sw_vers, win32 os.release, linux PRETTY_NAME", () => {
  const calls = [];
  const exec = (c, a) => { calls.push([c, a]); return { ok: true, out: a[0] === "-productName" ? "macOS" : "26.4" }; };
  assert.equal(osName({ platform: "darwin", exec }), "macOS 26.4");
  assert.deepEqual(calls, [["sw_vers", ["-productName"]], ["sw_vers", ["-productVersion"]]]);
  assert.equal(osName({ platform: "win32", rel: () => "10.0.22631" }), "Windows 10.0.22631");
  assert.equal(osName({ platform: "linux", read: () => ({ text: 'NAME="Ubuntu"\nPRETTY_NAME="Ubuntu 26.04 LTS"\n' }) }), "Ubuntu 26.04 LTS");
  assert.equal(osName({ platform: "linux", read: () => ({ text: "" }) }), "");
});
