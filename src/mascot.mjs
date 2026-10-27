// Dante sprite and lettering. Pixel art drawn with 256-colour half blocks, two pixel rows per text line.

// 256-colour palette per legend char. "." = transparent.
const PAL = {
  H: 23,  // hood / robe (deep teal)
  B: 24,  // robe body (calm blue)
  F: 234, // face in shadow
  S: 252, // sword blade (bright steel)
  s: 245, // blade shadow
  G: 214, // cross-guard (gold)
  h: 94,  // hilt (brown)
};

// 18 rows × 17 cols -> 9 text rows. Figure left, sword held upright on the right.
const ART = [
  "....HHHH......S..",
  "...HHHHHH.....S..",
  "..HHHHHHHH....Ss.",
  "..HHFFFFHH....Ss.",
  "..HHFFFFHH....Ss.",
  "..HHHFFHHH....Ss.",
  ".HHHHHHHHHH..GGGG",
  ".HHBBBBBBHH...hh.",
  ".HBBBBBBBBH...hh.",
  ".HBBBBBBBBH......",
  ".HBBBBBBBBH......",
  ".HBBBBBBBBH......",
  ".HHBBBBBBHH......",
  ".HHHBBBBHHH......",
  ".HHHHHHHHHH......",
  "..HHHHHHHH.......",
  "..HHHHHHHH.......",
  "..HHHHHHHH.......",
];

function cell(top, bot) {
  const t = PAL[top], b = PAL[bot];
  if (t === undefined && b === undefined) return " ";
  if (t !== undefined && b === undefined) return `\x1b[38;5;${t}m▀\x1b[0m`;
  if (t === undefined && b !== undefined) return `\x1b[38;5;${b}m▄\x1b[0m`;
  return `\x1b[38;5;${t}m\x1b[48;5;${b}m▀\x1b[0m`;
}

/** The sprite as an array of ready-to-print lines. */
export function danteLines() {
  const lines = [];
  for (let r = 0; r < ART.length; r += 2) {
    const top = ART[r], bot = ART[r + 1] ?? "";
    let line = "";
    for (let c = 0; c < top.length; c++) line += cell(top[c] ?? ".", bot[c] ?? ".");
    lines.push(line);
  }
  return lines;
}
export const danteSprite = () => danteLines().join("\n");

// Lettering: one small glyph per letter, four rows each.
const GLYPH = {
  D: [" ___  ", "|   \\ ", "| |) |", "|___/ "],
  A: ["   _   ", "  /_\\  ", " / _ \\ ", "/_/ \\_\\"],
  N: [" _  _ ", "| \\| |", "| .` |", "|_|\\_|"],
  T: [" _____ ", "|_   _|", "  | |  ", "  |_|  "],
  E: [" ___ ", "| __|", "| _| ", "|___|"],
};
export const WORDMARK = [0, 1, 2, 3].map((row) => " " + [..."DANTE"].map((ch) => GLYPH[ch][row]).join(""));

// The start screen, line by line: the sprite, the lettering in teal, the sentence under it.
export function startLines(tagline) {
  const teal = (s) => `\x1b[38;5;30m\x1b[1m${s}\x1b[0m`;
  return ["", ...danteLines().map((l) => "   " + l), "", ...WORDMARK.map(teal), "", "  " + tagline, ""];
}

// One-shot runs (cron, a pipe): the plain name; in a terminal the sprite above it.
export function banner() {
  const tty = process.stdout.isTTY && !process.env.NO_COLOR;
  const name = tty ? "\x1b[1mDante\x1b[0m \x1b[2m· er geht durch die Hölle und bringt die Karte\x1b[0m" : "Dante · wächter";
  return tty ? danteSprite() + "\n" + name : name;
}
