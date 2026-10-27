// Handoff to Virgil: the exact command that opens a NEW terminal window running `npx virgil-cli` with the
// report as first task. Returned as {show, argv}; nothing is run here. All quoting is done per target shell.
const sq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const asq = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');            // inside an AppleScript string
const psq = (s) => "'" + String(s).replace(/['‘’‚‛]/g, (c) => c + c) + "'"; // PowerShell treats curly quotes as quotes

export const taskText = (reportPath, lang = "de") => lang === "en"
  ? `Read the Dante report at ${reportPath} and help me check the findings. Explain each one, show the exact command with what it changes, and change nothing without my yes.`
  : `Lies den Dante-Bericht unter ${reportPath} und hilf mir, die Funde zu prüfen. Erkläre jeden, zeig mir den genauen Befehl mit dem, was er ändert, und ändere nichts ohne mein Ja.`;

export function handoffCommand(os, { reportPath, lang = "de", have } = {}) {
  if (typeof reportPath !== "string" || !reportPath || /[\0\r\n]/.test(reportPath)) throw new Error("report path not usable");
  const task = taskText(reportPath, lang);
  const de = lang !== "en";
  const intro = de ? "Dante öffnet ein neues Terminal-Fenster und führt dort aus:" : "Dante opens a new terminal window and runs there:";
  const fmt = (argv) => argv.map((a) => (/^[A-Za-z0-9_\-./=:@+,]+$/.test(a) ? a : sq(a))).join(" ");
  if (os === "mac") {
    const inner = `npx virgil-cli ${sq(task)}`;
    const argv = ["osascript", "-e", `tell application "Terminal" to do script "${asq(inner)}"`, "-e", 'tell application "Terminal" to activate'];
    return { show: `${intro}\n\n  ${fmt(argv)}`, argv, inner };
  }
  if (os === "linux") {
    const inner = `npx virgil-cli ${sq(task)}; exec "\${SHELL:-sh}"`;
    const has = have || (() => true);
    let argv = null;
    if (has("x-terminal-emulator")) argv = ["x-terminal-emulator", "-e", "sh", "-c", inner];
    else if (has("gnome-terminal")) argv = ["gnome-terminal", "--", "sh", "-c", inner];
    if (!argv) return { show: de ? `Kein Terminal-Programm gefunden. Öffne selbst ein Terminal und tippe:\n\n  npx virgil-cli ${sq(task)}` : `No terminal program found. Open a terminal yourself and type:\n\n  npx virgil-cli ${sq(task)}`, argv: null, inner };
    return { show: `${intro}\n\n  ${fmt(argv)}`, argv, inner };
  }
  if (os === "windows") {
    const ps = `npx.cmd virgil-cli ${psq(task)}`;
    const enc = Buffer.from(ps, "utf16le").toString("base64");               // base64 has nothing a shell could break on
    const argv = have && have("wt") ? ["wt", "new-tab", "powershell", "-NoExit", "-EncodedCommand", enc] : ["cmd", "/c", "start", "", "powershell", "-NoExit", "-EncodedCommand", enc];
    return { show: `${intro}\n\n  ${fmt(argv)}\n\n${de ? "Der Auftrag darin (lesbar)" : "The task inside (readable)"}: ${ps}`, argv, inner: ps };
  }
  throw new Error("unknown os: " + os);
}
