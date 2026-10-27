// Replaces personal values in a sentence (paths, hosts, mails, tokens, numbers, names) with placeholders
// before it is used as training data. wash(text) returns { text, hits }.
// The order of the rules matters, longer patterns first. It prefers leaving something in over
// removing too much: names are only replaced with a clear cue (known first name + surname, title,
// "my name is"), domains need a known TLD, versions and CVE ids stay.

const L = "\\p{L}\\p{N}_";
const TLD = "com|net|org|io|de|es|fr|uk|us|ai|app|dev|co|info|biz|eu|online|space|xyz|site|cloud|me|tv|ch|at|nl|it|ru|cn|jp|do|edu|gov|store|shop|pro|tech";

const FIRST = new Set(("Mustafa Ahmet Mehmet Ali Hasan Hüseyin Ibrahim Yusuf Murat Emre Can Burak Kemal Ayşe Fatma Zeynep Elif " +
  "Peter Thomas Michael Andreas Stefan Christian Markus Matthias Martin Klaus Jürgen Wolfgang Hans Karl Uwe Dieter Bernd Jörg Sven Tobias Florian Lukas Jonas Felix Moritz Niklas Daniel Sebastian Alexander Maximilian Philipp Dominik Patrick Oliver Heiko Ralf " +
  "Anna Maria Julia Sabine Petra Monika Claudia Susanne Andrea Nicole Katharina Sandra Stefanie Christina Lisa Laura Sarah Lena Hannah Sophie Lea Jessica Melanie Birgit Ursula Renate Brigitte " +
  "John James Robert David Richard Joseph Charles Christopher Matthew Anthony Steven Kevin Brian Jason Jeffrey Ryan Jacob Gary Nicholas Eric Jonathan Justin Brandon Samuel Benjamin Gregory Raymond Patricia Jennifer Linda Elizabeth Barbara Susan Margaret Dorothy Karen Nancy Betty Sharon Michelle Emily Amanda Kimberly Deborah Stephanie Rebecca Amy " +
  "José Juan Carlos Luis Miguel Pedro Pablo Jorge Manuel Francisco Antonio Javier Fernando Rafael Alejandro Diego Sergio Ramón Raúl Héctor Víctor Marta Carmen Lucía Isabel Rosa Teresa Pilar Dolores Ana Laura Sofía Valentina Camila Yesenia Yoselin Yanira Wilkin Wander Nelson Franklin Rafaela Altagracia").split(" "));

const TITLE = "Herr|Frau|Dr\\.?|Prof\\.?|Mr\\.?|Mrs\\.?|Ms\\.?|Miss|Señor|Señora|Sr\\.?|Sra\\.?|Don|Doña|Profe|Profesor|Profesora|Lic\\.?|Ing\\.?";
const INTRO = "mein Name ist|ich heiße|ich heisse|mein Name lautet|my name is|my name's|me llamo|mi nombre es|soy";
const CAP = "[A-ZÄÖÜÁÉÍÓÚÑ][a-zäöüßáéíóúñ]{2,}";

