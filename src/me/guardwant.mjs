// Free sentences about the watch ("lege einen Köder aus", "I want a honeypot", "quiero un señuelo") -> the wachschutz command.
// Plain words, no probability: the command only ever shows its curl and waits for a yes before anything leaves the machine.
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const BAIT = W("lock-?datei[\\p{L}\\p{N}]*|lockvogel|attrappe[\\p{L}\\p{N}]*|honey-?tokens?|fake-?(?:keys?|env|datei[\\p{L}]*)|falsche[\\p{L}]* (?:schl[uü]ssel|keys|zugangsdaten)|wachhund[\\p{L}\\p{N}]*|trap(?: ?file)?|stolperfalle[\\p{L}\\p{N}]*|stolperdraht|tripwire|k[oö]der[\\p{L}\\p{N}]*|koeder[\\p{L}\\p{N}]*|honeypots?|honey ?pots?|bait[\\p{L}\\p{N}]*|decoys?|canary|canaries|canary ?tokens?|se[nñ]uelos?|trampa[\\p{L}\\p{N}]*|fallen?|falle");
const WATCH = W("wachschutz|w[aä]chter|waechter|vigilancia|guard|watch(?: ?service)?|alarm|alert|aviso|alarma");
const STEAL = W("klaut|klauen|geklaut|stiehlt|stehlen|bestiehlt|steals?|stolen|steal|roba|roban|robado|rob[oó]");
const WANT = W("will|wollen|m[oö]chte|brauche?|leg|lege|legen|auslegen|aus ?legen|stell|stelle|stellen|aufstellen|setz|setze|setzt|anschalten|einschalten|aktivier[\\p{L}\\p{N}]*|mach|mache|machen|bau|baue|bauen|erstell[\\p{L}\\p{N}]*|drop|want|need|set ?up|set|enable|turn on|place|plant|lay|create|quiero|necesito|activa[\\p{L}\\p{N}]*|crea[\\p{L}\\p{N}]*|pon|poner|coloca[\\p{L}\\p{N}]*");
const KINDS = [["env", /\.env\b|\benv\b|datenbank|database|base de datos/i], ["mcp", /\bmcp\b/i], ["npm", /\bnpm(?:rc)?\b|npm.?token/i], ["aws", /\baws\b|amazon|cloud ?zugang/i]];

const STRONG = W("wachschutz|w[aä]chter|waechter|vigilancia");
const NOTIFY = W("ping[\\p{L}\\p{N}]*|bescheid|benachrichtig[\\p{L}\\p{N}]*|alarm[\\p{L}\\p{N}]*|mail[\\p{L}\\p{N}]*|e-?mail[\\p{L}\\p{N}]*|email|notify|let me know|warn[\\p{L}\\p{N}]*|aviso|avisa[\\p{L}\\p{N}]*|wenn.*(dran|rein|drin|benutzt|touches|used)");
export const wantsWatch = (line) => {
  const l = String(line || "");
  if (BAIT.test(l) && NOTIFY.test(l)) return true;
  if (W("watch-?datei|watch file|wach-?datei").test(l)) return true;
  if (WATCH.test(l) && WANT.test(l) && NOTIFY.test(l)) return true;   // "set a watch ... let me know if it gets used"
  if (STRONG.test(l) && WANT.test(l)) return true;
  if (BAIT.test(l) && (WANT.test(l) || WATCH.test(l) || STEAL.test(l))) return true;
  if (WATCH.test(l) && (WANT.test(l)) && /\b(mail|e-?mail|alarm\w*|aviso|alert)\b/i.test(l)) return true;
  if (STEAL.test(l) && /\b(mail|e-?mail|bescheid|alarm\w*|aviso|alert|notify|benachrichtig\w*)\b/i.test(l) && /\b(key|keys|token|schl[uü]ssel|passw\w*|claves?|\.env)\b/i.test(l)) return true;
  return false;
};
// the words after the command word, as the session expects them: "köder <art>" when a kind is named, else nothing
export const watchArgs = (line) => {
  const l = String(line || "");
  if (!BAIT.test(l)) return [];
  const k = KINDS.find(([, re]) => re.test(l));
  return k ? ["köder", k[0]] : ["köder"];
};
