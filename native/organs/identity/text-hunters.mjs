// text-hunters.mjs — the mechanical hunters. Pure: no model, no list of words.
//
// Each hunter returns CANDIDATE distinctions: a place on one or both texts,
// the layer it belongs to, and who nominated it. Three kinds of candidate can
// be decided here, each by a named giver and only where the ground allows it:
//   - two figures both readers valued, by those values and the sign or unit
//     marks written against them (ground: identity.figures);
//   - a pair that parts ONLY by a negation and its auxiliary, in a language
//     the ground lists (ground: dependency.mechanical.negation), by the
//     readers' own tags;
//   - a pure reordering in which some word stands in another grammatical
//     role, in a language the ground lists (dependency.mechanical.order).
//     The tags may convict a reordering. They never clear one: "no word
//     changed its role" is left to a reader, because a parse can agree with
//     itself and still miss what moved.
// Everything else is left undecided (`survives: null`) for a reader.
//
// A label on a place ("determiner", "negation inside", "marks") describes it.
// It never closes a place and never orders the asking: places are asked in
// the order they stand in the text.

import { align } from './text-align.mjs';
import { fold, rel, isNegation, pronType, isWord, within } from './text-tags.mjs';

const nfkc = (s) => String(s).normalize('NFKC');
const span = (s) => (s && !s.empty ? { text: s.text, start: s.start, end: s.end } : null);
const both = (Ra, Rb) => (Ra.by === Rb.by ? Ra.by : `${Ra.by} | ${Rb.by}`);
const inLanguages = (list, Ra, Rb) => Array.isArray(list) && Boolean(Ra.language) && Boolean(Rb.language) && list.includes(Ra.language) && list.includes(Rb.language);

// A window of neighbouring words around a span: what a pointed question shows,
// so that "17" is asked about as "for 17 years".
export function around(reading, start, end, pad) {
  const W = reading.tokens.filter(isWord);
  let i0 = W.findIndex((t) => t.end > start), i1 = W.findLastIndex((t) => t.start < end);
  if (i0 < 0 || i1 < 0 || i1 < i0) return { text: reading.text.slice(start, end), start, end };
  i0 = Math.max(0, i0 - pad); i1 = Math.min(W.length - 1, i1 + pad);
  return { text: reading.text.slice(W[i0].start, W[i1].end), start: W[i0].start, end: W[i1].end };
}

// ---- existence: figures ------------------------------------------------------

// Two figures are the same figure, mechanically, only when the ground says
// figures are compared by value, both readers valued them, the values are
// equal, AND the marks written against them are the same ("-5" is not "5";
// "$500" is not "€500"). A figure a reader could not value is matched only by
// an identically written figure with the same marks.
const marksOf = (x) => nfkc(x.marks ?? '');
export function sameFigure(x, y, figures) {
  if (marksOf(x) !== marksOf(y)) return false;
  return figures === 'equal-value' && x.value != null && y.value != null ? x.value === y.value : fold(x.text) === fold(y.text);
}

export function huntFigures(Ra, Rb, { figures }) {
  const A = Ra.amounts ?? [], B = Rb.amounts ?? [];
  const by = figures === 'equal-value' ? `number parsers of the readers (${both(Ra, Rb)})` : `figures as written (${both(Ra, Rb)})`;
  const used = new Set(), candidates = [];
  let matched = 0;
  const cand = (x, side) => candidates.push({ layer: 'existence', kind: x.value == null ? 'figure-unread' : 'figure', side, [side]: { text: x.text, start: x.start, end: x.end }, value: x.value ?? null, ...(x.marks ? { marks: x.marks } : {}), by, survives: null, why: x.value == null ? 'a figure its reader did not value, with no identically written figure on the other side' : `no figure equal to ${marksOf(x)}${x.value} on the other side` });
  for (const x of A) {
    const k = B.findIndex((y, i) => !used.has(i) && sameFigure(x, y, figures));
    if (k >= 0) { used.add(k); matched++; } else cand(x, 'a');
  }
  B.forEach((y, i) => { if (!used.has(i)) cand(y, 'b'); });
  return { branch: 'existence/figures', by, looked: A.length + B.length, matched, candidates };
}

// ---- existence: names --------------------------------------------------------

