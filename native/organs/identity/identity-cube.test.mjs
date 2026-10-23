// Falsification: the identity organ's own census of the cube.
//   1. GENERATED — the 27 cells come from khora's cube (algebraAddresses), not from this organ's table.
//   2. COVERED — every one of the 27 has an identity act that runs.
//   3. THE PAIRING RULE — at every cell the act lands a positive on one input and one of the OWED nulls (khora's census, never a name of
//      ours) on another; a gap name the cell does not owe is a thrown TypeError, never a silent return.
//   4. NO DRIFT — the table names no cell the cube does not have.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cube from '../../../../khora/native/kernel/cube.js';
import { ACTS, land, landWith, coverage, STANDING, componentsOf, cyclesOf } from './identity-cube.mjs';
import { makeWorld } from './same.mjs';
import { newStore, admit, assertEdge } from './referents.mjs';
import { rng } from './correspond.mjs';

// ---- fixtures
const lens = { name: 'tier', attrs: ['tier'], giver: 'test' };
function dense() { // thirty invoices on the kind average, three vendors, two identical rush invoices a and b
  const nodes = [], links = [];
  for (let v = 0; v < 3; v++) nodes.push({ id: `v${v}`, kind: 'vendor', attrs: {} });
  for (let i = 0; i < 30; i++) { nodes.push({ id: `s${i}`, kind: 'invoice', attrs: { tier: 'std' } }); links.push({ a: `s${i}`, b: `v${i % 3}` }); }
  for (const id of ['a', 'b']) { nodes.push({ id, kind: 'invoice', attrs: { tier: 'rush' } }); links.push({ a: id, b: 'v0' }); }
  return makeWorld(nodes, links);
}
const flat = () => makeWorld([{ id: 'a', kind: 'n', attrs: { tier: 'x' } }, { id: 'b', kind: 'n', attrs: { tier: 'x' } }, { id: 'c', kind: 'n', attrs: { tier: 'x' } }], [{ a: 'a', b: 'c' }, { a: 'b', b: 'c' }]);
const lone = () => makeWorld([{ id: 'a', kind: 'n', attrs: { tier: 'x' } }], []);
function theseus() { const s = newStore(); const O = admit(s, 'original'), R = admit(s, 'reassembled'), P = admit(s, 'repaired'); assertEdge(s, { holder: 'shipyard-registry', lens: 'material', a: O, b: R }); assertEdge(s, { holder: 'maintenance-log', lens: 'continuity', a: O, b: P }); return { s, O, R, P }; }
function randomGraph(n, m, seed) {
  const r = rng(seed); const labs = ['nsubj', 'obj', 'nmod', 'amod']; const E = new Map(labs.map((l) => [l, new Map()]));
  for (let i = 0; i < m; i++) { const h = Math.floor(r() * n), d = Math.floor(r() * n); if (h === d) continue; const lab = labs[Math.floor(r() * labs.length)]; const k = h * 1e6 + d; E.get(lab).set(k, (E.get(lab).get(k) || 0) + 1 + Math.floor(r() * 3)); }
  const edges = new Map([...E].map(([lab, mm]) => [lab, [...mm].map(([k, w]) => [Math.floor(k / 1e6), k % 1e6, w])]));
  const freq = Array.from({ length: n }, () => 1 + Math.floor(r() * 20));
  return { keys: Array.from({ length: n }, (_, i) => 'n' + i), freq, tokens: freq.reduce((a, b) => a + b, 0), n, edges };
}
const emptyGraph = { keys: ['x'], freq: [1], tokens: 1, n: 1, edges: new Map() };
const sentences = [[['a|NOUN', 'NOUN', 2, 'nsubj'], ['b|VERB', 'VERB', 0, 'root'], ['c|NOUN', 'NOUN', 2, 'obj']], [['c|NOUN', 'NOUN', 2, 'nsubj'], ['d|VERB', 'VERB', 0, 'root'], ['a|NOUN', 'NOUN', 2, 'obj']]];
const triangle = { 'A-B': [{ a: 'x', b: 'y' }, { a: 'p', b: 'q' }], 'B-C': [{ a: 'y', b: 'z' }, { a: 'q', b: 'r' }], 'A-C': [{ a: 'x', b: 'z' }, { a: 'p', b: 'w' }] }; // x closes, p does not
const noTriangle = { 'A-B': [{ a: 'x', b: 'y' }] };
const G = { 'Powhatan Confederacy': ['Powhatan', 'Virginia'], Jamestown: ['Virginia', 'Powhatan'], Virginia: ['Jamestown'], 'Labour Party': ['United Kingdom'], Mezzotint: ['Engraving'] };
const neighbors = (x) => G[x] ?? [];
const pool = [{ id: 'explorer', nodes: ['Jamestown', 'Pocahontas', 'Virginia Company'], record: {} }, { id: 'labour', nodes: ['Labour Party', 'Monklands East'], record: {} }, { id: 'engraver', nodes: ['Mezzotint', 'London'], record: {} }];
const frameSpec = { organs: { fold: 'dmd' }, givers: { lens: 'test' }, numbers: { R: 30 } };
const planted = () => { const g = randomGraph(40, 140, 3); return g; };

