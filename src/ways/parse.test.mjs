import test from "node:test";
import assert from "node:assert/strict";
import * as mac from "./parse-mac.mjs";
import * as linux from "./parse-linux.mjs";
import * as win from "./parse-windows.mjs";
import { redact, bindOf, splitAddr, parseCron, parseAuthKeys, parseStale } from "./util.mjs";

const NOW = Date.parse("2026-10-27T12:00:00");
const by = (facts, kind) => facts.filter((f) => f.kind === kind);

// ---- util
test("bindOf and splitAddr cover IPv4, IPv6 and interface suffixes", () => {
  assert.equal(bindOf("*"), "all");
  assert.equal(bindOf("0.0.0.0"), "all");
  assert.equal(bindOf("::"), "all");
  assert.equal(bindOf("127.0.0.53"), "loopback");
  assert.equal(bindOf("::1"), "loopback");
  assert.equal(bindOf("192.168.1.20"), "lan");
  assert.deepEqual(splitAddr("127.0.0.53%lo:53"), { host: "127.0.0.53", port: 53 });
  assert.deepEqual(splitAddr("[::]:80"), { host: "::", port: 80 });
  assert.deepEqual(splitAddr(":::22"), { host: "::", port: 22 });
  assert.deepEqual(splitAddr("*:22"), { host: "*", port: 22 });
});

test("redact blanks secrets but keeps ordinary command lines", () => {
  assert.match(redact("curl -H 'Authorization: Bearer abcdef123456' https://x"), /Bearer \*\*\*/);
  assert.equal(redact("mysql --password hunter2 -e x"), "mysql --password *** -e x");
  assert.ok(!redact("TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789 run").includes("ghp_"));
  assert.ok(!redact("git clone https://bob:s3cret@host/r.git").includes("s3cret"));
  assert.ok(!redact("AAAAB3NzaC1yc2EAAAADAQABAAABgQC7vbqajDhA9pPQxYzK").includes("AAAAB3Nza"));
  assert.equal(redact("/usr/local/bin/backup.sh --daily"), "/usr/local/bin/backup.sh --daily");
});

// ---- mac
const LSOF = `COMMAND     PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
rapportd    612 mustafa    8u  IPv4 0x6b2c1f0f1a2b3c4d      0t0  TCP *:49152 (LISTEN)
rapportd    612 mustafa    9u  IPv6 0x6b2c1f0f1a2b3c4e      0t0  TCP *:49152 (LISTEN)
ControlCe   640 mustafa   10u  IPv6 0x6b2c1f0f1a2b3c4f      0t0  TCP [::1]:7265 (LISTEN)
node      12345 mustafa   20u  IPv4 0x6b2c1f0f1a2b3c50      0t0  TCP 127.0.0.1:3000 (LISTEN)
Google\\x20Chrome  900 mustafa 30u IPv4 0x6b2c1f0f1a2b3c51 0t0 TCP 192.168.1.20:8080 (LISTEN)
postfix     333 root      12u  IPv4 0x6b2c1f0f1a2b3c52      0t0  TCP *:25 (LISTEN)
odd line without the marker`;

test("mac lsof: bind classes, dedupe of v4+v6, escaped spaces, junk skipped", () => {
  const f = mac.parseLsof(LSOF);
  assert.equal(f.length, 6);
  const rapport = f.filter((x) => x.proc === "rapportd");
  assert.equal(rapport.length, 2);
  assert.equal(f.find((x) => x.port === 7265).bind, "loopback");
  assert.equal(f.find((x) => x.port === 3000).bind, "loopback");
  assert.equal(f.find((x) => x.port === 8080).bind, "lan");
  assert.equal(f.find((x) => x.port === 8080).proc, "Google Chrome");
  assert.equal(f.find((x) => x.port === 49152).bind, "all");
  assert.ok(f.every((x) => x.kind === "listen" && x.proto === "tcp" && x.line.includes("(LISTEN)")));
  assert.equal(mac.parse({ listen: LSOF }, NOW).filter((x) => x.kind === "listen").length, 5);
});

