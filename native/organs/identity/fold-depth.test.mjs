// fold-depth.mjs against the deep-difference falsifier (same registered world as deep-difference.test.mjs: d in 2..5, f in {1/6, 3/6, 1},
// 30 seeds, B=2, V=12), a connected-component case where the cumulative descriptor is vacuous, and the limit that remains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, worldFold, diffMaps } from './same.mjs';
import { foldDepth, shellProfiles, shallowestAgreeing } from './fold-depth.mjs';

const lens = { attrs: ['v'] };
const B = 2, V = 12, K = 6, BG = 80, SEEDS = 30;
const DS = [2, 3, 4, 5], FS = [1 / 6, 3 / 6, 1];
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the deep-difference world, as nodes and links so variants can add to it
function parts(d, f, seed, extra = 0) {
  const r = rng(seed), nodes = [], links = [];
  const tok = () => `t${Math.floor(r() * V)}`;
  const nDiff = Math.round(f * K), shape = [];
  for (let h = 1; h < d; h++) shape.push(Array.from({ length: B ** h }, tok));
  const fan = Array.from({ length: K }, () => tok());
  for (const side of ['a', 'b']) {
    nodes.push({ id: side, kind: 'n', attrs: { v: 'root' } });
    let frontier = [side];
    for (let h = 1; h < d; h++) {
      const next = [];
      frontier.forEach((p, i) => { for (let c = 0; c < B; c++) { const idx = i * B + c, id = `${side}.${h}.${idx}`; nodes.push({ id, kind: 'n', attrs: { v: shape[h - 1][idx] } }); links.push({ a: p, b: id }); next.push(id); } });
      frontier = next;
    }
    for (let k = 0; k < K; k++) { const id = `${side}.fan${k}`; nodes.push({ id, kind: 'n', attrs: { v: side === 'b' && k < nDiff ? `${fan[k]}*` : fan[k] } }); links.push({ a: frontier[0], b: id }); }
    for (let e = 0; e < extra; e++) { const id = `${side}.irr${e}`; nodes.push({ id, kind: 'n', attrs: { v: `irr${e}` } }); links.push({ a: side, b: id }); }
  }
  for (let i = 0; i < BG; i++) { const id = `g${i}`; nodes.push({ id, kind: 'n', attrs: { v: r() < 0.1 ? `rare${i}` : tok() } }); if (i) links.push({ a: id, b: `g${Math.floor(r() * i)}` }); }
  return { nodes, links };
}
const build = (d, f, seed, extra = 0) => { const p = parts(d, f, seed, extra); return makeWorld(p.nodes, p.links); };
const bridged = (d, f, seed) => { const p = parts(d, f, seed); p.nodes.push({ id: 'hub', kind: 'n', attrs: { v: 'hub' } }); p.links.push({ a: 'a', b: 'hub' }, { a: 'b', b: 'hub' }); return makeWorld(p.nodes, p.links); };
const hubbed = (d, f, seed) => { const p = parts(d, f, seed); p.nodes.push({ id: 'HUB', kind: 'n', attrs: { v: 'hub' } }); for (const n of [...p.nodes]) if (n.id !== 'HUB') p.links.push({ a: 'HUB', b: n.id }); return makeWorld(p.nodes, p.links); };

test('deep-difference falsifier: every planted difference is reached at exactly its hop, identical pairs are close beyond the null, irrelevant detail moves nothing', () => {
  let n = 0, hit = 0, depthOk = 0, inv = 0, identicalN = 0, identicalClose = 0;
  for (const d of DS) for (let s = 1; s <= SEEDS; s++) {
    const seed = s * 7919 + d;
    { const r = foldDepth('a', 'b', build(d, 0, seed), { lens }); identicalN++; if (r.conclusion === 'close' && r.gap === null) identicalClose++; }
    for (const f of FS) {
      const r = foldDepth('a', 'b', build(d, f, seed), { lens }), r2 = foldDepth('a', 'b', build(d, f, seed, 3), { lens });
      n++; if (r.conclusion === 'different') hit++; if (r.depth === d) depthOk++;
      if (r2.conclusion === r.conclusion && r2.depth === r.depth) inv++;
    }
  }
  assert.equal(hit, n, 'detect'); assert.equal(depthOk, n, 'the depth is the hop at which the difference sits'); assert.equal(inv, n, 'invariant to irrelevant branches');
  assert.equal(identicalClose, identicalN, 'an identical pair is called close, and the null supports it');
});

