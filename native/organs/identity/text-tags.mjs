// text-tags.mjs — the one place the finder reads a reader's tags. Pure.
// Universal Dependencies labels only: closed tag sets of a standard, never
// words of a language.

export const fold = (s) => String(s).normalize('NFKC').toLowerCase();
export const HAS_DIGIT = /\p{Nd}/u;
export const rel = (t) => String(t?.deprel ?? '').split(':')[0];

// One definition of negation, used by every hunter and by the part cutter:
// a token its reader tagged as negative (a negator, or a negative pronoun or
// determiner such as "nobody", "no").
const NEG = /(?:^|\|)(?:Polarity=Neg|PronType=Neg)(?:\||$)/;
export const isNegation = (t) => typeof t?.feats === 'string' && NEG.test(t.feats);

export const pronType = (t) => (typeof t?.feats === 'string' ? (/(?:^|\|)PronType=([A-Za-z]+)/.exec(t.feats)?.[1] ?? null) : null);
export const isWord = (t) => t?.word !== false;
export const overlaps = (x, y) => Boolean(x && y) && x.start < y.end && y.start < x.end;
export const within = (inner, outer) => Boolean(inner && outer) && inner.start >= outer.start && inner.end <= outer.end;
