// tree-walk.mjs — two texts compared backward from the question (2026-11-15). Pure: trees in, a correspondence out.
//
// The forward way compares everything with everything and then judges. This walks the other way (pharos-lazy A4,
// "fold backwards, and not all the way"): start at the top of each text, pair what corresponds, descend only into
// what was paired, and in stop mode end at the first difference nothing covers, because after that no further
// reading can make the two texts the same.
//
// Janus's geometry: which node corresponds to which, what is left over on each side, and where the walk stopped.
// It issues no verdict. The bound that says whether a paired word pair is COVERED belongs to the question and is
// passed in (`covered`); this organ applies it mechanically and records what it applied it to.
//
//   treeOf(parses)                    the reader's dependency rows -> one tree (punctuation dropped, sentences under an empty root)
//   walk(A, B, { evidence, covered, stop }) -> Correspondence@1
//   evidence(x, y)  word evidence for two different lemmas (word-evidence.mjs), asked only for pairs the walk reaches
//
// Which words carry evidence, and which leftovers matter, is read from the reader's own tags (part of speech and
// features), never from a word list: negation is the feature the parser marks, not the words "no" or "not".

export const CORRESPONDENCE_SCHEMA = 'Correspondence@1';
const FOLDS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV']);             // parts of speech whose words are folded for evidence
const MATTERS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV', 'PROPN', 'NUM', 'DET']);   // a leftover holding one of these is a difference
const lc = (s) => String(s ?? '').toLowerCase();
const isNeg = (n) => /Neg/.test(String(n.feats ?? ''));
const matters = (n) => MATTERS.has(n.upos) || isNeg(n);
const subtreeMatters = (n) => matters(n) || n.children.some(subtreeMatters);
const sizeOf = (n) => 1 + n.children.reduce((t, c) => t + sizeOf(c), 0);

/** treeOf(parses) -> root node { lemma: null, upos: 'ROOT', rel: 'root', children }. parses: [{ rows: [{ id, lemma, form, upos, feats, head, deprel }] }] */
export function treeOf(parses) {
  const root = { lemma: null, upos: 'ROOT', rel: 'root', feats: '', children: [], at: null };
  for (const [pi, p] of (parses ?? []).entries()) {
    const nodes = new Map();
    for (const r of p.rows ?? []) if (r.upos !== 'PUNCT') nodes.set(r.id, { lemma: lc(r.lemma ?? r.form), form: String(r.form ?? r.lemma ?? ''), pos: [pi, Number(r.start ?? r.id)], upos: r.upos, rel: String(r.deprel ?? '').split(':')[0], feats: r.feats ?? '', children: [], at: `${pi}:${r.id}` });
    for (const r of p.rows ?? []) { const n = nodes.get(r.id); if (!n) continue; (nodes.get(r.head) ?? root).children.push(n); }
  }
  return root;
}

/** spanOf(node) -> the subtree's own words in text order (what a smell is taken of). */
export function spanOf(n) {
  const all = []; (function go(x) { if (x.form) all.push(x); x.children.forEach(go); })(n);
  return all.sort((x, y) => x.pos[0] - y.pos[0] || x.pos[1] - y.pos[1]).map((x) => x.form).join(' ');
}
const ANCHORS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV', 'PROPN', 'NUM']);   // a pair of these, identical or fold-covered, anchors a proposal above it

class Stop extends Error {}

/** walk(A, B, { evidence, covered, stop }) -> Correspondence@1 */
/**
 * Further options (PREREG-4):
 *   smell(spanA, spanB) -> Smell@1 | null   asked only among children left unpaired on both sides whose subtrees matter
 *   admits(smellEvidence) -> boolean        the question's bound on a proposal; a proposal needs it and mutual nearest
 *   opposed(x, y) -> boolean                the store's givers relate the two lemmas as opposites
 * A proposed pair is descended into like any other and STANDS ONLY BY ITS CONSEQUENCES: with no content pair beneath it
 * that is identical or fold-covered it is the hard difference `unanchored`. The proposed heads never anchor themselves.
 */
