// World-writable files under /etc and the web roots. Anyone can turn such a file into a foothold
// (cron, config, PHP page). Lists paths only. If the search cannot run the verdict is unknown.
import { worldWritableFiles } from "../core/fsx.mjs";
import { result, evidence, SAFE, WARN, UNKNOWN } from "../core/check.mjs";
import { webRoots } from "./common.mjs";
import { isLocalTarget } from "../core/sh.mjs";
import { isWindows } from "../core/perm.mjs";
import { checkWindowsRechte } from "./winrechte.mjs";

export const rechte = {
  id: "rechte", know: "rechte",
  title: "Für alle beschreibbare Dateien an heiklen Stellen",

  run() {
    if (isLocalTarget() && isWindows()) return checkWindowsRechte();
    const ev = [];
    const wr = webRoots();
    const dirList = ["/etc", ...wr.roots], dirs = dirList.join(" ");
    const find = worldWritableFiles(dirList, { depth: 3, limit: 12 });
    if (!find.ran) {
      return result({ id: this.id, title: this.title, verdict: UNKNOWN,
        was: "Konnte die Rechte nicht prüfen.", wie: find.errorMsg || "find lief nicht.", wo: "Ziel nicht erreichbar.", evidence: ev });
    }
    if (find.files.length) {
      for (const p of find.files) ev.push(evidence("Für alle beschreibbar", { cmd: find.cmd, line: p }));
      return result({ id: this.id, title: this.title, verdict: WARN,
        was: "Dateien an heiklen Stellen sind für jeden beschreibbar.", wie: "Die Pfade unten kann jeder Nutzer auf dem System überschreiben.",
        wo: "Dieser Server.", evidence: ev,
        fix: { why: "Das Schreibrecht für andere entziehen.", steps: [{ desc: "Schreibrecht für andere weg", script: "chmod o-w " + (find.files[0] || "<datei>") }] } });
    }
    ev.push(evidence("Durchsucht, nichts für alle Beschreibbares", { cmd: find.cmd, line: "(keine Treffer in: " + dirs + ")" }));
    return result({ id: this.id, title: this.title, verdict: SAFE,
      was: "Keine für alle beschreibbaren Dateien an den heiklen Stellen.", wie: "/etc und die Web-Verzeichnisse wurden geprüft.",
      wo: "Dieser Server.", evidence: ev });
  },
};
