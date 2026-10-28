// Looks for webshell markers in a web root (input passed to a call, eval of decoded data, system()
// with request data), from a file_pattern rule. Reports the path and the marker, not the file content.
// A match is a warning, since the patterns are heuristics.
import { shq } from "../core/clean.mjs";
import { grepFiles } from "../core/fsx.mjs";
import { result, evidence, SAFE, WARN, UNKNOWN } from "../core/check.mjs";
import { webRoots, lines, sq } from "./common.mjs";
import { BUILTIN } from "../pack/builtin.mjs";
import { loc, patName } from "./loc.mjs";

export function patternCheck(rule) {
  return {
    id: rule.id, know: rule.know || rule.id, title: rule.title, aliases: rule.aliases || [], cve: rule.cve || [],

    run() {
      const m = loc(rule), id = rule.id, title = m.title, ev = [];
      const wr = webRoots();
      if (!wr.ran) {
        return result({ id, title, verdict: UNKNOWN,
          was: "Konnte das Ziel nicht abfragen.", wie: wr.line || "Der Suchbefehl lief nicht.", wo: "Ziel nicht erreichbar.", evidence: [] });
      }
      if (!wr.roots.length) {
        ev.push(evidence("Kein Standard-Webroot gefunden", { cmd: "for d in /var/www … ; do [ -d $d ] && echo $d; done", line: "(keiner der üblichen Pfade existiert)" }));
        return result({ id, title, verdict: UNKNOWN,
          was: "Kein übliches Web-Verzeichnis gefunden.", wie: "Von Hand nachsehen, wo die Dateien liegen.", wo: "Dieser Server.", evidence: ev });
      }
      const roots = wr.roots.join(" ");
      let anyRan = false, hits = 0;
      for (const p of rule.patterns) {
        const re = p.re;
        const g = grepFiles(wr.roots, re, { glob: rule.glob, limit: 5 });
        if (!g.ran) continue;
        anyRan = true;
        for (const found of g.files) { ev.push(evidence("Muster „" + patName(p) + "“", { cmd: g.cmd, line: found })); hits++; }
      }
      if (!anyRan) {
        return result({ id, title, verdict: UNKNOWN,
          was: "Konnte den Webroot nicht durchsuchen.", wie: "grep lief nicht.", wo: "Dieser Server.", evidence: ev });
      }
      if (hits) {
        return result({ id, title, verdict: WARN,
          was: m.bad || "Dateien tragen verdächtige Muster.",
          wie: m.bad_how || "Die Pfade unten passen auf bekannte Muster — von Hand ansehen, nicht blind löschen.",
          wo: "Dieser Server.", evidence: ev,
          fix: { why: "Jede genannte Datei von Hand prüfen; wenn sie nicht von dir ist, offline nehmen und die Quelle suchen.",
            steps: [{ desc: "Datei ansehen (nicht ausführen)", script: "less -- " + (lines(ev.map((e) => e.line).join("\n"))[0] ? shq(lines(ev.map((e) => e.line).join("\n"))[0]) : "<datei>") }] } });
      }
      ev.push(evidence("Webroot durchsucht, keine Webshell-Muster", { cmd: "grep -rlE '<muster>' --include=" + rule.glob + " " + roots, line: "(keine Treffer in: " + wr.roots.join(", ") + ")" }));
      return result({ id, title, verdict: SAFE,
        was: m.ok || "Keine Dateien mit den bekannten Mustern gefunden.",
        wie: m.ok_how || "Die vorhandenen Web-Verzeichnisse wurden auf die bekannten Muster durchsucht.", wo: "Dieser Server.", evidence: ev });
    },
  };
}

export const webshell = patternCheck(BUILTIN.rules.find((r) => r.id === "webshell"));
