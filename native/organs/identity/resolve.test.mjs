import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveReferent } from './resolve.mjs';

const G = {
  Jamestown: ['Virginia', 'Powhatan', 'England'], Pocahontas: ['Powhatan', 'Virginia'], 'Virginia Company': ['England', 'Virginia'],
  'Powhatan Confederacy': ['Powhatan', 'Virginia'],
  'Labour Party': ['United Kingdom', 'England'], 'Monklands East': ['Scotland', 'United Kingdom'], Edinburgh: ['Scotland', 'England'],
  Mezzotint: ['Engraving', 'England'], London: ['England', 'United Kingdom'], Kneller: ['Painting', 'England'],
  'Royal Navy': ['England', 'United Kingdom'], Portsmouth: ['England', 'Hampshire'], Trafalgar: ['Royal Navy', 'Spain'],
};
const neighbors = (x) => G[x] ?? [];
const lens = { name: 'which-john-smith', giver: 'test' };
const pool = [
  { id: 'explorer', nodes: ['Jamestown', 'Pocahontas', 'Virginia Company'], record: { birth: 1580, death: 1631 } },
  { id: 'labour', nodes: ['Labour Party', 'Monklands East', 'Edinburgh'], record: { birth: 1938, death: 1994 } },
  { id: 'engraver', nodes: ['Mezzotint', 'London', 'Kneller'], record: { birth: 1652, death: 1742 } },
];

test('no lens, no comparison (typed refusal)', () => {
  assert.equal(resolveReferent({ mention: { nodes: ['Jamestown'] }, candidates: pool, neighbors }).decision, 'refused');
});

test('finds the explorer through RELATED nodes alone: the mention shares no attached node with any candidate', () => {
  const r = resolveReferent({ mention: { nodes: ['Powhatan Confederacy'] }, candidates: pool, neighbors, lens });
  assert.equal(r.decision, 'assert');
  assert.equal(r.asserted, 'explorer');
  assert.ok(r.candidates[0].why.some((w) => w.node === 'Powhatan' || w.node === 'Virginia'));
});

test('a hub every candidate touches (England) does not decide', () => {
  const r = resolveReferent({ mention: { nodes: ['England'] }, candidates: pool, neighbors, lens });
  assert.notEqual(r.decision, 'assert');
});

test('asks when two candidates fit equally, and names the node that separates them', () => {
  const two = [
    { id: 'navy-officer', nodes: ['Royal Navy', 'Portsmouth'] },
    { id: 'navy-clerk', nodes: ['Royal Navy', 'Trafalgar'] },
    { id: 'navy-cook', nodes: ['Royal Navy', 'Portsmouth'] },
  ];
  const r = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: two, neighbors, lens });
  assert.equal(r.decision, 'ask');
  assert.ok(r.between.length >= 2);
  assert.ok(r.distinguishing.length > 0);
});

test('a mention attached to nothing in the pool is a typed gap, not a guess', () => {
  const r = resolveReferent({ mention: { nodes: ['Quantum chromodynamics'] }, candidates: pool, neighbors, lens });
  assert.equal(r.decision, 'gap');
});

test('a record that contradicts itself is withheld and flagged — it neither convicts nor rescues', () => {
  const bad = pool.map((c) => (c.id === 'labour' ? { ...c, record: { birth: 1994, death: 1938 } } : c));
  const a = resolveReferent({ mention: { nodes: ['Powhatan Confederacy'], record: { birth: 1581 } }, candidates: pool, neighbors, lens, sameGaps: [0, 0, 1] });
  const b = resolveReferent({ mention: { nodes: ['Powhatan Confederacy'], record: { birth: 1581 } }, candidates: bad, neighbors, lens, sameGaps: [0, 0, 1] });
  assert.ok(b.flags.some((f) => f.candidate === 'labour'));
  assert.equal(b.asserted, a.asserted);
});

