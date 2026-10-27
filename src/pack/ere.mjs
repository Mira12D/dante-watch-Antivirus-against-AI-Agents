// Pattern helpers. Library patterns are POSIX extended regexes so a server's grep can run them; local
// scans translate them to JavaScript here, and a pattern that does not translate cleanly is skipped.
// Also: the longest required literal of a pattern, and an Aho-Corasick matcher for fast prefiltering.
const POSIX = { alpha: "A-Za-z", digit: "0-9", alnum: "A-Za-z0-9", upper: "A-Z", lower: "a-z", space: "\\s", blank: " \\t", xdigit: "0-9A-Fa-f", punct: "!-\\/:-@\\[-`{-~" };

export function toJs(re) {
  let out = "";
  const s = String(re);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") { if (i + 1 >= s.length) return null; out += c + s[++i]; continue; }
    if (c === "[") {
      let j = i + 1, body = "";
      if (s[j] === "^") { body += "^"; j++; }
      if (s[j] === "]") { body += "\\]"; j++; }
      for (; j < s.length && s[j] !== "]"; j++) {
        if (s[j] === "[" && s[j + 1] === ":") {
          const end = s.indexOf(":]", j + 2), name = end > 0 ? s.slice(j + 2, end) : "";
          if (!POSIX[name]) return null;
          body += POSIX[name]; j = end + 1;
        } else if (s[j] === "\\") body += "\\\\";            // inside a POSIX bracket a backslash is a plain backslash
        else if (s[j] === "[") body += "\\[";
        else body += s[j];
      }
      if (j >= s.length) return null;
      out += "[" + body + "]"; i = j; continue;
    }
    out += c;
  }
  try { return new RegExp(out); } catch { return null; }
}

// The longest run of fixed characters the pattern REQUIRES: a file without it cannot match, so it is the key of the
// prefilter. Only text at the top level counts (not inside a group or a class), a character that is made optional
// by * ? { is not required, and a pattern with a top-level | has no required text at all.
export function literalOf(re) {
  const s = String(re);
  let best = "", cur = "", depth = 0;
  const flush = () => { if (cur.length > best.length) best = cur; cur = ""; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") { i++; if (!depth) cur += s[i] ?? ""; continue; }
    if (c === "[") { flush(); i++; if (s[i] === "^") i++; if (s[i] === "]") i++; while (i < s.length && s[i] !== "]") { if (s[i] === "[" && s[i + 1] === ":") i = s.indexOf(":]", i + 2) + 1; i++; } continue; }
    if (c === "(") { flush(); depth++; continue; }
    if (c === ")") { depth = Math.max(0, depth - 1); flush(); continue; }
    if (c === "|") { if (!depth) return ""; flush(); continue; }
    if (c === "*" || c === "?" || c === "{") { if (!depth) cur = cur.slice(0, -1); flush(); if (c === "{") while (i < s.length && s[i] !== "}") i++; continue; }
    if (c === "+" || c === "." || c === "^" || c === "$") { flush(); continue; }
    if (!depth) cur += c;
  }
  flush();
  return best;
}

// Aho-Corasick over many literals: one pass over a text tells which literals occur in it.
export function automaton(words) {
  const next = [new Map()], fail = [0], out = [[]];
  words.forEach((w, id) => {
    let n = 0;
    for (const ch of w) { let m = next[n].get(ch); if (m === undefined) { m = next.length; next.push(new Map()); fail.push(0); out.push([]); next[n].set(ch, m); } n = m; }
    out[n].push(id);
  });
  const q = [];
  for (const m of next[0].values()) q.push(m);
  while (q.length) {
    const n = q.shift();
    for (const [ch, m] of next[n]) {
      q.push(m);
      let f = fail[n];
      while (f && !next[f].has(ch)) f = fail[f];
      fail[m] = next[f].get(ch) ?? 0;
      if (fail[m] === m) fail[m] = 0;
      out[m] = out[m].concat(out[fail[m]]);
    }
  }
  return function find(text) {
    const hit = new Set();
    let n = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      while (n && !next[n].has(ch)) n = fail[n];
      n = next[n].get(ch) ?? 0;
      for (const id of out[n]) hit.add(id);
    }
    return hit;
  };
}
