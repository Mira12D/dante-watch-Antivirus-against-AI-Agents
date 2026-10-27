// Checks for AI models and agent configs on the local machine: model_card (origin, license),
// model_files (formats that execute code on load, extra Python files) and agent_config (MCP servers and
// their reach). Rules come from the Hugging Face pack. Only names, sizes, card fields and JSON keys are
// read; weights are never opened and secret values are never printed.
import { homedir } from "node:os";
import { readdirSync, readFileSync, statSync, existsSync, realpathSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { targetLabel } from "../core/sh.mjs";
import { result, evidence, SAFE, WARN, RISK, UNKNOWN } from "../core/check.mjs";
import { toJs } from "../pack/ere.mjs";
import { lang } from "../i18n.mjs";
import { read as readUser } from "../me/user.mjs";
import { loc } from "./loc.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__", ".venv", "venv", "Pods", "target"]);
const BUDGET_MS = 60000, MAX_EVIDENCE = 14;
const expand = (p) => String(p || "").replace(/^~(?=\/)/, homedir());
const name3 = (o, fb) => (o && o.i18n && o.i18n[lang()]) || fb;
// Many checks can describe the same finding; a person needs the worst few, once each.
const RANK = { risk: 0, warn: 1, info: 2 };
const topHits = (hits, n = 3) => { const sorted = [...hits].sort((a, b) => RANK[(a.c || a).level] - RANK[(b.c || b).level]); const seen = new Set(), out = []; for (const h of sorted) { const t = name3(h.c || h, (h.c || h).name).toLowerCase().replace(/[^a-zäöüß ]/g, "").slice(0, 28); if (seen.has(t)) continue; seen.add(t); out.push(h); if (out.length === n) break; } return { shown: out, more: hits.length - out.length }; };

// ---- where models live on this machine
export function modelRoots(env = process.env) {
  const h = homedir(), out = [];
  const seen = new Set();
  const add = (p) => { if (!p || !existsSync(p)) return; let real = p; try { real = realpathSync(p).toLowerCase(); } catch { /* keep */ } if (seen.has(real)) return; seen.add(real); out.push(p); };
  add(env.HUGGINGFACE_HUB_CACHE); if (env.HF_HOME) add(join(env.HF_HOME, "hub")); add(env.TRANSFORMERS_CACHE);
  add(join(h, ".cache", "huggingface", "hub")); add(join(h, ".cache", "torch", "hub")); add(join(h, "models")); add(join(h, "Models"));
  const u = readUser();
  for (const p of (u && u.projects) || []) add(expand(p));
  return out;
}

// Walk the roots (files behind a symlink count - a Hugging Face cache is made of them - folders behind one do not).
// onDir(dir, entries[{name, size}]) is called for every folder. Stops at the time budget and says so.
export function walk(roots, onDir, { maxDepth = 9, budgetMs = BUDGET_MS } = {}) {
  const start = Date.now();
  let incomplete = false, dirs = 0;
  const stack = roots.map((r) => [r, 0]);
  while (stack.length) {
    if (Date.now() - start > budgetMs) { incomplete = true; break; }
    const [dir, depth] = stack.pop();
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    const files = [];
    for (const e of ents) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (depth < maxDepth && !SKIP_DIRS.has(e.name)) stack.push([p, depth + 1]); continue; }
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isFile()) files.push({ name: e.name, size: st.size });
    }
    dirs++;
    onDir(dir, files);
  }
  return { incomplete, dirs };
}

// "models--org--name/snapshots/<rev>/..." -> "org/name"; any other folder -> its name
export function modelName(dir) {
  const m = dir.match(/models--([^/\\]+?)--([^/\\]+)[/\\]snapshots[/\\]/);   // a Windows path comes with backslashes
  return m ? `${m[1]}/${m[2]}` : basename(dir);
}
const rev = (dir) => { const m = dir.match(/snapshots[/\\]([0-9a-f]{7})/); return m ? m[1] : ""; };