export function wash(text) {
  let s = String(text ?? "");
  const hits = {};
  const sub = (re, tag, fn) => {
    s = s.replace(re, (...a) => {
      const m = a[0];
      const r = fn ? fn(m, a) : null;
      if (r === false) return m;               // validator said: not personal
      const tail = r ? r[1] : "";              // trailing punctuation that stays outside the tag
      hits[tag] = (hits[tag] || 0) + 1;
      return `{${tag}}` + tail;
    });
  };
  const trimTail = (m, chars = ".,;:!?)]}'\"") => {
    let i = m.length;
    while (i > 0 && chars.includes(m[i - 1])) i--;
    return [m.slice(0, i), m.slice(i)];
  };

  // 1. URL (before domain/path)
  sub(/\b(?:https?|ftp|sftp|ssh|wss?):\/\/[^\s<>"'`]+|(?<![\p{L}\p{N}_@.\/-])www\.[^\s<>"'`]+/giu, "URL", (m) => trimTail(m));
  // 2. ssh key paths and key files
  sub(new RegExp(`(?<![${L}])(?:~|/[\\w./-]*|\\.)?/?\\.ssh/[\\w.-]+|(?<![${L}])[\\w./-]*\\.(?:pem|ppk)(?![${L}])|(?<![${L}])id_(?:rsa|ed25519|ecdsa|dsa)[\\w.]*`, "gu"), "KEY");
  // 3. mail, then user@host (host with IP or without TLD)
  sub(new RegExp(`[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]{2,}(?![${L}@])`, "gu"), "MAIL");
  sub(new RegExp(`(?<![${L}@.])[\\w.-]+@(?:\\d{1,3}(?:\\.\\d{1,3}){3}|[\\w-]+(?:\\.[\\w-]+)*)(?![${L}@])`, "gu"), "ZIEL");
  // 4. prefixed tokens (sk-..., ghp_..., AKIA..., JWT)
  sub(/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*|\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}|\b(?:ghp|gho|ghs|github_pat|xox[bap]|glpat)[_-][A-Za-z0-9_-]{16,}|\bAKIA[0-9A-Z]{12,}|\bAIza[\w-]{30,}/g, "KEY");
  // 5. IPv4 (validated octets), IPv6
  sub(/(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w]|\.\d)/g, "IP", (m) => m.split(".").every((o) => +o <= 255) ? null : false);
  sub(/(?<![\w:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![\w:])/gi, "IP", (m) =>
    /^[0-9a-f:]+$/i.test(m) && (m.includes("::") || m.split(":").length === 8) && /[0-9a-f]/i.test(m) ? null : false);
  // 6. domains
  sub(new RegExp(`(?<![${L}@./-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLD})(?![${L}-])(?!\\.[a-z0-9])`, "giu"), "ZIEL");
  // 7. paths: ~/..., C:\..., /a/b, /etc
  sub(new RegExp(`(?<![${L}/.:~-])~/[^\\s"'\`<>|]*`, "gu"), "PFAD", (m) => trimTail(m, ".,;:!?)]}"));
  sub(new RegExp(`(?<![${L}])[A-Za-z]:\\\\[^\\s"'\`<>|]*`, "gu"), "PFAD", (m) => trimTail(m, ".,;:!?)]}"));
  sub(new RegExp(`(?<![${L}/.:~)-])/(?:[\\w.@%+~-]+/)+[\\w.@%+~-]*|(?<![${L}/.:~)-])/(?:etc|var|usr|root|home|tmp|opt|srv|bin|mnt|proc|dev|Users|Volumes|Library|lib|sys)(?![${L}-])`, "gu"), "PFAD", (m) => trimTail(m, ".,;:!?)"));
  // 8. card / IBAN / phone / long numbers
  sub(/(?<![\w])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?(?![\w])/g, "NUM");
  sub(/(?<![\w.-])\d{4}(?:[ -]\d{4}){3}(?![\w])/g, "NUM");
  sub(/(?<![\w.])\+\d[\d\s().-]{7,}\d|(?<![\w.-])\(\d{3}\)\s?\d{3}[-\s]\d{4}|(?<![\w.-])\d{3}[-.\s]\d{3}[-.\s]\d{4}(?![\w])|(?<![\w.-])0\d{2,4}[\s\/-]\d{3,}(?:[\s-]\d+)*(?![\w])/g, "TEL");
  sub(/(?<![\w.-])\d{6,}(?![\w]|\.\d)/g, "NUM");
  // 9. hex / base64-ish keys (>=20)
  sub(/(?<![\w])[0-9a-f]{20,}(?![\w])/gi, "KEY", (m) => /[a-f]/i.test(m) && /\d/.test(m) ? null : false);
  sub(/(?<![\w+\/=-])[A-Za-z0-9+\/_-]{20,}={0,2}(?![\w+\/=-])/g, "KEY", (m) =>
    /[a-z]/.test(m) && /[A-Z]/.test(m) && /\d/.test(m) && m.split(/[-_]/).filter((x) => /^[a-z]{3,}$/.test(x)).length < 2 ? null : false);
  // 10. secret labels: "password: x", "token=x"
  s = s.replace(/\b(password|passwort|passwd|pwd|pass|contraseña|clave|token|secret|api[_ -]?key)(\s*[:=]\s*)(?!\{)([^\s,;]+)/gi, (m, k, sep) => {
    hits.KEY = (hits.KEY || 0) + 1; return `${k}${sep}{KEY}`;
  });
  // 11. names (see limits above)
  s = s.replace(new RegExp(`\\b(${TITLE})\\s+(${CAP}(?:\\s+${CAP})?)`, "g"), (m, t) => { hits.NAME = (hits.NAME || 0) + 1; return `${t} {NAME}`; });
  s = s.replace(new RegExp(`\\b(${INTRO})\\s+(${CAP}(?:\\s+${CAP})?)`, "gi"), (m, t, n) => {
    if (!/^[A-ZÄÖÜÁÉÍÓÚÑ]/.test(n)) return m;
    hits.NAME = (hits.NAME || 0) + 1; return `${t} {NAME}`;
  });
  // lowercase names only after an explicit messaging cue: "escribirle a danny jose un hola"
  s = s.replace(/\b(escrib(?:ir|ele|irle)|escriv(?:ir|irle)|escríbele|mándale|mandale|dile)\s+a\s+((?!(?:la|el|los|las|un|una|mi|mis|tu|tus|todos|todas|este|esta|ese|esa|mi|me|ti|él|ella|ellos|alguien|quien)\b)[a-záéíóúñ]{3,}(?:\s+(?!(?:un|una|el|la|que|para|con|y|en|por|de|sobre|diciendo)\b)[a-záéíóúñ]{3,}){0,2})/gi, (m, v) => {
    hits.NAME = (hits.NAME || 0) + 1; return `${v} a {NAME}`;
  });
  s = s.replace(new RegExp(`(?<![${L}])(${CAP})\\s+(${CAP})(?![${L}])`, "gu"), (m, a, b) => {
    if (!FIRST.has(a) || FIRST.has(b)) return m;
    hits.NAME = (hits.NAME || 0) + 1; return "{NAME}";
  });
  return { text: s, hits };
}
