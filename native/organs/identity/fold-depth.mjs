// fold-depth.mjs — how deep must the fold of a pair be read? DMD, with a conclusion that survives exhaustion.
//
// same()'s fold stops where the median one-hop change says (estimateNull), which is not DMD, and its descriptor U(x) is CUMULATIVE: the
// multiset of tokens of everything within h hops. Folded to the whole connected component, any two beings in it have the same descriptor,
// so "the conclusion compared with the whole" (dmdWindow) is trivially 'close' there. This module keeps the same lens and tokens but reads
// the fold as SHELLS: the multiset of tokens at exactly h hops, for h = 0, 1, 2, ... A difference at hop d lives in shell d and stays in
// the profile at every deeper radius, so exhaustion does not erase it.
//
//   conclusion(h)  = "the two shell profiles are close, shell by shell, out to radius h"   (a discrete boolean; exact comparison)
//   whole          = conclusion at the largest radius at which either being still has a shell
//   depth          = the shallowest radius whose conclusion equals the whole    (dmdWindow, native/kernel/activation.js, semantics)
//
// No hop count, similarity threshold or "deepest tried" is chosen; `tolerance` is the lens's own closeness (default 0: exact).
//
// A positive owes a null. A conclusion 'close' is a claim of sameness, so it is returned only if the same conclusion is rare when the
// relations are destroyed (links re-paired at random, degrees kept); otherwise the typed gap 'close_not_beyond_null'. A conclusion
// 'different' is the default and needs no null.
//
// KNOWN LIMIT (pinned in fold-depth.test.mjs): a hub linked to every being puts everything within two hops, so every shell profile is the
// same whatever the structure; the null (which keeps degrees but not "linked to everyone") does not recognise this, and 'close' is returned.

import { tokensOf, diffMaps } from './same.mjs';

const ALPHA = 0.01;      // a close conclusion must be rarer than this under the null (the 0.99 quantile used throughout this organ)
const DRAWS = 499;      // null draws: with alpha 0.01 a claim survives up to four chance successes; at 100 draws one chance success flipped identical pairs to a gap (knife-edge)

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function counts(tokens) { const m = new Map(); for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1); return m; }
function adjacency(world) {
  const adj = new Map([...world.nodes.keys()].map((id) => [id, []]));
  for (const l of world.links) { adj.get(l.a)?.push(l.b); adj.get(l.b)?.push(l.a); }
  return adj;
}

function shellsFrom(adj, id, tokenCounts) {
  const seen = new Set([id]);
  let frontier = [id];
  const shells = [tokenCounts.get(id)];
  for (;;) {
    const next = [];
    for (const f of frontier) for (const nb of adj.get(f) ?? []) if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
    if (!next.length) break;
    const c = new Map();
    for (const nb of next) for (const [t, n] of tokenCounts.get(nb)) c.set(t, (c.get(t) ?? 0) + n);
    shells.push(c);
    frontier = next;
  }
  return shells;
}
const tokenCountsOf = (world, lens) => new Map([...world.nodes].map(([id, n]) => [id, counts(tokensOf(n, lens))]));

/** The fold of `id` as shells: shells[h] = token counts of the beings at exactly h hops. */
export function shellProfiles(world, id, lens, adj = adjacency(world)) {
  if (!world.nodes.has(id)) return [];
  return shellsFrom(adj, id, tokenCountsOf(world, lens));
}

// closeUpTo[h] = every shell out to radius h is within tolerance
function closeUpTo(sa, sb, tolerance) {
  const R = Math.max(sa.length, sb.length) - 1, out = [];
  let ok = true;
  for (let h = 0; h <= R; h++) {
    ok = ok && diffMaps(sa[h] ?? new Map(), sb[h] ?? new Map()) <= tolerance;
    out.push(ok);
  }
  return out;
}

// dmdWindow's rule, for a nested family of radii: the shallowest candidate whose conclusion equals the whole conclusion, exact equality
export function shallowestAgreeing(candidates, conclude, whole) {
  const tried = [];
  for (const depth of [...candidates].sort((a, b) => a - b)) {
    const agrees = conclude(depth) === whole;
    tried.push({ depth, agrees });
    if (agrees) return { depth, tried };
  }
  return { depth: null, tried };
}

function rewiredAdjacency(world, rng) {   // links re-paired at random, degrees kept
  const stubs = [];
  for (const l of world.links) stubs.push(l.a, l.b);
  for (let i = stubs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [stubs[i], stubs[j]] = [stubs[j], stubs[i]]; }
  const adj = new Map([...world.nodes.keys()].map((id) => [id, []]));
  for (let i = 0; i + 1 < stubs.length; i += 2) if (stubs[i] !== stubs[i + 1]) { adj.get(stubs[i]).push(stubs[i + 1]); adj.get(stubs[i + 1]).push(stubs[i]); }
  return adj;
}

export function foldDepth(aId, bId, world, { lens, tolerance = 0, seed = 1, draws = DRAWS, alpha = ALPHA } = {}) {
  if (!lens) return { depth: null, gap: 'no_lens', basis: 'sameness needs a stated purpose/frame' };
  if (!world.nodes.has(aId) || !world.nodes.has(bId)) return { depth: null, gap: 'unknown_being' };
  const tc = tokenCountsOf(world, lens), adj0 = adjacency(world);
  const sa = shellsFrom(adj0, aId, tc), sb = shellsFrom(adj0, bId, tc);
  const close = closeUpTo(sa, sb, tolerance), R = close.length - 1, whole = close[R];
  const candidates = Array.from({ length: R + 1 }, (_, h) => h);
  const { depth, tried } = shallowestAgreeing(candidates, (h) => close[h], whole);
  const out = { depth, conclusion: whole ? 'close' : 'different', radius: R, tried };
  if (!whole) return { ...out, gap: null };
  // 'close' owes a null: the same conclusion must be rare when the relations are destroyed
  const rng = mulberry32(seed); let nullClose = 0;
  for (let i = 0; i < draws; i++) {
    const adj = rewiredAdjacency(world, rng);
    const c = closeUpTo(shellsFrom(adj, aId, tc), shellsFrom(adj, bId, tc), tolerance);
    if (c[c.length - 1]) nullClose++;
  }
  const p = (1 + nullClose) / (1 + draws);
  return p <= alpha ? { ...out, gap: null, p } : { ...out, depth: null, gap: 'close_not_beyond_null', p };
}
