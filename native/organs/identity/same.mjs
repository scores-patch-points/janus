// same.mjs — the identity formula.
//
//   Same(a,b | W)  ⟺  U(a) ≈ U(b)  ∧  Δ(a),Δ(b) > null  ∧  cos(λ(a),λ(b)) > null
//
//   U(x)  the world folded around x, cut off at the first hop where widening
//         stops changing the fold by more than chance (null).
//   Δ(x)  how far x's neighbours move when x is replaced by the average of its
//         kind. An alias disturbs nothing; only Δ > null is a concept.
//   λ(x)  x's difference from the average of its kind (its signature).
//
// W — the purpose — is a "lens": which features count, a tolerance, and the
// frame. No lens ⇒ no comparison (refused, not false).
//
// THE NULL (2026-10-22, after the real-world test — janus/identity STATUS.md
// gap and the hyperlexicon `HYPERLEXICON-IDENTITY-FINDING.md`). Δ's null is a
// CHANCE FLOOR and must be drawn from the DISPLACEMENT distribution of the
// ground's own beings — not from the fold-change distribution. `estimateNull`
// (median one-hop fold change) is right for U's stopping hop and WRONG for Δ:
// on a dense real ground it returns a floor larger than every displacement, so
// `distinct` is never satisfied and `Same` degenerates to "everything
// different". `displacementNull` below is the Δ floor; `groundSpread` measures
// whether the ground has discrete figures at all (a continuous ground has a
// flat displacement distribution and no identities in it).

import { foldDepth } from './fold-depth.mjs';

const DEFAULT_NULL = 1e-6;