// ---- the model card: README front matter (a small YAML subset) and config.json
export function parseFrontMatter(text) {
  const m = String(text).match(/^---\s*\n([\s\S]*?)\n---\s*(\n|$)/);
  if (!m) return null;
  const out = {}; let key = null;
  for (const raw of m[1].split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) { (out[key] = Array.isArray(out[key]) ? out[key] : []).push(item[1].replace(/^["']|["']$/g, "")); continue; }
    const kv = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1]; const v = kv[2].trim();
    if (v === "") { out[key] = out[key] ?? ""; continue; }
    if (v.startsWith("[") && v.endsWith("]")) out[key] = v.slice(1, -1).split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    else out[key] = v.replace(/^["']|["']$/g, "");
  }
  return out;
}
export function cardFacts(dir, files) {
  const names = new Set(files.map((f) => f.name));
  let card = null, cfg = null;
  if (names.has("README.md")) { try { card = parseFrontMatter(readFileSync(join(dir, "README.md"), "utf8").slice(0, 60000)); } catch { /* unreadable */ } }
  if (names.has("config.json")) { try { cfg = JSON.parse(readFileSync(join(dir, "config.json"), "utf8").slice(0, 400000)); } catch { /* unreadable */ } }
  const list = (v) => (Array.isArray(v) ? v : v === undefined || v === "" ? [] : [String(v)]);
  const facts = {
    license: card && card.license !== undefined ? String(card.license).toLowerCase() : "",
    base_model: card ? list(card.base_model) : [],
    pipeline_tag: card && card.pipeline_tag ? String(card.pipeline_tag) : "",
    library_name: card && card.library_name ? String(card.library_name) : "",
    tags: card ? list(card.tags) : [], language: card ? list(card.language) : [], datasets: card ? list(card.datasets) : [],
    gated: !!(card && (card.extra_gated_prompt !== undefined || card.extra_gated_fields !== undefined || String(card.gated) === "true" || card.gated === "manual" || card.gated === "auto")),
    auto_map: !!(cfg && cfg.auto_map && typeof cfg.auto_map === "object"),
    architectures: cfg && Array.isArray(cfg.architectures) ? cfg.architectures.map(String) : [],
    model_type: cfg && cfg.model_type ? String(cfg.model_type) : "",
    quantization: !!(cfg && cfg.quantization_config),
  };
  return { facts, hasCard: !!card, hasCfg: !!cfg, cardFile: names.has("README.md") ? join(dir, "README.md") : "", cfgFile: names.has("config.json") ? join(dir, "config.json") : "" };
}
// one declarative test on one field
export function testCheck(c, facts) {
  const v = facts[c.field];
  const empty = Array.isArray(v) ? v.length === 0 : v === "" || v === false || v === undefined;
  const vals = Array.isArray(v) ? v.map(String) : [String(v)];
  switch (c.op) {
    case "missing": return empty;
    case "present": return !empty;
    case "equals": return !empty && vals.some((x) => x.toLowerCase() === String(c.value).toLowerCase());
    case "in": return !empty && vals.some((x) => c.values.map((y) => y.toLowerCase()).includes(x.toLowerCase()));
    case "matches": { const re = toJs(c.value); return !!re && !empty && vals.some((x) => re.test(x)); }
    default: return false;
  }
}

const localOnly = (rule, id, title) => targetLabel() !== "localhost"
  ? result({ id, title, verdict: UNKNOWN, was: "Diese Prüfung liest Modelle und Agent-Dateien auf dem eigenen Rechner.", wie: "Auf einem Server über SSH schaut Dante hier nicht nach.", wo: "Nur dieser Rechner.", evidence: [evidence("Ziel ist ein Server", { cmd: "targetLabel()", line: targetLabel() })] })
  : null;

const find = (id, rule) => ({ id, know: rule.know || rule.id, title: rule.title, aliases: rule.aliases || [], cve: [], deep: !!rule.deep });

// ---- CHARACTER: where does the model come from?
export function modelCardCheck(rule) {
  return { ...find(rule.id, rule), run() {
    const m = loc(rule), id = rule.id, title = m.title;
    const off = localOnly(rule, id, title); if (off) return off;
    const roots = modelRoots();
    if (!roots.length) return result({ id, title, verdict: SAFE, was: "Keine Modell-Ordner gefunden.", wie: "Kein Hugging-Face-Cache und keine Modell-Ordner auf diesem Rechner.", wo: "Dieser Rechner.", evidence: [evidence("Modell-Ordner gesucht", { cmd: "~/.cache/huggingface/hub, ~/models, Projektordner", line: "(keiner dieser Ordner existiert)" })] });
    const lic = new Map((rule.licenses || []).map((l) => [l.id, l.class]));
    const models = [];
    const w = walk(roots, (dir, files) => {
      const names = new Set(files.map((f) => f.name));
      if (!names.has("config.json") && !names.has("README.md")) return;
      if (!files.some((f) => /\.(safetensors|bin|pt|pth|ckpt|gguf|onnx|h5|pkl|msgpack)$/i.test(f.name)) && !names.has("config.json")) return;
      const c = cardFacts(dir, files);
      if (c.hasCfg || c.hasCard) models.push({ dir, ...c });
    });
    if (w.incomplete) return result({ id, title, verdict: UNKNOWN, was: "Konnte nicht alle Modell-Ordner lesen.", wie: "Das Zeitlimit war erreicht — ohne vollständige Suche sage ich nichts.", wo: "Dieser Rechner.", evidence: [evidence("Zeitlimit", { cmd: "walk", line: `${models.length} Modelle bis dahin` })] });
    const ev = [];
    let warn = 0;
    for (const md of models.slice(0, MAX_EVIDENCE)) {
      const f = md.facts, cls = lic.get(f.license) || (f.license ? "unknown" : "");
      const hits = (rule.checks || []).filter((c) => testCheck(c, f));
      const warns = hits.filter((c) => c.level === "warn");
      if (warns.length) warn++;
      const bits = [`Lizenz ${f.license || "—"}${cls ? " (" + cls + ")" : ""}`, f.base_model.length ? "Basis " + f.base_model.slice(0, 2).join(", ") : "", f.pipeline_tag, f.library_name, f.auto_map ? "eigener Code" : "", f.gated ? "gated" : ""].filter(Boolean).join(" · ");
      ev.push(evidence(`${modelName(md.dir)}${rev(md.dir) ? "@" + rev(md.dir) : ""}: ${bits}${hits.length ? " — " + (() => { const t = topHits(hits); return t.shown.map((c) => (c.level === "info" ? "" : "⚠ ") + name3(c, c.name)).join("; ") + (t.more > 0 ? ` (+${t.more})` : ""); })() : ""}`, { cmd: "README.md front matter + config.json", line: md.cardFile || md.cfgFile }));
    }
    if (models.length > MAX_EVIDENCE) ev.push(evidence(`… und ${models.length - MAX_EVIDENCE} weitere`, { cmd: "walk", line: `${models.length} Modelle insgesamt` }));
    if (!models.length) return result({ id, title, verdict: SAFE, was: "Keine Modelle mit Karte oder Konfiguration gefunden.", wie: `${roots.length} Ordner durchsucht.`, wo: "Dieser Rechner.", evidence: [evidence("Ordner durchsucht", { cmd: "walk", line: `(keine Modelle in: ${roots.join(", ")})` })] });
    const bad = models.filter((md) => (rule.checks || []).some((c) => c.level === "warn" && testCheck(c, md.facts))).length;
    return result({ id, title, verdict: bad ? WARN : SAFE, was: m.bad && bad ? m.bad : (m.ok || "Herkunft der Modelle ist angegeben."), wie: bad ? (m.bad_how || "Die Zeilen nennen Modell, Lizenz, Basis und was auffällt.") : (m.ok_how || "Karte und Konfiguration sagen, woher die Modelle kommen."), wo: "Dieser Rechner.", evidence: ev });
  } };
}

// ---- BEHAVIOUR: what does loading it do?
export function modelFilesCheck(rule) {
  const kinds = new Map((rule.formats || []).map((f) => [f.ext.toLowerCase(), f]));
  const codeRes = (rule.code || []).map((c) => ({ c, re: toJs(c.re) })).filter((x) => x.re);
  return { ...find(rule.id, rule), run() {
    const m = loc(rule), id = rule.id, title = m.title;
    const off = localOnly(rule, id, title); if (off) return off;
    const roots = modelRoots();
    if (!roots.length) return result({ id, title, verdict: SAFE, was: "Keine Modell-Ordner gefunden.", wie: "Kein Hugging-Face-Cache und keine Modell-Ordner auf diesem Rechner.", wo: "Dieser Rechner.", evidence: [evidence("Modell-Ordner gesucht", { cmd: "~/.cache/huggingface/hub, ~/models, Projektordner", line: "(keiner dieser Ordner existiert)" })] });
    const dirs = [];
    const w = walk(roots, (dir, files) => {
      const weights = files.filter((f) => kinds.has(extname(f.name).slice(1).toLowerCase()));
      const names = new Set(files.map((f) => f.name));
      if (!weights.length || (!names.has("config.json") && !weights.some((f) => kinds.get(extname(f.name).slice(1).toLowerCase()).kind !== "unknown"))) return;
      const cfg = (() => { try { return JSON.parse(readFileSync(join(dir, "config.json"), "utf8").slice(0, 400000)); } catch { return null; } })();
      const hasCustomCode = !!(cfg && cfg.auto_map) || files.some((f) => /^(modeling|configuration|tokenization)_.*\.py$/.test(f.name));
      dirs.push({ dir, weights, files, hasCustomCode });
    });
    if (w.incomplete) return result({ id, title, verdict: UNKNOWN, was: "Konnte nicht alle Modell-Ordner lesen.", wie: "Das Zeitlimit war erreicht — ohne vollständige Suche sage ich nichts.", wo: "Dieser Rechner.", evidence: [evidence("Zeitlimit", { cmd: "walk", line: `${dirs.length} Modell-Ordner bis dahin` })] });
    const ev = [], steps = [];
    let warn = 0, safeOnly = 0;
    for (const d of dirs) {
      const byKind = { code: [], safe: [], unknown: [] };
      for (const f of d.weights) byKind[(kinds.get(extname(f.name).slice(1).toLowerCase()) || { kind: "unknown" }).kind].push(f);
      const hits = [];
      if (d.hasCustomCode) for (const f of d.files.filter((x) => /\.py$/.test(x.name) && x.size < 400 * 1024)) {
        let text; try { text = readFileSync(join(d.dir, f.name), "latin1"); } catch { continue; }
        const lines = text.split("\n");
        for (const { c, re } of codeRes) for (let i = 0; i < lines.length; i++) if (lines[i].length < 2000 && re.test(lines[i])) { hits.push({ c, file: join(d.dir, f.name), n: i + 1 }); break; }
      }
      const label = `${modelName(d.dir)}${rev(d.dir) ? "@" + rev(d.dir) : ""}`;
      const redundant = byKind.code.length && byKind.safe.length;      // a pickle next to a safetensors copy is loaded by the safe one
      if (byKind.code.length && !redundant) {
        warn++;
        const exts = [...new Set(byKind.code.map((f) => extname(f.name).slice(1).toLowerCase()))];
        if (ev.length < MAX_EVIDENCE) ev.push(evidence(`${label}: lädt per ${exts.join("/")} — dabei kann Code laufen (${name3(kinds.get(exts[0]), kinds.get(exts[0]).name)})`, { cmd: "Dateiendungen im Ordner", line: `${join(d.dir, byKind.code[0].name)} · ${byKind.code[0].size} Bytes` }));
        steps.push({ desc: `Ordner ansehen (nur lesen): ${label}`, script: `ls -l '${d.dir.replace(/'/g, "'\\''")}'` });
      } else if (byKind.safe.length && !byKind.code.length) {
        safeOnly++;
        if (ev.length < MAX_EVIDENCE) ev.push(evidence(`${label}: nur ${[...new Set(byKind.safe.map((f) => extname(f.name).slice(1)))].join("/")} — enthält keinen ausführbaren Code`, { cmd: "Dateiendungen im Ordner", line: join(d.dir, byKind.safe[0].name) }));
      } else if (redundant && ev.length < MAX_EVIDENCE) ev.push(evidence(`${label}: Pickle liegt neben einer safetensors-Kopie`, { cmd: "Dateiendungen im Ordner", line: join(d.dir, byKind.code[0].name) }));
      for (const h of hits.slice(0, 4)) { warn++; if (ev.length < MAX_EVIDENCE + 6) ev.push(evidence(`${label}: eigener Code — Muster „${name3(h.c, h.c.name)}“`, { cmd: "Muster in den .py-Dateien des Modells", line: `${h.file}:${h.n}` })); }
    }
    if (!dirs.length) return result({ id, title, verdict: SAFE, was: "Keine Modell-Dateien gefunden.", wie: `${roots.length} Ordner durchsucht.`, wo: "Dieser Rechner.", evidence: [evidence("Ordner durchsucht", { cmd: "walk", line: `(keine Modell-Dateien in: ${roots.join(", ")})` })] });
    if (!warn) return result({ id, title, verdict: SAFE, was: m.ok || "Beim Laden läuft kein fremder Code.", wie: m.ok_how || "Die Modelle liegen in Formaten ohne ausführbaren Code, und ihr Zusatzcode zeigt keine Auffälligkeit.", wo: "Dieser Rechner.", evidence: ev });
    return result({ id, title, verdict: WARN, was: m.bad || "Beim Laden mancher Modelle kann fremder Code laufen.", wie: m.bad_how || "Pickle-Formate führen beim Laden Code aus; die Zeilen nennen Modell, Datei und Muster. Von Hand ansehen, nicht blind löschen.", wo: "Dieser Rechner.", evidence: ev,
      fix: steps.length ? { why: "Besser die safetensors-Variante laden (kein Code darin). Bis dahin: nur Modelle aus Quellen laden, denen du traust.", steps: steps.slice(0, 5) } : null });
  } };
}

// ---- CAPABILITIES: what may an agent do?
function serversOf(json) {
  const out = [];
  const take = (obj) => { if (obj && typeof obj === "object" && !Array.isArray(obj)) for (const [name, s] of Object.entries(obj)) if (s && typeof s === "object" && (s.command || s.url || s.args)) out.push({ name, s }); };
  if (!json || typeof json !== "object") return out;
  take(json.mcpServers); take(json.servers); take(json.context_servers); take(json.mcp && json.mcp.servers);
  if (json.projects && typeof json.projects === "object") for (const p of Object.values(json.projects)) if (p && p.mcpServers) take(p.mcpServers);
  return out;
}
const where = (name, s) => ({
  command: String(s.command || ""), args: Array.isArray(s.args) ? s.args.map(String).join(" ") : "", url: String(s.url || ""), name,
  env: s.env && typeof s.env === "object" ? Object.entries(s.env).map(([k, v]) => `${k}=${typeof v === "string" ? v : ""}`).join("\n") : "",
});
export function agentConfigCheck(rule) {
  const checks = (rule.checks || []).map((c) => ({ c, re: toJs(c.re) })).filter((x) => x.re);
  const caps = (rule.caps || []).map((c) => ({ c, re: toJs(c.re) })).filter((x) => x.re);
  return { ...find(rule.id, rule), run() {
    const m = loc(rule), id = rule.id, title = m.title;
    const off = localOnly(rule, id, title); if (off) return off;
    const tried = [], found = [];
    const proj = []; const u = readUser(); for (const p of (u && u.projects) || []) proj.push(expand(p));
    for (const f of rule.files) {
      if (f.startsWith("~/") || f.includes("/")) { const p = expand(f); tried.push(p); if (existsSync(p)) found.push(p); }
      else for (const root of proj) for (const p of [join(root, f), ...(() => { try { return readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith(".")).slice(0, 60).map((e) => join(root, e.name, f)); } catch { return []; } })()]) { if (existsSync(p) && !found.includes(p)) found.push(p); }
    }
    if (!found.length) return result({ id, title, verdict: SAFE, was: "Keine Agent- oder MCP-Konfiguration gefunden.", wie: `${tried.length} bekannte Orte geprüft.`, wo: "Dieser Rechner.", evidence: [evidence("Bekannte Konfig-Dateien gesucht", { cmd: "existsSync auf bekannte Pfade", line: `(keine von ${tried.length} gefunden, z. B. ${tried[0] || "?"})` })] });
    const ev = [], steps = [];
    let worst = SAFE, servers = 0, unreadable = 0;
    for (const file of found) {
      let json; try { json = JSON.parse(readFileSync(file, "utf8").slice(0, 2 * 1024 * 1024)); } catch { unreadable++; ev.push(evidence(`${basename(file)} ist kein lesbares JSON`, { cmd: "JSON.parse", line: file })); if (worst === SAFE) worst = WARN; continue; }
      for (const { name, s } of serversOf(json)) {
        servers++;
        const w = where(name, s);
        const have = [...new Set(caps.filter((x) => x.re.test(`${w.command} ${w.args} ${name}`)).map((x) => x.c.cap))];
        const hits = checks.filter((x) => x.re.test(w[x.c.where] || ""));
        for (const lvl of ["risk", "warn"]) if (hits.some((x) => x.c.level === lvl) && (worst === SAFE || (lvl === "risk" && worst !== RISK))) worst = lvl === "risk" ? RISK : (worst === RISK ? RISK : WARN);
        if (ev.length < MAX_EVIDENCE + 8) ev.push(evidence(`${name}${have.length ? " kann: " + have.join(", ") : ""}${hits.length ? " — " + (() => { const t = topHits(hits); return t.shown.map((x) => (x.c.level === "info" ? "" : "⚠ ") + name3(x.c, x.c.name)).join("; ") + (t.more > 0 ? ` (+${t.more})` : ""); })() : ""}`, { cmd: "JSON-Eintrag des Servers (Werte werden nie gezeigt)", line: `${file} · Server „${name}“` }));
      }
    }
    if (!servers && !unreadable) return result({ id, title, verdict: SAFE, was: "Die Konfiguration nennt keine Server.", wie: `${found.length} Datei(en) gelesen, kein Server eingetragen.`, wo: "Dieser Rechner.", evidence: [evidence("Konfig-Dateien gelesen", { cmd: "JSON.parse", line: found[0] })] });
    return result({ id, title, verdict: worst, was: worst === SAFE ? (m.ok || "Keine auffälligen Rechte in den Agent-Konfigurationen.") : (m.bad || "Ein Agent hat mehr Rechte, als er braucht."), wie: worst === SAFE ? (m.ok_how || `${servers} Server geprüft; die Zeilen sagen, was jeder kann.`) : (m.bad_how || "Die Zeilen nennen Server, Fähigkeit und was auffällt — Werte zeigt Dante nie."), wo: "Dieser Rechner.", evidence: ev,
      fix: worst === SAFE ? null : { why: "Nur die Rechte lassen, die der Agent wirklich braucht; Schlüssel nicht in die Datei schreiben, sondern als Umgebungsvariable setzen.", steps: [{ desc: "Konfig-Datei ansehen (nur lesen)", script: `ls -l '${found[0].replace(/'/g, "'\\''")}'` }] } });
  } };
}
