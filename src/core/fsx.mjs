// The house engine: the questions the checks ask about files, answered the same way on every system.
//   this machine  -> plain Node (fs, no shell, so no bash is needed and no path can turn into a command)
//   a server      -> the same question as a shell snippet over ssh (a server is Linux or BSD)
// Every answer says what was done in `cmd`, so a verdict keeps its real line. A question the engine cannot answer on this
// system says so (ran:false) and the check reports "unknown" - it never guesses.
import { readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { run, isLocalTarget } from "./sh.mjs";
import { isWindows } from "./perm.mjs";

const WRITABLE_BY_ALL = 0o002;

// Files (not links) with the write right for everyone, up to `depth` levels below each folder, staying on one disk like `find -xdev`.
// -> { ran, files:[path], cmd, unreadable, errorMsg }
export function worldWritableFiles(dirs, { depth = 3, limit = 12 } = {}) {
  if (!isLocalTarget()) {
    const cmd = "find " + dirs.join(" ") + " -xdev -maxdepth " + depth + " -type f -perm -0002";
    const r = run(cmd + " 2>/dev/null | head -" + limit);
    return { ran: r.ran, files: r.out.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, limit), cmd, unreadable: null, errorMsg: r.errorMsg };
  }
  const cmd = "dante:find-writable " + dirs.join(" ") + " (depth " + depth + ")";
  if (isWindows()) return { ran: false, files: [], cmd, unreadable: null, errorMsg: "Windows: die Rechte-Suche für alle-beschreibbar ist noch nicht gebaut" };
  const files = []; let unreadable = 0;
  const walk = (dir, level, dev) => {
    if (files.length >= limit) return;
    let names;
    try { names = readdirSync(dir); } catch { unreadable++; return; }
    for (const n of names) {
      if (files.length >= limit) return;
      const p = join(dir, n);
      let st; try { st = lstatSync(p); } catch { unreadable++; continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (level < depth && st.dev === dev) walk(p, level + 1, dev); }
      else if (st.isFile() && (st.mode & WRITABLE_BY_ALL)) files.push(p);
    }
  };
  let any = false;
  for (const d of dirs) { try { const st = lstatSync(d); any = true; if (st.isDirectory()) walk(d, 1, st.dev); } catch { /* a folder that is not there is simply not searched, like find */ } }
  return { ran: any, files, cmd, unreadable, errorMsg: any ? "" : "keiner der Ordner war lesbar" };
}

// ---- more questions ---------------------------------------------------------------------------------------------------

import { readFileSync, statSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import net from "node:net";
import { toJs } from "../pack/ere.mjs";
import { isOwnerOnly } from "./perm.mjs";
const sqs = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const LABEL = (dirs) => dirs.join(" ");

// Which of these folders exist? -> { ran, dirs }
export function existingDirs(list) {
  if (!isLocalTarget()) {
    const r = run("for d in " + list.join(" ") + '; do [ -d "$d" ] && echo "$d"; done');
    return { ran: r.ran, dirs: r.ran ? r.out.split("\n").map((s) => s.trim()).filter(Boolean) : [], cmd: "for d in " + list[0] + " … ; do [ -d $d ] && echo $d; done", errorMsg: r.err || r.errorMsg };
  }
  const dirs = list.filter((d) => { try { return statSync(d).isDirectory(); } catch { return false; } });
  return { ran: true, dirs, cmd: "dante:dirs-exist " + list[0] + " …", errorMsg: "" };
}

// A program with arguments, no shell around it on this machine. -> { ran, ok, out, err, code, cmd }
export function execProgram(command, args = [], { timeout = 15000, input } = {}) {
  if (!isLocalTarget()) {
    const r = run([command, ...args].map(sqs).join(" ") + " 2>/dev/null", { timeout });
    return { ran: r.ran, ok: r.ok, out: r.out, err: r.err, code: r.code, cmd: [command, ...args].join(" ") };
  }
  const r = spawnSync(command, args, { encoding: "utf8", timeout, windowsHide: true, ...(input !== undefined ? { input } : {}) });
  const cmd = [command, ...args].join(" ");
  if (r.error) return { ran: false, ok: false, out: "", err: String(r.error.message), code: null, cmd };
  return { ran: typeof r.status === "number", ok: r.status === 0, out: (r.stdout || "").trimEnd(), err: (r.stderr || "").trimEnd(), code: r.status, cmd };
}

// A text file, whole. -> { ran, text, cmd }
export function readText(path, { max = 2 * 1024 * 1024 } = {}) {
  if (!isLocalTarget()) {
    const r = run("cat " + sqs(path) + " 2>/dev/null");
    return { ran: r.ran && r.ok, text: r.out, cmd: "cat " + path };
  }
  try { return { ran: true, text: readFileSync(path, "utf8").slice(0, max), cmd: "dante:read " + path }; }
  catch { return { ran: false, text: "", cmd: "dante:read " + path }; }
}

// find -name / -path tails: "*.sql", ".env", ".git/config" -> a test on the path
const globRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]") + "$");
const matchName = (names) => {
  const tests = names.map((n) => (n.includes("/") ? (p) => p.replace(/\\/g, "/").endsWith("/" + n) : ((re) => (p) => re.test(p.replace(/\\/g, "/").split("/").pop()))(globRe(n))));
  return (p) => tests.some((t) => t(p));
};
function* walkFiles(root, depth, skipDirs = []) {
  const stack = [[root, 1]];
  while (stack.length) {
    const [dir, level] = stack.pop();
    let names; try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) {
      const p = join(dir, n); let st; try { st = lstatSync(p); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (level < depth && !skipDirs.includes(n)) stack.push([p, level + 1]); } else if (st.isFile()) yield { p, st };
    }
  }
}

