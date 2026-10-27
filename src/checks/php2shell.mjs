// Version-bound CVE check (PHP2Shell, CVE-2026-109618/-619 first), built from a version_cve rule.
// Distro backports keep the old version number, so a version alone never proves safe or vulnerable;
// the package changelog decides, and without it the verdict is unknown.
import { run, firstLine } from "../core/sh.mjs";
import { execProgram } from "../core/fsx.mjs";
import { isLocalTarget } from "../core/sh.mjs";
import { isWindows } from "../core/perm.mjs";
import { result, evidence, SAFE, WARN, RISK, UNKNOWN } from "../core/check.mjs";
import { FAMILY_OF, fixSteps } from "../bib/system.mjs";
import { sq } from "./common.mjs";
import { BUILTIN } from "../pack/builtin.mjs";
import { loc } from "./loc.mjs";

// How to ask a program for its version, which service belongs to it, where its changelog lives.
// This table is code: a pack only picks a name from it (rules.mjs PROBES), it cannot add a command.
const PROBES = {
  php: { ver: "php -v", doc: "/usr/share/doc/php*-common/changelog.*", svc: "php[0-9.]*-fpm" },
  nginx: { ver: "nginx -v 2>&1", doc: "/usr/share/doc/nginx*/changelog.*", svc: "nginx" },
  openssl: { ver: "openssl version", doc: "/usr/share/doc/openssl/changelog.*", svc: null },
  apache: { ver: "apache2 -v 2>/dev/null || httpd -v", doc: "/usr/share/doc/apache2/changelog.*", svc: "apache2|httpd" },
};

