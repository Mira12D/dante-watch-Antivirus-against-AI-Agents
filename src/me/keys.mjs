// "Find the key": which SSH keys does this machine have, and which one belongs to which server? Reads file NAMES in ~/.ssh and
// their fingerprints (ssh-keygen -l, public part only), the key file noted in user.md for each server, and what the ssh agent
// lists. Key contents are never read or shown; nothing is tried against a server.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execProgram } from "../core/fsx.mjs";

const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const FIND = W("find\\p{L}*|such\\p{L}*|zeig\\p{L}*|wo (?:ist|liegt|sind)|welche\\p{L}*|hol\\p{L}*|show|which|where|look for|busca\\p{L}*|muestra\\p{L}*|cu[aá]l\\p{L}*|d[oó]nde");
const KEY = W("schl[uü]ssel\\p{L}*|keys?|llaves?|claves?");
/** "finde den schlüssel einfach", "which ssh key do I use", "dónde está mi llave" (not "key ~/.ssh/x": that is the command) */
export const wantsKeyFind = (line) => FIND.test(line) && KEY.test(line) && !/[~/]/.test(line) && !W("ge[aä]ndert|changed|cambiad\\p{L}*|host ?key").test(line);
/** the same words about a changed host key ("finde den schlüssel einfach" right after the warning) */
export const wantsHostKeyLook = (line) => FIND.test(line) && KEY.test(line) && !/[~/]/.test(line);

const SKIP = new Set(["known_hosts", "known_hosts.old", "config", "authorized_keys", "agent", "environment"]);
/** private key files in ~/.ssh by name (a file with a matching .pub or a typical id_ name) */
export function keyFiles(home = homedir()) {
  const dir = join(home, ".ssh");
  let names = []; try { names = readdirSync(dir); } catch { return []; }
  return names.filter((n) => !n.endsWith(".pub") && !SKIP.has(n) && !n.startsWith(".") && (names.includes(n + ".pub") || /^id_|key|\.pem$/i.test(n))).sort();
}
export const fingerprint = async (run, file) => { const r = await run(`ssh-keygen -lf '${file.replace(/'/g, "'\\''")}' 2>/dev/null | head -1`); const m = /^(\d+)\s+(SHA256:\S+)\s+.*\((\w+)\)\s*$/.exec((r.out || "").trim()); return m ? { bits: Number(m[1]), fp: m[2], type: m[3] } : null; };

/** shell-free: ssh-keygen -lf <file> through exec(command, args) (default: fsx.execProgram); the file is ONE argument */
export const fingerprintExec = (file, exec = execProgram) => {
  if (typeof file !== "string" || !file || file.startsWith("-")) return null;
  const r = exec("ssh-keygen", ["-lf", file]) || {};
  const first = String(r.out || "").split("\n")[0].trim();
  const m = /^(\d+)\s+(SHA256:\S+)\s+.*\((\w+)\)\s*$/.exec(first);
  return m ? { bits: Number(m[1]), fp: m[2], type: m[3] } : null;
};
/** shell-free: ssh-add -l -> the lines with a fingerprint */
export const agentLines = (exec = execProgram) => {
  const r = exec("ssh-add", ["-l"]) || {};
  return String(r.out || "").split("\n").filter((l) => /SHA256:/.test(l));
};

/** io: mt, say, local(cmd) -> { out, ok } (sync or async), or exec(command, args) -> { out } (no shell; preferred when given). user: the parsed user.md. */
export async function keysFlow(io, user, { home = homedir() } = {}) {
  const M = io.mt(), files = keyFiles(home), tilde = (f) => "~/.ssh/" + f;
  io.say("  " + M.keysHead);
  if (!files.length) io.say("   " + M.keysNone);
  for (const f of files) {
    const base = join(home, ".ssh", existsSync(join(home, ".ssh", f + ".pub")) ? f + ".pub" : f);
    const fp = io.exec ? fingerprintExec(base, io.exec) : await fingerprint(async (c) => io.local(c), base);
    io.say("   " + tilde(f) + (fp ? ` - ${fp.type} ${fp.fp}` : ` - ${M.keysNoFp}`));
  }
  const servers = (user && user.servers) || [];
  const use = servers.filter((s) => s.key);
  if (use.length) { io.say("  " + M.keysUsed); for (const s of use) io.say("   " + `${s.alias} (${s.target}) -> ${s.key}`); }
  const rest = servers.filter((s) => !s.key);
  if (rest.length) io.say("  " + M.keysNoneFor(rest.map((s) => s.alias).join(", ")));
  const lines = io.exec ? agentLines(io.exec) : String((await io.local("ssh-add -l 2>/dev/null")).out || "").split("\n").filter((l) => /SHA256:/.test(l));
  if (lines.length) { io.say("  " + M.keysAgent(lines.length)); lines.slice(0, 6).forEach((l) => io.say("   " + l.replace(/^\d+\s+/, "").trim())); }
}
