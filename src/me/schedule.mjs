// Schedule for the daily patrol (launchd on macOS, cron elsewhere). Written only after a yes and shown
// before. It starts ~/.dante/patrol.sh, which runs `dante-watch --patrol`. `abschalten` removes it.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, unlinkSync, chmodSync } from "node:fs";
import { dirname, join as osJoin, posix } from "node:path";
const join = (...a) => (a[0] && /^[A-Za-z]:|\\/.test(String(a[0])) ? osJoin(...a) : posix.join(...a));   // a Mac or Linux plan is built with "/" whatever system builds it
import { homedir } from "node:os";
import { homeDir, patrolScript, patrolLog } from "./home.mjs";
import { mkdirOwned } from "../core/perm.mjs";

export const TIMES = ["00:00", "06:00", "12:00", "18:00"];
export const LABEL = "space.nm-streetwear.dante";
const MARK_BEGIN = "# >>> dante-watch patrol (written by Dante; `abschalten` removes it)", MARK_END = "# <<< dante-watch patrol";
const sq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The script the schedule starts. It is rewritten every time Dante starts, so it follows the version you run;
// if that version has moved away it says so in the log instead of failing silently.
export function launcher({ node, cli, log, flag = "--patrol" }) {
  return [
    "#!/bin/sh",
    "# Written by Dante. He rewrites it every time you open him, so it points at the version you run.",
    "# Take the schedule out again with: dante → abschalten",
    'PATH="/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"; export PATH',
    `CLI=${sq(cli)}; NODE=${sq(node)}; LOG=${sq(log)}`,
    '[ -f "$CLI" ] || { echo "$(date -u +%FT%TZ) Dante: $CLI is gone - open Dante once, he rewrites this file" >> "$LOG"; exit 1; }',
    `exec "$NODE" "$CLI" ${flag} >> "$LOG" 2>&1`,
    "",
  ].join("\n");
}

