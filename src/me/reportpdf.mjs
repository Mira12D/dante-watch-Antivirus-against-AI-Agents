// The run as a PDF you can keep or send. Built from the last results, zero-dep (src/core/pdf.mjs).
// Written to ~/.dante/reports/; on a clear yes a copy goes to the Downloads folder (never overwriting).
// Values of secrets are never in a result, so they are never in the report either.
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { textPdf } from "../core/pdf.mjs";

const LABEL = {
  de: { safe: "SICHER", warn: "SCHRITT NÖTIG", risk: "OFFEN", unknown: "UNBEKANNT", head: "Dante — Bericht", sum: "Zusammenfassung", none: "Keine Funde." },
  en: { safe: "SAFE", warn: "STEP NEEDED", risk: "OPEN", unknown: "UNKNOWN", head: "Dante — report", sum: "Summary", none: "No findings." },
  es: { safe: "SEGURO", warn: "PASO NECESARIO", risk: "ABIERTO", unknown: "DESCONOCIDO", head: "Dante — informe", sum: "Resumen", none: "Sin hallazgos." },
};
const okLang = (l) => (LABEL[l] ? l : "en");

// Pure: results + context -> { title, lines } for the PDF. Order: a summary count, then each result with its grounded lines.
export function reportDoc(results, { target = "localhost", when = new Date(), lang = "de" } = {}) {
  const L = LABEL[okLang(lang)];
  const rs = (results || []).filter(Boolean);
  const stamp = when.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const count = (v) => rs.filter((r) => r.verdict === v).length;
  const title = `${L.head} · ${target}`;
  const lines = [stamp, "", `${L.sum}: ${count("risk")} ${L.risk} · ${count("warn")} ${L.warn} · ${count("unknown")} ${L.unknown} · ${count("safe")} ${L.safe}`, ""];
  for (const r of rs) {
    lines.push(`[${L[r.verdict] || r.verdict}] ${r.title}`);
    if (r.was) lines.push("  " + r.was);
    for (const e of (r.evidence || []).filter((e) => e.grounded)) lines.push("  • " + e.claim + ": " + e.line);
    lines.push("");
  }
  if (!rs.length) lines.push(L.none);
  return { title, lines };
}

// Write the PDF into ~/.dante/reports/ and return its path. Never throws; returns null on failure.
export function saveReport(results, { target, when = new Date(), lang = "de", home = homedir() } = {}) {
  try {
    const dir = join(home, ".dante", "reports");
    mkdirSync(dir, { recursive: true });
    const name = "dante-" + when.toISOString().replace(/[:T]/g, "-").slice(0, 16) + ".pdf";
    const path = join(dir, name);
    writeFileSync(path, textPdf(reportDoc(results, { target, when, lang })), { mode: 0o600 });
    return path;
  } catch { return null; }
}

// The Downloads folder for this OS, if it exists.
export function downloadsDir(home = homedir()) {
  const d = join(home, "Downloads");
  return existsSync(d) ? d : null;
}

// Copy a report into Downloads without ever overwriting (adds -2, -3, ... on a clash). Returns the dest path or null.
export function copyToDownloads(src, { home = homedir() } = {}) {
  try {
    const dir = downloadsDir(home);
    if (!dir) return null;
    const base = src.split(/[\\/]/).pop().replace(/\.pdf$/, "");
    let dest = join(dir, base + ".pdf");
    for (let i = 2; existsSync(dest); i++) dest = join(dir, base + "-" + i + ".pdf");
    copyFileSync(src, dest);
    return dest;
  } catch { return null; }
}
