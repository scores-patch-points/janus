// channel-fold.mjs — the hyperlexicon folded shell by shell along ONE typed channel (2026-11-14).
// Janus's geometry: balls and their overlaps. Pure over a store handle; no file IO, no model, no word list.
//
//   a word      -> its lemma nodes (a word with no lemma row of its own is taken to its lemma by the store's form-of rows)
//   radius 1    -> the nodes those link to on the channel (default "link:translation")
//   radius r+1  -> plus the nodes THOSE link to on the same channel
//
// What it returns is a SHAPE: the ball at each radius, how many nodes two balls share, and the same count
// against a null matched on ball size, as raw counts. It never says two words are the same, and it compares
// nothing: where a reading settles, and whether a count clears a bound, are verdicts, and a verdict that
// leaves this holon is Penelope's. channel-fold-pharos.mjs weaves these counts into the shared log.
//
// The store handle is anything with `answer(ask)` in the shape of bin.mjs: op "names" (surfaces -> written
// rows with kind, node, of) and op "relations" (id -> links [{ kind, to }]).

export const CHANNEL_FOLD_SCHEMA = 'ChannelFold@1';
export const DEFAULT_CHANNEL = 'link:translation';

/** lemmaNodes(H, word, lang) -> node ids. A word that is itself a lemma is read as that lemma and nothing else.
 *  Only a word with NO lemma row of its own is taken to its lemma, once, through the store's form-of rows.
 *  (Found 2026-11-15: "year" is also listed as a dialect form of "hear" and "here"; following those rows for a
 *  word that has its own lemma put their 277 translations into year's ball, which has none of its own.) */
export function lemmaNodes(H, word, lang = 'en') {
  const rowsOf = (w) => H.answer({ op: 'names', surfaces: [w], lang })?.surfaces?.[w]?.written ?? [];
  const out = new Set();
  const rows = rowsOf(word);
  for (const r of rows) if (r.kind === 'lemma') out.add(r.node);
  if (out.size) return [...out];
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
   * the null as COUNTS (shared between a and each null word, sorted; with their mean). Nothing is compared
   * here: which quantile of the null a count must clear, and whether a reading has settled between radii,
   * are a bound and a stop, and a verdict that leaves this holon is Penelope's (ruling 2026-11-15).
   * nullWords are chosen by the caller, matched on ball size; this organ does not sample.
   */
  function readings(a, b, { radii = [1, 2], nullWords = [] } = {}) {
    const per = radii.map((radius) => {
      const A = ball(a, radius), B = ball(b, radius);
      const counts = nullWords.map((w) => shared(a, w, radius)).sort((x, y) => x - y);
      const mean = counts.length ? counts.reduce((t, x) => t + x, 0) / counts.length : null;
      return { radius, shared: shared(a, b, radius), sizes: [A.nodes.size, B.nodes.size], capped: A.capped || B.capped, empty: A.nodes.size === 0 || B.nodes.size === 0, null: { n: counts.length, mean, counts } };
    });
    return { schema: CHANNEL_FOLD_SCHEMA, channel, a, b, per };
  }
  /** related(a, b, rel) -> true when a giver relates a lemma node of one word to a lemma node of the other by `rel` (either direction). */
  const relCache = new Map();
  function related(a, b, rel) {
    const k = `${a}\u0000${b}\u0000${rel}`;
    if (relCache.has(k)) return relCache.get(k);
    const A = lemmaNodes(H, a, lang), B = new Set(lemmaNodes(H, b, lang)), A2 = new Set(A);
    const hit = (from, to) => from.some((id) => (H.answer({ op: 'relations', id })?.relations ?? []).some((r) => r.rel === rel && to.has(r.to)));
    const out = hit(A, B) || hit([...B], A2);
    relCache.set(k, out);
    return out;
  }
  return { ball, shared, readings, related, channel };
}
