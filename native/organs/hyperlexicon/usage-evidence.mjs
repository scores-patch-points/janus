// usage-evidence.mjs — do two words keep the same company? The signature term of the identity formula, on words (2026-11-15).
//
//   profile(x)    the word types found near x's uses (the door's `company` at a declared radius), log(1 + count), unit length
//   signature(x)  profile(x) minus the mean profile of the null words: x's difference from the average of its kind
//   near(a, b)    cos(signature(a), signature(b)), and the same cosine between a and each null word
//
// Janus's geometry, cosines and counts only. No bound is applied and nothing here licenses a pair: use puts opposites
// together as readily as synonyms, so the asker's bound must also consult a giver's opposition, and a usage licence is
// never one alone.
//
// Pure and synchronous: it holds the company it was GIVEN and never asks the store. A word with no company raises
// NeedCompany naming exactly the words it lacks; the caller asks the door for those and comes back.
//
//   makeUsage({ nullWords, nulls }) -> { give(word, companyAnswer), near(a, b), stats() }
//   companyAnswer  the door's answer: { company: [{ surface, n }], usesRead, usesTotal } (or a gap, for an unheard word)

export const USAGE_EVIDENCE_SCHEMA = 'UsageEvidence@1';
export class NeedCompany extends Error { constructor(words) { super(`no company for ${words.length} word(s)`); this.words = words; } }

export function makeUsage({ nullWords = [], nulls = 50 } = {}) {
  const prof = new Map(), read = new Map(), cache = new Map(), counts = { asked: 0, computed: 0 };
  let background = null;
  function give(word, ans) {
    const m = new Map(); let ss = 0;
    for (const c of ans?.company ?? []) { const v = Math.log1p(Number(c.n) || 0); if (v > 0) { m.set(String(c.surface), v); ss += v * v; } }
    const norm = Math.sqrt(ss);
    if (norm) for (const [k, v] of m) m.set(k, v / norm);
    prof.set(word, m); read.set(word, Number(ans?.usesRead ?? 0));
    background = null;
  }
  const bg = () => {
    if (background) return background;
    const ws = nullWords.filter((w) => prof.get(w)?.size), m = new Map();
    for (const w of ws) for (const [k, v] of prof.get(w)) m.set(k, (m.get(k) ?? 0) + v / ws.length);
    return (background = m);
  };
  const sig = (w) => { const p = prof.get(w), b = bg(), s = new Map(); for (const [k, v] of p) s.set(k, v - (b.get(k) ?? 0)); for (const [k, v] of b) if (!p.has(k)) s.set(k, -v); return s; };
  const sigCache = new Map();
  const signature = (w) => { if (!sigCache.has(w)) sigCache.set(w, sig(w)); return sigCache.get(w); };
  const cos = (x, y) => { let d = 0, nx = 0, ny = 0; for (const [k, v] of x) { nx += v * v; const u = y.get(k); if (u !== undefined) d += v * u; } for (const v of y.values()) ny += v * v; return nx && ny ? d / Math.sqrt(nx * ny) : 0; };
  /** near(a, b) -> UsageEvidence@1 { cos, uses: [read a, read b], empty, null: { n, mean, p95 } }. Throws NeedCompany. */
  function near(a, b) {
    counts.asked += 1;
    const k = `${a}\u0000${b}`;
    if (cache.has(k)) return cache.get(k);
    const missing = [...new Set([a, b, ...nullWords])].filter((w) => !prof.has(w));
    if (missing.length) throw new NeedCompany(missing);
    if (!background) sigCache.clear();
    counts.computed += 1;
    const empty = !prof.get(a).size || !prof.get(b).size;
    const ns = nullWords.filter((w) => w !== a && w !== b && prof.get(w).size).slice(0, nulls);
    const xs = empty ? [] : ns.map((w) => cos(signature(a), signature(w))).sort((x, y) => x - y);
    const out = { schema: USAGE_EVIDENCE_SCHEMA, a, b, cos: empty ? 0 : cos(signature(a), signature(b)), uses: [read.get(a), read.get(b)], empty, null: { n: xs.length, mean: xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null, p95: xs.length ? xs[Math.min(xs.length - 1, Math.ceil(0.95 * xs.length) - 1)] : null } };
    cache.set(k, out);
    return out;
  }
  return { give, near, has: (w) => prof.has(w), stats: () => ({ ...counts, words: prof.size }) };
}
