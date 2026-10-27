import test from "node:test";
import assert from "node:assert/strict";
import { checkWindowsRechte, writableEntries, servicePath } from "./winrechte.mjs";

// No real Windows here: a fake exec returns realistic icacls / reg / PowerShell output.
const SECRET = "Sup3rS3cret!";
const ok = (out, cmd = "x") => ({ ran: true, ok: true, out, err: "", code: 0, cmd });
const miss = (cmd = "x") => ({ ran: true, ok: false, out: "", err: "ERROR: The system was unable to find the specified registry key or value.", code: 1, cmd });
const aclOut = (path, entries) => path + " " + entries[0] + "\n" + entries.slice(1).map((e) => "      " + e).join("\n") + "\n\nSuccessfully processed 1 files; Failed processing 0 files";
const SAFE_ACL = ["NT AUTHORITY\\SYSTEM:(I)(OI)(CI)(F)", "BUILTIN\\Administrators:(I)(OI)(CI)(F)", "BUILTIN\\Users:(I)(OI)(CI)(RX)"];
const WRITABLE = ["BUILTIN\\Users:(I)(OI)(CI)(M)", "NT AUTHORITY\\SYSTEM:(I)(OI)(CI)(F)"];

function fake({ services = "", acls = {}, path = "C:\\Windows\\system32;C:\\Tools", aie = [null, null], pw = null, fail = {} } = {}) {
  return (cmd, args) => {
    const c = cmd + " " + args.join(" ");
    if (cmd === "powershell") return fail.ps ? { ran: true, ok: false, out: "", err: "Access denied", code: 1, cmd: c } : ok(services, c);
    if (cmd === "icacls") { const e = acls[args[0]] || SAFE_ACL; return ok(aclOut(args[0], e), c); }
    if (cmd === "reg") {
      const key = args[1], v = args[3];
      if (v === "Path") return fail.path ? { ran: true, ok: false, out: "", err: "ERROR: Access is denied.", code: 1, cmd: c } : ok("\n" + key + "\n    Path    REG_EXPAND_SZ    " + path + "\n", c);
      if (v === "AlwaysInstallElevated") { const x = aie[key.startsWith("HKCU") ? 0 : 1]; return x == null ? miss(c) : ok("\n" + key + "\n    AlwaysInstallElevated    REG_DWORD    " + x + "\n", c); }
      if (v === "DefaultPassword") return pw == null ? miss(c) : ok("\n" + key + "\n    DefaultPassword    REG_SZ    " + pw + "\n", c);
    }
    return { ran: false, ok: false, out: "", err: "unknown", code: null, cmd: c };
  };
}
const base = (o, extra = {}) => checkWindowsRechte({ exec: fake(o), env: { ProgramData: "C:\\ProgramData" }, exists: () => true, roots: { roots: [] }, ...extra });
const svc = "Spooler|Auto|LocalSystem|C:\\Windows\\System32\\spoolsv.exe\nGoodSvc|Auto|LocalSystem|\"C:\\Program Files\\Good App\\good.exe\" -k run\n";

test("saubere Maschine -> safe, Klassen und Übersprungene im Beleg", () => {
  const r = base({ services: svc });
  assert.equal(r.verdict, "safe");
  const all = JSON.stringify(r.evidence);
  assert.match(all, /1 unter C:\\\\Windows übersprungen/);
  assert.match(all, /Dienste, PATH/);
});
test("Pfad ohne Anführungszeichen mit Leerzeichen -> warn", () => {
  const r = base({ services: "MySvc|Manual|.\\bob|C:\\Program Files\\My App\\svc.exe -k x\n" });
  assert.equal(r.verdict, "warn");
  assert.ok(r.evidence.some((e) => /ohne Anführungszeichen/.test(e.claim) && e.line.includes("My App")));
  assert.match(r.fix.steps[0].script, /sc config "MySvc"/);
});
test("beschreibbarer Dienst-Ordner für BUILTIN\\Users auf Auto-Dienst -> risk", () => {
  const r = base({ services: "Upd|Auto|LocalSystem|\"C:\\Vendor\\Upd\\upd.exe\"\n", acls: { "C:\\Vendor\\Upd": WRITABLE } });
  assert.equal(r.verdict, "risk");
  assert.ok(r.evidence.some((e) => e.cmd === "icacls C:\\Vendor\\Upd" && /BUILTIN\\Users:\(I\)\(OI\)\(CI\)\(M\)/.test(e.line)));
  assert.equal(r.fix.steps[0].script, 'icacls "C:\\Vendor\\Upd" /remove:g *S-1-5-32-545');
});
test("beschreibbarer Ordner, Dienst manuell und kein SYSTEM -> warn", () => {
  const r = base({ services: "Upd|Manual|NT AUTHORITY\\LocalService|\"C:\\Vendor\\Upd\\upd.exe\"\n", acls: { "C:\\Vendor\\Upd": WRITABLE } });
  assert.equal(r.verdict, "warn");
});
test("beschreibbarer PATH-Ordner -> warn", () => {
  const r = base({ services: svc, acls: { "C:\\Tools": ["Everyone:(OI)(CI)(F)", "BUILTIN\\Administrators:(F)"] } });
  assert.equal(r.verdict, "warn");
  assert.ok(r.evidence.some((e) => /PATH-Ordner C:\\Tools/.test(e.claim) && /Everyone:/.test(e.line)));
});
test("DENY-Eintrag zählt nicht", () => {
  assert.equal(writableEntries("C:\\x Everyone:(DENY)(W)\n  BUILTIN\\Users:(RX)", "C:\\x").length, 0);
  assert.equal(writableEntries("C:\\x BUILTIN\\Users:(I)(OI)(CI)(RX,WD)", "C:\\x").length, 1);
});
test("AlwaysInstallElevated in beiden Hives 0x1 -> risk", () => {
  const r = base({ services: svc, aie: ["0x1", "0x1"] });
  assert.equal(r.verdict, "risk");
});
test("AlwaysInstallElevated nur in einem Hive -> kein Befund", () => {
  const r = base({ services: svc, aie: ["0x1", null] });
  assert.equal(r.verdict, "safe");
  const r2 = base({ services: svc, aie: ["0x1", "0x0"] });
  assert.equal(r2.verdict, "safe");
});
test("DefaultPassword vorhanden -> warn, Wert taucht nirgends auf", () => {
  const r = base({ services: svc, pw: SECRET });
  assert.equal(r.verdict, "warn");
  assert.ok(r.evidence.some((e) => /DefaultPassword/.test(e.line) && /redacted/.test(e.line)));
  assert.ok(!JSON.stringify(r).includes(SECRET));
});
test("Befehl schlägt fehl -> unknown, Klasse benannt", () => {
  const r = base({ services: svc, fail: { ps: true } });
  assert.equal(r.verdict, "unknown");
  assert.match(r.wie, /Dienste/);
  const r2 = base({ services: svc, fail: { path: true } });
  assert.equal(r2.verdict, "unknown");
  assert.match(r2.wie, /PATH/);
});
test("Befund bleibt Befund, auch wenn eine andere Klasse nicht lesbar ist", () => {
  const r = base({ services: svc, aie: ["0x1", "0x1"], fail: { path: true } });
  assert.equal(r.verdict, "risk");
});
test("servicePath: quoted, unquoted, mit Argumenten", () => {
  assert.deepEqual(servicePath('"C:\\a b\\x.exe" -k y'), { exe: "C:\\a b\\x.exe", quoted: true });
  assert.deepEqual(servicePath("C:\\a b\\x.exe -k y"), { exe: "C:\\a b\\x.exe", quoted: false });
});
