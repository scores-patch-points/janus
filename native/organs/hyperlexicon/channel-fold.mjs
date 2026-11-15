// channel-fold.mjs — the hyperlexicon folded shell by shell along ONE typed channel (2026-11-14).
// Janus's geometry: balls and their overlaps. Pure over a store handle; no file IO, no model, no word list.
//
//   a word      -> its lemma nodes (a form is taken to its lemma by the store's own form-of rows)
//   radius 1    -> the nodes those link to on the channel (default "link:translation")
//   radius r+1  -> plus the nodes THOSE link to on the same channel
//
// What it returns is a SHAPE: the ball at each radius, how many nodes two balls share, and the same count
// against a null matched on ball size. It never says two words are the same. Where a reading settles, and
// whether a count clears a bound, is a verdict; verdicts are Penelope's. A reading that still moves at the
// last radius is reported as moving, by `readings()`, with no stop chosen here.
//
// The store handle is anything with `answer(ask)` in the shape of bin.mjs: op "names" (surfaces -> written
// rows with kind, node, of) and op "relations" (id -> links [{ kind, to }]).

export const CHANNEL_FOLD_SCHEMA = 'ChannelFold@1';
export const DEFAULT_CHANNEL = 'link:translation';

/** lemmaNodes(H, word, lang) -> node ids. A lemma row gives its node; a form-of row is followed once to its lemma's rows. */
export function lemmaNodes(H, word, lang = 'en') {
  const rowsOf = (w) => H.answer({ op: 'names', surfaces: [w], lang })?.surfaces?.[w]?.written ?? [];
  const out = new Set();
  const rows = rowsOf(word);
  for (const r of rows) if (r.kind === 'lemma') out.add(r.node);
  for (const r of rows) {
    if (r.kind !== 'form-of') continue;
    for (const lemma of r.of ?? []) for (const x of rowsOf(lemma)) if (x.kind === 'lemma') out.add(x.node);
  }
  return [...out];
}

/** makeFold(H, { channel, cap, lang }) -> { ball, shared, readings }. Balls are cached per word for the life of the fold. */
export function makeFold(H, { channel = DEFAULT_CHANNEL, cap = 5000, lang = 'en' } = {}) {
  const linkCache = new Map(), ballCache = new Map();
  const linksOf = (id) => {
    if (linkCache.has(id)) return linkCache.get(id);
    const out = [];
    for (const l of H.answer({ op: 'relations', id })?.links ?? []) if (l.kind === channel) out.push(l.to);
    linkCache.set(id, out);
    return out;
  };
  /** ball(word, radius) -> { nodes: Set, sizes: [size at radius 1..radius], capped, lemmas } */
  function ball(word, radius = 1) {
    const key = `${word}\u0000${radius}`;
    if (ballCache.has(key)) return ballCache.get(key);
    const lemmas = lemmaNodes(H, word, lang);
    const nodes = new Set(), sizes = [];
    let frontier = lemmas, capped = false;
    for (let r = 1; r <= radius; r++) {
      const next = [];
      for (const id of frontier) {
        for (const to of linksOf(id)) {
          if (nodes.has(to)) continue;
          if (nodes.size >= cap) { capped = true; break; }
          nodes.add(to); next.push(to);
        }
        if (capped) break;
      }
      sizes.push(nodes.size);
      frontier = next;
      if (capped) { while (sizes.length < radius) sizes.push(nodes.size); break; }
    }
    const b = { nodes, sizes, capped, lemmas: lemmas.length };
    ballCache.set(key, b);
    return b;
  }
  /** shared(a, b, radius) -> how many nodes the two balls hold in common. */
  function shared(a, b, radius = 1) {
    const A = ball(a, radius).nodes, B = ball(b, radius).nodes;
    const [small, big] = A.size <= B.size ? [A, B] : [B, A];
    let n = 0;
    for (const x of small) if (big.has(x)) n++;
    return n;
  }
  /**
   * readings(a, b, { radii, nullWords }) -> ChannelFold@1: per radius, the shared count, the ball sizes, and
   * the null (shared between a and each null word; its mean and 95th percentile). `above` is the bare
   * comparison shared > p95. `moving` is true when `above` differs between the last two radii.
   * nullWords are chosen by the caller, matched on ball size; this organ does not sample.
   */
  function readings(a, b, { radii = [1, 2], nullWords = [] } = {}) {
    const per = radii.map((radius) => {
      const A = ball(a, radius), B = ball(b, radius);
      const s = shared(a, b, radius);
      const nulls = nullWords.map((w) => shared(a, w, radius)).sort((x, y) => x - y);
      const p95 = nulls.length ? nulls[Math.min(nulls.length - 1, Math.ceil(0.95 * nulls.length) - 1)] : null;
      const mean = nulls.length ? nulls.reduce((t, x) => t + x, 0) / nulls.length : null;
      const empty = A.nodes.size === 0 || B.nodes.size === 0;
      return { radius, shared: s, sizes: [A.nodes.size, B.nodes.size], capped: A.capped || B.capped, empty, null: { n: nulls.length, mean, p95 }, above: p95 === null ? null : (!empty && s > p95) };
    });
    const last = per[per.length - 1], prev = per[per.length - 2];
    return { schema: CHANNEL_FOLD_SCHEMA, channel, a, b, per, moving: prev ? last.above !== prev.above : null };
  }
  return { ball, shared, readings, channel };
}