// one positive input and one gap input per cell; the gap must be one the cell OWES
const FIXTURES = {
  'NUL·Ground': { positive: () => ({ world: dense(), lens }), gap: () => ({ world: flat(), lens }) },
  'NUL·Figure': { positive: () => ({ id: 'a', world: dense(), lens }), gap: () => ({ id: 'a', world: lone(), lens }) },
  'NUL·Pattern': { positive: () => { const w = dense(); const s = newStore(); admit(s, 'a'); return { store: s, lens, member: 'a', world: w, null: 0.001 }; }, gap: () => { const w = dense(); const s = newStore(); return { store: s, lens, member: 's0', world: w, null: 0.001 }; } },
  'SIG·Ground': { positive: () => ({ verdict: { verdict: 'unsupported' } }), gap: () => ({ verdict: null }) },
  'SIG·Figure': { positive: () => ({ mention: { nodes: ['Powhatan Confederacy'] }, candidates: pool, neighbors, lens: { name: 'which', giver: 'test' } }), gap: () => ({ mention: { nodes: ['Powhatan Confederacy'] }, candidates: [], neighbors, lens }) },
  'SIG·Pattern': { positive: () => ({ pairsByLang: triangle, controlAdmitted: 0 }), gap: () => ({ pairsByLang: triangle, controlAdmitted: 3 }) },
  'INS·Ground': { positive: () => ({ sentences }), gap: () => ({ sentences: [] }) },
  'INS·Figure': { positive: () => ({ store: newStore(), surface: 'Invoice 7', address: 'doc@120-131' }), gap: () => ({ store: newStore(), surface: 'Invoice 7' }) },
  'INS·Pattern': { positive: () => ({ gA: planted(), gB: planted(), draws: 100, quantile: 0.99 }), gap: () => ({ gA: planted(), gB: planted(), draws: 30, quantile: 0.99 }) },
  'SEG·Ground': { positive: () => ({ units: 31, expected: 31, anchors: [[0, 10]] }), gap: () => ({ units: 24, expected: 31, anchors: [[0, 10]] }) },
  'SEG·Figure': { positive: () => ({ a: 'a', b: 's0', world: dense(), lens }), gap: () => ({ a: 'a', b: 'zzz', world: dense(), lens }) },
  'SEG·Pattern': { positive: () => ({ store: theseus().s, lenses: ['material', 'continuity'] }), gap: () => ({ store: theseus().s, lenses: ['material'] }) },
  'CON·Ground': { positive: () => { const { s, O, R } = theseus(); return { store: s, edge: { holder: 'h', lens: 'L', a: O, b: R } }; }, gap: () => { const s = newStore(); const a = admit(s, 'x'); return { store: s, edge: { holder: 'h', lens: 'L', a, b: a } }; } },
  'CON·Figure': { positive: () => ({ result: { confirmed: [[1, 2, 0.9]] }, a: 1, b: 2 }), gap: () => ({ result: { confirmed: [] }, a: 1, b: 2 }) },
  'CON·Pattern': { positive: () => ({ pairsByLang: triangle }), gap: () => ({ pairsByLang: noTriangle }) },
  'SYN·Ground': { positive: () => ({ pairsByLang: triangle }), gap: () => ({ pairsByLang: {} }) },
  'SYN·Figure': { positive: () => ({ a: 'a', b: 'b', world: dense(), lens, fold: 'cumulative' }), gap: () => ({ a: 'a', b: 's0', world: dense(), lens }) },
  'SYN·Pattern': { positive: () => ({ graph: planted() }), gap: () => ({ graph: emptyGraph }) },
  'DEF·Ground': { positive: () => ({ lens, ...frameSpec }), gap: () => ({ ...frameSpec }) },
  'DEF·Figure': { positive: () => ({ graph: planted(), noise: 0, seed: 7 }), gap: () => ({ graph: null }) },
  'DEF·Pattern': { positive: () => ({ pairsByLang: triangle }), gap: () => ({ pairsByLang: noTriangle }) },
  'EVA·Ground': { positive: () => ({ worldsByCell: { literature: dense(), law: flat() }, lens }), gap: () => ({ worldsByCell: {}, lens }) },
  'EVA·Figure': { positive: () => ({ a: 'a', b: 's0', world: dense(), lens }), gap: () => ({ a: 'a', b: 'b', world: dense(), lens }) },
  'EVA·Pattern': { positive: () => ({ foundBy: { positional: true, relational: true } }), gap: () => ({ foundBy: { positional: true }, frames: [{ frame: 'frame:1', id: 'frame:1' }, { frame: 'frame:2', id: 'frame:2' }] }) },
  'REC·Ground': { positive: () => ({ world: flat(), lens }), gap: () => ({ world: dense(), lens }) },
  'REC·Figure': { positive: () => ({ history: [{ id: 'run4' }], entry: { id: 'run4b', supersedes: 'run4' } }), gap: () => ({ history: [{ id: 'run4' }], entry: { id: 'run4' } }) },
  'REC·Pattern': { positive: () => ({ frame: { id: 'frame:old' }, finding: { contradictsDeclaredSpace: true }, next: frameSpec }), gap: () => ({ frame: { id: 'frame:old' }, finding: { contradictsDeclaredSpace: false } }) },
};

