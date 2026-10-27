// Package A: look at the ways in. One fixed, read-only script per OS runs through the runner, its output is cut into
// marked sections (like src/me/sysid.mjs) and the pure parsers turn the sections into facts.
//
// Law: a probe that printed nothing, printed only errors or did not run is a GAP ("could not read"), never a fact
// of the kind "nothing found". Commands never come from data: WAY_PROBES is the only command list there is.
import * as mac from "./parse-mac.mjs";
import * as linux from "./parse-linux.mjs";
import * as windows from "./parse-windows.mjs";

// authorized_keys: prints a status word, the change date and one "key|type|comment" per key. The key itself is never printed.
const authkeys = (statCmd) =>
  `f="$HOME/.ssh/authorized_keys"; if [ -r "$f" ]; then echo present; echo "mtime|$(${statCmd} "$f")"; ` +
  `awk '!/^[ \\t]*(#|$)/{for(i=1;i<=NF;i++)if($i ~ /^(ssh-|ecdsa-|sk-)/){c="";for(j=i+2;j<=NF;j++)c=c (c==""?"":" ") $j;print "key|" $i "|" c;next}print "key|unknown|"}' "$f"; ` +
  `elif [ -e "$f" ]; then echo unreadable; else echo absent; fi`;
// where is a MTA installed (prints paths); sbin is often not in a normal user's PATH
const MTA = `PATH="$PATH:/usr/sbin:/sbin"; for m in postfix exim4 exim sendmail smtpd; do command -v "$m"; done 2>/dev/null`;

// os -> probe id -> snippet. The only commands this module ever runs. All read-only; a missing tool just prints an error or nothing.
export const WAY_PROBES = {
  mac: {
    listen: "lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null",
    launchctl: "launchctl list 2>/dev/null",
    launchdirs: 'ls -lT "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons 2>&1',
    cron: "crontab -l 2>&1",
    authkeys: authkeys("stat -f %m"),
    // mdls gives the real last-opened date; the list is capped (200 per folder), so the count is a floor
    stale: `for d in "$HOME/Downloads" "$HOME/Desktop"; do [ -d "$d" ] && find "$d" -maxdepth 1 -type f -mtime +90 2>/dev/null | head -200 | while IFS= read -r f; do echo "$d|$(stat -f %m "$f")|$(mdls -raw -name kMDItemLastUsedDate "$f" 2>/dev/null)"; done; done`,
    users: "dscl . -list /Users UserShell 2>/dev/null",
    admins: "dscl . -read /Groups/admin GroupMembership 2>/dev/null",
    guest: "defaults read /Library/Preferences/com.apple.loginwindow GuestEnabled 2>&1",
    mta: MTA,
  },
  linux: {
    listen: "ss -ltnupH 2>/dev/null",
    cron: "crontab -l 2>&1",
    crondirs: "ls -l --time-style=long-iso /etc/cron.d /etc/cron.hourly /etc/cron.daily /etc/cron.weekly /etc/cron.monthly 2>&1",
    timers: "systemctl list-timers --all --no-legend --no-pager 2>/dev/null",
    authkeys: authkeys("stat -c %Y"),
    // no real last-opened date on Linux: only the last change (third column is "-")
    stale: `for d in "$HOME/Downloads" "$HOME/Desktop"; do [ -d "$d" ] && find "$d" -maxdepth 1 -type f -mtime +90 2>/dev/null | head -200 | while IFS= read -r f; do echo "$d|$(stat -c %Y "$f")|-"; done; done`,
    passwd: "cat /etc/passwd 2>/dev/null",
    admingroups: "getent group sudo wheel admin 2>/dev/null",
    mta: MTA,
  },
  // PowerShell bodies. Each runs inside try { ... 'OK' } catch { 'ERR' }: the OK line is the proof the cmdlet could read.
  // No double quotes inside (the whole script is one -Command "..." string).
  windows: {
    listen: "Get-NetTCPConnection -State Listen -ErrorAction Stop | ForEach-Object { $p = (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName; 'L|' + $_.LocalAddress + '|' + $_.LocalPort + '|' + $p }",
    tasks: "Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskPath -notlike '\\Microsoft\\*' } | ForEach-Object { 'T|' + $_.TaskPath + $_.TaskName + '|' + $_.State }",
    startup: "Get-CimInstance Win32_StartupCommand -ErrorAction Stop | ForEach-Object { 'S|' + $_.Location + '|' + $_.Name }",
    runkeys: "foreach ($k in 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run') { $i = Get-ItemProperty -Path $k -ErrorAction SilentlyContinue; if ($i) { $i.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object { 'R|' + $k + '|' + $_.Name } } }",
    startupdir: "$d = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Startup'; if (Test-Path $d) { Get-ChildItem -Path $d -File -ErrorAction Stop | ForEach-Object { 'F|' + $_.Name + '|' + [int]((Get-Date) - $_.LastWriteTime).TotalDays } }",
    stale: "foreach ($n in 'Downloads','Desktop') { $d = Join-Path $env:USERPROFILE $n; if (Test-Path $d) { Get-ChildItem -Path $d -File -ErrorAction Stop | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-90) } | ForEach-Object { 'D|' + $d + '|' + [int]((Get-Date) - $_.LastWriteTime).TotalDays } } }",
    users: "Get-LocalUser -ErrorAction Stop | ForEach-Object { 'A|' + $_.Name + '|' + $_.Enabled + '|' + $_.SID.Value }",
    admins: "Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction Stop | ForEach-Object { 'G|' + $_.Name }",
    mta: "Get-Service -Name 'MSExchangeTransport','SMTPSVC' -ErrorAction SilentlyContinue | ForEach-Object { 'M|' + $_.Name }",
  },
};

