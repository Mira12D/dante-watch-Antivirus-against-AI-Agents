// Reads and writes ~/.dante/user.md, a Markdown file the user may edit. Only "- key: value" lines and
// "## Section" headings are parsed; anything else is kept untouched.
//
//   # Dante · user
//   - name: Alex
//   - sprache: de
//   - angelegt: 2026-10-26
//   - aktualisiert: 2026-10-26
//   ## Server
//   - web: root@203.0.113.10 · key ~/.ssh/id_ed25519 · Ubuntu 26.04 · patrouille: ja
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
  for (const s of u.servers || []) out.push(`- ${clean(s.alias)}: ${clean(s.target)} · key ${clean(s.key) || "-"} · ${clean(s.os) || "?"} · patrouille: ${s.patrol ? "ja" : "nein"}`);
  out.push("", "## Projekte");
  for (const p of u.projects || []) out.push(`- ${clean(p)}`);
  out.push("", "## Patrouille");
  kv("scharf", u.patrol && u.patrol.armed ? "ja" : "nein");
  kv("zeiten", (u.patrol && u.patrol.times || []).join(", "));
  kv("seit", u.patrol && u.patrol.since);
  return out.join("\n") + "\n";
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
      const parts = m[2].split(" · ").map((x) => x.trim());
      const key = (parts[1] || "").replace(/^key\s+/, "");
      // the system text may itself contain " · " (e.g. "Ubuntu 26.04 · PHP 8.3"): the patrol flag is always the last part
      const flag = parts.length > 3 && /^patrouille:/i.test(parts[parts.length - 1]) ? parts.pop() : "";
      const os = parts.slice(2).join(" · ");
      u.servers.push({ alias: m[1].trim(), target: parts[0] || "", key: key === "-" ? "" : key, os: os === "?" ? "" : os, patrol: /patrouille:\s*ja/i.test(flag) });
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