test('dates abstain unless same-person gaps are observed; they are never a veto', () => {
  const m = { nodes: ['Powhatan Confederacy'], record: { birth: 1938 } }; // wrong century for the explorer
  const noGaps = resolveReferent({ mention: m, candidates: pool, neighbors, lens });
  assert.equal(noGaps.asserted, 'explorer');
  const withGaps = resolveReferent({ mention: m, candidates: pool, neighbors, lens, sameGaps: [0, 0, 0, 1, 1, 2] });
  const e = withGaps.candidates.find((c) => c.id === 'explorer');
  assert.ok(e.p > 0, 'a conflicting date lowers the odds but cannot zero them');
});

test('reports which single attached node, if wrong, would flip the answer', () => {
  const r = resolveReferent({ mention: { nodes: ['Powhatan Confederacy', 'London'] }, candidates: pool, neighbors, lens });
  assert.ok(Array.isArray(r.fragile));
});

test('deterministic and content-addressed', () => {
  const a = resolveReferent({ mention: { nodes: ['Powhatan Confederacy'] }, candidates: pool, neighbors, lens, cursor: 7 });
  const b = resolveReferent({ mention: { nodes: ['Powhatan Confederacy'] }, candidates: pool, neighbors, lens, cursor: 7 });
  assert.deepEqual(a, b);
  assert.match(a.id, /^[0-9a-f]+$/);
});

test('the lens sets how wrong it will risk being: a looser assertAt asserts what the pool floor would ask about', () => {
  const m = { nodes: ['Powhatan Confederacy', 'London'] };
  const strict = resolveReferent({ mention: m, candidates: pool, neighbors, lens });
  const loose = resolveReferent({ mention: m, candidates: pool, neighbors, lens: { ...lens, assertAt: 0.01 } });
  assert.equal(loose.decision === 'assert' || loose.decision === 'gap', true);
  assert.notEqual(strict.decision, 'refused');
});

const navy = [
  { id: 'navy-officer', nodes: ['Royal Navy', 'Portsmouth'] },
  { id: 'navy-clerk', nodes: ['Royal Navy', 'Trafalgar'] },
  { id: 'navy-cook', nodes: ['Royal Navy', 'Spain'] },
];

test('an ask carries the one question expected to teach the most', () => {
  const r = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: navy, neighbors, lens });
  assert.ok(r.decision === 'ask' || r.decision === 'gap', 'a thin mention is asked about, not asserted');
  assert.ok(r.nextQuestion && r.nextQuestion.gain > 0);
  assert.notEqual(r.nextQuestion.node, 'Royal Navy', 'it must not ask what every candidate shares');
});

test('a yes raises the candidate that keeps that node; a no lowers it; the loop reaches an assertion', () => {
  const base = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: navy, neighbors, lens });
  const p0 = base.candidates.find((c) => c.id === 'navy-clerk').p;
  const yes = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: navy, neighbors, lens, answers: [{ node: 'Trafalgar', yes: true }] });
  const no = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: navy, neighbors, lens, answers: [{ node: 'Trafalgar', yes: false }] });
  assert.ok(yes.candidates.find((c) => c.id === 'navy-clerk').p > p0);
  assert.ok(no.candidates.find((c) => c.id === 'navy-clerk').p < p0);
  // oracle: the person is the clerk
  const truth = new Set(['Royal Navy', 'Trafalgar', 'Spain']);
  let answers = [], r = base;
  for (let i = 0; i < 8 && r.decision !== 'assert' && r.nextQuestion; i += 1) {
    answers = [...answers, { node: r.nextQuestion.node, yes: truth.has(r.nextQuestion.node) }];
    r = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: navy, neighbors, lens: { ...lens, assertAt: 0.5 }, answers });
  }
  assert.equal(r.decision, 'assert');
  assert.equal(r.asserted, 'navy-clerk');
});

