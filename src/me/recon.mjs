// Look-around on this machine: OS, user name (git, then system), hosts from ~/.ssh/config, hints from
// known_hosts, project folder names, installed tools. Read-only and local. File contents and shell
// history are not read here.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { homedir, arch, userInfo, release } from "node:os";
import { execProgram, readText } from "../core/fsx.mjs";
import { join } from "node:path";

const sh = (cmd) => {
  try { const r = spawnSync("bash", ["-lc", cmd], { encoding: "utf8", timeout: 4000 }); return r.status === 0 ? (r.stdout || "").trim() : ""; } catch { return ""; }
};
const tilde = (p, home) => (p && home && p.startsWith(home + "/") ? "~" + p.slice(home.length) : p);

// How the person is called: their git name, then the system's full name (macOS), then the login name.
export function whoAmI(run = sh) {
  const git = run("git config --global user.name");
  if (git) return { name: git, source: "git" };
  const full = process.platform === "darwin" ? run("id -F") : run("getent passwd $(id -un) | cut -d: -f5 | cut -d, -f1");
  if (full) return { name: full, source: "system" };
  let login = ""; try { login = userInfo().username; } catch { /* none */ }
  return { name: login, source: "login" };
}

// "macOS 26.4.1 (arm64)", "Ubuntu 26.04.1 LTS (x64)" - what this machine says about itself.
// Shell-free OS name: darwin -> sw_vers, win32 -> "Windows <os.release()>", linux -> PRETTY_NAME of /etc/os-release.
// exec(command, args) default fsx.execProgram, read(path) default fsx.readText; platform/rel are injectable for tests.
export function osName({ exec = execProgram, read = readText, platform = process.platform, rel = release } = {}) {
  if (platform === "darwin") {
    const v = (a) => { try { const r = exec("sw_vers", [a]); return r && r.ok !== false ? String(r.out || "").trim() : ""; } catch { return ""; } };
    return [v("-productName"), v("-productVersion")].filter(Boolean).join(" ");
  }
  if (platform === "win32") { let r = ""; try { r = String(rel()); } catch { /* none */ } return ("Windows " + r).trim(); }
  if (platform === "linux") {
    let t = ""; try { t = (read("/etc/os-release") || {}).text || ""; } catch { /* none */ }
    const m = /^PRETTY_NAME=(.*)$/m.exec(t);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  }
  return "";
}
export function machine(run = sh, { exec } = {}) {
  if (exec) return `${osName({ exec }) || process.platform} (${arch()})`;
  let os = "";
  if (process.platform === "darwin") os = [run("sw_vers -productName"), run("sw_vers -productVersion")].filter(Boolean).join(" ");
  else os = run('. /etc/os-release 2>/dev/null; echo "$PRETTY_NAME"') || run("uname -s");
  return `${os || process.platform} (${arch()})`;
}

// Hosts of ~/.ssh/config: alias, where it points, as whom, with which key file (the path, never the key).
export function sshHosts(home = homedir()) {
  let text = "";
  try { text = readFileSync(join(home, ".ssh", "config"), "utf8"); } catch { return []; }
  const out = []; let cur = [];
  const flush = () => { for (const c of cur) out.push(c); cur = []; };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(\S+)\s*=?\s*(.+)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim().replace(/^"|"$/g, "");
    if (key === "host") { flush(); cur = val.split(/\s+/).filter((a) => !/[*?!]/.test(a)).map((alias) => ({ alias, host: alias, user: "", key: "" })); }
    else if (key === "hostname") cur.forEach((c) => { c.host = val; });
    else if (key === "user") cur.forEach((c) => { c.user = val; });
    else if (key === "identityfile") cur.forEach((c) => { if (!c.key) c.key = tilde(val.replace(/^~(?=\/)/, home), home); });
  }
  flush();
  return out.slice(0, 30).map((c) => ({ alias: c.alias, target: c.user ? `${c.user}@${c.host}` : c.host, host: c.host, key: c.key }));
}

