// Interactive session: banner, loading bar while the classifiers start, then the chat loop with the
// tip footer. The classifier proposes an intent with a probability; when unsure it asks back. Everything
// runs locally. Leave with "raus".
import { createInterface } from "node:readline/promises";
import { readFileSync, statSync } from "node:fs";
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
import { setKnowledge, age, BIB_DATE } from "./ticker.mjs";
import { waitFor } from "./ui/wait.mjs";
import { footerStart, footerStop, footerNext, setTitle } from "./ui/footer.mjs";
import { job } from "./ui/job.mjs";
import { OVERVIEW, parseOverview } from "./me/overview.mjs";
import { read as readUser, write as writeUser } from "./me/user.mjs";
import { append as diaryAppend, readAll as diaryAll, facts as diaryFacts } from "./me/diary.mjs";
import * as schedule from "./me/schedule.mjs";
import * as deepSchedule from "./me/schedule-deep.mjs";
import { deep as deepRun } from "./me/deep.mjs";
import { holder } from "./me/lock.mjs";
import { wantsLocal, wantsServerPick, badTarget, options as pickOptions, pickFlow } from "./me/pick.mjs";
import { pool } from "./me/pool.mjs";
import { wantsServerList, wantsHealth, wantsFind, wantsStatus, wantsMore, wantsServersCheck, serversFlow, findFlow } from "./me/servers.mjs";
import { wantsSysInfo, wantsGoingOn, wantsAllSystems } from "./me/sysq.mjs";
import { VERSION, atLeast } from "./version.mjs";
import { wantsKeyFind, wantsHostKeyLook, keysFlow } from "./me/keys.mjs";
import { collect as hkCollect, judge as hkJudge, describe as hkDescribe, wantsMitm, validHostName } from "./me/hostkey.mjs";
import { script as sysScript, nativeOutput as sysNative } from "./me/sysid.mjs";
import { report as sysReport } from "./me/sysreport.mjs";
import { LOCAL_RE } from "./me/pick.mjs";
// words that open a yes, and words that spoil one; words that ask for an explanation instead of answering
const LEADING_YES = /^\s*["'¡]*(?:ja+|jap|jo|jawohl|klar|gern(?:e)?|na klar|okay|ok|yes+|yep|yeah|yup|sure|please|of course|go ahead|go on|s[ií]+|sip|claro|vale|adelante|dale|por favor|bitte|mach(?: ruhig)?|los|schau|look)(?![\p{L}])/iu;
const NEGATION = /(?<![\p{L}])(?:nein|nee|nicht|nie|no|nope|don'?t|do not|never|stop|halt|nunca|ni|aber nicht|lieber nicht)(?![\p{L}])/iu;
const LEADING_NO = /^\s*["'¡]*(?:nein|nee|ne|nö|nope|no|nicht|lieber nicht|nada|nunca)(?![\p{L}])/iu;
const ASKS_WHAT = /\?|(?<![\p{L}])(?:was (?:ist|heißt|bedeutet|macht)|erkl[aä]r\p{L}*|what(?:'s| is| does)|explain|qu[eé] (?:es|significa)|no s[eé] qu[eé]|ich wei(?:ß|ss) nicht was)(?![\p{L}])/iu;
const wantsVersion = (l) => /(?<![\p{L}])(?:meine version|welche version|neueste version|aktuelle version|neuere version|bin ich (?:auf dem )?(?:neuesten|aktuell\p{L}*)|gibt es (?:ein |eine )?(?:update|neue version)|ist (?:da |ein )?(?:ein )?update|what version|which version|latest version|newer version|am i up to date|any updates?|is there an update|qu[eé] versi[oó]n|[uú]ltima versi[oó]n|versi[oó]n m[aá]s nueva|estoy actualizado|hay (?:una )?(?:actualizaci[oó]n|versi[oó]n nueva))(?![\p{L}])/iu.test(l);
const SYSTEMS = JSON.parse(readFileSync(new URL("./bib/systems.json", import.meta.url), "utf8")).systems;
import { knownHosts, sshHosts, historyTargets } from "./me/recon.mjs";
import { lookAround } from "./me/recon.mjs";
import { onboard, armFlow, disarmFlow } from "./me/onboard.mjs";
import { refreshFlow, clockFlow } from "./me/refresh.mjs";
import { nudgeFlow, due as nudgeDue, expiredDue as nudgeExpiredDue, readAsked, writeAsked, openCommand, curlShown as catalogCurl, CATALOG_URL, openArgv } from "./me/nudge.mjs";
import { mt, reportLines } from "./me/texts.mjs";
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
  footerStart(); // the loading-screen tips, pinned under the chat

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
      // a question that only lets Dante look: "ja klar, schau nach, aber …" is a yes (a "no" or "don't" anywhere makes it unclear again)
      if (opts.lenient && LEADING_YES.test(a) && !NEGATION.test(a)) return "yes";
      const words = a.trim().split(/\s+/).length;
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
      if (!o.reached) return { ok: false, code: o.code, line: o.line };
      const kv = parseOverview(o.outs[0].out);
      return { ok: !!kv.label, label: kv.label, php: (kv.PHP || "").replace(/^PHP\s+/, "").split(" ")[0] };
    },
    // the buying nudge: the curl that is shown is the curl that runs; nothing of the person goes out
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
    const open = last.filter(({ r }) => r.verdict === RISK || r.verdict === WARN && r.fix);
    if (open.length && !withFix) say("\n  " + C("2", t("canFix")) + C("1", "fix") + C("2", "."));
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
    if (changedHost && validHostName(changedHost) && (await yesNo(mt().mitmAsk(changedHost), { lenient: true }))) await mitmMove(changedHost);
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
    diaryAppend({ kind: "act", what: "hostkey", detail: host });
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
  const yesNo = async (q, { lenient = false } = {}) => { const a = (await rl.question("  " + q + " ")).trim(); return hear(a) === "yes" || (lenient && LEADING_YES.test(a) && !NEGATION.test(a)); };
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
  const offerShop = async () => {
    const o = openArgv(BUY_URL);
    if (o) say("  " + C("2", "→ " + o.join(" ")));   // the command that runs is shown first
    if (!(await yesNo(mt().askOpen, { lenient: true }))) return;
    const r = await io.openPage(BUY_URL);
    say("  " + (r.ok ? mt().opened : mt().noOpener(BUY_URL)));
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
    await pool(servers, async (s) => {
      const res = await job({ kind: "checks", ids, limit: 120000 }, { host: s.target, key: s.key ? s.key.replace(/^~(?=\/)/, homedir()) : null }).catch((e) => ({ reached: false, line: String((e && e.message) || e) }));
      if (!res.reached) { down++; if (res.code === "hostkey_changed") changed.push(s); say("  " + C("2", mt().fleetDown(s.alias, mt().sshWhy(res.code, String(res.line || "").slice(0, 60))))); return; }
      const rs = (res.results || []).filter(Boolean), n = (v) => rs.filter((r) => r.verdict === v).length;
      if (n("risk")) open++; else if (n("warn")) notes++;
      say("  " + (n("risk") ? C("31", "●") : n("warn") || n("unknown") ? C("33", "●") : C("32", "●")) + " " + mt().fleetLine(s.alias, n("risk"), n("warn"), n("unknown")));
    }, 4);
    say("  " + mt().fleetDone(open, notes, down));
    for (const sv of changed) await offerMitm("hostkey_changed", sv.target);
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
  };
  const sysMove = async (mode) => {
    const wordsServer = /(^|[^\p{L}])(server|servidor(es)?|servern)([^\p{L}]|$)/iu.test(curLine);
    if (LOCAL_RE.test(curLine) && !wordsServer) { configureTarget(null); return sysOne(null, "localhost", mode); }
    if (target) return sysOne(target$(), targetLabel(), mode);
    const u = readUser();
    if (wordsServer && u && (u.servers || []).length) return pickMove({ sys: mode });
    return sysOne(null, "localhost", mode);
  };
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
    if (!o) { say("  " + C("2", mt().pickNone)); return; }
    return applyPick(o, opts);
  };
  // What such a helper may order Dante to do on its own: only answers and looks. Anything that changes something still asks, as everywhere.
  const viaZentrale = async (z, line) => {
    const ok = new Set(["gruss", "hilfe", "smalltalk", "karte", "frage_dante", "frage_luecke", "frage_urteil", "frage_gehackt", "pruef"]);
    if (z.ear === "muster") { await musterMove(z.intent); return true; }
    if (z.ear === "system") { await systemMove(z.intent); return true; }
    if (z.ear === "wissen") { knowMove(z.intent, line); return true; }
    if (z.ear === "main" && ok.has(z.intent)) {
      if (z.intent === "gruss") say("  " + pick(t("hello"))); else if (z.intent === "hilfe") say(help()); else if (z.intent === "karte") { for (const { r } of last) say(renderResult(r)); }
      else if (z.intent === "pruef") await runChecks(false); else if (z.intent === "smalltalk") say(pick(ANSWERS.smalltalk[lang()]).map((l) => "  " + l).join("\n"));
      else say(ANSWERS[z.intent][lang()].map((l) => "  " + l).join("\n"));
      return true;
    }
    return false;
  };
  const musterMove = async (intent) => {
    if (intent === "umschauen") { await onboard(io); me = readUser(); return; }
    if (intent === "scharf") { const u = readUser(); if (!u) say("  " + C("2", mt().needLook)); else await armFlow(io, u); return; }
    if (intent === "abschalten") { if (!schedule.isArmed() && !deepSchedule.isArmed()) return disarmFlow(io, readUser()); if (await yesNo(mt().disarmAsk)) return disarmFlow(io, readUser()); say("  " + C("2", mt().disarmKept)); return; }
    if (intent === "patrouille") return runChecks(false, battery);
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
  const knowMove = (intent, line) => {
    if (intent === "bericht") { for (const l of reportLines(sinceFacts(), titleOf)) say("  " + l); return; }
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

  // The call home of the test builds (src/lab is not in the published package: then this stays null and changes nothing).
  let turn = null;
  const closeTurn = () => { if (turn) { note(conv, turn.line, turn.intent, turn.route); if (turn.route !== "unclear") understood(conv); if (lab) lab.log(turn); } turn = null; };
  let pending = null; // the guess Dante asked back about; a plain "ja" takes it
  const conv = newConv();   // what this conversation remembers (memory only, never written)
  for (;;) {
    footerNext(); // a new tip with every input, like a loading screen
    closeTurn();
    const line = (curLine = (io.queue.length ? (say(C("32;1", "user ❯ ") + io.queue[0]), io.queue.shift()) : await rl.question("\n" + C("32;1", "user ❯ "))).trim());
    if (!line) continue;
    // "ich heiße Alex": the person names themselves; user.md takes it
    const said2 = line.match(/^(?:ich hei(?:ß|ss)e|mein name ist|nenn(?:e)? mich|call me|my name is|me llamo|ll[aá]mame)\s+([^\s].{0,38})$/i);
    if (said2) { const u = readUser(); if (u) { u.name = said2[1].trim().replace(/[.!]+$/, ""); writeUser(u); me = u; } say("  " + mt().nameSet(said2[1].trim().replace(/[.!]+$/, ""))); continue; }
    const [first, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ");
    const word = COMMANDS[first.toLowerCase()];
    const exact = word && (rest.length === 0 || ["server", "key", "lizenz", "pack", "sprache", "umschauen"].includes(word));
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
    const prevTopic = lastTopic; lastTopic = null;     // what the last answer was about, for "welche noch?"
    turnNo++;
    let menuN = null;
    if (!exact && lastMenu && turnNo - lastMenu.turn <= 8 && (menuN = menuPick(line, lastMenu.choices.length)) && lastMenu.choices[menuN - 1].kind !== "hint") heard.intent = "menupick";
    else if (!exact && last.some(({ r }) => r.verdict !== SAFE && r.fix) && wantsHowFix(line)) heard.intent = "howfix";
    else if (!exact && wantsRecap(line)) heard.intent = "recap";
    else if (!exact && wantsCodeProof(line)) heard.intent = "codebeweis";
    else if (!exact && prevTopic === "servers" && wantsMore(line)) heard.intent = "servermore";
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
    // A hard bolt, no probability: words of attack never reach a check, whatever the ear heard.
    if (ATTACK.test(line) && !DEFEND.test(line)) { say("  " + C("2", t("notMine"))); continue; }
    turn = { line, lang: lang(), route: exact ? "cmd" : heard.intent.startsWith("server") || /^(sysinfo|waslos|systemealle|mitm|mitmauto|keyfind)$/.test(heard.intent) ? "rule" : "main", intent: heard.intent, p: heard.ranked && heard.ranked[0] ? Number(heard.ranked[0].p.toFixed(2)) : 1 };
    switch (heard.intent) {
      case "raus": say("  " + C("2", t("bye"))); footerStop(); rl.close(); return;
      case "menupick": await applyPick(lastMenu.choices[menuN - 1], lastMenu.opts); break;
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
      case "servermore": { await serverListMove({ all: true }); break; }
      case "serverscheck": { await serverStatusMove(); break; }
      case "sysinfo": { await sysMove("info"); break; }
      case "systemealle": { await allSystemsMove(); break; }
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
          if (w.intent === "job" || w.intent === "bericht" || (w.intent === "thema" && (named || (last.length && heard.intent !== "frage_dante")))) { knowMove(w.intent, line); break; } }
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
      case "tief": {
        if (holder("deep")) { say("  " + mt().deepSkipped); break; }
        say("  " + C("2", mt().deepStart));
        const lines = [];
        await waitFor(mt().deepStart, deepRun({ log: (l) => lines.push(l) }));
        const last2 = diaryAll().filter((e) => e.kind === "run" && e.deep).slice(-1)[0];
        const rs = (last2 && last2.results) || [], n = (v) => rs.filter((r) => r.v === v).length;
        say("  " + mt().deepDone(n("risk"), n("warn"), n("unknown")));
        for (const r of rs.filter((r) => r.v === "risk" || r.v === "warn")) say("  " + C("2", `${r.v}: ${r.l}`));
        break;
      }
      case "lizenz": await licenseMove(tokenIn || null, rest.length > 0); break;
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
        const dom = hearDomain(line);
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
