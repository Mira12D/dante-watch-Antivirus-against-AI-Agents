// Level 1 and 2 of looking at a system: WHAT is it, and what does it say about itself.
//
// Level 1 (identify): one script runs a fixed list of harmless read-only probes (PROBES) on the target and the output is
// kept per probe. Then the system library (src/bib/systems.json) is tried entry by entry, "in rotation": a system matches
// when every condition of its `identify` list matches the output of the named probe. The match with the most conditions
// wins; no match means "unknown", never a guess.
// Level 2 (facts): the probes of INFO and ACTIVITY give the basics (version, load, memory, disk, uptime) and what is going on
// (busy processes, listening ports, failed services, who is logged in). Level 3 (the security checks) lives in src/checks.
//
// The library is data, written offline and checked there. It names probes by id; it can never bring a command of its own.
import { toJs } from "../pack/ere.mjs";
import os from "node:os";
import { execProgram } from "../core/fsx.mjs";

// id -> shell snippet. The only commands this module ever runs. All read-only; a missing tool just prints nothing.
export const PROBES = {
  os_release: "cat /etc/os-release 2>/dev/null",
  lsb_release: "cat /etc/lsb-release 2>/dev/null",
  issue: "head -3 /etc/issue 2>/dev/null",
  redhat_release: "cat /etc/redhat-release 2>/dev/null",
  uname: "uname -a 2>/dev/null",
  sw_vers: "sw_vers 2>/dev/null",
  freebsd_version: "freebsd-version 2>/dev/null",
  version_file: "cat /etc/version 2>/dev/null",
  opnsense_version: "cat /usr/local/opnsense/version/core 2>/dev/null",
  platform_file: "cat /etc/platform 2>/dev/null",
  openwrt_release: "cat /etc/openwrt_release 2>/dev/null",
  synology: "cat /etc.defaults/VERSION 2>/dev/null",
  proxmox: "pveversion 2>/dev/null",
  esxi: "vmware -v 2>/dev/null",
  busybox: "{ command -v busybox >/dev/null && busybox 2>&1 | head -1; } 2>/dev/null",
  device_model: "{ tr -d '\\0' < /proc/device-tree/model; } 2>/dev/null",
  dmi_product: "cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null",
  hw_model: "sysctl -n hw.model 2>/dev/null",
  proc_version: "head -1 /proc/version 2>/dev/null",
  wsl: "grep -i microsoft /proc/version 2>/dev/null",
  container: "{ [ -f /.dockerenv ] && echo dockerenv; head -3 /proc/1/cgroup 2>/dev/null; } 2>/dev/null",
  windows_ver: "cmd /c ver 2>/dev/null",
};
export const PROBE_IDS = Object.keys(PROBES);

// what level 2 asks, as small sections; each section is a snippet that prints the facts of one thing
export const FACTS = {
  host: "hostname 2>/dev/null",
  cpu: "{ grep -m1 'model name' /proc/cpuinfo | cut -d: -f2; sysctl -n machdep.cpu.brand_string; } 2>/dev/null | head -1",
  cores: "{ nproc || sysctl -n hw.ncpu; } 2>/dev/null | head -1",
  mem: "{ awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{if(t)printf \"%d %d\", t/1024, (t-a)/1024}' /proc/meminfo; [ -z \"$(command -v free)\" ] && sysctl -n hw.memsize | awk '{printf \"%d\", $1/1048576}'; } 2>/dev/null",
  disk: "df -h / 2>/dev/null | awk 'NR==2{print $2\" \"$5}'",
  uptime: "uptime 2>/dev/null",
};
export const ACTIVITY = {
  top: "{ ps -Ao pcpu,comm -r 2>/dev/null || ps -eo pcpu,comm --sort=-pcpu 2>/dev/null; } | sed -n '2,6p' | awk '{c=$1; $1=\"\"; n=split($0,a,\"/\"); gsub(/^ +/,\"\",a[n]); print c\" \"a[n]}'",
  ports: "{ ss -ltnH 2>/dev/null | awk '{print $4}'; [ -z \"$(command -v ss)\" ] && netstat -an 2>/dev/null | awk '/LISTEN/{print $4}'; } | sed 's/.*[:.]//' | sort -un | head -15 | tr '\\n' ' '",
  failed: "systemctl --failed --no-legend --plain 2>/dev/null | awk '{print $1}' | head -8 | tr '\\n' ' '",
  who: "who 2>/dev/null | awk '{print $1}' | sort | uniq -c | tr '\\n' ';'",
};

// a section always ends on a new line, even when the snippet prints none (printf)
const sec = (name, cmd) => `echo '@@${name}'; ${cmd}; echo`;
/** One script that prints everything, in marked sections. kind: "id" (level 1), "info" (+ level 2), "activity" (+ what is going on). */
export function script(kind = "info") {
  const parts = PROBE_IDS.map((id) => sec("p:" + id, PROBES[id]));
  if (kind !== "id") parts.push(...Object.entries(FACTS).map(([k, v]) => sec("f:" + k, v)));
  if (kind === "activity") parts.push(...Object.entries(ACTIVITY).map(([k, v]) => sec("a:" + k, v)));
  return parts.join("\n") + "\necho '@@end'";
}
/**
 * Listening TCP ports out of `netstat -ano -p TCP`. The word for "listening" is translated by Windows (ABHÖREN, ESCUCHANDO …), so a
 * listener is recognised by its foreign address, which is always 0.0.0.0:0 or [::]:0.
 */
