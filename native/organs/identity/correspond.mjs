// correspond.mjs — which node of one relational graph corresponds to which node of another, from relations alone.
//
// Ported unchanged in logic from identity-udhr-emergence/run4/structure.mjs (sha256 0932bd…31a, hashed in the EOT log
// identity-udhr-emergence/eot/udhr-identity.eot.json). The experiment copies stay frozen because that log hashes them; this is the
// canonical copy going forward. See CONCEPTS-FROM-PARALLEL-STRUCTURE.md for what it was measured to do and not to do.
//
// An edition (or any text) is a bag of dependency trees: nodes are lemmas, edges are head -> dependent labelled by the universal
// relation, weighted by count. No unit, order, alignment or dictionary is given. Two nodes correspond when the relations they stand
// in correspond (similarity propagation over labelled edges), at the step where the admitted set stops changing (DMD), against a null
// that destroys the relations (per label, dependents shuffled among that label's edges). Nothing here judges a correspondence: it
// returns pairs that survive the null and stand as strict mutual best, with the control's own admission rate beside them.
//
// Measured limits (RESULTS-ABLATION-1.md): on a planted identical graph, recall 0.44 at precision 1.00 with labels, 0.004 with the labels
// collapsed; labels are necessary, and the matcher is accurate and incomplete. On five real editions the control admits 23% as many
// pairs as the real run, so about a fifth of the admitted pairs is the null's own rate.
export const Q = Object.freeze({ T: 20, R: 30, q: 0.99, alpha: 0.15, seed: 20261025, controls: 5 });
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const base = (d) => String(d).split(':')[0];
export function graphOf(sentences) {
  const id = new Map(), keys = [], freq = []; const node = (k) => { let i = id.get(k); if (i === undefined) { i = keys.length; id.set(k, i); keys.push(k); freq.push(0); } return i; };
  const E = new Map(); let tokens = 0;
  for (const s of sentences) {
    const ids = s.map(([k, up]) => (up === 'PUNCT' ? -1 : node(k)));
    s.forEach(([k, up, head, dep], i) => {
      if (ids[i] < 0) return; freq[ids[i]]++; tokens++;
      const lab = base(dep); if (head < 1 || lab === 'punct' || lab === 'root' || ids[head - 1] < 0) return;
      const m = E.get(lab) || E.set(lab, new Map()).get(lab); const kk = ids[head - 1] * 1e6 + ids[i]; m.set(kk, (m.get(kk) || 0) + 1);
    });
  }
  const edges = new Map(); for (const [lab, m] of E) edges.set(lab, [...m].map(([kk, w]) => [Math.floor(kk / 1e6), kk % 1e6, w]));
  return { keys, freq, tokens, edges, n: keys.length };
}
export function rewire(g, r) { // per label, the dependents are shuffled among that label's edges: the relation between a head and what it governs is destroyed; label counts, head and dependent multisets survive
  const edges = new Map();
  for (const [lab, es] of g.edges) { const d = es.map((e) => e[1]); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } edges.set(lab, es.map((e, i) => [e[0], d[i], e[2]])); }
  return { ...g, edges };
}
function prep(g, labels) {
  const per = new Map(); const hist = Array.from({ length: g.n }, () => new Float64Array(2 * labels.length));
  labels.forEach((lab, li) => {
    const es = g.edges.get(lab) || []; const inW = new Float64Array(g.n), outW = new Float64Array(g.n);
    for (const [h, d, w] of es) { inW[d] += w; outW[h] += w; hist[h][li] += w; hist[d][labels.length + li] += w; }
    per.set(lab, { h: es.map((e) => e[0]), d: es.map((e) => e[1]), wd: es.map((e) => e[2] / inW[e[1]]), wh: es.map((e) => e[2] / outW[e[0]]) });
  });
  return { per, hist: hist.map((v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); }) };
}
function initial(gA, gB, PA, PB) { // intrinsic invariants only: which relation labels a lemma stands in, and how common it is
  const nA = gA.n, nB = gB.n, M = new Float64Array(nA * nB); let sum = 0;
  for (let a = 0; a < nA; a++) for (let b = 0; b < nB; b++) { let dot = 0; const x = PA.hist[a], y = PB.hist[b]; for (let k = 0; k < x.length; k++) dot += x[k] * y[k]; const fs = Math.exp(-Math.abs(Math.log(gA.freq[a] / gA.tokens) - Math.log(gB.freq[b] / gB.tokens))); const v = dot * fs; M[a * nB + b] = v; sum += v; }
  const sc = sum > 0 ? (nA * nB) / sum : 1; for (let i = 0; i < M.length; i++) M[i] *= sc; return M;
}
function bests(M, nA, nB) {
  const rb = new Int32Array(nA).fill(-1), rv = new Float64Array(nA), r2 = new Float64Array(nA), cb = new Int32Array(nB).fill(-1), cv = new Float64Array(nB), c2 = new Float64Array(nB);
  for (let a = 0; a < nA; a++) for (let b = 0; b < nB; b++) { const v = M[a * nB + b];
    if (v > rv[a]) { r2[a] = rv[a]; rv[a] = v; rb[a] = b; } else if (v > r2[a]) r2[a] = v;
    if (v > cv[b]) { c2[b] = cv[b]; cv[b] = v; cb[b] = a; } else if (v > c2[b]) c2[b] = v; }
  return { rb, rv, r2, cb, cv, c2 };
}
export function series(gA, gB, labels, T, alpha, { fixedPoint = false } = {}) { // the matrix at every step 0..T, reduced to what the decision needs
  const PA = prep(gA, labels), PB = prep(gB, labels), nA = gA.n, nB = gB.n; const M0 = initial(gA, gB, PA, PB);
  let M = M0.slice(); const out = [bests(M, nA, nB)];
  for (let t = 1; t <= T; t++) {
    const N = new Float64Array(nA * nB);
    for (const lab of labels) { const a = PA.per.get(lab), b = PB.per.get(lab); if (!a.h.length || !b.h.length) continue;
      for (let i = 0; i < a.h.length; i++) { const hA = a.h[i] * nB, dA = a.d[i] * nB, wdA = a.wd[i], whA = a.wh[i];
        for (let j = 0; j < b.h.length; j++) { const hB = b.h[j], dB = b.d[j]; N[dA + dB] += wdA * b.wd[j] * M[hA + hB]; N[hA + hB] += whA * b.wh[j] * M[dA + dB]; } } }
    let sum = 0; for (let i = 0; i < N.length; i++) sum += N[i]; const sc = sum > 0 ? (nA * nB) / sum : 1;
    for (let i = 0; i < N.length; i++) N[i] = (1 - alpha) * N[i] * sc + alpha * M0[i];
    if (fixedPoint) { let mx = 0, dm = 0; for (let i = 0; i < N.length; i++) { if (N[i] > mx) mx = N[i]; const d = Math.abs(N[i] - M[i]); if (d > dm) dm = d; } if (dm <= Math.max(nA, nB) * Number.EPSILON * mx) { M = N; out.push(bests(M, nA, nB)); break; } }
    M = N; out.push(bests(M, nA, nB));
  }
  return out;
}
const quant = (arr, q) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };
export function ceilings(nullSeries, t, nA, nB, skip = -1) { // search-aware: the q-th quantile, over null worlds, of the best score a lemma reaches with any partner
  const rows = new Float64Array(nA), cols = new Float64Array(nB); const use = nullSeries.map((_, i) => i).filter((i) => i !== skip);
  for (let a = 0; a < nA; a++) rows[a] = quant(use.map((i) => nullSeries[i][t].rv[a]), Q.q);
  for (let b = 0; b < nB; b++) cols[b] = quant(use.map((i) => nullSeries[i][t].cv[b]), Q.q);
  return { rows, cols };
}
export function confirmed(s, c, nA) { // strict mutual best, above the null on both sides
  const out = [];
  for (let a = 0; a < nA; a++) { const b = s.rb[a]; if (b < 0 || s.rv[a] <= 0) continue; if (s.cb[b] !== a) continue; if (!(s.rv[a] > s.r2[a]) || !(s.rv[a] > s.c2[b])) continue; if (!(s.rv[a] > c.rows[a]) || !(s.rv[a] > c.cols[b])) continue; out.push([a, b, s.rv[a]]); }
  return out;
}
export function matchPair(gA, gB, seed) {
  const labels = [...new Set([...gA.edges.keys(), ...gB.edges.keys()])].sort(); const r = rng(seed);
  const real = series(gA, gB, labels, Q.T, Q.alpha); const nulls = [];
  for (let k = 0; k < Q.R; k++) nulls.push(series(gA, rewire(gB, r), labels, Q.T, Q.alpha));
  const sets = []; const key = (e) => e.map((x) => x[0] + ',' + x[1]).sort().join(';');
  for (let t = 0; t <= Q.T; t++) sets.push(confirmed(real[t], ceilings(nulls, t, gA.n, gB.n), gA.n));
  let tStar = Q.T, reached = false; for (let t = 1; t <= Q.T; t++) if (key(sets[t]) === key(sets[t - 1])) { tStar = t; reached = true; break; }
  const controls = []; for (let k = 0; k < Q.controls; k++) controls.push(confirmed(nulls[k][tStar], ceilings(nulls, tStar, gA.n, gB.n, k), gA.n).length);
  return { tStar, reached, sizes: sets.map((s) => s.length), confirmed: sets[tStar], controls };
}

