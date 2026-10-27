// Schema for rules and knowledge cards. A rule says what to look for as data; how to look is code in
// src/checks. Unknown rule types are rejected, so a pack cannot introduce new behaviour.
import { literalOf, toJs } from "./ere.mjs";
// The fixed vocabulary of a pack. A rule says what to look for as data; how to look is code in
// src/checks/ and never comes from a pack. A type that is not listed here is refused, not skipped,
// so a pack can never smuggle in a command or a new kind of action.
const ID = /^[a-z0-9_-]{1,40}$/;
const CVE = /^CVE-\d{4}-\d{4,7}$/;
const WORD = /^[\p{L}\p{N} ._:+-]{1,40}$/u; // letters of any language: Dante speaks DE/EN/ES
const NAME = /^[A-Za-z0-9_.*\/-]{1,60}$/;
const VAL = /^[a-z-]{1,30}$/;
const clean = (s) => typeof s === "string" && !/[\u0000-\u001f]/.test(s);

// The systems the Prüf-Bib knows. "generic" always applies; the others only where the router finds the system.
export const PRUEF_SYSTEMS = ["generic", "node", "php", "python", "go", "ruby", "java", "rust", "apple", "linux", "web"];
// the longest run of fixed characters in a pattern (classes and counts are not fixed; "\\." is a fixed ".")
export const literalRun = (re) => literalOf(re).length;
// ---- the Hugging Face analysis (Dante 0.1.3): three kinds of rule, all local and read-only
export const FORMAT_KINDS = ["safe", "code", "unknown"];                       // what loading a file of this extension does
export const LICENSE_CLASSES = ["permissive", "copyleft", "noncommercial", "research", "custom", "unknown"];
export const CARD_FIELDS = ["license", "base_model", "pipeline_tag", "library_name", "tags", "language", "datasets", "gated", "auto_map", "architectures", "model_type", "quantization"];
export const CARD_OPS = ["missing", "present", "equals", "in", "matches"];
export const LEVELS = ["info", "warn", "risk"];
export const CONFIG_WHERE = ["command", "args", "env", "url", "name"];
export const CAPS = ["shell", "filesystem", "browser", "database", "network", "git", "cloud", "secrets", "code", "email", "other"];
const EXT = /^[a-z0-9_.+-]{1,24}$/;
const CFG_PATH = /^(~\/)?[A-Za-z0-9_. @()+\/-]{1,120}$/;
const i18nOk = (o, max = 140) => o && typeof o === "object" && !Array.isArray(o) && LANGS.every((lg) => clean(o[lg]) && o[lg] && o[lg].length <= max);
const reOk = (re) => clean(re) && re.length >= 4 && re.length <= 160 && !/\\[1-9]/.test(re) && !/\\[dwsbDWSB]|\(\?/.test(re) && toJs(re) !== null;
const FMT_ID = /^[a-z0-9_.-]{1,60}$/;
export const PROBES = ["php", "nginx", "openssl", "apache"];
export const SSHD_KEYS = ["permitrootlogin", "passwordauthentication", "permitemptypasswords", "x11forwarding"];
const MAX_RULES = 200;
// A knowledge card explains one topic Dante watches: what it is, why it is dangerous, what stands out,
// what is normal, how he looks, what to do. All three languages are mandatory.
export const CARD_LANGS = ["de", "en", "es"];
export const CARD_KEYS = ["what", "why", "signs", "normal", "how", "todo"];
// Optional wording for the verdict: what Dante says when the rule finds something / when it is clean.
const MSG = ["bad", "bad_how", "ok", "ok_how", "part", "part_how"];
const LANGS = ["en", "es"]; // every rule must speak these next to its German base (see missingTexts)

const TYPES = {
  // A version below the fixed patch of its major.minor line is exposed unless the distro changelog
  // names the CVE (a backport). fixed: { "8.2": 35 } means 8.2.35 and up is fixed upstream.
  version_cve(r) {
    if (!PROBES.includes(r.probe)) return "probe unbekannt";
    if (!r.fixed || typeof r.fixed !== "object" || Array.isArray(r.fixed)) return "fixed fehlt";
    const ks = Object.keys(r.fixed);
    if (!ks.length || ks.length > 20) return "fixed: Anzahl";
    for (const k of ks) if (!/^\d{1,2}\.\d{1,2}$/.test(k) || !Number.isInteger(r.fixed[k]) || r.fixed[k] < 0 || r.fixed[k] > 999) return "fixed: " + k;
    if (!Array.isArray(r.cve) || !r.cve.length) return "cve fehlt";
    return null;
  },
  // World-readable secret files in a web root, by file name (a name with / is matched as a path).
  path_exposed(r) {
    if (!Array.isArray(r.names) || !r.names.length || r.names.length > 20) return "names: Anzahl";
    return r.names.every((n) => NAME.test(n)) ? null : "names: Zeichen";
  },
  // Backdoor markers in files of a web root: a glob and a few patterns (grep -E syntax).
  file_pattern(r) {
    if (!/^\*\.[a-z0-9]{1,8}$/.test(r.glob || "")) return "glob";
    if (!Array.isArray(r.patterns) || !r.patterns.length || r.patterns.length > 20) return "patterns: Anzahl";
    for (const p of r.patterns) {
      if (!p || !clean(p.name) || p.name.length > 80) return "pattern: name";
      if (!clean(p.re) || p.re.length < 4 || p.re.length > 200) return "pattern: Länge";
    }
    return null;
  },
  // Secret formats in project files (deep run): each format is a grep -E pattern for one kind of key or token.
  // Dante reports file and line, never the value. The pattern needs a literal run of 4+ characters so it stays fast
  // and precise, and no back-references. A format carries the system it belongs to; the router picks the systems.
  secret_format(r) {
    if (!Array.isArray(r.formats) || !r.formats.length || r.formats.length > 4000) return "formats: Anzahl";
    const seen = new Set();
    for (const f of r.formats) {
      if (!f || !FMT_ID.test(f.id || "") || seen.has(f.id)) return "format: id";
      seen.add(f.id);
      if (!clean(f.name) || !f.name || f.name.length > 80) return "format " + f.id + ": name";
      if (!PRUEF_SYSTEMS.includes(f.system)) return "format " + f.id + ": system";
      if (!clean(f.re) || f.re.length < 8 || f.re.length > 200 || /\\[1-9]/.test(f.re) || /\\[dwsbDWSB]|\(\?/.test(f.re) || literalRun(f.re) < 3) return "format " + f.id + ": re";
      if (f.globs !== undefined && (!Array.isArray(f.globs) || f.globs.length > 8 || !f.globs.every((g) => NAME.test(g)))) return "format " + f.id + ": globs";
      if (f.i18n !== undefined && (!f.i18n || typeof f.i18n !== "object" || !Object.entries(f.i18n).every(([lg, v]) => LANGS.includes(lg) && clean(v) && v && v.length <= 80))) return "format " + f.id + ": i18n";
    }
    return null;
  },
  // Model files and the code that ships with a model: which file extensions run code when loaded (pickle) and which
  // do not (safetensors, gguf), plus patterns for the model's own Python files. Dante reads names and sizes, never
  // the weights.
  model_files(r) {
    if (!Array.isArray(r.formats) || !r.formats.length || r.formats.length > 300) return "formats: Anzahl";
    const seen = new Set();
    for (const f of r.formats) {
      if (!f || !EXT.test(f.ext || "") || seen.has(f.ext)) return "format: ext";
      seen.add(f.ext);
      if (!FORMAT_KINDS.includes(f.kind)) return "format " + f.ext + ": kind";
      if (!clean(f.name) || !f.name || f.name.length > 80 || !i18nOk(f.i18n, 160) && f.i18n !== undefined) return "format " + f.ext + ": name";
    }
    if (!Array.isArray(r.code) || r.code.length > 800) return "code: Anzahl";
    const ids = new Set();
    for (const c of r.code) {
      if (!c || !FMT_ID.test(c.id || "") || ids.has(c.id)) return "code: id";
      ids.add(c.id);
      if (!clean(c.name) || !c.name || c.name.length > 80) return "code " + c.id + ": name";
      if (!reOk(c.re) || literalOf(c.re).length < 3) return "code " + c.id + ": re";
      if (c.i18n !== undefined && !Object.entries(c.i18n).every(([lg, v]) => LANGS.includes(lg) && clean(v) && v && v.length <= 80)) return "code " + c.id + ": i18n";
    }
    return null;
  },
  // A model's card (README front matter) and config.json: facts about where it comes from. A check is a small
  // declarative test on one field; a license row says what class a license id belongs to.
  model_card(r) {
    if (!Array.isArray(r.licenses) || r.licenses.length > 600) return "licenses: Anzahl";
    const lic = new Set();
    for (const l of r.licenses) {
      if (!l || !/^[a-z0-9_.+-]{1,60}$/.test(l.id || "") || lic.has(l.id)) return "license: id";
      lic.add(l.id);
      if (!LICENSE_CLASSES.includes(l.class)) return "license " + l.id + ": class";
    }
    if (!Array.isArray(r.checks) || !r.checks.length || r.checks.length > 600) return "checks: Anzahl";
    const ids = new Set();
    for (const c of r.checks) {
      if (!c || !FMT_ID.test(c.id || "") || ids.has(c.id)) return "check: id";
      ids.add(c.id);
      if (!CARD_FIELDS.includes(c.field) || !CARD_OPS.includes(c.op) || !LEVELS.slice(0, 2).includes(c.level)) return "check " + c.id + ": field/op/level";
      if (["equals", "matches"].includes(c.op) && (!clean(c.value) || !c.value || c.value.length > 120)) return "check " + c.id + ": value";
      if (c.op === "matches" && !reOk(c.value)) return "check " + c.id + ": value-re";
      if (c.op === "in" && (!Array.isArray(c.values) || !c.values.length || c.values.length > 40 || !c.values.every((v) => clean(v) && v && v.length <= 60))) return "check " + c.id + ": values";
      if (!clean(c.name) || !c.name || c.name.length > 120 || !i18nOk(c.i18n, 160)) return "check " + c.id + ": name/i18n";
    }
    return null;
  },
  // Agent and MCP configuration files: where they live and what in them is risky or powerful. A config entry is read
  // as JSON; values (keys, tokens) are tested but never printed.
  agent_config(r) {
    if (!Array.isArray(r.files) || !r.files.length || r.files.length > 80 || !r.files.every((f) => CFG_PATH.test(f) && !f.includes(".."))) return "files";
    if (!Array.isArray(r.checks) || !r.checks.length || r.checks.length > 600) return "checks: Anzahl";
    const ids = new Set();
    for (const c of r.checks) {
      if (!c || !FMT_ID.test(c.id || "") || ids.has(c.id)) return "check: id";
      ids.add(c.id);
      if (!CONFIG_WHERE.includes(c.where) || !LEVELS.includes(c.level) || !reOk(c.re)) return "check " + c.id + ": where/level/re";
      if (!clean(c.name) || !c.name || c.name.length > 120 || !i18nOk(c.i18n, 160)) return "check " + c.id + ": name/i18n";
    }
    if (!Array.isArray(r.caps) || r.caps.length > 500) return "caps: Anzahl";
    for (const c of r.caps) {
      if (!c || !FMT_ID.test(c.id || "") || !CAPS.includes(c.cap) || !reOk(c.re)) return "cap: " + String(c && c.id);
      if (!clean(c.name) || !c.name || c.name.length > 80) return "cap " + c.id + ": name";
    }
    return null;
  },
  // sshd settings that are bad TOGETHER: every listed setting must hold one of its bad values.
  sshd_setting(r) {
    if (!Array.isArray(r.settings) || !r.settings.length || r.settings.length > 4) return "settings: Anzahl";
    for (const s of r.settings) {
      if (!s || !SSHD_KEYS.includes(s.key)) return "key unbekannt";
      if (!Array.isArray(s.bad) || !s.bad.length || s.bad.length > 5 || !s.bad.every((v) => VAL.test(v))) return "bad: " + s.key;
    }
    return null;
  },
};
export const RULE_TYPES = Object.keys(TYPES);

// null when every rule is fine, else a short reason naming the rule.
export function validateRules(rules) {
  if (!Array.isArray(rules)) return "rules fehlt";
  if (rules.length > MAX_RULES) return "zu viele Regeln";
  const seen = new Set();
  for (const r of rules) {
    if (!r || typeof r !== "object") return "keine Regel";
    if (!ID.test(r.id || "")) return "id";
    if (seen.has(r.id)) return r.id + ": doppelt";
    seen.add(r.id);
    if (!TYPES[r.type]) return r.id + ": Typ " + String(r.type).slice(0, 20) + " nicht erlaubt";
    if (!clean(r.title) || !r.title || r.title.length > 120) return r.id + ": title";
    if (r.cve !== undefined && (!Array.isArray(r.cve) || r.cve.length > 10 || !r.cve.every((c) => CVE.test(c)))) return r.id + ": cve";
    if (r.know !== undefined && !ID.test(r.know)) return r.id + ": know";
    if (r.deep !== undefined && typeof r.deep !== "boolean") return r.id + ": deep";
    if (r.aliases !== undefined && (!Array.isArray(r.aliases) || r.aliases.length > 20 || !r.aliases.every((a) => WORD.test(a)))) return r.id + ": aliases";
    if (r.msg !== undefined) {
      if (!r.msg || typeof r.msg !== "object" || Array.isArray(r.msg)) return r.id + ": msg";
      for (const [k, v] of Object.entries(r.msg)) if (!MSG.includes(k) || !clean(v) || !v || v.length > 200) return r.id + ": msg." + k;
    }
    if (r.i18n !== undefined) {
      if (!r.i18n || typeof r.i18n !== "object" || Array.isArray(r.i18n)) return r.id + ": i18n";
      for (const [lg, o] of Object.entries(r.i18n)) {
        if (![...LANGS, "de"].includes(lg) || !o || typeof o !== "object" || Array.isArray(o)) return r.id + ": i18n." + lg;
        for (const [k, v] of Object.entries(o)) if (!["title", ...MSG].includes(k) || !clean(v) || !v || v.length > 200) return r.id + ": i18n." + lg + "." + k;
      }
    }
    if (r.type === "file_pattern") for (const p of r.patterns || []) {
      if (p.i18n !== undefined && (!p.i18n || typeof p.i18n !== "object" || !Object.entries(p.i18n).every(([lg, v]) => LANGS.includes(lg) && clean(v) && v && v.length <= 80))) return r.id + ": pattern i18n";
    }
    const why = TYPES[r.type](r);
    if (why) return r.id + ": " + why;
  }
  return null;
}

// null when every card is fine, else a short reason naming the card.
export function validateKnow(cards) {
  if (cards === undefined) return null;
  if (!Array.isArray(cards) || cards.length > 100) return "know: Anzahl";
  const seen = new Set();
  for (const c of cards) {
    if (!c || typeof c !== "object" || !ID.test(c.id || "")) return "know: id";
    if (seen.has(c.id)) return c.id + ": doppelt";
    seen.add(c.id);
    if (!Array.isArray(c.aliases) || !c.aliases.length || c.aliases.length > 30 || !c.aliases.every((a) => WORD.test(a))) return c.id + ": aliases";
    for (const lg of CARD_LANGS) {
      const o = c[lg];
      if (!o || typeof o !== "object") return `${c.id}: ${lg}`;
      if (!clean(o.title) || !o.title || o.title.length > 100) return `${c.id}: ${lg}.title`;
      for (const k of CARD_KEYS) if (!clean(o[k]) || !o[k] || o[k].length > 420) return `${c.id}: ${lg}.${k}`;
    }
  }
  return null;
}

// What the pack FACTORY insists on (the client does not, so older packs keep working): every rule
// speaks English and Spanish for its title and each message it has, and every pattern has a name in
// both. Returns null, or the first thing missing.
export function missingTexts(rules, cards = [], builtinCards = []) {
  const known = new Set([...cards, ...builtinCards].map((c) => c.id));
  for (const r of rules) {
    if (!known.has(r.know || r.id)) return `${r.id}: keine Wissenskarte "${r.know || r.id}" (Dante darf nichts prüfen, was er nicht erklären kann)`;
    for (const lg of LANGS) {
      const o = (r.i18n && r.i18n[lg]) || {};
      if (!o.title) return `${r.id}: i18n.${lg}.title`;
      for (const k of Object.keys(r.msg || {})) if (!o[k]) return `${r.id}: i18n.${lg}.${k}`;
      for (const p of r.patterns || []) if (!(p.i18n && p.i18n[lg])) return `${r.id}: pattern "${p.name}" in ${lg}`;
      // every item a person will read has its English and Spanish name, by rule type
      const items = r.type === "secret_format" ? (r.formats || []).map((f) => [f.id, f])
        : r.type === "model_files" ? [...(r.formats || []).map((f) => [f.ext, f]), ...(r.code || []).map((c) => [c.id, c])]
        : r.type === "model_card" || r.type === "agent_config" ? (r.checks || []).map((c) => [c.id, c]) : [];
      for (const [name, it] of items) if (!(it.i18n && it.i18n[lg])) return `${r.id}: "${name}" in ${lg}`;
    }
  }
  return null;
}
