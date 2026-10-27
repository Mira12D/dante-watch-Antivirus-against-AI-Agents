// Turns the output of the level 1 and 2 probes into a short report in the person's language. Everything shown comes from the
// target's own output; the "usual" facts (package manager, firewall, ...) come from the system library and are labelled so.
// A value that was not printed is left out, never filled in.
import { identify, parse } from "./sysid.mjs";

const T = {
  de: {
    system: "System", unknown: "nicht sicher erkannt", machine: "Rechner", usual: (n) => `Üblich bei ${n}`, pkg: "Pakete", init: "Dienste", fw: "Firewall", logs: "Logs",
    cores: (n) => `${n} Kerne`, ram: (t, u) => (u === null ? `${t} MB RAM` : `${t} MB RAM, ${u} % belegt`), disk: (s, u) => `Platte ${s}, ${u} belegt`, up: (t) => `läuft seit ${t}`,
    load: "Last", busy: "Am meisten los", ports: "Offene Ports", failed: "Ausgefallene Dienste", nofail: "keine ausgefallenen Dienste", who: "Angemeldet", none: "niemand",
    rawHint: "Gesagt hat es", calm: "Nichts Auffälliges in dem, was ich lese.",
  },
  en: {
    system: "System", unknown: "not recognised for sure", machine: "Machine", usual: (n) => `Usual for ${n}`, pkg: "Packages", init: "Services", fw: "Firewall", logs: "Logs",
    cores: (n) => `${n} cores`, ram: (t, u) => (u === null ? `${t} MB RAM` : `${t} MB RAM, ${u}% in use`), disk: (s, u) => `disk ${s}, ${u} used`, up: (t) => `up ${t}`,
    load: "Load", busy: "Busiest", ports: "Open ports", failed: "Failed services", nofail: "no failed services", who: "Logged in", none: "nobody",
    rawHint: "It said", calm: "Nothing unusual in what I read.",
  },
  es: {
    system: "Sistema", unknown: "no reconocido con seguridad", machine: "Equipo", usual: (n) => `Habitual en ${n}`, pkg: "Paquetes", init: "Servicios", fw: "Cortafuegos", logs: "Registros",
    cores: (n) => `${n} núcleos`, ram: (t, u) => (u === null ? `${t} MB de RAM` : `${t} MB de RAM, ${u} % en uso`), disk: (s, u) => `disco ${s}, ${u} usado`, up: (t) => `activo desde hace ${t}`,
    load: "Carga", busy: "Lo más activo", ports: "Puertos abiertos", failed: "Servicios caídos", nofail: "ningún servicio caído", who: "Conectados", none: "nadie",
    rawHint: "Dijo", calm: "Nada raro en lo que leo.",
  },
};
const kv = (text, key) => { const m = new RegExp(`^${key}=(?:"([^"]*)"|(.*))$`, "m").exec(text || ""); return m ? (m[1] ?? m[2] ?? "").trim() : ""; };

/** The best one-line name of the system from what the probes printed (the label a person would say). */
export function versionLine(p) {
  if (p.sw_vers) { const n = /ProductName:\s*(.+)/.exec(p.sw_vers), v = /ProductVersion:\s*(.+)/.exec(p.sw_vers); if (n && v) return `${n[1].trim()} ${v[1].trim()}`; }
  const pretty = kv(p.os_release, "PRETTY_NAME"); if (pretty) return pretty;
  if (p.freebsd_version) return "FreeBSD " + p.freebsd_version.split("\n")[0];
  if (p.openwrt_release) return `OpenWrt ${kv(p.openwrt_release, "DISTRIB_RELEASE").replace(/'/g, "")}`.trim();
  if (p.redhat_release) return p.redhat_release.split("\n")[0];
  if (p.esxi) return p.esxi.split("\n")[0];
  return (p.uname || "").split("\n")[0].split(" ").slice(0, 3).join(" ");
}
const upText = (u, lang = "de") => { const m = /\bup\s+(.+?),\s+\d+\s+users?/.exec(u || "") || /\bup\s+(.+?),\s+load/.exec(u || ""); const x = m ? m[1].trim() : ""; return lang === "de" ? x.replace(/\bdays?\b/, "Tage").replace(/\bmins?\b/, "Min.") : lang === "es" ? x.replace(/\bdays?\b/, "días").replace(/\bmins?\b/, "min") : x; };
const loadText = (u) => { const m = /load averages?:\s*([0-9.,\s]+)$/.exec((u || "").trim()); return m ? m[1].trim().replace(/\s+/g, " ") : ""; };

