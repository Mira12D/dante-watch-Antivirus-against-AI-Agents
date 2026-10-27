// Who may read what Dante writes (token, user.md, diary, scripts). One bridge, so no caller has to know the system:
// on macOS and Linux the file mode does it (0600 / 0700); on Windows there is no such mode, the folder or file is locked
// to its owner with icacls instead. If that cannot be done or read, the answer is "unknown" (null), never a promise.
import { writeFileSync, mkdirSync, chmodSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { userInfo } from "node:os";

export const isWindows = () => process.platform === "win32";

// icacls with an argv array: no shell, the path can hold any character
const icacls = (args) => spawnSync("icacls", args, { encoding: "utf8", timeout: 15000, windowsHide: true });

// Windows: drop the inherited rights and leave the owner only (a folder passes its right on to what is inside).
export function lockToOwner(path, { dir = false } = {}) {
  if (!isWindows()) return { ok: true };
  const who = userInfo().username;
  const r = icacls([path, "/inheritance:r", "/grant:r", `${who}:${dir ? "(OI)(CI)F" : "F"}`]);
  return { ok: r.status === 0 };
}

// true: only the owner (and the system's own accounts) may get in; false: someone else may; null: could not tell
export function isOwnerOnly(path) {
  try {
    if (!isWindows()) return (statSync(path).mode & 0o077) === 0;
    const r = icacls([path]);
    if (r.status !== 0 || !r.stdout) return null;
    const me = userInfo().username.toLowerCase();
    const others = r.stdout.split(/\r?\n/).map((l) => l.replace(path, "").trim()).filter((l) => /:\(/.test(l))
      .map((l) => l.split(":")[0].trim().toLowerCase())
      .filter((n) => n && !n.endsWith("\\" + me) && n !== me && !/(^|\\)(system|administrators|administratoren|nt authority\\system|nt-autorität\\system)$/.test(n));
    return others.length === 0;
  } catch { return null; }
}

// a folder only for the owner
export function mkdirOwned(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  lockToOwner(dir, { dir: true });
}
// a file only for the owner (opts.flag passes through, e.g. "wx" for a lock file; opts.exec makes a script runnable)
export function writeOwned(file, data, { flag, exec = false } = {}) {
  writeFileSync(file, data, { mode: exec ? 0o700 : 0o600, ...(flag ? { flag } : {}) });
  if (exec && !isWindows()) chmodSync(file, 0o700);
  lockToOwner(file);
}
