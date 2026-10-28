// Rules and knowledge cards that ship in the package (the free tier). Same format as a purchased
// pack and run by the same interpreter. Serial 0, no signature, no expiry.
import { readFileSync } from "node:fs";
// The Prüf-Bib: secret formats per system, built in the build server (bib/pruef-gen.mjs), shipped as plain data.
const PRUEF = JSON.parse(readFileSync(new URL("../bib/pruef.json", import.meta.url), "utf8"));
export const BUILTIN = {
  v: 1,
  serial: 0,
  rules: [
    {
      id: "php2shell", type: "version_cve", probe: "php",
      title: "PHP2Shell — RCE im PHP-Kern (CVE-2026-109618/-619)",
      cve: ["CVE-2026-109618", "CVE-2026-109619"],
      aliases: ["php2shell", "php 2 shell", "php shell"],
      fixed: { "8.2": 35, "8.3": 36, "8.4": 27, "8.5": 12 }, // upstream fixed versions (2026-10-21)
      i18n: {
        en: { title: "PHP2Shell — RCE in the PHP core (CVE-2026-109618/-619)" },
        es: { title: "PHP2Shell — RCE en el núcleo de PHP (CVE-2026-109618/-619)" },
      },
    },
    {
      id: "secrets", type: "path_exposed",
      title: "Offen lesbare Geheimnisse im Web-Verzeichnis",
      aliases: ["env", "secrets", "geheimnisse"],
      names: [".env", "*.sql", "*.sql.gz", "*.bak", ".git/config"],
      msg: {
        bad: "Dateien mit Geheimnissen sind im Web-Verzeichnis für alle lesbar.",
        bad_how: "Die Pfade unten kann ein Besucher über die Seite abrufen.",
        ok: "Keine offen lesbaren .env/.sql/.git-Dateien im Webroot.",
        ok_how: "Die vorhandenen Web-Verzeichnisse wurden durchsucht, keine für andere lesbaren Geheimnisse.",
      },
      i18n: {
        en: { title: "Openly readable secrets in the web directory", bad: "Files with secrets are readable by everyone in the web directory.", bad_how: "A visitor can fetch the paths below through the site.", ok: "No openly readable .env/.sql/.git files in the web root.", ok_how: "The existing web directories were searched; no secrets readable by others." },
        es: { title: "Secretos legibles abiertamente en el directorio web", bad: "Hay archivos con secretos legibles por todos en el directorio web.", bad_how: "Un visitante puede pedir las rutas de abajo a través del sitio.", ok: "No hay archivos .env/.sql/.git legibles abiertamente en la raíz web.", ok_how: "Se revisaron los directorios web existentes; no hay secretos legibles por otros." },
      },
    },
    {
      id: "webshell", type: "file_pattern",
      title: "Verdächtige PHP-Dateien im Web-Verzeichnis (Webshell-Muster)",
      aliases: ["webshell", "backdoor", "hintertür"],
      glob: "*.php",
      patterns: [
        { name: "Aufruf aus Eingabe ($_GET/$_POST[...](...))", i18n: { en: "Call from input ($_GET/$_POST[...](...))", es: "Llamada desde la entrada ($_GET/$_POST[...](...))" }, re: "\\$_(GET|POST|REQUEST|COOKIE)\\[[^]]*\\][[:space:]]*\\(" },
        { name: "eval(base64_decode(...))", i18n: { en: "eval(base64_decode(...))", es: "eval(base64_decode(...))" }, re: "eval[[:space:]]*\\([[:space:]]*(base64_decode|gzinflate|str_rot13)" },
        { name: "System-Sink mit Eingabe", i18n: { en: "System call with input", es: "Llamada al sistema con entrada" }, re: "(system|shell_exec|passthru|proc_open|popen)[[:space:]]*\\([^)]*\\$_(GET|POST|REQUEST|COOKIE)" },
        { name: "preg_replace mit /e (führt Code aus)", i18n: { en: "preg_replace with /e (runs code)", es: "preg_replace con /e (ejecuta código)" }, re: "preg_replace[[:space:]]*\\([^)]*/e", source: "YARA-Rules webshells, DRL-1.1" },
        { name: "assert() mit Eingabe", i18n: { en: "assert() with input", es: "assert() con entrada" }, re: "assert[[:space:]]*\\([[:space:]]*\\$_(GET|POST|REQUEST|COOKIE)", source: "YARA-Rules webshells, DRL-1.1" },
        { name: "create_function() mit Eingabe", i18n: { en: "create_function() with input", es: "create_function() con entrada" }, re: "create_function[[:space:]]*\\([^)]*\\$_(GET|POST|REQUEST|COOKIE)", source: "YARA-Rules webshells, DRL-1.1" },
        { name: "gzuncompress/gzinflate(base64_decode(...))", i18n: { en: "gzuncompress/gzinflate(base64_decode(...))", es: "gzuncompress/gzinflate(base64_decode(...))" }, re: "(gzuncompress|gzinflate|gzdecode)[[:space:]]*\\([[:space:]]*base64_decode", source: "YARA-Rules webshells, DRL-1.1" },
        { name: "Bekannte Shell-Kennung (c99/r57/b374k/FilesMan …)", i18n: { en: "Known shell banner (c99/r57/b374k/FilesMan …)", es: "Firma de shell conocida (c99/r57/b374k/FilesMan …)" }, re: "(c99shell|r57shell|b374k|FilesMan|phpspy|JspSpy|wso_version)", source: "YARA-Rules webshells, DRL-1.1" },
        { name: "eval() einer Variablen (gepackte Shell)", i18n: { en: "eval() of a variable (packed shell)", es: "eval() de una variable (shell empaquetada)" }, re: "eval[[:space:]]*\\([[:space:]]*\\$[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*\\)", source: "YARA-Rules webshells, DRL-1.1" },
        { name: "Backtick-Ausführung mit Eingabe", i18n: { en: "Backtick execution with input", es: "Ejecución con comillas invertidas y entrada" }, re: "`[^`]*\\$_(GET|POST|REQUEST|COOKIE)", source: "YARA-Rules webshells, DRL-1.1" },
      ],
      msg: {
        bad: "PHP-Dateien tragen Webshell-Muster.",
        bad_how: "Die Pfade unten passen auf typische Hintertür-Muster — von Hand ansehen, nicht blind löschen.",
        ok: "Keine PHP-Dateien mit Webshell-Mustern gefunden.",
        ok_how: "Die vorhandenen Web-Verzeichnisse wurden auf die bekannten Hintertür-Muster durchsucht.",
      },
      i18n: {
        en: { title: "Suspicious PHP files in the web directory (webshell patterns)", bad: "PHP files carry webshell patterns.", bad_how: "The paths below match typical backdoor patterns — look at them by hand, do not delete blindly.", ok: "No PHP files with webshell patterns found.", ok_how: "The existing web directories were searched for the known backdoor patterns." },
        es: { title: "Archivos PHP sospechosos en el directorio web (patrones de webshell)", bad: "Hay archivos PHP con patrones de webshell.", bad_how: "Las rutas de abajo coinciden con patrones típicos de puerta trasera: míralas a mano, no borres a ciegas.", ok: "No se encontraron archivos PHP con patrones de webshell.", ok_how: "Se buscaron los patrones de puerta trasera conocidos en los directorios web existentes." },
      },
    },
    {
      id: "codegeheimnisse", type: "secret_format", deep: true,
      title: "Schlüssel und Passwörter im Code deiner Projekte",
      aliases: ["code", "schlüssel", "tokens", "passwörter im code", "api keys", "secrets im code"],
      formats: PRUEF.formats,
      msg: {
        bad: "Schlüssel oder Passwörter stehen offen im Code.",
        bad_how: "Die Zeilen unten nennen Datei, Zeile, Art und Git-Lage — den Wert zeigt Dante nie.",
        ok: "Keine Schlüssel oder Passwörter im Code gefunden.",
        ok_how: "Die Ordner wurden mit den Formaten der Prüf-Bib durchsucht.",
      },
      i18n: {
        en: { title: "Keys and passwords in the code of your projects", bad: "Keys or passwords sit openly in the code.", bad_how: "The lines below name file, line, kind and git state — Dante never shows the value.", ok: "No keys or passwords found in the code.", ok_how: "The folders were searched with the formats of the check library." },
        es: { title: "Claves y contraseñas en el código de tus proyectos", bad: "Hay claves o contraseñas a la vista en el código.", bad_how: "Las líneas de abajo indican archivo, línea, tipo y estado de git; Dante nunca muestra el valor.", ok: "No se encontraron claves ni contraseñas en el código.", ok_how: "Se buscó en las carpetas con los formatos de la biblioteca de comprobación." },
      },
    },
    {
      id: "sshd", type: "sshd_setting",
      title: "SSH: Root-Login und Passwort-Anmeldung",
      aliases: ["ssh", "sshd", "root login"],
      settings: [{ key: "permitrootlogin", bad: ["yes"] }, { key: "passwordauthentication", bad: ["yes"] }],
      msg: {
        bad: "Root darf sich per Passwort einloggen.",
        bad_how: "Root-Login und Passwort-Anmeldung sind beide offen — das ist die Brute-Force-Tür.",
        ok: "SSH ist nicht die offene Brute-Force-Tür.",
        ok_how: "Weder Root-Login noch Passwort-Anmeldung stehen offen (die Werte stehen unten).",
        part: "Eine SSH-Einstellung steht offen.",
        part_how: "Mindestens eine der beiden Türen (Root-Login, Passwort-Anmeldung) ist offen; die Werte stehen unten. Zu ist es erst, wenn die Passwort-Anmeldung aus ist.",
      },
      i18n: {
        en: { title: "SSH: root login and password login", part: "One SSH setting is open.", part_how: "At least one of the two doors (root login, password login) is open; the values are below. It is only closed once password login is off.", bad: "Root may log in with a password.", bad_how: "Root login and password login are both open — that is the brute-force door.", ok: "SSH is not the open brute-force door.", ok_how: "Neither root login nor password login is open (values below)." },
        es: { title: "SSH: acceso de root y acceso con contraseña", part: "Una configuración de SSH está abierta.", part_how: "Al menos una de las dos puertas (acceso de root, acceso con contraseña) está abierta; los valores están abajo. Solo está cerrado cuando el acceso con contraseña está apagado.", bad: "Root puede entrar con contraseña.", bad_how: "El acceso de root y el acceso con contraseña están abiertos a la vez: es la puerta de la fuerza bruta.", ok: "SSH no es la puerta abierta de la fuerza bruta.", ok_how: "Ni el acceso de root ni el acceso con contraseña están abiertos (los valores están abajo)." },
      },
    },
    {
      id: "sshd-leer", type: "sshd_setting", know: "sshd",
      title: "SSH: Konten ohne Passwort",
      aliases: ["leere passwörter", "leeres passwort", "empty passwords"],
      settings: [{ key: "permitemptypasswords", bad: ["yes"] }],
      msg: {
        bad: "SSH lässt Konten ohne Passwort zu.",
        bad_how: "PermitEmptyPasswords steht auf yes: ein Konto ohne Passwort kommt ohne Schlüssel hinein (der Wert steht unten).",
        ok: "SSH nimmt keine leeren Passwörter an.",
        ok_how: "PermitEmptyPasswords steht auf no (der Wert steht unten).",
      },
      i18n: {
        en: { title: "SSH: accounts without a password", bad: "SSH accepts accounts without a password.", bad_how: "PermitEmptyPasswords is yes: an account with no password gets in without a key (the value is below).", ok: "SSH does not accept empty passwords.", ok_how: "PermitEmptyPasswords is no (the value is below)." },
        es: { title: "SSH: cuentas sin contraseña", bad: "SSH acepta cuentas sin contraseña.", bad_how: "PermitEmptyPasswords está en yes: una cuenta sin contraseña entra sin clave (el valor está abajo).", ok: "SSH no acepta contraseñas vacías.", ok_how: "PermitEmptyPasswords está en no (el valor está abajo)." },
      },
    },
  ],
  // Knowledge cards: what Dante says when you ask him to explain what he watches. Same schema as in a pack.
  know: [
    {
          "id": "ssh-hostkey",
          "aliases": [
                "host key",
                "hostkey",
                "host-schlüssel",
                "host schlüssel",
                "schlüssel geändert",
                "man in the middle",
                "mitm",
                "dazwischen",
                "known_hosts",
                "remote host identification",
                "ssh-keygen -r",
                "clave del host",
                "cambio de clave",
                "llave del host",
                "fingerprint",
                "fingerabdruck"
          ],
          "de": {
                "title": "SSH: Der Schlüssel des Servers hat sich geändert",
                "what": "Jeder SSH-Server zeigt beim Verbinden einen öffentlichen Schlüssel (seinen Fingerabdruck). Dein Rechner merkt ihn sich in known_hosts und schlägt Alarm, wenn er sich ändert („REMOTE HOST IDENTIFICATION HAS CHANGED“).",
                "why": "Entweder wurde der Server neu aufgesetzt (dann entstehen alle Schlüssel neu), oder die Adresse gehört jemand anderem, oder jemand sitzt dazwischen und gibt sich als der Server aus. Wer trotzdem blind bestätigt, gibt einem Fremden sein Passwort oder seine Sitzung.",
                "signs": "Auffällig: nur ein Teil der Schlüssel ist neu, von zwei Orten aus siehst du verschiedene Schlüssel, oder du hast den Server gar nicht neu aufgesetzt.",
                "normal": "Unauffällig: du hast den Server neu installiert oder bei deinem Anbieter neu gebaut, alle Schlüsseltypen sind neu, und von mehreren Orten siehst du denselben neuen Schlüssel.",
                "how": "Ich lese ohne Login nur die öffentlichen Schlüssel des Servers, vergleiche sie mit denen in deiner known_hosts und, wenn du willst, mit dem, was ein anderer deiner Server sieht. Bewiesen ist erst etwas durch den Vergleich mit der Konsole deines Anbieters.",
                "todo": "Im Zweifel nicht verbinden. In der Konsole deines Anbieters den Fingerabdruck des Servers lesen (ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub) und mit dem neuen vergleichen. Passt er: ssh-keygen -R <adresse>, dann neu verbinden."
          },
          "en": {
                "title": "SSH: the server's key has changed",
                "what": "Every SSH server shows a public key (its fingerprint) when you connect. Your machine remembers it in known_hosts and raises the alarm when it changes (“REMOTE HOST IDENTIFICATION HAS CHANGED”).",
                "why": "Either the server was reinstalled (then all keys are created again), or the address belongs to someone else now, or someone sits in between posing as the server. Confirming blindly gives a stranger your password or session.",
                "signs": "Stands out: only part of the keys is new, you see different keys from two places, or you did not rebuild the server at all.",
                "normal": "Normal: you reinstalled the server or rebuilt it at your provider, all key types are new, and from several places you see the same new key.",
                "how": "Without logging in I read only the server's public keys, compare them with the ones in your known_hosts and, if you like, with what another of your servers sees. Only a comparison with your provider's console proves anything.",
                "todo": "When in doubt, do not connect. In your provider's console read the server's fingerprint (ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub) and compare it with the new one. If it matches: ssh-keygen -R <address>, then connect again."
          },
          "es": {
                "title": "SSH: la llave del servidor ha cambiado",
                "what": "Cada servidor SSH muestra una llave pública (su huella) al conectar. Tu equipo la recuerda en known_hosts y da la alarma si cambia («REMOTE HOST IDENTIFICATION HAS CHANGED»).",
                "why": "O el servidor se reinstaló (entonces se crean todas las llaves de nuevo), o la dirección ahora es de otra persona, o alguien se interpone y se hace pasar por el servidor. Confirmar a ciegas le da a un extraño tu contraseña o tu sesión.",
                "signs": "Llama la atención: solo una parte de las llaves es nueva, ves llaves distintas desde dos lugares, o no reinstalaste el servidor.",
                "normal": "Normal: reinstalaste el servidor o lo reconstruiste en tu proveedor, todos los tipos de llave son nuevos y desde varios lugares ves la misma llave nueva.",
                "how": "Sin iniciar sesión leo solo las llaves públicas del servidor, las comparo con las de tu known_hosts y, si quieres, con lo que ve otro de tus servidores. Solo la comparación con la consola de tu proveedor demuestra algo.",
                "todo": "En caso de duda, no te conectes. En la consola de tu proveedor lee la huella del servidor (ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub) y compárala con la nueva. Si coincide: ssh-keygen -R <dirección> y conecta de nuevo."
          }
    },
    {
          "id": "codegeheimnisse",
          "aliases": [
                "code",
                "schlüssel im code",
                "tokens",
                "api keys",
                "api-schlüssel",
                "secrets im code",
                "passwörter im code",
                "claves",
                "claves en el código",
                "tiefenlauf",
                "deep run",
                "deep scan",
                "git secrets",
                "contraseñas en el código"
          ],
          "de": {
                "title": "Schlüssel und Passwörter im Code deiner Projekte",
                "what": "API-Schlüssel, Tokens, private Schlüssel und Passwörter, die im Quellcode oder in Konfigurationsdateien deiner Projekte stehen.",
                "why": "Landet so ein Schlüssel im Git oder auf GitHub, finden ihn Bots in Minuten. Wer ihn hat, handelt in deinem Namen: Server, Cloud-Konto, Zahlungen.",
                "signs": "Auffällig: ein Schlüssel in einer Datei, die im Git eingecheckt ist oder je war, oder in einer Datei, die alle lesen dürfen.",
                "normal": "Unauffällig: ein Schlüssel in einer privaten Datei (Rechte 600), die Git ignoriert und die nie eingecheckt war, zum Beispiel deine lokale .env.",
                "how": "Der Tiefenlauf sucht in deinen Projektordnern mit den Mustern der Prüf-Bib, passend zu den Systemen, die er dort findet. Bei einem Treffer schaut er nach: Rechte, Git-Lage, je eingecheckt? Den Wert zeigt er nie.",
                "todo": "War der Schlüssel im Git: erst beim Anbieter erneuern, dann aus Git nehmen. Bei offenen Rechten: chmod go-rwx. Lokale Schlüssel in die .gitignore."
          },
          "en": {
                "title": "Keys and passwords in the code of your projects",
                "what": "API keys, tokens, private keys and passwords written into the source code or config files of your projects.",
                "why": "Once such a key lands in Git or on GitHub, bots find it in minutes. Whoever has it acts in your name: servers, cloud account, payments.",
                "signs": "Stands out: a key in a file that is committed to Git, or ever was, or in a file everyone may read.",
                "normal": "Normal: a key in a private file (mode 600) that Git ignores and that was never committed, for example your local .env.",
                "how": "The deep run searches your project folders with the patterns of the check library, matched to the systems it finds there. On a hit it looks closer: rights, git state, ever committed? It never shows the value.",
                "todo": "If the key was in Git: renew it at the provider first, then remove it from Git. Open rights: chmod go-rwx. Put local keys in .gitignore."
          },
          "es": {
                "title": "Claves y contraseñas en el código de tus proyectos",
                "what": "Claves de API, tokens, claves privadas y contraseñas escritas en el código fuente o en archivos de configuración de tus proyectos.",
                "why": "Cuando una clave así llega a Git o a GitHub, los bots la encuentran en minutos. Quien la tiene actúa en tu nombre: servidores, cuenta en la nube, pagos.",
                "signs": "Llama la atención: una clave en un archivo que está en Git, o lo estuvo, o en un archivo que todos pueden leer.",
                "normal": "Normal: una clave en un archivo privado (permisos 600) que Git ignora y que nunca se subió, por ejemplo tu .env local.",
                "how": "La pasada profunda busca en tus carpetas de proyecto con los patrones de la biblioteca, según los sistemas que encuentra allí. Si hay un hallazgo, mira más de cerca: permisos, estado de git, ¿se subió alguna vez? Nunca muestra el valor.",
                "todo": "Si la clave estuvo en Git: renuévala primero con el proveedor y luego quítala de Git. Permisos abiertos: chmod go-rwx. Pon las claves locales en .gitignore."
          }
    },
    {
      "id": "php2shell",
      "aliases": [
        "php2shell",
        "php 2 shell",
        "php shell",
        "php",
        "rce",
        "remote code execution",
        "cve 2026 109618",
        "cve 2026 109619",
        "php lücke",
        "php luecke"
      ],
      "de": {
        "title": "PHP2Shell — Remote Code Execution im PHP-Kern",
        "what": "Eine Lücke im PHP-Kern (CVE-2026-109618/-619): Wer sie ausnutzt, führt eigenen Code auf deinem Server aus — aus der Ferne, ohne Passwort.",
        "why": "Damit kann ein Fremder Dateien lesen, Daten abziehen oder deinen Server für Angriffe benutzen. Betroffen ist jeder Server mit ungepatchtem PHP, das Anfragen aus dem Netz bekommt.",
        "signs": "Auffällig: eine PHP-Version unter 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12 — und im Changelog deiner Distro steht der CVE nicht.",
        "normal": "Unauffällig: eine neuere Version, oder eine ältere, deren Distro den Fix zurückportiert hat (der Changelog nennt den CVE), oder gar kein PHP.",
        "how": "Ich lese die PHP-Version, dann den Changelog deiner Distro nach dem CVE. Die Versionsnummer allein entscheidet nie, weil Distros leise flicken.",
        "todo": "Paket aktualisieren und PHP-FPM neu starten. Ich zeige dir den Plan und ändere erst nach deinem Ja etwas."
      },
      "en": {
        "title": "PHP2Shell — remote code execution in the PHP core",
        "what": "A flaw in the PHP core (CVE-2026-109618/-619): whoever exploits it runs their own code on your server — from the outside, without a password.",
        "why": "With that a stranger can read files, pull out data or use your server to attack others. Every server with unpatched PHP that receives requests from the net is affected.",
        "signs": "Stands out: a PHP version below 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12 — and your distro's changelog does not name the CVE.",
        "normal": "Normal: a newer version, or an older one whose distro back-ported the fix (the changelog names the CVE), or no PHP at all.",
        "how": "I read the PHP version, then your distro's changelog for the CVE. The version number alone never decides, because distros patch quietly.",
        "todo": "Update the package and restart PHP-FPM. I show you the plan and change nothing before your yes."
      },
      "es": {
        "title": "PHP2Shell — ejecución remota de código en el núcleo de PHP",
        "what": "Una falla en el núcleo de PHP (CVE-2026-109618/-619): quien la explota ejecuta su propio código en tu servidor, desde fuera y sin contraseña.",
        "why": "Con eso un extraño puede leer archivos, sacar datos o usar tu servidor para atacar a otros. Afecta a todo servidor con PHP sin parche que reciba peticiones de la red.",
        "signs": "Llama la atención: una versión de PHP por debajo de 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12, y el changelog de tu distro no nombra el CVE.",
        "normal": "Normal: una versión más nueva, o una más vieja cuya distro portó el arreglo (el changelog nombra el CVE), o ningún PHP.",
        "how": "Leo la versión de PHP y luego el changelog de tu distro buscando el CVE. El número de versión por sí solo nunca decide, porque las distros parchean en silencio.",
        "todo": "Actualizar el paquete y reiniciar PHP-FPM. Te muestro el plan y no cambio nada antes de tu sí."
      }
    },
    {
      "id": "secrets",
      "aliases": [
        "env",
        "secrets",
        "secretos",
        "geheimnisse",
        "passwörter",
        "passwoerter",
        "passwords",
        "contraseñas",
        "backup",
        "backups",
        "copias de seguridad",
        "sql dump",
        "dump",
        "schlüssel",
        "keys",
        "llaves"
      ],
      "de": {
        "title": "Offen lesbare Geheimnisse im Web-Verzeichnis",
        "what": "Dateien wie .env, Datenbank-Dumps (*.sql), Backups (*.bak, *.old), .git/config und Schlüssel (id_rsa, *.pem), die im Web-Verzeichnis liegen und die jeder lesen darf.",
        "why": "Ein einziger Aufruf im Browser reicht, um dein Datenbank-Passwort oder deinen Quellcode zu holen. Das ist der häufigste Weg, wie kleine Seiten übernommen werden.",
        "signs": "Auffällig: eine .env, ein Dump oder ein Backup direkt im Webroot, besonders wenn alle sie lesen dürfen (Rechte -rw-r--r--).",
        "normal": "Unauffällig: Geheimnisse liegen außerhalb des Webroots oder sind nur für den Dienstnutzer lesbar; im Webroot liegen nur Seiten und Bilder.",
        "how": "Ich suche in den üblichen Web-Verzeichnissen (/var/www …) nach diesen Dateinamen und prüfe, ob „andere“ sie lesen dürfen. Den Inhalt lese ich nie.",
        "todo": "Datei aus dem Webroot nehmen oder das Leserecht für andere entziehen (chmod o-rwx). War sie schon offen: Passwörter darin als verbrannt behandeln und tauschen."
      },
      "en": {
        "title": "Openly readable secrets in the web directory",
        "what": "Files like .env, database dumps (*.sql), backups (*.bak, *.old), .git/config and keys (id_rsa, *.pem) sitting in the web directory where anyone may read them.",
        "why": "One request in a browser is enough to fetch your database password or your source code. This is the most common way small sites get taken over.",
        "signs": "Stands out: a .env, a dump or a backup straight in the web root, especially readable by everyone (permissions -rw-r--r--).",
        "normal": "Normal: secrets live outside the web root or are readable only by the service user; the web root holds only pages and images.",
        "how": "I search the usual web directories (/var/www …) for these file names and check whether “others” may read them. I never read the contents.",
        "todo": "Move the file out of the web root or take away the read right for others (chmod o-rwx). If it was already open, treat the passwords in it as burnt and change them."
      },
      "es": {
        "title": "Secretos legibles abiertamente en el directorio web",
        "what": "Archivos como .env, volcados de base de datos (*.sql), copias (*.bak, *.old), .git/config y llaves (id_rsa, *.pem) en el directorio web, donde cualquiera puede leerlos.",
        "why": "Una sola petición en el navegador basta para sacar la contraseña de tu base de datos o tu código fuente. Es la forma más habitual de que tomen sitios pequeños.",
        "signs": "Llama la atención: un .env, un volcado o una copia directamente en la raíz web, sobre todo legible por todos (permisos -rw-r--r--).",
        "normal": "Normal: los secretos están fuera de la raíz web o solo los lee el usuario del servicio; la raíz web solo tiene páginas e imágenes.",
        "how": "Busco esos nombres de archivo en los directorios web habituales (/var/www …) y compruebo si «otros» pueden leerlos. Nunca leo el contenido.",
        "todo": "Sacar el archivo de la raíz web o quitar el permiso de lectura a otros (chmod o-rwx). Si ya estaba abierto, da por quemadas las contraseñas que contiene y cámbialas."
      }
    },
    {
      "id": "webshell",
      "aliases": [
        "webshell",
        "webshells",
        "web shell",
        "backdoor",
        "backdoors",
        "hintertür",
        "hintertüren",
        "hintertuer",
        "puerta trasera",
        "c99",
        "r57",
        "wso",
        "b374k",
        "fremde dateien"
      ],
      "de": {
        "title": "Webshells — fremde Hintertüren in PHP-Dateien",
        "what": "Eine Webshell ist eine kleine PHP-Datei, die ein Angreifer auf deinen Server legt, um später Befehle aus dem Browser auszuführen.",
        "why": "Wer eine Webshell hat, steuert deinen Server — auch nachdem du die ursprüngliche Lücke geschlossen hast. Oft bleibt sie monatelang unbemerkt.",
        "signs": "Auffällig: PHP-Code, der Eingaben ($_GET/$_POST) direkt ausführt — eval(base64_decode(…)), system($_POST[…]) — oder Dateien mit den Namen bekannter Shells (c99, r57, WSO).",
        "normal": "Unauffällig: normale Seiten und Plugins, die Eingaben prüfen und nie direkt ausführen. Einzelne Treffer können harmlos sein (alte Plugins), darum suche ich nur Muster und urteile vorsichtig.",
        "how": "Ich durchsuche die PHP-Dateien im Webroot nach diesen Mustern und nenne nur den Pfad, nie den Inhalt (er könnte Schadcode sein).",
        "todo": "Jede genannte Datei von Hand ansehen. Ist sie nicht von dir: offline nehmen, den Eingang suchen (Logs, Updates), Passwörter tauschen."
      },
      "en": {
        "title": "Webshells — foreign backdoors in PHP files",
        "what": "A webshell is a small PHP file an attacker puts on your server to run commands later from a browser.",
        "why": "Whoever has a webshell controls your server, even after you closed the original hole. It often stays unnoticed for months.",
        "signs": "Stands out: PHP code that runs input ($_GET/$_POST) directly — eval(base64_decode(…)), system($_POST[…]) — or files named after known shells (c99, r57, WSO).",
        "normal": "Normal: ordinary pages and plugins that check input and never run it directly. A single hit can be harmless (old plugins), so I only look for patterns and judge carefully.",
        "how": "I search the PHP files in the web root for these patterns and name only the path, never the contents (they could be malicious code).",
        "todo": "Look at every named file by hand. If it is not yours: take it offline, find the way in (logs, updates), change passwords."
      },
      "es": {
        "title": "Webshells — puertas traseras ajenas en archivos PHP",
        "what": "Una webshell es un pequeño archivo PHP que un atacante deja en tu servidor para ejecutar comandos más tarde desde un navegador.",
        "why": "Quien tiene una webshell controla tu servidor, incluso después de cerrar el agujero original. A menudo pasa meses sin notarse.",
        "signs": "Llama la atención: código PHP que ejecuta la entrada ($_GET/$_POST) directamente — eval(base64_decode(…)), system($_POST[…]) — o archivos con nombre de shells conocidas (c99, r57, WSO).",
        "normal": "Normal: páginas y plugins corrientes que comprueban la entrada y nunca la ejecutan directamente. Un solo hallazgo puede ser inofensivo (plugins viejos), por eso solo busco patrones y juzgo con cuidado.",
        "how": "Busco esos patrones en los archivos PHP de la raíz web y nombro solo la ruta, nunca el contenido (podría ser código malicioso).",
        "todo": "Mirar a mano cada archivo nombrado. Si no es tuyo: desconectarlo, buscar por dónde entraron (registros, actualizaciones) y cambiar contraseñas."
      }
    },
    {
      "id": "sshd",
      "aliases": [
        "ssh",
        "sshd",
        "root login",
        "root-login",
        "root einloggen",
        "passwort anmeldung",
        "password authentication",
        "password login",
        "brute force",
        "bruteforce",
        "fuerza bruta",
        "acceso root",
        "schlüssel anmeldung"
      ],
      "de": {
        "title": "SSH — Root-Login und Passwort-Anmeldung",
        "what": "SSH ist die Tür, durch die du deinen Server verwaltest. Gefährlich wird sie, wenn Root sich per Passwort anmelden darf.",
        "why": "Dann können Bots aus dem ganzen Netz Root-Passwörter durchprobieren. Ein schwaches Passwort, und der Server gehört ihnen.",
        "signs": "Auffällig: PermitRootLogin yes zusammen mit PasswordAuthentication yes.",
        "normal": "Unauffällig: Anmeldung nur mit Schlüssel (PasswordAuthentication no) und Root nur per Schlüssel (prohibit-password). Ein Passwort-Login allein ist nicht schön, aber nicht die offene Tür.",
        "how": "Ich lese die wirksame SSH-Konfiguration (sshd -T), nicht nur die Datei, damit keine Nebendatei etwas versteckt.",
        "todo": "Erst sicherstellen, dass dein Schlüssel funktioniert, dann die Passwort-Anmeldung abschalten und Root nur per Schlüssel zulassen."
      },
      "en": {
        "title": "SSH — root login and password login",
        "what": "SSH is the door you use to manage your server. It becomes dangerous when root may log in with a password.",
        "why": "Then bots from all over the net can try root passwords. One weak password and the server is theirs.",
        "signs": "Stands out: PermitRootLogin yes together with PasswordAuthentication yes.",
        "normal": "Normal: login only with a key (PasswordAuthentication no) and root only by key (prohibit-password). A password login alone is not nice, but it is not the open door.",
        "how": "I read the effective SSH configuration (sshd -T), not just the file, so that no side file can hide something.",
        "todo": "First make sure your key works, then switch off password login and allow root by key only."
      },
      "es": {
        "title": "SSH — acceso de root y acceso con contraseña",
        "what": "SSH es la puerta con la que administras tu servidor. Se vuelve peligrosa cuando root puede entrar con contraseña.",
        "why": "Entonces bots de toda la red pueden probar contraseñas de root. Una contraseña débil y el servidor es suyo.",
        "signs": "Llama la atención: PermitRootLogin yes junto con PasswordAuthentication yes.",
        "normal": "Normal: entrada solo con llave (PasswordAuthentication no) y root solo con llave (prohibit-password). Un acceso con contraseña por sí solo no es bonito, pero no es la puerta abierta.",
        "how": "Leo la configuración efectiva de SSH (sshd -T), no solo el archivo, para que ningún archivo secundario esconda algo.",
        "todo": "Primero asegúrate de que tu llave funciona; luego apaga el acceso con contraseña y deja entrar a root solo con llave."
      }
    },
    {
      "id": "rechte",
      "aliases": [
        "rechte",
        "dateirechte",
        "berechtigungen",
        "permissions",
        "file permissions",
        "permisos",
        "chmod",
        "world writable",
        "beschreibbar",
        "schreibrechte",
        "777",
        "666"
      ],
      "de": {
        "title": "Dateirechte — für alle beschreibbare Dateien",
        "what": "Jede Datei hat Rechte: wer sie lesen, schreiben und ausführen darf. Kritisch sind Dateien, die jeder auf dem System ändern darf.",
        "why": "Kann jeder eine Konfiguration oder PHP-Datei überschreiben, genügt ein kleiner Einbruch (etwa über ein Plugin), um daraus volle Kontrolle zu machen.",
        "signs": "Auffällig: Dateien in /etc oder im Webroot mit Schreibrecht für „alle“ (Rechte -rw-rw-rw-, chmod 666/777).",
        "normal": "Unauffällig: Konfigurationen gehören root und sind nur für root beschreibbar; Webdateien gehören dem Dienstnutzer, nicht „allen“.",
        "how": "Ich suche in /etc und in den Web-Verzeichnissen nach Dateien, die andere beschreiben dürfen.",
        "todo": "Das Schreibrecht für andere entziehen (chmod o-w). Danach prüfen, ob die Datei wirklich von dir ist."
      },
      "en": {
        "title": "File permissions — files writable by everyone",
        "what": "Every file has permissions: who may read, write and run it. Files that anyone on the system may change are critical.",
        "why": "If anyone can overwrite a configuration or a PHP file, one small break-in (say through a plugin) is enough to turn it into full control.",
        "signs": "Stands out: files in /etc or in the web root with write permission for “everyone” (permissions -rw-rw-rw-, chmod 666/777).",
        "normal": "Normal: configuration files belong to root and only root can write them; web files belong to the service user, not to “everyone”.",
        "how": "I search /etc and the web directories for files that others may write.",
        "todo": "Take away the write right for others (chmod o-w). Then check whether the file really is yours."
      },
      "es": {
        "title": "Permisos de archivos — escribibles por todos",
        "what": "Cada archivo tiene permisos: quién puede leerlo, escribirlo y ejecutarlo. Son críticos los archivos que cualquiera del sistema puede cambiar.",
        "why": "Si cualquiera puede sobrescribir una configuración o un archivo PHP, basta una pequeña intrusión (por ejemplo por un plugin) para convertirla en control total.",
        "signs": "Llama la atención: archivos en /etc o en la raíz web con permiso de escritura para «todos» (permisos -rw-rw-rw-, chmod 666/777).",
        "normal": "Normal: las configuraciones son de root y solo root las escribe; los archivos web son del usuario del servicio, no de «todos».",
        "how": "Busco en /etc y en los directorios web archivos que otros puedan escribir.",
        "todo": "Quitar el permiso de escritura a otros (chmod o-w). Luego comprobar si el archivo de verdad es tuyo."
      }
    }
  ],
};