const LAUNCHDIRS = `/Users/mustafa/Library/LaunchAgents:
total 16
-rw-r--r--  1 mustafa  staff  523 Oct 12 10:03:11 2026 com.foo.updater.plist
-rw-r--r--@ 1 mustafa  staff  400 Jan  3 08:00:00 2025 org.example.sync agent.plist
drwxr-xr-x  2 mustafa  staff   64 Jan  3 08:00:00 2025 subdir
ls: /Library/LaunchAgents: No such file or directory
/Library/LaunchDaemons:
total 8
-rw-r--r--  1 root  wheel  700 Mar  9 09:15:00 2026 com.vendor.helper.plist
-rw-r--r--  1 root  wheel   10 Mar  9 09:15:00 2026 README.txt`;

test("mac launchd folders: agents vs daemons, age in days, non-plists skipped", () => {
  const f = mac.parseLaunchDirs(LAUNCHDIRS, NOW);
  assert.deepEqual(f.map((x) => [x.where, x.entry]), [
    ["launchd-agent", "com.foo.updater.plist"], ["launchd-agent", "org.example.sync agent.plist"], ["launchd-daemon", "com.vendor.helper.plist"],
  ]);
  assert.equal(f[0].ageDays, 15);
  assert.ok(f[2].ageDays > 200);
  assert.ok(f[0].line.includes("com.foo.updater.plist"));
});

test("mac launchctl list drops Apple jobs and the header", () => {
  const f = mac.parseLaunchctl("PID\tStatus\tLabel\n-\t0\tcom.apple.xpc.launchd.unmanaged\n412\t0\tcom.docker.helper\n-\t78\tapplication.com.x.1\n");
  assert.deepEqual(f.map((x) => x.entry), ["com.docker.helper"]);
});

test("mac accounts: login shells, admin group, guest on", () => {
  const users = "_spotlight  /usr/bin/false\nroot  /bin/sh\nmustafa  /bin/zsh\ndaemon  /usr/bin/false\nbob  /usr/bin/false";
  const f = mac.parseAccounts(users, "GroupMembership: root mustafa", "1");
  assert.deepEqual(f.map((x) => [x.name, x.login, x.admin, x.guest]), [["root", true, true, false], ["mustafa", true, true, false], ["Guest", true, false, true]]);
  assert.equal(mac.parseAccounts(users, "GroupMembership: root", "0").some((x) => x.guest), false);
});

test("mac stale: mdls last-used date gives usedKnown, missing date does not", () => {
  const known = "/Users/m/Downloads|1700000000|2023-11-14 22:13:20 +0000\n/Users/m/Downloads|1690000000|2023-12-01 10:00:00 +0000";
  const [a] = parseStale(known, NOW);
  assert.equal(a.count, 2);
  assert.equal(a.usedKnown, true);
  assert.equal(a.dir, "/Users/m/Downloads");
  assert.ok(a.oldestDays > 900);
  const [b] = parseStale("/Users/m/Desktop|1700000000|(null)\n/Users/m/Desktop|1600000000|", NOW);
  assert.equal(b.usedKnown, false);
  assert.equal(b.count, 2);
  assert.ok(b.oldestDays > b.count);
});

test("mac parse: mail only from open non-loopback ports, MTA alone is not a fact", () => {
  const all = mac.parse({ listen: LSOF, mta: "/usr/sbin/postfix\n/usr/sbin/sendmail" }, NOW);
  const m = by(all, "mail");
  assert.equal(m.length, 1);
  assert.deepEqual(m[0].ports, [25]);
  assert.equal(m[0].mta, "postfix");
  assert.equal(by(mac.parse({ listen: "x", mta: "/usr/sbin/postfix" }, NOW), "mail").length, 0);
});

// ---- shared: cron and authorized_keys
test("cron: schedules kept, env/comments dropped, secrets blanked, 'no crontab' is no fact", () => {
  const f = parseCron("# m h dom mon dow command\nMAILTO=root\n*/5 * * * * /opt/bin/check.sh\n@reboot curl -s https://u:pw123@host/x --token=abcd1234\n0 3 * * 1-5 backup --password hunter2");
  assert.equal(f.length, 3);
  assert.ok(f.every((x) => x.where === "cron" && x.line));
  assert.ok(!JSON.stringify(f).match(/pw123|abcd1234|hunter2/));
  assert.deepEqual(parseCron("no crontab for mustafa"), []);
});

