// Interactive session: banner, loading bar while the classifiers start, then the chat loop with the
// tip footer. The classifier proposes an intent with a probability; when unsure it asks back. Everything
// runs locally. Leave with "raus".
import { createInterface } from "node:readline/promises";
import { readFileSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { configureTarget, targetLabel, probe, runLocalAsync } from "./core/sh.mjs";
import { renderResult } from "./core/render.mjs";
import { RISK, WARN, SAFE } from "./core/check.mjs";
import { ask, recordYes, grantAutomode } from "./core/consent.mjs";
import { startLines } from "./mascot.mjs";
import { activeBattery, checkById } from "./checks/battery.mjs";
import { demo } from "./checks/demo.mjs";
import { run, firstLine } from "./core/sh.mjs";
import { slots } from "./bib/router.mjs";
import { newConv, note, understood, fallback, FALLBACK, wantsRecap, recap, wantsCodeProof, CODE_PROOF, wantsHowFix, menuPick, HOWFIX } from "./me/conv.mjs";
import { hearMain, hearConsent, hearSystem, hearMuster, hearWissen, hearDomain, langOf, SETUP_WORDS } from "./bib/ear.mjs";
import { cardsOf, findCard, answer as knowAnswer } from "./pack/know.mjs";
import { FAMILY_OF } from "./bib/system.mjs";
import { ANSWERS } from "./bib/answers.mjs";
import { setKnowledge, age, BIB_DATE, WATCH_TIP } from "./ticker.mjs";
import { waitFor } from "./ui/wait.mjs";
import { footerStart, footerStop, footerNext, setTitle } from "./ui/footer.mjs";
import { job } from "./ui/job.mjs";
import { OVERVIEW, parseOverview, facts, whatRuns } from "./me/overview.mjs";
import { read as readUser, write as writeUser } from "./me/user.mjs";
import { guardFile } from "./me/home.mjs";
import { identity as guardIdentity, saveToken as guardSaveToken, guardStatus, enrollArgs, decoyArgs, parseJson as guardParse, decoyFile, DECOY_KINDS, maybeNudge as guardMaybeNudge, labelOf as guardLabel } from "./guard/client.mjs";
import { append as diaryAppend, readAll as diaryAll, facts as diaryFacts } from "./me/diary.mjs";
import * as schedule from "./me/schedule.mjs";
import * as deepSchedule from "./me/schedule-deep.mjs";
import { deep as deepRun } from "./me/deep.mjs";
import { holder } from "./me/lock.mjs";
import { wantsLocal, wantsServerPick, badTarget, options as pickOptions, pickFlow, pickInLine } from "./me/pick.mjs";
import { pool } from "./me/pool.mjs";
import { wantsWatch, watchArgs } from "./me/guardwant.mjs";
import { actOf, route as threadRoute } from "./me/thread.mjs";
import { wantsMyName } from "./me/who.mjs";
import { fixTypos } from "./me/typos.mjs";
import { wantsWatchStatus, wantsSafeMe } from "./me/asks.mjs";
import { describe, wantsRemote, wantsThese, serverIn, serverAbout, serverRole, aboutLines, wantsServerList, wantsHealth, wantsFind, wantsStatus, wantsMore, wantsServersCheck, serversFlow, findFlow, namesMachines } from "./me/servers.mjs";
import { wantsSysInfo, wantsGoingOn, wantsAllSystems } from "./me/sysq.mjs";
import { VERSION, atLeast } from "./version.mjs";
import { wantsKeyFind, wantsHostKeyLook, keysFlow, assignKeyFlow, saidKeyPath } from "./me/keys.mjs";
import { collect as hkCollect, judge as hkJudge, describe as hkDescribe, wantsMitm, wantsHostKeyFix, validHostName, mitmMemory } from "./me/hostkey.mjs";
import { script as sysScript, nativeOutput as sysNative } from "./me/sysid.mjs";
import { report as sysReport } from "./me/sysreport.mjs";
import { LOCAL_RE } from "./me/pick.mjs";
// words that open a yes, and words that spoil one; words that ask for an explanation instead of answering
const LEADING_YES = /^\s*["'¡]*(?:ja+|j|jap|jo|jawohl|meinetwegen|von mir aus|na gut|klar|gern(?:e)?|na klar|okay|ok|yes+|yep|yeah|yup|sure|please|of course|go ahead|go on|s[ií]+|sip|claro|vale|adelante|dale|por favor|bitte|mach(?: ruhig)?|los|schau|look)(?![\p{L}])/iu;
const NEGATION = /(?<![\p{L}])(?:nein|nee|nicht|nie|no|nope|don'?t|do not|never|stop|halt|nunca|ni|aber nicht|lieber nicht)(?![\p{L}])/iu;
const LEADING_NO = /^\s*["'¡]*(?:nein|nee|ne|nö|nope|no|nicht|lieber nicht|nada|nunca)(?![\p{L}])/iu;
const ASKS_WHAT = /\?|(?<![\p{L}])(?:was (?:ist|heißt|bedeutet|macht)|erkl[aä]r\p{L}*|what(?:'s| is| does)|explain|qu[eé] (?:es|significa)|no s[eé] qu[eé]|ich wei(?:ß|ss) nicht was)(?![\p{L}])/iu;
const wantsVersion = (l) => /(?<![\p{L}])(?:meine version|welche version|neueste version|aktuelle version|neuere version|bin ich (?:auf dem )?(?:neuesten|aktuell\p{L}*)|gibt es (?:ein |eine )?(?:update|neue version)|ist (?:da |ein )?(?:ein )?update|what version|which version|latest version|newer version|am i up to date|any updates?|is there an update|qu[eé] versi[oó]n|[uú]ltima versi[oó]n|versi[oó]n m[aá]s nueva|estoy actualizado|hay (?:una )?(?:actualizaci[oó]n|versi[oó]n nueva))(?![\p{L}])/iu.test(l);
const SYSTEMS = JSON.parse(readFileSync(new URL("./bib/systems.json", import.meta.url), "utf8")).systems;
import { knownHosts, sshHosts, historyTargets } from "./me/recon.mjs";
import { lookAround } from "./me/recon.mjs";
import { onboard, armFlow, disarmFlow } from "./me/onboard.mjs";
import { comment } from "./me/comment.mjs";
import { refreshFlow, clockFlow } from "./me/refresh.mjs";
import { nudgeFlow, due as nudgeDue, expiredDue as nudgeExpiredDue, readAsked, writeAsked, openCommand, curlShown as catalogCurl, CATALOG_URL, openArgv } from "./me/nudge.mjs";
import { mt, reportLines } from "./me/texts.mjs";
import { saveReport, copyToDownloads, downloadsDir } from "./me/reportpdf.mjs";
import { wantsKeys } from "./me/keyswant.mjs";
import { wantsDeep } from "./me/deepwant.mjs";
import { wantsReport, wantsCheck, wantsExplain, wantsCapabilities, wantsWhatRunning, stripGreeting } from "./me/morewants.mjs";
import { fileURLToPath } from "node:url";
import { t, lang, setLang, saveLang, initLang, COMMANDS } from "./i18n.mjs";
import { tx } from "./i18n-checks.mjs";
import { hear } from "./core/consent.mjs";
import { pt, ruleTitles } from "./pack/texts.mjs";
import { readLicense, saveLicense, fetchPacksAsync, installMany, curlShown, TOKEN_IN_LINE, BUY_URL } from "./pack/install.mjs";

import { readdirSync } from "node:fs";
import { isWindows } from "./core/perm.mjs";
import { execProgram, execProgramAsync } from "./core/fsx.mjs";

const C = (code, s) => (process.stdout.isTTY && !process.env.NO_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const say = (s) => console.log(s);

const help = () => t("help").map(([w, d]) => "  " + C("1", w) + " ".repeat(Math.max(1, 17 - w.length)) + d).join("\n");
const ATTACK = /\b(attack|angreif\w*|greif\w*\s+(\S+\s+){0,6}an|hack(e|en|t)? (das|den|die|mal)|hack (the|his|her|their|my neighbou?r)|exploit(e|en)? (das|den|die|the|his)|ddos|ataca\w*|hackea(r|le)? (el|la|a)|pwn (the|his))\b/i;
// "could someone attack me / ob jemand angreifen kann" is a defender's question - Dante's work.
const DEFEND = /\b(ob|jemand|someone|anyone|alguien|könnte|could|can (someone|anyone|they)|pueden?)\b/i;
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

export async function session() {
  initLang(); // the language of this machine and of this person, before the first word is printed
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // However the session ends (raus, Ctrl-D, Ctrl-C), the terminal must come back: the footer's scroll region is
  // reset, or the screen would stay frozen.
  rl.on("close", footerStop);
  rl.on("SIGINT", () => { footerStop(); process.stdout.write("\n"); rl.close(); process.exit(0); });
  let target = null; // null = localhost
  let key = null;
  let last = []; // last results, for "fix" and "karte"

  // ---- the start: there is no door to knock on, he is awake ----
  const dim = (x) => C("2", x);
  const bar = (i, n) => { const w = 16, f = Math.round((w * i) / n); return C("36", "▕" + "▓".repeat(f) + "░".repeat(w - f) + "▏"); };
  const frame = (text) => { if (process.stdout.isTTY && !process.env.DANTE_NO_WAIT) process.stdout.write("\r\x1b[2K" + text); };
  setTitle("Dante");
  say(startLines(C("1", t("intro")) + dim(t("introSub"))).join("\n"));
  // The loading screen: a bar that fills as each ear really wakes (they learn their books now, not in the middle
  // of the first answer). Only the two every start needs; the specialist ears wake the first time they are asked.
  const EARS = [() => hearMain(""), () => hearConsent("")];
  for (let i = 0; i <= EARS.length; i++) {
    frame("  " + bar(i, EARS.length) + " 🦖 " + dim(t("wakeStep")(i, EARS.length)));
    if (i < EARS.length) EARS[i]();
  }
  frame("");
  let domainWarm = false;
  const warmDomain = () => {
    if (domainWarm) return;
    domainWarm = true;
    for (const [i, ear] of [hearMuster, hearSystem, hearWissen].entries()) { frame("  " + bar(i, 3) + " 🦖 " + dim(t("wakeMore"))); ear(""); }
    frame("");
  };
  // The rules Dante runs with: the built-in ones, plus every pack in ~/.dante/packs that passes every check.
  let { battery, deep: deepChecks, packs: activePacks, notices } = activeBattery();
  const clock = () => { if (activePacks.length) setKnowledge(activePacks[activePacks.length - 1].issued); }; // the clock then counts from the newest pack
  clock();

  configureTarget(null);
  const [h0, h1, h2] = t("sayHelp");
  say("  " + C("32", "● " + t("awake")) + dim(" · ") + dim(t("watching")) + targetLabel() + ". " + dim(h0) + C("1", h1) + dim(h2));
  for (const n of notices) say("  " + C("33", pt().ignored(n.file, pt().reason(n.code, n.detail))));
  if (activePacks.length) say("  " + dim(pt().on(activePacks)));
  if (isWindows()) for (const l of mt().winNotice) say("  " + C("33", l));   // he says plainly what he can and cannot do here
  footerStart(guardStatus(guardFile()).active ? undefined : WATCH_TIP); // the loading-screen tips, pinned under the chat; with the watch off it opens on the watch tip

  // ---- he knows you, or he meets you. The conversation runs through `io`, so it can be played without a terminal. ----
  const cliPath = fileURLToPath(new URL("./cli.mjs", import.meta.url));
  const dimf = (x) => C("2", x);
  const expandKey = (k) => (k ? k.replace(/^~(?=[\/\\])/, homedir()) : null);
  // The short name of a check in the person's language (the part of its card's title before the dash).
  const titleOf = (id) => {
    const check = battery.find((c) => c.id === id), card = cardsOf(activePacks).find((c) => c.id === ((check && check.know) || id));
    return card ? (card[lang()] || card.de).title.split(" — ")[0] : id;
  };
  // The call home of the test builds (src/lab is not in the published package: then this stays null and changes nothing).
  const lab = process.env.DANTE_LAB ? await import("./lab/callhome.mjs").catch(() => null) : null;
  const io = {
    mt, dim: dimf, lang, say: (l) => say(l.startsWith("  ") ? l : "  " + l), today: () => new Date().toISOString().slice(0, 10), now: () => new Date(),
    lastQuestion: "",
    queue: [],
    ask: async (q) => { io.lastQuestion = q; const a = (await rl.question("  " + C("1", q) + " " + dimf(t("armOpts")) + " ")).trim(); setLang(langOf(a, lang())); return a; },
    askFree: async (q) => (await rl.question("  " + C("1", q) + dimf(" › "))).trim(),
    // only a clean yes is a yes; the ear may explain or delay, never say yes
    decide: async (a, opts = {}) => {
      if (hear(a) === "yes") return "yes";
      // a question of three words or more ("ok bin ich sicher?") is a new request, however it begins - never a yes
      if (/\?\s*$/.test(a) && a.trim().split(/\s+/).length >= 3 && !/^(?:ja|yes|si|sí)\b[ ,]/i.test(a.trim())) return "other";
      // a question that only lets Dante look: "ja klar, schau nach, aber …" is a yes (a "no" or "don't" anywhere makes it unclear again)
      if (opts.lenient && LEADING_YES.test(a) && !NEGATION.test(a)) return "yes";
      const words = a.trim().split(/\s+/).length;
      // a follow-up ("welche noch?", "was sind die hinweise?", "nochmal") is not an answer to this question: it is the next request
      const act = actOf(a);
      if (act && ["more", "these", "details", "again"].includes(act) && !LEADING_YES.test(a)) return "other";
      if (act === "doit") return opts.lenient ? "yes" : "unclear";   // "mach du es" says yes to a question that only lets him LOOK; anything that changes something needs a clean yes
      if (words <= 6 && ASKS_WHAT.test(a) && !LEADING_YES.test(a)) return "what";                     // "was?", "was heißt das", "qué es root"
      if (LEADING_NO.test(a)) return "no";                                                            // a "no" with more words after it is still a no: declining is always safe
      if (words >= 4 && !LEADING_YES.test(a)) return "other";                                         // a long line that answers nothing is a new request
      const r = hearConsent(a).intent;
      const local = r === "nein" || r === "spaeter" ? "no" : r === "was_macht" || r === "gefahr" ? "what" : "unclear";
      if (local !== "unclear" || !lab) return local;
      // test builds: the central brain reads what the answer means. A yes counts only where a leading yes would (read-only questions).
      const z = await lab.answer({ question: io.lastQuestion || "", answer: a, lang: lang() });
      if (!z) return "unclear";
      if (z.kind === "yes") return opts.lenient ? "yes" : "unclear";
      return z.kind === "later" ? "no" : z.kind;
    },
    look: () => waitFor(mt().looking, async () => lookAround({ exec: execProgram })),
    probe: async (sv) => {
      const o = await waitFor(t("waitLook")(sv.alias), job({ kind: "exec", scripts: [OVERVIEW], limit: 30000 }, { host: sv.target, key: expandKey(sv.key) }));
      if (!o.reached) { unreach.set(sv.target, o.code || "unreached"); return { ok: false, code: o.code, line: o.line }; }
      unreach.delete(sv.target);
      const kv = parseOverview(o.outs[0].out), f = facts(kv);
      // everything that was seen is handed back - a fact he read but dropped is a fact he lies about later
      return { ok: !!kv.label, label: kv.label, php: f.php, seen: f, what: whatRuns(kv, lang()) };
    },
    // the buying nudge: the curl that is shown is the curl that runs; nothing of the person goes out
    unreachable: (sv) => unreach.get(sv.target) || null,
    knowledgeDays: () => age(), installedSerials: () => activePacks.map((p) => p.serial),
    fetchCatalog: async () => {
      const r = await waitFor(mt().catalogWait, execProgramAsync("curl", ["-sS", "--max-time", "15", CATALOG_URL], { timeout: 20000 }));
      try { const j = JSON.parse(r.out); if (r.ok && Array.isArray(j.packs)) return { ok: true, packs: j.packs }; } catch { /* not a catalog */ }
      return { ok: false };
    },
    openPage: async (url) => { const o = openArgv(url); if (!o) return { ok: false }; return { ok: (await execProgramAsync(o[0], o.slice(1), { timeout: 10000 })).ok }; },
    writeUser, userPath: () => "~/.dante/user.md", diary: diaryAppend,
    plan: () => schedule.plan({ cli: cliPath }), install: (p) => schedule.install(p), remove: () => schedule.remove(), isArmed: () => schedule.isArmed(),
    deepPlan: () => deepSchedule.plan({ cli: cliPath }), installDeep: (p) => deepSchedule.install(p), removeDeep: () => deepSchedule.remove(), isArmedDeep: () => deepSchedule.isArmed(),
  };
  const interactive = (process.stdin.isTTY && process.stdout.isTTY) || process.env.DANTE_ONBOARD === "1";
  let me = readUser();
  const knewYou = !!me;   // "welcome back" is only for someone he already knew when he woke up
  if (!me && interactive) { const r = await onboard(io); if (r.user) { me = r.user; saveLang(lang()); } }   // what he learned about your language stays
  const visit = diaryAppend({ kind: "session" });   // the mark that "since your last visit" counts from
  const sinceFacts = () => diaryFacts(diaryAll(), { current: visit.t });
  if (knewYou && me.name !== undefined && !process.env.DANTE_NO_WELCOME) {
    const f = sinceFacts();
    if (f.runs || f.acts.length) { say("  " + C("1", mt().welcome(me.name))); reportLines(f, titleOf).forEach((l) => say("  " + dimf(l))); }
  }
  schedule.refreshLauncher({ cli: cliPath }); deepSchedule.refreshLauncher({ cli: cliPath });   // the schedule follows the version that runs now

  // The slow work (ssh, waiting for the server) runs in a worker thread, so the waiting screen keeps moving.
  const target$ = () => (target ? { host: target, key } : null);
  const brokeOff = (c) => ({ id: c.id, title: c.title, verdict: "unknown", was: "Check brach ab.", wie: "", wo: "", evidence: [] });
  // no list given = the whole battery: Dante's job is every thing he watches, not only one hole
  const runChecks = async (withFix, checks = battery) => {
    const res = await waitFor(t("waitCheck")(targetLabel()), job({ kind: "checks", ids: checks.map((c) => c.id) }, target$()));
    if (!res.reached) { say("  " + C("100;37", t("rUnknown")) + " " + t("unseen")(targetLabel(), mt().sshWhy(res.code, res.line))); await offerMitm(res.code, target); return; }
    last = checks.map((c, i) => ({ c, r: res.results[i] || brokeOff(c) }));
    // Say what was checked, and write it into every result: "Dieser Server" for a Mac is a lie of omission.
    const where = targetLabel() === "localhost" ? mt().woLocal : targetLabel();
    say("  " + C("2", mt().checkedOn(targetLabel() === "localhost" ? mt().woLocalShort : targetLabel())));
    for (const { r } of last) { if (/^Dieser Server\.?$/.test(String(r.wo || "").trim())) r.wo = where; say(renderResult(r)); }
    // after the table, the sentence that makes it mean something: what this is for YOU, and what next
    try {
      const mac = /mac|darwin|macos/i.test(String((me && me.system) || "")) || process.platform === "darwin";
      for (const l of comment(last.map(({ c, r }) => ({ ...r, id: r.id ?? c.id, title: r.title ?? c.title })), { machine: mac ? "mac" : "server", target: targetLabel() })) say("  " + C("1", l));
    } catch {}   // the comment never breaks a real check
    const rpath = saveReport(last.map((x) => x.r).filter(Boolean), { target: targetLabel(), lang: lang() });
    if (rpath) say("  " + C("2", mt().reportHint));
    const open = last.filter(({ r }) => r.verdict === RISK || r.verdict === WARN && r.fix);
    if (open.length && !withFix) say("\n  " + C("2", t("canFix")) + C("1", "fix") + C("2", "."));
    lastTopic = "findings";   // "mach du es", "warum?", "nochmal" now refer to this result
    if (withFix) for (const { c, r } of open) await finding(c, r);
  };

  const finding = async (check, r) => {
    say("\n" + C("41;37", t("listen")) + " " + C("1", tx(r.title)));
    say("  " + C("2", t("what")) + " " + tx(r.was) + "   " + C("2", t("how")) + " " + tx(r.wie));
    say("  " + C("36", t("plan")) + " " + tx(r.fix.why || ""));
    r.fix.steps.forEach((s, i) => { say("    " + (i + 1) + ") " + tx(s.desc) + "   " + C("2", "$ " + s.script)); });
    say("  " + C("33", t("distrust")));
    const a = await ask(check.id, t("run"), { plan: r.fix, rl });
    if (a === "no") { say("  " + C("2", t("nothing"))); return; }
    if (a === "always") { grantAutomode(check.id); }
    // DANTE_FIX_DRY=1 (tests, the lab): the plan is shown and agreed, nothing runs
    if (process.env.DANTE_FIX_DRY) { for (const s of r.fix.steps) say("  " + C("2", "(dry) " + tx(s.desc) + "  $ " + s.script)); return; }
    for (const s of r.fix.steps) {
      const o = await waitFor(tx(s.desc), job({ kind: "exec", scripts: [s.script], timeout: 120000 }, target$()));
      const res = o.reached ? o.outs[0] : { ok: false, out: "", err: o.line };
      say("  " + (res.ok ? C("32", "✓") : C("31", "✗")) + " " + tx(s.desc) + "  " + C("2", "→ " + (firstLine(res.out || res.err) || (res.ok ? "(ok)" : "(fehler)"))));
      if (!res.ok) { say("  " + C("31", t("failed"))); return; }
    }
    if (a === "yes") await recordYes(check.id, { rl });
    // the check that fixed something is run again for a fresh real line (the demo is not in the battery: it runs here)
    const after = battery.some((c) => c.id === check.id)
      ? (await waitFor(t("waitCheck")(targetLabel()), job({ kind: "checks", ids: [check.id] }, target$()))).results[0] || brokeOff(check)
      : check.run();
    say("  " + C("2", t("recheck")));
    say(renderResult(after).split("\n").map((l) => "  " + l).join("\n"));
    if (after.verdict === SAFE) diaryAppend({ kind: "act", what: "fix", detail: check.id });
    say("  " + (after.verdict === SAFE ? C("42;30", t("closed")) + C("2", t("closedSub")) : C("33", t("notYet"))));
  };

  // The sixth bib at work: the main ear caught a gap, Dante opens the technical book. He does not
  // trust what the user says the system is - he reads it off the target himself. Every line here is
  // the machine's own output, proven channel first (probe), or it stays "unbekannt".
  const SYS_T = {
    fp: { de: "System erkannt", en: "System detected", es: "Sistema detectado" },
    php: { de: "PHP gefunden", en: "PHP found", es: "PHP encontrado" },
    phpNo: { de: "Kein PHP auf diesem Ziel.", en: "No PHP on this target.", es: "No hay PHP en este objetivo." },
    noBeleg: { de: "Noch kein Beleg — erst prüfen lassen.", en: "No evidence yet — run a check first.", es: "Aún no hay prueba — revisa primero." },
  };
  const PKG = { debian: "apt", alpine: "apk", fedora: "dnf", arch: "pacman" };
  const OV = {
    de: { system: "System:", pkg: "Reparaturen laufen hier mit:", family: "Familie", pkgUnknown: "unbekannte Familie — ich ändere dort nichts, bevor ich sie kenne.", web: "Webserver:", none: "nicht gefunden", hint: "Ich prüfe hier PHP2Shell, offene Geheimnisse, Webshells, SSH und Dateirechte. Sag „prüf alles“." },
    en: { system: "System:", pkg: "Fixes run here with:", family: "family", pkgUnknown: "unknown family — I change nothing there before I know it.", web: "Web server:", none: "not found", hint: "Here I check PHP2Shell, exposed secrets, webshells, SSH and file permissions. Say “check everything”." },
    es: { system: "Sistema:", pkg: "Las reparaciones aquí usan:", family: "familia", pkgUnknown: "familia desconocida — no cambio nada allí hasta conocerla.", web: "Servidor web:", none: "no encontrado", hint: "Aquí reviso PHP2Shell, secretos expuestos, webshells, SSH y permisos de archivos. Di «revisa todo»." },
  };
  // The host key of a server changed: say it in words, remember the host, and offer to look for someone in between.
  let changedHost = "";
  const hostOf = (tgt) => String(tgt || "").replace(/^.*@/, "");
  const offerMitm = async (code, tgt) => {
    if (code !== "hostkey_changed") return;
    changedHost = hostOf(tgt);
    if (!changedHost || !validHostName(changedHost)) return;
    lastTopic = "hostkey";   // whatever happens below, the next "warum?" / "mach du es" is about this key
    // asked before (or looked) for this host this week: one line of what he knows, no new question
    const mem = mitmMemory(diaryAll(), changedHost);
    if (!mem.ask) { say("  " + C("2", mt().mitmKnown(changedHost, mem.last.t.slice(0, 10), mem.last.what === "hostkey" ? mem.last.level || "hint" : "no"))); return; }
    if (await yesNo(mt().mitmAsk(changedHost), { lenient: true })) await mitmMove(changedHost);
    else diaryAppend({ kind: "act", what: "hostkey_no", detail: changedHost });
    lastTopic = "hostkey";
  };
  const mitmMove = async (host, { auto = false } = {}) => {
    if (!host || !validHostName(host)) { say("  " + C("2", mt().mitmNoHost)); return; }
    const u = readUser(), others = ((u && u.servers) || []).filter((s) => hostOf(s.target) !== host);
    let use = [];
    // asked for by the person: no second question, the extra look from another of their servers is part of the request
    if (others.length && (auto || (await yesNo(mt().mitmOtherAsk, { lenient: true })))) { use = others.slice(0, 2); if (auto) say("  " + C("2", mt().mitmAuto(use.map((s) => s.alias).join(", ")))); }
    const there = async (srv, cmd) => {
      const o = await job({ kind: "exec", scripts: [cmd], timeout: 30000 }, { host: srv.target, key: srv.key ? srv.key.replace(/^~(?=\/)/, homedir()) : null }).catch(() => ({ reached: false }));
      return o.reached ? { out: o.outs[0].out, ok: true } : { out: "", ok: false };
    };
    const c = await waitFor(mt().mitmHead(host), hkCollect({ local: async (cmd) => { const r = await runLocalAsync(cmd, { timeout: 30000 }); return { out: r.out, ok: r.ok }; }, exec: execProgram, there }, { host, others: use.map((s) => s) }));
    const j = hkJudge({ ...c, seen: c.seen.map((x) => ({ ...x, server: x.server.alias })) });
    say("  " + C("1", mt().mitmHead(host)));
    hkDescribe(j, c, mt()).forEach((l, i, a) => say("  " + (i === a.length - 2 && j.level === "attention" ? C("31;1", l) : l)));
    diaryAppend({ kind: "act", what: "hostkey", detail: host, level: j.level });
    lastTopic = "hostkey";
  };
  // "mach du es" after a changed host key: only YOUR known_hosts changes, only after a clear yes, and the new fingerprint is shown to compare
  const hostkeyFixMove = async (host) => {
    if (!host || !validHostName(host)) { say("  " + C("2", mt().mitmNoHost)); return; }
    for (const l of mt().hkFixPlan(host)) say("  " + l);
    if (!(await yesNo(mt().hkFixAsk))) { say("  " + C("2", mt().hkFixNo)); return; }
    const khPath = join(homedir(), ".ssh", "known_hosts");   // the file is named explicitly: ssh-keygen would otherwise use the account's home, whatever we think ours is
    await execProgramAsync("ssh-keygen", ["-R", host, "-f", khPath], { timeout: 15000 });
    const scan = await waitFor(mt().mitmHead(host), execProgramAsync("ssh-keyscan", ["-T", "10", "-t", "ed25519,ecdsa,rsa", host], { timeout: 20000 }));
    const keyLines = String(scan.out || "").split("\n").filter((l) => l && !l.startsWith("#"));
    if (!keyLines.length) { say("  " + C("33", mt().hkFixNoKey(host))); return; }
    const fp = await execProgramAsync("ssh-keygen", ["-lf", "-"], { timeout: 10000, input: keyLines[0] + "\n" });
    appendFileSync(khPath, keyLines.join("\n") + "\n");
    changedHost = "";
    diaryAppend({ kind: "act", what: "hostkey_reset", detail: host });
    say("  " + C("32", mt().hkFixDone(host, (String(fp.out || "").trim().split(/\s+/)[1]) || "?")));
  };
  const unreached = async (ch) => { say("  " + C("100;37", t("rUnknown")) + " " + t("unseen")(targetLabel(), mt().sshWhy(ch.code, ch.line))); await offerMitm(ch.code, target); };
  const systemMove = async (intent) => {
    switch (intent) {
      case "pruef_php2shell": return runChecks(false, [checkById("php2shell", battery)]);   // asked about this one hole
      case "fix_php2shell": return runChecks(true, [checkById("php2shell", battery)]);
      case "beleg": {
        const ev = last.flatMap(({ r }) => r.evidence || []);
        if (!ev.length) { say("  " + C("2", SYS_T.noBeleg[lang()])); return; }
        for (const e of ev) say("  " + C("1", "• " + tx(e.claim)) + C("2", "   $ " + (e.cmd || "")) + "\n    " + C("36", e.line || ""));
        return;
      }
      case "fingerabdruck": return sysMove("info");
      case "finde_php": {
        const o = await waitFor(t("waitLook")(targetLabel()), job({ kind: "exec", scripts: ["php -v 2>/dev/null | head -1"] }, target$()));
        if (!o.reached) return unreached(o);
        const line = firstLine(o.outs[0].out);
        say(line ? "  " + C("1", SYS_T.php[lang()]) + C("2", "   → " + line) : "  " + C("2", SYS_T.phpNo[lang()]));
        return;
      }
    }
  };

  // ---- license and packs: the only place Dante ever lets a call out, and only on a typed command ----
  // a yes/no question: only a clean yes is a yes. A line that is a NEW REQUEST is not an answer and is not lost: it becomes the next input.
  const yesNo = async (q, { lenient = false } = {}) => {
    const a = (await rl.question("  " + q + " " + C("2", t("armOpts")) + " ")).trim();
    const d = await io.decide(a, { lenient });
    if (d === "other") { io.queue.push(a); return false; }
    return d === "yes";
  };
  const reload = () => { ({ battery, packs: activePacks } = activeBattery()); clock(); };
  const showInstalled = (r) => {
    const p = pt();
    if (!r.installed.length) {
      if (r.refused.length) { r.refused.forEach((x) => say("  " + C("33", p.rejected(x)))); return; }
      say("  " + C("33", p.nothingNew(activePacks))); return;
    }
    reload();
    diaryAppend({ kind: "act", what: "packs", detail: r.installed.map((x) => x.serial).join(", ") });
    say("\n" + C("42;30", p.badge) + " " + C("1", p.packLine(r.installed, battery.length)));
    const row = (sign, col, label) => (title) => say("    " + (title.startsWith("…") ? title : C(col, sign) + " " + title + C("2", "  " + label)));
    ruleTitles(r.diff.added).forEach(row("+", "32", p.added));
    ruleTitles(r.diff.changed).forEach(row("~", "33", p.changed));
    r.refused.forEach((x) => say("  " + C("33", p.rejected(x))));
    say("  " + C("2", p.next));
  };
  const failText = (f) => { const p = pt(); return f.curlMissing ? p.curlMissing : f.badBody ? p.badBody : f.code === 401 ? p.unknownTok : f.code === 403 ? p.revoked : f.code === 429 ? p.tooMany : f.code === 0 ? p.net : p.other(f.code); };
  // Whenever the way to new packs is closed (no token, a token the server does not know or has revoked, an expired
  // pack), he does not just say so: he offers to lead the person to the shop page and opens it after a clean yes.
  const offerShop = async (url = BUY_URL) => {
    const o = openArgv(url);
    if (o) say("  " + C("2", "→ " + o.join(" ")));   // the command that runs is shown first
    if (!(await yesNo(mt().askOpen, { lenient: true }))) return;
    const r = await io.openPage(url);
    say("  " + (r.ok ? mt().opened : mt().noOpener(url)));
  };
  // "Is there a newer Dante?": one curl against the public npm registry, shown first, run after a yes. Nothing of the person goes out.
  const REGISTRY = "https://registry.npmjs.org/dante-watch/latest";
  const versionCheck = async () => {
    say("  " + mt().verHave(VERSION, BIB_DATE));
    say("  " + C("2", mt().verAsk) + "\n    " + C("2", `curl -sS --max-time 10 ${REGISTRY}`));
    if (!(await yesNo(mt().verGo, { lenient: true }))) { say("  " + C("2", pt().declined)); return; }
    const r = await waitFor(mt().verWait, execProgramAsync("curl", ["-sS", "--max-time", "10", REGISTRY], { timeout: 15000 }));
    let latest = ""; try { latest = String(JSON.parse(r.out).version || ""); } catch { /* no answer */ }
    if (!/^\d+\.\d+\.\d+$/.test(latest)) say("  " + C("33", mt().verFail));
    else say("  " + (atLeast(VERSION, latest) ? C("32", "✓") + " " + mt().verSame(VERSION) : C("33", "↑") + " " + mt().verNewer(VERSION, latest)));
  };
  const updatePack = async () => {
    const p = pt();
    if (!readLicense()) { say("  " + C("2", p.noLicense)); await offerShop(); return; }
    say("  " + C("2", p.askFetch) + "\n    " + C("2", curlShown()));
    if (!(await yesNo(p.go))) { say("  " + C("2", p.declined)); return; }
    const f = await waitFor(p.loading, fetchPacksAsync());
    if (!f.ok) { say("  " + C("33", failText(f))); if (f.code === 401 || f.code === 403) await offerShop(); return; }
    showInstalled(installMany(f.raws));
  };
  // "update" does both: fetch the packs (its own yes, the visible curl) and look again at user.md. Looking is read
  // only; new servers join the patrol only after a yes to knocking.
  const refreshMe = async () => {
    const u = readUser();
    if (!u) { say("  " + C("2", mt().needLook)); return; }
    await refreshFlow(io, u); me = readUser();
  };
  // "pack <file>": one file, or a folder of downloaded packs
  const MAX_PACK_BYTES = 2 * 1024 * 1024;   // a pack is a few KB; nothing near this is a pack
  const installFile = (file) => {
    const p = pt();
    if (!file) { say("  " + C("2", p.packWhich)); return; }
    const path = file.replace(/^~(?=[\/\\]|$)/, homedir());
    const raws = [];
    try {
      const names = statSync(path).isDirectory() ? readdirSync(path).filter((f) => /^pack-\d+\.json$/.test(f)).map((f) => join(path, f)) : [path];
      // only real, small files: a device (/dev/zero) or a huge file would be read for ever and eat the memory
      for (const f of names) { const st = statSync(f); if (!st.isFile() || st.size > MAX_PACK_BYTES) throw new Error("not a pack file"); raws.push(readFileSync(f, "utf8")); }
    } catch { say("  " + C("33", p.noFile(file))); return; }
    showInstalled(installMany(raws));
  };
  const licenseMove = async (tok, typedSomething) => {
    const p = pt();
    if (!tok) { say("  " + C("2", typedSomething ? p.licenseBad : p.howToken)); return; }
    if (readLicense() !== tok) {
      if (!(await yesNo(p.licenseAsk))) { say("  " + C("2", p.declined)); return; }
      saveLicense(tok);
    }
    say("  " + C("32", "✓") + " " + p.licenseSaved);
  };
  const packStatus = () => say("  " + pt().status(activePacks, battery.length));

  // The Muster-Bib at work: the user wants Dante to go and look for a wrong state. "patrouille" runs
  // the whole battery; a single worry runs that one check. All read-only - a fix still waits behind
  // the yes/no gate (fix runs the battery with findings).
  // Models and agents (Hugging Face analysis): three read-only looks from the pack of the same name. Without the pack
  // he says what it is and offers the shop page, like everywhere the way to something new is closed.
  const HF_IDS = ["hf-charakter", "hf-verhalten", "hf-faehigkeiten"];
  const hfMove = async () => {
    const cs = HF_IDS.map((id) => checkById(id, [...battery, ...deepChecks])).filter(Boolean);
    if (!cs.length) { say("  " + C("2", mt().hfNeedPack)); await offerShop(); return; }
    return runChecks(false, cs);
  };
  // Which one? this machine, a server from user.md, or a host from known_hosts. Runs the check on the chosen one.
  // Every known server in one go: a few at a time, one short line each, the details stay per server.
  const fleetMove = async (servers) => {
    say("  " + mt().fleetHead(servers.length));
    const ids = battery.map((c) => c.id);
    let open = 0, notes = 0, down = 0; const changed = [];
    fleetLast = []; fleetDown = 0;   // what this round found, per server: "was sind die 3 hinweise?" is answered from it
    // the checks take a while: a visible working line (with the seconds) so it never looks stuck; results scroll above it
    await waitFor(mt().fleetWork(servers.length), pool(servers, async (s) => {
      const res = await job({ kind: "checks", ids, limit: 120000 }, { host: s.target, key: s.key ? s.key.replace(/^~(?=\/)/, homedir()) : null }).catch((e) => ({ reached: false, line: String((e && e.message) || e) }));
      if (!res.reached) { down++; fleetDown++; unreach.set(s.target, res.code || "unreached"); if (res.code === "hostkey_changed") changed.push(s); say("  " + C("2", mt().fleetDown(s.alias, mt().sshWhy(res.code, String(res.line || "").slice(0, 60))))); return; }
      const rs = (res.results || []).filter(Boolean), n = (v) => rs.filter((r) => r.verdict === v).length;
      fleetLast.push({ server: s, rs });
      unreach.delete(s.target);
      if (n("risk")) open++; else if (n("warn")) notes++;
      say("  " + (n("risk") ? C("31", "●") : n("warn") || n("unknown") ? C("33", "●") : C("32", "●")) + " " + mt().fleetLine(s.alias, n("risk"), n("warn"), n("unknown")));
    }, 4));
    say("  " + mt().fleetDone(open, notes, down));
    // the show after the round: WHAT the notes are (one short line per server), then what it means for you - without being asked
    for (const { server, rs } of fleetLast) {
      const titles = rs.filter((r) => r.verdict === RISK || r.verdict === WARN).map((r) => tx(r.title));
      if (titles.length) say("  " + C("33", "▸ ") + C("1", server.alias) + ": " + titles.slice(0, 4).join(" · ") + (titles.length > 4 ? ` (+${titles.length - 4})` : ""));
    }
    try {
      // one sentence for the whole round, not one per check per server: the same finding on two servers counts once, and what is merely safe is not said again
      const rank = { risk: 3, warn: 2, unknown: 1, safe: 0 }, byId = new Map();
      for (const { rs } of fleetLast) for (const r of rs) { const k = r.id || r.title; if (!byId.has(k) || (rank[r.verdict] || 0) > (rank[byId.get(k).verdict] || 0)) byId.set(k, r); }
      const worst = [...byId.values()].filter((r) => r.verdict === RISK || r.verdict === WARN);
      const said = new Set();   // the same sentence once, however many checks led to it
      for (const l of comment(worst.length ? worst : [...byId.values()], { machine: "server", target: fleetLast.length === 1 ? fleetLast[0].server.alias : mt().fleetWhere(fleetLast.length) })) if (!said.has(l)) { said.add(l); say("  " + C("1", l)); }
      if (fleetLast.some(({ rs }) => rs.some((r) => r.verdict === RISK || r.verdict === WARN))) say("  " + C("2", mt().fleetMore));
    } catch {}   // the comment never breaks a real round
    for (const sv of changed) await offerMitm("hostkey_changed", sv.target);
    lastTopic = "fleet";   // "was sind die 3 hinweise?", "mach du es", "nochmal" refer to this round
  };
  const unreach = new Map();   // target -> why it could not be reached this session: he does not ask to knock again at a door he already tried
  let fleetLast = [], fleetDown = 0;
  // the notes and findings of the last round, per server, with the same lines and proof as a single check
  const fleetDetailMove = () => {
    if (!fleetLast.length) { say("  " + C("2", mt().fleetNoRound)); return; }
    const shown = fleetLast.filter(({ rs }) => rs.some((r) => r.verdict === RISK || r.verdict === WARN));
    if (!shown.length) { say("  " + C("2", mt().fleetNoNotes + (fleetDown ? " " + mt().fleetSomeDown(fleetDown) : ""))); return; }
    say("  " + C("1", mt().fleetDetailHead));
    for (const { server, rs } of shown) {
      say("\n  " + C("1", server.alias) + C("2", " - " + server.target));
      for (const r of rs.filter((x) => x.verdict === RISK || x.verdict === WARN)) say(renderResult(r));
    }
  };
  // "Find my servers": look in the places servers leave traces and enter what is new (patrol off until the person agrees).
  const serverFindMove = async () => {
    const u = readUser();
    if (!u) { say("  " + C("2", mt().needLook)); return; }
    const hosts = sshHosts(homedir()), hints = knownHosts(homedir(), [...hosts.map((h) => h.alias), ...(u.servers || []).map((s) => s.alias)]);
    lastTopic = "servers";
    await findFlow(io, u, { hosts, hints, readHistory: async () => historyTargets(homedir()) });
    me = readUser();
  };
  // "How are my servers?": a short look at every known server, a few at a time.
  const serverStatusMove = async () => {
    const u = readUser(), servers = (u && u.servers) || [];
    if (!servers.length) return serverListMove();
    return fleetMove(servers);
  };
  let lastTopic = null;
  const serverListMove = async ({ all = false } = {}) => {
    const u = readUser();
    lastTopic = "servers";
    await serversFlow(io, u, knownHosts(homedir(), ((u && u.servers) || []).map((s) => s.alias)), { all });
    me = readUser();
  };
  // What is it, and what is going on there? Level 1 recognises the system from fixed probes, level 2 reads the basics (and, for
  // "what is going on", the busy processes, open ports, failed services and who is logged in). Works on this machine, the chosen
  // server or all known ones.
  let curLine = "";
  const sysOne = async (tgt, label, mode) => {
    // this machine on Windows: Node reads it, there is no shell to ask
    const o = tgt == null && isWindows() ? { reached: true, outs: [{ out: sysNative(mode) }] } : await waitFor(t("waitLook")(label), job({ kind: "exec", scripts: [sysScript(mode)], limit: 40000 }, tgt));
    if (!o.reached) return unreached(o);
    const r = sysReport(o.outs[0].out, SYSTEMS, lang(), mode);
    if (!r.id && !r.label) { say("  " + C("2", mt().sysNothing)); return; }
    r.lines.forEach((l, i) => say("  " + (i === 0 ? C("1", l) : l)));
    if (r.proof) say("  " + C("2", "↳ " + r.proof));
  };
  const sysAll = async (servers, mode) => {
    say("  " + mt().fleetHead(servers.length));
    const changed = [];
    await pool(servers, async (s) => {
      const o = await job({ kind: "exec", scripts: [sysScript(mode)], limit: 40000 }, { host: s.target, key: s.key ? s.key.replace(/^~(?=\/)/, homedir()) : null }).catch(() => ({ reached: false }));
      if (!o.reached) { if (o.code === "hostkey_changed") changed.push(s); say("  " + C("2", mt().fleetDown(s.alias, mt().sshWhy(o.code, o.line)))); return; }
      const r = sysReport(o.outs[0].out, SYSTEMS, lang(), mode);
      say("  " + C("1", s.alias) + " - " + r.lines.slice(0, mode === "activity" ? 6 : 2).join(" | "));
    }, 4);
    for (const sv of changed) await offerMitm("hostkey_changed", sv.target);
  };
  // "Tell me about my systems": this machine first, then every known server, a short block each.
  const allSystemsMove = async () => {
    say("  " + C("2", mt().allHead));
    await sysOne(null, "localhost", "info");
    const u = readUser(), servers = (u && u.servers) || [];
    if (servers.length) await sysAll(servers, "info"); else say("  " + C("2", mt().allNoServers));
    lastTopic = "servers";   // the last words were about servers: "welche noch?" / "was sind diese server?" belong to them
  };
  const sysMove = async (mode) => {
    const wordsServer = /(^|[^\p{L}])(server|servidor(es)?|servern)([^\p{L}]|$)/iu.test(curLine);
    if (LOCAL_RE.test(curLine) && !wordsServer) { configureTarget(null); return sysOne(null, "localhost", mode); }
    if (target) return sysOne(target$(), targetLabel(), mode);
    const u = readUser();
    if (wordsServer && u && (u.servers || []).length) return pickMove({ sys: mode });
    return sysOne(null, "localhost", mode);
  };
  const serverChoices = () => (((readUser() || {}).servers) || []).map((s) => ({ kind: "server", alias: s.alias, target: s.target, key: s.key || null, os: s.os || "" }));
  let lastMenu = null, turnNo = 0;   // the numbered list that was last on screen, and when: "prüfe die 4" belongs to it
  const applyPick = async (o, opts = {}) => {
    const u = readUser();
    if (o.kind === "all") return opts.sys ? sysAll((u && u.servers) || [], opts.sys) : fleetMove((u && u.servers) || []);
    if (o.kind === "local") { target = null; configureTarget(null); say("  " + C("2", t("target") + "localhost")); return opts.sys ? sysOne(null, "localhost", opts.sys) : runChecks(false); }
    if (o.key) key = o.key.replace(/^~(?=\/)/, homedir());
    target = o.target; configureTarget({ host: target, key }); say("  " + C("2", t("target")) + targetLabel());
    return opts.sys ? sysOne(target$(), targetLabel(), opts.sys) : runChecks(false);
  };
  const pickMove = async (opts = {}) => {
    const u = readUser();
    const choices = pickOptions({ servers: (u && u.servers) || [], hints: knownHosts(homedir(), ((u && u.servers) || []).map((s) => s.alias)) });
    lastMenu = { choices, opts, turn: turnNo };
    const o = await pickFlow(io, choices);
    if (!o) { if (io.pickDropped) { io.pickDropped = false; return; } say("  " + C("2", mt().pickNone)); return; }
    return applyPick(o, opts);
  };
  // What such a helper may order Dante to do on its own: only answers and looks. Anything that changes something still asks, as everywhere.
  const viaZentrale = async (z, line) => {
    const ok = new Set(["gruss", "hilfe", "smalltalk", "karte", "frage_dante", "frage_luecke", "frage_urteil", "frage_gehackt", "pruef"]);
    if (z.ear === "muster") { await musterMove(z.intent); return true; }
    if (z.ear === "system") { await systemMove(z.intent); return true; }
    if (z.ear === "wissen") { await knowMove(z.intent, line); return true; }
    if (z.ear === "main" && ok.has(z.intent)) {
      if (z.intent === "gruss") say("  " + pick(t("hello"))); else if (z.intent === "hilfe") say(help()); else if (z.intent === "karte") { for (const { r } of last) say(renderResult(r)); }
      else if (z.intent === "pruef") await runChecks(false); else if (z.intent === "smalltalk") say(pick(ANSWERS.smalltalk[lang()]).map((l) => "  " + l).join("\n"));
      else say(ANSWERS[z.intent][lang()].map((l) => "  " + l).join("\n"));
      return true;
    }
    return false;
  };
  // the weekly deep run (also reached from the muster ear when the line only means it)
  const deepMove = async () => {
    if (holder("deep")) { say("  " + mt().deepSkipped); return; }
    say("  " + C("2", mt().deepStart));
    const lines = [];
    await waitFor(mt().deepStart, deepRun({ log: (l) => lines.push(l) }));
    const last2 = diaryAll().filter((e) => e.kind === "run" && e.deep).slice(-1)[0];
    const rs = (last2 && last2.results) || [], n = (v) => rs.filter((r) => r.v === v).length;
    say("  " + mt().deepDone(n("risk"), n("warn"), n("unknown")));
    for (const r of rs.filter((r) => r.v === "risk" || r.v === "warn")) say("  " + C("2", `${r.v}: ${r.l}`));
  };
  const musterMove = async (intent) => {
    if (intent === "umschauen") { await onboard(io); me = readUser(); return; }
    if (intent === "scharf") { const u = readUser(); if (!u) say("  " + C("2", mt().needLook)); else await armFlow(io, u); return; }
    if (intent === "abschalten") { if (!schedule.isArmed() && !deepSchedule.isArmed()) return disarmFlow(io, readUser()); if (await yesNo(mt().disarmAsk)) return disarmFlow(io, readUser()); say("  " + C("2", mt().disarmKept)); return; }
    if (intent === "patrouille") return runChecks(false, battery);
    if (intent === "tief") return deepMove();
    if (intent === "wachschutz") return wachschutzMove([]);
    if (intent === "hf") return hfMove();
    if (intent === "server_liste") return serverListMove();
    if (intent === "meinsystem") return sysMove("info");
    if (intent === "systeme_info") return allSystemsMove();
    if (intent === "was_los") return sysMove("activity");
    if (intent === "server_finden") return serverFindMove();
    if (intent === "version_update") return versionCheck();
    if (intent === "server_status") return serverStatusMove();
    if (intent === "aktualisieren") { await updatePack(); return refreshMe(); }
    if (intent === "lizenz_hilfe") return licenseMove(null, false);
    if (intent === "pack_status") return packStatus();
    const c = checkById(intent, battery);
    return c ? runChecks(false, [c]) : runChecks(false, battery);
  };

  // Explaining what he watches. The topic is the card named in the line; with none named, the card of
  // the last finding ("is that normal?"). Four lines at most, knowledge only - never a result.
  const knowMove = async (intent, line) => {
    if (intent === "bericht") {
      for (const l of reportLines(sinceFacts(), titleOf)) say("  " + l);
      const rs = last.map((x) => x.r).filter(Boolean);
      if (rs.length) {
        const p2 = saveReport(rs, { target: targetLabel(), lang: lang() });
        if (p2) {
          say("  " + mt().reportSaved(p2));
          if (downloadsDir() && interactive && await yesNo(mt().reportCopyAsk, { lenient: true })) {
            const dest = copyToDownloads(p2);
            say("  " + (dest ? mt().reportCopied(dest) : C("2", mt().reportCopyFail)));
          }
        }
      }
      return;
    }
    const cards = cardsOf(activePacks);
    let card = findCard(line, cards);
    if (!card && intent === "thema" && last.length) {
      const open = last.find(({ r }) => r.verdict !== SAFE) || last[0];
      card = cards.find((c) => c.id === (open.c.know || open.c.id)) || null;
    }
    const a = knowAnswer({ intent, line, cards, card });
    if (a.title) say("  " + C("1", a.title));
    a.lines.forEach((l) => say("  " + l));
    if (a.hint) say("  " + C("2", a.hint));
  };

  // ---- Wachschutz: Dante lays bait that calls home when a thief uses it; Dante itself stays silent. ----
  const GUARD_BASE = process.env.DANTE_GUARD_BASE || "https://api.nm-streetwear.space/dante";
  const GTOK = /^[A-Za-z0-9_-]{16,64}\.\d{10,16}\.[A-Za-z0-9_-]+$/;
  const WG = {
    de: {
      head: "Wachschutz",
      enrollAsk: "Wachschutz anschalten? Dante stellt sich dem Server mit einer eigenen Zufalls-ID vor — ein Aufruf, den du hier siehst.",
      enrolled: (lab, url) => [`Deine Wächter-Identität: ${lab}`, "Öffne den Link, trag deine Mail ein — erster Monat gratis:", "  " + url, "Danach zeigt dir die Seite einen Token. Gib ihn mir: wachschutz <token>"],
      active: (lab, d) => `Wachschutz aktiv — ${lab}, noch ${d} Tage. Köder legen: wachschutz köder <env|mcp|npm|aws>`,
      savedOk: (d) => `Token angenommen. Wachschutz aktiv, noch ${d} Tage. Köder legen: wachschutz köder <env|mcp|npm|aws>`,
      savedBad: "Der Token passt nicht zu diesem Dante. Hol dir einen frischen über den Link — tippe wachschutz.",
      needActive: "Erst anschalten: tippe wachschutz, öffne den Link, trag deine Mail ein.",
      off: "Der Wachschutz ist aus. Anschalten: tippe wachschutz (erster Monat gratis, ich zeige dir vorher den Aufruf).",
      laid: (p) => [`Köder gelegt: ${p}`, "Fass die Datei nicht an. Benutzt sie jemand, schreiben wir dir sofort."],
      exists: (p) => `Da liegt schon etwas: ${p}. Ich überschreibe nichts — sag einen anderen Ordner: wachschutz köder <art> <ordner>`,
      noKind: "Welche Art? wachschutz köder env | mcp | npm | aws",
      failNet: "Der Server war nicht erreichbar. Später nochmal.",
      curl: (u) => "  $ curl -sS -X POST " + u,
      nudge: "Tipp: Wachschutz legt Köder aus — klaut dir ein Angreifer oder fremder Agent einen, bekommst du sofort eine Mail. Erster Monat gratis: tippe „wachschutz“.",
    },
    en: {
      head: "Watch",
      enrollAsk: "Turn on the watch? Dante presents itself to the server with its own random id — one call, shown here.",
      enrolled: (lab, url) => [`Your watch identity: ${lab}`, "Open the link, enter your email — first month free:", "  " + url, "The page then shows a token. Give it to me: watch <token>"],
      active: (lab, d) => `Watch active — ${lab}, ${d} days left. Lay bait: watch bait <env|mcp|npm|aws>`,
      savedOk: (d) => `Token accepted. Watch active, ${d} days left. Lay bait: watch bait <env|mcp|npm|aws>`,
      savedBad: "That token is not for this Dante. Get a fresh one from the link — type watch.",
      needActive: "Turn it on first: type watch, open the link, enter your email.",
      off: "The watch is off. To turn it on: type watch (first month free, I show you the call first).",
      laid: (p) => [`Bait laid: ${p}`, "Do not touch the file. If someone uses it, we write to you at once."],
      exists: (p) => `Something is already there: ${p}. I overwrite nothing — name another folder: watch bait <kind> <folder>`,
      noKind: "Which kind? watch bait env | mcp | npm | aws",
      failNet: "The server was not reachable. Try again later.",
      curl: (u) => "  $ curl -sS -X POST " + u,
      nudge: "Tip: the watch lays bait — if an attacker or a rogue agent uses one, you get a mail at once. First month free: type “watch”.",
    },
    es: {
      head: "Vigilancia",
      enrollAsk: "¿Activar la vigilancia? Dante se presenta al servidor con su propia id aleatoria — una llamada que ves aquí.",
      enrolled: (lab, url) => [`Tu identidad de vigilancia: ${lab}`, "Abre el enlace, pon tu correo — primer mes gratis:", "  " + url, "La página te muestra un token. Dámelo: vigilancia <token>"],
      active: (lab, d) => `Vigilancia activa — ${lab}, quedan ${d} días. Pon señuelo: vigilancia señuelo <env|mcp|npm|aws>`,
      savedOk: (d) => `Token aceptado. Vigilancia activa, quedan ${d} días. Pon señuelo: vigilancia señuelo <env|mcp|npm|aws>`,
      savedBad: "Ese token no es para este Dante. Consigue uno nuevo con el enlace — escribe vigilancia.",
      needActive: "Actívala primero: escribe vigilancia, abre el enlace, pon tu correo.",
      off: "La vigilancia está apagada. Para encenderla: escribe vigilancia (primer mes gratis, antes te muestro la llamada).",
      laid: (p) => [`Señuelo puesto: ${p}`, "No toques el archivo. Si alguien lo usa, te escribimos enseguida."],
      exists: (p) => `Ya hay algo ahí: ${p}. No sobrescribo nada — di otra carpeta: vigilancia señuelo <tipo> <carpeta>`,
      noKind: "¿Qué tipo? vigilancia señuelo env | mcp | npm | aws",
      failNet: "El servidor no respondió. Prueba más tarde.",
      curl: (u) => "  $ curl -sS -X POST " + u,
      nudge: "Consejo: la vigilancia pone señuelos — si un atacante o un agente ajeno usa uno, recibes un correo al instante. Primer mes gratis: escribe «vigilancia».",
    },
  };
  const wachschutzMove = async (rest) => {
    const w = WG[lang()] || WG.de, file = guardFile();
    const tok = rest.find((x) => GTOK.test(x));
    if (tok) {
      const r = guardSaveToken(file, tok);
      if (!r) { say("  " + C("2", w.savedBad)); return; }
      say("  " + C("32", "✓") + " " + w.savedOk(Math.max(0, Math.ceil((r.until - Date.now()) / 86400000)))); return;
    }
    const a0 = (rest[0] || "").toLowerCase();
    if (/^(k[oö]der|koeder|bait|se[nñ]uelo|senuelo|decoy|lege|leg)$/.test(a0)) {
      const st = guardStatus(file);
      if (!st.active) { say("  " + C("2", w.needActive)); return; }
      const kind = (rest[1] || "").toLowerCase();
      if (!DECOY_KINDS[kind]) { say("  " + C("2", w.noKind)); return; }
      const dir = rest[2] ? rest[2].replace(/^~(?=[\/\\]|$)/, homedir()) : process.cwd();
      const id = guardIdentity(file), argv = decoyArgs(GUARD_BASE, id.id, id.secret, DECOY_KINDS[kind].label, kind);
      say("  " + C("2", w.curl(GUARD_BASE + "/api/guard/decoy")));
      const o = await waitFor(w.head, execProgramAsync("curl", argv, { timeout: 20000 }));
      const j = o.ok ? guardParse(o.out) : null;
      if (!j || !j.ok || !j.url) { say("  " + C("2", w.failNet)); return; }
      const d = decoyFile(kind, j.url, dir);
      if (d.exists) { say("  " + C("33", w.exists(d.path))); return; }
      try { writeFileSync(d.path, d.content, { mode: 0o600 }); } catch { say("  " + C("2", w.failNet)); return; }
      w.laid(d.path).forEach((l, i) => say("  " + (i === 0 ? C("1", l) : C("2", l))));
      diaryAppend({ kind: "act", what: "bait", detail: kind });
      return;
    }
    const st = guardStatus(file);
    if (st.active) { say("  " + C("1", w.active(st.label, st.days_left))); return; }
    if (!(await yesNo(w.enrollAsk, { lenient: true }))) { say("  " + C("2", t("nothing"))); return; }
    const id = guardIdentity(file), argv = enrollArgs(GUARD_BASE, id.id, id.secret);
    say("  " + C("2", w.curl(GUARD_BASE + "/guard/hello")));
    const o = await waitFor(w.head, execProgramAsync("curl", argv, { timeout: 20000 }));
    const j = o.ok ? guardParse(o.out) : null;
    if (!j || !j.ok) { say("  " + C("2", w.failNet)); return; }
    if (j.token) {   // this Dante is already bound and active: the server stamps the token again, nothing to open
      const r = guardSaveToken(file, j.token);
      if (r) { say("  " + C("32", "✓") + " " + w.savedOk(Math.max(0, Math.ceil((r.until - Date.now()) / 86400000)))); return; }
    }
    if (!j.url) { say("  " + C("2", w.failNet)); return; }
    w.enrolled(j.label || guardLabel(id.id), j.url).forEach((l) => say("  " + (/^\s*https/.test(l) ? C("36", l) : C("1", l))));
    if (j.url) await offerShop(j.url);   // the link opens after a clean yes, with the command shown first
  };

  // His own clock: when user.md is 20 days old he asks whether to look again, then fetches the packs.
  if (me && interactive && !process.env.DANTE_NO_CLOCK) { if (await clockFlow(io, me)) await updatePack(); me = readUser(); }

  // An expired pack: he says so, once a day at most, and offers the shop page (opened only after a yes).
  const expired = notices.filter((n) => n.code === "expired");
  if (expired.length && interactive && !process.env.DANTE_NO_NUDGE && nudgeExpiredDue(readAsked(), io.today())) {
    say("  " + C("33", pt().expiredPack(expired.map((n) => n.file.replace(/^pack-(\d+)\.json$/, "Pack Nr. $1")).join(", "))));
    writeAsked(io.today()); await offerShop();
  }

  // Old knowledge (30 days): he offers, once a week at most, to look in the catalog for packs the person lacks.
  if (interactive && !process.env.DANTE_NO_NUDGE && nudgeDue({ knowledgeDays: age(), lastAsked: readAsked(), today: io.today(), created: me && me.created })) await nudgeFlow(io);
  // Wachschutz: if it is not active, mention it at most once a day (and only sometimes), never when it is on.
  if (interactive && !process.env.DANTE_NO_NUDGE && guardMaybeNudge(guardFile(), io.today())) say("  " + C("33", (WG[lang()] || WG.de).nudge));

  // The call home of the test builds (src/lab is not in the published package: then this stays null and changes nothing).
  let turn = null;
  const closeTurn = () => { if (turn) { note(conv, turn.line, turn.intent, turn.route); if (turn.route !== "unclear") understood(conv); if (lab) lab.log({ ...turn, ctx: { menuAge: lastMenu ? turnNo - lastMenu.turn : null, open: last.filter(({ r }) => r.verdict !== SAFE).length, topic: lastTopic, target: !!target, asked: conv.asked } }); } turn = null; };
  let pending = null; // the guess Dante asked back about; a plain "ja" takes it
  const conv = newConv();   // what this conversation remembers (memory only, never written)
  for (;;) {
    footerNext(); // a new tip with every input, like a loading screen
    closeTurn();
    // input closed while something long was running (Ctrl-D, a pipe that ended): leave quietly instead of throwing
    let raw;
    try { raw = io.queue.length ? (say(C("32;1", "user ❯ ") + io.queue[0]), io.queue.shift()) : await rl.question("\n" + C("32;1", "user ❯ ")); } catch (e) { if (e && e.code === "ERR_USE_AFTER_CLOSE") break; throw e; }
    const line = (curLine = fixTypos(raw.trim()));   // "chek my mak" -> "check my mac": a fixed list of misspellings, nothing is guessed
    if (!line) continue;
    // "ich heiße Alex": the person names themselves; user.md takes it
    const said2 = line.match(/^(?:ich hei(?:ß|ss)e|mein name ist|nenn(?:e)? mich|call me|my name is|me llamo|ll[aá]mame)\s+([^\s].{0,38})$/i);
    if (said2) { const u = readUser(); if (u) { u.name = said2[1].trim().replace(/[.!]+$/, ""); writeUser(u); me = u; } say("  " + mt().nameSet(said2[1].trim().replace(/[.!]+$/, ""))); continue; }
    const [first, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ");
    const word = COMMANDS[first.toLowerCase()];
    const exact = word && (rest.length === 0 || ["server", "key", "lizenz", "pack", "sprache", "umschauen", "wachschutz"].includes(word));
    const tokenIn = (line.match(TOKEN_IN_LINE) || [])[0]; // a pasted token is recognised by its shape, no ear needed
    const heard = tokenIn ? { intent: "lizenz", ranked: [] } : pending && /^(ja|j|yes|y|si|sí|ok|genau)$/i.test(line) ? { intent: pending, ranked: [] }
      : exact ? { intent: word, ranked: [] } : hearMain(line);
    pending = null;
    // A line about Dante's own schedule is never "end the session", whatever the main ear heard.
    if (heard.intent === "raus" && !exact && SETUP_WORDS.test(line)) { heard.intent = "unklar"; heard.ranked = [{ intent: "unklar", p: 1 }]; }   // the domain ears get it; a neutral ranking, so he never asks "did you mean: raus?"
    setLang(langOf(line, lang()));
    const { ziel, pfad, lokal } = slots(line);
    const named = (re) => re.test(first) ? arg || null : null; // "server myhost" without an @ still counts
    // Which machine? "check my mac" is this machine; "check my server" with no address is answered from what he knows
    // (user.md, then known_hosts) instead of asking blind.
    let forceLocal = false;
    const gline = stripGreeting(line);   // a leading greeting must not hide the real request
    const prevTopic = lastTopic; lastTopic = null;     // what the last answer was about, for "welche noch?"
    turnNo++;
    let menuN = null, threadTo = null, linePick = null, aboutSv = null, roleSet = null, keyFor = null, keyPath = "";
    const menuNow = lastMenu && turnNo - lastMenu.turn <= 8 ? lastMenu : null;
    if (!exact && menuNow && (menuN = menuPick(line, menuNow.choices.length)) && menuNow.choices[menuN - 1].kind !== "hint") heard.intent = "menupick";
    // "mach mal bei dem zweiten", "nimm db", "und der andere?": a machine from the list on screen, or from the known servers in the order he shows them
    // "nimm ~/.ssh/deploy_key für den zweiten": a key for one of his servers - tried once (read-only) before it is written down
    else if (!exact && !ziel && (keyPath = saidKeyPath(line)) && ((keyFor = serverIn(line, (readUser() || {}).servers || [])))) heard.intent = "keyassign";
    // "was ist der zweite" asks about one of HIS servers; "der zweite ist die kasse" tells Dante what it is for (his word)
    else if (!exact && !ziel && (aboutSv = serverAbout(line, (readUser() || {}).servers || []))) heard.intent = "serverabout";
    else if (!exact && !ziel && (roleSet = serverRole(line, (readUser() || {}).servers || []))) heard.intent = "serverrole";
    else if (!exact && !ziel && (linePick = pickInLine(line, menuNow ? menuNow.choices : serverChoices(), target))) heard.intent = "linepick";
    else if (!exact && wantsMyName(line)) heard.intent = "myname";
    // a remote machine is meant (SSH, VPS, staging ...) but no target is named: ask which one, never fall back to this machine
    else if (!exact && !ziel && wantsRemote(line, false)) heard.intent = "needserver";
    // follow-ups ("welche noch?", "was sind die?", "mach du es", "warum?", "nochmal"): recognised once, sent to the topic of the last answer
    else if (!exact && prevTopic && (threadTo = threadRoute(actOf(line), prevTopic, { hasFix: last.some(({ r }) => r.verdict !== SAFE && r.fix), hasOpen: last.some(({ r }) => r.verdict !== SAFE), changedHost: !!changedHost, hasFleetNotes: fleetLast.some(({ rs }) => rs.some((r) => r.verdict === RISK || r.verdict === WARN)) })) && !(threadTo === "hostkeyfix" && !changedHost)) heard.intent = threadTo;
    else if (!exact && last.some(({ r }) => r.verdict !== SAFE && r.fix) && wantsHowFix(line)) heard.intent = "howfix";
    else if (!exact && wantsRecap(line)) heard.intent = "recap";
    else if (!exact && wantsCodeProof(line)) heard.intent = "codebeweis";
    else if (!exact && wantsWatchStatus(gline)) heard.intent = "watchstatus";
    else if (!exact && wantsSafeMe(gline) && !ziel) heard.intent = "pruef";
    else if (!exact && wantsWatch(gline)) heard.intent = "wachschutz";
    else if (!exact && wantsReport(gline)) heard.intent = "bericht";
    else if (!exact && wantsDeep(gline)) heard.intent = "tief";
    else if (!exact && wantsKeys(gline)) heard.intent = "schluessel";
    else if (!exact && wantsCapabilities(gline)) heard.intent = "hilfe";
    else if (!exact && !ziel && wantsWhatRunning(gline)) heard.intent = "sysinfo";
    else if (!exact && wantsServersCheck(line, !!ziel)) heard.intent = "serverscheck";
    else if (!exact && wantsServerList(line, !!ziel)) heard.intent = "serverliste";
    else if (!exact && (changedHost && wantsHostKeyLook(line))) heard.intent = "mitmauto";
    else if (!exact && wantsVersion(line)) heard.intent = "versioncheck";
    else if (!exact && wantsMitm(line)) heard.intent = "mitm";
    else if (!exact && wantsKeyFind(line)) heard.intent = "keyfind";
    else if (!exact && wantsAllSystems(line, !!ziel)) heard.intent = "systemealle";
    else if (!exact && wantsGoingOn(line, !!ziel)) heard.intent = "waslos";
    else if (!exact && wantsSysInfo(line, !!ziel)) heard.intent = "sysinfo";
    else if (!exact && wantsStatus(line, !!ziel)) heard.intent = "serverstatus";
    else if (!exact && wantsFind(line, !!ziel)) heard.intent = "serverfinden";
    else if (!exact && wantsServerList(line, !!ziel)) heard.intent = "serverliste";
    else if (!exact && wantsHealth(line, !!ziel)) { heard.intent = "pruef"; forceLocal = LOCAL_RE.test(line) && !/\b(server|servidor)\b/i.test(line); }
    else if (!exact && !ziel && wantsLocal(line, false)) { heard.intent = "pruef"; forceLocal = true; }
    else if (!exact && wantsServerPick(line, !!ziel)) heard.intent = "serverwahl";
    else if (!exact && wantsExplain(gline)) heard.intent = "erklaeren";
    else if (!exact && !ziel && wantsCheck(gline)) { heard.intent = "pruef"; forceLocal = true; }
    // A hard bolt, no probability: words of attack never reach a check, whatever the ear heard.
    if (ATTACK.test(line) && !DEFEND.test(line)) { say("  " + C("2", t("notMine"))); continue; }
    turn = { line, lang: lang(), route: exact ? "cmd" : heard.intent.startsWith("server") || /^(sysinfo|waslos|systemealle|mitm|mitmauto|keyfind)$/.test(heard.intent) ? "rule" : "main", intent: heard.intent, p: heard.ranked && heard.ranked[0] ? Number(heard.ranked[0].p.toFixed(2)) : 1 };
    switch (heard.intent) {
      case "raus": say("  " + C("2", t("bye"))); footerStop(); rl.close(); return;
      case "menupick": await applyPick(lastMenu.choices[menuN - 1], lastMenu.opts); break;
      case "keyassign": {
        const u = readUser(), sv = u && (u.servers || []).find((x) => x.alias === keyFor.alias);
        if (sv) { await assignKeyFlow({ mt, say, today: io.today, writeUser, diary: diaryAppend,
          tryKey: async (s2, key) => { const o = await waitFor(mt().keyTrying(s2.alias), job({ kind: "exec", scripts: ["true"], limit: 15000 }, { host: s2.target, key: expandKey(key) })); return o.reached ? { ok: true } : { ok: false, why: o.code, line: o.line }; } }, u, keyPath, async () => sv); me = readUser(); }
        break;
      }
      case "serverabout": for (const l of aboutLines(aboutSv, mt())) say("  " + l); break;
      case "serverrole": { const u = readUser(), sv = u && (u.servers || []).find((x) => x.alias === roleSet.server.alias); if (sv) { sv.role = roleSet.role; writeUser(u); me = u; say("  " + mt().roleSet(sv.alias, roleSet.role)); } break; }
      case "linepick": await applyPick(linePick, menuNow ? menuNow.opts : {}); break;
      case "howfix": {
        say("  " + C("2", HOWFIX.head[lang()]));
        for (const { r } of last.filter(({ r }) => r.verdict !== SAFE && r.fix).slice(0, 3)) {
          say("  " + C("1", tx(r.title)) + " - " + tx(r.fix.why || ""));
          r.fix.steps.forEach((st, i) => say("    " + (i + 1) + ") " + tx(st.desc) + "   " + C("2", "$ " + st.script)));
        }
        say("  " + C("33", HOWFIX.tail[lang()])); break;
      }
      case "recap": say(recap(conv, lang()).map((l) => "  " + l).join("\n")); break;
      case "codebeweis": say(CODE_PROOF[lang()].map((l) => "  " + l).join("\n")); break;
      case "gruss": say("  " + pick(t("hello"))); break;
      case "hilfe": say(help()); break;
      case "key": key = pfad || named(/^(key|schlüssel|llave|clave)$/i); configureTarget(target ? { host: target, key } : null); say("  " + C("2", t("key")) + (key || t("none"))); break;
      case "serverwahl": { await pickMove(); break; }
      case "serverliste": { await serverListMove(); break; }
      case "serverexplain": {
        const u = readUser(), regs = (u && u.servers) || [], seen = regs.filter((x) => x.os || x.what).length;
        lastTopic = "servers";
        say("  " + mt().srvExplain(regs.length, seen, regs.filter((x) => x.role).length));
        for (const l of mt().srvCanDo) say("  " + C("2", l));
        break;
      }
      case "serverthese": {
        const u = readUser(), regs = (u && u.servers) || [];
        lastTopic = "servers";
        if (regs.length) for (const sv of regs) say("  " + describe(sv, mt())); else say("  " + mt().srvThese);
        for (const l of mt().srvCanDo) say("  " + C("2", l));
        break;
      }
      case "servermore": { await serverListMove({ all: true }); break; }
      case "serverscheck": { await serverStatusMove(); break; }
      case "sysinfo": { await sysMove("info"); break; }
      case "systemealle": { await allSystemsMove(); break; }
      case "watchstatus": {
        const w = WG[lang()] || WG.de, st = guardStatus(guardFile());
        say("  " + (st.active ? C("1", w.active(st.label, st.days_left)) : C("2", w.off)));
        break;
      }
      case "myname": { const u = readUser(); say("  " + (u && u.name ? mt().nameIs(u.name) : mt().nameUnknown)); break; }
      case "needserver": {
        const u = readUser(), known = ((u && u.servers) || []).length + knownHosts(homedir(), ((u && u.servers) || []).map((x) => x.alias)).length;
        if (!known) { lastTopic = "servers"; say("  " + mt().needServer); break; }
        say("  " + mt().needServerWhich); await pickMove(); break;
      }
      case "fleetdetail": fleetDetailMove(); lastTopic = "fleet"; break;
      case "hostkeyfix": await hostkeyFixMove(changedHost); lastTopic = "fleet"; break;   // "nochmal" after this means: look at the servers again
      case "hostkeywhy": lastTopic = "hostkey"; for (const l of mt().hkWhy) say("  " + l); break;
      case "mitmauto": { await mitmMove(changedHost, { auto: true }); break; }
      case "keyfind": { await keysFlow({ mt, say, local: async (c) => { const r = await runLocalAsync(c, { timeout: 15000 }); return { out: r.out, ok: r.ok }; }, exec: execProgram }, readUser()); break; }
      case "mitm": { const h = (line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/) || [])[0] || changedHost; await mitmMove(h, { auto: true }); break; }
      case "waslos": { await sysMove("activity"); break; }
      case "serverfinden": { await serverFindMove(); break; }
      case "serverstatus": { await serverStatusMove(); break; }
      case "server": {
        const to = ziel || named(/^(server|ziel|servidor|target)$/i) || target;
        if (!to || (!ziel && badTarget(to))) { if (to && !target) say("  " + C("33", mt().pickBad(to))); await pickMove(); break; }
        target = to; configureTarget({ host: target, key }); say("  " + C("2", t("target")) + targetLabel()); await runChecks(false); break;
      }
      case "lokal": target = null; configureTarget(null); say("  " + C("2", t("target") + "localhost")); break;
      case "pruef": if ((lokal || forceLocal) && target) { target = null; configureTarget(null); say("  " + C("2", t("target") + "localhost")); } await runChecks(false); break;
      case "fix": await runChecks(true); break;
      case "demo": { configureTarget(target ? { host: target, key } : null); run("touch /tmp/dante-demo-hole"); const r = demo.run(); say(renderResult(r)); if (r.fix) await finding(demo, r); break; }
      case "smalltalk": say(pick(ANSWERS.smalltalk[lang()]).map((l) => "  " + l).join("\n")); break;
      case "frage_luecke": case "frage_urteil": case "frage_gehackt": case "frage_dante":
        warmDomain();
        // "zeig mir die zeile die das beweist" overlaps frage_urteil (what a Beleg is). If a check
        // already ran and the system ear is sure it is a beleg ask, show the real last line instead
        // of explaining the concept.
        if (heard.intent === "frage_urteil" && last.length && hearSystem(line).intent === "beleg") { await systemMove("beleg"); break; }
        // The richer card answer wins when the person asks about what Dante watches, or names a topic.
        { const w = hearWissen(line), named = findCard(line, cardsOf(activePacks)) !== null;
          // job questions always; a topic question when a topic is named or a finding is on screen
          if (w.intent === "job" || w.intent === "bericht" || (w.intent === "thema" && (named || (last.length && heard.intent !== "frage_dante")))) { await knowMove(w.intent, line); break; } }
        say(ANSWERS[heard.intent][lang()].map((l) => "  " + l).join("\n")); break;
      case "sprache": {
        const want = { de: "de", deutsch: "de", german: "de", alemán: "de", aleman: "de", en: "en", english: "en", englisch: "en", inglés: "en", ingles: "en", es: "es", español: "es", espanol: "es", spanisch: "es", spanish: "es" }[arg.toLowerCase()];
        if (!want) { say("  " + C("2", t("langHow"))); break; }
        setLang(want); saveLang(want); say("  " + C("32", "✓") + " " + t("langSet")); break;   // said in the new language
      }
      case "umschauen": await onboard(io); me = readUser(); break;
      case "scharf": { const u = readUser(); if (!u) say("  " + C("2", mt().needLook)); else await armFlow(io, u); break; }
      case "abschalten": await disarmFlow(io, readUser()); break;
      case "kaufen": await nudgeFlow(io, { force: true }); break;
      case "hf": await hfMove(); break;
      case "tief": await deepMove(); break;
      case "lizenz": await licenseMove(tokenIn || null, rest.length > 0); break;
      case "wachschutz": await wachschutzMove(exact ? rest : (guardStatus(guardFile()).active ? watchArgs(line) : [])); break;
      case "bericht": await knowMove("bericht", line); break;
      case "erklaeren": await knowMove("thema", line); break;
      case "schluessel": await musterMove("schluessel"); break;
      case "aktualisieren": await versionCheck(); await updatePack(); await refreshMe(); break;
      case "version": say("  " + mt().verHave(VERSION, BIB_DATE)); break;
      case "versioncheck": await versionCheck(); break;
      case "pack": if (arg) installFile(arg); else packStatus(); break;
      case "karte": if (!last.length) { const [m0, m1, m2] = t("noMap"); say("  " + C("2", m0) + C("1", m1) + m2); } else for (const { r } of last) say(renderResult(r)); break;
      default: {
        // The main ear has a gap -> the domain ears (muster, system, wissen) get a turn. Each also knows
        // what is not its own, and each is conservative (both neurons must be sure), so plain talk is
        // never pulled into a patrol or an explanation.
        warmDomain();
        let dom = hearDomain(line);
        // "wie gehts bro" is a greeting, not "how are my servers": a look at all servers needs a machine in the line
        if (dom && dom.intent === "server_status" && !namesMachines(line)) { turn = { ...turn, route: "main", intent: "gruss" }; say("  " + pick(t("hello"))); break; }
        if (dom) { turn = { ...turn, route: "domain:" + dom.ear, intent: dom.intent }; }
        // Optional hook for test builds (absent in the published package): a line nobody understood can be sorted into a template by a helper service.
        const zen = !dom && lab ? await waitFor("…", lab.ask({ line, lang: lang(), heard: { intent: heard.intent, ranked: (heard.ranked || []).slice(0, 3) }, version: VERSION })) : null;
        if (zen && (await viaZentrale(zen, line))) { turn = { ...turn, route: "zentrale", intent: zen.intent, ear: zen.ear }; break; }
        if (dom) { if (dom.ear === "muster") await musterMove(dom.intent); else if (dom.ear === "system") await systemMove(dom.intent); else knowMove(dom.intent, line); break; }
        // Not sure -> ask back, but only with a close guess, never the same one twice, and a long line gets a plain request.
        turn = { ...turn, route: "unclear" };
        const fb = fallback(conv, line, heard.ranked);
        if (fb.kind === "long" || fb.kind === "again") say("  " + C("2", FALLBACK[fb.kind][lang()]));
        else if (fb.kind === "none") say("  " + C("2", ANSWERS.unklar[lang()][0]));
        else { pending = fb.guesses[0].intent; say("  " + C("2", t("meant")) + fb.guesses.map((g) => C("1", t("word")[g.intent]) + C("2", ` (${Math.round(g.p * 100)} %)`)).join(C("2", t("or"))) + C("2", "?")); }
      }
    }
  }
  closeTurn();
  rl.close();
}
