// pair-diff: the alignment of lib.mjs diff() (the diff-first experiment), without any licence, refusal, addressing
// or order verdict. The comparison with lib.mjs runs when the ledger is on this machine ($PAIR_DIFF_LIB overrides
// where); it is read, never changed. Real row lists come from the experiment's own rows.json next to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pairDiff, lcs, wordEvidenceOf, CONTENT } from './pair-diff.mjs';

const LIB = process.env.PAIR_DIFF_LIB ?? '/Users/mlacy/Documents/claude code/ledgers/paraphrase-100/exp/diff-first/src/lib.mjs';
const ROWS = path.join(path.dirname(LIB), '..', 'out', 'rows.json');
const skipLib = fs.existsSync(LIB) ? false : `lib.mjs not found at ${LIB}`;
const skipRows = fs.existsSync(LIB) && fs.existsSync(ROWS) ? false : `rows.json not found at ${ROWS}`;

// rows from [key, upos] pairs
const R = (...xs) => xs.map(([key, upos = 'NOUN'], k) => ({ s: 0, id: k + 1, form: key, lemma: key, upos, key }));
const noEv = () => { throw new Error('evidence asked'); };
const tagEv = (calls = []) => (x, y) => { calls.push(`${x}>${y}`); return { tag: `${x}>${y}` }; };

// what a holder of a licence would compute from the record alone: lib.mjs's order test and reasons
function judge(d, licensed) {
  const corr = [...d.anchors.map(([i, j, c]) => [i, j, c]), ...d.substitutions.filter(licensed).map((s) => [s.i, s.j, s.contentA])].sort((x, y) => x[0] - y[0]);
  const crossing = (ps) => ps.some((p, k) => k > 0 && p[1] < ps[k - 1][1]);
  const order = crossing(corr.filter((p) => p[2])), orderAll = crossing(corr);
  const unl = d.substitutions.some((s) => !licensed(s));
  const reasons = (o) => [d.orphans.length ? 'orphan' : null, unl ? 'unlicensed' : null, o ? 'order' : null].filter(Boolean);
  return { orderChanged: order, orderChangedAllRows: orderAll, reasons: reasons(order), reasonsAllRows: reasons(orderAll) };
}

test('identical readings: every row an anchor, no substitution, no orphan, share 1, no evidence asked', () => {
  const A = R(['she', 'PRON'], ['buy', 'VERB'], ['the', 'DET'], ['car']);
  const d = pairDiff(A, A, noEv);
  assert.deepEqual([d.share, d.lcs, d.nA, d.nB], [1, 4, 4, 4]);
  assert.deepEqual(d.anchors, [[0, 0, true], [1, 1, true], [2, 2, false], [3, 3, true]]);
  assert.deepEqual([d.substitutions, d.orphans], [[], []]);
});

test('a moved row is an anchor outside the LCS, not a substitution and not an orphan', () => {
  const A = R(['x'], ['y'], ['z']), B = R(['z'], ['x'], ['y']);
  const d = pairDiff(A, B, noEv);
  assert.equal(d.lcs, 2);
  assert.deepEqual(d.anchors, [[0, 1, true], [1, 2, true], [2, 0, true]]);
  assert.deepEqual([d.substitutions, d.orphans], [[], []]);
  assert.equal(d.share, 4 / 6);
  // falsifying: the moved row makes a descent, so a reader sees the order change from anchors alone
  assert.equal(judge(d, () => true).orderChanged, true);
});

test('a multi-row hunk pairs rows in order and leaves the rest as orphans; evidence asked both ways per pair', () => {
  const A = R(['a'], ['p', 'VERB'], ['q', 'DET'], ['r'], ['b']), B = R(['a'], ['s', 'ADJ'], ['t'], ['b'], ['u'], ['v']);
  const calls = [];
  const d = pairDiff(A, B, tagEv(calls));
  assert.deepEqual(d.substitutions.map((s) => [s.i, s.j, s.a, s.b, s.upos, s.contentA]), [[1, 1, 'p', 's', ['VERB', 'ADJ'], true], [2, 2, 'q', 't', ['DET', 'NOUN'], false]]);
  assert.deepEqual(d.substitutions[0].evidence, { ab: { tag: 'p>s' }, ba: { tag: 's>p' } });
  assert.deepEqual(calls, ['p>s', 's>p', 'q>t', 't>q']);
  assert.deepEqual(d.orphans, [{ side: 'a', i: 3, word: 'r', upos: 'NOUN' }, { side: 'b', j: 4, word: 'u', upos: 'NOUN' }, { side: 'b', j: 5, word: 'v', upos: 'NOUN' }]);
});

test('no verdict of any kind is in the record', () => {
  const d = pairDiff(R(['a'], ['b'], ['c']), R(['c'], ['d'], ['a']), tagEv());
  for (const k of ['licensed', 'reasons', 'orderChanged', 'addressed', 'verdict', 'same', 'refused', 'moved']) assert.equal(k in d, false, k);
  for (const s of d.substitutions) for (const k of ['licensed', 'detail', 'ok']) assert.equal(k in s, false, k);
});

