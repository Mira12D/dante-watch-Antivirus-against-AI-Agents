// Seeds for the three domain classifiers (system moves, check requests, knowledge questions) and the
// recipes for system-specific commands. The OS family is read from the target itself
// (os-release), never taken from what the user says. Unknown families yield "unbekannt", not a verdict.

// System families Dante can stand on. Everything else is "unbekannt" -> Dante says so, never SAFE.
export const FAMILIES = ["debian", "alpine", "fedora", "arch", "unbekannt"];
// os-release ID / ID_LIKE -> family (the fingerprint maps real output to one column).
export const FAMILY_OF = {
  debian: "debian", ubuntu: "debian", raspbian: "debian", mint: "debian", devuan: "debian",
  alpine: "alpine",
  fedora: "fedora", rhel: "fedora", centos: "fedora", rocky: "fedora", almalinux: "fedora", amzn: "fedora",
  arch: "arch", manjaro: "arch", endeavouros: "arch",
};

// Seed phrasings per intent (DE/EN/ES), only to prove the ear. The real bib is cooked by the loop.
const S = {
  finde_php: ["läuft hier php", "welche php version", "wo ist mein php", "php 8.1 mit nginx", "ich hab php-fpm", "hab php 7.4 noch", "is php running", "what php version", "php 8.2 fpm", "where is php", "corre php aqui", "que version de php", "tengo php 8.0"],
  pruef_php2shell: ["bin ich von php2shell betroffen", "ist meine php version die lücke", "cve-2026-109618 bei mir", "php 8.1.5 sicher", "ist das die rce lücke", "am i affected by php2shell", "is my php version vulnerable", "php 8.2.3 safe", "estoy afectado por php2shell", "mi php es vulnerable"],
  beleg: ["zeig mir die zeile", "woran siehst du das", "was ist der beweis", "welche zeile beweist das", "show me the line", "whats the proof", "how do you know", "muestrame la linea", "cual es la prueba"],
  fix_php2shell: ["wie mach ich das zu", "wie patche ich das", "was muss ich upgraden", "wie schließe ich die lücke", "how do i fix it", "how to patch", "what do i upgrade", "como lo arreglo", "como cierro el hueco"],
};
export const SYS_PROBE = Object.entries(S).flatMap(([intent, xs]) => xs.map((text) => ({ intent, text })));

