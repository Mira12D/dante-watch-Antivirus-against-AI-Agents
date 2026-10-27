// Picks the wording of a rule for the current language. Rules carry German as base text plus
// i18n.en / i18n.es; the pack factory rejects rules without both. Older packs fall back to German.
import { lang } from "../i18n.mjs";

export function loc(rule) {
  const o = (rule.i18n && rule.i18n[lang()]) || {}, m = rule.msg || {};
  return { title: o.title || rule.title, bad: o.bad || m.bad, bad_how: o.bad_how || m.bad_how, ok: o.ok || m.ok, ok_how: o.ok_how || m.ok_how, part: o.part || m.part, part_how: o.part_how || m.part_how };
}
// a pattern's name, in the language of the person
export const patName = (p) => (p.i18n && p.i18n[lang()]) || p.name;
