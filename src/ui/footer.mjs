// Two-line footer kept at the bottom through a terminal scroll region: a rule and a tip that changes
// per input, plus the clock. Only on a real terminal. The scroll region is always reset on exit.
import { lang } from "../i18n.mjs";
import { tipAt, clockText, age, STALE } from "../ticker.mjs";

let on = false, timer = null, tipIdx = Math.floor(Math.random() * 8);
const rows = () => process.stdout.rows || 24, cols = () => process.stdout.columns || 80;
const dim = (s) => `\x1b[2m${s}\x1b[0m`, yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cut = (s, n) => (s.length > n ? s.slice(0, Math.max(0, n - 1)) + "…" : s);

function draw() {
  if (!on) return;
  const r = rows(), c = cols(), clock = clockText();
  const tip = cut(tipAt(tipIdx, lang()), Math.max(10, c - 4 - clock.length - 3));
  const gap = " ".repeat(Math.max(1, c - 4 - tip.length - clock.length - 2));
  const row = dim("  ◍ ") + yellow(tip) + gap + (age() > STALE ? yellow(clock) : dim(clock));
  // save the cursor -> the two reserved lines -> clear + write -> cursor back
  process.stdout.write("\x1b7" + `\x1b[${r - 1};1H\x1b[2K` + dim("─".repeat(Math.max(10, c - 2))) + `\x1b[${r};1H\x1b[2K` + row + "\x1b8");
}

export function footerStart() {
  if (!process.stdout.isTTY || process.env.DANTE_NO_FOOTER || on) return;
  on = true;
  const r = rows();
  process.stdout.write(`\x1b[1;${r - 2}r`);   // scroll region = the top, without the lowest 2 lines
  process.stdout.write(`\x1b[${r - 2};1H`);   // cursor into the upper part
  draw();
  // four times a second, so the footer stays visible even when readline or other output paints over it
  timer = setInterval(draw, 250); timer.unref?.();
  process.stdout.on("resize", draw);
  process.on("exit", footerStop);
}
// The terminal tab shows the name of the program: "Dante" while he runs, handed back to the shell on exit.
export function setTitle(name) {
  if (process.stdout.isTTY && !process.env.NO_COLOR) process.stdout.write(`\x1b]0;${name}\x07`);
}

export function footerStop() {
  setTitle("");
  if (!on) return;
  on = false;
  if (timer) { clearInterval(timer); timer = null; }
  const r = rows();
  process.stdout.write("\x1b[r");   // scroll region back to the whole screen
  process.stdout.write(`\x1b[${r - 1};1H\x1b[2K\x1b[${r};1H\x1b[2K`);
  try { process.stdout.off("resize", draw); } catch { /* fine */ }
}
/** The next tip — call before every input. */
export function footerNext() { if (on) { tipIdx++; draw(); } }
export const footerOn = () => on;