test("authorized_keys: one fact per key, age from file date, no key material", () => {
  const f = parseAuthKeys(`present\nmtime|${NOW / 1000 - 6.5 * 86400}\nkey|ssh-ed25519|laptop\nkey|ssh-rsa|\nkey|unknown|`, NOW);
  assert.equal(f.length, 3);
  assert.deepEqual(f.map((x) => x.entry), ["ssh-ed25519 laptop", "ssh-rsa", "unknown"]);
  assert.ok(f.every((x) => x.where === "authorized_keys" && x.ageDays === 6));
  assert.deepEqual(parseAuthKeys("absent", NOW), []);
});

// ---- linux
const SS = `udp   UNCONN 0      0        127.0.0.53%lo:53         0.0.0.0:*    users:(("systemd-resolve",pid=812,fd=13))
udp   UNCONN 0      0              0.0.0.0:5353       0.0.0.0:*
tcp   LISTEN 0      4096           0.0.0.0:22         0.0.0.0:*    users:(("sshd",pid=900,fd=3))
tcp   LISTEN 0      511               [::]:80            [::]:*    users:(("nginx",pid=1000,fd=6),("nginx",pid=1001,fd=6))
tcp   LISTEN 0      128          127.0.0.1:631        0.0.0.0:*
tcp   LISTEN 0      100       10.0.0.5:587         0.0.0.0:*
LISTEN 0 4096 [::1]:5432 [::]:*
tcp ESTAB 0 0 1.2.3.4:5 6.7.8.9:10
short`;

test("linux ss: udp+tcp, [::], missing process column, missing Netid column", () => {
  const f = linux.parseSs(SS);
  assert.equal(f.length, 7);
  const g = (proto, port) => f.find((x) => x.proto === proto && x.port === port);
  assert.deepEqual([g("udp", 53).bind, g("udp", 53).proc], ["loopback", "systemd-resolve"]);
  assert.equal(g("udp", 5353).proc, null);
  assert.equal(g("tcp", 22).bind, "all");
  assert.equal(g("tcp", 80).bind, "all");
  assert.equal(g("tcp", 80).proc, "nginx");
  assert.equal(g("tcp", 631).bind, "loopback");
  assert.equal(g("tcp", 587).bind, "lan");
  assert.equal(g("tcp", 5432).bind, "loopback");
  assert.ok(f.every((x) => x.line.length > 10));
});

test("linux cron dirs, timers and accounts", () => {
  const crondirs = `/etc/cron.d:
total 12
-rw-r--r-- 1 root root  201 2024-03-02 10:11 e2scrub_all
-rw-r--r-- 1 root root  102 2024-03-02 10:11 .placeholder

/etc/cron.daily:
total 8
-rwxr-xr-x 1 root root 1478 2026-10-20 06:25 apt-compat
ls: cannot access '/etc/cron.hourly': No such file or directory`;
  const c = linux.parseCronDirs(crondirs, NOW);
  assert.deepEqual(c.map((x) => x.entry), ["cron.d/e2scrub_all", "cron.daily/apt-compat"]);
  assert.equal(c[1].ageDays, 7);

  const t = linux.parseTimers(`Tue 2026-10-27 13:00:00 UTC 59min left Tue 2026-10-27 12:00:00 UTC 1min ago apt-daily.timer apt-daily.service
n/a                         n/a  n/a                         n/a      snapd.snap-repair.timer snapd.snap-repair.service`);
  assert.deepEqual(t.map((x) => x.entry), ["apt-daily.timer", "snapd.snap-repair.timer"]);

  const passwd = "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nalice:$6$hash$verylonghash:1000:1000:Alice,,,:/home/alice:/bin/bash\nbob:x:1001:1001::/home/bob:/bin/zsh\nsvc:x:998:998::/var/lib/svc:/bin/false\nguest:x:1002:1002::/home/guest:/bin/sh";
  const a = linux.parseAccounts(passwd, "sudo:x:27:alice\nwheel:x:10:");
  assert.deepEqual(a.map((x) => [x.name, x.login, x.admin, x.guest]), [
    ["root", true, true, false], ["alice", true, true, false], ["bob", true, false, false], ["guest", true, false, true],
  ]);
  assert.ok(!JSON.stringify(a).includes("verylonghash"));
});