// ---------------------------------------------------------------- helpers

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function counts(tokens) {
  const m = new Map();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function diffMaps(m1, m2) {
  const keys = new Set([...m1.keys(), ...m2.keys()]);
  let s = 0, total = 0;
  for (const k of keys) {
    const a = m1.get(k) ?? 0, b = m2.get(k) ?? 0;
    s += Math.abs(a - b);
    total += a + b;
  }
  return total === 0 ? 0 : s / total;
}

function cosineMaps(m1, m2) {
  const keys = new Set([...m1.keys(), ...m2.keys()]);
  let dot = 0, n1 = 0, n2 = 0;
  for (const k of keys) {
    const a = m1.get(k) ?? 0, b = m2.get(k) ?? 0;
    dot += a * b;
    n1 += a * a;
    n2 += b * b;
  }
  if (n1 === 0 || n2 === 0) return 0;
  return dot / (Math.sqrt(n1) * Math.sqrt(n2));
}

// ---------------------------------------------------------------- world

export function makeWorld(nodes, links = []) {
  return { nodes: new Map(nodes.map((n) => [n.id, n])), links: links.map((l) => ({ ...l })) };
}

function attrKeys(node, lens) {
  if (lens && Array.isArray(lens.attrs) && lens.attrs.length) return lens.attrs;
  return Object.keys(node.attrs ?? {});
}

export function tokensOf(node, lens) {
  const out = [`kind=${node.kind}`];
  for (const k of attrKeys(node, lens)) out.push(`${k}=${node.attrs[k]}`);
  return out;
}

export function neighbors(world, id) {
  const out = [];
  for (const l of world.links) {
    if (l.a === id) out.push(l.b);
    else if (l.b === id) out.push(l.a);
  }
  return out;
}

// U(x): fold out to the first stable hop.
export function worldFold(id, world, { lens, null: null_, maxHops = 100 } = {}) {
  const node = world.nodes.get(id);
  if (!node) return { descriptor: new Map(), hop: 0 };
  const n = null_ ?? DEFAULT_NULL;
  let descriptor = counts(tokensOf(node, lens));
  const seen = new Set([id]);
  let frontier = [id];
  let hop = 0;
  while (hop < maxHops) {
    const next = [];
    for (const f of frontier) {
      for (const nb of neighbors(world, f)) {
        if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
      }
    }
    if (next.length === 0) break;
    const grown = new Map(descriptor);
    for (const nb of next) {
      for (const [t, c] of counts(tokensOf(world.nodes.get(nb), lens))) grown.set(t, (grown.get(t) ?? 0) + c);
    }
    const change = diffMaps(descriptor, grown);
    descriptor = grown;
    frontier = next;
    hop += 1;
    if (change <= n) break;
  }
  return { descriptor, hop };
}

// The average of a thing's kind (centroid over attrs).
export function kindCentroid(kind, world, lens) {
  const members = [...world.nodes.values()].filter((n) => n.kind === kind);
  const centroid = {};
  if (members.length === 0) return centroid;
  const keys = [...new Set(members.flatMap((n) => attrKeys(n, lens)))];
  for (const k of keys) {
    const vals = members.map((n) => n.attrs?.[k]).filter((v) => v !== undefined);
    if (vals.length === 0) continue;
    if (vals.every((v) => typeof v === 'number')) {
      centroid[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
    } else {
      const c = new Map();
      let best = vals[0], bestN = -1;
      for (const v of vals) {
        const key = String(v);
        c.set(key, (c.get(key) ?? 0) + 1);
        if (c.get(key) > bestN) { bestN = c.get(key); best = v; }
      }
      centroid[k] = best;
    }
  }
  return centroid;
}

// Δ(x): how far neighbours move when x is replaced by the kind average.
export function displacement(id, world, { lens, null: null_ } = {}) {
  const node = world.nodes.get(id);
  if (!node) return 0;
  const centroid = kindCentroid(node.kind, world, lens);
  const replacement = { ...node, attrs: { ...(node.attrs ?? {}), ...centroid } };
  const prime = makeWorld(
    [...world.nodes.values()].map((n) => (n.id === id ? replacement : n)),
    world.links,
  );
  const nbs = neighbors(world, id);
  if (nbs.length === 0) return 0;
  let total = 0;
  for (const nb of nbs) {
    const before = worldFold(nb, world, { lens, null: null_ }).descriptor;
    const after = worldFold(nb, prime, { lens, null: null_ }).descriptor;
    total += diffMaps(before, after);
  }
  return total / nbs.length;
}

// λ(x): x's difference from the kind average, as a signed token map.
export function signature(id, world, { lens } = {}) {
  const node = world.nodes.get(id);
  if (!node) return new Map();
  const self = counts(tokensOf(node, lens));
  const avg = counts(tokensOf({ kind: node.kind, attrs: kindCentroid(node.kind, world, lens) }, lens));
  const out = new Map();
  for (const k of new Set([...self.keys(), ...avg.keys()])) {
    const d = (self.get(k) ?? 0) - (avg.get(k) ?? 0);
    if (d !== 0) out.set(k, d);
  }
  return out;
}

// null: chance floor for "one more hop changes the fold", estimated from the
// graph's own per-node one-hop fold changes. Pass a fixed null to make a
// comparison deterministic.
export function estimateNull(world, lens, { seed = 1, quantile = 0.5 } = {}) {
  const rng = mulberry32(seed);
  const ids = [...world.nodes.keys()];
  const sample = ids.slice().sort(() => rng() - 0.5).slice(0, Math.max(4, Math.floor(ids.length / 2)));
  const changes = sample
    .map((id) => {
      const d0 = counts(tokensOf(world.nodes.get(id), lens));
      const grown = new Map(d0);
      for (const nb of neighbors(world, id)) {
        for (const [t, c] of counts(tokensOf(world.nodes.get(nb), lens))) grown.set(t, (grown.get(t) ?? 0) + c);
      }
      return diffMaps(d0, grown);
    })
    .sort((a, b) => a - b);
  const i = Math.min(changes.length - 1, Math.floor(changes.length * quantile));
  return changes[i] ?? DEFAULT_NULL;
}

// Δ's chance floor and the ground's spread, drawn from the DISPLACEMENT
// distribution (not the fold changes): the `quantile`-th displacement over the
// ground's own beings, and how much those displacements vary (0..1). A being is
// a figure only if its displacement exceeds the floor; a ground whose spread is
// near 0 is continuous — every being a uniform perturbation of every other — and
// has no discrete figures, so no identities in it. `foldNull` is the inner U
// stopping hop, passed through so the two nulls stay distinct.
//
// The profile costs one displacement per being, so it is computed once per
// (world, features that count, foldNull, quantile) and reused by every same()
// call on that world. A world is treated as fixed once compared: adding nodes or
// links is noticed, editing a node's attrs in place is not — call forgetGround
// after that.
const profiles = new WeakMap(); // world -> { stamp, byKey: Map }

const worldStamp = (world) => `${world.nodes.size}:${world.links.length}`;
const profileKey = (lens, foldNull, quantile) =>
  `${lens && Array.isArray(lens.attrs) && lens.attrs.length ? lens.attrs.join('\u0001') : '*'}|${foldNull}|${quantile}`;

export function forgetGround(world) {
  profiles.delete(world);
}

export function displacementProfile(world, lens, { quantile = 0.5, foldNull = 0.01 } = {}) {
  const stamp = worldStamp(world);
  let entry = profiles.get(world);
  if (!entry || entry.stamp !== stamp) {
    entry = { stamp, byKey: new Map() };
    profiles.set(world, entry);
  }
  const key = profileKey(lens, foldNull, quantile);
  const hit = entry.byKey.get(key);
  if (hit) return hit;

  const vals = [];
  for (const id of world.nodes.keys()) vals.push(displacement(id, world, { lens, null: foldNull }));
  let profile;
  if (!vals.length) profile = { null: DEFAULT_NULL, spread: 0, n: 0 };
  else {
    vals.sort((a, b) => a - b);
    const min = vals[0], max = vals[vals.length - 1];
    profile = {
      null: vals[Math.min(vals.length - 1, Math.floor(vals.length * quantile))] ?? DEFAULT_NULL,
      spread: max <= 0 ? 0 : (max - min) / max,
      n: vals.length,
    };
  }
  Object.freeze(profile);
  entry.byKey.set(key, profile);
  return profile;
}

export const displacementNull = (world, lens, opts) => displacementProfile(world, lens, opts).null;
export const groundSpread = (world, lens, opts) => displacementProfile(world, lens, opts).spread;

// ---------------------------------------------------------------- the formula

// OPT-IN, not the default: `fold: 'dmd'` reads U with fold-depth.mjs (shell profiles, dmdWindow's rule, a null for a 'close' conclusion)
// instead of the cumulative descriptor stopped by the median one-hop change. It adds a FOURTH verdict, 'unsupported': U is close but not
// rarer than chance when the relations are destroyed, so relations cannot establish sameness for these beings (a miss is a typed gap, never
// a guess); what would settle it is a declared identity key from a giver, or more relations around the pair. Δ keeps its own treatment
// (foldNull / estimateNull) until a Δ conclusion that survives exhaustion exists; λ is unchanged.
export function same(aId, bId, world, { lens, foldNull, tolerance = 0, deltaNull, cosNull = 0, fold = 'cumulative' } = {}) {
  if (!lens) return { verdict: 'refused', reason: 'no lens: sameness needs a stated purpose/frame' };
  let dmd = null;
  if (fold === 'dmd') {
    dmd = foldDepth(aId, bId, world, { lens, tolerance });
    if (dmd.gap === 'close_not_beyond_null') {
      return { verdict: 'unsupported', reason: 'the folds are close, but no closer than chance when the relations are destroyed: relations cannot establish sameness for these beings; a declared identity key from a giver, or more relations around the pair, would', fold: dmd, lens: lens.name ?? null, giver: lens.giver ?? null };
    }
    if (dmd.gap) return { verdict: 'refused', reason: `the fold cannot be read: ${dmd.gap}`, fold: dmd };
  }
  const fn = foldNull ?? estimateNull(world, lens);
  const prof = deltaNull === undefined ? displacementProfile(world, lens, { foldNull: fn }) : null;
  const dn = deltaNull ?? prof.null;
  const Uclose = dmd ? dmd.conclusion === 'close' : diffMaps(worldFold(aId, world, { lens, null: fn }).descriptor, worldFold(bId, world, { lens, null: fn }).descriptor) <= tolerance;

  const Da = displacement(aId, world, { lens, null: fn });
  const Db = displacement(bId, world, { lens, null: fn });
  const distinct = Da > dn && Db > dn;

  const la = signature(aId, world, { lens });
  const lb = signature(bId, world, { lens });
  const cos = cosineMaps(la, lb);
  const aligned = cos > cosNull;

  const pass = Uclose && distinct && aligned;
  return {
    verdict: pass ? 'same' : 'different',
    formula: { Uclose, distinct, aligned },
    U: { close: Uclose, tolerance },
    fold: dmd,
    D: { a: Da, b: Db, null: dn, distinct },
    L: { cos, null: cosNull, aligned },
    // the ground's own figure/ground contrast: spread ~0 means a continuous
    // ground with no discrete figures (identity cannot stand on it).
    ground: prof ? { spread: prof.spread, discrete: prof.spread > 0.05, n: prof.n } : null,
    lens: lens.name ?? null,
    giver: lens.giver ?? null,
  };
}

export { diffMaps, cosineMaps };
