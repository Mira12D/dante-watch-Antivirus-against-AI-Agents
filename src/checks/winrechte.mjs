// Windows meaning of the check "rechte": there is no "others may write" bit, the equivalent is an ACL entry that
// gives Everyone / BUILTIN\Users / Authenticated Users a WRITE right on something sensitive. Read-only: icacls (no
// change flags), reg query, one PowerShell service listing. Never prints a secret value (Winlogon DefaultPassword
// is reported as "exists", the data column is redacted). Known gap: localized group names (e.g. "Jeder") are not
// matched by name; icacls prints well-known SIDs as *S-1-... only when it cannot resolve them, which IS matched.
import { execProgram } from "../core/fsx.mjs";
import { existsSync } from "node:fs";
import { result, evidence, SAFE, WARN, RISK, UNKNOWN } from "../core/check.mjs";
import { webRoots } from "./common.mjs";

const ID = "rechte", TITLE = "Für alle beschreibbare Dateien an heiklen Stellen";
const WHO = new Set(["everyone", "builtin\\users", "nt authority\\authenticated users", "*s-1-1-0", "*s-1-5-32-545", "*s-1-5-11", "s-1-1-0", "s-1-5-32-545", "s-1-5-11"]);
const WRITE = new Set(["F", "M", "W", "WD", "AD", "GA", "GW"]);
const SID_OF = { "everyone": "*S-1-1-0", "builtin\\users": "*S-1-5-32-545", "nt authority\\authenticated users": "*S-1-5-11" };
const PS = "Get-CimInstance Win32_Service | ForEach-Object { $_.Name + '|' + $_.StartMode + '|' + $_.StartName + '|' + $_.PathName }";
const REG_PATH = "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment";
const WINLOGON = "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon";
const AIE = ["HKCU\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer", "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer"];

const dirname = (p) => { const i = p.lastIndexOf("\\"); return i > 2 ? p.slice(0, i) : p.slice(0, i + 1); };
const isOs = (p) => /^(c:\\windows\\|\\systemroot\\|%systemroot%\\|system32\\)/i.test(p);

// Entries of icacls output that give a watched group a write-class right (DENY entries ignored).
export function writableEntries(out, path) {
  const hits = [];
  for (let line of String(out || "").split(/\r?\n/)) {
    if (path && line.toLowerCase().startsWith(path.toLowerCase())) line = line.slice(path.length);
    const m = /^\s*(.+?):((?:\([^)]*\))+)\s*$/.exec(line);
    if (!m) continue;
    const who = m[1].trim().toLowerCase();
    if (!WHO.has(who)) continue;
    const groups = [...m[2].matchAll(/\(([^)]*)\)/g)].map((x) => x[1].toUpperCase());
    if (groups.includes("DENY")) continue;
    const rights = groups.flatMap((g) => g.split(","));
    if (rights.some((r) => WRITE.has(r))) hits.push({ who, line: line.trim(), sid: SID_OF[who.replace(/^s-/, "*s-")] || SID_OF[who] || "*S-1-5-32-545" });
  }
  return hits;
}

// "C:\Program Files\My App\svc.exe -k x" (unquoted) or "\"C:\x\svc.exe\" -k" -> { exe, quoted }
export function servicePath(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  let m = /^"([^"]+)"/.exec(s);
  if (m) return { exe: m[1], quoted: true };
  m = /^(.*?\.exe)(?=\s|$)/i.exec(s);
  if (m) return { exe: m[1], quoted: false };
  return { exe: s.split(/\s+/)[0], quoted: false };
}

function regQuery(exec, key, name) {
  const r = exec("reg", ["query", key, "/v", name]);
  const blob = (r.out || "") + " " + (r.err || "");
  if (!r.ran) return { state: "unreadable", cmd: r.cmd, line: r.err || "reg lief nicht" };
  if (r.ok) {
    const l = (r.out || "").split(/\r?\n/).find((x) => new RegExp("^\\s*" + name + "\\s+REG_", "i").test(x));
    return l ? { state: "found", cmd: r.cmd, line: l.trim(), out: r.out } : { state: "unreadable", cmd: r.cmd, line: "keine Wertzeile in der Ausgabe" };
  }
  if (/denied|verweigert/i.test(blob)) return { state: "unreadable", cmd: r.cmd, line: (r.err || r.out).split(/\r?\n/)[0] };
  return { state: "absent", cmd: r.cmd, line: ((r.err || r.out || "").split(/\r?\n/)[0] || "") + " (Exit " + r.code + ")" };
}

