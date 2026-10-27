// One shell command that prints KEY=value lines describing a system (OS, kernel, PHP, web server).
// Used for "what is my system?" and when visiting a server.
export const OVERVIEW = '. /etc/os-release 2>/dev/null; echo "OS=$PRETTY_NAME"; echo "ID=$ID"; echo "VER=$VERSION_ID"; echo "MAC=$(sw_vers -productName 2>/dev/null) $(sw_vers -productVersion 2>/dev/null)"; echo "KERNEL=$(uname -sr)"; echo "ARCH=$(uname -m)"; echo "PHP=$(php -v 2>/dev/null | head -1)"; echo "WEB=$(for w in nginx apache2 httpd caddy; do command -v $w >/dev/null 2>&1 && echo $w; done | tr "\\n" " ")"';

export function parseOverview(text) {
  const kv = {};
  for (const l of String(text || "").split("\n")) { const i = l.indexOf("="); if (i > 0) kv[l.slice(0, i)] = l.slice(i + 1).trim(); }
  kv.label = kv.OS || (kv.MAC || "").trim() || kv.ID || "";
  return kv;
}
