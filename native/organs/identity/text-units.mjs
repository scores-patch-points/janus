// text-units.mjs — the parts of a text that can each be asked about. Pure.
//
// A yes/no reader asked about a whole sentence lets a surplus through
// (measured 2026-11-14 on 84 pairs: 21 of 21 paraphrases found, 0 of 30
// contradictions accepted, and 25 of 33 "adds or changes one fact" pairs
// called the same). So when a whole text is not carried, the finder cuts it
// where its READER cut it (khora's own parse: a clause's subject, object,
// obliques, dependent clauses, and the predicate itself) and asks about each
// part, to say where.
//
// The cut is the reader's, by the reader's tags. Where there is no parse the
// only mechanical cut is at marks, and that weaker cut is named in `by`.

import { rel, isNegation, isWord } from './text-tags.mjs';

// Universal Dependencies relation classes, by the standard's own labels.
const PREDICATE_REL = /^(aux|cop)$/; // what belongs to a predicate besides its head: its auxiliaries and copula (and its negation)
const CLAUSAL_REL = /^(advcl|conj|ccomp|xcomp|parataxis|acl|csubj)$/;
const CONTENT_POS = /^(NOUN|PROPN|VERB|ADJ|ADV|NUM)$/;
const PREDICATE_POS = /^(VERB|AUX|ADJ)$/;

export const UNIT_SPLIT_MIN = 6; // a dependent clause this long (in words) is cut again
export const UNIT_DEPTH_MAX = 3;
export const NUCLEUS_SLACK = 3; //  words allowed between a predicate's own words before it is cut down to head and negation

export function unitsOf(reading) {
  return reading?.parsed ? parsedUnits(reading) : markUnits(reading);
}

function parsedUnits(R) {
  const bySent = new Map();
  for (const t of R.tokens) (bySent.get(t.sent) ?? bySent.set(t.sent, []).get(t.sent)).push(t);
  const units = []; let left = 0;
  for (const toks of bySent.values()) {
    const byId = new Map(toks.map((t) => [t.id, t]));
    const kids = new Map();
    for (const t of toks) (kids.get(t.head) ?? kids.set(t.head, []).get(t.head)).push(t);
    const subtree = (t, acc = []) => { acc.push(t); for (const k of kids.get(t.id) ?? []) subtree(k, acc); return acc; };
    const roots = toks.filter((t) => !byId.has(t.head));
    const push = (members, role) => {
      const words = members.filter(isWord);
      // A part must carry something: a content word, or a negation ("Nobody" is a part). What is left out is counted.
      if (!words.some((t) => CONTENT_POS.test(t.upos ?? '') || isNegation(t))) { if (words.length) left += 1; return; }
      const start = Math.min(...words.map((t) => t.start)), end = Math.max(...words.map((t) => t.end));
      units.push({ text: R.text.slice(start, end), start, end, role, words: words.length });
    };
    const clause = (head, depth) => {
      // Every dependent but the marks: a phrase headed by a currency or percent sign ("$500 in fines") is a part too.
      const deps = (kids.get(head.id) ?? []).filter((d) => rel(d) !== 'punct');
      // The predicate itself, with its auxiliaries and its negation. Marks are never part of it: a sentence's full stop
      // hangs on its root and would stretch the span to the end.
      // A clause's linker ("while", "and") is not part of its predicate: counted in, it would stretch the span across the subject.
      const nucleus = [head, ...deps.filter((d) => PREDICATE_REL.test(rel(d)) || isNegation(d) || rel(d) === 'compound')];
      const ns = Math.min(...nucleus.map((t) => t.start)), ne = Math.max(...nucleus.map((t) => t.end));
      const cover = toks.filter((t) => isWord(t) && t.start >= ns && t.end <= ne);
      if (cover.length <= nucleus.length + NUCLEUS_SLACK) push(cover, 'predicate');
      else {
        // Another part sits between the predicate's own words ("may in the coming week approve"). The predicate still
        // goes out whole, as its own words with the gap marked: an auxiliary or a "not" is never cut off its verb.
        const own = nucleus.filter(isWord).sort((x, y) => x.start - y.start);
        let text = ''; own.forEach((t, i) => { text += (i ? (own[i - 1].end === t.start ? '' : toks.some((m) => isWord(m) && m.start >= own[i - 1].end && m.end <= t.start) ? ' … ' : ' ') : '') + R.text.slice(t.start, t.end); });
        units.push({ text, start: ns, end: ne, role: 'predicate', words: own.length, split: true });
      }
      for (const d of deps) {
        if (nucleus.includes(d)) continue;
        const sub = subtree(d);
        const words = sub.filter(isWord).length;
        if (CLAUSAL_REL.test(rel(d)) && PREDICATE_POS.test(d.upos ?? '') && words >= UNIT_SPLIT_MIN && depth < UNIT_DEPTH_MAX) clause(d, depth + 1);
        else push(sub, rel(d));
      }
    };
    for (const r of roots) { if (!isWord(r)) continue; clause(r, 0); }
  }
  units.sort((x, y) => x.start - y.start || y.end - x.end);
  const seen = new Set();
  const out = units.filter((u) => { const k = `${u.start}:${u.end}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { units: out, by: `${R.by}: clause parts by dependency relation`, cut: 'reader', leftOut: left };
}

function markUnits(R) {
  const units = []; let run = [];
  // A run of one word between marks is a part too: "approved, allegedly, by the council".
  const flush = () => { if (run.length >= 1) { const start = run[0].start, end = run.at(-1).end; units.push({ text: R.text.slice(start, end), start, end, role: 'clause', words: run.length }); } run = []; };
  for (const t of R?.tokens ?? []) { if (isWord(t)) run.push(t); else flush(); }
  flush();
  if (units.length < 2) return { units: [], by: 'marks only (no parse)', cut: 'none', gap: 'no parse and no internal marks: the text cannot be cut mechanically' };
  return { units, by: 'marks only (no parse)', cut: 'marks', leftOut: 0 };
}