// ---- Windows (Task Scheduler). The launcher is a .cmd; schtasks is called with argv arrays, no shell. ----
// A path may not carry a quote, a line break or NUL (none can occur in a real Windows path); anything else is
// made safe: inside "..." in a .cmd, & | < > ^ ( ) are plain text and only % needs doubling.
export const winBad = (s) => /[\r\n\0"]/.test(String(s));
const pct = (s) => String(s).replace(/%/g, "%%");
export function launcherCmd({ node, cli, log, flag = "--patrol" }) {
  for (const v of [node, cli, log]) if (winBad(v)) throw new Error("path not usable for schtasks");
  return [
    "@echo off",
    "rem Written by Dante. He rewrites it every time you open him, so it points at the version you run.",
    "rem Take the schedule out again with: dante - abschalten",
    `if not exist "${pct(cli)}" (`,
    `  echo %DATE% %TIME% Dante: "${pct(cli)}" is gone - open Dante once, he rewrites this file >> "${pct(log)}"`,
    "  exit /b 1",
    ")",
    `"${pct(node)}" "${pct(cli)}" ${flag} >> "${pct(log)}" 2>&1`,
    "",
  ].join("\r\n");
}
export const PATROL_TASKS = TIMES.map((t) => ({ name: "DanteWatchPatrol" + t.replace(":", ""), time: t }));
// /TR is one argument: the quoted path to the .cmd. schtasks does not expand % itself.
export function winCommands({ script, tasks = PATROL_TASKS, schedule = ["/SC", "DAILY"] }) {
  if (winBad(script)) throw new Error("path not usable for schtasks");
  const create = tasks.map((t) => ["schtasks", ["/Create", ...schedule, ...(t.extra || []), "/ST", t.time, "/TN", t.name, "/TR", `"${script}"`, "/F"]]);
  const del = tasks.map((t) => ["schtasks", ["/Delete", "/TN", t.name, "/F"]]);
  const q = (a) => a.map((x) => (/[\s&%^|<>()]/.test(x) ? `"${x}"` : x)).join(" ");
  const show = ["  " + create.map(([c, a]) => c + " " + q(a)).join("\n  "), "", "  " + del.map(([c, a]) => c + " " + q(a)).join("\n  ")].join("\n");
  return { create, del, show };
}

export function plist({ script, log }) {
  const times = TIMES.map((t) => { const [h, m] = t.split(":").map(Number); return `    <dict><key>Hour</key><integer>${h}</integer><key>Minute</key><integer>${m}</integer></dict>`; }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>${xml(script)}</string></array>
  <key>StartCalendarInterval</key>
  <array>
${times}
  </array>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict>
</plist>
`;
}

export const cronBlock = ({ script }) => [MARK_BEGIN, `0 ${TIMES.map((t) => Number(t.split(":")[0])).join(",")} * * * /bin/sh ${sq(script)}`, MARK_END].join("\n") + "\n";
// the crontab with our block taken out (what is left of a person's own entries stays as it is)
export function withoutBlock(text) {
  const out = []; let skip = false;
  for (const l of String(text).split("\n")) {
    if (l.startsWith("# >>> dante-watch patrol")) { skip = true; continue; }
    if (l.startsWith("# <<< dante-watch patrol")) { skip = false; continue; }
    if (!skip) out.push(l);
  }
  return out.join("\n").replace(/\n+$/, "") + (out.some(Boolean) ? "\n" : "");
}

// DANTE_SCHEDULE_DRY=1 (tests, demos): only the script in ~/.dante is written, nothing is handed to launchd or cron.
const dry = () => !!process.env.DANTE_SCHEDULE_DRY;
const plistPath = (home = homedir()) => join(home, "Library", "LaunchAgents", LABEL + ".plist");
const real = (cmd, args, input) => { const r = spawnSync(cmd, args, { encoding: "utf8", input, timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() }; };

/** What would be written, in words and data. Nothing is touched. */
export function plan({ platform = process.platform, node = process.execPath, cli, home = homedir(), uid = process.getuid ? process.getuid() : 0 } = {}) {
  if (platform === "win32") {
    const script = patrolScript("win32"), log = patrolLog(), c = winCommands({ script });
    return { kind: "schtasks", script, log, launcher: launcherCmd({ node, cli, log }), times: TIMES, create: c.create, del: c.del, show: c.show };
  }
  const script = patrolScript(), log = patrolLog();
  const base = { kind: platform === "darwin" ? "launchd" : "cron", script, log, launcher: launcher({ node, cli, log }), times: TIMES };
  return platform === "darwin"
    ? { ...base, file: plistPath(home), content: plist({ script, log }), uid }
    : { ...base, line: cronBlock({ script }) };
}

export function isArmed({ platform = process.platform, home = homedir(), exec = real } = {}) {
  if (dry()) return existsSync(patrolScript(platform));
  if (platform === "win32") return PATROL_TASKS.every((t) => exec("schtasks", ["/Query", "/TN", t.name]).ok);
  if (platform === "darwin") return existsSync(plistPath(home));
  const r = exec("crontab", ["-l"]);
  return r.ok && r.out.includes(MARK_BEGIN);
}

// Write the schedule. exec(cmd, args, input) -> { ok, out, err } is injectable, so tests never touch a real one.
export function runWin(list, exec) {
  for (const [cmd, args] of list) { const r = exec(cmd, args); if (!r.ok) return { ok: false, why: r.err || r.out || "schtasks" }; }
  return { ok: true };
}
export function install(p, { exec = real, home = homedir() } = {}) {
  mkdirOwned(homeDir());
  writeFileSync(p.script, p.launcher, { mode: 0o700 }); chmodSync(p.script, 0o700);
  if (dry()) return { ok: true };
  if (p.kind === "schtasks") return runWin(p.create, exec);
  if (p.kind === "launchd") {
    mkdirSync(dirname(p.file), { recursive: true });
    writeFileSync(p.file, p.content, { mode: 0o644 });
    exec("launchctl", ["bootout", `gui/${p.uid}/${LABEL}`]);                // a clean start if an older one is loaded
    const r = exec("launchctl", ["bootstrap", `gui/${p.uid}`, p.file]);
    return r.ok ? { ok: true } : { ok: false, why: r.err || r.out || "launchctl" };
  }
  const old = exec("crontab", ["-l"]);
  const keep = withoutBlock(old.ok ? old.out : "");
  const r = exec("crontab", ["-"], (keep ? keep : "") + p.line);
  return r.ok ? { ok: true } : { ok: false, why: r.err || r.out || "crontab" };
}

export function remove({ platform = process.platform, home = homedir(), uid = process.getuid ? process.getuid() : 0, exec = real } = {}) {
  let ok = true;
  const script = patrolScript(platform);
  if (dry()) { try { unlinkSync(script); } catch { /* not there */ } return { ok }; }
  if (platform === "win32") {
    for (const t of PATROL_TASKS) if (exec("schtasks", ["/Query", "/TN", t.name]).ok && !exec("schtasks", ["/Delete", "/TN", t.name, "/F"]).ok) ok = false;
  } else if (platform === "darwin") {
    exec("launchctl", ["bootout", `gui/${uid}/${LABEL}`]);
    try { unlinkSync(plistPath(home)); } catch { /* not there */ }
  } else {
    const old = exec("crontab", ["-l"]);
    if (old.ok && old.out.includes(MARK_BEGIN)) { const keep = withoutBlock(old.out); ok = exec("crontab", ["-"], keep).ok; }
  }
  try { unlinkSync(script); } catch { /* not there */ }
  return { ok };
}

// The launcher is refreshed whenever Dante opens, so the schedule follows the version that runs now.
export function refreshLauncher({ node = process.execPath, cli } = {}) {
  if (!existsSync(patrolScript()) || !cli) return false;
  writeFileSync(patrolScript(), process.platform === "win32" ? launcherCmd({ node, cli, log: patrolLog() }) : launcher({ node, cli, log: patrolLog() }), { mode: 0o700 });
  return true;
}
