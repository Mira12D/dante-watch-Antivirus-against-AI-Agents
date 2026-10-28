// Who still has a key to this machine. Reads the authorized_keys of every readable account and lists each key
// (account, type, comment, fingerprint) so a human can spot a stranger's key - the foothold a departed admin or a
// thief leaves behind. Dante cannot tell friend from foe, so it never guesses: it LISTS, and only warns on a real
// misconfiguration (an authorized_keys anyone can write to = a backdoor, or a key on a no-login account). Never
// prints the key material, only its SHA256 fingerprint, computed locally.
import { createHash } from "node:crypto";
import os from "node:os";
import { readText, statMode, listHomes } from "../core/fsx.mjs";
import { shqAll } from "../core/clean.mjs";
import { result, evidence, SAFE, WARN, UNKNOWN } from "../core/check.mjs";

const KEY_TYPES = /^(ssh-ed25519|ssh-rsa|ssh-dss|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)$/;

// One authorized_keys file -> one entry per real key. A line may start with options (no spaces, or quoted); the key
// type is the first field that looks like a type, the blob follows, the rest is the comment.
export function parseAuthKeys(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const ti = parts.findIndex((p) => KEY_TYPES.test(p));
    if (ti < 0 || !parts[ti + 1]) continue;
    const type = parts[ti], blob = parts[ti + 1], comment = parts.slice(ti + 2).join(" ");
    const options = ti > 0 ? parts.slice(0, ti).join(" ") : "";
    out.push({ type, comment, options, fp: fingerprint(blob) });
  }
  return out;
}

// The standard OpenSSH fingerprint: SHA256 over the raw (base64-decoded) key, printed base64 without padding.
function fingerprint(blob) {
  try {
    const d = createHash("sha256").update(Buffer.from(blob, "base64")).digest("base64").replace(/=+$/, "");
    return "SHA256:" + d;
  } catch { return "SHA256:?"; }
}

const NOLOGIN = /\/(nologin|false)$/;

// Pure verdict over gathered entries: [{ user, shell, path, mode, keys:[...] }]. No I/O here, so it is fully testable.
export function assess(entries, { ran }) {
  if (!ran) return { verdict: UNKNOWN, reason: "unreadable" };
  const ev = [], problems = [];
  let total = 0;
  for (const e of entries) {
    const writable = e.mode != null && (parseInt(e.mode, 8) & 0o022) !== 0;   // group- or world-writable = anyone can add a key
    const nologin = NOLOGIN.test(e.shell || "");
    if (writable) problems.push({ claim: "authorized_keys ist von anderen beschreibbar", line: e.path + " (" + e.mode + ")" , path: e.path });
    for (const k of e.keys) {
      total++;
      ev.push(evidence("Schlüssel", { cmd: "dante:read " + e.path, line: e.user + (nologin ? " [Konto ohne Login]" : "") + " · " + k.type + " " + (k.comment || "(ohne Kommentar)") + " · " + k.fp }));
    }
    if (nologin && e.keys.length) problems.push({ claim: "SSH-Schlüssel bei einem Konto, das sich nicht anmelden darf", line: e.user + " (" + (e.shell || "?") + ")", path: e.path });
  }
  for (const p of problems) ev.push(evidence(p.claim, { cmd: "dante:read " + p.path, line: p.line }));
  if (!total && !problems.length) return { verdict: SAFE, total, ev, empty: true };
  return { verdict: problems.length ? WARN : SAFE, total, ev, problems };
}

export const schluessel = {
  id: "schluessel", know: "schluessel",
  title: "SSH-Schlüssel, die Zugang geben (wer hat noch einen Schlüssel)",

  run() {
    const homes = listHomes();   // [{ user, home, shell }] for accounts whose home we can look at, plus the current user
    const entries = [];
    let ran = homes.length > 0;   // we looked into the homes we could enumerate; truly nothing readable -> unknown
    for (const h of homes) {
      for (const name of ["authorized_keys", "authorized_keys2"]) {
        const path = h.home.replace(/\/$/, "") + "/.ssh/" + name;
        const r = readText(path, { max: 256 * 1024 });
        if (!r.ran) continue;
        const keys = parseAuthKeys(r.text);
        if (keys.length) entries.push({ user: h.user, shell: h.shell, path, mode: statMode(path), keys });
      }
    }
    const a = assess(entries, { ran });
    const wo = "Dieser Rechner.";
    if (a.verdict === UNKNOWN) return result({ id: this.id, title: this.title, verdict: UNKNOWN,
      was: "Konnte keine authorized_keys lesen.", wie: "Kein lesbares Konto mit SSH-Schlüsseln gefunden (Rechte? kein SSH?).", wo, evidence: [] });
    if (a.empty) { const ev = [evidence("Durchsucht, keine SSH-Schlüssel", { cmd: "dante:read ~/.ssh/authorized_keys", line: "(keine authorized_keys mit Schlüsseln gefunden)" })];
      return result({ id: this.id, title: this.title, verdict: SAFE, was: "Kein SSH-Schlüssel gibt hier Zugang.", wie: "Die lesbaren Konten haben keine authorized_keys mit Einträgen.", wo, evidence: ev }); }
    if (a.verdict === WARN) {
      const files = [...new Set(a.problems.map((p) => p.path))];
      return result({ id: this.id, title: this.title, verdict: WARN,
        was: a.total + " Schlüssel geben SSH-Zugang — und etwas stimmt nicht.",
        wie: "Die Zeilen unten zeigen jeden Schlüssel (Typ, Kommentar, Fingerabdruck) und das Problem. Prüf, dass jeder Schlüssel dir gehört; unbekannte raus.",
        wo, evidence: a.ev,
        fix: { why: "Die beschreibbaren authorized_keys nur für den Besitzer lesbar machen (erst sicherstellen, dass dein eigener Schlüssel drin ist).",
          steps: [{ desc: "Rechte auf 600 setzen", script: "chmod 600 -- " + shqAll(files) }] } });
    }
    return result({ id: this.id, title: this.title, verdict: SAFE,
      was: a.total + " Schlüssel geben SSH-Zugang — prüf, dass jeder dir gehört.",
      wie: "Die Zeilen unten zeigen jeden Schlüssel: Konto, Typ, Kommentar, Fingerabdruck. Den Schlüssel selbst zeigt Dante nie. Erkennst du einen nicht, gehört er da nicht hin.",
      wo, evidence: a.ev });
  },
};
