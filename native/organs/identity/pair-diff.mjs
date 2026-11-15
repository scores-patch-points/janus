// pair-diff.mjs — the correspondence of two readings, row by row, with the word evidence of every substitution (2026-11-15).
// Janus's geometry, counts only: which rows of A answer to which rows of B (the longest common subsequence over
// row keys, then identical keys outside it matched in reading order), the hunks between aligned rows, the rows
// paired inside each hunk (substitutions) and the rows left over (orphans), and the share 2*lcs / (nA + nB).
//
// The alignment reproduces lib.mjs diff() of the diff-first experiment (ledgers/paraphrase-100/exp/diff-first/
// src/lib.mjs) exactly: the same LCS with the same tie-break, the same moved rows, the same hunks and the same
// pairing inside a hunk. What it does NOT do: it decides no licence, no refusal, no addressing and no order
// verdict. Each of those applies a bound, and a bound is the asker's (Penelope's) to declare. Every substitution
// carries the evidence in both directions as the evidence function gave it, and every anchor says whether A's row
// is a content row, so a reader holding a bound can compute the rest from this record alone.
//
//   pairDiff(A, B, evidence) -> PairDiff@1 { share, lcs, nA, nB, anchors, substitutions, orphans }
//   A, B      reader rows in reading order, each { key, upos, ... } (Khora's text-reading rows)
//   evidence  (x, y) -> any JSON value; asked once per substitution in each direction, never for anchors
//   anchors        [[i, j, contentA]]  the LCS rows in order, then the moved rows in the order they were found
//   substitutions  [{ i, j, a, b, upos: [ua, ub], contentA, evidence: { ab, ba } }]  hunk by hunk, in order
//   orphans        [{ side, i | j, word, upos }]  exactly lib.mjs's objects (side a carries i, side b carries j)
//
// CONTENT is the parser's own upos values copied from lib.mjs; it is not a word list.

export const PAIR_DIFF_SCHEMA = 'PairDiff@1';
export const CONTENT = new Set(['NOUN', 'PROPN', 'PRON', 'VERB', 'ADJ', 'ADV', 'NUM']);

/** longest common subsequence over row keys -> matched index pairs; tie-break: advance A first (lib.mjs lcs) */
export function lcs(A, B) {
  const n = A.length, m = B.length, W = m + 1, L = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * W + j] = A[i].key === B[j].key ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  const matched = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i].key === B[j].key) { matched.push([i, j]); i++; j++; } else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) i++; else j++; }
  return matched;
}

/** pairDiff(A, B, evidence) -> PairDiff@1. Pure apart from what `evidence` does. */
export function pairDiff(A, B, evidence) {
  if (!Array.isArray(A) || !Array.isArray(B)) throw new TypeError('pairDiff needs two row lists');
  if (typeof evidence !== 'function') throw new TypeError('pairDiff needs an evidence function');
  const matched = lcs(A, B);
  const share = A.length + B.length ? (2 * matched.length) / (A.length + B.length) : 0;
  const inA = new Set(matched.map(([i]) => i)), inB = new Set(matched.map(([, j]) => j));
  const freeA = A.map((_, i) => i).filter((i) => !inA.has(i)), freeB = B.map((_, j) => j).filter((j) => !inB.has(j));
  // moved: identical key outside the LCS, matched one to one in reading order
  const moved = [], usedA = new Set(), usedB = new Set();
  for (const i of freeA) { const j = freeB.find((j) => !usedB.has(j) && B[j].key === A[i].key); if (j !== undefined) { moved.push([i, j]); usedA.add(i); usedB.add(j); } }
  // hunks: the runs between consecutive LCS rows; inside a hunk rows pair off in order, the rest are orphans
  const cuts = [[-1, -1], ...matched, [A.length, B.length]];
  const substitutions = [], orphans = [];
  for (let k = 1; k < cuts.length; k++) {
    const ra = [], rb = [];
    for (let i = cuts[k - 1][0] + 1; i < cuts[k][0]; i++) if (!usedA.has(i)) ra.push(i);
    for (let j = cuts[k - 1][1] + 1; j < cuts[k][1]; j++) if (!usedB.has(j)) rb.push(j);
    const n = Math.min(ra.length, rb.length);
    for (let t = 0; t < n; t++) {
      const i = ra[t], j = rb[t], a = A[i].key, b = B[j].key;
      substitutions.push({ i, j, a, b, upos: [A[i].upos, B[j].upos], contentA: CONTENT.has(A[i].upos), evidence: { ab: evidence(a, b), ba: evidence(b, a) } });
    }
    for (let t = n; t < ra.length; t++) orphans.push({ side: 'a', i: ra[t], word: A[ra[t]].key, upos: A[ra[t]].upos });
    for (let t = n; t < rb.length; t++) orphans.push({ side: 'b', j: rb[t], word: B[rb[t]].key, upos: B[rb[t]].upos });
  }
  const anchors = [...matched, ...moved].map(([i, j]) => [i, j, CONTENT.has(A[i].upos)]);
  return { schema: PAIR_DIFF_SCHEMA, share, lcs: matched.length, nA: A.length, nB: B.length, anchors, substitutions, orphans };
}

/** a WordEvidence@1 record (word-evidence.mjs) -> the contract's WORDEVIDENCE { shared, empty, nulls, n }: counts, copied */
export function wordEvidenceOf(rec) {
  const nulls = Array.isArray(rec?.nullCounts) ? [...rec.nullCounts] : [];
  return { shared: rec?.shared ?? 0, empty: !!rec?.empty, nulls, n: nulls.length };
}
