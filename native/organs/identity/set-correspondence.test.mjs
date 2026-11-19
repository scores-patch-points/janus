// set-correspondence: the geometry of three or more bodies (CONTRACT H.3, H.6). Hand rows and units; counts only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setCorrespondence } from './set-correspondence.mjs';

// a member from units given as key lists; every row is a content row (NOUN)
function member(text, ...units) {
  const rows = [], us = [];
  units.forEach((keys, u) => { const content = []; for (const k of keys) { content.push(rows.length); rows.push({ key: k, upos: 'NOUN' }); } us.push({ u, content }); });
  return { text, rows, units: us };
}
const A = 'text:aaaaaaaaaaaaaaaa', B = 'text:bbbbbbbbbbbbbbbb', C = 'text:cccccccccccccccc', D = 'text:dddddddddddddddd';
const strip = (r) => r.links.map((l) => `${l.x.text.slice(5, 6)}${l.x.u}-${l.y.text.slice(5, 6)}${l.y.u}`);

test('a ring of three is one component, reported with its two links as they are: never closed, never split', () => {
  // A~B share "cat", B~C share "dog", A and C share nothing (ring species: A ~ B, B ~ C, A !~ C)
  const r = setCorrespondence([member(A, ['cat', 'mat']), member(B, ['cat', 'dog']), member(C, ['dog', 'rug'])], { seed: 'set-links:ring:3' });
  assert.deepEqual(strip(r), ['a0-b0', 'b0-c0']);
  assert.equal(r.components.length, 1);
  assert.deepEqual(r.components[0].texts, [A, B, C]);
  assert.deepEqual(r.counts, { units: 3, linkedUnits: 3, components: 1, singletons: 0, byTexts: { 3: 1 }, multi: 0 });
  for (const k of ['classes', 'same', 'verdict', 'held', 'class']) assert.equal(k in r, false, k);
});

test('components, byTexts, singletons and multi on hand units', () => {
  // A0 {x} - B0 {x, y} - C0 {y, z} - A1 {z}: one component holding two units of A (multi); B1, D0 alone
  const r = setCorrespondence([member(A, ['x'], ['z']), member(B, ['x', 'y'], ['q']), member(C, ['y', 'z']), member(D, ['w'])], { seed: 's' });
  assert.deepEqual(strip(r), ['a0-b0', 'a1-c0', 'b0-c0']);
  assert.deepEqual(r.components.map((c) => c.units.map((x) => `${x.text.slice(5, 6)}${x.u}`)), [['a0', 'a1', 'b0', 'c0'], ['b1'], ['d0']]);
  assert.deepEqual(r.components.map((c) => [c.size, c.texts.length]), [[4, 3], [1, 1], [1, 1]]);
  assert.deepEqual(r.counts, { units: 6, linkedUnits: 4, components: 3, singletons: 2, byTexts: { 1: 2, 3: 1 }, multi: 1 });
  assert.deepEqual(r.links.find((l) => l.x.text === B).shared, 1);
});

test('order of arrival changes nothing: any order of the same members gives the identical correspondence', () => {
  const ms = [member(A, ['cat', 'mat'], ['sun']), member(B, ['cat', 'dog']), member(C, ['dog', 'rug'], ['sun', 'sky']), member(D, ['sky'])];
  const want = setCorrespondence(ms, { seed: 'set-links:s:4' });
  for (const order of [[3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1]]) assert.deepEqual(setCorrespondence(order.map((k) => ms[k]), { seed: 'set-links:s:4' }), want);
  assert.deepEqual(want.members, [A, B, C, D]);
});

test('a newcomer can bridge two earlier components, and the bridge shows only as links, never as a merged class', () => {
  const a = member(A, ['cat']), c = member(C, ['dog']);
  const before = setCorrespondence([a, c], { seed: 's2' });
  assert.equal(before.counts.components, 2);
  const after = setCorrespondence([a, c, member(B, ['cat', 'dog'])], { seed: 's3' });
  // B0 {cat, dog} shares 1 with A0 and 1 with C0; links are best WITHIN each pair of texts, so A-B and B-C each link
  assert.deepEqual(strip(after), ['a0-b0', 'b0-c0']);
  assert.deepEqual(after.counts.byTexts, { 3: 1 });
});

test('the null keeps each member\'s unit sizes, is reproducible from its seed, and has 50 redeals', () => {
  const ms = [member(A, ['a', 'b'], ['c']), member(B, ['a', 'c'], ['b', 'd']), member(C, ['d'], ['a', 'x'])];
  const r1 = setCorrespondence(ms, { seed: 'set-links:n:3' }), r2 = setCorrespondence(ms, { seed: 'set-links:n:3' });
  assert.deepEqual(r1.null, r2.null);
  assert.deepEqual([r1.null.seed, r1.null.redeals, r1.null.links.length, r1.null.byTexts.length], ['set-links:n:3', 50, 50, 50]);
  for (const bt of r1.null.byTexts) assert.equal(Object.entries(bt).reduce((s, [, n]) => s + n, 0) <= 5, true);
});

test('falsifying: a member listed twice, a unit naming a missing row, or no seed is refused', () => {
  assert.throws(() => setCorrespondence([member(A, ['x']), member(A, ['y'])], { seed: 's' }), /twice/);
  assert.throws(() => setCorrespondence([{ text: A, rows: [], units: [{ u: 0, content: [0] }] }], { seed: 's' }), /row 0/);
  assert.throws(() => setCorrespondence([member(A, ['x'])], {}), /seed/);
});
