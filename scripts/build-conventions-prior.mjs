// build-conventions-prior.mjs — THE CONVENTIONS THE READER READS A CAPITAL BY, as a prior (Conventions@1), with how closely English keeps each, MEASURED.
//
// A capital is a convention, not a rule: writers of a cased script keep it more or less. The reader's cast (khora native/the-fold/read-core.mjs
// → native/adapters/text/surfaces.js) reads a capital by four of them, and until now they lived as constants inside the code with no row that said who
// gave them or how closely a text keeps them. This file is that row's home. One prior, priors/conventions-eng.json; nomos (native/organs/nomos.js) folds
// each convention into a NomosRule@1 of its own, with its standing from its OWN giver or builder (a convention is GIVEN, EXTRACTED, never REVEALED);
// khora's conventions.js reads the prior as data.
//
// What is typed here is the STATEMENT of each convention (what it says, where it holds, where the reader stands on it, where it departs). What is
// measured is every figure: the capital rates and the unmarked-sentence share from UD_English-GUM's training file (its sha256 is pinned in the prior),
// and the treebank's own size from priors/pos-eng.json's provenance. No figure is copied by hand.
//
//   GUM_TRAIN=/path/to/en_gum-ud-train.conllu node scripts/build-conventions-prior.mjs [--out priors/conventions-eng.json]
//
// The GUM file is CC BY-SA and is not vendored: without it the builder says so and writes nothing. The figures DESCRIBE how closely English keeps each
// convention; the cast never reads them (it reads the text's own counts and the pos prior's tag counts, a different corpus), so they cannot leak the
// ground the cast is scored on into the cast.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = resolve(HERE, '..', arg('--out', 'priors/conventions-eng.json'));
const POS = resolve(HERE, '../priors/pos-eng.json');
const file = process.env.GUM_TRAIN || arg('--gum', null);
if (!file || !existsSync(file)) { console.log("build-conventions-prior: nothing written — set GUM_TRAIN to UD_English-GUM's en_gum-ud-train.conllu (CC BY-SA, not vendored)."); process.exit(0); }

