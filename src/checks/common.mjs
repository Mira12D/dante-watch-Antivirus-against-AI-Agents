// Helpers shared by the checks: quoting, web root lookup, line trimming. Read-only.
import { firstLine, isLocalTarget } from "../core/sh.mjs";
import { existingDirs } from "../core/fsx.mjs";
import { isWindows } from "../core/perm.mjs";

// Single-quote an argument for the remote shell. Double quotes would let the shell expand a `$` in
// a regex (e.g. $_GET -> the _ variable), which silently mangled the webshell pattern. Single quotes
// make every character literal; an embedded ' is closed, escaped and reopened.
export const sq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

// The usual places a web root lives. Dante looks where sites actually are; it never guesses one
// into existence. If none of these exist, the secret/webshell checks say UNKNOWN, not "safe".
export const WEBROOTS_WIN = ["C:\\inetpub\\wwwroot", "C:\\xampp\\htdocs", "C:\\wamp64\\www", "C:\\laragon\\www"];
export const WEBROOTS = ["/var/www/html", "/var/www", "/usr/share/nginx/html", "/srv/www", "/srv/http", "/var/www/localhost/htdocs"];

// Which of the standard web roots actually exist on the target (its own output decides).
// Exit code is unreliable here: the for-loop's last `[ -d ] && echo` fails for the last missing
// path, so the loop exits non-zero even when it printed real roots. We trust the OUTPUT (the lines
// the machine actually printed), not the exit code - ran is enough.
export function webRoots() {
  const r = existingDirs(isLocalTarget() && isWindows() ? WEBROOTS_WIN : WEBROOTS);
  let roots = r.dirs;
  // Drop a root that sits inside another found root (/var/www/html under /var/www) - otherwise a
  // deep search finds the same file through both and reports it twice.
  roots = roots.filter((d) => !roots.some((o) => o !== d && (d === o || d.startsWith(o + "/") || d.startsWith(o + "\\"))));
  return { ran: r.ran, roots, line: firstLine(r.errorMsg || roots.join("\n")), cmd: r.cmd };
}

// First N non-empty lines of some output, trimmed - for a compact, honest evidence list.
export function lines(s, n = 10) {
  return String(s || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, n);
}
