import { test } from "node:test";
import assert from "node:assert/strict";
import { toSarif } from "./sarif.mjs";

const mk = (id, verdict, extra = {}) => ({ id, title: "T " + id, verdict, was: "Was", wie: "Wie", wo: "Wo", evidence: [], fix: null, ...extra });

test("top-level shape and version", () => {
  const s = toSarif([], { tool: "dante-watch", version: "1.2.3" });
  assert.equal(s.version, "2.1.0");
  assert.equal(s.$schema, "https://json.schemastore.org/sarif-2.1.0.json");
  assert.equal(s.runs.length, 1);
  assert.equal(s.runs[0].tool.driver.name, "dante-watch");
  assert.equal(s.runs[0].tool.driver.version, "1.2.3");
  assert.equal(s.runs[0].tool.driver.informationUri, "https://www.npmjs.com/package/dante-watch");
});

test("safe and unknown are not findings", () => {
  const s = toSarif([mk("a", "safe"), mk("b", "unknown")]);
  assert.deepEqual(s.runs[0].results, []);
  assert.deepEqual(s.runs[0].tool.driver.rules, []);
});

test("risk -> error, warn -> warning, ruleId matches, rules unique", () => {
  const s = toSarif([mk("a", "risk"), mk("b", "warn"), mk("a", "warn")]);
  const r = s.runs[0].results;
  assert.equal(r.length, 3);
  assert.equal(r[0].level, "error");
  assert.equal(r[1].level, "warning");
  assert.equal(r[0].ruleId, "a");
  assert.equal(r[1].ruleId, "b");
  assert.deepEqual(s.runs[0].tool.driver.rules.map((x) => x.id), ["a", "b"]);
  assert.equal(s.runs[0].tool.driver.rules[0].shortDescription.text, "T a");
});

test("message holds was and wie, grounded evidence line appended", () => {
  const ev = [{ claim: "c", cmd: "x", line: "ignored", grounded: false }, { claim: "c", cmd: "x", line: "PermitRoot yes", grounded: true }];
  const s = toSarif([mk("a", "risk", { evidence: ev })]);
  assert.equal(s.runs[0].results[0].message.text, "Was Wie  (PermitRoot yes)");
  assert.equal(toSarif([mk("a", "risk")]).runs[0].results[0].message.text, "Was Wie");
});

test("location only with uri", () => {
  assert.equal("locations" in toSarif([mk("a", "risk")]).runs[0].results[0], false);
  const l = toSarif([mk("a", "risk")], { uri: "server.conf" }).runs[0].results[0].locations;
  assert.equal(l[0].physicalLocation.artifactLocation.uri, "server.conf");
});

test("fix with steps becomes a minimal fixes entry", () => {
  const f = { why: "because", steps: [{ desc: "d", script: "s" }] };
  assert.equal(toSarif([mk("a", "warn", { fix: f })]).runs[0].results[0].fixes[0].description.text, "because");
});

test("serializable round-trip", () => {
  const s = toSarif([mk("a", "risk"), mk("b", "warn")], { uri: "u" });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
