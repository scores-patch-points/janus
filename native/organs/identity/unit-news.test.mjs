// unit-news: news each way per clause unit, counts only (CONTRACT B.2, B.3, B.6). Hand rows and hand units; no model,
// no hyperlexicon (a stand-in evidence function records what it is asked).
import test from 'node:test';
import assert from 'node:assert/strict';
import { unitNews, mutualLinks, redeal, linkNull, checkUnits, contentRowsOf } from './unit-news.mjs';
import { rng } from '../hyperlexicon/word-evidence.mjs';

// a text from words; "the", "a", "and", "of" are DET/CCONJ/ADP here only because this fixture says so (the parser's tags
// in real readings); every other word is NOUN. groups: the units as lists of row indexes.
const FUNC = { the: 'DET', a: 'DET', and: 'CCONJ', of: 'ADP' };
function text(words, groups) {
  const rows = words.split(' ').map((w, k) => ({ s: 0, id: k + 1, form: w, lemma: w, upos: FUNC[w] ?? 'NOUN', feats: null, head: 0, deprel: 'dep', key: w.toLowerCase() }));
  const units = groups.map((g, u) => ({ u, say: g.map((i) => rows[i].form).join(' '), content: g.filter((i) => rows[i].upos === 'NOUN') }));
  return { rows, units };
}
const sets = (...xs) => xs.map((x) => new Set(x));
const recorder = () => { const calls = []; return { calls, of: (x, y) => { calls.push(`${x}>${y}`); return { shared: x.length + y.length, empty: false, nulls: [0, 1], n: 2 }; } }; };

test('identical: each content row of the unit with every identical content row of the ground; function words never count', () => {
  const G = text('the cat and the cat sat', [[0, 1, 2], [3, 4, 5]]);
  const N = text('the cat ran', [[0, 1, 2]]);
  const r = unitNews(G, N, recorder().of, { seed: 's' });
  assert.deepEqual(r.units[0].identical, [[1, [1, 4]]]);          // "cat" twice in G; "the" is DET and not listed; "ran" has none
  assert.equal(r.counts.identicalRows, 1);
  assert.equal(r.counts.contentRows, 2);
});

test('byUnit counts DISTINCT shared content keys per ground unit, only where shared > 0', () => {
  const G = text('cat dog cat bird', [[0, 1], [2], [3]]);
  const N = text('cat cat dog fish', [[0, 1, 2, 3]]);
  const r = unitNews(G, N, recorder().of, { seed: 's' });
  assert.deepEqual(r.units[0].byUnit, [[0, 2], [1, 1]]);           // cat+dog with G0 (cat twice in N counts once); cat with G1; nothing with G2
});

test('links are mutual strictly best: a clear match links; a tie does not; a one-sided best does not', () => {
  // clear: N0 {cat} best G0 {cat}; G0's best is N0
  assert.deepEqual(mutualLinks(sets(['cat']), sets(['cat'], ['dog'])), [0]);
  // tie: N0 {cat, dog} shares 1 with G0 {cat} and 1 with G1 {dog}: no strict best, no link
  assert.deepEqual(mutualLinks(sets(['cat', 'dog']), sets(['cat'], ['dog'])), [-1]);
  // one-sided: N0 {cat} best G0 {cat, dog, bird}; but G0 shares 3 with N1 {cat, dog, bird}, so G0's best is N1
  assert.deepEqual(mutualLinks(sets(['cat'], ['cat', 'dog', 'bird']), sets(['cat', 'dog', 'bird'])), [-1, 0]);
  // nothing shared: no link (best needs at least 1)
  assert.deepEqual(mutualLinks(sets(['cat']), sets(['dog'])), [-1]);
  // symmetric: the same links read from the other side
  const n = sets(['a', 'b'], ['c']), g = sets(['c', 'd'], ['a']);
  const ng = mutualLinks(n, g), gn = mutualLinks(g, n);
  ng.forEach((v, k) => { if (v >= 0) assert.equal(gn[v], k); });
});

test('the unit-news link field names the ground unit by its index, or null', () => {
  const G = text('dog barked cat sat', [[0, 1], [2, 3]]);
  const N = text('cat sat dog ran', [[0, 1], [2, 3]]);
  const r = unitNews(G, N, recorder().of, { seed: 's' });
  assert.deepEqual(r.units.map((x) => x.link), [1, 0]);
  assert.equal(r.counts.linked, 2);
});

