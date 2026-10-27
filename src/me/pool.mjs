// Runs a function over a list with a concurrency limit (DANTE_PARALLEL, default 6). An error counts
// as the result for that item and does not stop the others.
export const PARALLEL = () => Math.max(1, Math.min(32, Number(process.env.DANTE_PARALLEL) || 6));
export async function pool(items, fn, limit = PARALLEL()) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try { out[i] = { ok: true, value: await fn(items[i], i) }; } catch (e) { out[i] = { ok: false, error: String((e && e.message) || e) }; }
    }
  }));
  return out;
}
