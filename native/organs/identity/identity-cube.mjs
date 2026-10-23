// identity-cube.mjs — every identity act this organ can land, one per cell of the cube, with the null it owes.
//
// The cube (khora/native/kernel/cube.js) has 27 cells = 9 operators x 3 grains; the census of what a positive at each cell IS and which
// nulls it owes is khora/native/the-fold/standing-cube.js (THE-27-CELLS.md, THE-NULL-STATES.md). This file is the identity organ's own
// census against that one: for each cell, the identity act (a function that runs), the cell's positive it lands, and the owed nulls it
// returns as typed gaps. A gap name used here MUST be one the cell owes in khora's census; identity-cube.test.mjs pins that, and pins
// that the 27 come from the cube and not from this file. "Standing is a position with its owed nulls": nothing here assigns truth.
//
// `measured` names where the act met real material (a finding or a test on material), or is null: declared and exercised only on
// synthetic fixtures. The report, not the code, says which cells are which.
//
// khora is the base and janus imports it (THE-SPINE.md, one home per organ): cube, standing-cube, frame and ground-closure are read
// from the sibling checkout, never copied.

import * as cube from '../../../../khora/native/kernel/cube.js';
import { makeStandingCube } from '../../../../khora/native/the-fold/standing-cube.js';
import { declareFrame, comparable } from '../../../../khora/native/organs/frame.js';
import { makeWorld, same, displacement, displacementProfile } from './same.mjs';
import { newStore, admit, assertEdge, groups, promote, fissionReport } from './referents.mjs';
import { findDiscrepancies } from './finder.mjs';
import { resolveReferent } from './resolve.mjs';
import { foldDepth } from './fold-depth.mjs';
import { graphOf, matchPairDMD, rng } from './correspond.mjs';

export const STANDING = makeStandingCube({ operators: cube });
const owed = Object.fromEntries(STANDING.everyCell().map((c) => [c.cell, c.nulls]));
const gap = (cell, type, detail = {}) => Object.freeze({ cell, gap: type, ...detail });
const pos = (cell, detail = {}) => Object.freeze({ cell, positive: true, ...detail });

// ---------------------------------------------------------------- shared helpers (pure)
export function componentsOf(pairsByLang) { // union-find over (lang, key); pairsByLang: { 'A-B': [{a,b}] }
  const parent = new Map(); const find = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const [pr, es] of Object.entries(pairsByLang)) { const [A, B] = pr.split('-'); for (const e of es) { const x = find(A + '\u0001' + e.a), y = find(B + '\u0001' + e.b); if (x !== y) parent.set(x, y); } }
  const comp = new Map(); for (const x of parent.keys()) { const r = find(x); (comp.get(r) || comp.set(r, []).get(r)).push(x); }
  return [...comp.values()].map((m) => { const by = {}; for (const x of m) { const [l, k] = x.split('\u0001'); (by[l] ||= []).push(k); } return by; });
}
export function cyclesOf(pairsByLang) { // a -> b -> c against the direct a -> c, over every ordered triple of languages
  const langs = [...new Set(Object.keys(pairsByLang).flatMap((k) => k.split('-')))].sort();
  const get = (A, B) => { const p = pairsByLang[`${A}-${B}`], q = pairsByLang[`${B}-${A}`]; if (p) return new Map(p.map((e) => [e.a, e.b])); if (q) return new Map(q.map((e) => [e.b, e.a])); return new Map(); };
  let checkable = 0, consistent = 0, expected = 0;
  for (const A of langs) for (const B of langs) for (const C of langs) {
    if (A === B || B === C || A === C || langs.indexOf(A) > langs.indexOf(C)) continue;
    const ab = get(A, B), bc = get(B, C), ac = get(A, C); const t = [...ac.values()];
    for (const [a, b] of ab) { const c = bc.get(b); if (c === undefined) continue; const d = ac.get(a); if (d === undefined) continue; checkable++; if (c === d) consistent++; expected += t.filter((x) => x === c).length / t.length; }
  }
  return { checkable, consistent, expected };
}
export function plant(g, noise, seed) { // a known correspondence: the graph against a permuted copy with `noise` of each label's dependents shuffled
  const r = rng(seed); const n = g.n; const pi = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pi[i], pi[j]] = [pi[j], pi[i]]; }
  const edges = new Map();
  for (const [lab, es] of g.edges) { const e2 = es.map(([h, d, w]) => [pi[h], pi[d], w]); const k = Math.round(noise * e2.length); const idx = Array.from({ length: e2.length }, (_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } const pick = idx.slice(0, k); const ds = pick.map((i) => e2[i][1]); for (let i = ds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ds[i], ds[j]] = [ds[j], ds[i]]; } pick.forEach((i, t) => { e2[i] = [e2[i][0], ds[t], e2[i][2]]; }); edges.set(lab, e2); }
  const freq = new Array(n), keys = new Array(n); for (let i = 0; i < n; i++) { freq[pi[i]] = g.freq[i]; keys[pi[i]] = g.keys[i]; }
  return { gB: { keys, freq, tokens: g.tokens, n, edges }, pi };
}

