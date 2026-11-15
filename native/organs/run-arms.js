// run-arms.js — Janus's geometry over the reasoning ledger (2026-11-14).
// Pure: records in, shapes out. No file IO, no model, no verdict.
//
// Under the ruling "janus handles geometry, penelope handles calculus", this
// organ only CUTS and CONNECTS. It never says which arm is right, whether a
// ground has settled, or what a contradiction means; those are Penelope's.
//
//   SEG  armsOf: runs cut into ARMS, the classes of runs whose reading of
//        every ground they read is identical (same grounds, same units).
//   CON  the arm graph: two arms that share a ground are COMPATIBLE when
//        they read every shared ground the same, in CONFLICT otherwise.
//   SEG  per ground, the sequence of readings in run order, with how many
//        changes go to a new reading and how many return to an earlier one.
//   CON  readingShape: one reading's support graph over its role values, its
//        components, and (when the claims carry the caller's ref) whether
//        the claim side and the source side ever touch. When they don't, no
//        contradiction between them can even be stated; that is a fact about
//        the shape, never evidence of agreement.
//
// THE UNIT COMES FROM THE RECORD. A record read from the shared log carries its
// own `unit` (written by whoever stated the claim); that string is used as it
// is. Only a record with no `unit` (an older file ledger line) is keyed here,
// by unitKeyOf. Referent ids minted per run (b1, b2, ...) make "one unit" a
// claim about strings, not beings; that is disclosed, not settled here.

export const RUN_ARMS_SCHEMA = 'RunArms@1';

