// Footer tips and the knowledge clock. The clock is plain date arithmetic; past STALE days it says
// the knowledge is old and how to refresh it.

export const BIB_DATE = "2026-10-26"; // bump with every bib update
// The version of the package that is running - shown in the clock, so nobody has to guess.
export { VERSION } from "./version.mjs";
import { VERSION } from "./version.mjs";
export const STALE = 14;              // days until Dante says his knowledge is getting old
// The date the clock counts from: the package's own knowledge, or a pack's issue date once one is active.
let knowledge = BIB_DATE;
export const setKnowledge = (iso) => { const d = String(iso || "").slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > BIB_DATE) knowledge = d; };

// Where the watch tip (the one with the free month) sits in every language's list: the footer opens on it while the watch is off.
export const WATCH_TIP = 10;
export const TIPS = {
  de: [
    "Dante sagt nie „sicher“ ohne echte Zeile.", "Kein Ja, keine Änderung. Nie.",
    "Dante ruft von sich aus nie an. Nur „aktualisier“, „kaufen“ und „wachschutz“ tun es, und erst nach deinem Ja.",
    "Eine Versionsnummer allein entscheidet nie — Distros flicken leise.",
    "Sieht er dein Ziel nicht, sagt er „unbekannt“. Nicht „sicher“.",
    "Sag einfach, was du willst: „prüf meinen server root@host“.",
    "Prüf Dantes Plan gegen eine andere KI. Er will das.", "demo zeigt die ganze Schleife an einem harmlosen Loch.",
    "Update? Sag „update“, dann sehe ich nach, ob es etwas Neueres gibt.", "Frische Regeln als einzelne Packs: tipp „aktualisier“. Alte bleiben erhalten.",
    "Wachschutz: Dante legt Köder aus. Benutzt jemand einen, bekommst du sofort eine Mail. Erster Monat gratis: „wachschutz“.",
    "Köder rufen nur, wenn sie benutzt werden. Dante selbst bleibt stumm.",
  ],
  en: [
    "Dante never says „safe“ without a real line.", "No yes, no change. Ever.",
    "Dante never calls anyone on his own. Only „update“, „buy“ and „watch“ do, and only after your yes.",
    "A version number alone never decides — distros patch quietly.",
    "If he cannot see your target, he says „unknown“. Not „safe“.",
    "Just say what you want: „check my server root@host“.",
    "Check Dante's plan against another AI. He wants you to.", "demo runs the whole loop on a harmless hole.",
    "Update? Say “update” and I check whether there is something newer.", "Fresh rules as single packs: type „update“. Old ones stay.",
    "Watch: Dante lays bait. If someone uses one, you get a mail at once. First month free: „watch“.",
    "Bait only calls when it is used. Dante himself stays silent.",
  ],
  es: [
    "Dante nunca dice „seguro“ sin una línea real.", "Sin sí, no hay cambio. Nunca.",
    "Dante nunca llama por su cuenta. Solo „actualiza“, „comprar“ y „vigilancia“ lo hacen, tras tu sí.",
    "Un número de versión solo nunca decide — las distros parchean en silencio.",
    "Si no ve tu destino, dice „desconocido“. No „seguro“.",
    "Di lo que quieres: „revisa mi servidor root@host“.",
    "Compara el plan de Dante con otra IA. Él quiere que lo hagas.", "demo muestra todo el ciclo en un hueco inofensivo.",
    "¿Actualizar? Di «actualiza» y miro si hay algo más nuevo.", "Reglas frescas en packs sueltos: escribe „actualiza“. Los viejos se quedan.",
    "Vigilancia: Dante pone señuelos. Si alguien usa uno, recibes un correo al instante. Primer mes gratis: „vigilancia“.",
    "Los señuelos solo avisan cuando se usan. Dante en sí se mantiene en silencio.",
  ],
};
export const OLD = {
  de: (d) => `Wissen ${d} Tage alt — sag „update“, dann sehe ich nach (neue Version, frische Regeln)`,
  en: (d) => `Knowledge is ${d} days old — say “update” and I check (new version, fresh rules)`,
  es: (d) => `Conocimiento de hace ${d} días — di «actualiza» y miro (versión nueva, reglas frescas)`,
};

export function age(now = Date.now()) {
  return Math.max(0, Math.floor((now - Date.parse(knowledge + "T00:00:00Z")) / 864e5));
}

// "bib 25.10. · 0d" (example) - the date of the knowledge and how old it is; "bib 20d · !" once it is stale.
export function clockText() {
  const days = age(), v = VERSION ? ` · v${VERSION}` : "";
  return (days > STALE ? `bib ${days}d · !` : `bib ${knowledge.slice(8, 10)}.${knowledge.slice(5, 7)}. · ${days}d`) + v;
}

// The tip for slot i in a language. Once the knowledge is stale, every second tip says so.
export function tipAt(i, lang = "de") {
  const L = TIPS[lang] ? lang : "en", days = age();
  return days > STALE && i % 2 ? OLD[L](days) : TIPS[L][i % TIPS[L].length];
}

// One line for one-shot runs (cron, --json excluded): only when the knowledge is old.
export function staleLine(lang = "de") {
  const days = age();
  return days > STALE ? OLD[TIPS[lang] ? lang : "en"](days) : null;
}
