// Deep check for secrets in project files (keys, tokens, private keys, passwords), built from a
// secret_format rule. A router picks the pattern groups by marker files (package.json, composer.json, ...).
// A hit is followed up with file mode and git state (tracked, in history, ignored). The report names file,
// line and kind of secret but never the value. Local scans run in Node, remote ones with the server's grep.
import { run, targetLabel } from "../core/sh.mjs";
import { result, evidence, SAFE, WARN, RISK, UNKNOWN } from "../core/check.mjs";
import { webRoots, lines, sq } from "./common.mjs";
import { loc } from "./loc.mjs";
import { lang } from "../i18n.mjs";
import { read as readUser } from "../me/user.mjs";
import { homedir } from "node:os";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { toJs, literalOf, automaton } from "../pack/ere.mjs";
import { isWindows, isOwnerOnly } from "../core/perm.mjs";
import { findFiles, execProgram } from "../core/fsx.mjs";
import { isLocalTarget } from "../core/sh.mjs";

const SKIP = ["node_modules", ".git", "vendor", "dist", "build", ".venv", "venv", "__pycache__", "Pods", "target", ".next", ".cache"];
const MARKERS = [
  ["node", "package.json"], ["php", "composer.json"], ["python", "requirements.txt"], ["python", "pyproject.toml"], ["go", "go.mod"],
  ["ruby", "Gemfile"], ["java", "pom.xml"], ["java", "build.gradle"], ["rust", "Cargo.toml"], ["apple", "*.xcodeproj"], ["apple", "Package.swift"],
];
// Example files and placeholder lines are not secrets: a template (.env.example) is meant to be committed, and a
// line that reads "xxxxxx", "YOUR_KEY_HERE" or "<token>" holds no key. The line is judged inside the shell; it is
// never printed.
const EXAMPLE_FILES = ["*.example", "*.sample", "*.dist", "*.template", "*.tpl"];
export const PLACEHOLDER = "x{6,}|X{6,}|\\*{4,}|example|sample|your[_ -]|changeme|change_me|placeholder|dummy|replace[_ -]?me|insert[_ -]|<[A-Za-z_ -]+>|todo|fake|redacted";
// Which files are looked at: no skipped folders, no example files, nothing over 400 KB (secrets live in small
// config and code files; big data files are slow and noisy) - the same list for every group of patterns.
const PRUNE = SKIP.map((d) => "-name " + sq(d)).join(" -o ");
const NOT_EXAMPLE = EXAMPLE_FILES.map((f) => "! -name " + sq(f)).join(" ");
const pickFiles = (roots) => `find ${roots.map(sq).join(" ")} \\( ${PRUNE} \\) -prune -o -type f -size -400k ${NOT_EXAMPLE} -print0 2>/dev/null`;
const MAX_FILES = 12;      // how many hit files he drills into
const SCAN_SECONDS = 120;

const fname = (f) => (f.i18n && f.i18n[lang()]) || f.name;
const expand = (p) => String(p || "").replace(/^~(?=\/)/, homedir());

// Where to look: the web roots of the target and, on this machine, the project folders from user.md.
export function scanRoots() {
  const wr = webRoots();
  const roots = [...wr.roots];
  if (targetLabel() === "localhost") {
    const u = readUser();
    for (const p of (u && u.projects) || []) { const e = expand(p); if (e && !roots.includes(e)) roots.push(e); }
  }
  return { ran: wr.ran, roots, line: wr.line };
}

