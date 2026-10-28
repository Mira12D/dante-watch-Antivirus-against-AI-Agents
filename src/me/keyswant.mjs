// Free sentences asking who still has access / which SSH keys -> the key check (id "schluessel").
// Plain words, no probability; the check only reads and never shows a key.
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const KEYWORD = W("authorized_keys|ssh-?schl[üu]ssel[\\p{L}]*|ssh-?keys?|schl[üu]ssel[\\p{L}]*|keys?|zug[aä]nge?|zugang|access|claves?|acceso|llaves?");
const SSH = /\b(ssh|authorized_keys)\b/i;
const WHO = W("wer|who|qui[eé]n|welche[rs]?|which|qu[eé]|was f[üu]r");
const STILL = W("noch|still|todav[ií]a|a[uú]n");
const ACCESSVERB = W("hat|haben|hab|kommt|kommen|rein|rein ?kommt|einloggen|anmelden|has|have|get|gets?|reach|log ?in|logs? ?in|log ?into|ssh ?in|works?|funktioniert|geht|entra|entran|tiene|tienen|acceder");

// true when the line is clearly about "who can get in / which keys are on this box"
export const wantsKeys = (line) => {
  const l = String(line || "");
  if (/\bauthorized_keys\b/i.test(l)) return true;
  if (W("ssh-?schl[üu]ssel|ssh-?keys?").test(l)) return true;
  if (KEYWORD.test(l) && WHO.test(l) && (ACCESSVERB.test(l) || SSH.test(l) || STILL.test(l))) return true;
  if (W("schl[üu]ssel|keys?|claves?|llaves?").test(l) && STILL.test(l) && ACCESSVERB.test(l)) return true;
  if (WHO.test(l) && STILL.test(l) && W("rein|hinein|herein|in").test(l) && ACCESSVERB.test(l)) return true;   // "wer kommt hier noch rein"
  if (WHO.test(l) && W("log ?in|log ?into|logs? ?in|einloggen|anmelden|acceder|reinkommt|rein ?kommt").test(l)) return true;   // "who can (still) log into ..."
  if (WHO.test(l) && STILL.test(l) && W("ssh").test(l)) return true;                                  // "which people can still SSH in"
  if (KEYWORD.test(l) && STILL.test(l) && W("works?|funktioniert|g[üu]ltig|valid|geht").test(l)) return true;   // "whose key still works"
  return false;
};