test('generated: the census covers exactly the cube\'s 27 cells, in the cube\'s order, with no drift', () => {
  const cells = cube.algebraAddresses().map((c) => `${c.op}·${c.grain}`);
  assert.equal(cells.length, 27);
  assert.deepEqual(coverage().map((c) => c.cell), cells);
  assert.deepEqual(Object.keys(ACTS).filter((k) => !cells.includes(k)), [], 'an act at a cell the cube does not have');
  assert.deepEqual(cells.filter((k) => !ACTS[k]), [], 'a cell with no identity act');
  assert.deepEqual(Object.keys(FIXTURES).filter((k) => !cells.includes(k)), []);
  assert.deepEqual(cells.filter((k) => !FIXTURES[k]), [], 'a cell this test does not exercise');
});

for (const cell of cube.algebraAddresses().map((c) => `${c.op}·${c.grain}`)) {
  test(`${cell}: the act lands a positive, and on another input one of the nulls the cell owes`, async () => {
    const owed = STANDING.interrogate(...cell.split('·')).nulls;
    const p = await land(cell, FIXTURES[cell].positive());
    assert.equal(p.positive, true, `${cell} positive: ${JSON.stringify(p).slice(0, 200)}`);
    assert.equal(p.cell, cell);
    const g = await land(cell, FIXTURES[cell].gap());
    assert.ok(g.gap, `${cell} should gap: ${JSON.stringify(g).slice(0, 200)}`);
    assert.ok(owed.includes(g.gap), `${cell}: ${g.gap} is not an owed null (${owed.join(', ')})`);
  });
}

test('a gap name the cell does not owe is a thrown TypeError, never a silent return', async () => {
  const bad = { 'NUL·Ground': { act: 'bad', run: () => ({ cell: 'NUL·Ground', gap: 'made_up' }) } };
  await assert.rejects(() => landWith(bad, 'NUL·Ground', {}), TypeError);
  assert.equal((await landWith(bad, 'SIG·Figure', {})).gap, 'uncensused_cell');
});

test('an unknown cell is the cube\'s own typed gap', async () => {
  const r = await land('ALT·Figure', {});
  assert.equal(r.gap, 'unknown_spec');
});

test('helpers: components and cycles read a triangle', () => {
  assert.equal(componentsOf(triangle).length, 2);                 // {x,y,z} and {p,q,r,w}: p's direct partner w joins p's component
  assert.deepEqual(cyclesOf(triangle), { checkable: 5, consistent: 3, expected: 1.5 });   // three ordered triples (A,B,C), (A,C,B), (B,A,C): x closes in all three, p/q fails twice and is unpaired once; chance 0.5 + 0.5 + 0.5
});