// The router: which systems are present under these roots (real marker files found), plus the machine itself.
export function routeSystems(roots) {
  const found = new Set(["generic", "web"]);
  let lineSet, os;
  if (isLocalTarget()) {
    // this machine: Node looks for the marker files (no shell), the machine itself comes from the platform
    lineSet = findFiles(roots, { names: MARKERS.map(([, n]) => n), depth: 4, worldReadable: false, limit: 200, skipDirs: ["node_modules"] }).files;
    os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
  } else {
    const find = MARKERS.map(([, n]) => "-name " + sq(n)).join(" -o ");
    const r = run("find " + roots.map(sq).join(" ") + " -maxdepth 4 \\( " + find + " \\) -not -path '*/node_modules/*' 2>/dev/null | head -200", { timeout: 40000 });
    lineSet = lines(r.out, 200);
    os = /darwin/i.test(run("uname -s").out) ? "darwin" : "linux";
  }
  for (const [sys, n] of MARKERS) { const tail = n.replace("*", ""); if (lineSet.some((l) => l.endsWith(tail))) found.add(sys); }
  if (os === "darwin") found.add("apple"); else if (os === "linux") found.add("linux");   // Windows adds no system of its own yet
  return { systems: [...found], line: lineSet[0] || "(keine Projekt-Dateien gefunden)" };
}

// grep -E pattern list for the given formats
const eArgs = (fs) => fs.map((f) => "-e " + sq(f.re)).join(" ");
const CHUNK = 250;   // patterns per grep call: keeps the command short (ssh, ARG_MAX) and the grep fast
const chunks = (fs) => Array.from({ length: Math.ceil(fs.length / CHUNK) }, (_, i) => fs.slice(i * CHUNK, (i + 1) * CHUNK));

// The grep on the target decides what it understands (GNU, BSD and ugrep differ). A pattern it refuses must not
// silently turn into "nothing found": test the list on empty input, split it until the refused ones are known, and
// say so. Returns { ok: usable formats, refused: count, ran }.
export function usable(fs) {
  const test = (list) => run(`printf '' | grep -E ${eArgs(list)} >/dev/null 2>&1; echo $?`, { timeout: 20000 });
  const rc = (r) => (r.ran ? Number((r.out || "").trim().split("\n").pop()) : NaN);
  const ok = [];
  let refused = 0, ran = true;
  const go = (list) => {
    if (!list.length) return;
    const r = test(list), c = rc(r);
    if (!r.ran || Number.isNaN(c)) { ran = false; return; }
    if (c < 2) { ok.push(...list); return; }
    if (list.length === 1) { refused++; return; }
    const h = Math.ceil(list.length / 2);
    go(list.slice(0, h)); go(list.slice(h));
  };
  for (const c of chunks(fs)) go(c);
  return { ok, refused, ran };
}

export function drill(file0) {
  if (isLocalTarget()) return drillLocal(file0);
  const file = file0.replace(/\\/g, "/");   // a path goes to the remote shell with "/"
  const dir = file.replace(/\/[^/]*$/, "") || "/";
  const script = [
    `f=${sq(file)}; d=${sq(dir)}`,
    `m=$(ls -ld "$f" | cut -c1-10)`,
    `if git -C "$d" rev-parse --is-inside-work-tree >/dev/null 2>&1; then`,
    `  if git -C "$d" ls-files --error-unmatch "$f" >/dev/null 2>&1; then g=tracked`,
    `  elif [ -n "$(git -C "$d" log --oneline -1 -- "$f" 2>/dev/null)" ]; then g=history`,
    `  elif git -C "$d" check-ignore -q "$f" 2>/dev/null; then g=ignored`,
    `  else g=untracked; fi`,
    `else g=nogit; fi`,
    `echo "$m $g"`,
  ].join("\n");
  const r = run(script, { timeout: 15000 });
  const [mode = "", git = "nogit"] = (r.out.split("\n").pop() || "").trim().split(/\s+/);
  return { ran: r.ran && !!mode, mode, git, worldReadable: mode[7] === "r", line: r.out.split("\n").pop() || "" };
}