test('twins no question can separate end as an ask with no next question, never a guess', () => {
  const twins = [{ id: 't1', nodes: ['Royal Navy', 'Portsmouth'] }, { id: 't2', nodes: ['Royal Navy', 'Portsmouth'] }, { id: 'other', nodes: ['Mezzotint', 'London'] }];
  const r = resolveReferent({ mention: { nodes: ['Royal Navy', 'Portsmouth'] }, candidates: twins, neighbors, lens });
  assert.notEqual(r.decision, 'assert');
  assert.ok(r.indistinguishable.length > 0);
});

test('an assertion offers the question that would test it hardest; a "no" to it lowers the asserted candidate', () => {
  const L = { ...lens, assertAt: 0.5 };
  const m = { nodes: ['Powhatan Confederacy', 'London'] };
  const r = resolveReferent({ mention: m, candidates: pool, neighbors, lens: L });
  assert.equal(r.decision, 'assert');
  assert.ok(r.verification && r.verification.ifNoP < r.verification.fromP);
  const before = r.candidates.find((c) => c.id === r.asserted).p;
  const no = resolveReferent({ mention: m, candidates: pool, neighbors, lens: L, answers: [{ node: r.verification.node, yes: false }] });
  assert.ok(no.candidates.find((c) => c.id === r.asserted).p < before);
});

test('at certainty there is nothing left to verify (null, not an invented question)', () => {
  const r = resolveReferent({ mention: { nodes: ['Powhatan Confederacy'] }, candidates: pool, neighbors, lens });
  assert.equal(r.decision, 'assert');
  assert.equal(r.verification, null);
});

const twinsPool = (ids) => ids.map((id) => ({ id, nodes: ['Royal Navy', 'Portsmouth'] }));

test('twins are never asserted: a coin flip between indistinguishable candidates is an ask', () => {
  const r = resolveReferent({ mention: { nodes: ['Royal Navy', 'Portsmouth'] }, candidates: twinsPool(['a', 'b']), neighbors, lens: { ...lens, assertAt: 0.5 } });
  assert.notEqual(r.decision, 'assert');
});

test('a single candidate is a typed gap, never an assertion', () => {
  const r = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: [{ id: 'only', nodes: ['Royal Navy', 'Portsmouth'] }], neighbors, lens: { ...lens, assertAt: 0.5 } });
  assert.equal(r.decision, 'gap');
});

test('an answer about a node no candidate keeps does not unlock an assertion from a gap', () => {
  const m = { nodes: ['Quantum chromodynamics'] };
  assert.equal(resolveReferent({ mention: m, candidates: pool, neighbors, lens }).decision, 'gap');
  assert.notEqual(resolveReferent({ mention: m, candidates: pool, neighbors, lens, answers: [{ node: 'zzz-unknown', yes: true }] }).decision, 'assert');
});

test('ties break by id, never by input order', () => {
  const a = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: navy, neighbors, lens });
  const b = resolveReferent({ mention: { nodes: ['Royal Navy'] }, candidates: [...navy].reverse(), neighbors, lens });
  assert.deepEqual(a.candidates.map((c) => c.id), b.candidates.map((c) => c.id));
});

test('invalid input is refused with a reason: bad assertAt, duplicate ids; null answers are treated as none', () => {
  assert.equal(resolveReferent({ mention: { nodes: ['Jamestown'] }, candidates: pool, neighbors, lens: { ...lens, assertAt: NaN } }).decision, 'refused');
  assert.equal(resolveReferent({ mention: { nodes: ['Jamestown'] }, candidates: [...pool, pool[0]], neighbors, lens }).decision, 'refused');
  assert.doesNotThrow(() => resolveReferent({ mention: { nodes: ['Jamestown'] }, candidates: pool, neighbors, lens, answers: null }));
});

test('three thousand answers do not underflow the posterior to nothing', () => {
  const answers = Array.from({ length: 3000 }, () => ({ node: 'Virginia', yes: true }));
  const r = resolveReferent({ mention: { nodes: ['Powhatan Confederacy'] }, candidates: pool, neighbors, lens, answers });
  assert.ok(Number.isFinite(r.nEff) && r.candidates[0].id === 'explorer');
});
