// Second classifier: a small fastText-style net. Words, word pairs and letter triples are hashed into
// buckets, each bucket holds a vector, the line is their weighted mean and one softmax layer gives intent
// probabilities. This lets unseen phrasings land ("mein kumpel meint mein server ist offen").
// Inference runs locally. Training is done offline (bib/train-net.mjs); the weights ship as int8 rows with
// a scale factor in plain JSON.
import { features } from "./router.mjs";

const hash = (s, B) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % B; };

// Line -> bucket ids + weights (weights as in the counting ear: first word strongest, triples weak).
export function encode(text, B) {
  const ids = [], ws = [];
  for (const [f, w] of features(text)) { ids.push(hash(f, B)); ws.push(w); }
  return { ids, ws };
}

function hidden(net, { ids, ws }) {
  const { D, E } = net, h = new Float32Array(D);
  let sum = 0;
  for (let j = 0; j < ids.length; j++) { const o = ids[j] * D, w = ws[j]; sum += w; for (let d = 0; d < D; d++) h[d] += w * E[o + d]; }
  if (sum) for (let d = 0; d < D; d++) h[d] /= sum;
  return h;
}

function softmax(net, h) {
  const { K, D, W, b } = net, z = new Float32Array(K);
  let top = -Infinity;
  for (let k = 0; k < K; k++) { let s = b[k]; for (let d = 0; d < D; d++) s += W[k * D + d] * h[d]; z[k] = s; if (s > top) top = s; }
  let sum = 0;
  for (let k = 0; k < K; k++) { z[k] = Math.exp(z[k] - top); sum += z[k]; }
  for (let k = 0; k < K; k++) z[k] /= sum;
  return z;
}

export function predict(net, text) {
  const p = softmax(net, hidden(net, encode(text, net.B)));
  return net.labels.map((intent, k) => ({ intent, p: p[k] })).sort((a, b) => b.p - a.p);
}

// Deterministic: same bib + same seed -> same net, so every update can be reproduced and compared.
export function trainNet(samples, { B = 1 << 14, D = 24, epochs = 6, lr = 0.25, seed = 7 } = {}) {
  let s = seed >>> 0; const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 1 >>> 0) / 4294967296);
  const labels = [...new Set(samples.map((x) => x.intent))].sort();
  const K = labels.length, idx = Object.fromEntries(labels.map((l, i) => [l, i]));
  const E = new Float32Array(B * D).map(() => (rnd() - 0.5) / D), W = new Float32Array(K * D), b = new Float32Array(K);
  const net = { B, D, K, E, W, b, labels };
  // balance like the counting ear: every intent weighs the same in total
  const count = {}; for (const x of samples) count[x.intent] = (count[x.intent] || 0) + 1;
  const mean = samples.length / K;
  const data = samples.map((x) => ({ enc: encode(x.text, B), y: idx[x.intent], w: mean / count[x.intent] }));
  const order = data.map((_, i) => i);
  const steps = epochs * data.length;
  let t = 0;
  for (let e = 0; e < epochs; e++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const i of order) {
      const { enc, y, w } = data[i];
      const a = lr * (1 - t++ / steps) * Math.min(w, 4);
      const h = hidden(net, enc), p = softmax(net, h);
      const gh = new Float32Array(D);
      for (let k = 0; k < K; k++) {
        const g = (p[k] - (k === y ? 1 : 0)) * a;
        for (let d = 0; d < D; d++) { gh[d] += g * W[k * D + d]; W[k * D + d] -= g * h[d]; }
        b[k] -= g;
      }
      let sum = 0; for (const x of enc.ws) sum += x;
      for (let j = 0; j < enc.ids.length; j++) { const o = enc.ids[j] * D, f = enc.ws[j] / sum; for (let d = 0; d < D; d++) E[o + d] -= f * gh[d]; }
    }
  }
  return net;
}

// int8 per row + one scale per row: small, plain numbers, exact enough for a softmax.
const pack = (arr, rows, cols) => {
  const q = [], sc = [];
  for (let r = 0; r < rows; r++) {
    let m = 0; for (let c = 0; c < cols; c++) m = Math.max(m, Math.abs(arr[r * cols + c]));
    const k = m / 127 || 1; sc.push(+k.toPrecision(5));
    for (let c = 0; c < cols; c++) q.push(Math.round(arr[r * cols + c] / k));
  }
  return { q, sc };
};
const unpack = ({ q, sc }, rows, cols) => { const a = new Float32Array(rows * cols); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) a[r * cols + c] = q[r * cols + c] * sc[r]; return a; };

export function saveNet(net) {
  return { v: 1, B: net.B, D: net.D, K: net.K, labels: net.labels, E: pack(net.E, net.B, net.D), W: pack(net.W, net.K, net.D), b: Array.from(net.b, (x) => +x.toPrecision(5)) };
}
export function loadNet(j) {
  return { B: j.B, D: j.D, K: j.K, labels: j.labels, E: unpack(j.E, j.B, j.D), W: unpack(j.W, j.K, j.D), b: Float32Array.from(j.b) };
}