// Rights and git state of one file on THIS machine, without a shell. On Windows "who may read" comes from icacls (the
// shell's mode string is made up there); if that cannot be read it is unknown, which never counts as "readable by all".
const modeString = (st) => (st.isDirectory() ? "d" : "-") + [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001].map((b, i) => (st.mode & b ? "rwx"[i % 3] : "-")).join("");
export function drillLocal(file) {
  let st; try { st = statSync(file); } catch { return { ran: false, mode: "", git: "nogit", worldReadable: false, line: "" }; }
  const dir = file.replace(/[\\/][^\\/]*$/, "") || ".";
  const gitq = (...a) => execProgram("git", ["-C", dir, ...a], { timeout: 15000 });
  let g;
  if (!gitq("rev-parse", "--is-inside-work-tree").ok) g = "nogit";
  else if (gitq("ls-files", "--error-unmatch", file).ok) g = "tracked";
  else if (gitq("log", "--oneline", "-1", "--", file).out.trim()) g = "history";
  else if (gitq("check-ignore", "-q", file).ok) g = "ignored";
  else g = "untracked";
  const win = isWindows(), owner = win ? isOwnerOnly(file) : null;
  const mode = win ? (owner === true ? "owner-only" : owner === false ? "others-may-read" : "unknown") : modeString(st);
  return { ran: true, mode, git: g, worldReadable: win ? owner === false : (st.mode & 0o004) !== 0, line: mode + " " + g };
}

// ---- the search on this machine, in Node: prefilter with Aho-Corasick on the fixed text of every pattern, then
// only the patterns whose text occurs in the file are tried, line by line. Placeholder lines are skipped here.
const PH = new RegExp(PLACEHOLDER, "i");
const isExample = (n) => /\.(example|sample|dist|template|tpl)$/.test(n);
export function scanNode(roots, fs, { budgetMs = SCAN_SECONDS * 1000, maxFiles = 300000 } = {}) {
  const start = Date.now();
  const mine = [];
  let skipped = 0;
  for (const f of fs) { const js = toJs(f.re), lit = literalOf(f.re); if (js && lit.length >= 3) mine.push({ f, js, lit }); else skipped++; }
  if (!mine.length) return { ok: false, why: "Keins der Muster lässt sich hier lesen" };
  const lits = [...new Set(mine.map((x) => x.lit))], byLit = new Map(lits.map((l, i) => [i, mine.filter((x) => x.lit === l)]));
  const find = automaton(lits);
  const out = [];
  let seen = 0, incomplete = "";
  const stack = [...roots];
  while (stack.length && !incomplete) {
    const dir = stack.pop();
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { continue; }   // an unreadable folder is skipped
    for (const e of ents) {
      if (Date.now() - start > budgetMs) { incomplete = "Zeitlimit erreicht"; break; }
      if (seen > maxFiles) { incomplete = "zu viele Dateien"; break; }
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.includes(e.name)) stack.push(p); continue; }
      if (!e.isFile() || isExample(e.name)) continue;
      let buf; try { if (statSync(p).size > 400 * 1024) continue; buf = readFileSync(p); } catch { continue; }
      seen++;
      if (buf.subarray(0, 4096).includes(0)) continue;                    // binary
      const text = buf.toString("latin1"), got = find(text);
      if (!got.size) continue;
      const lines = text.split("\n"), hit = [];
      for (const id of got) for (const x of byLit.get(id)) {
        for (let i = 0; i < lines.length; i++) if (lines[i].length < 2000 && x.js.test(lines[i]) && !PH.test(lines[i])) { hit.push({ f: x.f, n: i + 1 }); break; }
      }
      if (hit.length) { hit.sort((a, b) => a.n - b.n); out.push({ file: p, hit }); if (out.length >= MAX_FILES * 4) { incomplete = ""; stack.length = 0; break; } }
    }
  }
  if (incomplete) return { ok: false, why: incomplete + ` (${seen} Dateien gelesen)` };
  return { ok: true, files: out, seen, used: mine.length, cmd: `Node: ${lits.length} feste Texte (Aho-Corasick) → ${mine.length} Formate`, note: skipped ? { claim: `${skipped} Muster lassen sich hier nicht lesen und fallen weg`, src: { cmd: "ERE → JS", line: `${mine.length} von ${fs.length} Mustern brauchbar` } } : null };
}

