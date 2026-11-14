// text-finder.fixture.mjs — TEST FIXTURE ONLY. A floor reader of text and the three ready question shapes, so the
// text finder's tests run inside janus. janus does not read text: the real reader givers live in khora
// (native/adapters/text/finder-reading.js, native/organs/finder-questions.js) and are handed in by the caller.

const HAS_DIGIT = /\p{Nd}/u;

// Every token is kept, words and marks alike: a currency sign, a minus sign
// and a question mark are places two texts can part. Only white space is not
// a token.
export function segment(text, language = undefined) {
  const out = [];
  let seg;
  try { seg = new Intl.Segmenter(language || undefined, { granularity: 'word' }); } catch { seg = new Intl.Segmenter(undefined, { granularity: 'word' }); }
  for (const s of seg.segment(String(text))) {
    if (!s.segment.trim()) continue;
    out.push({ form: s.segment, start: s.index, end: s.index + s.segment.length, word: Boolean(s.isWordLike) });
  }
  return out;
}

// A figure is valued only when its written form can be read one way.
//   - Plain digits need no giver.
//   - A separator is read by the language of the text, and only for the tags listed here, whose separators read one way.
//     Any other language or region is refused (null), never guessed: Spanish is not listed because its regions disagree.
//   - More digits than a double can hold exactly are not valued: two different long identifiers must not come out equal.
//   - A token that carries letters ("5M", "20km", "1990s") is a figure nobody valued here. So is one with a leading zero.
// A figure that is not valued is not dropped: it is matched only by the same written form, and otherwise asked about.
export const FIGURE_DIGITS_MAX = 15;
const COMMA_THOUSANDS = /^en(-(US|GB|CA|AU|IE|NZ))?$/, DOT_THOUSANDS = /^de(-DE)?$/;
export function figureValue(form, language) {
  const s = String(form).normalize('NFKC');
  if ((s.match(/\d/g) ?? []).length > FIGURE_DIGITS_MAX) return null;
  if (/^0\d/.test(s)) return null; // a leading zero is written for a reason ("007", "0712"): an identifier, not an amount
  if (/^\d+$/.test(s)) return Number(s);
  const lang = String(language ?? '');
  if (COMMA_THOUSANDS.test(lang)) {
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
    if (/^\d+\.\d+$/.test(s)) return Number(s);
  }
  if (DOT_THOUSANDS.test(lang)) {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
    if (/^\d+,\d+$/.test(s)) return Number(s.replace(',', '.'));
  }
  return null;
}

// The marks written hard against a figure: a currency sign, a mathematical sign, a dash, a percent or per-mille sign.
// "-5" is not "5" and "$500" is not "€500": two figures are the same figure only with the same marks. Character
// classes of the Unicode standard, not a list of words.
const FIGURE_MARK = /^[\p{Sc}\p{Sm}\p{Pd}%‰]+$/u;
export function figureMarks(tokens, i, j) {
  const before = tokens[i - 1], after = tokens[j + 1];
  const pre = before && before.word === false && before.end === tokens[i].start && FIGURE_MARK.test(before.form) ? before.form : '';
  const post = after && after.word === false && after.start === tokens[j].end && FIGURE_MARK.test(after.form) ? after.form : '';
  return pre + post;
}

// Figures as runs: a figure starts at a word token that bears a digit, and takes in the digit-bearing word tokens that
// follow it with at most one character (a space) between. "10 000" is one figure, and nobody here values it.
// `more(token)` lets a parsing reader add its numeral words to a run ("5 million").
export function figuresOf(text, tokens, language, more = () => false) {
  const out = [];
  const digit = (t) => t.word !== false && HAS_DIGIT.test(t.form);
  for (let i = 0; i < tokens.length; i++) {
    if (!digit(tokens[i])) continue;
    let j = i;
    while (j + 1 < tokens.length && (digit(tokens[j + 1]) || more(tokens[j + 1])) && tokens[j + 1].start - tokens[j].end <= 1 && tokens[j + 1].start > tokens[j].end) j++;
    const start = tokens[i].start, end = tokens[j].end, run = text.slice(start, end), marks = figureMarks(tokens, i, j);
    out.push({ text: run, start, end, value: j === i ? figureValue(run, language) : null, ...(marks ? { marks } : {}), ...(j > i ? { unread: 'a figure of several tokens' } : {}) });
    i = j;
  }
  return out;
}

export function surfaceReading(text, { language } = {}) {
  text = String(text);
  const tokens = segment(text, language);
  return { text, language: language ?? null, parsed: false, offersNames: false, tokens, amounts: figuresOf(text, tokens, language), names: [], by: `surface reader (Intl.Segmenter${language ? `, ${language}` : ''}; no parse)` };
}

export const surfaceReader = Object.assign(async (text, opts = {}) => surfaceReading(text, opts), { by: 'surface reader (Intl.Segmenter; no parse)' });

// questions.mjs — ready shapes for the three identity questions. A convenience
// for whoever asks: the finder itself holds no list of questions. `by` names
// the asker.
export const allInformation = (by) => ({ asks: 'Do the two texts carry the same information, each stating all that the other states?', by, of: 'information', directions: 'both', grain: 'Ground' });
export const carries = (direction, by) => ({ asks: direction === 'a-carries-b' ? 'Does the first text state everything the second states?' : 'Does the second text state everything the first states?', by, of: 'information', directions: direction, grain: 'Ground' });
export const sameThing = (by) => ({ asks: 'Are the two texts about the same particular thing, whether or not they agree about it?', by, of: 'identity', grain: 'Figure' });
export const sameKind = (kind, by) => ({ asks: `Is each of the two texts ${kind}?`, by, of: 'kind', kind, grain: 'Pattern' });
