// word-evidence: the sorted null counts ride on every record (nullCounts), and nothing that was there changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEvidence } from './word-evidence.mjs';

// a toy fold: a word's ball is a fixed node list
const balls = {
  buy: ['x1', 'x2', 'x3', 'x4'], purchase: ['x1', 'x2', 'x3', 'y'],
  n1: ['x1', 'q', 'r', 's'], n2: ['x1', 'x2', 'r', 's'], n3: ['t', 'u', 'v', 'w'], n4: ['x1', 'x2', 'x3', 'z'], n5: ['a', 'b', 'c', 'd'],
};
const fold = { ball: (w) => ({ nodes: new Set(balls[w] ?? []) }), shared: (a, b) => (balls[a] ?? []).filter((x) => (balls[b] ?? []).includes(x)).length };
const E = () => makeEvidence(fold, { pool: ['n1', 'n2', 'n3', 'n4', 'n5'], seed: 't', nulls: 5 });

test('nullCounts are the null\'s shared counts, sorted ascending, and every older field is computed from them', () => {
  const e = E().evidence('buy', 'purchase');
  assert.deepEqual(e.nullCounts, [0, 0, 1, 2, 3]);
  const xs = e.nullCounts;
  assert.equal(e.null.n, xs.length);
  assert.equal(e.null.mean, xs.reduce((t, x) => t + x, 0) / xs.length);
  assert.equal(e.null.p95, xs[Math.min(xs.length - 1, Math.ceil(0.95 * xs.length) - 1)]);
  // falsifying: the list is sorted, not in draw order
  for (let k = 1; k < xs.length; k++) assert.ok(xs[k - 1] <= xs[k]);
});

test('the older fields are unchanged: the record minus nullCounts is the WordEvidence@1 record as before', () => {
  const { nullCounts, ...rest } = E().evidence('buy', 'purchase');
  assert.deepEqual(rest, { schema: 'WordEvidence@1', a: 'buy', b: 'purchase', radius: 1, shared: 3, sizes: [4, 4], empty: false, null: { n: 5, mean: 1.2, p95: 3 } });
  assert.deepEqual(Object.keys(rest), ['schema', 'a', 'b', 'radius', 'shared', 'sizes', 'empty', 'null']);
});

test('an empty record carries an empty null list', () => {
  const e = E().evidence('buy', 'nothere');
  assert.deepEqual([e.empty, e.null.n, e.nullCounts], [true, 0, []]);
});

test('a cached record\'s nullCounts is not the null cache itself', () => {
  const ev = E();
  const e = ev.evidence('buy', 'purchase'); e.nullCounts.push(99);
  const f = ev.evidence('buy', 'n4');   // same word, same bucket: the null rows are shared, the list is a copy
  assert.equal(f.nullCounts.includes(99), false);
});