// ---- the search on a server: its own grep, in groups of patterns (see usable()).
export function scanGrep(roots, fs) {
  const use = usable(fs);
  if (!use.ran || !use.ok.length) return { ok: false, why: "Das grep dort versteht die Muster nicht" };
  const groups = chunks(use.ok), found = new Set();
  for (const g of groups) {
    const g1 = run(`${pickFiles(roots)} | xargs -0 grep -lIsE ${eArgs(g)} 2>/dev/null | head -${MAX_FILES * 4}`, { timeout: SCAN_SECONDS * 1000 });
    if (!g1.ran) return { ok: false, why: g1.errorMsg || "die Suche lief nicht zu Ende (Zeitlimit)" };
    for (const h of lines(g1.out, MAX_FILES * 4)) found.add(h);
  }
  const files = [];
  for (const file of [...found].slice(0, MAX_FILES * 4)) {
    const hit = [];
    for (const grp of groups) {
      if (!run(`grep -qIE ${eArgs(grp)} ${sq(file)}`, { timeout: 15000 }).ok) continue;
      for (const f of grp) {
        const g = run(`l=$(grep -nIEm1 -e ${sq(f.re)} ${sq(file)}); [ -n "$l" ] || exit 0; if printf %s "$l" | cut -d: -f2- | grep -qiE ${sq(PLACEHOLDER)}; then echo ph; else echo "${"${l%%:*}"}"; fi`, { timeout: 15000 });
        const n = (g.out || "").trim();
        if (g.ran && /^\d+$/.test(n)) hit.push({ f, n: Number(n) });
      }
    }
    if (hit.length) files.push({ file, hit });
  }
  return { ok: true, files, seen: found.size, used: use.ok.length, cmd: `grep -lIE <${use.ok.length} Formate> ${roots.join(" ")}`, note: use.refused ? { claim: `${use.refused} Muster versteht das grep dort nicht und fallen weg`, src: { cmd: "printf '' | grep -E <muster>", line: `${use.ok.length} von ${fs.length} Mustern brauchbar` } } : null };
}