// Hosts the person has connected to before (known_hosts), without the ones the config already names. The file
// keeps most entries hashed; only readable ones count. These are hints only: no user, no key.
// Code hosting is where code lives, not a server of the person's own.
const CODE_HOSTS = /^(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|ssh\.dev\.azure\.com|vs-ssh\.visualstudio\.com|git\.sr\.ht|source\.developers\.google\.com)$/i;
export function knownHosts(home = homedir(), skip = []) {
  let text = "";
  try { text = readFileSync(join(home, ".ssh", "known_hosts"), "utf8"); } catch { return []; }
  const seen = new Set(skip), out = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#") || line.startsWith("|")) continue;
    for (const f of line.split(/\s+/)[0].split(",")) {
      const host = f.replace(/^\[/, "").replace(/\]:\d+$/, "");
      if (host && !seen.has(host) && !CODE_HOSTS.test(host)) { seen.add(host); out.push(host); }
    }
  }
  return out.slice(0, 200);
}

// The ssh, scp and rsync commands in the shell history, reduced to WHERE and AS WHOM (and which key file): the rest of a
// line is never kept, and no other command is looked at. Most used first. Only called after the person said yes.
export function historyTargets(home = homedir(), { maxBytes = 8 * 1024 * 1024 } = {}) {
  const found = new Map();
  for (const f of [".zsh_history", ".bash_history"]) {
    let text = "";
    try { const p = join(home, f); if (statSync(p).size > maxBytes) text = readFileSync(p, "latin1").slice(-maxBytes); else text = readFileSync(p, "latin1"); } catch { continue; }
    for (const raw of text.split("\n")) {
      const m = /(?:^|;|\s)(ssh|scp|rsync)\s+(.+)$/.exec(raw.replace(/^: \d+:\d+;/, ""));
      if (!m || (m[1] !== "ssh" && !raw.includes("@"))) continue;
      const toks = m[2].split(/\s+/);
      let key = "";
      for (let i = 0; i < toks.length; i++) if (toks[i] === "-i" && toks[i + 1]) key = toks[i + 1].replace(/["']/g, "");
      for (const t of toks) {
        const x = /^["']?(?:([A-Za-z0-9._-]+)@)?(\[[0-9a-fA-F:]+\]|[0-9a-fA-F:]*:[0-9a-fA-F:]+|[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?::[^\s]*)?["']?$/.exec(t);
        if (!x || (!x[1] && m[1] !== "ssh") || /^-/.test(t)) continue;
        const host = x[2].replace(/^\[|\]$/g, ""), user = x[1] || "";
        if (CODE_HOSTS.test(host) || !/[.:]/.test(host)) continue;
        const k = `${user}@${host}`, e = found.get(k) || { target: user ? k : host, host, user, key: "", count: 0 };
        e.count++; if (key && !e.key) e.key = key.replace(new RegExp("^" + home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/"), "~/");
        found.set(k, e);
        break;
      }
    }
  }
  return [...found.values()].sort((a, b) => b.count - a.count).slice(0, 30);
}

// Project folders: a folder with a .git inside, one level below the home folder or below the usual code
// folders. Names only, newest first.
const CODE_DIRS = ["", "Developer", "dev", "code", "Code", "projects", "Projects", "src", "workspace", "Projekte"];
const SKIP = new Set(["Library", "Applications", "Movies", "Music", "Pictures", "Public", "Downloads", "Documents", "Desktop", "node_modules"]);
export function projects(home = homedir()) {
  const found = [];
  for (const d of CODE_DIRS) {
    const base = d ? join(home, d) : home;
    let names = []; try { names = readdirSync(base); } catch { continue; }
    for (const n of names) {
      if (n.startsWith(".") || (!d && SKIP.has(n))) continue;
      const p = join(base, n);
      try { if (statSync(p).isDirectory() && existsSync(join(p, ".git"))) found.push({ name: n, at: statSync(p).mtimeMs }); } catch { /* skip */ }
    }
  }
  const seen = new Set();
  return found.sort((a, b) => b.at - a.at).filter((x) => !seen.has(x.name) && seen.add(x.name)).slice(0, 15).map((x) => x.name);
}

export const tools = (run = sh) => ["node", "git", "php", "nginx", "docker", "ssh"].filter((t) => run(`command -v ${t}`));

/** Everything he may learn when he is allowed to look around. */
export function lookAround({ home = homedir(), run = sh, exec } = {}) {
  const who = whoAmI(run), hosts = sshHosts(home);
  return { name: who.name, nameSource: who.source, system: machine(run, { exec }), hosts, hints: knownHosts(home, hosts.map((h) => h.host)), projects: projects(home), tools: tools(run) };
}
