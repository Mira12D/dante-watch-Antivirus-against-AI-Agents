// "The host key of this server has changed. Is someone in between?" Dante cannot answer that with a yes or a no, but he can
// collect what speaks for or against, without logging in: the public host keys the server shows NOW, the ones remembered in
// known_hosts, and the same keys seen from another place (one of the person's other servers). An attacker on the person's own
// network path shows this machine a different key than a server elsewhere sees; a rebuilt server shows the same new key to everyone.
// What stays open is said: only a comparison with the provider's console proves the new key is the server's own.
//
// The collecting is done by injected runners (so it can be tested): local(cmd) runs on this machine, there(server, cmd) on another server.
import { createHash } from "node:crypto";
const FP = /^\s*(\d+)\s+(SHA256:[A-Za-z0-9+/=]+)\s+\S+\s+\((\w+)\)/;            // ssh-keygen -lf: "256 SHA256:… host (ED25519)"
const FP_F = /^\s*\S+\s+([A-Z0-9-]+)\s+(SHA256:[A-Za-z0-9+/=]+)\s*$/;           // ssh-keygen -F host -l: "host ED25519 SHA256:…"
/** `ssh-keygen -l` output -> [{ type, fp, bits }] (comment lines and noise ignored) */
export function parseFingerprints(text) {
  const out = [];
  for (const l of String(text || "").split("\n")) {
    const m = FP.exec(l); if (m) { out.push({ bits: Number(m[1]), fp: m[2], type: m[3].toUpperCase() }); continue; }
    const f = FP_F.exec(l); if (f && !l.startsWith("#")) out.push({ bits: 0, fp: f[2], type: f[1].toUpperCase() });
  }
  return out;
}
const sig = (keys) => keys.map((k) => k.type + ":" + k.fp).sort().join("|");
export const sameKeys = (a, b) => a.length > 0 && b.length > 0 && sig(a) === sig(b);
export const validHostName = (h) => typeof h === "string" && /^[A-Za-z0-9][A-Za-z0-9.:-]{0,200}$/.test(h);

