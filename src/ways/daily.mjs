// Daily appearance: is the human at the machine right now, did Dante already show up today, and the
// schedule that only CHECKS every 30 minutes. Nothing here runs anything: commands are returned as text,
// the caller shows them and runs them only after a clear yes. No network verb appears in any command.
const sq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const ACTIVE_BELOW = 120;          // seconds without input that still count as "at the machine"
export const CHECK_MINUTES = 30;
export const DAILY_LABEL = "space.nm-streetwear.dante.daily";
export const DAILY_TASK = "DanteDaily";
export const DAILY_UNIT = "dante-daily";

const PS_IDLE = `Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class DanteIdle {
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
  public static double Seconds() { LASTINPUTINFO i = new LASTINPUTINFO(); i.cbSize = (uint)Marshal.SizeOf(i); GetLastInputInfo(ref i); return ((uint)Environment.TickCount - i.dwTime) / 1000.0; }
}
"@
[DanteIdle]::Seconds()`;

/** The read-only command that prints how long the person has not touched keyboard or mouse. */
export function idleCommand(os) {
  if (os === "mac") return "ioreg -c IOHIDSystem";
  if (os === "windows") return "powershell -NoProfile -NonInteractive -EncodedCommand " + Buffer.from(PS_IDLE, "utf16le").toString("base64");
  if (os === "linux") return 'xprintidle 2>/dev/null || loginctl show-session "${XDG_SESSION_ID:-auto}" -p IdleHint 2>/dev/null';
  return null;
}

/** Idle seconds from the command's output, or null = unknown. Never guesses. */
export function parseIdle(os, text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (os === "mac") {
    const m = t.match(/"HIDIdleTime"\s*=\s*(\d+)/);
    return m ? Number(m[1]) / 1e9 : null;
  }
  if (os === "windows") {
    const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const m = (lines[lines.length - 1] || "").replace(",", ".").match(/^\d+(\.\d+)?$/);
    return m ? Number(m[0]) : null;
  }
  if (os === "linux") {
    if (/^\d+$/.test(t)) return Number(t) / 1000;          // xprintidle prints milliseconds
    const h = t.match(/^IdleHint=(yes|no)\s*$/m);
    if (!h) return null;
    return h[1] === "no" ? 0 : ACTIVE_BELOW;               // "yes" = idle at least this long (the exact value is not given)
  }
  return null;
}

