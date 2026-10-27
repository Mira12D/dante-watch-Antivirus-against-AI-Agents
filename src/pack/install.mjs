// Getting packs onto this machine: store the license token, fetch packs, install them into
// ~/.dante/packs/. The fetch is a curl run locally, only after the user typed `aktualisier` and agreed to
// the exact command. Installed packs are never overwritten or deleted.
import { readFileSync, writeFileSync, mkdirSync, renameSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execProgram, execProgramAsync } from "../core/fsx.mjs";
import { home, packsDir, packFile, verifyPack, loadPacks } from "./pack.mjs";
import { rulesWith } from "../checks/battery.mjs";
import { mkdirOwned, writeOwned } from "../core/perm.mjs";

export const BUY_URL = "https://api.nm-streetwear.space/dante/";
export const PACKS_URL = "https://api.nm-streetwear.space/dante/packs";
const MAX_DOWNLOAD = 4 * 1024 * 1024; // a bundle of all the packs a person owns
export const TOKEN_RE = /^dnt_[A-Za-z0-9_-]{32}$/;
// a token pasted anywhere in a line ("hier mein token: dnt_...", or the token alone)
export const TOKEN_IN_LINE = /\bdnt_[A-Za-z0-9_-]{32}(?![A-Za-z0-9_-])/;
export const licenseFile = () => join(home(), "license");
const sq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

export function readLicense() {
  try { const t = readFileSync(licenseFile(), "utf8").trim(); return TOKEN_RE.test(t) ? t : null; } catch { return null; }
}
// Only the owner can read the token (0600 in a 0700 folder). A malformed token is refused.
export function saveLicense(token) {
  if (!TOKEN_RE.test(String(token))) return false;
  mkdirOwned(home());
  writeOwned(licenseFile(), token + "\n");
  return true;
}

// What a set of new packs changes for the human: rules they add and rules they replace with
// different content, measured against the state before.
export function diffRules(before, after) {
  const was = new Map(before.map((r) => [r.id, JSON.stringify(r)]));
  return {
    added: after.filter((r) => !was.has(r.id)),
    changed: after.filter((r) => was.has(r.id) && was.get(r.id) !== JSON.stringify(r)),
  };
}

// Installs one pack. raw = the pack file's text. Refuses (and writes nothing) if it is not valid or
// is already here. opts.publicKey is for tests only.
export function installPack(raw, opts = {}) {
  const r = verifyPack(raw, opts);
  if (!r.ok) return r;
  const file = packFile(r.pack.serial);
  if (existsSync(file)) return { ok: false, same: true, code: "have", serial: r.pack.serial };
  mkdirOwned(packsDir());
  const tmp = file + ".tmp";
  writeFileSync(tmp, raw, { mode: 0o644 }); // the signed original, not the parsed body (that has no signature)
  renameSync(tmp, file);
  return { ok: true, pack: r.pack };
}

// Installs a set of packs (oldest first). Returns what is new, what was refused, and the change in
// rules against the state before the first one.
export function installMany(raws, opts = {}) {
  const before = rulesWith(loadPacks(opts).packs);
  const installed = [], skipped = [], refused = [];
  const parsed = raws.map((raw) => { try { return { raw, serial: JSON.parse(raw).serial }; } catch { return { raw, serial: Infinity }; } }).sort((a, b) => a.serial - b.serial);
  for (const { raw } of parsed) {
    const r = installPack(raw, opts);
    if (r.ok) installed.push(r.pack); else if (r.same) skipped.push(r.serial); else refused.push(r);
  }
  const after = rulesWith(loadPacks(opts).packs);
  return { installed, skipped, refused, diff: diffRules(before, after) };
}

// What the human is shown before saying yes. The token is read from the file inside the shell, so it
// never appears in this text, the process list or the shell history.
export const curlShown = (url = PACKS_URL) => `curl -sS --max-time 30 -o <tmp> -H "Authorization: Bearer <dein Token aus ~/.dante/license>" ${url}`;

// The one fetch: one call returns every pack this person owns as {"packs":[...]}. Returns
// { ok, code, raws } - code is the HTTP status (0 = no answer), raws the pack texts on 200.
// What to run: curl.exe/curl itself, no shell (so the same on Windows, macOS and Linux). The header goes to curl on stdin
// with -K -, so the token is neither in curl's arguments nor in a process list nor in a shell history.
function curlPlan(url) {
  const token = readLicense();
  if (!token) return null;
  const dir = mkdtempSync(join(tmpdir(), "dante-")), out = join(dir, "packs.json");
  return { dir, out, args: ["-sS", "-K", "-", "--max-time", "30", "--max-filesize", String(MAX_DOWNLOAD), "-o", out, "-w", "%{http_code}", url], input: `header = "Authorization: Bearer ${token}"\n` };
}
// What came back (r = the finished program, out = the file curl wrote):
function curlResult(r, out) {
  if (!r.ran && /ENOENT/.test(r.err || "")) return { ok: false, code: 0, curlMissing: true };
  const code = Number((r.out || "").trim().slice(-3)) || 0;
  if (code !== 200) return { ok: false, code, err: r.err };
  let list;
  try { list = JSON.parse(readFileSync(out, "utf8")).packs; } catch { return { ok: false, code: 200, badBody: true }; }
  if (!Array.isArray(list)) return { ok: false, code: 200, badBody: true };
  return { ok: true, code, raws: list.map((p) => JSON.stringify(p)) };
}
export function fetchPacks({ url = PACKS_URL } = {}) {
  const plan = curlPlan(url);
  if (!plan) return { ok: false, code: -1, noLicense: true };
  try { return curlResult(execProgram("curl", plan.args, { timeout: 40000, input: plan.input }), plan.out); }
  catch (e) { return { ok: false, code: 0, err: String(e.message || e) }; }
  finally { rmSync(plan.dir, { recursive: true, force: true }); }
}
// The same without blocking, so the waiting screen can keep running while curl waits for the server.
export async function fetchPacksAsync({ url = PACKS_URL } = {}) {
  const plan = curlPlan(url);
  if (!plan) return { ok: false, code: -1, noLicense: true };
  try { return curlResult(await execProgramAsync("curl", plan.args, { timeout: 40000, input: plan.input }), plan.out); }
  catch (e) { return { ok: false, code: 0, err: String(e.message || e) }; }
  finally { rmSync(plan.dir, { recursive: true, force: true }); }
}
