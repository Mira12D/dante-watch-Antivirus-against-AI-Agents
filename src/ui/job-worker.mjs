// Worker thread entry: set the target, prove the channel, run the requested checks or commands.
import { parentPort, workerData } from "node:worker_threads";
import { configureTarget, probe, run } from "../core/sh.mjs";
import { setLang } from "../i18n.mjs";
import { activeBattery, runCheck } from "../checks/battery.mjs";

const { task, target, lang } = workerData;
setLang(lang);
configureTarget(target);
const ch = probe();
if (!ch.reached) parentPort.postMessage({ reached: false, line: ch.line, code: ch.code });
else if (task.kind === "checks") {
  const { battery, deep } = activeBattery();
  const by = new Map([...battery, ...deep].map((c) => [c.id, c]));
  parentPort.postMessage({ reached: true, results: task.ids.map((id) => (by.has(id) ? runCheck(by.get(id)) : null)) });
} else {
  parentPort.postMessage({ reached: true, outs: task.scripts.map((s) => { const r = run(s, { timeout: task.timeout || 15000 }); return { out: r.out, err: r.err, ok: r.ok, ran: r.ran }; }) });
}