export function parseNetstat(text) {
  const ports = new Set();
  for (const l of String(text || "").split(/\r?\n/)) {
    const m = /^\s*TCP\s+(\S+):(\d+)\s+(?:0\.0\.0\.0|\[::\]|\*):0\s/i.exec(l);
    if (m) ports.add(Number(m[2]));
  }
  return [...ports].sort((a, b) => a - b).slice(0, 15).join(" ");
}

/**
 * The same marked sections for THIS machine on Windows, read with Node alone (no shell there). What Node cannot give
 * (disk, ports, busy processes) is left empty: the report then says unknown instead of making it up.
 */
export function nativeOutput(kind = "info") {
  const mb = (n) => Math.round(n / 1048576);
  const cpus = os.cpus() || [];
  const sections = [["p:windows_ver", `Microsoft Windows [Version ${os.release()}]\n${typeof os.version === "function" ? os.version() : ""}`], ["p:uname", `${os.type()} ${os.hostname()} ${os.release()} ${os.arch()}`]];
  if (kind !== "id") sections.push(["f:host", os.hostname()], ["f:cpu", (cpus[0] && cpus[0].model || "").trim()], ["f:cores", String(cpus.length || "")],
    ["f:mem", `${mb(os.totalmem())} ${mb(os.totalmem() - os.freemem())}`], ["f:uptime", `up ${Math.floor(os.uptime() / 3600)} hours`]);
  if (kind === "activity") {
    // ports from netstat (a system program, no shell); who = only the account running Dante (the others are not read, so not claimed)
    const ns = execProgram("netstat", ["-ano", "-p", "TCP"]);
    if (ns.ran && ns.out) sections.push(["a:ports", parseNetstat(ns.out)]);
    try { sections.push(["a:who", `1 ${os.userInfo().username}`]); } catch { /* unknown stays out */ }
  }
  return sections.map(([n, t]) => `@@${n}\n${t}\n`).join("") + "@@end";
}
/** Output of script() -> { probes, facts, activity } (each a map name -> trimmed text). */
export function parse(out) {
  const r = { probes: {}, facts: {}, activity: {} };
  let cur = null, buf = [];
  const flush = () => { if (!cur) return; const t = buf.join("\n").trim(); const [k, n] = cur.split(":"); (k === "p" ? r.probes : k === "f" ? r.facts : r.activity)[n] = t; };
  for (const line of String(out || "").split("\n")) {
    const m = /^@@(\S+)$/.exec(line.trimEnd());
    if (m) { flush(); cur = m[1] === "end" ? null : m[1]; buf = []; } else if (cur) buf.push(line);
  }
  flush();
  return r;
}

// ---- the system library
const SYS_ID = /^[a-z0-9._-]{1,40}$/;
export const KINDS = ["server", "desktop", "router", "nas", "hypervisor", "embedded", "container", "other"];
const clean = (s, max) => typeof s === "string" && s.length > 0 && s.length <= max && !/[\u0000-\u001f]/.test(s);
/** null when the library is fine, else a short reason. */
export function validateSystems(list) {
  if (!Array.isArray(list) || !list.length || list.length > 400) return "systems: Anzahl";
  const seen = new Set();
  for (const s of list) {
    if (!s || !SYS_ID.test(s.id || "") || seen.has(s.id)) return "id";
    seen.add(s.id);
    if (!KINDS.includes(s.kind)) return s.id + ": kind";
    if (!s.name || !["de", "en", "es"].every((l) => clean(s.name[l], 80))) return s.id + ": name";
    if (!Array.isArray(s.identify) || !s.identify.length || s.identify.length > 6) return s.id + ": identify";
    for (const c of s.identify) {
      if (!c || !PROBES[c.probe] || !clean(c.re, 120) || !toJs(c.re)) return s.id + ": condition";
    }
    const f = s.facts || {};
    for (const k of ["pkg", "init", "firewall", "logs", "sshd"]) if (f[k] !== undefined && !clean(f[k], 120)) return s.id + ": facts." + k;
  }
  return null;
}

/** Level 1: which system is it? Tried entry by entry; the most specific full match wins. */
export function identify(probes, systems) {
  let best = null;
  for (const s of systems) {
    let ok = true;
    for (const c of s.identify) {
      const re = toJs(String(c.re).replace(/^\(\?i\)/, "")), text = (probes && probes[c.probe]) || "";
      if (!re || !text || !new RegExp(re.source, "im").test(text)) { ok = false; break; }
    }
    if (ok && (!best || s.identify.length > best.identify.length)) best = s;
  }
  return best;
}
