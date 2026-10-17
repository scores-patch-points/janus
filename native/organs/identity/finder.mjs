// finder.mjs — the discrepancy finder.
//
// Compares two accounts slot by slot and returns a verdict with both sides'
// addresses and the named source of any conviction. Nothing is built in: every
// identity key, lift, or interpretation is declared by a giver, or refused.

import { parseNumber, parseDate } from '../../../../khora/native/organs/identity-parsers.js';

// An account is a reading of one document:
//   { name, source, slots: { path: { terrain, value, address } } }
// `address` is the permanent address (line/byte) on the source.

function slot(account, path) { return account?.slots?.[path]; }
function value(account, path) { return slot(account, path)?.value; }
function address(account, path) { return slot(account, path)?.address ?? '(no address)'; }

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const r = parseNumber(v); return r.ok ? r.value : null; }
  return null;
}

const DATE_RE = /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/;

// Two-account, slot-by-slot comparison.
export function findDiscrepancies(A, B, { giver = null, identityKeys = [], lifts = [] } = {}) {
  // Sameness must be claimed, not assumed from shared structure.
  if (!identityKeys.length) {
    return [{ kind: 'refused', reason: 'no identity keys declared — shared structure is not sameness', giver }];
  }
  const agrees = identityKeys.every((k) => {
    const a = value(A, k), b = value(B, k);
    return a !== undefined && b !== undefined && String(a) === String(b);
  });
  if (!agrees) {
    return [{ kind: 'different-things', reason: 'identity keys differ — two things, not two readings of one', giver }];
  }

  // Named lifts materialise a derived slot (parts → total).
  const lifted = new Map();
  for (const L of lifts) {
    const parts = L.of.map((p) => value(A, p)).filter((v) => v !== undefined);
    if (L.op === 'sum') {
      const nums = parts.map(toNumber);
      if (nums.every((n) => n !== null)) lifted.set(L.to, { value: nums.reduce((x, y) => x + y, 0), of: L.of, giver: L.giver });
    } else if (L.op === 'count') {
      lifted.set(L.to, { value: parts.length, of: L.of, giver: L.giver });
    }
  }

  const paths = [...new Set([...Object.keys(A.slots), ...Object.keys(B.slots)])];
  return paths.map((path) => {
    const ta = A.slots[path]?.terrain;
    const tb = B.slots[path]?.terrain;
    if (ta && tb && ta !== tb && !lifted.has(path)) {
      return { slot: path, kind: 'refused', reason: `different terrains (${ta} vs ${tb}) — no lift declared`, addressA: address(A, path), addressB: address(B, path), giver };
    }
    const derived = lifted.get(path);
    const a = derived ? derived.value : value(A, path);
    const b = derived ? derived.value : value(B, path);
    return compare(path, a, b, A, B, { giver, derived });
  });
}

// Bring parts up to a total and check the total against them (one account).
export function checkLift(account, { op, of, to, giver = null }) {
  const parts = of.map((p) => slot(account, p)).filter(Boolean);
  const missing = of.filter((p) => !slot(account, p));
  let computed = null;
  if (op === 'sum') {
    const nums = parts.map((p) => toNumber(p.value));
    if (nums.every((n) => n !== null)) computed = nums.reduce((x, y) => x + y, 0);
  } else if (op === 'count') {
    computed = parts.length;
  }
  const stated = slot(account, to);
  if (!stated) return { op, to, kind: 'missing', reason: `no stated value at "${to}"`, giver };
  if (computed === null) return { op, to, kind: 'refused', reason: `could not parse ${op} parts`, giver, of };
  const statedNum = toNumber(stated.value);
  const ok = statedNum !== null && statedNum === computed;
  return {
    op, to,
    kind: ok ? 'bound' : 'contradiction',
    stated: stated.value, statedAddress: stated.address,
    computed,
    of: of.map((p) => ({ path: p, value: slot(account, p)?.value, address: slot(account, p)?.address })),
    missing,
    giver,
  };
}

function compare(path, a, b, A, B, { giver, derived }) {
  const addressA = address(A, path), addressB = address(B, path);
  if (a === undefined || b === undefined) {
    return { slot: path, kind: 'missing', a, b, addressA, addressB, giver };
  }
  const aStr = String(a), bStr = String(b);
  if (DATE_RE.test(aStr) || DATE_RE.test(bStr)) {
    const da = parseDate(aStr, giver);
    const db = parseDate(bStr, giver);
    if (!da.ok || !db.ok) {
      return { slot: path, kind: 'refused', reason: `date parser refused: ${!da.ok ? da.refused : db.refused}`, a, b, addressA, addressB, giver };
    }
    const same = da.value.year === db.value.year && da.value.month === db.value.month && da.value.day === db.value.day;
    return { slot: path, kind: same ? 'same' : 'different', valueA: da.value, valueB: db.value, a, b, addressA, addressB, giver, derived: derived ? derived : undefined };
  }
  const na = toNumber(a), nb = toNumber(b);
  if (na !== null && nb !== null) {
    const same = na === nb;
    return { slot: path, kind: same ? 'same' : 'different', valueA: na, valueB: nb, a, b, addressA, addressB, giver, derived: derived ? derived : undefined };
  }
  const same = aStr === bStr;
  return { slot: path, kind: same ? 'same' : 'different', a, b, addressA, addressB, giver, derived: derived ? derived : undefined };
}
