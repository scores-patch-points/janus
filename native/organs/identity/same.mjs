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

// ---------------------------------------------------------------- the formula

export function same(aId, bId, world, { lens, foldNull, tolerance = 0, deltaNull, cosNull = 0 } = {}) {
  if (!lens) return { verdict: 'refused', reason: 'no lens: sameness needs a stated purpose/frame' };
  const fn = foldNull ?? estimateNull(world, lens);
  const dn = deltaNull ?? fn;
  const Ua = worldFold(aId, world, { lens, null: fn });
  const Ub = worldFold(bId, world, { lens, null: fn });
  const Uclose = diffMaps(Ua.descriptor, Ub.descriptor) <= tolerance;

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
    D: { a: Da, b: Db, null: dn, distinct },
    L: { cos, null: cosNull, aligned },
    lens: lens.name ?? null,
    giver: lens.giver ?? null,
  };
}

export { diffMaps, cosineMaps };