test('word pairs only between UNMATCHED content rows of the unit and of the ground', () => {
  const G = text('the cat chased mice', [[0, 1, 2, 3]]);
  const N = text('the cat ate fish', [[0, 1, 2, 3]]);
  const ev = recorder();
  const r = unitNews(G, N, ev.of, { seed: 's' });
  // cat is matched both ways and pairs with nothing; "the" is not content; ate/fish x chased/mice
  assert.deepEqual(r.units[0].pairs.map((p) => [p.j, p.i, p.nw, p.gw]), [[2, 2, 'ate', 'chased'], [2, 3, 'ate', 'mice'], [3, 2, 'fish', 'chased'], [3, 3, 'fish', 'mice']]);
  assert.equal(r.counts.wordPairs, 4);
  assert.ok(!ev.calls.some((c) => c.includes('cat') || c.includes('the')));
});

test('falsifying: a key the ground holds in ANY unit is matched, so it never enters a word pair', () => {
  const G = text('cat sat dog ran', [[0, 1], [2, 3]]);
  const N = text('dog sat', [[0, 1]]);
  const r = unitNews(G, N, recorder().of, { seed: 's' });
  assert.deepEqual(r.units[0].pairs, []);   // dog is in G's other unit; it is matched, not a pair
});

test('the evidence table holds each distinct key pair once, asked once in each direction', () => {
  const G = text('mice', [[0]]);
  const N = text('fish and fish', [[0], [2]]);
  const ev = recorder();
  const r = unitNews(G, N, ev.of, { seed: 's' });
  assert.deepEqual(Object.keys(r.evidence), ['fish\u0000mice']);
  assert.deepEqual(ev.calls, ['fish>mice', 'mice>fish']);
  assert.deepEqual(r.evidence['fish\u0000mice'], { ng: { shared: 8, empty: false, nulls: [0, 1], n: 2 }, gn: { shared: 8, empty: false, nulls: [0, 1], n: 2 } });
  assert.equal(r.counts.wordPairs, 2);   // one pair record per unit
});

test('the link null keeps each unit\'s number of content rows, is reproducible from its seed, and has 50 redeals', () => {
  const units = [{ u: 0, content: [0, 1, 2] }, { u: 1, content: [3] }, { u: 2, content: [4, 5] }];
  const d = redeal(units, rng('x'));
  assert.deepEqual(d.map((x) => x.length), [3, 1, 2]);
  assert.deepEqual(d.flat().sort(), [0, 1, 2, 3, 4, 5]);
  const G = text('cat dog bird fish rat ox', [[0, 1, 2], [3], [4, 5]]), N = text('cat fish ox', [[0], [1], [2]]);
  const a = linkNull(G, N, { seed: 'unit-links:abc' }), b = linkNull(G, N, { seed: 'unit-links:abc' });
  assert.deepEqual(a, b);
  assert.equal(a.redeals, 50); assert.equal(a.linked.length, 50);
  assert.equal(a.seed, 'unit-links:abc');
  assert.ok(a.linked.every((n) => Number.isInteger(n) && n >= 0 && n <= 3));
  // falsifying: a null with no seed is refused rather than drawn from an unseeded generator
  assert.throws(() => linkNull(G, N, {}), /seed/);
});

test('falsifying: units naming rows outside the reading are refused, never read', () => {
  assert.match(checkUnits([{ key: 'a' }], [{ u: 0, content: [3] }]), /row 3/);
  assert.equal(checkUnits([{ key: 'a' }], [{ u: 0, content: [0] }]), null);
  assert.throws(() => unitNews({ rows: [], units: [{ u: 0, content: [0] }] }, text('a', [[0]]), recorder().of, { seed: 's' }), /G: unit 0 names row 0/);
});

test('counts only: no bound, quantile, threshold or verdict in what unit-news returns', () => {
  const G = text('cat sat', [[0, 1]]), N = text('dog sat', [[0, 1]]);
  const r = unitNews(G, N, recorder().of, { seed: 's' });
  assert.deepEqual(Object.keys(r), ['units', 'evidence', 'linkNull', 'counts']);
  assert.deepEqual(Object.keys(r.units[0]), ['u', 'say', 'content', 'identical', 'byUnit', 'link', 'pairs']);
  assert.deepEqual(Object.keys(r.counts), ['units', 'contentRows', 'identicalRows', 'linked', 'wordPairs']);
  assert.deepEqual(contentRowsOf(G.units), [0, 1]);
});
