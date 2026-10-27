#!/usr/bin/env node
// Command line entry: flags, one-shot checks and the interactive session.
import { configureTarget, targetLabel, probe, run, firstLine } from "./core/sh.mjs";
import { renderResult, renderSummary } from "./core/render.mjs";
import { RISK, WARN, SAFE, UNKNOWN } from "./core/check.mjs";
import { ask, recordYes } from "./core/consent.mjs";
import { banner } from "./mascot.mjs";
import { activeBattery } from "./checks/battery.mjs";
import { demo } from "./checks/demo.mjs";
import { staleLine, VERSION, BIB_DATE } from "./ticker.mjs";
import { lang, t, initLang } from "./i18n.mjs";
import { tx } from "./i18n-checks.mjs";

function parseArgs(argv) {
  const a = { ssh: null, key: null, json: false, yes: false, fix: false, demo: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--ssh") a.ssh = argv[++i];
    else if (t === "--key") a.key = argv[++i];
    else if (t === "--json") a.json = true;
    else if (t === "--yes" || t === "-y") a.yes = true;
    else if (t === "--fix") a.fix = true;
    else if (t === "--demo") a.demo = true;
    else if (t === "--help" || t === "-h") a.help = true;
    else if (t === "--version" || t === "-v") a.version = true;
    else if (t === "--patrol") a.patrol = true;
    else if (t === "--deep") a.deep = true;
  }
  return a;
}

const HELP = `Dante — wächter

  npx dante-watch                 prüft diesen Rechner (nur schauen)
  npx dante-watch --ssh user@host [--key /pfad]   prüft einen Server, der dir gehört
  --fix        bei einem Fund: Plan zeigen und nach deinem Ja schließen
  --demo       harmlose Übung: zeigt die ganze Schleife (human → plan → ja/nein → fix → Beweis)
  --patrol     eine Patrouille (das startet der Zeitplan): prüft, schreibt das Tagebuch, ändert nichts
  --deep       ein Tiefenlauf (wöchentlich, startet der Zeitplan): liest Projektordner nach Schlüsseln, bohrt bei Treffern nach
  --version    welche Version läuft
  --json       Maschinen-Ausgabe
  -y, --yes    nicht nachfragen (für Automode/Cron)

Dante ändert nichts ohne dein Ja. Jedes Urteil trägt die echte Zeile; fehlt sie, sagt er „unbekannt“, nie „sicher“.`;

const C = (code, s) => (process.stdout.isTTY && !process.env.NO_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);

async function handleFinding(check, r, a) {
  // "Human, hör zu" - foreground, plan in words + exact commands, then ja/nein, then re-prove.
  console.log("\n" + C("41;37", t("listen")) + " " + C("1", tx(r.title)));
  console.log("  " + C("2", t("what")) + " " + tx(r.was));
  console.log("  " + C("2", t("how")) + " " + tx(r.wie));
  console.log("  " + C("36", t("plan")) + " " + tx(r.fix.why));
  r.fix.steps.forEach((s, i) => {
    console.log("    " + (i + 1) + ") " + tx(s.desc));
    console.log("       " + C("2", "$ " + s.script));
  });
  // On a real risk, Dante tells you to distrust it : check against another AI.
  console.log("  " + C("33", t("distrust")));

  const answer = await ask(check.id, t("run"), { yes: a.yes, plan: r.fix });
  if (answer === "no") { console.log("  " + C("2", t("nothing"))); return r.verdict; }
  if (answer === "always") { await recordYes(check.id, { yes: true }); const { grantAutomode } = await import("./core/consent.mjs"); grantAutomode(check.id); }

  for (const s of r.fix.steps) {
    const res = run(s.script, { timeout: 120000 });
    const line = firstLine(res.out || res.err) || (res.ok ? "(ok)" : "(fehler)");
    console.log("  " + (res.ok ? C("32", "✓") : C("31", "✗")) + " " + tx(s.desc) + "  " + C("2", "→ " + line));
    if (!res.ok) { console.log("  " + C("31", t("failed"))); return r.verdict; }
  }
  if (answer === "yes") await recordYes(check.id, { yes: a.yes });

  // Re-prove: run the same check again and show the new, real verdict.
  const after = check.run();
  console.log("  " + C("2", t("recheck")));
  console.log(renderResult(after).split("\n").map((l) => "  " + l).join("\n"));
  if (after.verdict === SAFE) console.log("  " + C("42;30", t("closed")) + C("2", t("closedSub")));
  else console.log("  " + C("33", t("notYet")));
  return after.verdict;
}