// A name is matched by its spelling, token for token and letter case kept,
// against the other reading's tokens (never by a raw substring: "Ann" is not
// in "annual", and "Will" is not "will"). "Every name is spelled in the other"
// can only be said when BOTH readers offered names.
export function huntNames(Ra, Rb) {
  const out = [];
  const keysOf = (R) => R.tokens.filter(isWord).map((t) => nfkc(t.form));
  const nameKeys = (R, nm) => { const inside = R.tokens.filter((t) => isWord(t) && within(t, nm)).map((t) => nfkc(t.form)); return inside.length ? inside : nfkc(nm.text).split(/\s+/).filter(Boolean); };
  const holds = (hay, seq) => { if (!seq.length) return true; for (let i = 0; i + seq.length <= hay.length; i++) if (seq.every((k, j) => hay[i + j] === k)) return true; return false; };
  let matched = 0;
  const spelled = { a: 0, b: 0 }; // names of this side that the other text spells
  const absent = (X, Y, side) => {
    const hay = keysOf(Y), seen = new Set();
    for (const nm of X.names ?? []) {
      const seq = nameKeys(X, nm), k = seq.join(' ');
      if (!k || seen.has(k)) continue; seen.add(k);
      if (holds(hay, seq)) { matched++; spelled[side]++; continue; }
      out.push({ layer: 'existence', kind: 'name', side, [side]: { text: nm.text, start: nm.start, end: nm.end }, by: `names from the reader (${X.by})`, survives: null, why: 'a name the other text does not spell' });
    }
  };
  absent(Ra, Rb, 'a'); absent(Rb, Ra, 'b');
  const looked = (Ra.names?.length ?? 0) + (Rb.names?.length ?? 0);
  const bothOffer = Boolean(Ra.offersNames && Rb.offersNames);
  // A reader that gave no names for a text which spells a name the other reader gave: that text holds a name its own
  // reader did not give, so its silence about the rest is not an examination.
  const other = (s) => (s === 'a' ? 'b' : 'a');
  const silent = bothOffer ? ['a', 'b'].find((s) => !((s === 'a' ? Ra : Rb).names?.length) && spelled[other(s)] > 0) : undefined;
  const gap = !bothOffer
    ? `names were not offered by ${[!Ra.offersNames && 'the reader of a', !Rb.offersNames && 'the reader of b'].filter(Boolean).join(' and ')}`
    : silent ? `the reader of ${silent} gave no names, though ${silent} spells ${spelled[other(silent)]} the other reader gave: whether ${silent} names something the other text does not spell was not examined` : null;
  return { branch: 'existence/names', by: `names from the readers (${both(Ra, Rb)})`, looked, matched, bothOffer, candidates: out, ...(gap ? { gap } : {}) };
}

// ---- the hunks of an aligned pair --------------------------------------------

const figureToken = (R, t) => (R.amounts ?? []).some((x) => within(t, x));
const figuresIn = (R, side) => (R.amounts ?? []).filter((x) => x.start >= side.start && x.end <= side.end);

// What kind of place is this hunk? A description from the readers' own tags.
function label(h, Ra, Rb, parsed) {
  const A = h.a.tokens, B = h.b.tokens, all = [...A, ...B];
  if (all.every((t) => !isWord(t))) return 'marks';
  if (A.length && B.length && A.every((t) => figureToken(Ra, t)) && B.every((t) => figureToken(Rb, t))) return 'figure';
  if (parsed) {
    if (A.length && B.length && all.every((t) => t.upos === 'DET' || t.upos === 'PRON')) return pronType(A[0]) !== pronType(B[0]) ? 'quantification' : 'determiner';
    if (A.length && B.length && all.every((t) => t.upos === 'AUX')) return 'modality';
    if (A.length && B.length && all.every((t) => t.upos === 'PROPN')) return 'name';
  }
  return 'wording';
}