test('wordEvidenceOf copies counts only, and n is the length of the sorted nulls', () => {
  const rec = { schema: 'WordEvidence@1', a: 'x', b: 'y', shared: 4, empty: false, sizes: [3, 3], null: { n: 3, mean: 1, p95: 2 }, nullCounts: [0, 1, 2] };
  const w = wordEvidenceOf(rec);
  assert.deepEqual(w, { shared: 4, empty: false, nulls: [0, 1, 2], n: 3 });
  w.nulls.push(9); assert.deepEqual(rec.nullCounts, [0, 1, 2]);
  assert.deepEqual(wordEvidenceOf({ shared: 0, empty: true, null: { n: 0 }, nullCounts: [] }), { shared: 0, empty: true, nulls: [], n: 0 });
});

test('lcs breaks ties by advancing A first', () => {
  assert.deepEqual(lcs(R(['a'], ['b']), R(['b'], ['a'])), [[1, 0]]);
});

// ---- against lib.mjs --------------------------------------------------------------------------------------------
const licenceOf = (x, y) => { let h = 7; for (const c of `${x}|${y}`) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 3 !== 0; };
const symLicence = (x, y) => licenceOf(x, y) && licenceOf(y, x);
function compareWithLib(L, A, B, label) {
  const want = L.diff(A, B, { covered: (x, y) => ({ ok: symLicence(x, y), detail: null }) });
  const got = pairDiff(A, B, (x, y) => ({ x, y }));
  assert.deepEqual([got.share, got.lcs, got.nA, got.nB], [want.share, want.lcs, want.nA, want.nB], label);
  const matched = L.lcs(A, B);
  assert.deepEqual(got.anchors.slice(0, got.lcs).map(([i, j]) => [i, j]), matched, label);
  assert.deepEqual(got.anchors.slice(got.lcs).map(([i, j]) => ({ word: A[i].key, upos: A[i].upos, i, j })), want.moved, label);
  for (const [i, , c] of got.anchors) assert.equal(c, L.CONTENT.has(A[i].upos), label);
  assert.deepEqual(got.substitutions.map(({ i, j, a, b, upos }) => ({ i, j, a, b, upos })), want.substituted.map(({ i, j, a, b, upos }) => ({ i, j, a, b, upos })), label);
  for (const s of got.substitutions) assert.deepEqual(s.evidence, { ab: { x: s.a, y: s.b }, ba: { x: s.b, y: s.a } }, label);
  assert.deepEqual(got.orphans, want.orphans, label);
  const j = judge(got, (s) => symLicence(s.a, s.b));
  assert.deepEqual(j, { orderChanged: want.orderChanged, orderChangedAllRows: want.orderChangedAllRows, reasons: want.reasons, reasonsAllRows: want.reasonsAllRows }, label);
  return want;
}

test('the CONTENT set is lib.mjs\'s', { skip: skipLib }, async () => {
  const L = await import(LIB);
  assert.deepEqual([...CONTENT].sort(), [...L.CONTENT].sort());
});

test('constructed row lists: alignment, moved rows, hunks, pairing and orphans equal lib.mjs diff()', { skip: skipLib }, async () => {
  const L = await import(LIB);
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const words = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], ups = ['NOUN', 'VERB', 'DET', 'ADP', 'ADJ', 'PRON'];
  const rows = (n) => R(...Array.from({ length: n }, () => [words[Math.floor(rnd() * words.length)], ups[Math.floor(rnd() * ups.length)]]));
  let moved = 0, multi = 0, orders = 0;
  for (let t = 0; t < 400; t++) {
    const A = rows(Math.floor(rnd() * 12)), B = rnd() < 0.3 ? [...A].reverse().map((r) => ({ ...r })) : rows(Math.floor(rnd() * 12));
    const w = compareWithLib(L, A, B, `case ${t}`);
    moved += w.moved.length > 0; orders += w.orderChanged;
    multi += w.substituted.length > 1;
  }
  assert.ok(moved > 20 && multi > 20 && orders > 20, `coverage moved ${moved} multi ${multi} orders ${orders}`);
});

test('real row lists of the diff-first experiment: every pair, both ways and against itself, equals lib.mjs diff()', { skip: skipRows }, async () => {
  const L = await import(LIB);
  const rows = JSON.parse(fs.readFileSync(ROWS, 'utf8'));
  let n = 0, moved = 0, subs = 0;
  for (const [pid, { a, b }] of Object.entries(rows)) {
    const w = compareWithLib(L, a, b, pid); compareWithLib(L, b, a, `${pid} ba`); compareWithLib(L, a, a, `${pid} aa`);
    n += 1; moved += w.moved.length; subs += w.substituted.length;
  }
  assert.ok(n > 50 && moved > 0 && subs > 0, `pairs ${n} moved ${moved} substituted ${subs}`);
});