async function main() {
  initLang();
  const a = parseArgs(process.argv.slice(2));
  if (a.help) { console.log(HELP); return; }
  if (a.deep) { const { deep } = await import("./me/deep.mjs"); process.exit(await deep()); }
  if (a.patrol) { const { patrol } = await import("./me/patrol.mjs"); process.exit(await patrol()); }   // what the schedule starts: no screen, only the diary and the log
  if (a.version) { console.log("dante-watch " + VERSION + " · bib " + BIB_DATE); return; }

  // No flags + a real terminal -> the face: summon, greet, arm, talk, stay open.
  // Flags or a pipe -> one-shot (for cron / --json / automode).
  const bare = process.argv.slice(2).length === 0;
  // DANTE_SESSION=1 runs the chat over pipes (tests and the lab: a person is simulated on the other end)
  if (bare && ((process.stdin.isTTY && process.stdout.isTTY) || process.env.DANTE_SESSION === "1")) {
    const { session } = await import("./session.mjs");
    await session();
    return;
  }

  configureTarget(a.ssh ? { host: a.ssh, key: a.key } : null);
  const target = targetLabel();

  const ch = probe();
  if (!ch.reached) {
    const r = { id: "channel", title: "Kanal zum Ziel", verdict: UNKNOWN, was: "Dante konnte " + target + " nicht sehen.", wie: ch.line, wo: target, evidence: [] };
    if (a.json) console.log(JSON.stringify({ target, results: [r] }, null, 2));
    else { console.log(banner()); console.log(renderResult(r)); console.log(renderSummary([r], target) + "\n" + C("2", "Kein Urteil über einen Server, den Dante nicht erreicht.")); }
    process.exit(1);
  }

  const { battery } = activeBattery(); // the built-in rules plus every valid pack in ~/.dante/packs
  const checks = [...battery, ...(a.demo ? [demo] : [])];
  const results = checks.map((c) => { try { return c.run(); } catch (e) { return { id: c.id, title: c.title, verdict: UNKNOWN, was: "Check brach ab.", wie: String((e && e.message) || e), wo: target, evidence: [] }; } });

  if (a.json) { console.log(JSON.stringify({ target, results }, null, 2)); process.exit(results.some((r) => r.verdict === RISK) ? 2 : 0); }

  console.log(banner());
  for (const r of results) console.log(renderResult(r));
  console.log(renderSummary(results, target));

  // Findings with a plan -> the consent flow (only with --fix or --demo; otherwise just report).
  if (a.fix || a.demo) {
    for (const c of checks) {
      const r = results.find((x) => x.id === c.id);
      if (r && (r.verdict === RISK || r.verdict === WARN) && r.fix && r.fix.steps) {
        await handleFinding(c, r, a);
      }
    }
  } else if (results.some((r) => (r.verdict === RISK || r.verdict === WARN) && r.fix)) {
    console.log("\n" + C("2", "Dante kann das nach deinem Ja schließen: noch einmal mit ") + "--fix" + C("2", " starten."));
  }
  const old = staleLine(lang()); // the inner clock - local arithmetic, no update check over the net
  if (old) console.log("\n" + C("33", old));
  process.exit(results.some((r) => r.verdict === RISK) ? 2 : 0);
}

main();
