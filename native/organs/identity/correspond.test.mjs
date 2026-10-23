import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, Q, graphOf, matchPair, matchPairDMD, collapseLabels } from './correspond.mjs';

// a seeded random labelled graph: n nodes, m edges, 4 labels
function randomGraph(n, m, seed) {
  const r = rng(seed); const labs = ['nsubj', 'obj', 'nmod', 'amod']; const E = new Map(labs.map((l) => [l, new Map()]));
  for (let i = 0; i < m; i++) { const h = Math.floor(r() * n), d = Math.floor(r() * n); if (h === d) continue; const lab = labs[Math.floor(r() * labs.length)]; const k = h * 1e6 + d; E.get(lab).set(k, (E.get(lab).get(k) || 0) + 1 + Math.floor(r() * 3)); }
  const edges = new Map([...E].map(([lab, mm]) => [lab, [...mm].map(([k, w]) => [Math.floor(k / 1e6), k % 1e6, w])]));
  const freq = Array.from({ length: n }, () => 1 + Math.floor(r() * 20));
  return { keys: Array.from({ length: n }, (_, i) => 'n' + i), freq, tokens: freq.reduce((a, b) => a + b, 0), n, edges };
}
function permute(g, seed) { // an identical graph with the nodes relabelled; pi[a] is the truth
  const r = rng(seed); const pi = Array.from({ length: g.n }, (_, i) => i); for (let i = g.n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pi[i], pi[j]] = [pi[j], pi[i]]; }
  const freq = new Array(g.n), keys = new Array(g.n); for (let i = 0; i < g.n; i++) { freq[pi[i]] = g.freq[i]; keys[pi[i]] = g.keys[i]; }
  return { gB: { ...g, keys, freq, edges: new Map([...g.edges].map(([lab, es]) => [lab, es.map(([h, d, w]) => [pi[h], pi[d], w])])) }, pi };
}
const correct = (m, pi) => m.confirmed.filter(([a, b]) => pi[a] === b).length;

test('graphOf drops punctuation, root and punctuation edges; counts lemma tokens', () => {
  const g = graphOf([[['a|NOUN', 'NOUN', 2, 'nsubj'], ['b|VERB', 'VERB', 0, 'root'], [',|PUNCT', 'PUNCT', 2, 'punct'], ['c|NOUN', 'NOUN', 2, 'obj']]]);
  assert.deepEqual(g.keys, ['a|NOUN', 'b|VERB', 'c|NOUN']); assert.equal(g.tokens, 3);
  assert.deepEqual([...g.edges.keys()].sort(), ['nsubj', 'obj']);
});

test('a planted identical graph: what it admits is the true correspondence (positive control)', () => {
  const g = randomGraph(60, 220, 5); const { gB, pi } = permute(g, 9);
  const m = matchPair(g, gB, Q.seed);
  assert.ok(m.confirmed.length >= 10, `admitted ${m.confirmed.length}`);
  assert.ok(correct(m, pi) / m.confirmed.length >= 0.9, 'precision');
});

test('collapsing the labels never helps (random irregular graph: it costs some)', () => {
  const g = randomGraph(60, 220, 5); const { gB, pi } = permute(g, 9);
  const labelled = correct(matchPair(g, gB, Q.seed), pi), collapsed = correct(matchPair(collapseLabels(g), collapseLabels(gB), Q.seed), pi);
  assert.ok(collapsed <= labelled, `labelled ${labelled}, collapsed ${collapsed}`);
});

