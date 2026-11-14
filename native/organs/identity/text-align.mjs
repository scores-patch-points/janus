// text-align.mjs — where two readings part. Pure: no I/O, no model, no list of words.
// It takes tokens a reader made; it never cuts text itself.
//
// This is nomination only. A place found here is a place to look, never a
// verdict: "any" against "some" and "buy" against "purchase" look the same
// from here. The finder asks, of each place, whether it changes the answer.
//
// Every token takes part: words and marks alike. A currency sign, a minus
// sign and a question mark are places two texts can part. What is NOT
// followed (letter case, compatibility forms of a character) is not decided
// here: it is handed in from the ground's dependency decision as `accidental`.

const nfkc = (s) => String(s).normalize('NFKC');

// `forms`: compatibility forms (a ligature, a full-width digit) are one character. `case`: letter case is not followed.
export const keyOf = (accidental = {}) => (t) => { const s = accidental.forms ? nfkc(t.form) : String(t.form); return accidental.case ? s.toLowerCase() : s; };

export const ALIGN_CELLS_MAX = 4_000_000; // beyond this the table is not built and the gap is reported

// Longest common subsequence over token keys → the matched pairs, and the
// hunks between them. A hunk is a run of unmatched tokens on either or both
// sides, with its exact span on each side.
export function align(tokensA, tokensB, textA, textB, { accidental = {} } = {}) {
  const A = tokensA ?? [], B = tokensB ?? [];
  const n = A.length, m = B.length;
  if (!n || !m) return { gap: 'empty_side', matched: [], hunks: [], coverage: 0, reordered: false, n, m };
  if (n * m > ALIGN_CELLS_MAX) return { gap: 'too_long_to_align', matched: [], hunks: [], coverage: null, reordered: false, n, m };
  const key = keyOf(accidental);
  const ka = A.map(key), kb = B.map(key);
  const W = m + 1, L = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    L[i * W + j] = ka[i] === kb[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  }
  const matched = [], hunks = [];
  let i = 0, j = 0, hi = 0, hj = 0;
  const flush = (ei, ej) => { if (ei > hi || ej > hj) hunks.push(hunk(A, B, hi, ei, hj, ej, textA, textB)); };
  while (i < n && j < m) {
    if (ka[i] === kb[j]) { flush(i, j); matched.push([i, j]); i++; j++; hi = i; hj = j; }
    else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) i++;
    else j++;
  }
  flush(n, m);
  // Same tokens, another order: the unmatched keys are the same multiset on both sides.
  const bag = (side) => { const c = new Map(); for (const h of hunks) for (const t of h[side].tokens) c.set(key(t), (c.get(key(t)) ?? 0) + 1); return c; };
  const ba = bag('a'), bb = bag('b');
  const reordered = ba.size > 0 && ba.size === bb.size && [...ba].every(([k, v]) => bb.get(k) === v);
  return { matched, hunks, coverage: (2 * matched.length) / (n + m), reordered, n, m };
}

function hunk(A, B, i0, i1, j0, j1, textA, textB) {
  const side = (T, x0, x1, text) => {
    const tokens = T.slice(x0, x1);
    if (!tokens.length) { const at = x0 < T.length ? T[x0].start : (T.at(-1)?.end ?? 0); return { tokens, text: '', start: at, end: at, empty: true }; }
    const start = tokens[0].start, end = tokens.at(-1).end;
    return { tokens, text: String(text).slice(start, end), start, end, empty: false };
  };
  return { a: side(A, i0, i1, textA), b: side(B, j0, j1, textB) };
}

// The minimal pair for one hunk: the first text with only this place taken
// from the second. Asking about (a, twin) asks about this place alone.
export function substitute(textA, h) {
  const insert = h.b.empty ? '' : h.b.text;
  let s = textA.slice(0, h.a.start), e = textA.slice(h.a.end);
  if (h.a.empty && insert) { // pure insertion: one space each side, unless a mark sits there
    if (s && !/\s$/.test(s) && /^[\p{L}\p{N}]/u.test(insert)) s += ' ';
    if (e && !/^[\s.,;:!?)\]»”]/.test(e)) e = ' ' + e;
  }
  if (!insert && /\s$/.test(s) && /^\s/.test(e)) e = e.replace(/^\s+/, ''); // pure deletion: no doubled space
  return s + insert + e;
}