export function unitKeyOf(c) {
  const roles = Object.entries(c?.roles ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const pol = c?.polarity === '-' ? '-' : '+';
  return JSON.stringify([String(c?.ground ?? '/'), pol, String(c?.rel ?? '?'), roles]);
}
const keyOf = (c) => (typeof c?.unit === 'string' && c.unit ? c.unit : unitKeyOf(c));

/** records (parsed ledger lines, in file order) → [{ runId, at, claims: [...] }] in run order.
 *  A claim's run is its own runId when written (since 2026-11-14), else the run line before it. */
export function runsOf(records) {
  const runs = new Map();
  let current = null;
  for (const r of records) {
    if (r?.kind === 'reasoning-run') {
      current = r.id;
      if (!runs.has(current)) runs.set(current, { runId: current, at: r.title ?? null, claims: [] });
    } else if (r?.kind === 'reasoning-claim') {
      const id = r.runId ?? current;
      if (id == null) continue;
      if (!runs.has(id)) runs.set(id, { runId: id, at: null, claims: [] });
      runs.get(id).claims.push(r);
    }
  }
  return [...runs.values()];
}

/** one run → Map ground → reading (the sorted, distinct unit keys stated at that ground). */
export function readingsOf(run) {
  const by = new Map();
  for (const c of run.claims) {
    const g = String(c.ground ?? '/');
    if (!by.has(g)) by.set(g, new Set());
    by.get(g).add(keyOf(c));
  }
  return new Map([...by].map(([g, s]) => [g, JSON.stringify([...s].sort())]));
}

/** SEG: runs cut into arms by reading identity, plus the CON graph between arms. */
export function armsOf(runs) {
  const arms = [];
  const bySig = new Map();
  const runArm = new Map();
  for (const run of runs) {
    const rd = readingsOf(run);
    if (!rd.size) continue;
    const sig = JSON.stringify([...rd].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    let arm = bySig.get(sig);
    if (!arm) {
      arm = { arm: `A${arms.length + 1}`, sig, runs: [], readings: rd };
      bySig.set(sig, arm);
      arms.push(arm);
    }
    arm.runs.push(run.runId);
    runArm.set(run.runId, arm.arm);
  }
  const edges = [];
  for (let i = 0; i < arms.length; i++) {
    for (let j = i + 1; j < arms.length; j++) {
      const a = arms[i], b = arms[j];
      const shared = [...a.readings.keys()].filter((g) => b.readings.has(g));
      if (!shared.length) continue;
      const differ = shared.filter((g) => a.readings.get(g) !== b.readings.get(g));
      edges.push({ a: a.arm, b: b.arm, shared: shared.length, differ: differ.length, relation: differ.length ? 'conflict' : 'compatible' });
    }
  }
  return {
    arms: arms.map((a) => ({ arm: a.arm, sig: a.sig, runs: a.runs, grounds: [...a.readings.keys()].sort() })),
    edges,
    runArm,
  };
}

/** SEG along the run line: per ground, the readings in run order; changes to a new reading vs returns to an earlier one. */
export function groundSequences(runs) {
  const seq = new Map();
  for (const run of runs) {
    for (const [g, r] of readingsOf(run)) {
      if (!seq.has(g)) seq.set(g, []);
      seq.get(g).push(r);
    }
  }
  const out = [];
  for (const [ground, rs] of seq) {
    const ids = new Map();
    const labels = rs.map((r) => { if (!ids.has(r)) ids.set(r, `R${ids.size + 1}`); return ids.get(r); });
    let changes = 0, returns = 0;
    const seen = new Set([labels[0]]);
    for (let k = 1; k < labels.length; k++) {
      if (labels[k] === labels[k - 1]) continue;
      changes++;
      if (seen.has(labels[k])) returns++;
      seen.add(labels[k]);
    }
    out.push({ ground, reads: labels.length, readings: ids.size, sequence: labels, changes, returns });
  }
  return out;
}

/** CON: one reading's support graph. claims → { nodes, components, sides }.
 *  sides is null unless every claim carries a ref starting "c" or "s" (eot-janus's claim/source sides). */
export function readingShape(claims) {
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const add = (x) => { if (!parent.has(x)) parent.set(x, x); };
  const union = (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const nodesOf = (c) => Object.values(c.roles ?? {}).map(String);
  for (const c of claims) {
    const ns = nodesOf(c);
    ns.forEach(add);
    for (let i = 1; i < ns.length; i++) union(ns[0], ns[i]);
  }
  const roots = new Set([...parent.keys()].map(find));
  let sides = null;
  const sideOf = (c) => (typeof c.ref === 'string' && /^[cs]/.test(c.ref) ? c.ref[0] : null);
  if (claims.length && claims.every((c) => sideOf(c))) {
    const comps = { c: new Set(), s: new Set() };
    for (const c of claims) for (const n of nodesOf(c)) comps[sideOf(c)].add(find(n));
    const touch = [...comps.c].some((r) => comps.s.has(r));
    sides = { claim: comps.c.size, source: comps.s.size, touch: comps.c.size > 0 && comps.s.size > 0 ? touch : null };
  }
  return { nodes: parent.size, components: roots.size, sides };
}

/** The whole report, RunArms@1. Counts here are counts over the geometric cut, never verdicts. */
export function runArms(records) {
  const runs = runsOf(records);
  const { arms, edges } = armsOf(runs);
  const grounds = groundSequences(runs);
  const shapes = [];
  for (const run of runs) {
    const by = new Map();
    for (const c of run.claims) { const g = String(c.ground ?? '/'); if (!by.has(g)) by.set(g, []); by.get(g).push(c); }
    for (const [ground, cs] of by) shapes.push({ runId: run.runId, ground, ...readingShape(cs) });
  }
  const withSides = shapes.filter((s) => s.sides);
  return {
    schema: RUN_ARMS_SCHEMA,
    runs: runs.filter((r) => r.claims.length).length,
    arms,
    edges: { compatible: edges.filter((e) => e.relation === 'compatible').length, conflict: edges.filter((e) => e.relation === 'conflict').length, list: edges },
    grounds,
    totals: {
      changes: grounds.reduce((n, g) => n + g.changes, 0),
      returns: grounds.reduce((n, g) => n + g.returns, 0),
    },
    readings: {
      total: shapes.length,
      byComponents: shapes.reduce((m, s) => ((m[s.components] = (m[s.components] ?? 0) + 1), m), {}),
      sidesRecorded: withSides.length,
      sidesApart: withSides.filter((s) => s.sides.touch === false).length,
    },
    shapes,
  };
}
