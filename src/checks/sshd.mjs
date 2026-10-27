// SSH exposure from an sshd_setting rule: the verdict is a warning only if every listed setting is bad
// (by default root login and password login together). Reads the effective config via `sshd -T` so an
// Include cannot hide a value, and falls back to the config file.
import { execProgram, readText, tcpOpen } from "../core/fsx.mjs";
import { isLocalTarget } from "../core/sh.mjs";
import { isWindows } from "../core/perm.mjs";
import { join } from "node:path";
import { result, evidence, SAFE, WARN, UNKNOWN } from "../core/check.mjs";
import { BUILTIN } from "../pack/builtin.mjs";
import { loc } from "./loc.mjs";

// What sshd does when a key is not set, how it is written, and the value a fix sets.
const KEYS = {
  permitrootlogin: { name: "PermitRootLogin", dflt: "prohibit-password", safe: "prohibit-password" },
  passwordauthentication: { name: "PasswordAuthentication", dflt: "yes", safe: "no" },
  permitemptypasswords: { name: "PermitEmptyPasswords", dflt: "no", safe: "no" },
  x11forwarding: { name: "X11Forwarding", dflt: "no", safe: "no" },
};

const val = (out, key) => {
  const m = String(out || "").split("\n").map((l) => l.trim().toLowerCase()).find((l) => l.startsWith(key + " "));
  return m ? m.slice(key.length + 1).trim() : null;
};

export function sshdCheck(rule) {
  return {
    id: rule.id, know: rule.know || rule.id, title: rule.title, aliases: rule.aliases || [], cve: rule.cve || [],

    run() {
      const m = loc(rule), id = rule.id, title = m.title, ev = [];
      let out = null, src = null;
      const eff = execProgram("sshd", ["-T"]);
      if (eff.ran && eff.ok && /permitrootlogin|passwordauthentication/i.test(eff.out)) { out = eff.out; src = "sshd -T (effektiv)"; }
      else {
        const conf = isLocalTarget() && isWindows() ? join(process.env.ProgramData || "C:\\ProgramData", "ssh", "sshd_config") : "/etc/ssh/sshd_config";
        const f = readText(conf);
        if (f.ran && f.text.trim()) { out = f.text; src = conf; }
      }
      if (out == null) {
        return result({ id, title, verdict: UNKNOWN,
          was: "Konnte die SSH-Einstellungen nicht lesen.", wie: "Weder `sshd -T` noch die Config waren lesbar (Rechte? kein SSH?).",
          wo: "Dieser Server.", evidence: ev });
      }
      let bad = 0;
      const badKeys = [];
      for (const s of rule.settings) {
        const k = KEYS[s.key], got = val(out, s.key);
        ev.push(evidence(k.name + " = " + (got ?? "(nicht gesetzt)"), { cmd: src, line: k.name + " " + (got ?? "default") }));
        if (s.bad.includes(got ?? k.dflt)) { bad++; badKeys.push(s); }
      }
      // All listed settings bad = the full warning. One of them bad is still not "safe": it is named as it is, never rounded up to SAFE.
      // On this machine the settings only matter if an SSH service answers. Nothing on port 22: then it is not a finding but a
      // question mark (it could listen on another port), said as such - a laptop with Remote Login off is not "a step needed".
      if (bad > 0 && isLocalTarget()) {
        const up = tcpOpen(22);
        if (up.ran && !up.open) {
          ev.push(evidence("Auf Port 22 antwortet nichts", { cmd: up.cmd, line: up.why }));
          return result({ id, title, verdict: UNKNOWN,
            was: "Hier läuft kein SSH-Dienst auf Port 22; ob die Einstellungen zählen, weiß ich nicht.",
            wie: "Die Einstellungen stehen unten. Hört SSH auf einem anderen Port, gelten sie trotzdem — das kann ich so nicht sehen.",
            wo: "Dieser Rechner.", evidence: ev });
        }
      }
      if (bad > 0) {
        const all = bad === rule.settings.length;
        const steps = badKeys.map((s) => ({ desc: KEYS[s.key].name + " auf " + KEYS[s.key].safe, script: "sed -i 's/^#\\?" + KEYS[s.key].name + ".*/" + KEYS[s.key].name + " " + KEYS[s.key].safe + "/' /etc/ssh/sshd_config" }));
        steps.push({ desc: "SSH neu laden", script: "systemctl reload ssh || systemctl reload sshd" });
        return result({ id, title, verdict: WARN,
          was: all ? (m.bad || "SSH-Einstellungen sind ungünstig.") : (m.part || m.bad || "Eine SSH-Einstellung ist ungünstig."),
          wie: all ? (m.bad_how || "Alle genannten Einstellungen stehen zusammen auf einem schlechten Wert.") : (m.part_how || m.bad_how || "Eine der genannten Einstellungen steht auf einem schlechten Wert (die Werte stehen unten)."),
          wo: "Dieser Server.", evidence: ev,
          fix: { why: "Die Einstellungen auf sichere Werte setzen (erst sicherstellen, dass dein Schlüssel funktioniert).", steps } });
      }
      return result({ id, title, verdict: SAFE,
        was: m.ok || "SSH steht nicht auf der schlechten Kombination.", wie: m.ok_how || "Die Werte stehen unten mit ihrer echten Zeile.",
        wo: "Dieser Server.", evidence: ev });
    },
  };
}

export const sshd = sshdCheck(BUILTIN.rules.find((r) => r.id === "sshd"));
