// More natural-language catchers: a report request, a general "check this machine" request, and a helper that strips a
// leading greeting so "Good morning, give this machine a once-over" still reaches the check. Plain words, no probability.
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");

// A greeting at the very start, with an optional comma/name after it, so the real request behind it can be matched.
const GREETING = /^\s*(guten\s+(morgen|tag|abend)|hallo|hi|hey|servus|moin|good\s+(morning|afternoon|evening)|hello|hola|buenos\s+d[ií]as|buenas)\b[\s,!.-]*/i;
export const stripGreeting = (line) => String(line || "").replace(GREETING, "").trim() || String(line || "");

// Asks for a written report / summary of the run.
const REPORTWORD = W("rapport[\\p{L}\\p{N}]*|bericht[\\p{L}\\p{N}]*|report[\\p{L}\\p{N}]*|informe[\\p{L}\\p{N}]*|zusammenfass[\\p{L}\\p{N}]*|summary|resumen");
const FASS = W("fass[\\p{L}\\p{N}]*");
export const wantsReport = (line) => {
  const l = String(line || "");
  if (REPORTWORD.test(l)) return true;
  if (FASS.test(l) && W("zusammen|alles|all").test(l) && W("schreib[\\p{L}\\p{N}]*|write|gib|give|mach[\\p{L}\\p{N}]*|make").test(l)) return true;
  return false;
};

// Asks for a broad check of this machine ("once-over", "rundum-check", "give it a look", "is it clean").
const CHECKVERB = W("check[\\p{L}\\p{N}]*|pr[üu]f[\\p{L}\\p{N}]*|durchcheck[\\p{L}\\p{N}]*|scan[\\p{L}\\p{N}]*|schau[\\p{L}\\p{N}]*|guck[\\p{L}\\p{N}]*|look|once-?over|rundum-?check|rundown|durchsehen|überblick|overview|review");
const MACHINE = W("rechner|machine|box|system|kiste|laptop|computer|pc|server|equipo|m[aá]quina|hier|here|this|dies[\\p{L}\\p{N}]*");
const CLEAN = W("clean|sauber|gesund|ok|in ?ordnung|limpio|sano");
export const wantsCheck = (line) => {
  const l = String(line || "");
  if (W("rundum-?check|once-?over|rundown|komplett[\\p{L}\\p{N}]*check|full check|complete check").test(l)) return true;
  if (CHECKVERB.test(l) && MACHINE.test(l)) return true;                       // "check the box", "scan this machine", "schau dir den rechner an"
  if (CLEAN.test(l) && W("ob|if|whether|si").test(l) && (CHECKVERB.test(l) || W("ist|is|est[aá]").test(l))) return true;   // "... and let me know if it's clean"
  return false;
};

// Asks Dante to explain what he watches and why.
const EXPLAINVERB = W("erz[aä]hl[\\p{L}\\p{N}]*|im blick|erkl[aä]r[\\p{L}\\p{N}]*|explain|expl[ií]ca[\\p{L}\\p{N}]*|was.*(machst|[uü]berwachst|pr[üu]fst|wachst)|what.*(watch[\\p{L}\\p{N}]*|you do|check[\\p{L}\\p{N}]*)|qu[eé].*(vigila[\\p{L}\\p{N}]*|haces)");
export const wantsExplain = (line) => {
  const l = String(line || "");
  return EXPLAINVERB.test(l) && W("du|you|t[uú]|was|what|qu[eé]|wof[üu]r|why|warum|por qu[eé]").test(l);
};

// "What can you do for me?" -> the help text (a plain question gets a plain answer, not "do you mean help?").
export const wantsCapabilities = (line) => /(was|what)\s+(kannst|k[oö]nntest|can|could)\s+(du|you)\b|what do you do|was machst du|qu[eé] puedes|qu[eé] haces/i.test(String(line || ""));
// "What am I even running on?" -> system info
export const wantsWhatRunning = (line) => /\b(what|which)\b.*\b(am i|i am|is this|are we)\b.*\b(running|on)\b|was l[aä]uft (hier|bei mir|auf)|auf was l[aä]uft|welches (system|betriebssystem)/i.test(String(line || ""));