/** the ssh-keyscan lines (host keytype base64) -> [{ type, fp, bits }]; the SHA256 fingerprint is computed here, no ssh-keygen/temp file needed */
export function keysFromScan(text) {
  const out = [];
  for (const l of String(text || "").split("\n")) {
    const m = /^\S+\s+(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+)\s+([A-Za-z0-9+/=]+)\s*$/.exec(l.trim());
    if (!m) continue;
    const blob = Buffer.from(m[2], "base64");
    if (!blob.length) continue;
    const type = m[1] === "ssh-ed25519" ? "ED25519" : m[1] === "ssh-rsa" ? "RSA" : "ECDSA";
    out.push({ bits: 0, fp: "SHA256:" + createHash("sha256").update(blob).digest("base64").replace(/=+$/, ""), type });
  }
  return out;
}
/** Local, shell-free: ssh-keygen -F host -l  -> parsed fingerprints (host is ONE argument) */
export function storedKeys(exec, host) {
  if (typeof host !== "string" || !host || host.startsWith("-")) return [];
  const r = exec("ssh-keygen", ["-F", host, "-l"]) || {};
  return parseFingerprints(r.out);
}
/** Local, shell-free: ssh-keyscan -> { banner, keys }; stdout AND stderr are read in Node */
export function scanHost(exec, host) {
  if (typeof host !== "string" || !host || host.startsWith("-")) return { banner: "", keys: [] };
  const r = exec("ssh-keyscan", ["-T", "8", "-t", "ed25519,rsa,ecdsa", host]) || {};
  const text = String(r.err || "") + "\n" + String(r.out || "");
  const banner = (text.split("\n").find((l) => /^#\s+\S+\s+SSH-/.test(l)) || "").replace(/^#\s+\S+\s+/, "").trim();
  return { banner, keys: keysFromScan(text) };
}
const scanCmd = (host) => `t=/tmp/.dante-ks.$$; ssh-keyscan -T 8 -t ed25519,rsa,ecdsa ${host} 2>$t.e >$t.k; cat $t.e $t.k | grep -m1 '^# '; ssh-keygen -lf $t.k 2>/dev/null; rm -f $t.e $t.k`;
function splitScan(out) {
  const banner = (String(out).split("\n").find((l) => /^#\s+\S+\s+SSH-/.test(l)) || "").replace(/^#\s+\S+\s+/, "").trim();
  return { banner, keys: parseFingerprints(out) };
}

/**
 * Collect the facts. io: { local(cmd) -> { out, err, ok }, there(server, cmd) -> { out, ok } }
 * io.exec(command, args) (optional; no shell, e.g. fsx.execProgram) is used for the local calls when given; else io.local(cmd).
 * opts: { host, others: [server...] } -> { host, old, now: {keys, banner}, seen: [{ server, keys, banner, reached }] }
 */
export async function collect(io, { host, others = [] }) {
  if (!validHostName(host)) return { host, invalid: true, old: [], now: { keys: [], banner: "" }, seen: [] };
  let old, now;
  if (io.exec) { old = storedKeys(io.exec, host); now = scanHost(io.exec, host); }
  else {
    const stored = await io.local(`ssh-keygen -F ${host} -l 2>/dev/null`);
    old = parseFingerprints(stored.out);
    now = splitScan((await io.local(scanCmd(host))).out || "");
  }
  const seen = [];
  for (const server of others) {
    const r = await io.there(server, scanCmd(host));
    const s = splitScan((r && r.out) || "");
    seen.push({ server, keys: s.keys, banner: s.banner, reached: !!(r && r.ok) });
  }
  return { host, old, now, seen };
}

/**
 * What the collected facts say. level: "attention" (the places disagree), "hint" (everything agrees, but that is no proof) or
 * "unknown" (nothing could be read). Never "safe".
 */
export function judge(c) {
  const facts = [];
  if (c.invalid || !c.now.keys.length) return { level: "unknown", facts: ["noKeys"], proof: null };
  const types = (a) => a.map((k) => k.type);
  if (c.old.length) {
    const changed = c.now.keys.filter((k) => { const o = c.old.find((x) => x.type === k.type); return o && o.fp !== k.fp; }).map((k) => k.type);
    const same = c.now.keys.filter((k) => { const o = c.old.find((x) => x.type === k.type); return o && o.fp === k.fp; }).map((k) => k.type);
    if (changed.length && !same.length) facts.push({ k: "allChanged", types: changed });
    else if (changed.length) facts.push({ k: "someChanged", changed, same });
    else facts.push({ k: "notChanged" });
  } else facts.push({ k: "noOld" });
  const reached = c.seen.filter((s) => s.reached && s.keys.length);
  if (reached.length) {
    const agree = reached.filter((s) => sameKeys(s.keys, c.now.keys)), differ = reached.filter((s) => !sameKeys(s.keys, c.now.keys));
    if (differ.length) facts.push({ k: "differ", servers: differ.map((s) => s.server) });
    if (agree.length) facts.push({ k: "agree", servers: agree.map((s) => s.server) });
  } else facts.push({ k: "oneView" });
  if (c.now.banner) facts.push({ k: "banner", banner: c.now.banner });
  const attention = facts.some((f) => f.k === "differ") || facts.some((f) => f.k === "someChanged");
  const ed = c.now.keys.find((k) => k.type === "ED25519") || c.now.keys[0];
  return { level: attention ? "attention" : "hint", facts, proof: ed ? { type: ed.type, fp: ed.fp } : null };
}

/** The report in words. M = the texts (mt()); returns plain lines. */
export function describe(j, c, M) {
  if (j.level === "unknown") return [M.mitmNoKeys(c.host)];
  const out = [];
  for (const f of j.facts) {
    if (f.k === "allChanged") out.push(M.mitmAllChanged(f.types.join(", ")));
    else if (f.k === "someChanged") out.push(M.mitmSomeChanged(f.changed.join(", "), f.same.join(", ")));
    else if (f.k === "notChanged") out.push(M.mitmNotChanged);
    else if (f.k === "noOld") out.push(M.mitmNoOld);
    else if (f.k === "agree") out.push(M.mitmAgree(f.servers.join(", ")));
    else if (f.k === "differ") out.push(M.mitmDiffer(f.servers.join(", ")));
    else if (f.k === "oneView") out.push(M.mitmOneView);
    else if (f.k === "banner") out.push(M.mitmBanner(f.banner));
  }
  out.push(j.level === "attention" ? M.mitmAttention : M.mitmHint);
  if (j.proof) out.push(M.mitmProof(j.proof.type, j.proof.fp));
  return out;
}

/** "ist jemand dazwischen", "man in the middle", "der Schlüssel hat sich geändert", "¿alguien en medio?" */
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
export const wantsMitm = (line) => W("dazwischen|man[- ]in[- ]the[- ]middle|mitm|mitgelesen|mitlesen|abgefangen|abfangen|angezapft|manipuliert|host ?key|host-?schl[uü]ssel|schl[uü]ssel (?:hat sich |ist )?ge[aä]ndert|ge[aä]nderte[rn]? schl[uü]ssel|identification has changed|someone (?:is )?(?:in between|intercepting|listening)|in the middle|intercept\\p{L}*|tamper\\p{L}*|key (?:has )?changed|changed key|alguien (?:en medio|interceptando|escuchando)|interceptad\\p{L}*|clave (?:ha )?cambiad\\p{L}*|cambio de clave").test(line);

// A changed host key is asked about once; then he remembers (the diary). Within WEEK days after a look or a "no" for the same host
// he only says in one line what he knows. -> { ask: true } or { ask: false, last: diary entry }
export const MITM_WEEK = 7;
export function mitmMemory(diary, host, now = new Date()) {
  const last = (diary || []).filter((e) => e.kind === "act" && (e.what === "hostkey" || e.what === "hostkey_no") && e.detail === host).slice(-1)[0];
  if (!last || now - new Date(last.t) > MITM_WEEK * 864e5) return { ask: true };
  return { ask: false, last };
}

/** after "the host key changed": "mach du es", "do it", "hazlo tú", "entferne den alten eintrag" - the person hands the step over */
export const wantsHostKeyFix = (line) => {
  const l = String(line || "").toLowerCase().trim();
  if (l.length > 60 || l.includes("?")) return false;
  return /(^|[^\p{L}])(mach (?:du |das |es |dus? )?(?:es|das|du)|mach du|machs|erledige (?:das|es)|do it|you do it|go ahead|fix it|hazlo(?: t[uú])?|h[aá]zlo t[uú]|entfern\p{L}* (?:den |die )?alte\p{L}* eintrag|l[oö]sch\p{L}* (?:den |die )?alte\p{L}* eintrag|ssh-keygen -r|remove the old (?:entry|key))(?![\p{L}])/iu.test(l);
};
