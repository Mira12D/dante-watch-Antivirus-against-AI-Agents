import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { handoffCommand, taskText } from "./handoff.mjs";

const HOSTILE = ["/Users/o'neil/my reports/2026-10-27.md", '/tmp/a"b$(touch pwn)`id`;&|<>/r.md', "/tmp/$HOME/\\x/${IFS}r.md", "C:\\Users\\Jo Ann\\.dante\\reports\\r.md"];
// run the shell command with `npx virgil-cli` swapped for printf: it must print exactly the task text, nothing executed
const echoed = (inner) => spawnSync("sh", ["-c", inner.replace(/^npx virgil-cli /, "printf %s ").replace(/; exec .*$/, "")], { encoding: "utf8" });

test("Mac: AppleScript + Shell-Quoting hält bei bösen Pfaden", () => {
  for (const p of HOSTILE) {
    const h = handoffCommand("mac", { reportPath: p });
    assert.deepEqual(h.argv.slice(0, 2), ["osascript", "-e"]);
    assert.match(h.argv[2], /^tell application "Terminal" to do script "/);
    // undo the AppleScript string escaping, then the shell must give back the task text unchanged
    const body = h.argv[2].slice('tell application "Terminal" to do script "'.length, -1).replace(/\\(["\\])/g, "$1");
    assert.equal(body, h.inner);
    const r = echoed(body); assert.equal(r.stdout, taskText(p)); assert.equal(r.stderr, "");
    assert.ok(h.show.includes("osascript"));
  }
});
test("Linux: x-terminal-emulator, sonst gnome-terminal, sonst Hinweis ohne argv", () => {
  const p = HOSTILE[1];
  let h = handoffCommand("linux", { reportPath: p });
  assert.equal(h.argv[0], "x-terminal-emulator"); assert.deepEqual(h.argv.slice(1, 4), ["-e", "sh", "-c"]);
  const r = echoed(h.argv[4]); assert.equal(r.stdout, taskText(p)); assert.equal(r.stderr, "");
  h = handoffCommand("linux", { reportPath: p, have: (c) => c === "gnome-terminal" });
  assert.deepEqual(h.argv.slice(0, 2), ["gnome-terminal", "--"]);
  h = handoffCommand("linux", { reportPath: p, have: () => false });
  assert.equal(h.argv, null); assert.match(h.show, /Kein Terminal/); assert.match(h.show, /npx virgil-cli/);
});
test("Windows: wt oder cmd /c start, Auftrag als Base64 (nichts Ausbrechbares im argv)", () => {
  const p = "C:\\Users\\O'Neil & Co\\%PATH%\\r.md";
  let h = handoffCommand("windows", { reportPath: p, have: (c) => c === "wt" });
  assert.deepEqual(h.argv.slice(0, 2), ["wt", "new-tab"]);
  h = handoffCommand("windows", { reportPath: p });
  assert.deepEqual(h.argv.slice(0, 4), ["cmd", "/c", "start", ""]);
  const enc = h.argv.at(-1); assert.match(enc, /^[A-Za-z0-9+/=]+$/);
  const ps = Buffer.from(enc, "base64").toString("utf16le");
  assert.ok(ps.startsWith("npx.cmd virgil-cli '")); assert.ok(ps.includes("O''Neil & Co"));
  assert.ok(handoffCommand("windows", { reportPath: "C:\\a\u2019b" }).inner.includes("a\u2019\u2019b"));
});
test("unbrauchbare Pfade und OS werfen; nichts wird ausgeführt", () => {
  assert.throws(() => handoffCommand("mac", { reportPath: "a\nb" }));
  assert.throws(() => handoffCommand("mac", { reportPath: "" }));
  assert.throws(() => handoffCommand("beos", { reportPath: "/a" }));
});
