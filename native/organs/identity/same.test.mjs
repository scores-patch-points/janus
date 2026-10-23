import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeWorld, same, estimateNull, displacementNull, displacementProfile, groundSpread, forgetGround,
} from './same.mjs';

const lens = { name: 'amount', attrs: ['amount'], giver: 'test' };

test('two distinct-but-identical things are the same under a lens', () => {
  const world = makeWorld(
    [
      { id: 'a', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'b', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'c', kind: 'invoice', attrs: { amount: 300 } },
    ],
    [
      { a: 'a', b: 'c' },
      { a: 'b', b: 'c' },
    ],
  );
  const r = same('a', 'b', world, { lens, foldNull: 0.4, deltaNull: 0 });
  assert.equal(r.verdict, 'same');
  assert.equal(r.formula.Uclose, true);
  assert.equal(r.formula.distinct, true);
  assert.equal(r.formula.aligned, true);
});

test('an alias that disturbs nothing is not a concept (Δ ≤ null → not same)', () => {
  const world = makeWorld(
    [
      { id: 'a', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'b', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'c', kind: 'invoice', attrs: { amount: 100 } },
    ],
    [
      { a: 'a', b: 'c' },
      { a: 'b', b: 'c' },
    ],
  );
  const r = same('a', 'b', world, { lens, foldNull: 0.4, deltaNull: 0 });
  assert.equal(r.verdict, 'different');
  assert.equal(r.formula.distinct, false);
  assert.equal(r.D.a, 0);
});

test('two things that differ are not the same', () => {
  const world = makeWorld(
    [
      { id: 'a', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'b', kind: 'invoice', attrs: { amount: 200 } },
      { id: 'c', kind: 'invoice', attrs: { amount: 300 } },
    ],
    [
      { a: 'a', b: 'c' },
      { a: 'b', b: 'c' },
    ],
  );
  const r = same('a', 'b', world, { lens, foldNull: 0.4, deltaNull: 0 });
  assert.equal(r.verdict, 'different');
  assert.equal(r.formula.Uclose, false);
});

test('no lens ⇒ refused, never false', () => {
  const world = makeWorld([{ id: 'a', kind: 'invoice', attrs: { amount: 100 } }]);
  const r = same('a', 'a', world, {});
  assert.equal(r.verdict, 'refused');
});

test('estimateNull returns a deterministic finite floor', () => {
  const world = makeWorld(
    [
      { id: 'a', kind: 'invoice', attrs: { amount: 1 } },
      { id: 'b', kind: 'invoice', attrs: { amount: 2 } },
    ],
    [{ a: 'a', b: 'b' }],
  );
  const n = estimateNull(world, lens, { seed: 7 });
  assert.equal(typeof n, 'number');
  assert.ok(n >= 0 && n <= 1);
});

// The Δ null must come from the displacement distribution, not the fold changes
// (hyperlexicon real-world test, 2026-10-22: estimateNull's floor exceeded every
// displacement on a dense ground, so `distinct` was never satisfied and Same
// degenerated to "everything different").
test('displacementNull draws the Δ floor from the displacement distribution', () => {
  const world = makeWorld(
    [
      { id: 'a', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'b', kind: 'invoice', attrs: { amount: 300 } },
      { id: 'c', kind: 'invoice', attrs: { amount: 700 } },
    ],
    [{ a: 'a', b: 'c' }, { a: 'b', b: 'c' }],
  );
  const dn = displacementNull(world, lens);
  assert.equal(typeof dn, 'number');
  assert.ok(dn >= 0 && dn <= 1);
});

test('groundSpread: a flat ground is 0, a ground with a figure spreads', () => {
  // flat: every being identical and linked alike → displacement is uniform
  const flat = makeWorld(
    [
      { id: 'a', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'b', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'c', kind: 'invoice', attrs: { amount: 100 } },
    ],
    [{ a: 'a', b: 'c' }, { a: 'b', b: 'c' }],
  );
  assert.equal(groundSpread(flat, lens), 0);
  // a figure with a neighbour, beside an isolated being (displacement 0)
  const spread = makeWorld(
    [
      { id: 'a', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'c', kind: 'invoice', attrs: { amount: 500 } },
      { id: 'd', kind: 'invoice', attrs: { amount: 100 } },
    ],
    [{ a: 'a', b: 'c' }],
  );
  assert.ok(groundSpread(spread, lens) > 0);
});

