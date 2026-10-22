// read-nodes.mjs — READ: turn plain text into the referent nodes a mention is attached to.
//
// Longest-match spans of a sentence against an injected title index (title -> referent id). No word lists: what counts as a
// referent is whatever the index holds (the pool's own graph: article titles and redirect surface forms). Text and index keys go
// through the SAME tokenizer, so a title such as "U.S." or "Washington, D.C." matches however the text spells its punctuation.
// Capitalised spans are tried as written, then with the first letter lowered when the span opens a sentence. A span that matches
// nothing is a typed miss, reported, never invented into a node. Matching is by span, so "Royal College of Surgeons of Edinburgh"
// is one node, not four; nodes the index does not know are unread, which is the honest size of the READ gap.
//
// Scope, declared: a span that opens a sentence is also tried with its first letter lowered (this only matters for scripts with case; sentence ends are
// . ! ? 。 ！ ？ ؟ । ។). Tokens are Unicode letters, numbers and combining marks (text is NFC-normalised), with punctuation inside a
// token kept and trailing punctuation dropped. Scripts written without spaces (Chinese, Japanese, Thai) need a script-segmenting
// tokenizer injected; here they read as one token per run and mostly miss, which is a gap, not a guess. Possessives and other
// language-specific suffixes are not stripped.
//
// PURE. The index is the caller's.
export const READ_SCHEMA = 'EONodeRead@1';

const TOKEN = /[\p{L}\p{N}\p{M}][\p{L}\p{N}\p{M}'’.-]*/gu;
const trim = (t) => t.replace(/[.'’-]+$/u, '');
const tokenize = (text) => [...String(text ?? '').normalize('NFC').matchAll(TOKEN)].map((m) => ({ t: trim(m[0]), at: m.index, end: m.index + m[0].length })).filter((x) => x.t);
const keyOf = (surface) => tokenize(surface).map((x) => x.t).join(' ');

const normCache = new WeakMap();
/** the index re-keyed through the tokenizer, and the longest key in tokens (derived, never capped) */
function normalised(index) {
  let c = normCache.get(index);
  if (c) return c;
  const map = new Map();
  let longest = 1;
  for (const [surface, id] of index) {
    const k = keyOf(surface);
    if (!k) continue;
    if (!map.has(k)) map.set(k, id);
    longest = Math.max(longest, k.split(' ').length);
  }
  c = { map, longest };
  normCache.set(index, c);
  return c;
}

/** index: Map(surface -> referent id). maxSpan: longest span tried in tokens (derived from the index when omitted). */
export function readNodes(text, index, { maxSpan = null } = {}) {
  const src = String(text ?? '').normalize('NFC');
  const toks = tokenize(src);
  const { map, longest: indexLongest } = normalised(index);
  const longest = Math.min(maxSpan ?? indexLongest, indexLongest);
  const nodes = [], spans = [];
  let i = 0;
  while (i < toks.length) {
    const opens = i === 0 || /[.!?。！？؟।។]\s*$/u.test(src.slice(toks[i - 1].end - 1, toks[i].at));
    const top = Math.min(longest, toks.length - i);
    const joined = []; // joined[n-1] = the n-token surface starting at i
    for (let n = 1; n <= top; n += 1) joined.push(n === 1 ? toks[i].t : `${joined[n - 2]} ${toks[i + n - 1].t}`);
    let hit = null;
    for (let n = top; n >= 1 && !hit; n -= 1) {
      const surface = joined[n - 1];
      const alt = surface.charAt(0).toLowerCase() + surface.slice(1);
      const id = map.get(surface) ?? (opens ? map.get(alt) : undefined);
      if (id !== undefined) hit = { id, surface, n };
    }
    if (hit) { nodes.push(hit.id); spans.push({ surface: hit.surface, node: hit.id, at: toks[i].at }); i += hit.n; } else i += 1;
  }
  return { schema: READ_SCHEMA, nodes: [...new Set(nodes)], spans };
}

/** Build the index from a referent graph: every resolved title, and every surface form that redirects to one. */
export function titleIndex({ resolved = {}, titles = [] } = {}) {
  const idx = new Map();
  for (const t of titles) idx.set(t, t);
  for (const [surface, target] of Object.entries(resolved)) if (!idx.has(surface)) idx.set(surface, target);
  return idx;
}

export default { READ_SCHEMA, readNodes, titleIndex };