// what each probe looks at, for the gap texts
const LABEL = {
  listen: "listening ports", launchctl: "loaded launchd jobs", launchdirs: "launchd agent/daemon folders", cron: "user crontab",
  crondirs: "/etc/cron.* folders", timers: "systemd timers", authkeys: "authorized_keys", stale: "old files in Downloads/Desktop",
  users: "user accounts", admins: "admin group", guest: "guest account", passwd: "/etc/passwd", admingroups: "sudo/wheel/admin groups",
  tasks: "scheduled tasks", startup: "startup commands", runkeys: "Run keys", startupdir: "Startup folder", mta: "mail server",
};
// nothing printed is a legitimate answer here: no MTA installed, no old files
const NOTHING_IS_FINE = { mac: new Set(["stale", "mta"]), linux: new Set(["stale", "mta"]), windows: new Set() };
const PARSERS = { mac, linux, windows };

const sec = (name, cmd) => `echo '@@${name}'; ${cmd}; echo`;
/** The one script that runs on the target for this OS. */
export function scriptFor(os) {
  const probes = WAY_PROBES[os];
  if (!probes) throw new Error("unknown os: " + os);
  const ids = Object.keys(probes);
  if (os !== "windows") return ids.map((id) => sec(id, probes[id])).join("\n") + "\necho '@@end'";
  const parts = ids.map((id) => `'@@${id}'; try { ${probes[id]}; 'OK' } catch { 'ERR' }`);
  return `powershell -NoProfile -NonInteractive -Command "${parts.join("; ")}; '@@end'"`;
}

/** Output of scriptFor() -> map section name -> text (not trimmed to nothing: an empty section stays ""). */
export function splitSections(out) {
  const r = {};
  let cur = null, buf = [];
  const flush = () => { if (cur) r[cur] = buf.join("\n").trim(); };
  for (const raw of String(out || "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = /^@@(\S+)$/.exec(line.trimEnd());
    if (m) { flush(); cur = m[1] === "end" ? null : m[1]; buf = []; } else if (cur) buf.push(line);
  }
  flush();
  return r;
}

const ERROR_LINE = /permission denied|not permitted|must be privileged|command not found|: not found|cannot open|unknown option|illegal option|invalid option|does not exist|cannot access/i;
/** null when the section holds a real answer, else why it does not. */
function whyUnreadable(os, id, text) {
  if (text === undefined) return "probe did not run";
  if (os === "windows") return /^ERR$/m.test(text) ? "cmdlet failed" : /^OK$/m.test(text) ? null : "no completion marker";
  if (/^unreadable$/m.test(text)) return "not readable with these rights";
  if (!text) return NOTHING_IS_FINE[os].has(id) ? null : "no output";
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length && lines.every((l) => ERROR_LINE.test(l))) return "only error output";
  return null;
}

/**
 * Look at the ways in of this machine. runner(script) -> {out, err, code} (or a Promise of it), e.g. run/runLocal of src/core/sh.mjs.
 * Returns { os, facts, gaps }: gaps are the things Dante could not read, said plainly.
 */
export async function collect(os, runner, { now = Date.now() } = {}) {
  const probes = WAY_PROBES[os];
  if (!probes) throw new Error("unknown os: " + os);
  const ids = Object.keys(probes);
  let r;
  try { r = await runner(scriptFor(os)); } catch (e) { r = { out: "", err: String((e && e.message) || e), code: -1 }; }
  const sections = splitSections(r && r.out);
  const readable = {};
  const gaps = [];
  for (const id of ids) {
    const why = whyUnreadable(os, id, sections[id]);
    if (why) gaps.push(`${LABEL[id] || id}: could not be read (${why})`);
    else readable[id] = sections[id];
  }
  return { os, facts: PARSERS[os].parse(readable, now), gaps };
}