test('same() reports the ground and its Δ floor', () => {
  const world = makeWorld(
    [
      { id: 'a', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'b', kind: 'invoice', attrs: { amount: 100 } },
      { id: 'c', kind: 'invoice', attrs: { amount: 300 } },
    ],
    [{ a: 'a', b: 'c' }, { a: 'b', b: 'c' }],
  );
  const r = same('a', 'b', world, { lens, foldNull: 0.4 });
  assert.ok(r.ground && typeof r.ground.spread === 'number');
  assert.equal(typeof r.D.null, 'number');
});

// ---------------------------------------------------------------------------
// The bug the Δ-null change fixes, pinned: on a dense ground the old default
// (Δ's null = the fold null) sat above every displacement, so even a planted
// duplicate was 'different'. Ground: three vendors with ten 'std' invoices each
// (thirty beings that sit on their kind's average, so they disturb nothing) and a
// pair of 'rush' invoices, a and b, that are identical in every attribute and
// link — the only figures in it.
function denseGround() {
  const lensTier = { name: 'tier', attrs: ['tier'], giver: 'test' };
  const nodes = [], links = [];
  for (let v = 0; v < 3; v++) nodes.push({ id: `v${v}`, kind: 'vendor', attrs: {} });
  for (let i = 0; i < 30; i++) {
    nodes.push({ id: `s${i}`, kind: 'invoice', attrs: { tier: 'std' } });
    links.push({ a: `s${i}`, b: `v${i % 3}` });
  }
  for (const id of ['a', 'b']) {
    nodes.push({ id, kind: 'invoice', attrs: { tier: 'rush' } });
    links.push({ a: id, b: 'v0' });
  }
  return { world: makeWorld(nodes, links), lensTier };
}

test('a planted duplicate on a dense ground is the same under the default Δ null', () => {
  const { world, lensTier } = denseGround();
  const r = same('a', 'b', world, { lens: lensTier });
  assert.equal(r.verdict, 'same');
  assert.ok(r.D.a > r.D.null && r.D.b > r.D.null, 'both are figures: Δ above the displacement floor');
  assert.equal(r.ground.discrete, true);
});

test('the same ground under the old default (Δ null = fold null) calls the duplicate different', () => {
  const { world, lensTier } = denseGround();
  // what same() did before: no foldNull given, so fn = estimateNull, and Δ's null = fn
  const old = same('a', 'b', world, { lens: lensTier, deltaNull: estimateNull(world, lensTier) });
  assert.equal(old.verdict, 'different');
  assert.equal(old.formula.distinct, false);
  assert.ok(old.D.a < old.D.null, 'the fold null sits above the displacement, which is the bug');
});

test('a being on the kind average is not a figure, so it is not the same as a figure', () => {
  const { world, lensTier } = denseGround();
  assert.equal(same('s0', 's3', world, { lens: lensTier }).verdict, 'different'); // two ground beings
  assert.equal(same('a', 's0', world, { lens: lensTier }).verdict, 'different'); // a figure and a ground being
});

// The profile is one displacement per being; same() must not redo it per call.
test('displacementProfile is computed once per world, lens features, foldNull and quantile', () => {
  const { world, lensTier } = denseGround();
  const p = displacementProfile(world, lensTier, { foldNull: 0.01 });
  assert.equal(displacementProfile(world, lensTier, { foldNull: 0.01 }), p);
  // same() on the same world reuses it: the Δ floor it reports is the cached one
  assert.equal(same('a', 'b', world, { lens: lensTier, foldNull: 0.01 }).D.null, p.null);
  // a different foldNull, quantile or feature set is a different profile
  assert.notEqual(displacementProfile(world, lensTier, { foldNull: 0.3 }), p);
  assert.notEqual(displacementProfile(world, lensTier, { foldNull: 0.01, quantile: 0.9 }), p);
  assert.notEqual(displacementProfile(world, { attrs: ['other'] }, { foldNull: 0.01 }), p);
  // a lens that differs only in its name or giver still counts the same features
  assert.equal(displacementProfile(world, { ...lensTier, name: 'x', giver: 'y' }, { foldNull: 0.01 }), p);
});

test('the cached profile equals a fresh one, and growing the world or forgetGround drops it', () => {
  const { world, lensTier } = denseGround();
  const p = displacementProfile(world, lensTier, { foldNull: 0.01 });
  forgetGround(world);
  const fresh = displacementProfile(world, lensTier, { foldNull: 0.01 });
  assert.notEqual(fresh, p);
  assert.deepEqual(fresh, p);
  world.nodes.set('z', { id: 'z', kind: 'invoice', attrs: { tier: 'rush' } });
  world.links.push({ a: 'z', b: 'v1' });
  const grown = displacementProfile(world, lensTier, { foldNull: 0.01 });
  assert.notEqual(grown, fresh);
  assert.equal(grown.n, fresh.n + 1);
});
