// Dante's side of the Wachschutz. Dante gives ITSELF a long random identity on first use — no server counter, so two
// never collide. The id and a private secret live in ~/.dante/guard.json; the secret never leaves the machine and
// never goes in a URL. The server is reached only when the user starts it (enrol / lay a bait) — shown as a curl, run
// after a yes — never on its own. The activation token the web page hands back is verified OFFLINE here, so Dante
// knows its own status (active until when) without ever phoning home to ask.
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { verifyToken } from "./token.mjs";

const rid = () => randomBytes(16).toString("base64url");
// same cosmetic short name the server shows (SHA-256 of the id), so the terminal and the mail agree
export const labelOf = (id) => "dante-" + (parseInt(createHash("sha256").update(String(id)).digest("hex").slice(0, 8), 16) % 10000).toString().padStart(4, "0");

export function loadGuard(file) { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; } }
export function identity(file) {
  const g = loadGuard(file);
  if (g.id && g.secret) return g;
  const n = { ...g, id: rid(), secret: rid() };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(n), { mode: 0o600 });
  return n;
}
// The page gives back a signed token. Keep it only if it verifies AND is for this Dante (a token for someone else, or
// a made-up one, changes nothing — so the nagging cannot be switched off with a fake).
export function saveToken(file, token) {
  const g = identity(file);
  const v = verifyToken(token);
  if (!v || v.id !== g.id) return null;
  writeFileSync(file, JSON.stringify({ ...g, token }), { mode: 0o600 });
  return { until: v.until };
}
export function guardStatus(file, now = Date.now()) {
  const g = loadGuard(file);
  if (!g.id) return { enrolled: false };
  const v = g.token ? verifyToken(g.token) : null;
  const active = !!(v && v.id === g.id && v.until > now);
  return { enrolled: true, id: g.id, label: labelOf(g.id), active, until: v ? v.until : 0, days_left: active ? Math.ceil((v.until - now) / 86400000) : 0 };
}

// ---- the curls the session shows and runs after a yes (never silently) --------------------------
export const enrollArgs = (base, id, secret) => ["-sS", "--max-time", "15", "-X", "POST", "-H", "content-type: application/json", "-d", JSON.stringify({ id, secret }), base.replace(/\/$/, "") + "/guard/hello"];
export const decoyArgs = (base, id, secret, label, kind) => ["-sS", "--max-time", "15", "-X", "POST", "-H", "content-type: application/json", "-d", JSON.stringify({ id, secret, label, kind }), base.replace(/\/$/, "") + "/api/guard/decoy"];
export function parseJson(out) { try { return JSON.parse(out); } catch { return null; } }

// ---- bait patterns: files attackers and rogue agents reach for; the trip URL is the part their tooling calls -----
// Each returns { name, content }. The name is a tempting filename; Dante writes it only where it will not overwrite
// something real. The embedded URL is the honeytoken: reading the file is not enough, USING the endpoint rings home.
export const DECOY_KINDS = {
  env: {
    label: ".env.production",
    file: () => ".env.production",
    body: (url) => `# production — do not commit\nNODE_ENV=production\nDATABASE_URL=postgresql://app:Qf3kZ9m2@10.0.3.12:5432/app_prod\nSESSION_SECRET=4e9b1c7a8f2d6054b3119ace77d20fb1\nINTERNAL_API=${url}\nINTERNAL_API_TOKEN=live_7Hn2pQ8rLxA0vZ\n`,
  },
  mcp: {
    label: "mcp.json (KI-Agent-Konfig)",
    file: () => "mcp.json",
    body: (url) => `{\n  "mcpServers": {\n    "internal-tools": {\n      "url": "${url}",\n      "headers": { "authorization": "Bearer mcp_live_0b9a7c" }\n    }\n  }\n}\n`,
  },
  npm: {
    label: ".npmrc (npm-Token)",
    file: () => ".npmrc",
    body: (url) => `//api.nm-streetwear.space/:_authToken=npm_3kQ9fZ2aL7xV0\nregistry=${url}/\n`,
  },
  aws: {
    label: "aws-credentials",
    file: () => "aws-credentials",
    body: (url) => `[default]\naws_access_key_id=AKIA7HN2PQ8RLXA0VZ31\naws_secret_access_key=Qf3kZ9m2a8F2d6054b3119ace77d20fbvZ7Hn2\n# endpoint override (staging mirror)\nendpoint_url=${url}\n`,
  },
};
export function decoyFile(kind, tripUrl, dir) {
  const k = DECOY_KINDS[kind]; if (!k) return null;
  const name = k.file(), path = join(dir, name);
  return { kind, path, name, exists: existsSync(path), content: k.body(tripUrl) };
}

// The daily nudge decision: never when the watch is active, at most once a day, and then only sometimes (the roll).
// The date is written whenever we check, so it stays at most once a day regardless of the roll.
export function maybeNudge(file, today, roll = Math.random()) {
  const g = loadGuard(file);
  if (guardStatus(file).active) return false;
  if (g.nudged === today) return false;
  try { writeFileSync(file, JSON.stringify({ ...g, nudged: today }), { mode: 0o600 }); } catch { /* ok */ }
  return roll < 0.7;
}
