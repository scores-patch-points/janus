// referents.mjs — ids, edges, folds.
//
// A hash id claims nothing about sameness. Every merge is an identity claim and
// is stored as an edge { holder, lens, degree, a, b }. Groups are computed at
// read time; ids are never rewritten, so a fission can be undone.
//
// Union-find is used only over TRANSITIVE edges (equality keys). A threshold or
// "mostly the same" lens is not an identity relation: its edges are reported as
// claims, never collapsed.

import { createHash } from 'node:crypto';
import { displacement } from './same.mjs';

export function hashId(...parts) {
  const h = createHash('sha256');
  for (const p of parts) h.update(String(p));
  return h.digest('hex').slice(0, 16);
}

export function newStore() {
  return { ids: new Set(), edges: [] };
}

export function admit(store, surface) {
  const id = hashId('surface', surface);
  store.ids.add(id);
  return id;
}

// An identity claim. `transitive: false` marks a threshold/vague lens, whose
// merges must never be rewritten into one id.
export function assertEdge(store, { holder, lens, degree = 1, a, b, transitive = true }) {
  if (!holder || !lens) return { refused: true, reason: 'an identity claim needs a holder and a lens' };
  const edge = { holder, lens, degree, a, b, transitive, seq: store.edges.length };
  store.edges.push(edge);
  return { ok: true, edge };
}

export function groups(store, lens) {
  const parent = new Map();
  const find = (x) => {
    let root = x;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root);
    let cur = x;
    while (parent.get(cur) !== root) { const next = parent.get(cur); parent.set(cur, root); cur = next; }
    return root;
  };
  const union = (x, y) => { const rx = find(x), ry = find(y); if (rx !== ry) parent.set(rx, ry); };
  for (const id of store.ids) parent.set(id, id);
  for (const e of store.edges) if (e.lens === lens && e.transitive && e.degree > 0) union(e.a, e.b);
  const byRoot = new Map();
  for (const id of store.ids) { const r = find(id); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(id); }
  return [...byRoot.values()];
}

export function nonTransitiveClaims(store, lens) {
  return store.edges.filter((e) => e.lens === lens && !e.transitive);
}

export function conceptualReferent(store, lens, members, { bound } = {}) {
  const sorted = [...members].sort();
  return {
    id: hashId('concept', lens, sorted.join(','), bound ?? ''),
    lens,
    members: sorted,
    bound: bound ?? null,
  };
}

// promotion: an alias (Δ ≤ null) creates nothing; only what disturbs its
// neighbours more than chance becomes a concept.
export function promote(store, { lens, member, world, null: null_ }) {
  const d = displacement(member, world, { lens, null: null_ });
  if (d > (null_ ?? 0)) {
    const g = groups(store, lens).find((grp) => grp.includes(member)) ?? [member];
    return { kind: 'concept', referent: conceptualReferent(store, lens, g) };
  }
  return { kind: 'alias', id: member };
}

function sameGroup(groups, x, y) {
  return groups.some((g) => g.includes(x) && g.includes(y));
}

// Report which pairs merge under which lens, and flag every "flip" (a pair that
// merges under one lens but not another). Givers are named; nothing is ranked.
export function fissionReport(store, lensNames) {
  const byLens = {};
  for (const name of lensNames) {
    byLens[name] = {
      groups: groups(store, name),
      givers: [...new Set(store.edges.filter((e) => e.lens === name).map((e) => e.holder))],
      claims: store.edges.filter((e) => e.lens === name),
    };
  }
  const ids = [...store.ids];
  const flips = [];
  for (let i = 0; i < lensNames.length; i++) {
    for (let j = i + 1; j < lensNames.length; j++) {
      const A = lensNames[i], B = lensNames[j];
      for (let p = 0; p < ids.length; p++) {
        for (let q = p + 1; q < ids.length; q++) {
          const x = ids[p], y = ids[q];
          const inA = sameGroup(byLens[A].groups, x, y);
          const inB = sameGroup(byLens[B].groups, x, y);
          if (inA !== inB) {
            flips.push({
              a: x, b: y,
              mergedUnder: inA ? A : B,
              notUnder: inA ? B : A,
              givers: [...byLens[A].givers, ...byLens[B].givers],
            });
          }
        }
      }
    }
  }
  return { byLens, flips };
}
