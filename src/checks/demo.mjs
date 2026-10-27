// Harmless demo check for --demo: a temp file stands in for an open door, so the whole
// ask -> plan -> confirm -> fix -> verify loop can be tried without touching anything real.
import { run, firstLine } from "../core/sh.mjs";
import { result, evidence, SAFE, RISK } from "../core/check.mjs";

const HOLE = "/tmp/dante-demo-hole";

export const demo = {
  id: "demo",
  title: "Demo — eine harmlose offene Tür (Übung)",
  run() {
    const ls = run("ls -l " + HOLE + " 2>/dev/null");
    const open = ls.ran && ls.ok && ls.out.trim().length > 0;
    if (!open) {
      return result({ id: this.id, title: this.title, verdict: SAFE,
        was: "Die Übungs-Tür ist zu.", wie: "Die Datei " + HOLE + " existiert nicht.",
        wo: "Dieser Rechner.", evidence: [evidence("Keine Übungs-Datei da", { cmd: "ls " + HOLE, line: "(nicht vorhanden)" })] });
    }
    return result({ id: this.id, title: this.title, verdict: RISK,
      was: "Die Übungs-Tür steht offen.", wie: "Die Datei " + HOLE + " ist da.",
      wo: "Dieser Rechner.", evidence: [evidence("Übungs-Datei existiert", { cmd: "ls -l " + HOLE, line: firstLine(ls.out) })],
      fix: { why: "Die Übungs-Datei entfernen.", steps: [{ desc: "Datei löschen", script: "rm -f " + HOLE }] } });
  },
};
