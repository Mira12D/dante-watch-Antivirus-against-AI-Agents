// Runs commands, locally or over ssh, and returns stdout, stderr and the exit status. All evidence in
// the program comes through here.
import { spawn, spawnSync } from "node:child_process";
import { clean } from "./clean.mjs";

let PREFIX = null; // e.g. ["ssh","-i","/key","root@host"] - set by configureTarget()

// user@host, host, host:port-less names and addresses (letters, digits, . _ - @ : and [] for IPv6); never a leading -
export const validHost = (h) => typeof h === "string" && h.length > 0 && h.length < 256 && /^[A-Za-z0-9_][A-Za-z0-9._@:\[\]%-]*$/.test(h);

export function configureTarget(ssh) {
  // ssh: null (local) | {host, key?} - we build an argv prefix, never a shell string.
  if (!ssh) { PREFIX = null; return; }
  // A target is a name or address, never an option: a "host" that starts with "-" (-oProxyCommand=...) would be run by ssh
  // itself as an option. Anything that is not a plain host is refused here and answers "no channel", never a command.
  if (!validHost(ssh.host)) { PREFIX = ["sh", "-c", "echo 'ungültiges Ziel' >&2; exit 255", "dante"]; return; }
  const p = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];
  if (ssh.key) p.push("-i", ssh.key);
  p.push("--", ssh.host);
  PREFIX = p;
}

// true when the checks look at this machine (no ssh target): then the house engine (fsx.mjs) answers in plain Node
export const isLocalTarget = () => PREFIX === null;

export function targetLabel() {
  return PREFIX ? (PREFIX[0] === "ssh" ? PREFIX[PREFIX.length - 1] : "ungültig") : "localhost";
}

/**
 * Run a shell SCRIPT (one string). Locally via `bash -lc <script>`, remotely via `ssh host <script>`
 * where the remote login shell parses the exact same string — no fragile argv joining.
 * Returns { cmd, out, err, code, ok, ran }. `ran` = the process actually executed (vs ssh/spawn error).
 * ok=true only means it exited 0 — the caller decides what the lines mean.
 */
export function run(script, { timeout = 15000, input } = {}) {
  return exec(script, PREFIX, { timeout, input });
}

/**
 * Like run(), but ALWAYS on this machine, whatever target is set. For what belongs to the human's
 * own computer (fetching a pack into ~/.dante), never to the server Dante is looking at.
 */
export function runLocal(script, { timeout = 15000 } = {}) {
  return exec(script, null, { timeout });
}

/** runLocal() without blocking: the waiting screen keeps moving while the command runs. */
export function runLocalAsync(script, { timeout = 15000 } = {}) {
  return new Promise((resolve) => {
    const sh = localShell(String(script));
    const c = spawn(sh.bin, sh.args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, ...(sh.verbatim ? { windowsVerbatimArguments: true } : {}) });
    let out = "", err = "", done = false, killed = false;
    const finish = (code, errorMsg = "") => {
      if (done) return;
      done = true; clearTimeout(timer);
      const status = killed ? null : code;
      resolve({ cmd: String(script), out: clean(out.trimEnd()), err: clean(err.trimEnd()), code: typeof status === "number" ? status : -1, ok: status === 0, ran: typeof status === "number" && status >= 0, failed: !!errorMsg, errorMsg });
    };
    const timer = setTimeout(() => { killed = true; c.kill("SIGKILL"); }, timeout);
    c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (err += d));
    c.on("error", (e) => finish(-1, String(e.message)));
    c.on("close", (code) => finish(code));
  });
}

// The shell for a command on THIS machine: bash -lc on macOS and Linux; on Windows cmd.exe (it is always there, bash is not).
const localShell = (s) => (process.platform === "win32"
  ? { bin: "cmd.exe", args: ["/d", "/s", "/c", `"${s}"`], verbatim: true }
  : { bin: "bash", args: ["-lc", s], verbatim: false });

function exec(script, prefix, { timeout, input }) {
  const s = Array.isArray(script) ? script.join(" ") : String(script);
  let bin, args, verbatim = false;
  if (prefix) { bin = prefix[0]; args = [...prefix.slice(1), s]; } else ({ bin, args, verbatim } = localShell(s));
  const r = spawnSync(bin, args, { encoding: "utf8", timeout, input, maxBuffer: 8 * 1024 * 1024, windowsHide: true, ...(verbatim ? { windowsVerbatimArguments: true } : {}) });
  const out = clean((r.stdout || "").trimEnd());
  const err = clean((r.stderr || "").trimEnd());
  return {
    cmd: s,
    out,
    err,
    code: typeof r.status === "number" ? r.status : (r.error ? -1 : null),
    ok: r.status === 0,
    ran: typeof r.status === "number", // process ran and returned an exit code (not an ssh/spawn failure)
    failed: !!r.error,
    errorMsg: r.error ? String(r.error.message) : "",
  };
}

/**
 * Why ssh gave no channel, from what it printed. The first line of the error is often a banner of @ signs, so the whole
 * text is read. Returns { code, line }: a code the UI puts into words, and the first line that says something.
 */
export function sshReason(text) {
  const t = String(text || "");
  const line = t.split("\n").map((x) => x.trim()).find((x) => x && !/^[@#\s*-]+$/.test(x)) || "";
  const code = /REMOTE HOST IDENTIFICATION HAS CHANGED|host key for .* has changed/i.test(t) ? "hostkey_changed"
    : /Host key verification failed/i.test(t) ? "hostkey_unknown"
    : /Permission denied/i.test(t) ? "denied"
    : /timed out|timeout/i.test(t) ? "timeout"
    : /Connection refused/i.test(t) ? "refused"
    : /No route to host|Network is unreachable/i.test(t) ? "noroute"
    : /Could not resolve hostname|Name or service not known/i.test(t) ? "dns"
    : /Connection closed|reset by peer|kex_exchange/i.test(t) ? "closed"
    : "other";
  return { code, line };
}

/**
 * Prove the channel before concluding anything. Dante must get its own nonce back from the target.
 * No nonce → the target was never reached, and "nothing found" means nothing. Returns {reached, line}.
 */
export function probe() {
  const nonce = "dnt-" + Math.random().toString(36).slice(2, 10);
  let r;
  if (PREFIX === null) {
    // this machine: a program (Node itself) must hand the nonce back - no shell, so this proof holds on Windows as well
    const q = spawnSync(process.execPath, ["-e", `console.log(${JSON.stringify(nonce)})`], { encoding: "utf8", timeout: 12000, windowsHide: true });
    r = { ran: typeof q.status === "number", ok: q.status === 0, out: (q.stdout || "").trimEnd(), err: (q.stderr || "").trimEnd(), errorMsg: q.error ? String(q.error.message) : "" };
  } else r = run("echo " + nonce, { timeout: 12000 });
  const reached = r.ran && r.ok && r.out.includes(nonce);
  if (reached) return { reached, line: "Kanal bestätigt (" + targetLabel() + ")" };
  const why = sshReason(r.err || r.errorMsg || r.out);
  return { reached, line: why.line || "keine Antwort", code: why.code };
}

/** First non-empty line of a command's output, for a compact Beleg. */
export function firstLine(s) {
  return String(s || "").split("\n").map((x) => x.trim()).find(Boolean) || "";
}
