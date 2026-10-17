import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newStore, admit, assertEdge, groups, nonTransitiveClaims, fissionReport, conceptualReferent } from './referents.mjs';

test('a hash id claims nothing; merges are stored as edges', () => {
  const s = newStore();
  const a = admit(s, 'Sherlock Holmes');
  const b = admit(s, 'Holmes');
  const r = assertEdge(s, { holder: 'study-in-scarlet', lens: 'identity', a, b });
  assert.equal(r.ok, true);
  assert.equal(s.edges.length, 1);
  assert.equal(s.edges[0].degree, 1);
  assert.deepEqual(groups(s, 'identity'), [[a, b]]);
});

test('groups are computed at read time, not rewritten (a fission is undoable)', () => {
  const s = newStore();
  const a = admit(s, 'a'), b = admit(s, 'b'), c = admit(s, 'c');
  assertEdge(s, { holder: 'h', lens: 'L', a, b });
  assert.deepEqual(groups(s, 'L'), [[a, b], [c]]);
  // a fission is just the absence of an edge: c was never collapsed, so it can be undone.
  assert.deepEqual(groups(s, 'L').filter((g) => g.includes(c)), [[c]]);
});

test('finding 3 — a threshold lens is not transitive: its merges are claims, never collapsed', () => {
  const s = newStore();
  const O = admit(s, 'original'), R = admit(s, 'reassembled'), P = admit(s, 'repaired');
  assertEdge(s, { holder: 'shipyard-registry', lens: 'material', a: O, b: R });      // reassembled = original (material)
  assertEdge(s, { holder: 'maintenance-log', lens: 'continuity', a: O, b: P });      // repaired = original (continuity)
  assertEdge(s, { holder: 'blog', lens: 'mostly-planks', a: O, b: R, transitive: false });
  assertEdge(s, { holder: 'blog', lens: 'mostly-planks', a: R, b: P, transitive: false });

  // equality-key lenses are transitive and may be grouped.
  assert.deepEqual(groups(s, 'material'), [[O, R], [P]]);
  assert.deepEqual(groups(s, 'continuity'), [[O, P], [R]]);
  // a threshold lens is NOT collapsed: 3 groups, 2 separate claims.
  assert.equal(groups(s, 'mostly-planks').length, 3);
  assert.equal(nonTransitiveClaims(s, 'mostly-planks').length, 2);
});

test('finding 3 — fissionReport names the flip and the givers, and does not rank', () => {
  const s = newStore();
  const O = admit(s, 'original'), R = admit(s, 'reassembled'), P = admit(s, 'repaired');
  assertEdge(s, { holder: 'shipyard-registry', lens: 'material', a: O, b: R });
  assertEdge(s, { holder: 'maintenance-log', lens: 'continuity', a: O, b: P });
  const rep = fissionReport(s, ['material', 'continuity']);

  // O is "R" under material and "P" under continuity; R and P are never unified.
  assert.equal(rep.flips.length, 2);
  const oR = rep.flips.find((f) => f.mergedUnder === 'material');
  const oP = rep.flips.find((f) => f.mergedUnder === 'continuity');
  assert.ok(oR && oP);
  assert.ok(oR.givers.includes('shipyard-registry'));
  assert.ok(oP.givers.includes('maintenance-log'));
  // the fission (R vs P) is preserved, never ranked into a single "answer".
  assert.ok(!rep.flips.some((f) => (f.a === R && f.b === P) || (f.a === P && f.b === R)));
  assert.equal('rank' in rep, false);
});

test('a conceptual referent derives its id from (lens, members, bound)', () => {
  const s = newStore();
  const a = admit(s, 'a'), b = admit(s, 'b');
  const c1 = conceptualReferent(s, 'lensX', [a, b], { bound: 'hop1' });
  const c2 = conceptualReferent(s, 'lensY', [a, b], { bound: 'hop1' });
  const c3 = conceptualReferent(s, 'lensX', [a, b], { bound: 'hop1' });
  assert.equal(c1.id, c3.id);      // same lens/members/bound → same concept
  assert.notEqual(c1.id, c2.id);   // a different lens is a different concept
});
