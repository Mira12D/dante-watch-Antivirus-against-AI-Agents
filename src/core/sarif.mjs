// Dante's results as SARIF 2.1.0, the format GitHub Code Scanning reads. Pure: results in, plain object out.
// Only findings (risk, warn) become SARIF results. safe and unknown are not findings - an all-safe run has zero results, which is valid.
// Nothing is invented: no file path unless the caller gives a uri, and only strings already in the result (they never hold secret values).
const LEVEL = { risk: "error", warn: "warning" };

export function toSarif(results, { tool = "dante-watch", version = "0.0.0", uri } = {}) {
  const findings = (Array.isArray(results) ? results : []).filter((r) => r && LEVEL[r.verdict]);

  // one rule per unique id, only for what is actually reported
  const rules = [];
  const seen = new Set();
  for (const r of findings) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    rules.push({ id: r.id, name: r.title, shortDescription: { text: r.title } });
  }

  const out = findings.map((r) => {
    let text = `${r.was || ""} ${r.wie || ""}`.trim();
    const line = (r.evidence || []).find((e) => e && e.grounded && e.line)?.line;
    if (line) text += `  (${line})`;
    const res = { ruleId: r.id, level: LEVEL[r.verdict], message: { text } };
    if (uri) res.locations = [{ physicalLocation: { artifactLocation: { uri } } }];
    if (r.fix && Array.isArray(r.fix.steps) && r.fix.steps.length) res.fixes = [{ description: { text: r.fix.why || "" } }];
    return res;
  });

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{ tool: { driver: { name: tool, version, informationUri: "https://www.npmjs.com/package/dante-watch", rules } }, results: out }],
  };
}