// The grammatical role of a word as a path to the root: its relation and its
// head, then the head's relation and head, and so on. A conjunct stands where
// its first conjunct stands. Two "dog"s in one sentence have different paths.
const ROLE_BEARING = /^(NOUN|PROPN|PRON|VERB|ADJ|ADV|NUM|PART)$/;
export const ROLE_PATH_MAX = 8; // how far up a parse a role path is read
function rolePath(t, byId) {
  const first = (x) => { let c = x, g = 0; while (c && rel(c) === 'conj' && g++ < ROLE_PATH_MAX) c = byId.get(`${c.sent}:${c.head}`); return c; };
  const path = []; let cur = first(t), g = 0;
  while (cur && g++ < ROLE_PATH_MAX) {
    const head = byId.get(`${cur.sent}:${cur.head}`);
    path.push(`${rel(cur)}<${head ? fold(head.lemma ?? head.form) : 'root'}`);
    if (!head) break; cur = first(head);
  }
  return path.join('/');
}

// `tagChecks` says, for the report, whether each check by tags ran and why not.
export function huntHunks(Ra, Rb, { accidental, minCoverage, mechanical, figures }) {
  const al = align(Ra.tokens, Rb.tokens, Ra.text, Rb.text, { accidental });
  const parsed = Boolean(Ra.parsed && Rb.parsed);
  const tagsBy = `tags of the readers (${both(Ra, Rb)})`;
  const why = (list, name) => (!parsed ? 'no parse for one or both texts' : !inLanguages(list, Ra, Rb) ? `the ground does not let tags decide ${name} for these languages (${Ra.language ?? 'unstated'}, ${Rb.language ?? 'unstated'})` : null);
  const tagChecks = { negation: { ran: false, why: why(mechanical.negation, 'a negation') }, order: { ran: false, why: why(mechanical.order, 'a reordering') } };
  const base = { branch: 'hunks', by: 'alignment (longest common subsequence over the readers\' tokens)', coverage: al.coverage, hunks: al.hunks.length, reordered: al.reordered, tagChecks };
  if (al.gap) return { ...base, ran: false, gap: al.gap, candidates: [] };
  // A pure reordering is examined whatever the in-order coverage: swapping the two ends of a three-word sentence leaves one word in order.
  if (al.coverage < minCoverage && !al.reordered) return { ...base, ran: false, gap: `the texts share too few tokens in order to be read place by place (coverage ${al.coverage.toFixed(2)}, the ground asks for ${minCoverage})`, candidates: [] };
  const sideSpan = (R, side) => { const T = al.hunks.flatMap((h) => h[side].tokens); if (!T.length) return null; const s = Math.min(...T.map((t) => t.start)), e = Math.max(...T.map((t) => t.end)); return { text: R.text.slice(s, e), start: s, end: e }; };

  if (al.reordered) {
    const c = { layer: 'structure', kind: 'order', a: sideSpan(Ra, 'a'), b: sideSpan(Rb, 'b'), by: base.by, survives: null, why: 'the same tokens in another order' };
    if (!tagChecks.order.why) {
      // Every role-bearing word of both readings is compared, never only the words the alignment left unmatched:
      // which of two swapped neighbours stays matched is a tie-break, and the word that changed its role may be that one.
      tagChecks.order.ran = true;
      const idx = (R) => new Map(R.tokens.filter((t) => t.id != null).map((t) => [`${t.sent}:${t.id}`, t]));
      const roles = (R) => { const byId = idx(R), m = new Map(); for (const t of R.tokens) { if (!ROLE_BEARING.test(t.upos ?? '') || rel(t) === 'cc') continue; const k = fold(t.form); (m.get(k) ?? m.set(k, []).get(k)).push(rolePath(t, byId)); } for (const v of m.values()) v.sort(); return m; };
      const ra = roles(Ra), rb = roles(Rb);
      // Over the words of BOTH readings: a word that bears a role in only one parse is seen from either side.
      const moved = [...new Set([...ra.keys(), ...rb.keys()])].filter((k) => JSON.stringify(ra.get(k)) !== JSON.stringify(rb.get(k))).map((k) => ({ word: k, a: ra.get(k) ?? null, b: rb.get(k) ?? null }));
      c.roles = moved;
      if (moved.length) { c.survives = true; c.decidedBy = `${tagsBy}: ${moved.map((m) => m.word).join(', ')} ${moved.length === 1 ? 'stands' : 'stand'} in another grammatical role`; }
      else c.why = 'the same tokens in another order; by the tags no word changed its role, which the tags alone cannot make a clearance';
    }
    return { ...base, ran: true, candidates: [c] };
  }

  // A pair that parts only by a negation and its auxiliary: every unmatched token is a negation, an auxiliary, or a
  // form of a verb that stands on both sides ("did not deliver" / "delivered"), and the two sides negate an odd number
  // of heads apart. Judged over the whole pair, never one hunk at a time: "has not approved any plan" / "has approved
  // no plan" negates once on each side and is left to a reader. Counted by negated head, not by tag: a language that
  // writes one negation with two particles is not convicted for dropping one, and the ground lists the languages
  // this rule may be trusted in at all.
  if (!tagChecks.negation.why && al.hunks.length) {
    tagChecks.negation.ran = true;
    const TA = al.hunks.flatMap((h) => h.a.tokens), TB = al.hunks.flatMap((h) => h.b.tokens);
    const verbLemmas = (T) => new Set(T.filter((t) => t.upos === 'VERB').map((t) => fold(t.lemma ?? t.form)));
    const va = verbLemmas(TA), vb = verbLemmas(TB);
    const edit = (t) => isNegation(t) || t.upos === 'AUX' || (t.upos === 'VERB' && va.has(fold(t.lemma ?? t.form)) && vb.has(fold(t.lemma ?? t.form)));
    const negated = (T) => new Set(T.filter(isNegation).map((t) => `${t.sent}:${t.head}`)).size;
    if ([...TA, ...TB].every(edit) && (negated(TA) % 2) !== (negated(TB) % 2)) {
      return { ...base, ran: true, candidates: [{ layer: 'structure', kind: 'polarity', a: sideSpan(Ra, 'a'), b: sideSpan(Rb, 'b'), by: base.by, survives: true, decidedBy: `${tagsBy}: the texts part only by a negation and its auxiliary`, why: 'a negation on one side of an otherwise identical text' }] };
    }
  }

  const out = [];
  for (const h of al.hunks) {
    const kind = label(h, Ra, Rb, parsed);
    const c = { layer: kind === 'figure' || kind === 'name' ? 'existence' : 'structure', kind, a: span(h.a), b: span(h.b), by: base.by, survives: null, hunk: h, why: 'the texts part here' };
    if (parsed && [...h.a.tokens, ...h.b.tokens].some(isNegation)) c.negationInside = true;
    if (kind === 'figure') {
      const fa = figuresIn(Ra, h.a), fb = figuresIn(Rb, h.b);
      if (figures === 'equal-value' && fa.length && fb.length && [...fa, ...fb].every((x) => x.value != null)) {
        const used = new Set();
        const same = fa.length === fb.length && fa.every((x) => { const k = fb.findIndex((y, i) => !used.has(i) && sameFigure(x, y, figures)); if (k < 0) return false; used.add(k); return true; });
        c.values = { a: fa.map((x) => `${marksOf(x)}${x.value}`), b: fb.map((x) => `${marksOf(x)}${x.value}`) };
        // The same value written two ways is cleared. Different values are a conviction only when this is the one place
        // the texts part: where they part elsewhere too, the unit may have changed with the figure ("7 days", "1 week"),
        // and that is not for a number parser to say. Then the figures are asked about.
        if (same || al.hunks.length === 1) { c.survives = !same; c.decidedBy = `number parsers of the readers (${both(Ra, Rb)}): ${same ? 'the same value written two ways' : 'different values, at the only place the texts part'}`; }
        else c.why = 'figures of different values where the texts also part elsewhere: a unit may have changed with them';
      } else c.why = figures === 'equal-value' ? 'figures the readers could not both value' : 'figures the ground puts to a reader';
    }
    out.push(c);
  }
  return { ...base, ran: true, candidates: out };
}

// Negation-count parity over whole texts: a lead for the report when the pair
// cannot be read place by place. Never a verdict ("did not refuse" and
// "agreed" differ in parity and not in meaning).
export function polarityLead(Ra, Rb) {
  if (!(Ra.parsed && Rb.parsed)) return { ran: false, gap: 'no parse for one or both texts' };
  const na = Ra.tokens.filter(isNegation), nb = Rb.tokens.filter(isNegation);
  return { ran: true, by: `tags of the readers (${both(Ra, Rb)})`, lead: (na.length % 2) !== (nb.length % 2), a: na.map((t) => ({ text: t.form, start: t.start, end: t.end })), b: nb.map((t) => ({ text: t.form, start: t.start, end: t.end })) };
}
