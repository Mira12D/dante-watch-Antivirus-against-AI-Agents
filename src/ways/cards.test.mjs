import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wayCard, wayCards, WAY_IDS } from "./cards.mjs";

const IDS = ["listen-open", "listen-loopback", "persist-cron", "persist-systemd-timer", "persist-launchd", "persist-login-item",
  "persist-run-key", "persist-scheduled-task", "persist-startup-folder", "persist-authorized-keys", "mail-open", "mail-local-mta",
  "stale-files", "account-guest", "account-remote-login", "account-extra-admin"];
// the OS each way has to cover (an "all" card covers every OS)
const NEED = {
  "listen-open": ["mac", "linux", "windows"], "listen-loopback": ["mac", "linux", "windows"],
  "persist-cron": ["mac", "linux"], "persist-systemd-timer": ["linux"], "persist-launchd": ["mac"], "persist-login-item": ["mac"],
  "persist-run-key": ["windows"], "persist-scheduled-task": ["windows"], "persist-startup-folder": ["windows"],
  "persist-authorized-keys": ["mac", "linux", "windows"], "mail-open": ["mac", "linux", "windows"], "mail-local-mta": ["linux"],
  "stale-files": ["mac", "linux", "windows"], "account-guest": ["mac", "windows"], "account-remote-login": ["mac", "linux", "windows"],
  "account-extra-admin": ["mac", "linux", "windows"],
};

test("die Datei ist gültiges JSON und alle Wege sind da", () => {
  assert.doesNotThrow(() => JSON.parse(readFileSync(new URL("../bib/ways.json", import.meta.url), "utf8")));
  assert.deepEqual([...WAY_IDS].sort(), [...IDS].sort());
});

test("jeder Weg hat Karten für die Systeme, die er beansprucht", () => {
  for (const id of IDS) for (const os of NEED[id]) assert.ok(wayCard(id, os), `${id} / ${os}`);
});

test("wayCard: erst die OS-Karte, sonst all, sonst null", () => {
  assert.equal(wayCard("persist-cron", "linux").os, "linux");
  assert.equal(wayCard("listen-loopback", "mac").os, "all");
  assert.equal(wayCard("persist-launchd", "windows"), null);
  assert.equal(wayCard("gibt-es-nicht", "mac"), null);
});

test("jede Karte hat de/en/es mit what/why/normal/redflag, nichts leer", () => {
  for (const c of wayCards()) {
    assert.ok(["mac", "linux", "windows", "all"].includes(c.os), c.id);
    assert.ok(Array.isArray(c.aliases) && c.aliases.every((a) => typeof a === "string" && a.trim()), c.id);
    for (const l of ["de", "en", "es"]) for (const k of ["title", "what", "why", "normal", "redflag"]) {
      assert.equal(typeof c[l]?.[k], "string", `${c.id}/${c.os} ${l}.${k}`);
      assert.ok(c[l][k].trim().length > 0, `${c.id}/${c.os} ${l}.${k} leer`);
    }
    if (c.source !== undefined) assert.ok(typeof c.source === "string" && c.source.trim(), c.id);
  }
});

test("fix: Befehle sind Text, jeder mit Hinweis in drei Sprachen", () => {
  for (const c of wayCards()) {
    assert.ok(Array.isArray(c.fix) && c.fix.length > 0, `${c.id}/${c.os} fix`);
    for (const x of c.fix) for (const k of ["cmd", "de", "en", "es"]) {
      assert.equal(typeof x[k], "string", `${c.id}/${c.os} fix.${k}`);
      assert.ok(x[k].trim(), `${c.id}/${c.os} fix.${k} leer`);
    }
  }
});

test("kein Freispruch: nie sicher / safe / seguro als Urteil", () => {
  const text = JSON.stringify(wayCards()).toLowerCase();
  for (const w of ["sicher", "safe", "seguro"]) assert.ok(!text.includes(w), w);
});