/** parsed: result of parse(). Returns { id, name, lines[] } with at most ~8 plain lines. mode: "info" | "activity". */
export function report(parsedOrText, systems, lang = "de", mode = "info") {
  const parsed = typeof parsedOrText === "string" ? parse(parsedOrText) : parsedOrText, p = parsed.probes, f = parsed.facts, a = parsed.activity, t = T[lang] || T.de;
  const sys = identify(p, systems), label = versionLine(p);
  const lines = [];
  const nm = sys ? sys.name[lang] || sys.name.en : "";
  lines.push(`${t.system}: ` + (sys ? (label && label.toLowerCase().includes(nm.toLowerCase()) ? label : label ? `${nm} (${label})` : nm) : `${t.unknown}${label ? " - " + t.rawHint + ": " + label : ""}`));
  const mach = [];
  if (f.host) mach.push(f.host);
  if (f.cpu) mach.push(f.cpu.trim());
  if (f.cores && /^\d+$/.test(f.cores)) mach.push(t.cores(f.cores));
  const mem = (f.mem || "").trim().split(/\s+/).filter((x) => /^\d+$/.test(x));
  if (mem.length) mach.push(t.ram(mem[0], mem.length > 1 && Number(mem[0]) ? Math.round((Number(mem[1]) / Number(mem[0])) * 100) : null));
  const d = (f.disk || "").trim().split(/\s+/); if (d.length === 2) mach.push(t.disk(d[0], d[1]));
  const up = upText(f.uptime, lang); if (up) mach.push(t.up(up));
  if (mach.length) lines.push(`${t.machine}: ${mach.join(" · ")}`);
  if (sys && sys.facts) {
    const u = [["pkg", t.pkg], ["init", t.init], ["firewall", t.fw], ["logs", t.logs]].filter(([k]) => sys.facts[k]).map(([k, n]) => `${n}: ${sys.facts[k]}`);
    if (u.length) lines.push(`${t.usual(sys.name[lang] || sys.name.en)} - ${u.join(" · ")}`);
  }
  if (mode === "activity") {
    const ld = loadText(f.uptime); if (ld) lines.push(`${t.load}: ${ld}`);
    const top = (a.top || "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (top.length) lines.push(`${t.busy}: ${top.map((s) => { const m = /^([0-9.,]+)\s+(.+)$/.exec(s); return m ? `${m[2]} (${m[1]} %)` : s; }).join(", ")}`);
    if (a.ports) lines.push(`${t.ports}: ${a.ports.trim()}`);
    if (a.failed && a.failed.trim()) lines.push(`${t.failed}: ${a.failed.trim()}`);
    else if ("failed" in a) lines.push(t.nofail.charAt(0).toUpperCase() + t.nofail.slice(1));
    const who = (a.who || "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^(\d+)\s+(.+)$/, (_, n, u) => (n === "1" ? u : `${u} (${n}x)`)));
    lines.push(`${t.who}: ${who.length ? who.join(", ") : t.none}`);
  }
  const first = sys ? sys.identify[0] : null, proof = first && p[first.probe] ? `${first.probe}: ${p[first.probe].split("\n").find((l) => l.trim()) || ""}`.slice(0, 120) : "";
  return { id: sys ? sys.id : null, name: sys ? sys.name[lang] || sys.name.en : null, label, lines, proof };
}
