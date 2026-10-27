import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { identify, validateSystems, parse, script, PROBES } from "./sysid.mjs";

const SYSTEMS = JSON.parse(readFileSync(new URL("../bib/systems.json", import.meta.url), "utf8")).systems;
const osr = (id, extra = "") => `NAME="${id}"\nID=${id}\n${extra}`;
// outputs as the real files print them, written by hand: the library was built by a model and is measured against these
const UNAME = "Linux host 6.1.0 #1 SMP x86_64 GNU/Linux";
const CASES = [
  ["ubuntu", { os_release: 'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\nID_LIKE=debian', uname: "Linux web 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux" }],
  ["debian", { os_release: 'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_ID="12"\nID=debian', uname: "Linux db 6.1.0-25-amd64 #1 SMP Debian 6.1.106-3 x86_64 GNU/Linux" }],
  ["alpine", { os_release: 'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.19.1\nPRETTY_NAME="Alpine Linux v3.19"', uname: "Linux c1 6.6.14-0-lts #1-Alpine SMP x86_64 Linux" }],
  ["rocky-linux", { os_release: 'NAME="Rocky Linux"\nVERSION="9.4 (Blue Onyx)"\nID="rocky"\nID_LIKE="rhel centos fedora"\nVERSION_ID="9.4"', redhat_release: "Rocky Linux release 9.4 (Blue Onyx)" }],
  ["almalinux", { os_release: 'NAME="AlmaLinux"\nVERSION="9.4 (Seafoam Ocelot)"\nID="almalinux"\nID_LIKE="rhel centos fedora"\nVERSION_ID="9.4"', redhat_release: "AlmaLinux release 9.4 (Seafoam Ocelot)" }],
  ["fedora", { os_release: 'NAME="Fedora Linux"\nVERSION="40 (Server Edition)"\nID=fedora\nVERSION_ID=40', redhat_release: "Fedora release 40 (Forty)" }],
  ["arch-linux", { os_release: 'NAME="Arch Linux"\nPRETTY_NAME="Arch Linux"\nID=arch\nBUILD_ID=rolling' }],
  ["opensuse-leap", { os_release: 'NAME="openSUSE Leap"\nVERSION="15.5"\nID="opensuse-leap"\nID_LIKE="suse opensuse"\nVERSION_ID="15.5"' }],
  ["amazon-linux", { os_release: 'NAME="Amazon Linux"\nVERSION="2023"\nID="amzn"\nID_LIKE="fedora"\nVERSION_ID="2023"' }],
  ["rhel", { os_release: 'NAME="Red Hat Enterprise Linux"\nVERSION="9.4 (Plow)"\nID="rhel"\nID_LIKE="fedora"\nVERSION_ID="9.4"', redhat_release: "Red Hat Enterprise Linux release 9.4 (Plow)" }],
  ["macos", { sw_vers: "ProductName:\t\tmacOS\nProductVersion:\t\t14.5\nBuildVersion:\t\t23F79", uname: "Darwin mac.local 23.5.0 Darwin Kernel Version 23.5.0 arm64", hw_model: "Mac14,2" }],
  ["freebsd", { freebsd_version: "14.0-RELEASE-p6", uname: "FreeBSD nas 14.0-RELEASE-p6 FreeBSD 14.0-RELEASE-p6 GENERIC amd64" }],
  ["openbsd", { uname: "OpenBSD fw.example.org 7.5 GENERIC.MP#82 amd64", hw_model: "Intel(R) Xeon(R) CPU" }],
  ["openwrt", { openwrt_release: "DISTRIB_ID='OpenWrt'\nDISTRIB_RELEASE='23.05.3'\nDISTRIB_TARGET='ath79/generic'", uname: "Linux OpenWrt 5.15.150 #0 SMP mips GNU/Linux" }],
  ["proxmox-ve", { os_release: 'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nID=debian', proxmox: "pve-manager/8.2.4/faa83925c9641325 (running kernel: 6.8.8-2-pve)", uname: "Linux pve 6.8.8-2-pve #1 SMP PREEMPT_DYNAMIC PMX x86_64 GNU/Linux" }],
  ["synology-dsm", { synology: 'majorversion="7"\nminorversion="2"\nproductversion="7.2.1"\nbuildnumber="69057"', uname: "Linux DiskStation 4.4.302+ #69057 SMP x86_64 GNU/Linux synology_geminilake_920+" }],
  ["raspberry-pi-os", { os_release: 'PRETTY_NAME="Raspbian GNU/Linux 12 (bookworm)"\nID=raspbian\nID_LIKE=debian', device_model: "Raspberry Pi 4 Model B Rev 1.4", uname: "Linux raspberrypi 6.6.31+rpt-rpi-v8 #1 SMP PREEMPT Debian aarch64 GNU/Linux" }],
  ["esxi", { esxi: "VMware ESXi 8.0.2 build-22380479", uname: "VMkernel esx1 8.0.2 #1 SMP Release build-22380479 x86_64" }],
  ["kali-linux", { os_release: 'PRETTY_NAME="Kali GNU/Linux Rolling"\nNAME="Kali GNU/Linux"\nID=kali\nID_LIKE=debian' }],
  ["linux-mint", { os_release: 'NAME="Linux Mint"\nVERSION="21.3 (Virginia)"\nID=linuxmint\nID_LIKE="ubuntu debian"' }],
  ["opnsense", { freebsd_version: "13.2-RELEASE-p11", uname: "FreeBSD fw.lan 13.2-RELEASE-p11 FreeBSD 13.2-RELEASE-p11 stable/23.7 amd64", opnsense_version: "OPNsense 23.7.12-amd64" }],
]
  .map(([id, p]) => [id, { uname: UNAME, ...p }]);
