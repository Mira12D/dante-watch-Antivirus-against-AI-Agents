// Text that comes from the outside (a file name, a line of a scanned file, what a server printed) is data, never a command to the
// terminal. A hostile folder or server could otherwise send escape sequences that clear the screen, overwrite a verdict line, set the
// window title or write to the clipboard - the same class of hole found in other scanners. Everything untrusted passes through here.
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g;               // operating-system commands: title, clipboard, hyperlinks
const DCS = /\x1b[PX^_][^\x1b]*(?:\x1b\\)?/g;                    // device control, string, privacy message, application command
// control characters except newline and tab; CSI/ESC lose their escape byte, so "[2J" stays as harmless visible text; line-overwriting
// carriage returns, the C1 range, and the bidi/zero-width marks that make text read differently from what it is
const CTRL = new RegExp("[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]", "g");

export const clean = (s) => String(s ?? "").replace(OSC, "").replace(DCS, "").replace(CTRL, "");
export const cleanAll = (list) => (Array.isArray(list) ? list.map(clean) : list);

// Last line of defence for everything printed: only plain colour sequences (the ones Dante itself writes) survive; every other escape
// sequence, a lone escape byte and carriage returns are removed. Our own colours use these parameters only.
const SGR_OK = /^\x1b\[(?:\d{1,3}(?:;\d{1,3}){0,3})?m/;
export function guardOutput(s) {
  const t = String(s).replace(OSC, "").replace(DCS, "");
  if (!/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069\u200B-\u200F\uFEFF]/.test(t)) return t;
  let out = "";
  for (let i = 0; i < t.length;) {
    if (t[i] === "\x1b") { const m = SGR_OK.exec(t.slice(i, i + 24)); if (m) { out += m[0]; i += m[0].length; continue; } }
    out += clean(t[i] === "\x1b" ? "" : t[i]); i++;
  }
  return out;
}
export function installOutputGuard() {
  for (const k of ["log", "error", "warn"]) { const f = console[k].bind(console); console[k] = (...a) => f(...a.map((x) => (typeof x === "string" ? guardOutput(x) : x))); }
}

// A path found on a machine goes into a shell line only inside single quotes: a file called  x'; rm -rf ~; '  stays one file name.
export const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
export const shqAll = (list) => (list || []).map(shq).join(" ");
