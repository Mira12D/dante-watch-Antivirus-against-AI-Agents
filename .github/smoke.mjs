// Runs the real Dante once in a throw-away home: each answer is typed when he has gone quiet, like a person would. Fails only if he crashes.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const home = mkdtempSync(join(tmpdir(), "dante-smoke-"));
const lines = ["nein", "hilfe", "was ist mein system", "was ist los", "prüfe meinen rechner", "raus"];
const c = spawn(process.execPath, ["src/cli.mjs"], { env: { ...process.env, DANTE_HOME: home, DANTE_SESSION: "1", DANTE_NO_NUDGE: "1", NO_COLOR: "1" }, stdio: ["pipe", "pipe", "pipe"] });
let text = "", last = Date.now(), i = 0, exited = null;
const feed = (d) => { text += d; last = Date.now(); };
c.stdout.on("data", feed); c.stderr.on("data", feed);
c.on("close", (code, sig) => { exited = { code, sig }; });
const t0 = Date.now();
const timer = setInterval(() => {
  const quiet = Date.now() - last, ready = /user ❯\s*$/.test(text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ""));
  if (exited || Date.now() - t0 > 240000) { clearInterval(timer); finish(); return; }
  if (i < lines.length && ready && quiet > 1200) { c.stdin.write(lines[i++] + "\n"); }   // only when he asks, like a person - a line typed earlier would be lost
  else if (i >= lines.length && quiet > 90000) { c.kill(); }
  else if (quiet > 180000) { c.kill(); }
}, 400);
function finish() {
  const clean = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
  console.log(clean.slice(0, 30000));
  console.log("typed:", i, "of", lines.length, "exit:", JSON.stringify(exited));
  if (/(TypeError|ReferenceError|SyntaxError|Cannot find module|ERR_[A-Z_]+)/.test(clean) || (exited && exited.code && exited.code !== 0)) { console.error("SMOKE FAILED"); process.exit(1); }
  process.exit(0);
}