test("die System-Bib ist gültig und gross genug", () => { assert.equal(validateSystems(SYSTEMS), null); assert.ok(SYSTEMS.length >= 60, "systems: " + SYSTEMS.length); });
test("Erkennung in der Rotation: gängige Systeme (Ebene 1)", () => {
  const wrong = [];
  for (const [want, probes] of CASES) { const got = identify(probes, SYSTEMS); if (!got || got.id !== want) wrong.push(`${want} -> ${got ? got.id : "unbekannt"}`); }
  assert.ok(CASES.length - wrong.length >= Math.ceil(CASES.length * 0.8), "falsch erkannt: " + wrong.join(", "));
  // the ones that must never be wrong: a wrong name is worse than "unknown"
  for (const w of wrong) assert.ok(/-> unbekannt$/.test(w) || /^(ubuntu|debian|macos|alpine) /.test(w) === false, "falsch benannt: " + w);
});
test("ein unbekanntes System wird 'unbekannt', nie geraten", () => {
  assert.equal(identify({ os_release: 'NAME="Zzyzx OS"\nID=zzyzx', uname: "Linux x 5.0 #1 x86_64" }, SYSTEMS), null);
  assert.equal(identify({}, SYSTEMS), null);
});
test("Skript und Parser: Abschnitte kommen heil zurück, auch ohne Zeilenumbruch am Ende", () => {
  const out = "@@p:uname\nLinux x\n@@p:os_release\n@@f:mem\n8192 1024\n@@f:disk\n228G 39%\n@@a:ports\n22 80 \n@@end\n";
  const r = parse(out);
  assert.equal(r.probes.uname, "Linux x"); assert.equal(r.probes.os_release, ""); assert.equal(r.facts.mem, "8192 1024"); assert.equal(r.activity.ports, "22 80");
  assert.ok(script("activity").includes("@@a:top") && !script("id").includes("@@f:"));
  assert.ok(Object.values(PROBES).every((c) => !/(^|[\s;|&{(])(rm|mv|dd|chmod|chown|curl|wget|sudo|tee|touch|mkdir)\s|>\s*\/(?!dev\/null)/.test(c.replace(/2>\/dev\/null|>\/dev\/null/g, ""))), "nur lesende Sonden");
});

import { report, versionLine } from "./sysreport.mjs";
const MAC = "@@p:uname\nDarwin mac.local 23.5.0 Darwin Kernel Version 23.5.0 arm64\n@@p:sw_vers\nProductName:\t\tmacOS\nProductVersion:\t\t14.5\nBuildVersion:\t\t23F79\n@@p:hw_model\nMac14,2\n@@f:host\nmac.local\n@@f:cpu\nApple M2\n@@f:cores\n8\n@@f:mem\n8192\n@@f:disk\n228Gi 39%\n@@f:uptime\n2:08  up 23 days, 23:19, 4 users, load averages: 2,26 3,20 4,62\n@@a:top\n35,0 WindowServer\n20,6 Chrome\n@@a:ports\n80 5000\n@@a:failed\n\n@@a:who\n4 alex;\n@@end\n";
const UBU = "@@p:os_release\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\nNAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nID=ubuntu\nID_LIKE=debian\n@@p:uname\nLinux web 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux\n@@f:host\nweb\n@@f:cpu\n Intel(R) Xeon(R) CPU\n@@f:cores\n4\n@@f:mem\n3920 1210\n@@f:disk\n78G 45%\n@@f:uptime\n 10:11:02 up 12 days,  3:40,  1 user,  load average: 0.15, 0.10, 0.05\n@@a:top\n12.0 php-fpm8.3\n3.1 mysqld\n@@a:ports\n22 80 443 3306\n@@a:failed\nnginx.service \n@@a:who\n1 root;\n@@end\n";
test("Bericht Mac: System, Maschine, nur Gelesenes", () => {
  const r = report(MAC, SYSTEMS, "de", "info");
  assert.equal(r.id, "macos"); const t = r.lines.join("\n");
  assert.match(t, /System: .*macOS.*14\.5/); assert.match(t, /Rechner: mac\.local · Apple M2 · 8 Kerne · 8192 MB RAM · Platte 228Gi, 39% belegt · läuft seit 23 Tage, 23:19/);
  assert.ok(!/Last:/.test(t), "ohne 'was ist los' keine Aktivität");
});
test("Bericht Linux-Server in 'was ist los': Last, Prozesse, Ports, ausgefallene Dienste, Angemeldete", () => {
  const r = report(UBU, SYSTEMS, "de", "activity"); const t = r.lines.join("\n");
  assert.equal(r.id, "ubuntu"); assert.match(t, /Ubuntu/); assert.match(t, /3920 MB RAM, 31 % belegt/);
  assert.match(t, /Last: 0.15, 0.10, 0.05/); assert.match(t, /Am meisten los: php-fpm8\.3 \(12\.0 %\), mysqld/); assert.match(t, /Offene Ports: 22 80 443 3306/); assert.match(t, /Ausgefallene Dienste: nginx\.service/); assert.match(t, /Angemeldet: root/);
  assert.match(report(UBU, SYSTEMS, "en", "activity").lines.join("\n"), /Failed services: nginx\.service/);
  assert.match(report(UBU, SYSTEMS, "es", "info").lines.join("\n"), /Equipo: web/);
});
test("Unbekanntes System: ehrlich 'nicht sicher erkannt' mit dem, was es selbst sagt", () => {
  const r = report("@@p:os_release\nPRETTY_NAME=\"Zzyzx OS 1\"\nID=zzyzx\n@@p:uname\nLinux x 5.0 #1\n@@end\n", SYSTEMS, "de", "info");
  assert.equal(r.id, null); assert.match(r.lines[0], /nicht sicher erkannt - Gesagt hat es: Zzyzx OS 1/);
});

import { nativeOutput, parse as parseSys, identify as identifySys } from "./sysid.mjs";
import { readFileSync as readFS } from "node:fs";
test("Windows ohne Shell: Node liefert die Abschnitte, das System wird erkannt, Fehlendes bleibt leer", () => {
  const out = nativeOutput("info"), r = parseSys(out);
  assert.match(r.probes.windows_ver, /^Microsoft Windows \[Version [0-9.]+/);
  assert.ok(r.facts.host.length > 0);
  assert.equal(r.facts.disk, undefined);   // not made up: Node has no disk figure
  const systems = JSON.parse(readFS(new URL("../bib/systems.json", import.meta.url), "utf8")).systems;
  const win = (version) => identifySys({ windows_ver: `Microsoft Windows [Version 10.0.22631.4317]\n${version}` }, systems).id;
  assert.equal(win("Windows 11 Pro"), "windows"); assert.equal(win("Windows 10 Home"), "windows");
  assert.equal(win("Windows Server 2022 Datacenter"), "windows-server");   // never "Server" for a desktop, never "desktop" for a server
  assert.equal(identifySys({ windows_ver: "Microsoft Windows [Version 10.0.17763.1]" }, systems).id, "windows-server");   // over ssh only `ver` is known
});

import { parseNetstat } from "./sysid.mjs";
test("netstat: Zuhörer werden an der Gegenadresse erkannt, nicht am (übersetzten) Wort", () => {
  const out = [
    "Aktive Verbindungen", "", "  Proto  Lokale Adresse         Remoteadresse          Status           PID",
    "  TCP    0.0.0.0:135            0.0.0.0:0              ABHÖREN         1048",
    "  TCP    0.0.0.0:445            0.0.0.0:0              ABHÖREN         4",
    "  TCP    [::]:3389              [::]:0                 ABHÖREN         1200",
    "  TCP    192.168.1.5:50123      93.184.216.34:443      HERGESTELLT     4312",
    "  TCP    127.0.0.1:5432         0.0.0.0:0              LISTENING       999",
  ].join("\r\n");
  assert.equal(parseNetstat(out), "135 445 3389 5432");   // sorted, unique, no established connection
  assert.equal(parseNetstat(""), "");
});
