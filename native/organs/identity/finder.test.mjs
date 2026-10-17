import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDiscrepancies, checkLift } from './finder.mjs';

test('finding 1 — shared structure is not sameness', () => {
  const A = {
    name: 'invoice-A',
    slots: {
      'invoice.no': { terrain: 'key', value: 'INV-001', address: 'a:1' },
      amount: { terrain: 'amount', value: '1200', address: 'a:2' },
    },
  };
  const B = {
    name: 'invoice-B',
    slots: {
      'invoice.no': { terrain: 'key', value: 'INV-002', address: 'b:1' },
      amount: { terrain: 'amount', value: '1200', address: 'b:2' },
    },
  };

  // no identity keys → refused, never assumed from a shared template
  assert.equal(findDiscrepancies(A, B, {})[0].kind, 'refused');

  // identity key differs → different things, NOT a contradiction
  assert.equal(findDiscrepancies(A, B, { identityKeys: ['invoice.no'], giver: 'ledger' })[0].kind, 'different-things');

  // same identity key → the amount is now genuinely compared
  const C = {
    name: 'invoice-C',
    slots: {
      'invoice.no': { terrain: 'key', value: 'INV-001', address: 'c:1' },
      amount: { terrain: 'amount', value: '1300', address: 'c:2' },
    },
  };
  const r = findDiscrepancies(A, C, { identityKeys: ['invoice.no'], giver: 'ledger' });
  const amt = r.find((v) => v.slot === 'amount');
  assert.equal(amt.kind, 'different');
  assert.equal(amt.valueA, 1200);
  assert.equal(amt.valueB, 1300);
});

test('finding 2 — a named lift brings parts up to the total and cites them', () => {
  const account = {
    name: 'ledger',
    slots: {
      total: { terrain: 'total', value: '12400', address: 't:1' },
      'line.1': { terrain: 'line', value: '5000', address: 'l:1' },
      'line.2': { terrain: 'line', value: '6100', address: 'l:2' },
    },
  };
  // 5000 + 6100 = 11100 ≠ 12400 → contradiction, citing the lines
  const r = checkLift(account, { op: 'sum', of: ['line.1', 'line.2'], to: 'total', giver: 'accountant' });
  assert.equal(r.kind, 'contradiction');
  assert.equal(r.stated, '12400');
  assert.equal(r.computed, 11100);
  assert.deepEqual(r.of.map((x) => x.path), ['line.1', 'line.2']);
  assert.equal(r.giver, 'accountant');
});

test('finding 2b — different terrains are refused unless a lift binds them', () => {
  const A = {
    name: 'A',
    slots: {
      'invoice.no': { terrain: 'key', value: 'INV-1', address: 'a:1' },
      amount: { terrain: 'total', value: '12400', address: 'a:2' },
    },
  };
  const B = {
    name: 'B',
    slots: {
      'invoice.no': { terrain: 'key', value: 'INV-1', address: 'b:1' },
      amount: { terrain: 'line', value: '6100', address: 'b:2' },
    },
  };
  const r = findDiscrepancies(A, B, { identityKeys: ['invoice.no'], giver: 'auditor' });
  const amt = r.find((v) => v.slot === 'amount');
  assert.equal(amt.kind, 'refused');
  assert.match(amt.reason, /different terrains/);
});

test('finding 4 — the finder refuses, never convicts, on an ambiguous parse', () => {
  const A = {
    name: 'A',
    slots: {
      id: { terrain: 'key', value: '1', address: 'a:1' },
      issued: { terrain: 'date', value: '1/17/25', address: 'a:2' },
    },
  };
  const B = {
    name: 'B',
    slots: {
      id: { terrain: 'key', value: '1', address: 'b:1' },
      issued: { terrain: 'date', value: '1/17/2024', address: 'b:2' },
    },
  };
  const r = findDiscrepancies(A, B, { identityKeys: ['id'], giver: { name: 'auditor' } });
  const issued = r.find((v) => v.slot === 'issued');
  assert.equal(issued.kind, 'refused');
  assert.match(issued.reason, /2-digit year/);
});