// The Muster-Bib seed: how a user asks the watchman to look for what is WRONG (beyond php2shell).
// Recognition only - the hands are the deterministic battery in src/checks/. Grown by the loop.
// lines of the old system-ear intent "fingerabdruck": they now belong to the muster intent meinsystem (same answer)
const FINGERPRINT_LINES = ["auf welchem system bin ich", "was läuft hier für ein os", "welche distro", "bin auf debian 11", "ich hab ubuntu", "läuft auf alpine", "das ist ein centos", "which os is this", "im on debian", "running ubuntu 22", "its alpine", "en que sistema estoy", "tengo debian", "es un centos"];
const M = {
  umschauen: ["schau dich um", "lern mich kennen", "sieh dich mal um", "was weißt du über meinen rechner", "mach dich mit meinem system vertraut", "look around", "get to know my machine", "have a look at my setup", "mira a tu alrededor", "conoce mi equipo", "echa un vistazo a mi sistema"],
  scharf: ["schalt dich scharf", "aktiviere die patrouille", "lauf mehrmals am tag", "überwache mich automatisch", "arm yourself", "turn on the patrol", "run on a schedule", "watch my machine automatically", "ponte en marcha", "activa la patrulla", "revisa automáticamente"],
  systeme_info: ["was kannst du mir über meine systeme sagen", "erzähl mir was über meine rechner", "gib mir einen überblick über alles was ich habe", "was weißt du über meine maschinen", "tell me about my systems", "what can you tell me about my machines", "give me an overview of everything i own", "dime algo de mis sistemas", "qué sabes de mis equipos", "dame un resumen de todo lo que tengo"],
  was_los: ["was ist da los", "was geht auf dem server ab", "was läuft gerade auf meinem rechner", "warum ist der so langsam", "wer ist gerade eingeloggt", "welche ports sind offen", "what's going on on my server", "what is running right now", "why is it so slow", "who is logged in", "which ports are open", "qué pasa en mi servidor", "qué está corriendo ahora", "por qué va tan lento", "quién está conectado", "qué puertos están abiertos"],
  meinsystem: [...FINGERPRINT_LINES, "was ist mein system", "welcher ist mein mac", "was für ein rechner ist das", "welches betriebssystem hab ich", "wie viel ram hab ich", "zeig mir die systeminfo", "what machine is this", "which os am i running", "what is my mac", "show system info", "how much memory do i have", "qué sistema tengo", "qué ordenador es este", "cuánta memoria tengo", "info del sistema", "qué versión de linux es"],
  version_update: ["gibt es ein update", "welche version hab ich", "bin ich auf dem neuesten stand", "gibt es eine neuere version", "is there a newer version", "am i up to date", "what version is this", "any updates", "hay una versión nueva", "qué versión tengo", "estoy actualizado", "hay actualización"],
  server_finden: ["finde meine server", "such mal meine server", "spür meine rechner auf", "entdecke meine server", "find my servers", "discover my machines", "look for my servers", "search for servers i own", "busca mis servidores", "encuentra mis servidores", "descubre mis máquinas", "encuentra mis servidores por favor"],
  server_status: ["wie geht's meinen servern", "wie läuft es bei meinen servern", "alles ok bei meinen servern", "wie stehen meine server da", "status meiner server", "how are my servers", "how are my servers doing", "is everything ok with my servers", "status of my servers", "cómo están mis servidores", "cómo van mis servidores", "todo bien con mis servidores"],
  server_liste: ["kennst du meine server", "welche server hast du gefunden", "was für server hab ich", "zeig mir meine server", "welche rechner kennst du von mir", "liste meine server auf", "weißt du welche server ich habe", "do you know my servers", "which servers did you find", "what servers do i have", "list my servers", "show me my machines", "qué servidores conoces", "cuáles son mis servidores", "muéstrame mis servidores", "conoces mis servidores"],
  hf: ["prüf meine modelle", "ist das modell sicher zu laden", "schau dir meine ki modelle an", "was darf mein agent", "prüf meine mcp server", "check meine huggingface modelle", "laden meine gewichte fremden code", "check my models", "are my huggingface models safe to load", "look at my mcp servers", "what is my agent allowed to do", "scan my downloaded models", "revisa mis modelos", "son seguros mis modelos de hugging face", "mira mis servidores mcp", "qué puede hacer mi agente"],
  abschalten: ["schalt dich ab", "stopp die patrouille", "lauf nicht mehr automatisch", "nimm den zeitplan raus", "disarm", "turn off the patrol", "stop running automatically", "remove the schedule", "desarmar", "apaga la patrulla", "quita el horario"],
  patrouille: ["prüf alles", "mach die runde", "kompletter check", "check alles durch", "alles scannen", "komplett prüfen", "mach die ganze runde", "scan everything", "full check", "run all checks", "check everything", "revisa todo", "chequeo completo", "escanéalo todo"],
  webshell: ["hat mir wer was reingelegt", "gibt es fremde dateien", "such nach webshells", "ist ne hintertür drin", "schädliche php dateien", "backdoor finden", "fremder code im webroot", "check for webshells", "any backdoor files", "malicious php files", "look for a shell", "busca webshells", "archivos maliciosos", "hay una puerta trasera"],
  secrets: ["ist meine env offen", "leaken meine geheimnisse", "ist mein git public", "sind passwörter sichtbar", "liegt die .env offen", "db passwort sichtbar", "are my secrets exposed", "is my .env public", "exposed env file", "secrets leaking", "mis secretos están expuestos", "está mi env público", "contraseña de la base visible"],
  sshd: ["ist mein ssh sicher", "kann man sich als root einloggen", "ist root login offen", "brute force gefahr ssh", "ssh absichern", "is ssh secure", "can root log in", "password login open", "harden ssh", "es seguro mi ssh", "login de root abierto", "asegurar ssh"],
  rechte: ["stimmen die dateirechte", "was ist offen beschreibbar", "rechte prüfen", "sind rechte falsch", "world writable dateien", "dateirechte checken", "check file permissions", "world writable files", "wrong permissions", "permisos de archivos", "archivos escribibles por todos", "revisar permisos"],
};
// The Fachwissen seed: how people ask Dante to explain (what he watches / one topic or finding).
const W = {
  bericht: ["was ist passiert", "was hast du gemacht", "gibt es was neues", "wie lief die nacht", "hast du was gefunden", "was war seit gestern", "what happened", "what did you do", "anything new", "did you find anything", "what was going on while i was away", "qué pasó", "qué hiciste", "hay novedades", "encontraste algo", "cómo fue la noche"],
  job: ["was überwachst du", "was ist dein job", "was prüfst du alles", "wofür bist du da", "was kannst du inhaltlich", "worauf achtest du", "what do you watch", "what is your job", "what do you check", "what are you for", "what do you look for", "que vigilas", "cual es tu trabajo", "que revisas", "para que sirves", "en que te fijas"],
  thema: ["was ist eine webshell", "woran erkenne ich offene geheimnisse", "warum ist root login gefährlich", "wie prüfst du ssh", "ist das normal", "was tue ich dagegen", "was bedeutet php2shell", "what is a webshell", "what stands out about open secrets", "why is root login dangerous", "how do you check ssh", "is that normal", "what do i do about it", "que es una webshell", "que llama la atencion en los permisos", "por que es peligroso el login de root", "como compruebas ssh", "es normal esto", "que hago al respecto"],
};
export const WISSEN_PROBE = Object.entries(W).flatMap(([intent, xs]) => xs.map((text) => ({ intent, text })));

export const MUSTER_PROBE = Object.entries(M).flatMap(([intent, xs]) => xs.map((text) => ({ intent, text })));

