// Waiting screen for long steps: one line with a moving block, a running dinosaur, the step name and
// the seconds. console.log is wrapped so output scrolls above the line. Terminal only;
// DANTE_NO_WAIT=1 turns it off.
import { quip } from "./quips.mjs";

const dim = (s) => `\x1b[2m${s}\x1b[0m`, cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const stack = [];
let timer = null, frame = 0, shown = 0, suppressed = 0;

const live = () => (!!process.stdout.isTTY || process.env.DANTE_FORCE_WAIT === "1") && !process.env.DANTE_NO_WAIT;
const BAR = 16, BLOCK = 4;

function line() {
  const top = stack[stack.length - 1];
  const secs = Math.floor((Date.now() - top.t0) / 1000);
  const period = (BAR - BLOCK) * 2, p = frame % period;
  const at = p < BAR - BLOCK ? p : period - p; // the block swings to and fro
  let bar = "";
  for (let i = 0; i < BAR; i++) bar += i >= at && i < at + BLOCK ? "▓" : "░";
  const dino = frame % 6 < 3 ? "🦖 " : " 🦖"; // runs, sniffs, runs
  const depth = stack.length > 1 ? dim(" (" + stack.length + " steps)") : "";
  const saying = secs >= 3 ? dim(" · " + quip()) : "";
  return "  " + cyan("▕" + bar + "▏") + " " + dino + " " + dim(top.label) + depth + dim(" · " + secs + "s") + saying;
}
const width = (s) => s.replace(/\x1b\[[0-9;]*m/g, "").length + 2; // an emoji is two columns wide

function clear() {
  if (shown > 0) { process.stdout.write("\r\x1b[2K"); shown = 0; }
}
function draw() {
  if (!live() || suppressed > 0 || !stack.length) return;
  frame++;
  const l = line();
  clear();
  process.stdout.write(l);
  shown = width(l);
}

const orig = { log: console.log, error: console.error };
let patched = false;
function patchConsole() {
  if (patched || !live()) return;
  patched = true;
  console.log = (...a) => { clear(); orig.log(...a); draw(); };
  console.error = (...a) => { clear(); orig.error(...a); draw(); };
}
function unpatchConsole() {
  if (!patched) return;
  console.log = orig.log; console.error = orig.error; patched = false;
}

/** Begin a long step. May nest — the innermost one is shown. */
export function waitStart(label) {
  stack.push({ label, t0: Date.now() });
  patchConsole();
  if (!timer && live()) { timer = setInterval(draw, 120); timer.unref?.(); }
  draw();
}
/** End the innermost step. */
export function waitEnd() {
  stack.pop();
  if (!stack.length) {
    if (timer) clearInterval(timer);
    timer = null; clear(); unpatchConsole();
  }
}
/** Do some work with the display — the line goes away by itself, even after an error. */
export async function waitFor(label, work) {
  waitStart(label);
  try { return await (typeof work === "function" ? work() : work); } finally { waitEnd(); }
}
/** Before any other output: line away. After it: draw again. */
export const waitHide = clear;
export const waitShow = draw;
/** A question needs the line: do not draw while it is asked. */
export function waitSuppress(on) {
  suppressed = Math.max(0, suppressed + (on ? 1 : -1));
  if (on) clear(); else draw();
}
