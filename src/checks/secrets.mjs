// Readable secrets inside a web root (.env, *.sql, backups, .git/config), from a path_exposed rule.
// Without a standard web root the verdict is unknown, because the site could be anywhere.
import { shqAll } from "../core/clean.mjs";
import { findFiles } from "../core/fsx.mjs";
import { result, evidence, SAFE, WARN, RISK, UNKNOWN } from "../core/check.mjs";
import { webRoots, lines } from "./common.mjs";
import { BUILTIN } from "../pack/builtin.mjs";
import { loc } from "./loc.mjs";

// A backup of a page or feed (index.html.bak) only repeats what the site shows anyway; a backup of code or data, a dump or a key
// can hold real secrets. The first kind is a note, the second a risk.
const PUBLIC_COPY = /\.(html?|xml|txt|css|js|json|md|svg|csv|rss|map)\.bak$/i;
export const splitExposed = (paths) => ({ soft: paths.filter((p) => PUBLIC_COPY.test(p)), hard: paths.filter((p) => !PUBLIC_COPY.test(p)) });

export function exposedCheck(rule) {
  // a name with a slash is a path tail (.git/config), anything else a file name pattern
  return {
    id: rule.id, know: rule.know || rule.id, title: rule.title, aliases: rule.aliases || [], cve: rule.cve || [],

    run() {
      const m = loc(rule), id = rule.id, title = m.title, ev = [];
      const wr = webRoots();
      if (!wr.ran) {
        return result({ id, title, verdict: UNKNOWN,
          was: "Konnte das Ziel nicht abfragen.", wie: wr.line || "Der Suchbefehl lief nicht.",
          wo: "Ziel nicht erreichbar.", evidence: [] });
      }
      if (!wr.roots.length) {
        ev.push(evidence("Kein Standard-Webroot gefunden", { cmd: "for d in /var/www … ; do [ -d $d ] && echo $d; done", line: "(keiner der üblichen Pfade existiert)" }));
        return result({ id, title, verdict: UNKNOWN,
          was: "Kein übliches Web-Verzeichnis gefunden.", wie: "An den Standard-Orten liegt keins — von Hand nachsehen, wo die Seite liegt.",
          wo: "Dieser Server.", evidence: ev });
      }
      const roots = wr.roots.join(" ");
      const find = findFiles(wr.roots, { names: rule.names, depth: 4, worldReadable: true, limit: 10 });
      if (find.ran && find.files.length) {
        const { soft, hard } = splitExposed(find.files);
        for (const p of hard.slice(0, 10)) ev.push(evidence("Lesbares Geheimnis im Webroot", { cmd: find.cmd, line: p }));
        for (const p of soft.slice(0, 10)) ev.push(evidence("Lesbare Sicherungskopie einer öffentlichen Datei", { cmd: find.cmd, line: p }));
        if (!hard.length) return result({ id, title, verdict: WARN,
          was: "Sicherungskopien öffentlicher Dateien sind für alle lesbar.",
          wie: "Sie enthalten meist nur, was die Seite ohnehin zeigt, können aber alte Reste enthalten. Ansehen und löschen, wenn du sie nicht brauchst.", wo: "Dieser Server.", evidence: ev,
          fix: { why: "Die Kopien aus dem Webroot nehmen oder die Leserechte für andere entziehen.", steps: [{ desc: "Leserecht für andere entziehen", script: "chmod o-rwx -- " + (soft.length ? shqAll(soft.slice(0, 10)) : "<datei>") }] } });
        return result({ id, title, verdict: RISK,
          was: m.bad || "Dateien mit Geheimnissen sind im Web-Verzeichnis für alle lesbar.",
          wie: m.bad_how || "Die Pfade unten kann ein Besucher über die Seite abrufen.", wo: "Dieser Server.", evidence: ev,
          fix: { why: "Die Dateien aus dem Webroot nehmen oder die Leserechte für andere entziehen.",
            steps: [{ desc: "Leserecht für andere entziehen", script: "chmod o-rwx -- " + (find.files.length ? shqAll(find.files.slice(0, 10)) : "<datei>") }] } });
      }
      if (!find.ran) {
        return result({ id, title, verdict: UNKNOWN,
          was: "Konnte den Webroot nicht durchsuchen.", wie: find.errorMsg || "find lief nicht.",
          wo: "Dieser Server.", evidence: ev });
      }
      ev.push(evidence("Webroot durchsucht, nichts Lesbares gefunden", { cmd: find.cmd, line: "(keine Treffer in: " + wr.roots.join(", ") + ")" }));
      return result({ id, title, verdict: SAFE,
        was: m.ok || "Keine offen lesbaren Geheimnisse im Webroot.",
        wie: m.ok_how || "Die vorhandenen Web-Verzeichnisse wurden durchsucht, keine für andere lesbaren Geheimnisse.",
        wo: "Dieser Server.", evidence: ev });
    },
  };
}

export const secrets = exposedCheck(BUILTIN.rules.find((r) => r.id === "secrets"));
