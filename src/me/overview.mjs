// One shell command that prints KEY=value lines describing a system: OS, kernel, PHP, web server - and, so a server
// can be described and later recognised, the services that really run, the listening ports, containers and the sites
// a web server serves. Read-only, no sudo, every lookup with a hard timeout so a slow box cannot stall the visit.
// Used for "what is my system?" and when visiting a server.
//
// Ports and services are FACTS (they really run there). What a machine is FOR ("the till", "the proxy") is never
// derived from them - that is only ever what the person says.
export const OVERVIEW = [
  '. /etc/os-release 2>/dev/null',
  'echo "OS=$PRETTY_NAME"', 'echo "ID=$ID"', 'echo "VER=$VERSION_ID"',
  'echo "MAC=$(sw_vers -productName 2>/dev/null) $(sw_vers -productVersion 2>/dev/null)"',
  'echo "KERNEL=$(uname -sr)"', 'echo "ARCH=$(uname -m)"',
  'echo "PHP=$(php -v 2>/dev/null | head -1)"',
  'echo "WEB=$(for w in nginx apache2 httpd caddy lighttpd; do command -v $w >/dev/null 2>&1 && echo $w; done | tr "\\n" " ")"',
  // mem: what the box is sized for (a 4 GB droplet tells you something a 64 GB box does not)
  'echo "MEM=$(awk "/^MemTotal:/{printf \\"%dGB\\", \\$2/1048576}" /proc/meminfo 2>/dev/null)"',
  'echo "DISK=$(df -h / 2>/dev/null | awk "NR==2{print \\$2\\" / \\"\\$5}")"',
  'echo "UP=$(uptime 2>/dev/null | sed -E "s/.*up ([^,]+),.*/\\1/")"',
  // listening ports (needs no root for -l), comma separated: 22,80,443
  'echo "PORTS=$(ss -tlnH 2>/dev/null | awk "{print \\$4}" | sed -E "s/.*:([0-9]+)$/\\1/" | sort -un | grep -v "^$" | head -20 | tr "\\n" "," | sed "s/,$//")"',
  // running services: systemd unit names without .service, the interesting ones only
  'echo "SVC=$(systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | awk "{print \\$1}" | sed -E "s/\\.service$//" | grep -vE "^(systemd-|dbus|cron|rsyslog|ssh|getty|user@|polkit|udisks|gpg-agent|accounts-daemon|unattended-upgrades|networkd|resolved|timesyncd|logind|journald|udev)" | head -12 | tr "\\n" "," | sed "s/,$//")"',
  'echo "DOCKER=$(command -v docker >/dev/null 2>&1 && docker ps --format "{{.Names}}" 2>/dev/null | head -8 | tr "\\n" "," | sed "s/,$//")"',
  // what the web server actually serves (site names are a strong hint, still only a hint)
  'echo "SITES=$(ls /etc/nginx/sites-enabled /etc/apache2/sites-enabled /etc/caddy 2>/dev/null | grep -vE "^$|:" | sed -E "s/\\.conf$//" | head -10 | tr "\\n" "," | sed "s/,$//")"',
  // databases, if present
  'echo "DB=$( { mysql -V 2>/dev/null | sed -E "s/.*Distrib ([0-9.]+).*/MySQL \\1/"; psql -V 2>/dev/null | sed -E "s/.*\\) ([0-9.]+).*/PostgreSQL \\1/"; redis-server -v 2>/dev/null | sed -E "s/.*v=([0-9.]+).*/Redis \\1/"; } | tr "\\n" ", " | sed "s/, $//")"',
].join("; ");

/** "$COMMA_SEPARATED" -> ["a","b"]; empty -> [] */
export function splitList(v) {
  return String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
}

/** Everything the overview found, split into the parts that are shown and the parts that are facts. */
export function facts(kv) {
  return {
    os: kv.label || "",
    kernel: kv.KERNEL || "", arch: kv.ARCH || "",
    php: (kv.PHP || "").replace(/^PHP\s+/, "").split(" ")[0],
    web: splitList(kv.WEB), ports: splitList(kv.PORTS), services: splitList(kv.SVC),
    docker: splitList(kv.DOCKER), sites: splitList(kv.SITES), db: splitList(kv.DB),
    mem: kv.MEM || "", disk: kv.DISK || "", up: kv.UP || "",
  };
}

/** What was really found, in the person's language, as a short comma list: "nginx, Postgres, 443". Only facts. */
export function whatRuns(kv, lang = "de") {
  const f = facts(kv), out = [], low = (x) => String(x).toLowerCase();
  for (const w of f.web) out.push(w);
  // the database version already names the service - "PostgreSQL 15.5" does not need "postgresql" next to it
  const dbWord = f.db.map(low).join(" ");
  for (const d of f.db) out.push(d);
  for (const s of f.services) {
    if (/^(nginx|apache2|httpd|caddy|lighttpd)$/.test(s)) continue;
    if (dbWord.includes(low(s)) || low(s) === "docker" || low(s) === "containerd") continue;   // listed by version / by container name
    out.push(s);
  }
  for (const d of f.docker) out.push(d + (lang === "de" ? " (Container)" : lang === "es" ? " (contenedor)" : " (container)"));
  return [...new Set(out)].slice(0, 6).join(", ");
}

export function parseOverview(text) {
  const kv = {};
  for (const l of String(text || "").split("\n")) {
    const i = l.indexOf("=");
    if (i > 0) kv[l.slice(0, i)] = l.slice(i + 1).trim();
  }
  kv.label = kv.OS || (kv.MAC || "").trim() || kv.ID || "";
  return kv;
}