import test from 'node:test';
import assert from 'node:assert/strict';
import { appendReasoning, reasoningAt, reasoningRound } from './reasoning-spiral.js';

const A = { kind: 'propose', id: 'a', forWhom: 'Reader', relation: { subject: 'Pierre', verb: 'met', object: 'Natasha' }, witnesses: ['novel#10-35'] };
const B = { kind: 'propose', id: 'b', forWhom: 'Reader', relation: { subject: 'Pierre', verb: 'knows', object: 'Natasha' }, premises: ['a'] };
const confirm = (id, override = {}) => ({ kind: 'assess', id, verdict: 'supported', method: 'deduction', by: 'deterministic premise test', basis: 'licensed consequence of evidence', license: 'rule:r1', ...override });
const chain = () => {
  let log = [];
  for (const e of [A, confirm('a', { method: 'testimony', witnesses: ['novel#10-35'] }), B, confirm('b')]) log = appendReasoning(log, e);
  return log;
};
const get = (log, id, asOf) => reasoningAt(log, { asOf }).claims.find((x) => x.id === id);

test('admitted source witness plus named test licenses a supporting premise', () => {
  const l = chain();
  assert.equal(get(l, 'a').standing, 'supported');
  assert.equal(get(l, 'b').standing, 'supported');
  assert.equal(reasoningAt(l).refused.length, 0);
});

test('withdrawal suspends every dependent claim, preserving the historical projection', () => {
  const l = chain();
  const next = appendReasoning(l, { kind: 'withdraw', id: 'a', basis: 'independent contradictory text#40-60' });
  assert.equal(get(next, 'a').standing, 'withdrawn');
  assert.equal(get(next, 'b').standing, 'suspended');
  assert.equal(get(next, 'b', l.length).standing, 'supported');
  assert.equal(l.length, 4);
});

test('restoring a revised premise does NOT silently reactivate stale reasoning', () => {
  let l = appendReasoning(chain(), { kind: 'reopen', id: 'a', basis: 'new source requires reconsideration' });
  assert.equal(get(l, 'b').standing, 'suspended');
  l = appendReasoning(l, confirm('a', { method: 'testimony', witnesses: ['novel#10-35'] }));
  assert.equal(get(l, 'a').standing, 'supported');
  assert.equal(get(l, 'b').standing, 'stale');
  l = appendReasoning(l, confirm('b', { basis: 'retested after a changed ground' }));
  assert.equal(get(l, 'b').standing, 'supported');
});

test('source-free, unlicensed deductions and unsupported premises are rejected', () => {
  let l = appendReasoning([], { ...A, witnesses: [] });
  l = appendReasoning(l, confirm('a'));
  l = appendReasoning(l, B);
  l = appendReasoning(l, confirm('b'));
  const p = reasoningAt(l);
  assert.equal(get(l, 'a').standing, 'unlicensed');
  assert.equal(get(l, 'b').standing, 'candidate');
  assert.deepEqual(p.refused.map((x) => x.why), ['low_gate_failed', 'premise_not_supported']);
});

test('unnamed rule cannot license a deduction even if its premises are supported', () => {
  let l = chain().slice(0, 3);
  l = appendReasoning(l, confirm('b', { license: '' }));
  assert.equal(get(l, 'b').standing, 'candidate');
  assert.equal(reasoningAt(l).refused.at(-1).why, 'deduction_without_named_license');
});

test('self-reference, missing sources and cycles cannot settle', () => {
  let l = appendReasoning([], { ...A, id: 's', premises: ['s'] });
  l = appendReasoning(l, confirm('s'));
  l = appendReasoning(l, { ...B, id: 'x', premises: ['y'] });
  l = appendReasoning(l, { ...B, id: 'y', premises: ['x'] });
  l = appendReasoning(l, confirm('x'));
  assert.equal(get(l, 's').standing, 'unlicensed');
  assert.equal(get(l, 'x').standing, 'candidate');
  assert.equal(reasoningAt(l).refused.at(-1).why, 'premise_not_supported');
});

test('a model assertion with no test is a candidate, not settled evidence', async () => {
  const r = await reasoningRound([], [{ ...A, witnesses: ['novel#10-35'] }]);
  assert.equal(r.fold.claims[0].standing, 'candidate');
  assert.equal(r.fold.openings.length, 1);
  assert.equal(r.log.length, 1);
});

test('falsifying instruments can report refutation; derived claims remain non-facts', async () => {
  const r = await reasoningRound([], [A], { assess: async () => ({ verdict: 'refuted', method: 'perturbation', by: 'counterexample test', basis: 'sibling swap defeats implication', witnesses: ['novel#10-35'] }) });
  assert.equal(r.fold.claims[0].standing, 'refuted');
  assert.equal(r.fold.events, 2);
});

test('append-only log is immutable even if the caller later mutates a proposal', () => {
  const original = { ...A, relation: { ...A.relation }, witnesses: [...A.witnesses] };
  const l = appendReasoning([], original);
  original.relation.subject = 'Mallory';
  original.witnesses.push('/etc/passwd#0-1');
  assert.equal(l[0].relation.subject, 'Pierre');
  assert.deepEqual(l[0].witnesses, ['novel#10-35']);
});
