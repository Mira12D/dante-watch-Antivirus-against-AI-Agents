// "He tells what he saw." After the look-around, Dante does not print a list of keys - he says it, in his own
// voice, in the person's language. Every sentence is built ONLY from what was really found (f.system, f.hosts,
// f.projects, f.tools, f.services, f.hostlines); nothing is guessed. A finding that is not there is not told.
// Pure: same findings -> same sentences. No colour, no I/O - onboarding decides how it is printed.
import { lang } from "../i18n.mjs";

const list = (xs, n = 3) => {
  const a = xs.filter(Boolean);
  if (!a.length) return "";
  return a.length <= n ? a.join(", ") : a.slice(0, n).join(", ") + " …";
};
const L = (de, en, es) => ({ de, en, es });
const pick = (o, l = lang()) => o[l] || o.en;

// What the tools he found say about the machine. Only tools that were really there (`command -v`).
const toolTalk = (tools) => {
  const has = (t) => tools.includes(t);
  const out = [];
  if (has("php")) out.push("php");
  if (has("nginx")) out.push("nginx");
  if (has("docker")) out.push("docker");
  if (has("git")) out.push("git");
  if (has("node")) out.push("node");
  if (has("ssh")) out.push("ssh");
  return out;
};

// Which role the text of /etc/hosts suggests: web / db / both. Only from names (web, www, db, sql, cache) - a hint,
// and it is said as a hint ("the names look like …"), never as a fact about what runs there.
export function roleOf(line) {
  const s = String(line || "").toLowerCase();
  const web = /(^|[\s.-])(web|www|nginx|http|frontend|public)([\s.-]|$)/.test(s);
  const db = /(^|[\s.-])(db|sql|mysql|postgres|database|redis|data)([\s.-]|$)/.test(s);
  return web && db ? "webdb" : web ? "web" : db ? "db" : "";
}

/**
 * The story after the look-around.
 * @param f findings of lookAround(): {system,name,hosts,hints,projects,tools,services,hostlines}
 * @returns string[] lines, ready to print
 */