// ---------------------------------------------------------------- the census: one act per cell
export const ACTS = Object.freeze({
  // ---- Existence
  'NUL·Ground': { act: 'ground', what: 'the ground\'s own variation: the Δ floor and spread of the beings under the lens',
    run: ({ world, lens, foldNull = 0.01 }) => { if (!world || !world.nodes.size) return gap('NUL·Ground', 'no_ground'); const p = displacementProfile(world, lens, { foldNull }); if (p.spread === 0) return gap('NUL·Ground', 'degenerate_ground', { why: 'every being displaces the ground equally: a continuous ground, a null that would clear anything or nothing', profile: p }); return pos('NUL·Ground', { profile: p }); },
    measured: 'groundSpread: flat on the hyperlexicon company world (HYPERLEXICON-IDENTITY-FINDING.md); 0 on a flat synthetic ground, >0 with a figure (same.test.mjs)' },
  'NUL·Figure': { act: 'figure', what: 'does this being clear the ground: Δ above the displacement floor',
    run: ({ id, world, lens, foldNull = 0.01 }) => { const p = displacementProfile(world, lens, { foldNull }); if (p.n < 2) return gap('NUL·Figure', 'exceeds_witness', { why: 'one being cannot be placed against a ground of itself' }); const d = displacement(id, world, { lens, null: foldNull }); return pos('NUL·Figure', { figure: d > p.null, displacement: d, floor: p.null }); },
    measured: 'planted duplicate on a dense ground is a figure under the displacement null and not under the fold null (same.test.mjs)' },
  'NUL·Pattern': { act: 'promote', what: 'an alias (Δ ≤ null) creates nothing; only what disturbs its neighbours beyond chance becomes a concept',
    run: ({ store, lens, member, world, null: nl }) => { const r = promote(store, { lens, member, world, null: nl }); return r.kind === 'alias' ? gap('NUL·Pattern', 'made_no_difference', { id: r.id }) : pos('NUL·Pattern', { referent: r.referent }); },
    measured: 'same.test.mjs: an alias that disturbs nothing is not a concept (Δ ≤ null); promote itself is exercised only on fixtures' },
  'SIG·Ground': { act: 'settle', what: 'name what is absent as the questions that would settle it',
    run: ({ verdict }) => { if (!verdict || !verdict.verdict) return gap('SIG·Ground', 'empty_material'); if (verdict.verdict === 'unsupported') return pos('SIG·Ground', { questions: ['which giver declares an identity key for these beings?', 'which further relations hold around the pair?'] }); if (verdict.verdict === 'refused') return pos('SIG·Ground', { questions: [verdict.reason] }); return pos('SIG·Ground', { questions: [] }); },
    measured: 'same-dmd.test.mjs: the unsupported verdict names what would settle it' },
  'SIG·Figure': { act: 'cast', what: 'which one is it: a mention resolved to a referent through the relations between nodes, Born posterior, ask or gap',
    run: ({ mention, candidates, neighbors, lens, giver }) => { if (!candidates || !candidates.length) return gap('SIG·Figure', 'beyond-reach', { why: 'no candidate pool' }); if (!mention?.nodes?.length) return gap('SIG·Figure', 'unheard', { why: 'a mention attached to nothing' }); return pos('SIG·Figure', { assertion: resolveReferent({ mention, candidates, neighbors, lens, giver }) }); },
    measured: 'held-out "David Jones": top-1 0.635, AUC 0.982 (IDENTITY-WHICH-ONE.md; resolve.test.mjs)' },
  'SIG·Pattern': { act: 'kinds', what: 'recurring correspondence classes signed provisionally; the control built to fail must fail',
    run: ({ pairsByLang, controlAdmitted = 0 }) => { const cs = componentsOf(pairsByLang); if (!cs.length) return gap('SIG·Pattern', 'no_candidate'); if (controlAdmitted > 0) return gap('SIG·Pattern', 'control_survived', { why: `the control admitted ${controlAdmitted} pair(s) on relations that were destroyed; the statistic does not resolve the claim (signal.js II.23)`, candidates: cs }); return pos('SIG·Pattern', { concepts: cs }); },
    measured: 'Run 4b: 73 pairs, 64 classes; the control admitted 21 — by this law the claim does NOT resolve (RESULTS-DMD.md)' },
  'INS·Ground': { act: 'preflight', what: 'the ground a correspondence needs: a graph of lemmas and typed relations from parsed sentences',
    run: ({ sentences }) => { if (!sentences || !sentences.length) return gap('INS·Ground', 'no_material'); const g = graphOf(sentences); if (!g.n) return gap('INS·Ground', 'empty_material'); return pos('INS·Ground', { graph: g }); },
    measured: 'five editions parsed into graphs of 492 to 532 lemmas (RESULTS-CONCEPTS-4.md)' },
  'INS·Figure': { act: 'birth', what: 'a referent is born at first admission: a hash id that claims nothing about sameness, with its address',
    run: ({ store, surface, address }) => { if (!surface) return gap('INS·Figure', 'INCOMPLETE'); if (!address) return gap('INS·Figure', 'UNADDRESSED', { why: 'an address is a birth, not a spelling' }); return pos('INS·Figure', { id: admit(store, surface), address }); },
    measured: 'referents.test.mjs: ids are stable and never rewritten' },
  'INS·Pattern': { act: 'skill', what: 'the correspondence procedure applied to new material, at a declared resolution',
    run: ({ gA, gB, seed = 1, draws, quantile }) => { if (!Number.isFinite(draws) || !Number.isFinite(quantile)) return gap('INS·Pattern', 'missing_kind_prior', { why: 'draws and quantile are declared, never defaulted' }); const finest = 1 - 1 / draws; if (quantile > finest) return gap('INS·Pattern', 'refused-as-underpowered', { why: `${draws} draws resolve quantiles no finer than ${finest.toFixed(3)}; ${quantile} is the maximum of the draws, not a quantile` }); if (!gA || !gB) return gap('INS·Pattern', 'missing_kind_prior'); return pos('INS·Pattern', { result: matchPairDMD(gA, gB, seed) }); },
    measured: 'every run so far used 30 draws at the 0.99 quantile: refused-as-underpowered by this act (the ceiling was the maximum of 30 maxima)' },
  // ---- Structure
  'SEG·Ground': { act: 'extent', what: 'the extent a reading must cover, and its units: the editions\' units and byte anchors',
    run: ({ units, expected, anchors }) => { if (!Array.isArray(anchors) || !anchors.length) return gap('SEG·Ground', 'no_anchor'); if (units !== expected) return gap('SEG·Ground', 'extent_excludes', { units, expected }); return pos('SEG·Ground', { units, anchors: anchors.length }); },
    measured: '471 of 516 editions parse into the 31 units; 45 are typed gaps (RESULTS.md)' },
  'SEG·Figure': { act: 'cut', what: 'the negative claim: two beings are different, at the radius where their folds part',
    run: ({ a, b, world, lens }) => { const r = foldDepth(a, b, world, { lens }); if (r.gap === 'unknown_being') return gap('SEG·Figure', 'beyond-reach'); return pos('SEG·Figure', { cut: r.conclusion === 'different', depth: r.depth, fold: r }); },
    measured: 'fold-depth.test.mjs: every planted difference is cut at exactly its hop (d 2..5, 360 of 360)' },
  'SEG·Pattern': { act: 'unravel', what: 'cut a class apart at its seams: pairs that merge under one lens and not another, givers named, nothing ranked',
    run: ({ store, lenses }) => { const r = fissionReport(store, lenses); if (!r.flips.length) return gap('SEG·Pattern', 'no_seam'); return pos('SEG·Pattern', { flips: r.flips, byLens: r.byLens }); },
    measured: 'referents.test.mjs: a flip between lenses is reported with its givers' },
  'CON·Ground': { act: 'field', what: 'maintain the connective ground: append an identity claim as an edge with holder, lens, degree; never decide',
    run: ({ store, edge }) => { if (!store || store.ids.size < 2) return gap('CON·Ground', 'no_population'); assertEdge(store, edge); return pos('CON·Ground', { edges: store.edges.length }); },
    measured: 'referents.test.mjs: edges append, groups are read at read time' },
  'CON·Figure': { act: 'relation', what: 'one correspondence between two lemmas: bound when it survives the null, unbound when it does not',
    run: ({ result, a, b }) => { if (!a || !b) return gap('CON·Figure', 'object_unspecific'); if (!result) return gap('CON·Figure', 'undetermined'); const hit = result.confirmed.find(([x, y]) => x === a && y === b); return hit ? pos('CON·Figure', { bound: true, score: hit[2] }) : gap('CON·Figure', 'unbound'); },
    measured: 'Run 4b: 73 bound pairs over five editions (RESULTS-DMD.md)' },
  'CON·Pattern': { act: 'network', what: 'a recurring arrangement: the triangle a -> b -> c closing on the direct a -> c',
    run: ({ pairsByLang }) => { const c = cyclesOf(pairsByLang); if (!c.checkable) return gap('CON·Pattern', 'no_incoming_face', { why: 'no triangle has all three edges' }); return pos('CON·Pattern', c); },
    measured: 'Run 4b: 9 of 9 consistent against 0.7 expected' },
  'SYN·Ground': { act: 'compile', what: 'sedimented correspondences merged into one carried ground: connected components over every language pair',
    run: ({ pairsByLang }) => { const cs = componentsOf(pairsByLang); if (!cs.length) return gap('SYN·Ground', 'empty_field'); return pos('SYN·Ground', { components: cs }); },
    measured: 'Run 4: 64 components over ten language pairs' },
  'SYN·Figure': { act: 'hear', what: 'a re-sighting folds into the SAME note, or is withheld, or vetoed by a discrepancy',
    run: ({ a, b, world, lens, store, holder = 'same()', accounts, fold = 'dmd' }) => { if (accounts) { const d = findDiscrepancies(accounts[0], accounts[1], accounts[2] ?? {}); if (d.some((row) => row.kind === 'different-things')) return gap('SYN·Figure', 'vetoed', { discrepancies: d }); } const v = same(a, b, world, { lens, fold }); if (v.verdict === 'same') { if (store) assertEdge(store, { holder, lens: lens.name ?? 'lens', a, b, transitive: true }); return pos('SYN·Figure', { folded: true, verdict: v }); } if (v.verdict === 'unsupported' || v.verdict === 'refused') return gap('SYN·Figure', 'withheld', { verdict: v }); return gap('SYN·Figure', 'vetoed', { verdict: v }); },
    measured: 'same.test.mjs / same-dmd.test.mjs; finder.test.mjs convicts Addenda 1-2 on a date mismatch' },
  'SYN·Pattern': { act: 'graph', what: 'the relations linked: lemmas to their heads and dependents, by label',
    run: ({ graph }) => { if (!graph || !graph.edges || ![...graph.edges.values()].some((es) => es.length)) return gap('SYN·Pattern', 'not_yet_executable', { why: 'a graph with no relations cannot be matched' }); return pos('SYN·Pattern', { labels: [...graph.edges.keys()], edges: [...graph.edges.values()].reduce((s, es) => s + es.length, 0) }); },
    measured: 'five edition graphs with 27 to 58 relation labels' },
  // ---- Interpretation
  'DEF·Ground': { act: 'void', what: 'the interpretive ground declared before the judgment: lens, organs, givers, numbers; none defaulted',
    run: async ({ lens, organs, givers, numbers }) => { if (!lens) return gap('DEF·Ground', 'no_frame', { why: 'sameness needs a stated purpose/frame' }); const f = await declareFrame({ organs, givers, numbers }); if (f.refused) return gap('DEF·Ground', 'undeclared', { what: f.what }); return pos('DEF·Ground', { frame: f.frame }); },
    measured: 'same.test.mjs: no lens ⇒ refused, never false; every run\'s conditions are in the EOT log as text, not yet as a frame' },
  'DEF·Figure': { act: 'prior', what: 'one claim checked against a fixture whose truth is known: the planted correspondence',
    run: ({ graph, noise = 0, seed = 77, draws, quantile }) => { if (!graph) return gap('DEF·Figure', 'fixture_absent'); if (noise === null) return gap('DEF·Figure', 'control_absent', { why: 'a correspondence method without a planted control has no positive control' }); const { gB, pi } = plant(graph, noise, seed); const m = matchPairDMD(graph, gB, seed); const ok = m.confirmed.filter(([a, b]) => pi[a] === b).length; const withEdges = new Set(); for (const es of graph.edges.values()) for (const [h, d] of es) { withEdges.add(h); withEdges.add(d); } return pos('DEF·Figure', { admitted: m.confirmed.length, correct: ok, precision: m.confirmed.length ? ok / m.confirmed.length : null, recall: ok / Math.max(1, withEdges.size) }); },
    measured: 'planted English graph: precision 1.00, recall 0.41 at the fixed point (RESULTS-DMD.md)' },
  'DEF·Pattern': { act: 'declare', what: 'a candidate transitive declaration acquired from the material: do the correspondences close under cycles?',
    run: ({ pairsByLang }) => { const c = cyclesOf(pairsByLang); if (!c.checkable) return gap('DEF·Pattern', 'unmeasured', { why: 'no triangle to test transitivity on' }); return pos('DEF·Pattern', { candidate: 'transitive', holds: c.consistent === c.checkable, ...c }); },
    measured: 'Run 4b: 9 of 9 (candidate holds); not yet accepted by a giver' },
  'EVA·Ground': { act: 'atmosphere', what: 'the reader\'s own accumulated ground, metered per cell: the Δ floor and spread of each world',
    run: ({ worldsByCell, lens, foldNull = 0.01 }) => { const cells = Object.entries(worldsByCell ?? {}); if (!cells.length) return gap('EVA·Ground', 'unexamined'); return pos('EVA·Ground', { cells: Object.fromEntries(cells.map(([k, w]) => [k, displacementProfile(w, lens, { foldNull })])) }); },
    measured: 'hyperlexicon T4: the same word in two cells has a different fold (HYPERLEXICON-IDENTITY-FINDING.md)' },
  'EVA·Figure': { act: 'judge', what: 'a figure judged through the lens: same, different, unsupported, refused',
    run: ({ a, b, world, lens, fold = 'dmd' }) => { const v = same(a, b, world, { lens, fold }); if (v.verdict === 'unsupported') return gap('EVA·Figure', 'insufficient', { verdict: v }); if (v.verdict === 'refused') return gap('EVA·Figure', 'inconclusive', { verdict: v }); return pos('EVA·Figure', { verdict: v }); },
    measured: 'same.test.mjs, same-dmd.test.mjs' },
  'EVA·Pattern': { act: 'standing', what: 'a claim\'s standing across independent mechanisms: a property of the set, never of one witness',
    run: ({ foundBy, frames }) => { if (frames && frames.length >= 2) { const c = comparable(frames[0], frames[1], { frames: Object.fromEntries(frames.filter((f) => f.id).map((f) => [f.id, f])) }); if (!c.comparable) return gap('EVA·Pattern', 'NOT_COMPARABLE', c); } const n = Object.values(foundBy ?? {}).filter(Boolean).length; return pos('EVA·Pattern', { standing: n >= 2 ? 'AGREE' : n === 1 ? 'SINGLE' : 'UNDETERMINED', families: n }); },
    measured: 'PROJECTION.md: 12 of Run 4\'s 79 pairs AGREE with a family that used the given alignment; 4 with two' },
  'REC·Ground': { act: 'regime', what: 'the ground re-zeroed when it has jammed: a flat displacement spread is a filled void',
    run: ({ world, lens, foldNull = 0.01 }) => { const p = displacementProfile(world, lens, { foldNull }); if (p.spread > 0) return gap('REC·Ground', 'no_rezero_trigger', { profile: p }); return pos('REC·Ground', { action: 're-ground', why: 'every being displaces the ground equally: a jammed wheel; shed the ground and descend one level', profile: p }); },
    measured: 'the hyperlexicon company world: Δ flat at 0.024 under every kind (a continuous ground)' },
  'REC·Figure': { act: 'rezero', what: 'a judged projection conceded and the next born: supersede by pointer on an append-only record',
    run: ({ history, entry }) => { if (!entry?.id) return gap('REC·Figure', 'record_gap'); if (history.some((h) => h.id === entry.id)) return gap('REC·Figure', 'record_conflict', { why: 'an id is never re-filed; supersede it by pointer' }); if (entry.supersedes && !history.some((h) => h.id === entry.supersedes)) return gap('REC·Figure', 'source_absent', { supersedes: entry.supersedes }); return pos('REC·Figure', { history: Object.freeze([...history, Object.freeze({ ...entry })]) }); },
    measured: 'hop 2 withdrawn and Run 4 superseded by Run 4b, appended as dated corrections (HYPERLEXICON-IDENTITY-DEFINITION.md)' },
  'REC·Pattern': { act: 'reshape', what: 'a finding that contradicts the declared space re-zeros the space: a new frame, or the paradigm has unraveled',
    run: async ({ frame, finding, next }) => { if (!frame) return gap('REC·Pattern', 'empty_paradigm'); if (!finding?.contradictsDeclaredSpace) return gap('REC·Pattern', 'kept_ground', { why: 'nothing contradicted the declared space; REC is never a default' }); if (!next) return gap('REC·Pattern', 'paradigm_unraveled', { finding }); const f = await declareFrame(next); if (f.refused) return gap('REC·Pattern', 'paradigm_unraveled', { finding, refused: f }); return pos('REC·Pattern', { from: frame.id, to: f.frame.id, finding }); },
    measured: 'Runs 1-3 (given coordinates, Wiktionary judge) reshaped into Run 4 (no coordinates, no judge) when the user\'s reading contradicted the declared space' },
});

