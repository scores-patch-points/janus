// same(..., { fold: 'dmd' }): the opt-in reading of U by fold-depth.mjs. The default is unchanged (the other tests); this file pins what the option does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, same } from './same.mjs';

// the dense ground of same.test.mjs: thirty std invoices on the kind average, three vendors, and two identical 'rush' invoices a and b
function dense() {
  const nodes = [], links = [];
  for (let v = 0; v < 3; v++) nodes.push({ id: `v${v}`, kind: 'vendor', attrs: {} });
  for (let i = 0; i < 30; i++) { nodes.push({ id: `s${i}`, kind: 'invoice', attrs: { tier: 'std' } }); links.push({ a: `s${i}`, b: `v${i % 3}` }); }
  for (const id of ['a', 'b']) { nodes.push({ id, kind: 'invoice', attrs: { tier: 'rush' } }); links.push({ a: id, b: 'v0' }); }
  return makeWorld(nodes, links);
}
const lens = { name: 'tier', attrs: ['tier'], giver: 'test' };

test('default unchanged: the planted duplicate on the dense ground is still same', () => {
  const r = same('a', 'b', dense(), { lens });
  assert.equal(r.verdict, 'same'); assert.equal(r.fold, null);
});

test("fold: 'dmd' on the same ground: unsupported, a typed gap with what would settle it, never a guess", () => {
  const r = same('a', 'b', dense(), { lens, fold: 'dmd' });
  assert.equal(r.verdict, 'unsupported'); assert.equal(r.fold.gap, 'close_not_beyond_null'); assert.ok(/declared identity key/.test(r.reason));
});

test("fold: 'dmd' still says different where the structure differs, and names the depth", () => {
  const r = same('a', 's0', dense(), { lens, fold: 'dmd' });          // own attributes differ: radius 0
  assert.equal(r.verdict, 'different'); assert.equal(r.U.close, false); assert.equal(r.fold.depth, 0);
  const q = same('s0', 's1', dense(), { lens, fold: 'dmd' });         // equal attributes, vendors with different company: radius 2
  assert.equal(q.verdict, 'different'); assert.equal(q.fold.depth, 2);
});

test("fold: 'dmd' without a lens is refused as before", () => {
  assert.equal(same('a', 'b', dense(), { fold: 'dmd' }).verdict, 'refused');
});
