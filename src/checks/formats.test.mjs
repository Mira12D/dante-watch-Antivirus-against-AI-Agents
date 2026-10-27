import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { formatsCheck, routeSystems } from "./formats.mjs";
import { BUILTIN } from "../pack/builtin.mjs";
import { validateRules, missingTexts } from "../pack/rules.mjs";
import { write as writeUser } from "../me/user.mjs";
import { setLang } from "../i18n.mjs";

const RULE = BUILTIN.rules.find((r) => r.id === "codegeheimnisse");
const KEY = "AKIAJ3KQ9XNLPW7TRVZB";        // a made-up key of the right shape (no placeholder words in it)
const git = (dir, ...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });

function scene(fn) {
  setLang("de");
  const home = mkdtempSync(join(tmpdir(), "dante-fm-h-")), proj = mkdtempSync(join(tmpdir(), "dante-fm-p-")), old = process.env.DANTE_HOME;
  process.env.DANTE_HOME = home;
  writeUser({ name: "t", lang: "de", created: "2026-01-01", updated: "2026-01-01", system: "x", servers: [], projects: [proj], patrol: { armed: false, times: [], since: "" } });
  try { return fn(proj); } finally { if (old === undefined) delete process.env.DANTE_HOME; else process.env.DANTE_HOME = old; rmSync(home, { recursive: true, force: true }); rmSync(proj, { recursive: true, force: true }); }
}

test("die eingebaute Regel ist gültig und in drei Sprachen erklärbar", () => {
  assert.equal(validateRules([RULE]), null);
  assert.equal(missingTexts([RULE], BUILTIN.know), null);
  assert.equal(RULE.deep, true);
});

test("ungültige Formate werden abgelehnt", () => {
  const bad = (f) => validateRules([{ ...RULE, formats: [{ id: "x", name: "n", system: "generic", re: "AKIA[0-9A-Z]{16}", ...f }] }]);
  assert.equal(bad({}), null);
  assert.match(bad({ re: "a.*b" }), /re/);              // no literal run of 4
  assert.match(bad({ re: "(AKIA)[0-9]{9}\\1" }), /re/);  // back-reference
  assert.match(bad({ system: "windows" }), /system/);
  assert.match(bad({ id: "Böse Id" }), /id/);
});

test("Router: findet package.json und composer.json", () => scene((proj) => {
  mkdirSync(join(proj, "a")); writeFileSync(join(proj, "a", "package.json"), "{}");
  mkdirSync(join(proj, "b")); writeFileSync(join(proj, "b", "composer.json"), "{}");
  const r = routeSystems([proj]);
  assert.ok(r.systems.includes("node") && r.systems.includes("php") && r.systems.includes("generic"));
  assert.ok(!r.systems.includes("go"));
}));

test("Schlüssel im Git: RISK, mit Datei und Zeile, ohne den Wert", () => scene((proj) => {
  git(proj, "init", "-q"); git(proj, "config", "user.email", "t@t"); git(proj, "config", "user.name", "t");
  writeFileSync(join(proj, "config.js"), `// x\nconst k = "${KEY}";\n`);
  git(proj, "add", "."); git(proj, "commit", "-qm", "x");
  const r = formatsCheck(RULE).run();
  assert.equal(r.verdict, "risk");
  const text = JSON.stringify(r);
  assert.ok(text.includes("config.js:2"), "Datei:Zeile");
  assert.ok(text.includes("im Git eingecheckt"));
  assert.ok(!text.includes(KEY), "der Wert darf nie auftauchen");
  assert.ok(r.fix && r.fix.steps.length);
}));

test("lokale .env: privat und git-ignoriert = normal (SAFE)", () => scene((proj) => {
  git(proj, "init", "-q");
  writeFileSync(join(proj, ".gitignore"), ".env\n");
  writeFileSync(join(proj, ".env"), `KEY=${KEY}\n`); chmodSync(join(proj, ".env"), 0o600);
  const r = formatsCheck(RULE).run();
  assert.equal(r.verdict, "safe");
  assert.ok(r.evidence.some((e) => /ignoriert/.test(e.claim)));
  assert.ok(!JSON.stringify(r).includes(KEY));
}));

test("nicht ignoriert und für alle lesbar: Hinweis (WARN) mit chmod-Schritt", { skip: process.platform === "win32" }, () => scene((proj) => {
  git(proj, "init", "-q");
  writeFileSync(join(proj, "cfg.txt"), `token ${KEY}\n`); chmodSync(join(proj, "cfg.txt"), 0o644);
  const r = formatsCheck(RULE).run();
  assert.equal(r.verdict, "warn");
  assert.ok(r.fix.steps.some((s) => /chmod go-rwx/.test(s.script)));
}));

test("sauberer Ordner: SAFE mit der echten Zeile, wo gesucht wurde", () => scene((proj) => {
  writeFileSync(join(proj, "a.js"), "console.log('hi')\n");
  const r = formatsCheck(RULE).run();
  assert.equal(r.verdict, "safe");
  assert.ok(r.evidence.some((e) => e.grounded && /keine Treffer/.test(e.line)));
}));

test("Vorlagen und Platzhalter sind keine Geheimnisse (auch wenn sie eingecheckt sind)", () => scene((proj) => {
  git(proj, "init", "-q"); git(proj, "config", "user.email", "t@t"); git(proj, "config", "user.name", "t");
  writeFileSync(join(proj, ".env.example"), `AWS=${KEY}\n`);
  writeFileSync(join(proj, "README.txt"), "Set AKIAXXXXXXXXXXXXXXXX in your env\n");
  git(proj, "add", "."); git(proj, "commit", "-qm", "x");
  const r = formatsCheck(RULE).run();
  assert.equal(r.verdict, "safe");
}));
