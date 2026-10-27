// Schedule entry for the weekly deep run, separate from the daily patrol: its own confirmation, its
// own removal. Mondays 03:30. launchd on macOS, a cron block elsewhere.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, unlinkSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { homeDir, deepScript, patrolLog } from "./home.mjs";
import { launcher, launcherCmd, winCommands, runWin, LABEL } from "./schedule.mjs";
import { mkdirOwned } from "../core/perm.mjs";

export const DEEP_LABEL = LABEL + ".deep";
export const DEEP_WHEN = { weekday: 1, hour: 3, minute: 30, text: "Mo 03:30" };
const MARK_BEGIN = "# >>> dante-watch deep (written by Dante; `abschalten` removes it)", MARK_END = "# <<< dante-watch deep";
const sq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dry = () => !!process.env.DANTE_SCHEDULE_DRY;
const plistPath = (home = homedir()) => join(home, "Library", "LaunchAgents", DEEP_LABEL + ".plist");
const real = (cmd, args, input) => { const r = spawnSync(cmd, args, { encoding: "utf8", input, timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() }; };

export function plist({ script, log }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${DEEP_LABEL}</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>${xml(script)}</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>${DEEP_WHEN.weekday}</integer><key>Hour</key><integer>${DEEP_WHEN.hour}</integer><key>Minute</key><integer>${DEEP_WHEN.minute}</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict>
</plist>
`;
}
export const cronBlock = ({ script }) => [MARK_BEGIN, `${DEEP_WHEN.minute} ${DEEP_WHEN.hour} * * ${DEEP_WHEN.weekday} /bin/sh ${sq(script)}`, MARK_END].join("\n") + "\n";
export function withoutBlock(text) {
  const out = []; let skip = false;
  for (const l of String(text).split("\n")) {
    if (l.startsWith("# >>> dante-watch deep")) { skip = true; continue; }
    if (l.startsWith("# <<< dante-watch deep")) { skip = false; continue; }
    if (!skip) out.push(l);
  }
  return out.join("\n").replace(/\n+$/, "") + (out.some(Boolean) ? "\n" : "");
}

const DEEP_TASKS = [{ name: "DanteWatchDeep", time: "03:30", extra: ["/D", "MON"] }];
export function plan({ platform = process.platform, node = process.execPath, cli, home = homedir(), uid = process.getuid ? process.getuid() : 0 } = {}) {
  if (platform === "win32") {
    const script = deepScript("win32"), log = patrolLog(), c = winCommands({ script, tasks: DEEP_TASKS, schedule: ["/SC", "WEEKLY"] });
    return { kind: "schtasks", script, log, launcher: launcherCmd({ node, cli, log, flag: "--deep" }), when: DEEP_WHEN.text, create: c.create, del: c.del, show: c.show };
  }
  const script = deepScript(), log = patrolLog();
  const base = { kind: platform === "darwin" ? "launchd" : "cron", script, log, launcher: launcher({ node, cli, log, flag: "--deep" }), when: DEEP_WHEN.text };
  return platform === "darwin" ? { ...base, file: plistPath(home), content: plist({ script, log }), uid } : { ...base, line: cronBlock({ script }) };
}
export function isArmed({ platform = process.platform, home = homedir(), exec = real } = {}) {
  if (dry()) return existsSync(deepScript(platform));
  if (platform === "win32") return exec("schtasks", ["/Query", "/TN", DEEP_TASKS[0].name]).ok;
  if (platform === "darwin") return existsSync(plistPath(home));
  const r = exec("crontab", ["-l"]);
  return r.ok && r.out.includes(MARK_BEGIN);
}
export function install(p, { exec = real } = {}) {
  mkdirOwned(homeDir());
  writeFileSync(p.script, p.launcher, { mode: 0o700 }); chmodSync(p.script, 0o700);
  if (dry()) return { ok: true };
  if (p.kind === "schtasks") return runWin(p.create, exec);
  if (p.kind === "launchd") {
    mkdirSync(dirname(p.file), { recursive: true });
    writeFileSync(p.file, p.content, { mode: 0o644 });
    exec("launchctl", ["bootout", `gui/${p.uid}/${DEEP_LABEL}`]);
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
  if (!dry()) {
    if (platform === "win32") { if (exec("schtasks", ["/Query", "/TN", DEEP_TASKS[0].name]).ok) ok = exec("schtasks", ["/Delete", "/TN", DEEP_TASKS[0].name, "/F"]).ok; }
    else if (platform === "darwin") { exec("launchctl", ["bootout", `gui/${uid}/${DEEP_LABEL}`]); try { unlinkSync(plistPath(home)); } catch { /* not there */ } }
    else { const old = exec("crontab", ["-l"]); if (old.ok && old.out.includes(MARK_BEGIN)) ok = exec("crontab", ["-"], withoutBlock(old.out)).ok; }
  }
  try { unlinkSync(deepScript(platform)); } catch { /* not there */ }
  return { ok };
}
export function refreshLauncher({ node = process.execPath, cli } = {}) {
  if (!existsSync(deepScript()) || !cli) return false;
  const a = { node, cli, log: patrolLog(), flag: "--deep" };
  writeFileSync(deepScript(), process.platform === "win32" ? launcherCmd(a) : launcher(a), { mode: 0o700 });
  return true;
}