function parseVer(s) {
  const m = String(s || "").match(/\b(\d+)\.(\d+)\.(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
// fixed = { "8.2": 35 }: on a listed line the patch number decides; a line newer than every listed
// line carries the fix too; an older or unlisted-in-between line does not.
function upstreamFixed(v, fixed) {
  if (!v) return false;
  const patch = fixed[v[0] + "." + v[1]];
  if (patch != null) return v[2] >= patch;
  return Object.keys(fixed).every((k) => { const [a, b] = k.split(".").map(Number); return v[0] > a || (v[0] === a && v[1] > b); });
}

export function versionCheck(rule) {
  const P = PROBES[rule.probe], L = rule.probe === "php" ? "PHP" : rule.probe, SVC = rule.probe === "php" ? "PHP-FPM" : L;
  const name = rule.title.split(" — ")[0], cveRe = rule.cve.join("|");
  const limit = Object.entries(rule.fixed).map(([k, n]) => k + "." + n).join("/");
  const wo = "Dieser Server.";
  return {
    id: rule.id, know: rule.know || rule.id, title: rule.title, aliases: rule.aliases || [], cve: rule.cve,

    run() {
      const ev = [], id = rule.id, title = loc(rule).title;

      // 1) Is the program present at all?
      const winLocal = rule.probe === "php" && isLocalTarget() && isWindows();
      const cli = rule.probe === "php" ? execProgram("php", ["-v"]) : run(P.ver);

      // Windows (this machine): PHP from windows.php.net/XAMPP/Laragon has no distro backports, so the version number decides.
      // No systemctl, no /usr/share/doc, no os-release. Missing or unreadable php is UNKNOWN (it may live outside PATH), never SAFE.
      if (winLocal) {
        const verLine = firstLine(cli.out), v = cli.ok ? parseVer(verLine) : null;
        if (!v) {
          ev.push(evidence("Kein lesbares " + L + "-Versions-Ergebnis", { cmd: cli.cmd, line: firstLine(cli.err || cli.out) || (cli.ran ? "(leere Ausgabe)" : "php nicht startbar") }));
          return result({ id, title, verdict: UNKNOWN,
            was: L + "-Version war nicht belegbar.", wie: "`php -v` lieferte keine lesbare Version (nicht im PATH, z. B. XAMPP/Laragon, oder unlesbare Ausgabe).",
            wo: "Dieser Rechner.", evidence: ev,
            fix: "Pfad zu php.exe in den PATH aufnehmen oder `php -v` von Hand prüfen." });
        }
        ev.push(evidence(L + "-Version: " + v.join("."), { cmd: cli.cmd, line: verLine }));
        if (upstreamFixed(v, rule.fixed)) {
          return result({ id, title, verdict: SAFE,
            was: L + " ist auf einer upstream-gepatchten Version.", wie: "Windows hat keine Distro-Backports: Version ≥ Fix-Grenze (" + limit + ").",
            wo: "Dieser Rechner.", evidence: ev });
        }
        return result({ id, title, verdict: WARN,
          was: L + " ist ungepatcht.", wie: "Windows hat keine Distro-Backports: Version unter der Fix-Grenze (" + limit + ").",
          wo: "Dieser Rechner.", evidence: ev,
          fix: "PHP von windows.php.net (oder XAMPP/Laragon) auf eine Version ≥ " + limit + " aktualisieren." });
      }
      const fpm = P.svc ? run("systemctl list-units --type=service --all --no-legend 2>/dev/null | grep -iE " + sq(P.svc) + " | awk '{print $1, $4}'") : { ran: false, ok: false, out: "" }; // no service to ask -> it must not count as "I looked"
      const anyFpm = fpm.ok && fpm.out.trim().length > 0;
      const anyCli = cli.ok && parseVer(cli.out) != null;
      if (!anyCli && !anyFpm) {
        // Only call it SAFE if the "is it here" commands actually RAN. Otherwise we don't know.
        if (!cli.ran && !fpm.ran) {
          return result({ id, title, verdict: UNKNOWN,
            was: "Konnte den Server nicht abfragen.", wie: cli.errorMsg || fpm.errorMsg || "Befehle liefen nicht.",
            wo: "Ziel nicht erreichbar.", evidence: [] });
        }
        ev.push(evidence("Kein " + L + "-CLI", { cmd: P.ver.split(" ")[0] + " -v", line: firstLine(cli.err || cli.out) || "command not found" }));
        if (P.svc) ev.push(evidence("Kein " + SVC + "-Dienst", { cmd: "systemctl … grep " + (rule.probe === "php" ? "php-fpm" : rule.probe), line: "(keine Treffer)" }));
        return result({ id, title, verdict: SAFE,
          was: name + " betrifft nur Server mit " + L + ".", wie: "Kein " + L + "-CLI und kein " + SVC + "-Dienst installiert.",
          wo, evidence: ev });
      }

      if (anyCli) {
        const verLine = firstLine(cli.out);
        const v = parseVer(verLine);
        ev.push(evidence(L + "-Version: " + (v ? v.join(".") : verLine), { cmd: P.ver.split(" ")[0] + " -v", line: verLine }));
        if (upstreamFixed(v, rule.fixed)) {
          return result({ id, title, verdict: SAFE,
            was: L + " ist auf einer upstream-gepatchten Version.", wie: "Version ≥ Fix-Grenze (" + limit + ").",
            wo, evidence: ev });
        }
      }

      // 2) The authority: can we read the distro changelog, and does it name the CVE patch?
      const docs = run("ls " + P.doc + " 2>/dev/null");
      const canReadChangelog = docs.ran && docs.ok && docs.out.trim().length > 0;
      const chg = run("zcat " + P.doc + " 2>/dev/null | grep -iE " + sq(cveRe) + " | head -1");

      if (chg.ran && chg.ok && chg.out.trim()) {
        ev.push(evidence("Distro-Changelog nennt den CVE-Patch (Backport)", { cmd: "zcat changelog | grep " + rule.cve[0], line: firstLine(chg.out) }));
        return result({ id, title, verdict: SAFE,
          was: "Der " + name + "-Patch ist auf diesem Server belegt.", wie: "Der Distro-Changelog weist den CVE-Patch aus.",
          wo, evidence: ev });
      }

      // Not upstream-fixed and no CVE line found. Could we even read the changelog?
      if (!canReadChangelog) {
        ev.push(evidence("Changelog nicht lesbar — Patch-Stand nicht belegbar", { cmd: "ls " + P.doc, line: firstLine(docs.err || docs.out) || "(keine Datei)" }));
        return result({ id, title, verdict: UNKNOWN,
          was: L + " ist da, aber der Patch-Stand war nicht belegbar.",
          wie: "Versionsnummer allein reicht nicht (Distro-Backports), und der Changelog ließ sich nicht lesen.",
          wo, evidence: ev,
          fix: "Patch-Stand von Hand prüfen (Changelog/Advisory) oder " + L + " aktualisieren und " + (rule.probe === "php" ? "PHP-FPM" : "den Dienst") + " neu starten." });
      }

      // Changelog readable, CVE absent, version below fix line -> genuinely unpatched. Exposure decides urgency.
      ev.push(evidence("Changelog gelesen, kein CVE-Patch darin", { cmd: "zcat changelog | grep CVE", line: "(keine Treffer, Datei lesbar)" }));
      let exposed = null; // only PHP has an exposure test (a web server that hands .php to FastCGI)
      if (rule.probe === "php") {
        const expose = run("grep -rslE 'fastcgi_pass|\\\\.php' /etc/nginx/sites-enabled/ /etc/apache2/sites-enabled/ 2>/dev/null | head -3");
        exposed = expose.ran && expose.ok && expose.out.trim().length > 0;
        ev.push(evidence(exposed ? "Webserver leitet .php/FastCGI weiter (prüfen: Honeypot oder echt)" : "Keine PHP-Weiterleitung im Webserver gefunden",
          { cmd: "grep -rl fastcgi_pass sites-enabled", line: exposed ? firstLine(expose.out) : "(keine Treffer)" }));
      }
      const verdict = exposed ? RISK : WARN;
      const was = exposed === null ? L + " ist ungepatcht." : exposed ? L + " ist ungepatcht UND vom Web erreichbar." : L + " ist ungepatcht, aber nicht offen erreichbar.";
      const wie = "Version unter der Fix-Grenze und kein CVE-Patch im lesbaren Changelog.";
      if (rule.probe !== "php") return result({ id, title, verdict, was, wie, wo, evidence: ev });

      const major = (parseVer(firstLine(cli.out)) || [8, 3]).slice(0, 2).join(".");
      const fpmSvc = anyFpm ? firstLine(fpm.out).split(" ")[0] : ("php" + major + "-fpm");
      // The fix must speak the system's own package manager. Read the family off the target itself
      // (os-release), not from anything the user claimed - unreadable -> debian (the most common).
      const osId = firstLine(run(". /etc/os-release 2>/dev/null; echo \"$ID\"").out).toLowerCase();
      const family = FAMILY_OF[osId] || "debian";
      ev.push(evidence("System-Familie (für den Fix-Weg): " + family, { cmd: ". /etc/os-release; echo $ID", line: osId || "(nicht lesbar → debian angenommen)" }));
      return result({ id, title, verdict, was, wie, wo, evidence: ev,
        fix: {
          why: "PHP auf den gepatchten Stand bringen und den laufenden Dienst darauf neu starten.",
          steps: fixSteps(family, major, fpmSvc),
        } });
    },
  };
}

// The built-in PHP2Shell check: cli.mjs and the session keep importing it by this name.
export const php2shell = versionCheck(BUILTIN.rules.find((r) => r.id === "php2shell"));