// The hands. Per family: the exact command Dante runs on the real server, and the rule that reads
// the real output. Small and hand-verified - this is where "every verdict carries a real line"
// lives. The loop may PROPOSE additions, but a recipe is only the shape below; the hit-logic is
// deterministic code in src, never DeepSeek prose. php2shell = CVE-2026-109618 (fictional here):
// affected PHP < 8.1.27, 8.2.0–8.2.13, 8.3.0–8.3.1 - and only when the vulnerable module is loaded.
export const RECIPES = {
  debian: {
    fingerabdruck: { cmd: ". /etc/os-release 2>/dev/null; echo \"$ID ${VERSION_ID}\"", beleg: "die ID-Zeile aus /etc/os-release" },
    finde_php: { cmd: "php -v 2>/dev/null | head -1; command -v php-fpm php-fpm8.1 php-fpm8.2 2>/dev/null", beleg: "die PHP-Versionszeile (oder leer = kein PHP)" },
    pruef_php2shell: { cmd: "php -r 'echo PHP_VERSION;' 2>/dev/null; php -m 2>/dev/null | grep -i '^phar$'", beleg: "Version + geladenes Modul; Treffer nur wenn Version verwundbar UND Modul geladen" },
    fix_php2shell: { plan: "apt-get update && apt-get install --only-upgrade php8.1 php8.1-fpm && systemctl restart php8.1-fpm", beleg: "neue Versionszeile nach dem Upgrade" },
  },
  alpine: {
    fingerabdruck: { cmd: ". /etc/os-release 2>/dev/null; echo \"$ID ${VERSION_ID}\"", beleg: "die ID-Zeile aus /etc/os-release" },
    finde_php: { cmd: "php -v 2>/dev/null | head -1; command -v php-fpm php-fpm81 php-fpm82 2>/dev/null", beleg: "die PHP-Versionszeile (oder leer = kein PHP)" },
    pruef_php2shell: { cmd: "php -r 'echo PHP_VERSION;' 2>/dev/null; php -m 2>/dev/null | grep -i '^phar$'", beleg: "Version + geladenes Modul" },
    fix_php2shell: { plan: "apk update && apk upgrade php81 php81-fpm && rc-service php-fpm81 restart", beleg: "neue Versionszeile nach dem Upgrade" },
  },
  fedora: {
    fingerabdruck: { cmd: ". /etc/os-release 2>/dev/null; echo \"$ID ${VERSION_ID}\"", beleg: "die ID-Zeile aus /etc/os-release" },
    finde_php: { cmd: "php -v 2>/dev/null | head -1; command -v php-fpm 2>/dev/null", beleg: "die PHP-Versionszeile (oder leer = kein PHP)" },
    pruef_php2shell: { cmd: "php -r 'echo PHP_VERSION;' 2>/dev/null; php -m 2>/dev/null | grep -i '^phar$'", beleg: "Version + geladenes Modul" },
    fix_php2shell: { plan: "dnf upgrade php php-fpm && systemctl restart php-fpm", beleg: "neue Versionszeile nach dem Upgrade" },
  },
  arch: {
    fingerabdruck: { cmd: ". /etc/os-release 2>/dev/null; echo \"$ID ${VERSION_ID}\"", beleg: "die ID-Zeile aus /etc/os-release" },
    finde_php: { cmd: "php -v 2>/dev/null | head -1; command -v php-fpm 2>/dev/null", beleg: "die PHP-Versionszeile (oder leer = kein PHP)" },
    pruef_php2shell: { cmd: "php -r 'echo PHP_VERSION;' 2>/dev/null; php -m 2>/dev/null | grep -i '^phar$'", beleg: "Version + geladenes Modul" },
    fix_php2shell: { plan: "pacman -Syu php php-fpm && systemctl restart php-fpm", beleg: "neue Versionszeile nach dem Upgrade" },
  },
};

// The hands for the fix, per family: the right package manager and the right service tool. Shown to
// the human as a plan before any "ja"; the check re-reads the real version line afterwards. major is
// "8.1" (from php -v), fpmSvc the FPM unit the check actually found on a systemd box.
export function fixSteps(family, major, fpmSvc) {
  const [maj, min] = String(major).split(".");
  switch (family) {
    case "alpine": return [
      { desc: "Paketindex aktualisieren", script: "apk update" },
      { desc: "PHP-Pakete patchen", script: `apk upgrade php${maj}${min} php${maj}${min}-fpm` },
      { desc: "PHP-FPM neu starten", script: `rc-service php-fpm${maj}${min} restart` },
    ];
    case "fedora": return [
      { desc: "PHP-Pakete patchen", script: "dnf upgrade -y php php-fpm" },
      { desc: "PHP-FPM neu starten", script: "systemctl restart php-fpm" },
    ];
    case "arch": return [
      { desc: "System + PHP patchen", script: "pacman -Syu --noconfirm php php-fpm" },
      { desc: "PHP-FPM neu starten", script: "systemctl restart php-fpm" },
    ];
    default: return [ // debian / ubuntu
      { desc: "Paketliste aktualisieren", script: "apt-get update" },
      { desc: "PHP-Pakete patchen", script: `apt-get install --only-upgrade -y php${major}-fpm php${major}-cli php${major}-common` },
      { desc: "PHP-FPM neu starten", script: `systemctl restart ${fpmSvc}` },
    ];
  }
}
