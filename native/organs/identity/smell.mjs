// smell.mjs — the semantic smell: nearness of two spans by an embedding, with its null (2026-11-15).
// A smell PROPOSES and has no authority. An embedding puts opposites as near as synonyms and is blind to
// negation and to who did what; so nothing here says two spans mean the same, and no caller may treat a
// nearness as a licence. The walk tests a proposal by what follows from it (tree-walk.mjs).
//
// Pure and synchronous: it holds vectors it was GIVEN and never calls a model. A span with no vector raises
// NeedVectors naming exactly the texts it lacks, so the caller embeds those and asks again: nothing is
// embedded that the walk did not reach. The model is the caller's, and is a declared part of the standpoint.
//
//   makeSmell({ nullSpans, nulls, seed }) -> { give(text, vector), near(a, b, { exclude }), stats() }
//   nullSpans  [{ text, group }] the spans a nearness is compared against; `exclude` drops a group (the pair's own texts)

export const SMELL_SCHEMA = 'Smell@1';
export class NeedVectors extends Error { constructor(texts) { super(`no vector for ${texts.length} span(s)`); this.texts = texts; } }

export function makeSmell({ nullSpans = [], nulls = 50 } = {}) {
  const vec = new Map(), counts = { asked: 0, computed: 0 }, cache = new Map();
  const cos = (x, y) => { let d = 0, nx = 0, ny = 0; for (let i = 0; i < x.length; i++) { d += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; } return nx && ny ? d / Math.sqrt(nx * ny) : 0; };
  const give = (text, vector) => { vec.set(text, vector); };
  /** near(a, b, { exclude }) -> Smell@1 { cos, null: { n, mean, p95 } }. Throws NeedVectors when a vector is missing. */
  function near(a, b, { exclude = null } = {}) {
    counts.asked += 1;
    const k = `${a}\u0000${b}\u0000${exclude ?? ''}`;
    if (cache.has(k)) return cache.get(k);
    const nullTexts = nullSpans.filter((s) => s.group !== exclude && s.text !== a && s.text !== b).slice(0, nulls).map((s) => s.text);
    const missing = [...new Set([a, b, ...nullTexts])].filter((t) => !vec.has(t));
    if (missing.length) throw new NeedVectors(missing);
    counts.computed += 1;
    const xs = nullTexts.map((t) => cos(vec.get(a), vec.get(t))).sort((x, y) => x - y);
    const out = { schema: SMELL_SCHEMA, a, b, cos: cos(vec.get(a), vec.get(b)), null: { n: xs.length, mean: xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null, p95: xs.length ? xs[Math.min(xs.length - 1, Math.ceil(0.95 * xs.length) - 1)] : null } };
    cache.set(k, out);
    return out;
  }
  return { give, near, has: (t) => vec.has(t), stats: () => ({ ...counts, vectors: vec.size }) };
}
