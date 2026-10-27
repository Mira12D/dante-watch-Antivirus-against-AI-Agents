import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { php2shell } from "./php2shell.mjs";

// Windows cannot be run for real here: platform is faked to win32 and a fake `php` (shell script) is put alone on PATH.
// That checks the Windows decision logic (version only, no systemctl/changelog/os-release), not Windows process spawning.
function asWindows(phpBody, fn) {
  const dir = mkdtempSync(join(tmpdir(), "dante-php-")), oldPath = process.env.PATH, desc = Object.getOwnPropertyDescriptor(process, "platform");
  if (phpBody != null) { writeFileSync(join(dir, "php"), "#!/bin/sh\n" + phpBody + "\n"); chmodSync(join(dir, "php"), 0o755); }
  process.env.PATH = dir; Object.defineProperty(process, "platform", { value: "win32" });
  try { return fn(); } finally { process.env.PATH = oldPath; Object.defineProperty(process, "platform", desc); rmSync(dir, { recursive: true }); }
}
const ver = (v) => `echo "PHP ${v} (cli) (built: Oct 1 2026) (NTS Visual C++ 2019 x64)"`;
const cmds = (r) => r.evidence.map((e) => e.cmd);

test("Windows: verwundbare PHP-Version -> warn, Beweiszeile ist die echte php -v Zeile", { skip: process.platform === "win32" }, () => {
  asWindows(ver("8.2.20"), () => {
    const r = php2shell.run();
    assert.equal(r.verdict, "warn");
    assert.ok(r.evidence.some((e) => e.cmd === "php -v" && e.line.startsWith("PHP 8.2.20")));
    assert.ok(!cmds(r).some((c) => /systemctl|changelog|os-release|zcat/.test(c)));
  });
});
test("Windows: gepatchte Version -> safe mit php -v als Beleg", { skip: process.platform === "win32" }, () => {
  asWindows(ver("8.3.36"), () => {
    const r = php2shell.run();
    assert.equal(r.verdict, "safe");
    assert.ok(r.evidence.some((e) => e.cmd === "php -v" && e.line.startsWith("PHP 8.3.36")));
  });
});
test("Windows: neuere Linie als alle gelisteten -> safe", { skip: process.platform === "win32" }, () => {
  asWindows(ver("8.6.0"), () => assert.equal(php2shell.run().verdict, "safe"));
});
test("Windows: php fehlt -> unknown, nie safe", () => {
  asWindows(null, () => { const r = php2shell.run(); assert.equal(r.verdict, "unknown"); assert.equal(cmds(r)[0], "php -v"); });
});
test("Windows: Müll-Ausgabe -> unknown", () => {
  asWindows('echo "hallo welt"', () => assert.equal(php2shell.run().verdict, "unknown"));
});
test("Windows: php -v scheitert (Exit 1) mit Versionszeile -> unknown", () => {
  asWindows(ver("8.3.36") + "; exit 1", () => assert.equal(php2shell.run().verdict, "unknown"));
});
