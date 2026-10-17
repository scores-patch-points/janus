import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, same, estimateNull } from './same.mjs';

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
