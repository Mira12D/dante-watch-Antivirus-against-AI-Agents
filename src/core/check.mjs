// Result contract for checks. Every piece of evidence ties a claim to the command that ran and the
// line it printed. A safe, risk or warn verdict without a grounded line is downgraded to unknown.

export const SAFE = "safe";     // proven not vulnerable, with evidence
export const WARN = "warn";     // partially mitigated / needs a step (e.g. restart)
export const RISK = "risk";     // proven exposed / vulnerable, with evidence
export const UNKNOWN = "unknown"; // could not gather real evidence - never claim safety

export function evidence(claim, source) {
  // source = { cmd, line } - cmd is the real command, line is the real output it produced.
  const line = (source && source.line != null) ? String(source.line).trim() : "";
  const cmd = (source && source.cmd) ? String(source.cmd) : "";
  return { claim: String(claim), cmd, line, grounded: line.length > 0 };
}

export function result({ id, title, verdict, was, wie, wo, evidence: ev = [], fix = null }) {
  // Guard: a verdict of SAFE/RISK/WARN must stand on at least one grounded evidence line.
  const grounded = ev.filter((e) => e.grounded);
  let v = verdict;
  if ((v === SAFE || v === RISK || v === WARN) && grounded.length === 0) v = UNKNOWN;
  return { id, title, verdict: v, was: was || "", wie: wie || "", wo: wo || "", evidence: ev, fix };
}