test('connected component: the cumulative descriptor is vacuous once the fold covers the component; the shell profiles still reach the difference', () => {
  let n = 0, cumulativeVacuous = 0, found = 0, atD = 0;
  for (const d of DS) for (let s = 1; s <= SEEDS; s++) for (const f of FS) {
    const w = bridged(d, f, s * 7919 + d);
    n++;
    const A = worldFold('a', w, { lens, null: 0 }), Bf = worldFold('b', w, { lens, null: 0 });
    if (diffMaps(A.descriptor, Bf.descriptor) === 0) cumulativeVacuous++;   // folded to the whole component, the two cannot differ
    const r = foldDepth('a', 'b', w, { lens });
    if (r.conclusion === 'different') found++; if (r.depth === d) atD++;
  }
  assert.equal(cumulativeVacuous, n, 'the old descriptor cannot see any of the planted differences here');
  assert.equal(found, n); assert.equal(atD, n);
});

test('connected component, identical pair: close, and beyond the null', () => {
  for (const d of DS) { const r = foldDepth('a', 'b', bridged(d, 0, 11 * d), { lens }); assert.equal(r.conclusion, 'close'); assert.equal(r.gap, null); }
});

test('KNOWN LIMIT: a hub linked to every being hides a planted difference from every shell profile; the null does not notice. FLIPS when fixed.', () => {
  let close = 0, gaps = 0, n = 0;
  for (const d of DS) for (let s = 1; s <= 5; s++) { const r = foldDepth('a', 'b', hubbed(d, 1, s * 7919 + d), { lens }); n++; if (r.conclusion === 'close') close++; if (r.gap) gaps++; }
  assert.equal(close, n, `shell profiles call the planted-different pair close in a hub world (${close}/${n}); once a hub-aware metric exists this should be a gap or a difference`);
  assert.equal(gaps, 0);
});

test('typed gaps: no lens; unknown being; two isolated beings that look alike are not "close beyond the null"', () => {
  const w = makeWorld([{ id: 'x', kind: 'n', attrs: { v: 'p' } }, { id: 'y', kind: 'n', attrs: { v: 'p' } }], []);
  assert.equal(foldDepth('x', 'y', w, {}).gap, 'no_lens');
  assert.equal(foldDepth('x', 'zzz', w, { lens }).gap, 'unknown_being');
  const r = foldDepth('x', 'y', w, { lens }); assert.equal(r.conclusion, 'close'); assert.equal(r.gap, 'close_not_beyond_null'); assert.equal(r.depth, null);
});

test('shellProfiles: the multiset of tokens at exactly h hops, not within h hops', () => {
  const w = makeWorld([{ id: 'r', kind: 'n', attrs: { v: 'R' } }, { id: 'c1', kind: 'n', attrs: { v: 'C' } }, { id: 'c2', kind: 'n', attrs: { v: 'C' } }, { id: 'g', kind: 'n', attrs: { v: 'G' } }], [{ a: 'r', b: 'c1' }, { a: 'r', b: 'c2' }, { a: 'c1', b: 'g' }]);
  const s = shellProfiles(w, 'r', lens);
  assert.equal(s.length, 3); assert.equal(s[1].get('v=C'), 2); assert.equal(s[2].get('v=G'), 1); assert.equal(s[2].get('v=C'), undefined);
});

test('the rule is dmdWindow\'s: the same depth as khora\'s kernel/activation.js::dmdWindow where that file is present', async (t) => {
  let dmdWindow;
  try { ({ dmdWindow } = await import('../../../../khora/native/kernel/activation.js')); } catch { t.skip('khora is not a sibling checkout'); return; }
  for (const d of DS) {
    const w = build(d, 3 / 6, 7919 * 3 + d), mine = foldDepth('a', 'b', w, { lens });
    const sa = shellProfiles(w, 'a', lens), sb = shellProfiles(w, 'b', lens), R = mine.radius;
    const close = []; let ok = true; for (let h = 0; h <= R; h++) { ok = ok && diffMaps(sa[h] ?? new Map(), sb[h] ?? new Map()) <= 0; close.push(ok); }
    const kernel = dmdWindow({ depth: R }, (o) => close[o.depth], { candidates: Array.from({ length: R + 1 }, (_, h) => h), restrict: (o, depth) => ({ depth }) });
    assert.equal(kernel.window, mine.depth);
    assert.equal(shallowestAgreeing([0, 1, 2, 3, 4, 5], (h) => close[Math.min(h, R)], close[R]).depth, mine.depth);
  }
});