export function narrate(f = {}) {
  out: {}
  const l = lang();
  const out = [];
  const machine = String(f.system || "").trim();
  const mac = /mac|darwin|os x|macos/i.test(machine);
  const isServer = /(ubuntu|debian|alpine|centos|fedora|arch|linux|rhel|server)/i.test(machine) && !mac;

  if (machine) {
    out.push(mac
      ? pick(L(`Erst das Wichtigste: Das hier ist ein Mac${/\(arm64\)|\(x64\)/.test(machine) ? ", " + machine.replace(/^.*\((.*)\)$/, "$1") + "-Chip (" + machine.replace(/\s*\(.*\)$/, "") + ")" : machine}.`, `First the important bit: this is a Mac${/\(arm64\)|\(x64\)/.test(machine) ? ", " + machine.replace(/^.*\((.*)\)$/, "$1") + " chip (" + machine.replace(/\s*\(.*\)$/, "") + ")" : machine}.`, `Lo primero: esto es un Mac${/\(arm64\)|\(x64\)/.test(machine) ? ", chip " + machine.replace(/^.*\((.*)\)$/, "$1") + " (" + machine.replace(/\s*\(.*\)$/, "") + ")" : machine}.`), l)
      : isServer
        ? pick(L(`Das hier ist ein Server: ${machine}.`, `This one is a server: ${machine}.`, `Esto es un servidor: ${machine}.`), l)
        : pick(L(`Hier läuft ${machine}.`, `Here runs ${machine}.`, `Aquí corre ${machine}.`), l));
  }

  // Servers out of the SSH files - the real ones, then the ones he only remembers from history.
  const hosts = Array.isArray(f.hosts) ? f.hosts : [];
  const hints = Array.isArray(f.hints) ? f.hints : [];
  if (hosts.length) {
    out.push(pick(L(
      `Und du hast ${hosts.length === 1 ? "einen Server" : hosts.length + " Server"} in deinen SSH-Dateien: ${list(hosts.map((h) => h.alias))}. Die sind für mich keine Fremden.`,
      `And you have ${hosts.length === 1 ? "one server" : hosts.length + " servers"} in your SSH files: ${list(hosts.map((h) => h.alias))}. Not strangers to me.`,
      `Y tienes ${hosts.length === 1 ? "un servidor" : hosts.length + " servidores"} en tus archivos SSH: ${list(hosts.map((h) => h.alias))}. Para mí no son desconocidos.`), l));
  }
  if (hints.length) {
    out.push(pick(L(
      `${hints.length === 1 ? "Dazu einer" : "Dazu " + hints.length + " Rechner"}, mit denen du schon verbunden warst - die kenne ich nur vom Sehen.`,
      `${hints.length === 1 ? "Plus one machine" : "Plus " + hints.length + " machines"} you have connected to before - I only know them by sight.`,
      `${hints.length === 1 ? "Además una máquina" : "Además " + hints.length + " máquinas"} a las que ya te conectaste - a esas solo las conozco de vista.`), l));
  }

  // What the names of the hosts file suggest (web / db) - said as a hunch.
  const lines = Array.isArray(f.hostlines) ? f.hostlines : [];
  const roles = lines.map((x) => roleOf(x)).filter(Boolean);
  if (roles.includes("web") && roles.includes("db")) out.push(pick(L("… und die Namen in deiner hosts-Datei sehen aus wie web und db - sieht nach einer kleinen Landschaft aus, nicht nach einem einzelnen Kasten.", "… and the names in your hosts file look like web and db - that reads like a small landscape, not a single box.", "… y los nombres de tu archivo hosts parecen web y db - eso suena a un pequeño paisaje, no a una sola caja."), l));

  // What is really installed/running - only names that were found.
  const talk = toolTalk(Array.isArray(f.tools) ? f.tools : []);
  const svc = Array.isArray(f.services) ? f.services.filter(Boolean) : [];
  if (talk.length || svc.length) {
    const bits = [];
    if (svc.length) bits.push(svc.join(", "));
    if (talk.includes("php")) bits.push("php");
    if (talk.includes("nginx")) bits.push("nginx");
    if (talk.includes("docker") && !svc.includes("docker")) bits.push("docker");
    const rest = talk.filter((t) => !["php", "nginx", "docker"].includes(t));
    if (bits.length) out.push(pick(L(
      `Interessant: ${list(bits, 4)} ${bits.length === 1 ? "läuft hier" : "laufen hier"}.${rest.length ? ` Dazu ${list(rest, 3)} - du baust also selbst.` : ""}`,
      `Interesting: ${list(bits, 4)} ${bits.length === 1 ? "runs" : "run"} here.${rest.length ? ` Plus ${list(rest, 3)} - so you build things yourself.` : ""}`,
      `Interesante: ${list(bits, 4)} ${bits.length === 1 ? "corre" : "corren"} aquí.${rest.length ? ` Además ${list(rest, 3)} - así que construyes tú mismo.` : ""}`), l));
  } else if (talk.length) {
    out.push(pick(L(`Werkzeuge, die ich sehe: ${list(talk, 5)}.`, `Tools I can see: ${list(talk, 5)}.`, `Herramientas que veo: ${list(talk, 5)}.`), l));
  }

  const projects = Array.isArray(f.projects) ? f.projects : [];
  if (projects.length) {
    out.push(pick(L(
      `Und ${projects.length === 1 ? "ein Projekt liegt" : projects.length + " Projekte liegen"} herum: ${list(projects, 3)}. Da liegt offenbar deine Arbeit.`,
      `And ${projects.length === 1 ? "one project sits" : projects.length + " projects sit"} here: ${list(projects, 3)}. That is where your work lives.`,
      `Y ${projects.length === 1 ? "un proyecto está" : projects.length + " proyectos están"} aquí: ${list(projects, 3)}. Ahí vive tu trabajo.`), l));
  }

  if (!machine && !hosts.length && !hints.length && !projects.length && !talk.length && !svc.length) {
    out.push(pick(L("Viel war hier nicht zu finden - fast leer. Sag mir, wo ich schauen soll.", "Not much to find here - nearly empty. Tell me where to look.", "Aquí no había mucho - casi vacío. Dime dónde mirar."), l));
  }
  return out;
}

export default { narrate, roleOf };