/** landWith(acts, cell, input) — run an act table's act at a cell; a positive, or one of the nulls that cell owes (khora's census). A gap the
 * cell does not owe is a TypeError, never a silent return. Unknown cell: the cube's own gap. */
export async function landWith(acts, cell, input = {}) {
  const [op, grain] = String(cell).split('·');
  const c = cube.cellOf(op, grain); if (c?.gap) return c;
  const a = acts[cell]; if (!a) return gap(cell, 'uncensused_cell');
  const out = await a.run(input);
  if (out.gap && !owed[cell].includes(out.gap)) throw new TypeError(`${cell}: ${out.gap} is not a null this cell owes (${owed[cell].join(', ')})`);
  return out;
}
/** land(cell, input) — the identity organ's own acts. */
export const land = (cell, input = {}) => landWith(ACTS, cell, input);

/** coverage() — every cell of the cube with its identity act, owed nulls, and whether it met real material. */
export function coverage() {
  return STANDING.everyCell().map((c) => ({ cell: c.cell, terrain: c.terrain, stance: cube.STANCE_BY_MODE[c.mode][c.grain], positive: c.positive, act: ACTS[c.cell]?.act ?? null, what: ACTS[c.cell]?.what ?? null, owedNulls: c.nulls, measured: ACTS[c.cell]?.measured ?? null }));
}