export function walk(A, B, { evidence, covered = () => true, stop = false, smell = null, admits = () => false, opposed = () => false } = {}) {
  const pairs = [], leftovers = { a: [], b: [] }, differences = [];
  let comparisons = 0, stopped = null, smells = 0;
  const proposals = { made: 0, anchored: 0, unanchored: 0 };
  const differ = (d) => { differences.push(d); if (stop && d.kind !== 'role' && !stopped) { stopped = d; throw new Stop(); } };
  // the score of pairing two nodes: identical lemma beats any evidence; evidence needs both words foldable and a shared count above zero
  const score = (x, y) => {
    comparisons += 1;
    if (x.lemma === y.lemma && x.upos === y.upos) return { rank: 2, n: Infinity, ev: null };
    if (x.lemma === y.lemma) return { rank: 2, n: 1e9, ev: null };
    if (!FOLDS.has(x.upos) || !FOLDS.has(y.upos)) return null;
    const ev = evidence(x.lemma, y.lemma);
    return ev && ev.shared > 0 ? { rank: 1, n: ev.shared, ev } : null;
  };
  const better = (s, t, relS, relT) => (s.rank !== t.rank ? s.rank > t.rank : s.n !== t.n ? s.n > t.n : relS && !relT);
  function pairChildren(a, b) {
    const S = a.children.map((x) => b.children.map((y) => score(x, y)));
    const bestB = a.children.map((x, i) => { let k = -1; for (let j = 0; j < b.children.length; j++) { const s = S[i][j]; if (s && (k < 0 || better(s, S[i][k], x.rel === b.children[j].rel, x.rel === b.children[k].rel))) k = j; } return k; });
    const bestA = b.children.map((y, j) => { let k = -1; for (let i = 0; i < a.children.length; i++) { const s = S[i][j]; if (s && (k < 0 || better(s, S[k][j], y.rel === a.children[i].rel, y.rel === a.children[k].rel))) k = i; } return k; });
    const matched = [], usedB = new Set();
    a.children.forEach((x, i) => { const j = bestB[i]; if (j >= 0 && bestA[j] === i) { matched.push([x, b.children[j], S[i][j]]); usedB.add(j); } });
    const usedA = new Set(matched.map(([x]) => x));
    let leftA = a.children.filter((x) => !usedA.has(x)), leftB = b.children.filter((_, j) => !usedB.has(j));
    // THE SMELL PROPOSES, only among what identity and the fold left unpaired on both sides and only for subtrees that matter
    if (smell && leftA.length && leftB.length) {
      const ca = leftA.filter(subtreeMatters), cb = leftB.filter(subtreeMatters);
      const N = ca.map((x) => cb.map((y) => { smells += 1; const e = smell(spanOf(x), spanOf(y)); return e && admits(e) === true ? e : null; }));
      const nb = ca.map((_, i) => { let k = -1; for (let j = 0; j < cb.length; j++) if (N[i][j] && (k < 0 || N[i][j].cos > N[i][k].cos)) k = j; return k; });
      const na = cb.map((_, j) => { let k = -1; for (let i = 0; i < ca.length; i++) if (N[i][j] && (k < 0 || N[i][j].cos > N[k][j].cos)) k = i; return k; });
      ca.forEach((x, i) => { const j = nb[i]; if (j >= 0 && na[j] === i) { matched.push([x, cb[j], { rank: 0, n: N[i][j].cos, ev: null, smell: N[i][j] }]); leftA = leftA.filter((z) => z !== x); leftB = leftB.filter((z) => z !== cb[j]); } });
    }
    return { matched, leftA, leftB };
  }
  // returns true when this pair, or a pair beneath it, is an anchor (a content pair identical or fold-covered)
  function visit(a, b, s, depth = 0) {
    let anchor = false, rec = null;
    if (a.upos !== 'ROOT') {
      rec = { a: a.lemma, b: b.lemma, at: [a.at, b.at], depth, upos: [a.upos, b.upos], how: s.smell ? 'proposed' : s.ev ? 'evidence' : 'identical', relations: [a.rel, b.rel], ...(s.ev ? { evidence: { shared: s.ev.shared, p95: s.ev.null.p95, n: s.ev.null.n, sizes: s.ev.sizes } } : {}), ...(s.smell ? { smell: { cos: s.smell.cos, p95: s.smell.null.p95, n: s.smell.null.n, spans: [s.smell.a, s.smell.b] } } : {}) };
      rec.covered = s.smell ? null : s.ev ? covered(s.ev) === true : true;
      pairs.push(rec);
      if (s.smell) proposals.made += 1;
      if (a.lemma !== b.lemma && opposed(a.lemma, b.lemma)) differ({ kind: 'opposed', a: a.lemma, b: b.lemma, at: rec.at });
      if (rec.covered === false) differ({ kind: 'uncovered', a: a.lemma, b: b.lemma, at: rec.at });
      if (a.rel !== b.rel) differ({ kind: 'role', a: a.lemma, b: b.lemma, relations: [a.rel, b.rel], at: rec.at });
      if (rec.covered === true && ANCHORS.has(a.upos) && ANCHORS.has(b.upos)) anchor = true;
    }
    const { matched, leftA, leftB } = pairChildren(a, b);
    for (const [side, left] of [['a', leftA], ['b', leftB]]) for (const n of left) {
      const m = subtreeMatters(n);
      leftovers[side].push({ lemma: n.lemma, upos: n.upos, rel: n.rel, at: n.at, size: sizeOf(n), matters: m });
      if (m) differ({ kind: 'leftover', side, lemma: n.lemma, rel: n.rel, at: n.at });
    }
    let below = false;
    for (const [x, y, sc] of matched) if (visit(x, y, sc, depth + 1)) below = true;
    if (rec && s.smell) {
      rec.covered = below;                                   // a proposal is covered only by what follows from it
      if (below) proposals.anchored += 1; else { proposals.unanchored += 1; differ({ kind: 'unanchored', a: a.lemma, b: b.lemma, at: rec.at }); }
    }
    return anchor || below;
  }
  try { visit(A, B, { ev: null }); } catch (e) { if (!(e instanceof Stop)) throw e; }
  const hard = differences.filter((d) => d.kind !== 'role').length, role = differences.length - hard;
  return { schema: CORRESPONDENCE_SCHEMA, mode: stop ? 'stop' : 'full', pairs, leftovers, differences, counts: { comparisons, smells, pairs: pairs.length, hard, role }, proposals, stopped };
}
