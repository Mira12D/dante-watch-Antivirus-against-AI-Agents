// Two pixel eyes that look around while Dante scans the machine (onboarding).
// Pure Node, no dependencies. Every state has the same line count and visible width.
const W = 9, GAP = 4;
const BASE = [" ▄█████▄ ", "█████████", "█████████", " ▀█████▀ "];
// pupil: top row, left column (pupil is 3 columns x 2 rows)
const PUPIL = { open: [1, 3], left: [1, 1], right: [1, 5], up: [0, 3] };
export const STATES = ["open", "left", "right", "blink", "up"];

const RED = "\x1b[31m", BRIGHT = "\x1b[97m", OFF = "\x1b[0m";

function eye(state, color) {
  if (state === "blink") return ["         ", "         ", "▄▄▄▄▄▄▄▄▄", "         "].map((l) => (color ? BRIGHT + l + OFF : l));
  const [pr, pc] = PUPIL[state] || PUPIL.open;
  return BASE.map((row, r) => {
    if (r < pr || r > pr + 1) return color ? BRIGHT + row + OFF : row;
    const a = row.slice(0, pc), mid = row.slice(pc, pc + 3), b = row.slice(pc + 3);
    // a pupil cell only exists where the eye is solid; edges stay white. Without color the pupil is a hole.
    const pupil = color ? RED + mid + OFF : mid.replace(/█/g, " ");
    return color ? BRIGHT + a + OFF + pupil + BRIGHT + b + OFF : a + pupil + b;
  });
}

export function eyesFrame(state, { color = true } = {}) {
  const e = eye(state, color);
  return e.map((l) => l + " ".repeat(GAP) + eye(state, color)[e.indexOf(l)]);
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const SEQ = ["open", "left", "right", "blink", "up"];

// Plays the eyes while `labels` (the places Dante looks at) go by, about one per 2 frames.
// No TTY: no animation, no timers, one plain "open" frame plus the labels on their own lines.
export async function playLook(write, labels = [], { tty = process.stdout.isTTY, color = tty && !process.env.NO_COLOR, frames = 8, delayMs = 180, sleep = realSleep } = {}) {
  // a closed stream must never crash onboarding
  const out = (s) => { try { write(s); } catch {} };
  labels = (Array.isArray(labels) ? labels : []).map((l) => strip(String(l)));
  try {
    if (!tty) {
      out(eyesFrame("open", { color: false }).join("\n") + "\n" + labels.map((l) => l + "\n").join(""));
      return;
    }
    const n = eyesFrame("open", { color }).length + 1; // eyes + label line
    const draw = (state, label, first) => {
      let s = first ? "" : `\x1b[${n}A`;
      for (const l of [...eyesFrame(state, { color }), label]) s += "\r\x1b[2K" + l + "\n";
      out(s);
    };
    out("\x1b[?25l");
    for (let i = 0; i < Math.max(1, frames); i++) {
      draw(SEQ[i % SEQ.length], labels.length ? labels[Math.floor(i / 2) % labels.length] : "", i === 0);
      await sleep(delayMs);
    }
    draw("open", labels.length ? labels[labels.length - 1] : "", false); // end clean on open eyes
  } catch {} finally { if (tty) out("\x1b[?25h"); }
}
