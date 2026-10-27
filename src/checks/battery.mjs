// Assembles the checks from rules. Built-in rules are the free tier; each installed pack adds rules or
// replaces one with the same id (newest wins). Deep rules (secret formats, models, agent config) are
// kept out of the light battery and run in the deep run or on request. `rechte` has no rule type
// yet and stays plain code.
import { versionCheck } from "./php2shell.mjs";
import { exposedCheck } from "./secrets.mjs";
import { patternCheck } from "./webshell.mjs";
import { sshdCheck } from "./sshd.mjs";
import { formatsCheck } from "./formats.mjs";
import { modelCardCheck, modelFilesCheck, agentConfigCheck } from "./hf.mjs";
import { rechte } from "./rechte.mjs";
import { BUILTIN } from "../pack/builtin.mjs";
import { loadPacks } from "../pack/pack.mjs";

const FACTORY = { version_cve: versionCheck, path_exposed: exposedCheck, file_pattern: patternCheck, sshd_setting: sshdCheck, secret_format: formatsCheck, model_card: modelCardCheck, model_files: modelFilesCheck, agent_config: agentConfigCheck };

// Deep rules (the Prüf-Bib's secret formats) are not part of the light battery that the patrol and the session run;
// they run in the deep run only (buildDeep).
export const buildBattery = (rules) => [...rules.filter((r) => !r.deep).map((r) => FACTORY[r.type](r)), rechte];
export const buildDeep = (rules) => rules.filter((r) => r.deep).map((r) => FACTORY[r.type](r));

// a rule of a later list replaces the rule with the same id, new ids are added
export function mergeRules(base, ...more) {
  const byId = new Map(base.map((r) => [r.id, r]));
  for (const rules of more) for (const r of rules || []) byId.set(r.id, r);
  return [...byId.values()];
}
// the rules of the built-in state plus the given packs (oldest first)
export const rulesWith = (packs) => mergeRules(BUILTIN.rules, ...(packs || []).map((p) => p.rules));

export const BATTERY = buildBattery(BUILTIN.rules);

// The battery Dante runs with now: built-in rules plus every pack in ~/.dante/packs that passes all
// checks. notices lists the pack files he refused (code per file), for the person to be told once.
export function activeBattery(opts) {
  const { packs, notices } = loadPacks(opts);
  const rules = rulesWith(packs);
  return { battery: buildBattery(rules), deep: buildDeep(rules), packs, notices };
}

// muster intent -> check id. The ear recognises the worry; this says which hand to use.
export const MUSTER = { pruef_php2shell: "php2shell", secrets: "secrets", webshell: "webshell", sshd: "sshd", rechte: "rechte" };

export const checkById = (id, list = BATTERY) => list.find((c) => c.id === id) || null;

// Run one check safely - a thrown check becomes an honest UNKNOWN, never a crash or a false verdict.
export function runCheck(check) {
  try { return check.run(); }
  catch (e) { return { id: check.id, title: check.title, verdict: "unknown", was: "Check brach ab.", wie: String(e.message || e), wo: "", evidence: [] }; }
}