// Files by name (and readable by everyone) below some folders. -> { ran, files, cmd }
export function findFiles(roots, { names, depth = 4, worldReadable = true, limit = 10, skipDirs = [] } = {}) {
  if (!isLocalTarget()) {
    const pick = names.map((n) => (n.includes("/") ? "-path " + sqs("*/" + n) : "-name " + sqs(n))).join(" -o ");
    const skip = skipDirs.map((d) => " -not -path " + sqs("*/" + d + "/*")).join("");
    const cmd = "find " + LABEL(roots) + " -maxdepth " + depth + " -type f \\( " + pick + " \\)" + skip + (worldReadable ? " -perm -0004" : "");
    const r = run(cmd + " 2>/dev/null | head -" + limit);
    return { ran: r.ran, files: r.out.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, limit), cmd, errorMsg: r.errorMsg };
  }
  const cmd = "dante:find-files " + LABEL(roots) + " (" + names.join(", ") + (worldReadable ? "; lesbar für alle" : "") + ")";
  const want = matchName(names), files = [];
  for (const root of roots) for (const { p, st } of walkFiles(root, depth, skipDirs)) {
    if (files.length >= limit) break;
    if (!want(p)) continue;
    if (worldReadable && !(isWindows() ? isOwnerOnly(p) === false : (st.mode & 0o004))) continue;
    files.push(p);
  }
  return { ran: true, files, cmd, errorMsg: "" };
}

// Files whose text matches a POSIX extended pattern. -> { ran, files, cmd }; a pattern JavaScript cannot take cleanly: ran:false
export function grepFiles(roots, ere, { glob = "*", limit = 5, maxBytes = 2 * 1024 * 1024 } = {}) {
  if (!isLocalTarget()) {
    const cmd = "grep -rlE " + sqs(ere) + " --include=" + sqs(glob) + " " + LABEL(roots);
    const r = run(cmd + " 2>/dev/null | head -" + limit);
    return { ran: r.ran, files: r.out.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, limit), cmd: "grep -rlE '<muster>' --include=" + glob + " <webroot>", errorMsg: r.errorMsg };
  }
  const cmd = "dante:grep-files '<muster>' " + glob + " " + LABEL(roots);
  const js = toJs(ere); if (js == null) return { ran: false, files: [], cmd, errorMsg: "Muster nicht lokal übersetzbar" };
  let re; try { re = new RegExp(js); } catch { return { ran: false, files: [], cmd, errorMsg: "Muster nicht lokal übersetzbar" }; }
  const want = globRe(glob), files = [];
  for (const root of roots) for (const { p, st } of walkFiles(root, 64)) {
    if (files.length >= limit) break;
    if (!want.test(p.replace(/\\/g, "/").split("/").pop()) || st.size > maxBytes) continue;
    let text; try { text = readFileSync(p, "latin1"); } catch { continue; }
    if (re.test(text)) files.push(p);
  }
  return { ran: true, files, cmd, errorMsg: "" };
}

// The same program run without blocking (the waiting screen keeps moving). On this machine only: no shell, optional stdin.
export function execProgramAsync(command, args = [], { timeout = 15000, input } = {}) {
  return new Promise((resolve) => {
    const cmd = [command, ...args].join(" ");
    let out = "", err = "", done = false;
    const fin = (r) => { if (!done) { done = true; clearTimeout(timer); resolve({ cmd, ...r }); } };
    let c;
    try { c = spawn(command, args, { stdio: [input !== undefined ? "pipe" : "ignore", "pipe", "pipe"], windowsHide: true }); }
    catch (e) { return resolve({ cmd, ran: false, ok: false, out: "", err: String(e.message), code: null }); }
    const timer = setTimeout(() => { c.kill("SIGKILL"); fin({ ran: false, ok: false, out: out.trimEnd(), err: "timeout", code: null }); }, timeout);
    c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (err += d));
    c.on("error", (e) => fin({ ran: false, ok: false, out: "", err: String(e.message), code: null }));
    c.on("close", (code) => fin({ ran: typeof code === "number", ok: code === 0, out: out.trimEnd(), err: err.trimEnd(), code }));
    if (input !== undefined) { c.stdin.on("error", () => {}); c.stdin.end(input); }
  });
}

// Does something answer on this port of THIS machine? A plain connect to 127.0.0.1, nothing leaves the machine. The checks are
// synchronous, so the connect runs in a tiny child Node process. -> { ran, open, cmd, why }
const CONNECT = 'const s=require("net").connect({port:+process.argv[1],host:process.argv[2]});s.setTimeout(1500,()=>{console.log("silent");process.exit(0)});s.once("connect",()=>{console.log("open");process.exit(0)});s.once("error",e=>{console.log("err:"+(e.code||e.message));process.exit(0)})';
export function tcpOpen(port, { host = "127.0.0.1" } = {}) {
  const cmd = `dante:tcp-connect ${host}:${port}`;
  const r = spawnSync(process.execPath, ["-e", CONNECT, String(port), host], { encoding: "utf8", timeout: 6000, windowsHide: true });
  const out = (r.stdout || "").trim();
  if (!out) return { ran: false, open: false, cmd, why: "nicht prüfbar" };
  if (out === "open") return { ran: true, open: true, cmd, why: "Verbindung steht" };
  return { ran: true, open: false, cmd, why: out === "silent" ? "keine Antwort" : out === "err:ECONNREFUSED" ? "Verbindung abgelehnt" : out.replace(/^err:/, "") };
}