/** The local calendar day as YYYY-MM-DD (the stamp format). */
export function localDay(now) {
  const d = new Date(now), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** May Dante step forward now? Unknown idle = no (the report then waits for the next normal start). */
export function shouldAppear({ os, idleSeconds, now, stamp, snoozedUntil } = {}) {
  const t = new Date(now ?? Date.now()).getTime();
  if (Number.isNaN(t)) return { appear: false, why: "no clock" };
  if (typeof idleSeconds !== "number" || !Number.isFinite(idleSeconds) || idleSeconds < 0) return { appear: false, why: `idle time unknown${os ? " on " + os : ""}` };
  if (snoozedUntil != null) {
    const s = new Date(snoozedUntil).getTime();
    if (!Number.isNaN(s) && s > t) return { appear: false, why: "snoozed (\"not today\")" };
  }
  if (stamp && stamp === localDay(t)) return { appear: false, why: "already appeared today" };
  if (idleSeconds >= ACTIVE_BELOW) return { appear: false, why: `not active (idle ${Math.round(idleSeconds)} s, limit ${ACTIVE_BELOW} s)` };
  return { appear: true, why: `active (idle ${Math.round(idleSeconds)} s), not yet shown today` };
}

const bad = (s) => /[\r\n\0"%]/.test(String(s));

/** The schedule as text + commands. show = what the person reads BEFORE the yes. Nothing is executed. */
export function scheduleCommands(os, { nodePath, scriptPath, flag = "--daily-check", kind, lang = "de", home = "$HOME" } = {}) {
  if (!nodePath || !scriptPath) throw new Error("nodePath and scriptPath needed");
  const secs = CHECK_MINUTES * 60;
  const tx = lang === "de"
    ? { head: `Dante schaut alle ${CHECK_MINUTES} Minuten nur nach, ob du am Rechner bist. Er zeigt sich höchstens einmal am Tag. Das ruft niemanden an. Diese Befehle würden laufen:`, rm: "Wieder entfernen mit:" }
    : { head: `Dante only checks every ${CHECK_MINUTES} minutes whether you are at the machine. He shows himself at most once a day. This calls no one. These commands would run:`, rm: "Remove again with:" };
  let install, remove, file;
  if (os === "mac") {
    file = `${home}/Library/LaunchAgents/${DAILY_LABEL}.plist`;
    const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n  <key>Label</key><string>${DAILY_LABEL}</string>\n  <key>ProgramArguments</key><array><string>${xml(nodePath)}</string><string>${xml(scriptPath)}</string><string>${xml(flag)}</string></array>\n  <key>StartInterval</key><integer>${secs}</integer>\n  <key>RunAtLoad</key><false/>\n</dict>\n</plist>\n`;
    install = [`mkdir -p "${home}/Library/LaunchAgents"`, `printf '%s' ${sq(plist)} > "${file}"`, `launchctl bootout gui/$(id -u)/${DAILY_LABEL} 2>/dev/null; launchctl bootstrap gui/$(id -u) "${file}"`];
    remove = [`launchctl bootout gui/$(id -u)/${DAILY_LABEL}`, `rm -f "${file}"`];
  } else if (os === "linux" && kind === "cron") {
    const line = `*/${CHECK_MINUTES} * * * * ${sq(nodePath)} ${sq(scriptPath)} ${flag} # dante-daily`;
    install = [`(crontab -l 2>/dev/null | grep -v '# dante-daily$'; printf '%s\\n' ${sq(line)}) | crontab -`];
    remove = [`crontab -l 2>/dev/null | grep -v '# dante-daily$' | crontab -`];
  } else if (os === "linux") {
    const dir = `${home}/.config/systemd/user`;
    const svc = `[Unit]\nDescription=Dante daily check (read-only)\n\n[Service]\nType=oneshot\nExecStart=${sq(nodePath)} ${sq(scriptPath)} ${flag}\n`;
    const tim = `[Unit]\nDescription=Dante daily check every ${CHECK_MINUTES} minutes\n\n[Timer]\nOnBootSec=5min\nOnUnitActiveSec=${CHECK_MINUTES}min\n\n[Install]\nWantedBy=timers.target\n`;
    install = [`mkdir -p "${dir}"`, `printf '%s' ${sq(svc)} > "${dir}/${DAILY_UNIT}.service"`, `printf '%s' ${sq(tim)} > "${dir}/${DAILY_UNIT}.timer"`, "systemctl --user daemon-reload", `systemctl --user enable --now ${DAILY_UNIT}.timer`];
    remove = [`systemctl --user disable --now ${DAILY_UNIT}.timer`, `rm -f "${dir}/${DAILY_UNIT}.service" "${dir}/${DAILY_UNIT}.timer"`, "systemctl --user daemon-reload"];
  } else if (os === "windows") {
    if (bad(nodePath) || bad(scriptPath)) throw new Error("path not usable for schtasks");
    install = [`schtasks /Create /SC MINUTE /MO ${CHECK_MINUTES} /TN ${DAILY_TASK} /TR "\\"${nodePath}\\" \\"${scriptPath}\\" ${flag}" /F`];
    remove = [`schtasks /Delete /TN ${DAILY_TASK} /F`];
  } else throw new Error("unknown os: " + os);
  const show = [tx.head, "", ...install.map((c) => "  " + c), "", tx.rm, "", ...remove.map((c) => "  " + c)].join("\n");
  return { show, install, remove };
}
