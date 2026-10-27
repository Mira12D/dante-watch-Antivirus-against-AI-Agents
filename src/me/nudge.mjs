// Offers a look at the public pack catalog: three days after the first meeting, then when knowledge is
// 30 days old (at most weekly), or on `kaufen`. One curl, no token, nothing about the user is sent.
// The shop page is opened only after a yes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homeDir } from "./home.mjs";
import { confirm } from "./onboard.mjs";
import { BUY_URL } from "../pack/install.mjs";
import { mkdirOwned } from "../core/perm.mjs";

export const NUDGE_DAYS = 30;       // knowledge this old: time to look at the catalog
export const FIRST_DAYS = 3;        // three days after the first meeting he looks once, whatever the age of his knowledge
export const SNOOZE_DAYS = 7;       // after asking he stays quiet this long, yes or no
export const EXPIRED_SNOOZE_DAYS = 1;   // a pack of the person has run out: he asks again the next day
export const CATALOG_URL = BUY_URL + "catalog";
export const curlShown = () => `curl -sS --max-time 15 ${CATALOG_URL}`;

const days = (from, to) => Math.floor((Date.parse(to) - Date.parse(from)) / 864e5);
const stateFile = () => join(homeDir(), "nudge");
export const readAsked = () => { try { return readFileSync(stateFile(), "utf8").trim(); } catch { return ""; } };
export const writeAsked = (day) => { mkdirOwned(dirname(stateFile())); writeFileSync(stateFile(), day + "\n", { mode: 0o600 }); };

/** A pack of the person has run out: he says so and offers the shop page, at most once a day. */
export const expiredDue = (lastAsked, today) => !lastAsked || days(lastAsked, today) >= EXPIRED_SNOOZE_DAYS;

/** Time to ask? knowledgeDays = how old his knowledge is, lastAsked = the day he last asked ("" = never). */
export function due({ knowledgeDays, lastAsked, today, created }) {
  if (created && !lastAsked && days(created, today) >= FIRST_DAYS) return true;
  return knowledgeDays >= NUDGE_DAYS && (!lastAsked || days(lastAsked, today) >= SNOOZE_DAYS);
}

/** The packs of the catalog the person does not have, newest first. */
export const newPacks = (catalog, have) => ((catalog && catalog.packs) || []).filter((p) => !have.includes(p.serial)).sort((a, b) => b.serial - a.serial);

// How to open a page in the person's browser on this system; null where there is no way to.
// The same as program + arguments, run without a shell. Windows: explorer.exe opens the address in the default browser.
export const openArgv = (url, platform = process.platform) => {
  const u = String(url);
  if (!/^https:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/.test(u)) return null;   // only a plain https address is ever handed on
  return platform === "darwin" ? ["open", u] : platform === "win32" ? ["explorer.exe", u] : platform === "linux" ? ["xdg-open", u] : null;
};
export const openCommand = (url, platform = process.platform) => {
  const q = "'" + String(url).replace(/'/g, "'\\''") + "'";
  return platform === "darwin" ? `open ${q}` : platform === "linux" ? `xdg-open ${q} >/dev/null 2>&1` : null;
};

// io: mt, say, ask, decide, dim, today, lang, fetchCatalog() -> { ok, packs }, installedSerials(), openPage(url) -> { ok }, knowledgeDays()
export async function nudgeFlow(io, { force = false } = {}) {
  const M = () => io.mt();
  writeAsked(io.today());          // he asks once, whatever the answer
  if (!force) io.say("  " + (io.knowledgeDays() >= NUDGE_DAYS ? M().nudgeHead(io.knowledgeDays()) : M().nudgeFirst));
  io.say("  " + io.dim("→ " + curlShown()));
  if (!(await confirm(io, M().askCheck))) { io.say("  " + M().declined2); return false; }
  const cat = await io.fetchCatalog();
  if (!cat.ok) { io.say("  " + M().catalogFail); return false; }
  const fresh = newPacks(cat, io.installedSerials());
  if (!fresh.length) { io.say("  " + M().nudgeNothing); return false; }
  io.say("  " + M().nudgeNew(fresh.slice(0, 4).map((p) => M().packItem(p, io.lang())).join(" · ") + (fresh.length > 4 ? " …" : "")));
  if (!(await confirm(io, M().askOpen))) return false;
  const r = await io.openPage(BUY_URL);
  io.say("  " + (r.ok ? M().opened : M().noOpener(BUY_URL)));
  return r.ok;
}
