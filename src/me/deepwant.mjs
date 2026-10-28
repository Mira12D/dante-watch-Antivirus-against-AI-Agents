// Free sentences asking to search the person's own code/projects for leaked secrets -> the deep run (command "tief").
// Distinct from the key check (SSH access): this is about secrets/keys/passwords lying IN projects, repos, code, files,
// or "committed/leaked" secrets. Plain words, no probability; the deep run only reads, locally, and shows file+line, never the value.
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const SECRET = W("secrets?|secretos?|geheimnis[\\p{L}\\p{N}]*|passw[\\p{L}\\p{N}]*|passwords?|tokens?|api[- ]?keys?|schl[üu]ssel[\\p{L}\\p{N}]*|keys?|credentials?|zugangsdaten|claves?|contrase[nñ]as?");
const PLACE = W("projekt[\\p{L}\\p{N}]*|projects?|repos?|repositor[\\p{L}\\p{N}]*|code|quell[\\p{L}\\p{N}]*|dateien|files|codebase|c[oó]digo|configs?|konfig[\\p{L}\\p{N}]*|config-?dateien|settings|ordner|folders?");
const LEAK = W("hart ?(?:reingeschrieben|codiert|kodiert|drin|verdrahtet)|(?:rein|hinein) ?geschrieben|fest eingetragen|im code|im quelltext|hard ?wired|hard-?code[ds]?|geleakt|leaked|committe[\\p{L}\\p{N}]*|eingecheckt|gepush[\\p{L}\\p{N}]*|pushed|rumliegen|rumfliegen|vergessen|offen[\\p{L}\\p{N}]*|exposed|hard-?coded|hardcoded|expuest[\\p{L}\\p{N}]*|filtrad[\\p{L}\\p{N}]*");
const FIND = W("wissen|know|ob|if|whether|steh[\\p{L}\\p{N}]*|drin|geschrieben|wrote|written|find[\\p{L}\\p{N}]*|finde[\\p{L}\\p{N}]*|such[\\p{L}\\p{N}]*|scan[\\p{L}\\p{N}]*|durchsuch[\\p{L}\\p{N}]*|pr[üu]f[\\p{L}\\p{N}]*|check[\\p{L}\\p{N}]*|look|busca[\\p{L}\\p{N}]*|encontrar|revisa[\\p{L}\\p{N}]*|aufsp[üu]r[\\p{L}\\p{N}]*");

// true when the line asks to look through the person's own code/projects for secrets
export const wantsDeep = (line) => {
  const l = String(line || "");
  if (SECRET.test(l) && PLACE.test(l) && (FIND.test(l) || LEAK.test(l))) return true;   // "find secrets in my projects"
  if (SECRET.test(l) && LEAK.test(l)) return true;                                        // "leaked / committed secrets"
  return false;
};