export function checkWindowsRechte({ exec = execProgram, env = process.env, exists = existsSync, roots = null } = {}) {
  const ev = [], findings = [], unreadable = [], classesRead = [];
  const seenClaims = new Set();   // two ACL lines of one folder (inherited + container) say the same thing once
  const note = (sev, claim, cmd, line, step) => { if (seenClaims.has(claim)) return; seenClaims.add(claim); findings.push({ sev, claim }); ev.push(evidence(claim, { cmd, line })); if (step) steps.push(step); };
  const steps = [];
  const aclCache = new Map();
  const acl = (path) => {
    if (aclCache.has(path)) return aclCache.get(path);
    const r = exec("icacls", [path]);
    const v = (r.ran && r.ok) ? { ok: true, hits: writableEntries(r.out, path), cmd: r.cmd } : { ok: false, cmd: r.cmd, err: (r.err || r.out || "icacls lief nicht").split(/\r?\n/)[0] };
    aclCache.set(path, v); return v;
  };
  const icaclsFix = (path, h) => ({ desc: "Schreibrecht entziehen", script: 'icacls "' + path + '" /remove:g ' + h.sid });

  // (1)+(2) services
  const ps = exec("powershell", ["-NoProfile", "-NonInteractive", "-Command", PS]);
  if (!ps.ran || !ps.ok || !ps.out.trim()) unreadable.push("Dienste (" + ((ps.err || "keine Ausgabe").split(/\r?\n/)[0]) + ")");
  else {
    classesRead.push("Dienste");
    let skipped = 0, seen = 0, bad = 0;
    for (const ln of ps.out.split(/\r?\n/)) {
      const p = ln.split("|"); if (p.length < 4) continue;
      const [name, mode, start] = p, sp = servicePath(p.slice(3).join("|"));
      if (!sp || !sp.exe) continue;
      if (isOs(sp.exe)) { skipped++; continue; }
      seen++;
      const auto = /auto/i.test(mode), system = /^(localsystem|nt authority\\system)$/i.test(start.trim());
      if (!sp.quoted && /\s/.test(sp.exe)) note(WARN, "Dienst " + name + ": Pfad ohne Anführungszeichen mit Leerzeichen", "powershell Get-CimInstance Win32_Service", ln.trim(),
        { desc: "Pfad in Anführungszeichen setzen", script: 'sc config "' + name + '" binPath= "\\"' + sp.exe + '\\""' });
      if (!exists(sp.exe) && !exists(dirname(sp.exe))) continue;
      for (const [kind, path] of [["Datei", sp.exe], ["Ordner", dirname(sp.exe)]]) {
        const a = acl(path);
        if (!a.ok) { if (!unreadable.some((u) => u.startsWith("ACL "))) unreadable.push("ACL " + path + " (" + a.err + ")"); continue; }
        for (const h of a.hits) {
          const sev = (auto || (kind === "Datei" && system)) ? RISK : WARN;
          bad++; note(sev, "Dienst " + name + " (" + mode + ", " + start + "): " + kind + " für " + h.who + " beschreibbar", a.cmd, h.line, icaclsFix(path, h));
        }
      }
    }
    ev.push(evidence("Dienste gelesen", { cmd: "powershell Get-CimInstance Win32_Service", line: seen + " geprüft, " + skipped + " unter C:\\Windows übersprungen (OS-eigen), " + bad + " mit beschreibbarem Pfad" }));
  }

  // (3) machine PATH
  const pr = regQuery(exec, REG_PATH, "Path");
  if (pr.state !== "found") unreadable.push("PATH (" + pr.line + ")");
  else {
    classesRead.push("PATH");
    const raw = pr.line.replace(/^Path\s+REG_\w+\s+/i, "");
    const dirs = raw.split(";").map((d) => d.trim().replace(/%([^%]+)%/g, (_, k) => env[k] || env[k.toUpperCase()] || "%" + k + "%")).filter((d) => d && !d.includes("%"));
    for (const d of dirs) {
      if (!exists(d)) continue;
      const a = acl(d);
      if (!a.ok) { unreadable.push("ACL " + d + " (" + a.err + ")"); continue; }
      for (const h of a.hits) note(WARN, "PATH-Ordner " + d + " für " + h.who + " beschreibbar", a.cmd, h.line, icaclsFix(d, h));
    }
  }

  // (4) web roots + all-users Startup
  const wr = roots || webRoots();
  const sensitive = [...(wr.roots || [])];
  const pd = env.ProgramData || env.PROGRAMDATA || "C:\\ProgramData";
  const startup = pd + "\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp";
  if (exists(startup)) sensitive.push(startup);
  let webRead = true;
  for (const d of sensitive) {
    const a = acl(d);
    if (!a.ok) { unreadable.push("ACL " + d + " (" + a.err + ")"); webRead = false; continue; }
    for (const h of a.hits) note(WARN, (d === startup ? "Autostart-Ordner (alle Nutzer) " : "Web-Verzeichnis ") + d + " für " + h.who + " beschreibbar", a.cmd, h.line, icaclsFix(d, h));
  }
  if (webRead) classesRead.push("Web-Verzeichnisse/Autostart (" + (sensitive.length ? sensitive.length + " vorhanden" : "keines vorhanden") + ")");

  // (5) AlwaysInstallElevated
  const q = AIE.map((k) => regQuery(exec, k, "AlwaysInstallElevated"));
  if (q.some((x) => x.state === "unreadable")) unreadable.push("AlwaysInstallElevated (" + q.find((x) => x.state === "unreadable").line + ")");
  else {
    classesRead.push("AlwaysInstallElevated");
    const on = q.map((x) => x.state === "found" && /0x1\s*$/.test(x.line));
    if (on[0] && on[1]) note(RISK, "AlwaysInstallElevated ist in HKCU und HKLM an: jeder Nutzer installiert MSI als SYSTEM", q[1].cmd, q[0].line + " / " + q[1].line,
      { desc: "Beide Werte auf 0", script: "reg add \"" + AIE[0] + "\" /v AlwaysInstallElevated /t REG_DWORD /d 0 /f && reg add \"" + AIE[1] + "\" /v AlwaysInstallElevated /t REG_DWORD /d 0 /f" });
    else ev.push(evidence("AlwaysInstallElevated nicht in beiden Hives an", { cmd: q[1].cmd, line: q.map((x) => x.line || "(leer)").join(" / ") }));
  }

  // (6) Winlogon autologon password (existence only)
  const w = regQuery(exec, WINLOGON, "DefaultPassword");
  if (w.state === "unreadable") unreadable.push("Winlogon (" + w.line.replace(/DefaultPassword\s+REG_\w+\s+.*/i, "DefaultPassword (redacted)") + ")");
  else {
    classesRead.push("Winlogon");
    if (w.state === "found") note(WARN, "Winlogon speichert ein Autologon-Passwort im Klartext in der Registry (Wert nicht angezeigt)", w.cmd, w.line.replace(/^(DefaultPassword\s+REG_\w+)\s+.*$/i, "$1    <redacted>"),
      { desc: "Wert entfernen und Autologon abschalten", script: 'reg delete "' + WINLOGON + '" /v DefaultPassword /f' });
    else ev.push(evidence("Kein DefaultPassword in Winlogon", { cmd: w.cmd, line: w.line || "(leer)" }));
  }
  for (const u of unreadable) ev.push(evidence("Nicht lesbar", { cmd: "winrechte", line: u }));

  const fix = findings.length ? { why: "Schreibrechte für Jeder/Benutzer entziehen, unsichere Konfiguration schließen.", steps } : null;
  const risk = findings.some((f) => f.sev === RISK);
  if (findings.length) {
    return result({ id: ID, title: TITLE, verdict: risk ? RISK : WARN,
      was: "Windows: " + findings.length + " Befund(e) bei Rechten an heiklen Stellen." + (unreadable.length ? " Nicht lesbar: " + unreadable.length + "." : ""),
      wie: "ACLs (icacls), Dienste, PATH, Web-Verzeichnisse, Autostart und Registry wurden gelesen: " + findings.map((f) => f.claim).slice(0, 5).join("; "),
      wo: "Dieser Windows-Rechner.", evidence: ev, fix });
  }
  if (unreadable.length) {
    return result({ id: ID, title: TITLE, verdict: UNKNOWN, was: "Windows: nicht alles lesbar, keine Entwarnung.",
      wie: "Nicht lesbar: " + unreadable.join("; "), wo: "Dieser Windows-Rechner.", evidence: ev });
  }
  ev.unshift(evidence("Gelesene Klassen, nichts gefunden", { cmd: "winrechte", line: classesRead.join(", ") }));
  return result({ id: ID, title: TITLE, verdict: SAFE, was: "Keine für alle beschreibbaren Dienste, PATH-Ordner, Web-Verzeichnisse oder unsichere Windows-Einstellungen.",
    wie: "Alle Klassen wurden gelesen: " + classesRead.join(", ") + ".", wo: "Dieser Windows-Rechner.", evidence: ev });
}