// ── the measurement: CoNLL-U tokens by position in their sentence, with their gold tag ─────────────────────────────────────────────────────
const CAP = /^\p{Lu}/u, LETTER = /\p{L}/u, TERMINAL = /[.?!…"”')\]]$/;
const bytes = readFileSync(file);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const n = { mid: 0, midCap: 0, midProper: 0, midProperCap: 0, midOther: 0, midOtherCap: 0, init: 0, initCap: 0, initCapProper: 0, sents: 0, unmarked: 0 };
{
  let sent = [];
  const close = () => {
    if (!sent.length) return;
    n.sents++;
    if (!TERMINAL.test(sent.at(-1).form)) n.unmarked++;
    sent.forEach((t, i) => {
      if (!LETTER.test(t.form)) return;
      const cap = CAP.test(t.form);
      if (i === 0) { n.init++; if (cap) { n.initCap++; if (t.upos === 'PROPN') n.initCapProper++; } return; }
      n.mid++; if (cap) n.midCap++;
      if (t.upos === 'PROPN') { n.midProper++; if (cap) n.midProperCap++; } else { n.midOther++; if (cap) n.midOtherCap++; }
    });
    sent = [];
  };
  for (const line of bytes.toString('utf8').split('\n')) {
    if (line.startsWith('# newdoc id') || !line.trim()) { close(); continue; }
    if (line.startsWith('#')) continue;
    const f = line.split('\t');
    if (!/^\d+$/.test(f[0])) continue;
    sent.push({ form: f[1], upos: f[3] });
  }
  close();
}
const rate = (k, of) => +(k / Math.max(1, of)).toFixed(4);
const GROUND = `UD_English-GUM train (${basename(file)})`;
const fig = (figure, k, of, says) => ({ ground: GROUND, sha256, figure, value: rate(k, of), k, of, says });

// ── the received treebank the fourth convention is given by: its own provenance, read, not retyped ───────────────────────────────────────────
const pos = JSON.parse(readFileSync(POS, 'utf8'));
const posGiver = pos.provenance?.giver;
if (!posGiver) { console.log('build-conventions-prior: priors/pos-eng.json names no giver; nothing written.'); process.exit(1); }

const BUILDER = 'scripts/build-conventions-prior.mjs';
const conventions = [
  {
    stem: 'capital-marks-a-name',
    says: 'In a cased script a capital in the middle of a sentence marks a name.',
    scope: 'cased scripts (Latin, Cyrillic, Greek) written in standard orthography',
    address: 'native/adapters/text/surfaces.js::accumulateSurfaceEvidence (CAP_TOKEN, capCounts)',
    giver: null, builder: BUILDER,
    witnesses: [
      fig('nameIsCapitalMidSentence', n.midProperCap, n.midProper, 'of the PROPN tokens that are not first in their sentence, the share written with a capital'),
      fig('nonNameIsCapitalMidSentence', n.midOtherCap, n.midOther, 'of the other tokens that are not first in their sentence, the share written with a capital'),
      fig('capitalMidSentenceIsName', n.midProperCap, n.midCap, 'of the capitalised tokens that are not first in their sentence, the share that are PROPN'),
      'khora native/the-fold/language-context.js header: standard prose, SMS, Singlish and IRC capitalise 2-13% of non-initial tokens, and capitals mostly mark names',
    ],
    basis: 'extracted — measured from the received ground\'s own PROPN tags; a nomination with its witnesses, not a licence',
    departs: ['German capitalises every noun', 'a caseless script has no capital', 'an all-lower-case text (SMS, OCR) keeps none: the case-free floor of surfaces.js stands in'],
  },
  {
    stem: 'capital-opens-a-sentence',
    says: 'The first word of a sentence is capitalised by position, so a sentence-initial capital is no evidence of a name.',
    scope: 'cased scripts; holds where the sentence cut finds the sentence',
    address: 'native/adapters/text/surfaces.js::accumulateSurfaceEvidence (the run scan starts at token 1)',
    giver: null, builder: BUILDER,
    witnesses: [fig('sentenceInitialCapitalIsName', n.initCapProper, n.initCap, 'of the capitalised sentence-initial tokens, the share that are PROPN')],
    basis: 'extracted — measured from the received ground\'s own PROPN tags; a nomination with its witnesses, not a licence',
    departs: ['a name that only ever opens a sentence is invisible to the capital tier: khora organs/hypergraph.js "the referent bar" confirms it by a real pronoun binding (not passed to the reader by read-core.mjs)'],
  },
  {
    stem: 'sentence-end-is-marked',
    says: 'A sentence ends with a terminal mark, so the capital after one opens a sentence.',
    scope: 'running prose; the sentence cut (khora adapters/text/spans.js) reads by it',
    address: 'native/adapters/text/spans.js::splitSentences',
    giver: null, builder: BUILDER,
    witnesses: [fig('sentenceEndsUnmarked', n.unmarked, n.sents, 'of the gold sentences, the share whose last token is no terminal mark (headings, bylines, captions, list items)')],
    basis: 'extracted — measured from the received ground\'s own sentence segmentation; a nomination with its witnesses, not a licence',
    departs: ['a heading, byline or list item run into the next sentence puts that sentence\'s capital in the middle of a cut: the lone capital of "Grab", "Well", "Okay" after one, which the next convention answers'],
  },
  {
    stem: 'treebank-attests-a-forms-use',
    says: 'How a form is used, tag by tag, is attested by a human-annotated treebank; a capital the text cannot test is weighed against that use.',
    scope: 'English; a single-word candidate the text never writes lower-case',
    address: 'native/adapters/text/form-usage.js::formUsageOf, read by native/adapters/text/surfaces.js::surfacesFromEvidence (formUsage)',
    giver: posGiver, builder: null,
    witnesses: [
      { file: 'pos-eng.json', schema: pos.schema, sentences_read: pos.provenance.sentences_read, tokens_read: pos.provenance.tokens_read, distinct_forms: pos.provenance.distinct_forms, source: pos.provenance.source },
      'khora native/adapters/text/wordclass.js::classifyWord is the repo\'s lens over it; nothing is re-read',
      'the ground the cast is scored on (UD_English-GUM) is a different corpus',
    ],
    basis: 'received — the rule\'s giver is a named ground (UD_English-EWT); silent for a form the treebank has not seen, which then stays a being',
    departs: ['the prior is keyed on the case-folded form: a name whose lower-case twin is a function word ("May", "Will") is judged by the twin\'s use, and passes only where the text\'s own capitals nearly balance it', 'no pos prior, or a language other than English: the giver is silent and the capital tier is what it was'],
  },
];

const prior = {
  schema: 'Conventions@1',
  language: 'eng',
  provenance: {
    builder: BUILDER,
    source: `${basename(file)} sha256:${sha256}`,
    note: 'The statements are authored; every figure is measured here from the pinned source, and the fourth convention\'s giver is read from priors/pos-eng.json\'s provenance. nomos.js derives each convention\'s standing from its own giver or builder; a standing written here would not be believed.',
    ground: GROUND,
    counts: n,
  },
  home: 'khora',
  conventions,
};
writeFileSync(OUT, JSON.stringify(prior, null, 1) + '\n');
console.log(`wrote ${OUT}: ${conventions.length} conventions, ${n.sents} sentences, ${n.mid + n.init} tokens read; GUM sha256 ${sha256}`);
