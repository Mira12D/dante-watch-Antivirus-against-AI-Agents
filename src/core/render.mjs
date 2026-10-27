// Formats a check result as what / how / where plus evidence lines. A claim without a real
// line is printed as a gap, not as proof.
import { SAFE, WARN, RISK, UNKNOWN } from "./check.mjs";
import { t } from "../i18n.mjs";
import { tx } from "../i18n-checks.mjs";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => c("2", s), bold = (s) => c("1", s);

const BADGE = {
  [SAFE]: () => c("42;30", t("rSafe")),
  [WARN]: () => c("43;30", t("rWarn")),
  [RISK]: () => c("41;37", t("rRisk")),
  [UNKNOWN]: () => c("100;37", t("rUnknown")),
};

export function renderResult(r) {
  const lines = [];
  lines.push("");
  lines.push((BADGE[r.verdict] || BADGE[UNKNOWN])() + "  " + bold(tx(r.title)));
  if (r.was) lines.push("  " + dim(t("rWhat")) + " " + tx(r.was));
  if (r.wie) lines.push("  " + dim(t("rHow")) + " " + tx(r.wie));
  if (r.wo) lines.push("  " + dim(t("rWhere")) + " " + tx(r.wo));
  if (r.evidence && r.evidence.length) {
    lines.push("  " + dim(t("rProof")));
    for (const e of r.evidence) {
      if (e.grounded) {
        lines.push("    • " + tx(e.claim));
        lines.push("      " + dim("↳ " + e.cmd + "  →  " + truncate(tx(e.line), 96)));
      } else {
        lines.push("    • " + tx(e.claim) + "  " + c("33", t("rNoProof")));
      }
    }
  }
  if ((r.verdict === RISK || r.verdict === WARN) && r.fix) {
    const why = tx(typeof r.fix === "string" ? r.fix : (r.fix.why || t("rCanClose")));
    lines.push("  " + c("36", t("rSuggest")) + " " + why + dim(t("rWithFix")));
  }
  return lines.join("\n");
}

export function renderSummary(results, target) {
  const n = (v) => results.filter((r) => r.verdict === v).length;
  const parts = [];
  if (n(RISK)) parts.push(c("41;37", ` ${n(RISK)} ${t("sOpen")} `));
  if (n(WARN)) parts.push(c("43;30", ` ${n(WARN)} ${t("sStep")} `));
  if (n(UNKNOWN)) parts.push(c("100;37", ` ${n(UNKNOWN)} ${t("sUnknown")} `));
  if (n(SAFE)) parts.push(c("42;30", ` ${n(SAFE)} ${t("sSafe")} `));
  return "\n" + bold(t("sWatch")) + bold(target) + "\n" + (parts.join("  ") || t("sNone")) +
    "\n" + dim(t("sLaw"));
}

function truncate(s, n) {
  s = String(s).replace(/\s+/g, " ");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
