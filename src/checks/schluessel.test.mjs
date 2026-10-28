import test from "node:test";
import assert from "node:assert/strict";
import { parseAuthKeys, assess } from "./schluessel.mjs";
import { SAFE, WARN, UNKNOWN } from "../core/check.mjs";

const ED = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID1234567890abcdefghijklmnopqrstuvwxyzABCD";

test("parseAuthKeys: Typ, Kommentar, Optionen, Fingerabdruck; Kommentare und Müll werden übersprungen", () => {
  const text = [
    "# a comment line",
    "",
    ED + " alice@laptop",
    'command="/usr/bin/true",no-pty ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDxxx bob backup key',
    "not-a-key just words here",
    "ssh-ed25519",                       // no blob -> skipped
  ].join("\n");
  const k = parseAuthKeys(text);
  assert.equal(k.length, 2);
  assert.equal(k[0].type, "ssh-ed25519");
  assert.equal(k[0].comment, "alice@laptop");
  assert.match(k[0].fp, /^SHA256:[A-Za-z0-9+/]+$/);
  assert.equal(k[1].type, "ssh-rsa");
  assert.equal(k[1].comment, "bob backup key");
  assert.ok(k[1].options.includes("command="));
});

test("gleicher Schlüssel = gleicher Fingerabdruck, anderer = anderer", () => {
  const a = parseAuthKeys(ED + " x")[0].fp;
  const b = parseAuthKeys(ED + " y")[0].fp;              // comment differs, key same -> same fp
  const c = parseAuthKeys("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB z")[0].fp;
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("assess: nichts lesbar -> unbekannt", () => {
  assert.equal(assess([], { ran: false }).verdict, UNKNOWN);
});

test("assess: lief, keine Schlüssel -> sicher (leer)", () => {
  const a = assess([], { ran: true });
  assert.equal(a.verdict, SAFE);
  assert.equal(a.empty, true);
});

test("assess: normale Schlüssel bei Login-Konten -> sicher, aber gelistet", () => {
  const entries = [{ user: "root", shell: "/bin/bash", path: "/root/.ssh/authorized_keys", mode: "600", keys: parseAuthKeys(ED + " me@home") }];
  const a = assess(entries, { ran: true });
  assert.equal(a.verdict, SAFE);
  assert.equal(a.total, 1);
  assert.ok(a.ev.some((e) => e.grounded && e.line.includes("me@home")));
});

test("assess: beschreibbare authorized_keys -> Warnung", () => {
  const entries = [{ user: "deploy", shell: "/bin/bash", path: "/home/deploy/.ssh/authorized_keys", mode: "666", keys: parseAuthKeys(ED + " x") }];
  const a = assess(entries, { ran: true });
  assert.equal(a.verdict, WARN);
  assert.ok(a.problems.some((p) => /beschreibbar/.test(p.claim)));
});

test("assess: Schlüssel bei Konto ohne Login -> Warnung", () => {
  const entries = [{ user: "www-data", shell: "/usr/sbin/nologin", path: "/var/www/.ssh/authorized_keys", mode: "600", keys: parseAuthKeys(ED + " x") }];
  const a = assess(entries, { ran: true });
  assert.equal(a.verdict, WARN);
  assert.ok(a.problems.some((p) => /nicht anmelden/.test(p.claim)));
  assert.ok(a.ev.some((e) => e.line.includes("[Konto ohne Login]")));
});