// interchangeable leaves: every head has three leaves with the same frequency and one neighbour each; only the relation label tells them apart
function leafGraph(H, seed) {
  const r = rng(seed), n = H + 3 * H, E = new Map(['nmod', 'det', 'amod', 'case'].map((l) => [l, []]));
  for (let i = 0; i < 2 * H; i++) { const a = Math.floor(r() * H), b = Math.floor(r() * H); if (a !== b) E.get('nmod').push([a, b, 1 + Math.floor(r() * 3)]); }
  for (let h = 0; h < H; h++) ['det', 'amod', 'case'].forEach((lab, j) => E.get(lab).push([h, H + 3 * h + j, 1]));
  const freq = Array.from({ length: n }, (_, i) => (i < H ? 5 + Math.floor(r() * 30) : 5));
  return { keys: Array.from({ length: n }, (_, i) => 'n' + i), freq, tokens: freq.reduce((a, b) => a + b, 0), n, edges: E, H };
}
test('where nodes are interchangeable without labels, the labels are what separates them', () => {
  const g = leafGraph(24, 3); const { gB, pi } = permute(g, 8);
  const leaves = (m) => m.confirmed.filter(([a, b]) => a >= g.H && pi[a] === b).length;
  const labelled = leaves(matchPair(g, gB, Q.seed)), collapsed = leaves(matchPair(collapseLabels(g), collapseLabels(gB), Q.seed));
  assert.ok(labelled >= 15, `labelled leaves ${labelled}`); assert.ok(collapsed * 3 <= labelled, `collapsed leaves ${collapsed}`);
});

test('two unrelated graphs: almost nothing is admitted (the null is not beaten by chance)', () => {
  const a = randomGraph(60, 220, 5), b = randomGraph(60, 220, 6);
  const m = matchPair(a, b, Q.seed);
  assert.ok(m.confirmed.length <= 0.15 * 60, `admitted ${m.confirmed.length}`);
});

test('the same inputs and seed give the same admitted pairs', () => {
  const g = randomGraph(40, 140, 3); const { gB } = permute(g, 4);
  const x = matchPair(g, gB, 11), y = matchPair(g, gB, 11);
  assert.deepEqual(x.confirmed, y.confirmed); assert.equal(x.tStar, y.tStar);
});

test('matchPairDMD: depth is the shallowest step whose admitted set equals the converged set', () => {
  const g = randomGraph(40, 140, 3); const { gB, pi } = permute(g, 4);
  const m = matchPairDMD(g, gB, 11);
  assert.equal(m.converged, true); assert.equal(m.gap, null);
  assert.equal(m.keys[m.depth], m.keys[m.steps]);                       // the whole conclusion
  for (let t = 0; t < m.depth; t++) assert.notEqual(m.keys[t], m.keys[m.steps]);   // nothing shallower agrees
  assert.ok(m.confirmed.filter(([a, b]) => pi[a] === b).length / Math.max(1, m.confirmed.length) >= 0.9);
});

test('matchPairDMD: a step budget that is too small is a typed gap, never a silent cut', () => {
  const g = randomGraph(40, 140, 3); const { gB } = permute(g, 4);
  const m = matchPairDMD(g, gB, 11, { maxSteps: 2 });
  assert.equal(m.converged, false); assert.equal(m.gap, 'reach_exceeds_steps'); assert.equal(m.depth, null);
});

test("matchPairDMD ceiling: 'row' is the default and changes nothing; 'global' (signal.js's family-wise ceiling) admits no more and is as precise", () => {
  const g = randomGraph(30, 100, 3); const { gB, pi } = permute(g, 4);
  const dflt = matchPairDMD(g, gB, 11), row = matchPairDMD(g, gB, 11, { ceiling: 'row' }), glob = matchPairDMD(g, gB, 11, { ceiling: 'global' });
  assert.deepEqual(dflt.confirmed, row.confirmed); assert.equal(dflt.ceiling, 'row'); assert.equal(glob.ceiling, 'global');
  assert.ok(glob.confirmed.length <= row.confirmed.length, `${glob.confirmed.length} vs ${row.confirmed.length}`);
  if (glob.confirmed.length) assert.ok(glob.confirmed.filter(([a, b]) => pi[a] === b).length / glob.confirmed.length >= 0.9);
});
