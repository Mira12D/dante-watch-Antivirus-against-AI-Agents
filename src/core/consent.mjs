// Confirmation before any change: show the plan and the exact commands, then wait for a yes.
// A per-check trust counter offers automatic mode after five confirmations; it lives in
// ~/.dante/trust.json.
import { createInterface } from "node:readline/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { t } from "../i18n.mjs";
import { tx } from "../i18n-checks.mjs";

const DIR = join(homedir(), ".dante");
const FILE = join(DIR, "trust.json");

function load() { try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return {}; } }
function save(d) { try { mkdirSync(DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(d, null, 1)); } catch { /* best effort */ } }

export function automodeFor(id) {
  const d = load();
  return d[id] && d[id].automode === true;
}

// Only a clean yes is a yes. "ja aber erst morgen", "jein", "ja?" are not - when in doubt, nothing
// changes. (Before: anything starting with "j" counted, so "ja aber nicht jetzt" ran the fix.)
const YES = /^(ja|j|jo|jap|jawohl|ja bitte|ja mach|yes|y|yep|yes please|yeah|sure|si|sí|claro|dale|ok|okay|mach|mach es|los|go)[.!]*$/;
const ALWAYS = /^(a|automode|immer|always|siempre)[.!]*$/;
const YES_START = /^(ja|jo|jap|jawohl|yes|yep|yeah|sure|si|sí|claro|dale|adelante|ok|okay|mach|los|go)\b/;
const NO = /^(nein|n|no|nö|nee|stop|halt)\b/;
let lastRaw = "";
export function hear(raw) {
  lastRaw = String(raw).trim().toLowerCase();
  if (ALWAYS.test(lastRaw)) return "always";
  if (YES.test(lastRaw)) return "yes";
  return "no";
}

/** Returns "yes" | "no" | "always". In --yes mode: auto-yes. Honours earned automode. */
export async function ask(id, question, { yes = false, plan = null, rl: shared = null } = {}) {
  if (yes || automodeFor(id)) return "yes";
  // Inside the session there is already one reader on stdin; a second one doubles every key
  // and, once closed, leaves the session deaf. So borrow it when given, own one only when alone.
  const rl = shared || createInterface({ input: process.stdin, output: process.stdout });
  const dim = (t) => console.log("  \x1b[2m" + t + "\x1b[0m");
  let answer = "no";
  try {
    // The consent ear may explain, delay or refuse - it can never say yes. Yes is typed, cleanly.
    for (let round = 0; round < 4; round++) {
      answer = hear(await rl.question(question));
      if (answer !== "no" || NO.test(lastRaw)) break;
      const { hearConsent } = await import("../bib/ear.mjs");
      const meant = hearConsent(lastRaw).intent;
      // A long yes ("ja ohne wenn und aber", "Sí. apt upgrade ...") is not run - it is asked back.
      if (YES_START.test(lastRaw) && meant !== "nein") { dim(t("sayClean")); continue; }
      if (meant === "spaeter") { dim(t("later")); break; }
      // "what does it do" and "is it dangerous" overlap (measured: most yes/no mix-ups) - both get both.
      if ((meant === "was_macht" || meant === "gefahr") && plan) {
        plan.steps.forEach((s, i) => dim(`${i + 1}) ${tx(s.desc)} — ${t("stepIs")} ${s.script}`));
        dim(plan.risk || t("danger")(plan.steps.length));
        continue;
      }
      if (meant === "automode") { dim(t("always")); continue; }
      dim(t("asNo"));
      break;
    }
  } finally { if (!shared) rl.close(); }
  return answer;
}

/** Record a yes; after 5, offer automode. Returns true if automode was just granted. */
export async function recordYes(id, { yes = false, rl = null } = {}) {
  const d = load();
  const e = d[id] || (d[id] = { yes: 0, automode: false });
  e.yes = (e.yes || 0) + 1;
  save(d);
  if (!e.automode && e.yes >= 5 && !yes && !automodeFor(id)) {
    const a = await ask(id + ":automode-offer", "  Du hast für „" + id + "“ schon " + e.yes + "× ja gesagt. Künftig ohne Nachfrage (Automode)? [ja/nein] ", { rl });
    if (a === "yes" || a === "always") { e.automode = true; save(d); return true; }
  }
  return false;
}

export function grantAutomode(id) { const d = load(); d[id] = Object.assign(d[id] || { yes: 0 }, { automode: true }); save(d); }
