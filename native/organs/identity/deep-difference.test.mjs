// Deep-difference test for the U(x) bound (worldFold): does the fold reach a planted difference that sits d hops out?
// Realistic world: seeded, mirrored noisy branching prefix, partial fan of K=6 leaves at hop d, 80 background nodes.
// Registered before running (2026-10-20): d in 2..5, f in {1/6, 3/6, 1} of the fan differing, 30 seeds, B=2, V=12.
// Finding pinned here: fixed nulls 0.01..0.20 detect 100% and are invariant to added irrelevant branches; the default
// estimateNull (median one-hop change) detects ~66% and is not invariant. The last test pins that gap and FLIPS when
// the default null is fixed (then change its assertion).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, worldFold, estimateNull } from './same.mjs';

const lens = { attrs: ['v'] };
const B = 2, V = 12, K = 6, BG = 80, SEEDS = 30;
const DS = [2, 3, 4, 5], FS = [1 / 6, 3 / 6, 1];

const diffMaps = (m1, m2) => {
  let s = 0, t = 0;
  for (const k of new Set([...m1.keys(), ...m2.keys()])) { const a = m1.get(k) ?? 0, b = m2.get(k) ?? 0; s += Math.abs(a - b); t += a + b; }
  return t === 0 ? 0 : s / t;
};
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function build(d, f, seed, extra = 0) {
  const r = rng(seed), nodes = [], links = [];
  const tok = () => `t${Math.floor(r() * V)}`;
  const nDiff = Math.round(f * K);
  const shape = [];
  for (let h = 1; h < d; h++) shape.push(Array.from({ length: B ** h }, tok));
  const fan = Array.from({ length: K }, () => tok());
  for (const side of ['a', 'b']) {
    nodes.push({ id: side, kind: 'n', attrs: { v: 'root' } });
    let frontier = [side];
    for (let h = 1; h < d; h++) {
      const next = [];
      frontier.forEach((p, i) => {
        for (let c = 0; c < B; c++) { const idx = i * B + c, id = `${side}.${h}.${idx}`; nodes.push({ id, kind: 'n', attrs: { v: shape[h - 1][idx] } }); links.push({ a: p, b: id }); next.push(id); }
      });
      frontier = next;
    }
    for (let k = 0; k < K; k++) { const id = `${side}.fan${k}`; nodes.push({ id, kind: 'n', attrs: { v: side === 'b' && k < nDiff ? `${fan[k]}*` : fan[k] } }); links.push({ a: frontier[0], b: id }); }
    for (let e = 0; e < extra; e++) { const id = `${side}.irr${e}`; nodes.push({ id, kind: 'n', attrs: { v: `irr${e}` } }); links.push({ a: side, b: id }); }
  }
  for (let i = 0; i < BG; i++) { const id = `g${i}`; nodes.push({ id, kind: 'n', attrs: { v: r() < 0.1 ? `rare${i}` : tok() } }); if (i) links.push({ a: id, b: `g${Math.floor(r() * i)}` }); }
  return makeWorld(nodes, links);
}

function sweep(nullOf) {
  let hit = 0, n = 0, inv = 0, falseDiff = 0, falseN = 0;
  for (const d of DS) for (let s = 1; s <= SEEDS; s++) {
    const seed = s * 7919 + d;
    { const w = build(d, 0, seed), nl = nullOf(w); // identical pair
      falseN++; if (diffMaps(worldFold('a', w, { lens, null: nl }).descriptor, worldFold('b', w, { lens, null: nl }).descriptor) > 0) falseDiff++; }
    for (const f of FS) {
      const w = build(d, f, seed), nl = nullOf(w);
      const A = worldFold('a', w, { lens, null: nl }), Bf = worldFold('b', w, { lens, null: nl });
      const differ = diffMaps(A.descriptor, Bf.descriptor) > 0;
      n++; if (differ) hit++;
      const w2 = build(d, f, seed, 3);   // irrelevant detail on both roots, same null value
      const A2 = worldFold('a', w2, { lens, null: nl }), B2 = worldFold('b', w2, { lens, null: nl });
      if ((diffMaps(A2.descriptor, B2.descriptor) > 0) === differ && A2.hop === A.hop) inv++;
    }
  }
  return { detect: hit / n, invariant: inv / n, falseDiff: falseDiff / falseN };
}

for (const fixed of [0.01, 0.05, 0.1, 0.2]) {
  test(`fixed null ${fixed}: every planted deep difference is reached, nothing identical is called different, irrelevant detail moves nothing`, () => {
    const r = sweep(() => fixed);
    assert.equal(r.detect, 1);
    assert.equal(r.falseDiff, 0);
    assert.equal(r.invariant, 1);
  });
}

test('KNOWN GAP: the default estimateNull stops before some deep differences and moves under irrelevant detail', () => {
  const r = sweep((w) => estimateNull(w, lens));
  assert.ok(r.detect < 1, `default null now detects ${r.detect}: gap closed, update this test`);
  assert.ok(r.invariant < 1);
  assert.equal(r.falseDiff, 0);   // the failure is only ever the missed direction
});
