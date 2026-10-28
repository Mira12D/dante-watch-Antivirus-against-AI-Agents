// Reads and writes ~/.dante/user.md, a Markdown file the user may edit. Only "- key: value" lines and
// "## Section" headings are parsed; anything else is kept untouched.
//
//   # Dante · user
//   - name: Alex
//   - sprache: de
//   - angelegt: 2026-10-26
//   - aktualisiert: 2026-10-26
//   ## Server
//   - web: root@203.0.113.10 · key ~/.ssh/id_ed25519 · Ubuntu 26.04 · patrouille: ja · rolle: Kasse (du) · gesehen: nginx, Postgres (2026-10-28)
//
// A server line carries four things that come from four different places, and they are never mixed:
//   os        what the box reported (system name)
//   role      what the PERSON called it ("the till", "the proxy") - always marked (du)/(you)/(tú)
//   what      what Dante really found running there - only facts, with the day he saw them
//   key       the key file, with "(geprüft)" only if a real login with it worked
// A role is never derived from what runs there. "nginx + Postgres" is not "the till".
//   ## Projekte
//   - my-project
//   ## Patrouille
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { userFile } from "./home.mjs";
import { mkdirOwned, writeOwned } from "../core/perm.mjs";

export const exists = () => existsSync(userFile());

const clean = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();

export function serialize(u) {
  const out = ["# Dante · user", "",
    "Dante schreibt diese Datei und liest sie beim Start. Du darfst sie ändern. · Dante writes this file and reads it at every start. You may change it.", ""];
  const kv = (k, v) => { if (v !== undefined && v !== null && clean(v) !== "") out.push(`- ${k}: ${clean(v)}`); };
  kv("name", u.name); kv("sprache", u.lang); kv("angelegt", u.created); kv("aktualisiert", u.updated); kv("erinnert", u.reminded); kv("system", u.system);
  out.push("", "## Server");
  for (const s of u.servers || []) out.push(serverLine(s));
  out.push("", "## Projekte");
  for (const p of u.projects || []) out.push(`- ${clean(p)}`);
  out.push("", "## Patrouille");
  kv("scharf", u.patrol && u.patrol.armed ? "ja" : "nein");
  kv("zeiten", (u.patrol && u.patrol.times || []).join(", "));
  kv("seit", u.patrol && u.patrol.since);
  return out.join("\n") + "\n";
}

// one server as one line: alias: target · key X · OS · patrouille: ja · rolle: Y (du) · gesehen: Z (tag) · schlüssel: geprüft
export function serverLine(s) {
  const parts = [clean(s.target), `key ${clean(s.key) || "-"}`, clean(s.os) || "?", `patrouille: ${s.patrol ? "ja" : "nein"}`];
  if (clean(s.role)) parts.push(`rolle: ${clean(s.role)} (du)`);
  if (clean(s.what)) parts.push(`gesehen: ${clean(s.what)}${s.seen ? ` (${clean(s.seen)})` : ""}`);
  if (s.keyChecked) parts.push("schlüssel: geprüft");
  return `- ${clean(s.alias)}: ${parts.join(" · ")}`;
}

// the fields a server line may carry after the system text; everything else stays part of the system text
const FIELD = /^(rolle|role|papel|gesehen|seen|visto|schlüssel|schluessel|key-check|keycheck)\s*:\s*(.*)$/i;

/** one "## Server" line -> a server object. The patrol flag is found by its own prefix, never by "last part". */
export function parseServerLine(alias, rest) {
  const raw = String(rest).split(" · ").map((x) => x.trim());
  const target = raw[0] || "", osParts = [], fields = {};
  let key = "", patrol = false;
  for (const p of raw.slice(1)) {
    const f = FIELD.exec(p);
    if (f) { fields[f[1].toLowerCase()] = f[2].trim(); continue; }
    if (/^key\s+/i.test(p)) { const k = p.replace(/^key\s+/i, "").trim(); key = k === "-" ? "" : k; continue; }
    if (/^patrouille\s*:/i.test(p)) { patrol = /ja|yes|s[ií]/i.test(p.split(":")[1] || ""); continue; }
    osParts.push(p);
  }
  const os = osParts.join(" · "), role = fields.rolle || fields.role || fields.papel || "";
  const seenRaw = fields.gesehen || fields.seen || fields.visto || "";
  const m = /^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)$/.exec(seenRaw);
  const out = { alias: clean(alias), target, key, os: os === "?" ? "" : os, patrol };
  if (role) { out.role = role.replace(/\s*\((?:du|you|tú|tu)\)$/i, "").trim(); out.roleBy = "user"; }
  if (seenRaw) { out.what = (m ? m[1] : seenRaw).trim(); if (m) out.seen = m[2]; }
  const kc = fields["schlüssel"] || fields["schluessel"] || fields["key-check"] || fields["keycheck"] || "";
  if (/^(geprüft|geprueft|ok|verified|comprobado)/i.test(kc)) out.keyChecked = true;
  return out;
}

export function parse(text) {
  const u = { servers: [], projects: [], patrol: { armed: false, times: [], since: "" } };
  let section = "";
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    const h = /^##\s+(.+)$/.exec(line);
    if (h) { section = h[1].trim().toLowerCase(); continue; }
    const m = /^-\s+([^:]+?):\s*(.*)$/.exec(line), item = /^-\s+(.+)$/.exec(line);
    if (!section && m) {
      const [, k, v] = m;
      if (k === "name") u.name = v; else if (k === "sprache") u.lang = v; else if (k === "angelegt") u.created = v; else if (k === "aktualisiert") u.updated = v; else if (k === "erinnert") u.reminded = v; else if (k === "system") u.system = v;
    } else if (section === "server" && m) {
      u.servers.push(parseServerLine(m[1], m[2]));
    } else if (section === "projekte" && item) u.projects.push(item[1].trim());
    else if (section === "patrouille" && m) {
      if (m[1] === "scharf") u.patrol.armed = /^ja/i.test(m[2]);
      else if (m[1] === "zeiten") u.patrol.times = m[2].split(",").map((x) => x.trim()).filter(Boolean);
      else if (m[1] === "seit") u.patrol.since = m[2];
    }
  }
  return u;
}

export function read() { try { return parse(readFileSync(userFile(), "utf8")); } catch { return null; } }
export function write(u) {
  mkdirOwned(dirname(userFile()));
  writeOwned(userFile(), serialize(u));
}
