// Version of the running Dante (from package.json) and the comparison packs use for needs_client.
import { readFileSync } from "node:fs";
export const VERSION = (() => { try { return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version || ""; } catch { return ""; } })();
// a.b.c as numbers; true when `have` is at least `need`. An unreadable version never counts as enough.
export function atLeast(have, need) {
  const n = (v) => String(v).split(".").map((x) => Number(x));
  const a = n(have), b = n(need);
  if (a.length !== 3 || b.length !== 3 || [...a, ...b].some((x) => !Number.isInteger(x) || x < 0)) return false;
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return true;
}
