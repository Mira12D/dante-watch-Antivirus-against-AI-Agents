import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wantsKeyFind, wantsHostKeyLook, keyFiles, keysFlow, fingerprintExec, agentLines } from "./keys.mjs";
import { wantsAllSystems } from "./sysq.mjs";
import { wantsServerList } from "./servers.mjs";
import { mt } from "./texts.mjs";
import { setLang } from "../i18n.mjs";

test("'finde den schlüssel einfach' will die Schlüssel sehen, der Befehl 'key <pfad>' bleibt ein Befehl", () => {
  for (const l of ["finde den schlüssel einfach", "welche schlüssel habe ich", "zeig mir meine ssh keys", "which ssh key do i use", "where is my key", "busca mi llave", "dónde está mi clave"]) assert.equal(wantsKeyFind(l), true, l);
  for (const l of ["key ~/.ssh/deploy_key", "key /pfad/zu/key", "der schlüssel hat sich geändert", "the host key changed", "hi", "prüfe meinen server"]) assert.equal(wantsKeyFind(l), false, l);
  assert.equal(wantsHostKeyLook("finde den schlüssel einfach"), true);
});
test("'welche systeme habe ich' meint alle Systeme, nicht nur das eine", () => {
  for (const l of ["welche systeme habe ich", "welche rechner habe ich", "which systems do i have", "qué sistemas tengo", "cuáles son mis equipos"]) { assert.equal(wantsAllSystems(l, false), true, l); assert.equal(wantsServerList(l, false), false, l); }
  for (const l of ["was ist mein system", "welches system läuft hier", "welche server habe ich"]) assert.equal(wantsAllSystems(l, false), false, l);
});
test("Schlüssel: Namen, Fingerabdrücke und welcher zu welchem Server gehört, nie der Inhalt", async () => {
  setLang("de");
  const home = mkdtempSync(join(tmpdir(), "dante-keys-")); mkdirSync(join(home, ".ssh"));
  for (const f of ["id_ed25519", "id_ed25519.pub", "deploy_key", "known_hosts", "config", "notes.txt"]) writeFileSync(join(home, ".ssh", f), "GEHEIMER INHALT");
  assert.deepEqual(keyFiles(home), ["deploy_key", "id_ed25519"]);
  const said = [];
  await keysFlow({ mt, say: (l) => said.push(l), local: async (c) => ({ out: /ssh-keygen/.test(c) ? "256 SHA256:abc123 user@host (ED25519)" : /ssh-add/.test(c) ? "256 SHA256:abc123 user@host (ED25519)" : "", ok: true }) },
    { servers: [{ alias: "web", target: "root@203.0.113.10", key: "~/.ssh/deploy_key" }, { alias: "db", target: "root@203.0.113.11", key: "" }] }, { home });
  const t = said.join("\n");
  assert.match(t, /~\/\.ssh\/deploy_key - ED25519 SHA256:abc123/); assert.match(t, /web \(root@203\.0\.113\.10\) -> ~\/\.ssh\/deploy_key/); assert.match(t, /Für db kenne ich keinen Schlüssel/); assert.match(t, /ssh-Agenten stecken 1 Schlüssel/);
  assert.ok(!t.includes("GEHEIMER INHALT"));
  rmSync(home, { recursive: true, force: true });
});

test("exec-Weg: ssh-keygen -lf und ssh-add -l ohne Shell, Datei als EIN Argument", async () => {
  const calls = [];
  const exec = (c, a) => { calls.push([c, a]); return { out: c === "ssh-add" ? "256 SHA256:abc user (ED25519)\nThe agent has no identities." : "256 SHA256:abc123 user@host (ED25519)\nsecond", ok: true }; };
  assert.deepEqual(fingerprintExec("/h/my key;x/id.pub", exec), { bits: 256, fp: "SHA256:abc123", type: "ED25519" });
  assert.deepEqual(calls[0], ["ssh-keygen", ["-lf", "/h/my key;x/id.pub"]]);
  assert.equal(fingerprintExec("-evil", exec), null); assert.equal(calls.length, 1);
  assert.equal(agentLines(exec).length, 1); assert.deepEqual(calls[1], ["ssh-add", ["-l"]]);
  const home = mkdtempSync(join(tmpdir(), "dk-")); mkdirSync(join(home, ".ssh"));
  writeFileSync(join(home, ".ssh", "id_ed25519"), "x"); writeFileSync(join(home, ".ssh", "id_ed25519.pub"), "y");
  const said = [];
  try { setLang("en"); await keysFlow({ mt, say: (l) => said.push(l), exec, local: async () => { throw new Error("shell used"); } }, { servers: [] }, { home }); } finally { rmSync(home, { recursive: true, force: true }); }
  assert.ok(said.some((l) => l.includes("SHA256:abc123")));
});