test("linux parse: mail with MTA, MTA alone reported, nothing readable gives nothing", () => {
  const withPorts = linux.parse({ listen: SS, mta: "/usr/sbin/postfix" }, NOW);
  assert.deepEqual(by(withPorts, "mail")[0].ports, [587]);
  const alone = linux.parse({ listen: "tcp LISTEN 0 4096 127.0.0.1:631 0.0.0.0:*", mta: "/usr/sbin/exim4" }, NOW);
  assert.deepEqual([by(alone, "mail")[0].ports, by(alone, "mail")[0].mta], [[], "exim4"]);
  assert.deepEqual(linux.parse({}, NOW), []);
});

// ---- windows (fixtures written from the known cmdlet formats; not run on a real Windows machine)
const WIN_LISTEN = `L|0.0.0.0|135|svchost
L|::|445|System
L|127.0.0.1|5432|postgres
L|::1|9229|node
L|192.168.1.50|139|System
L|0.0.0.0|25|
L|0.0.0.0|abc|x
OK`;

test("windows listen: bind classes, empty process name, bad port skipped", () => {
  const f = win.parseListen(WIN_LISTEN);
  assert.equal(f.length, 6);
  assert.deepEqual(f.map((x) => x.bind), ["all", "all", "loopback", "loopback", "lan", "all"]);
  assert.equal(f.find((x) => x.port === 25).proc, null);
  const m = by(win.parse({ listen: WIN_LISTEN, mta: "M|SMTPSVC\nOK" }), "mail");
  assert.deepEqual([m[0].ports, m[0].mta], [[25], "SMTPSVC"]);
});

test("windows persistence: tasks, startup commands, run keys, startup folder", () => {
  assert.deepEqual(win.parseTasks("T|\\Google\\GoogleUpdateTaskMachineUA|Ready\nT|\\Backup|Disabled\nOK").map((x) => x.entry), ["\\Google\\GoogleUpdateTaskMachineUA", "\\Backup"]);
  const s = win.parseStartup("S|Startup|Dropbox.lnk\nS|HKU\\S-1-5-21-1\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run|OneDrive\nS|Common Startup|x.lnk\nS|Something|Odd\nOK");
  assert.deepEqual(s.map((x) => x.where), ["startup-folder", "run-key", "startup-folder", "login-item"]);
  const r = win.parseRunKeys("R|HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run|Spotify\nR|HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run|SecurityHealth\nOK");
  assert.deepEqual(r.map((x) => x.entry), ["HKCU Spotify", "HKLM SecurityHealth"]);
  const d = win.parseStartupDir("F|updater.bat|400\nF|odd.lnk|\nOK");
  assert.deepEqual(d.map((x) => x.ageDays), [400, null]);
});

test("windows accounts and stale", () => {
  const a = win.parseAccounts("A|Administrator|False|S-1-5-21-1-500\nA|Guest|True|S-1-5-21-1-501\nA|mustafa|True|S-1-5-21-1-1001\nA|old|False|S-1-5-21-1-1002\nOK", "G|PC\\Administrator\nG|PC\\mustafa\nOK");
  assert.deepEqual(a.map((x) => [x.name, x.login, x.admin, x.guest]), [["Administrator", false, true, false], ["Guest", true, false, true], ["mustafa", true, true, false]]);
  const s = win.parseStale("D|C:\\Users\\m\\Downloads|120\nD|C:\\Users\\m\\Downloads|700\nD|C:\\Users\\m\\Desktop|95\nOK");
  assert.deepEqual(s.map((x) => [x.dir, x.count, x.oldestDays, x.usedKnown]), [["C:\\Users\\m\\Downloads", 2, 700, false], ["C:\\Users\\m\\Desktop", 1, 95, false]]);
});

test("every fact of every OS carries its real line", () => {
  const all = [...mac.parse({ listen: LSOF, launchdirs: LAUNCHDIRS, cron: "* * * * * x" }, NOW), ...linux.parse({ listen: SS }, NOW), ...win.parse({ listen: WIN_LISTEN })];
  assert.ok(all.length > 10);
  assert.ok(all.every((f) => typeof f.line === "string" && f.line.length > 0));
});