// Every label collapsed to one: the ablation that shows what the labels contribute. Direction is kept.
export function collapseLabels(g) {
  const m = new Map();
  for (const es of g.edges.values()) for (const [h, d, w] of es) m.set(h * 1e6 + d, (m.get(h * 1e6 + d) || 0) + w);
  return { ...g, edges: new Map([['dep', [...m].map(([k, w]) => [Math.floor(k / 1e6), k % 1e6, w])]]) };
}


// ---- DMD, the canonical way (khora/native/kernel/activation.js::dmdWindow): the shallowest depth at which the conclusion equals the
// WHOLE conclusion, by exact equality; a typed gap when the whole is not reached. Here the conclusion is the admitted set and the whole is
// the set at the propagation's fixed point (the step at which the scores stop changing above floating-point noise, max(nA,nB)*eps*max),
// so no number of steps, no similarity threshold and no "deepest tried" is chosen. `matchPair` stops at the first step whose set repeats
// the previous one, which can be a transient plateau (Run 4: 9 of 10 pairs settled 13 to 47 steps later, with fewer pairs).
export function matchPairDMD(gA, gB, seed, { maxSteps = 1000 } = {}) {
  const labels = [...new Set([...gA.edges.keys(), ...gB.edges.keys()])].sort(); const r = rng(seed);
  const real = series(gA, gB, labels, maxSteps, Q.alpha, { fixedPoint: true }); const nulls = [];
  for (let k = 0; k < Q.R; k++) nulls.push(series(gA, rewire(gB, r), labels, maxSteps, Q.alpha, { fixedPoint: true }));
  const L = Math.max(real.length, ...nulls.map((x) => x.length)) - 1; const pad = (x) => { const o = x.slice(); while (o.length <= L) o.push(x[x.length - 1]); return o; };
  const R = pad(real), N = nulls.map(pad); const key = (e) => e.map((x) => x[0] + ',' + x[1]).sort().join(';');
  const sets = []; for (let t = 0; t <= L; t++) sets.push(confirmed(R[t], ceilings(N, t, gA.n, gB.n), gA.n));
  const converged = real.length - 1 < maxSteps; const whole = key(sets[L]); let depth = null;
  if (converged) for (let t = 0; t <= L; t++) if (key(sets[t]) === whole) { depth = t; break; }
  const at = depth ?? L; const controls = []; for (let k = 0; k < Q.controls; k++) controls.push(confirmed(N[k][at], ceilings(N, at, gA.n, gB.n, k), gA.n).length);
  return { depth, converged, gap: converged ? null : 'reach_exceeds_steps', steps: L, confirmed: sets[at], controls, sizes: sets.map((x) => x.length), keys: sets.map(key) };
}
