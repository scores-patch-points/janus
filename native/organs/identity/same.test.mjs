import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, same, estimateNull, displacementNull, groundSpread } from './same.mjs';

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
