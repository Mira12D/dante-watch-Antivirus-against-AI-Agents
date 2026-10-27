// First start: introduce, ask before looking around, report what was found, write user.md, and ask
// before setting up a schedule. Every step that touches something waits for a clear yes.
//
// All interaction goes through the `io` object so the dialogue can be tested:
//   mt()  texts in the user's language          say(line)  print
//   ask(q)  raw answer to a yes/no question     askFree(q)  free text
//   decide(a)  -> yes | no | what | unclear     look()  -> findings of the look-around
//   probe(server)  read-only visit              writeUser(u), userPath(), diary(entry)
//   plan(), install(plan), remove(), isArmed()  today(), now(), dim(text)
import { TIMES } from "./schedule.mjs";

// the next time a patrol runs, as { when: "today"|"tomorrow", time }
export function nextRun(now = new Date()) {
  for (const t of TIMES) { const [h, m] = t.split(":").map(Number); const d = new Date(now); d.setHours(h, m, 0, 0); if (d > now) return { when: "today", time: t }; }
  return { when: "tomorrow", time: TIMES[0] };
}

// Ask until it is clear. "what" (what does that do?) gets an explanation and the question again; an answer he
// cannot read is asked once more, then it counts as no - never as yes.
// opts.lenient: for questions that only let Dante LOOK (read-only), a leading yes counts even with more words after it
// ("ja klar, schau nach, aber sag mir dann …"). Anything that changes something stays strict: only a clean yes.
export async function confirm(io, question, explain, opts = {}) {
  let explained = false;
  for (let tries = 0; tries < 3; tries++) {
    const answer = await io.ask(question);
    const c = await io.decide(answer, opts);
    if (c === "other") { if (io.queue) io.queue.push(answer); io.lastOther = true; return false; }   // not an answer: a new request. The question is dropped and the line is handled as the next input.
    if (c === "yes") return true;
    if (c === "no") return false;
    if (c === "what" && explain) { io.say("  " + (explained ? io.mt().shortYesNo : explain)); explained = true; continue; }
    if (tries < 2) io.say("  " + io.mt().retry);
  }
  return false;
}

export async function armFlow(io, user) {
  if (io.isArmed()) {
    // the schedule is there already - user.md must say so too (a second look around builds a fresh user)
    user.patrol = { armed: true, times: TIMES, since: (user.patrol && user.patrol.since) || io.today() };
    io.writeUser(user);
    io.say("  " + io.mt().already);
    return true;
  }
  const aliases = user.servers.filter((s) => s.patrol).map((s) => s.alias);
  const plan = io.plan();
  io.say("  " + io.dim("→ " + (plan.file || (plan.line || "").split("\n")[1] || "")));          // what will be written, in plain sight
  const targets = aliases.length ? io.mt().targetsPlus(aliases.join(", ")) : io.mt().targetsLocal;
  if (!(await confirm(io, io.mt().armAsk({ times: TIMES, targets, kind: plan.kind, servers: aliases.length > 0 }), io.mt().explainArm))) { io.say("  " + io.mt().armDeclined); return false; }
  const r = io.install(plan);
  if (!r.ok) { io.say("  " + io.mt().armFailed(r.why)); return false; }
  user.patrol = { armed: true, times: TIMES, since: io.today() };
  io.writeUser(user); io.diary({ kind: "act", what: "arm" });
  const n = nextRun(io.now());
  io.say("  " + io.mt().armed(io.mt().next[n.when](n.time)));
  await deepArmFlow(io);
  return true;
}

// The weekly deep run: its own question, its own yes, its own entry. Only after the patrol is set (or was).
export async function deepArmFlow(io) {
  if (!io.deepPlan || io.isArmedDeep()) return !!io.deepPlan;
  const plan = io.deepPlan();
  io.say("  " + io.dim("→ " + (plan.file || (plan.line || "").split("\n")[1] || "")));
  if (!(await confirm(io, io.mt().deepAsk(plan.when, plan.kind), io.mt().explainArm))) { io.say("  " + io.mt().deepDeclined); return false; }
  const r = io.installDeep(plan);
  if (!r.ok) { io.say("  " + io.mt().armFailed(r.why)); return false; }
  io.diary({ kind: "act", what: "arm-deep" });
  io.say("  " + io.mt().deepArmed);
  return true;
}

export async function disarmFlow(io, user) {
  if (io.removeDeep && io.isArmedDeep()) { io.removeDeep(); io.diary({ kind: "act", what: "disarm-deep" }); }
  if (!io.isArmed()) { io.say("  " + io.mt().notArmed); return false; }
  io.remove();
  if (user) { user.patrol = { armed: false, times: [], since: "" }; io.writeUser(user); }
  io.diary({ kind: "act", what: "disarm" });
  io.say("  " + io.mt().disarmed);
  return true;
}

// The first meeting asks ONE question (may I look around?). Everything else is said, not asked: what he saw, what he will call the
// person, where the servers are, and how to ask for more. The lab showed what a chain of five questions does: people who wanted an
// answer got stuck in it. Arming, knocking at servers and the deep run stay one word away (`scharf`, `welche server habe ich`).
export async function onboard(io) {
  io.say(io.mt().landed);
  io.lastOther = false;
  if (!(await confirm(io, io.mt().askLook, io.mt().explainLook, { lenient: true }))) { if (!io.lastOther) io.say("  " + io.mt().declined); return { declined: true }; }
  const f = await io.look();
  for (const l of io.mt().sees(f)) io.say("  " + l);
  const name = f.name || "";
  if (name) io.say("  " + io.mt().nameNote(name));

  const servers = f.hosts.map((h) => ({ alias: h.alias, target: h.target, key: h.key, os: "", patrol: false }));
  const user = { name, lang: io.lang(), created: io.today(), updated: io.today(), system: f.system, servers, projects: f.projects, patrol: { armed: false, times: [], since: "" } };
  io.writeUser(user);
  io.diary({ kind: "act", what: "look" });
  io.say("  " + io.mt().noted(io.userPath()));
  io.say("  " + io.mt().nextHint);
  return { user, armed: false };
}