export function formatsCheck(rule) {
  return {
    id: rule.id, know: rule.know || rule.id, title: rule.title, aliases: rule.aliases || [], cve: rule.cve || [], deep: true,

    run() {
      const m = loc(rule), id = rule.id, title = m.title, ev = [];
      const sr = scanRoots();
      if (!sr.ran) return result({ id, title, verdict: UNKNOWN, was: "Konnte das Ziel nicht abfragen.", wie: sr.line || "Der Suchbefehl lief nicht.", wo: "Ziel nicht erreichbar.", evidence: [] });
      if (!sr.roots.length) {
        ev.push(evidence("Keine Projekt- und Web-Ordner bekannt", { cmd: "web roots + user.md", line: "(keine Ordner zum Durchsuchen)" }));
        return result({ id, title, verdict: UNKNOWN, was: "Es gibt keinen Ordner, den ich durchsuchen dürfte.", wie: "Lass mich mich umschauen (user.md), dann kenne ich deine Projektordner.", wo: "Dieser Rechner.", evidence: ev });
      }
      const route = routeSystems(sr.roots);
      ev.push(evidence("Router: diese Systeme sind da", { cmd: "find <ordner> -name package.json -o -name composer.json …", line: route.systems.join(", ") + " · " + route.line }));
      const fs = rule.formats.filter((f) => route.systems.includes(f.system));
      if (!fs.length) return result({ id, title, verdict: UNKNOWN, was: "Für diese Systeme habe ich keine Muster.", wie: "Die Prüf-Bib kennt keins der gefundenen Systeme.", wo: "Dieser Rechner.", evidence: ev });

      // The search itself. On this machine it runs in Node (BSD grep is far too slow with hundreds of patterns); on a
      // server it runs with the server's own grep, whose patterns are proven usable first. Either way: a search
      // that did not finish is UNKNOWN, never "clean".
      const sc = targetLabel() === "localhost" ? scanNode(sr.roots, fs) : scanGrep(sr.roots, fs);
      if (!sc.ok) return result({ id, title, verdict: UNKNOWN, was: "Konnte die Ordner nicht (vollständig) durchsuchen.", wie: sc.why + " — ohne saubere Suche sage ich nichts.", wo: "Dieser Rechner.", evidence: ev });
      if (sc.note) ev.push(evidence(sc.note.claim, sc.note.src));
      if (!sc.files.length) {
        ev.push(evidence("Ordner durchsucht, keine Geheimnisse gefunden", { cmd: sc.cmd, line: `(keine Treffer in ${sr.roots.length} Ordner(n), ${sc.used} Formate, ${sc.seen} Dateien gelesen)` }));
        return result({ id, title, verdict: SAFE, was: m.ok || "Keine Schlüssel oder Passwörter im Code gefunden.", wie: m.ok_how || "Die Ordner wurden mit den Formaten der Prüf-Bib durchsucht.", wo: "Dieser Rechner.", evidence: ev });
      }

      // The drill-down on every hit file (rights, git). Never the value.
      let worst = SAFE, normal = 0;
      const steps = [];
      for (const { file, hit } of sc.files.slice(0, MAX_FILES)) {
        const d = drill(file);
        const names = hit.slice(0, 3).map((h) => `${fname(h.f)} (Zeile ${h.n})`).join("; ");
        let level = SAFE;
        if (d.git === "tracked" || d.git === "history") level = RISK;
        else if (d.worldReadable || d.git === "untracked") level = WARN;
        else if (!d.ran) level = WARN;
        if (level === SAFE) normal++;
        const gitWord = { tracked: "im Git eingecheckt", history: "war mal im Git", ignored: "git-ignoriert", untracked: "nicht ignoriert, nicht eingecheckt", nogit: "kein Git" }[d.git];
        ev.push(evidence(`${names} — ${gitWord}, Rechte ${d.mode || "?"}`, { cmd: `grep -nE <format> ${file}; ls -ld; git ls-files/check-ignore/log`, line: `${file}:${hit[0].n} · ${d.line}` }));
        if (level === RISK) { worst = RISK; steps.push({ desc: `Schlüssel in ${file} erneuern (er gilt als bekannt), dann aus Git nehmen: ${d.git === "tracked" ? "git rm --cached" : "History prüfen"}`, script: d.git === "tracked" ? `git -C ${sq(file.replace(/\/[^/]*$/, "") || "/")} rm --cached ${sq(file)}` : `git -C ${sq(file.replace(/\/[^/]*$/, "") || "/")} log --oneline -- ${sq(file)}` }); }
        else if (level === WARN && worst !== RISK) { worst = WARN; if (d.worldReadable) steps.push({ desc: `Leserecht für andere entziehen: ${file}`, script: `chmod go-rwx ${sq(file)}` }); }
      }
      if (worst === SAFE) {
        return result({ id, title, verdict: SAFE, was: "Schlüssel liegen nur dort, wo sie hingehören.", wie: `${normal} Datei(en) mit Schlüsseln, alle privat und aus Git herausgehalten — das ist normal.`, wo: "Dieser Rechner.", evidence: ev });
      }
      return result({ id, title, verdict: worst, was: m.bad || "Schlüssel oder Passwörter stehen offen im Code.", wie: m.bad_how || "Die Zeilen unten nennen Datei, Zeile, Art und Git-Lage — den Wert zeigt Dante nie.", wo: "Dieser Rechner.", evidence: ev,
        fix: steps.length ? { why: "Ein Schlüssel, der im Git stand, gilt als bekannt: erst erneuern, dann aufräumen.", steps } : null });
    },
  };
}
