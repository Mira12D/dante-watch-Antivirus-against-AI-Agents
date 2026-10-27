// Knowledge cards for the "ways" an attacker could go (ports, mail, persistence, stale files, accounts).
// Data lives in ../bib/ways.json. Same card shape as the know cards (id, aliases, de/en/es with
// title/what/why/normal/redflag), plus os ("mac" | "linux" | "windows" | "all"), fix and source.
// fix = [{ cmd, de, en, es }]: commands as TEXT only, never run from here.
import { readFileSync } from "node:fs";

const CARDS = JSON.parse(readFileSync(new URL("../bib/ways.json", import.meta.url), "utf8"));

export const WAY_IDS = [...new Set(CARDS.map((c) => c.id))];
export const wayCards = () => CARDS;

// The card for a way: the one for this OS first, else the "all" card, else null.
export function wayCard(id, os) {
  return CARDS.find((c) => c.id === id && c.os === os) || CARDS.find((c) => c.id === id && c.os === "all") || null;
}
