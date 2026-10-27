import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { worldWritableFiles } from "./fsx.mjs";
import { configureTarget } from "./sh.mjs";

const posix = process.platform !== "win32";

test("die Haus-Suche findet dasselbe wie find (Mac/Linux)", { skip: !posix }, () => {
  const d = mkdtempSync(join(tmpdir(), "dante-fsx-"));
  try {
    mkdirSync(join(d, "a", "b", "c", "deep"), { recursive: true });
    const mk = (p, mode) => { writeFileSync(join(d, p), "x"); chmodSync(join(d, p), mode); };
    mk("open.txt", 0o666); mk("closed.txt", 0o644); mk("a/open2.conf", 0o666); mk("a/b/c/open3", 0o666); mk("a/b/c/deep/open4", 0o666);
    symlinkSync(join(d, "open.txt"), join(d, "link"));
    configureTarget(null);
    const mine = worldWritableFiles([d], { depth: 3 }).files.sort();
    const theirs = spawnSync("find", [d, "-xdev", "-maxdepth", "3", "-type", "f", "-perm", "-0002"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).sort();
    assert.deepEqual(mine, theirs);
    assert.equal(mine.length, 2);   // open.txt and a/open2.conf; the link, the closed file and everything deeper than 3 levels are not in it
  } finally { rmSync(d, { recursive: true, force: true }); }
});
test("das Limit wird eingehalten und ein fehlender Ordner ist nicht gesucht", { skip: !posix }, () => {
  const d = mkdtempSync(join(tmpdir(), "dante-fsx-"));
  try {
    for (let i = 0; i < 20; i++) { writeFileSync(join(d, "f" + i), "x"); chmodSync(join(d, "f" + i), 0o666); }
    configureTarget(null);
    assert.equal(worldWritableFiles([d], { limit: 12 }).files.length, 12);
    const r = worldWritableFiles([join(d, "gibt-es-nicht")]); assert.equal(r.ran, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

import { findFiles, grepFiles, existingDirs, readText, execProgram } from "./fsx.mjs";

function scene2(fn) {
  const d = mkdtempSync(join(tmpdir(), "dante-fsx2-"));
  try {
    mkdirSync(join(d, "site", "app", ".git"), { recursive: true });
    const w = (p, t, mode = 0o644) => { writeFileSync(join(d, p), t); chmodSync(join(d, p), mode); };
    w("site/.env", "A=1\n", 0o644); w("site/private.sql", "x", 0o600); w("site/dump.sql", "x", 0o644);
    w("site/app/.git/config", "[core]\n", 0o644); w("site/index.php", "<?php echo 1;", 0o644); w("site/app/shell.php", "<?php eval($_POST['x']);", 0o644);
    configureTarget(null); return fn(d);
  } finally { rmSync(d, { recursive: true, force: true }); }
}

test("Dateisuche nach Namen: Haus-Motor und find liefern dasselbe", { skip: !posix }, () => scene2((d) => {
  const names = [".env", "*.sql", ".git/config"];
  const mine = findFiles([join(d, "site")], { names, depth: 4, worldReadable: true }).files.sort();
  const pick = ["-name", ".env", "-o", "-name", "*.sql", "-o", "-path", "*/.git/config"];
  const theirs = spawnSync("find", [join(d, "site"), "-maxdepth", "4", "-type", "f", "(", ...pick, ")", "-perm", "-0004"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).sort();
  assert.deepEqual(mine, theirs);
  assert.equal(mine.length, 3);   // .env, dump.sql, app/.git/config - private.sql (0600) is not readable by all
}));
test("Textsuche: Haus-Motor und grep liefern dasselbe", { skip: !posix }, () => scene2((d) => {
  const re = "eval\\(\\$_POST";
  const mine = grepFiles([join(d, "site")], re, { glob: "*.php" });
  const theirs = spawnSync("grep", ["-rlE", re, "--include=*.php", join(d, "site")], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).sort();
  assert.equal(mine.ran, true); assert.deepEqual(mine.files.sort(), theirs); assert.equal(theirs.length, 1);
}));
test("Ordner, Datei lesen, Programm ohne Shell", () => scene2((d) => {
  assert.deepEqual(existingDirs([join(d, "site"), join(d, "nein")]).dirs, [join(d, "site")]);
  assert.equal(readText(join(d, "site", ".env")).text, "A=1\n");
  assert.equal(readText(join(d, "gibt-es-nicht")).ran, false);
  const r = execProgram(process.execPath, ["-e", "console.log('hallo')"]); assert.equal(r.out, "hallo"); assert.equal(r.ok, true);
  assert.equal(execProgram("dieses-programm-gibt-es-nicht-x", []).ran, false);
}));

import { tcpOpen } from "./fsx.mjs";
import net from "node:net";
test("tcpOpen: offener Port ja, geschlossener Port nein (Verbindung nur auf diesem Rechner)", async () => {
  const srv = net.createServer((c) => c.end()); await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  const open = await new Promise((r) => setImmediate(() => r(tcpOpen(port))));   // the child connects while this process keeps listening
  assert.equal(open.ran, true); assert.equal(open.open, true);
  await new Promise((r) => srv.close(r));
  const closed = tcpOpen(port); assert.equal(closed.ran, true); assert.equal(closed.open, false);
});
