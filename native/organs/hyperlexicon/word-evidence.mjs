// word-evidence.mjs — the evidence that two words fold alike, with its null, computed on demand (2026-11-15).
// Janus's geometry, counts only: how many nodes two words' channel folds share, and the same count against null
// words drawn from the second word's ball-size bucket. No bound is applied here and nothing says "same word";
// the asker's declared bound decides what a count means.
//
// BUILT FOR THE BACKWARD FOLD: nothing is computed until a pair is asked for. An asked pair is cached by its
// address (the two words, ordered), so a second ask is a lookup. The null words of a bucket are drawn once, and
// a word's null counts against a bucket are computed once and shared by every pair that needs them.
//
//   makeEvidence(fold, { pool, seed, nulls, ratio }) -> { evidence(a, b), stats() }
//   fold   a makeFold() of channel-fold.mjs          pool   the words nulls are drawn from (the caller's, seeded order)
//   ratio  bucket width: sizes s and t share a bucket when floor(log s / log ratio) is equal (default 1.25)
//
// A record also carries `nullCounts` (added 2026-11-15, additive): the null's shared counts themselves, sorted
// ascending, the very list `null.n`, `null.mean` and `null.p95` are computed from ([] when the record is empty).
// It lets a reader apply its own declared quantile to the null without recomputing it. No other field changed.

export const WORD_EVIDENCE_SCHEMA = 'WordEvidence@1';

export function rng(seed) { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } let a = h >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeEvidence(fold, { pool = [], seed = 'word-evidence', nulls = 50, ratio = 1.25, radius = 1 } = {}) {
  const size = (w) => fold.ball(w, radius).nodes.size;
  const bucketOf = (s) => (s > 0 ? Math.floor(Math.log(s) / Math.log(ratio)) : null);
  const counts = { asked: 0, computed: 0, nullCounts: 0, bucketsDrawn: 0 };
  // the pool in one seeded order, bucketed lazily on first use (one ball per pool word, once)
  let byBucket = null;
  const buckets = () => {
    if (byBucket) return byBucket;
    const r = rng(seed), order = [...pool];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    byBucket = new Map();
    for (const w of order) { const b = bucketOf(size(w)); if (b === null) continue; if (!byBucket.has(b)) byBucket.set(b, []); byBucket.get(b).push(w); }
    return byBucket;
  };
  const drawn = new Map();
  /** the null words of a bucket: the first `nulls` + 2 of its seeded order, widened to neighbouring buckets when it is short */
  const nullWordsOf = (b) => {
    if (drawn.has(b)) return drawn.get(b);
    const B = buckets(), out = [...(B.get(b) ?? [])].slice(0, nulls + 2);
    for (let d = 1; out.length < nulls + 2 && d <= 3; d++) for (const nb of [b - d, b + d]) for (const w of B.get(nb) ?? []) { if (out.length >= nulls + 2) break; out.push(w); }
    drawn.set(b, out); counts.bucketsDrawn += 1;
    return out;
  };
  const nullCache = new Map();
  /** shared counts of word a against a bucket's null words, computed once per (a, bucket) */
  const nullCountsOf = (a, b) => {
    const k = `${a}\u0000${b}`;
    if (nullCache.has(k)) return nullCache.get(k);
    const rows = nullWordsOf(b).map((w) => [w, fold.shared(a, w, radius)]);
    counts.nullCounts += rows.length;
    nullCache.set(k, rows);
    return rows;
  };
  const cache = new Map();
  /** evidence(a, b) -> WordEvidence@1. Ordered (a, b): the null is a against b's bucket. Cached by that address. */
  function evidence(a, b) {
    counts.asked += 1;
    const k = `${a}\u0000${b}`;
    if (cache.has(k)) return cache.get(k);
    counts.computed += 1;
    const sa = size(a), sb = size(b);
    let ev;
    if (sa === 0 || sb === 0) ev = { schema: WORD_EVIDENCE_SCHEMA, a, b, radius, shared: 0, sizes: [sa, sb], empty: true, null: { n: 0, mean: null, p95: null }, nullCounts: [] };
    else {
      const xs = nullCountsOf(a, bucketOf(sb)).filter(([w]) => w !== a && w !== b).slice(0, nulls).map(([, n]) => n).sort((x, y) => x - y);
      const p95 = xs.length ? xs[Math.min(xs.length - 1, Math.ceil(0.95 * xs.length) - 1)] : null;
      ev = { schema: WORD_EVIDENCE_SCHEMA, a, b, radius, shared: fold.shared(a, b, radius), sizes: [sa, sb], empty: false, null: { n: xs.length, mean: xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null, p95 }, nullCounts: [...xs] };
    }
    cache.set(k, ev);
    return ev;
  }
  return { evidence, stats: () => ({ ...counts, distinct: cache.size }) };
}
