// Runs checks in a worker thread. They block on ssh (spawnSync), which would freeze the waiting
// screen on the main thread. Data goes in and out as plain objects; the worker loads the same rules and
// packs as the session.
import { Worker } from "node:worker_threads";
import { lang } from "../i18n.mjs";

// task: { kind: "checks", ids } | { kind: "exec", scripts }   target: { host, key } | null
export function job(task, target) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./job-worker.mjs", import.meta.url), { workerData: { task, target, lang: lang() }, execArgv: [] } /* no start options of the parent (a worker must not inherit --input-type & co) */);
    // task.limit (ms): a patrol must never hang for ever on a server that does not answer
    const timer = task.limit ? setTimeout(() => { w.terminate(); reject(new Error("timeout after " + task.limit + " ms")); }, task.limit) : null;
    w.once("message", (m) => { if (timer) clearTimeout(timer); resolve(m); });
    w.once("error", (e) => { if (timer) clearTimeout(timer); reject(e); });
    w.once("exit", (code) => { if (code !== 0) reject(new Error("worker exit " + code)); });
  });
}
