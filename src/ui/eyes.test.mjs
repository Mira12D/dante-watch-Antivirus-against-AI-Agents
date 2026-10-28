import test from "node:test";
import assert from "node:assert/strict";
import { eyesFrame, playLook, STATES } from "./eyes.mjs";

const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

test("alle Zustände: gleiche Zeilenzahl und gleiche sichtbare Breite", () => {
  const ref = eyesFrame("open", { color: false });
  for (const color of [true, false]) for (const s of STATES) {
    const f = eyesFrame(s, { color });
    assert.equal(f.length, ref.length, s);
    for (const l of f) assert.equal(plain(l).length, plain(ref[0]).length, s);
  }
});
test("ohne Farbe keine Escape-Folgen, mit Farbe rotes Pupillen-SGR", () => {
  for (const s of STATES) assert.ok(!eyesFrame(s, { color: false }).join("").includes("\x1b"), s);
  assert.ok(eyesFrame("open").join("").includes("\x1b[31m"));
});
test("Zustände unterscheiden sich; Blinzeln ist flach", () => {
  const set = new Set(STATES.map((s) => eyesFrame(s, { color: false }).join("\n")));
  assert.equal(set.size, STATES.length);
  assert.ok(eyesFrame("blink", { color: false }).some((l) => l.includes("▄▄▄▄▄▄▄▄▄")));
});
test("playLook ohne TTY: deterministisch, alle Labels, keine Escapes", async () => {
  const run = async () => { let o = ""; await playLook((s) => (o += s), ["~/.ssh/config", "the system"], { tty: false }); return o; };
  const a = await run();
  assert.equal(a, await run());
  assert.ok(a.includes("~/.ssh/config\n") && a.includes("the system\n"));
  assert.ok(!a.includes("\x1b"));
});
test("playLook mit TTY: fertig, Cursor-hoch, kein Wurf, auch bei kaputtem Stream", async () => {
  let o = ""; await playLook((s) => (o += s), ["x", "y"], { tty: true, color: true, sleep: async () => {} });
  assert.ok(/\x1b\[5A/.test(o) && o.includes("\x1b[2K") && o.includes("x") && o.includes("y"));
  assert.ok(o.endsWith("\x1b[?25h"));
  await playLook(() => { throw new Error("closed"); }, ["x"], { tty: true, sleep: async () => {} });
});
