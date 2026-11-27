// roundtrip-standard: R4 (prosification) and R5 (the EOT fixed point) of khora's reading standard (the-fold/reading-standard.mjs), the half that belongs to JANUS (nl-eot.mjs; khora never imports it).
// Spec: handoff/janus-roundtrip-baseline.mjs in clovenbradshaw-ctrl/eodb (67fe48f). This is a NEW ROW, not the same number: the spec cut sentences with a regex and took the first 25 of 5..30 words
// (24% fixed point, 16% surface identical, 13.8% form_unattested). Rule 11 forbids that regex, so the cut here is nl-eot's own (khora's one sentence cut through the codec) and the sentence is kept when
// its EOT has 5..30 tokens: 36 sentences of the same passage (lines 673-760 of Gutenberg pg1342, Pride and Prejudice ch. I). Not comparable to the old row; both are exploratory (no held-out split, one English passage).
// PINNED: the measured numbers below are asserted EXACTLY, so any change in the codec, the priors or the cut is a visible new row (rule 6), never the same number under the same name.
// CONDITIONAL INVARIANTS (no tuned bar): R5: a sentence whose read and write carry NO gap must be a fixed point (100%). R4: a sentence with no gap must be written with its first letter in the case the original had.
// Both FAIL today and are TODO tests: they run, report the measured shortfall, and do not fail the suite. A negative result is a finding: the falsifier is the todo test itself passing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadGrammar, read, write, PRIORS } from './nl-eot.mjs';

const ZEN = process.env.ZENODOTUS_HOME ?? '/home/user/Zenodotus', BOOK = path.join(ZEN, '01-literature-books/gutenberg/pg1342_Pride_and_Prejudice.txt');
const haveEng = fs.readdirSync(PRIORS).some((f) => f.startsWith('ud-parser-eng-')) && fs.existsSync(path.join(PRIORS, 'ud-grammar-eng.json.gz'));
const skip = !fs.existsSync(BOOK) ? `Pride and Prejudice not found at ${BOOK} (set ZENODOTUS_HOME)` : !haveEng ? 'no English grammar priors on disk' : false;
const lem = (rec) => (rec.meaning?.nodes ?? []).map((n) => n.lemma.toLowerCase()).sort().join(' ');
const isLetter = (c) => c.toLowerCase() !== c.toUpperCase();
const letters = (s) => [...s].filter((c) => isLetter(c) || c === ' ').join('').toLowerCase().split(' ').filter(Boolean).join(' ');   // letters and single spaces: no pattern
const upper = (c) => isLetter(c) && c === c.toUpperCase();
const firstLetter = (s) => [...s].find(isLetter) ?? null;

function measure() {
  const passage = fs.readFileSync(BOOK, 'utf8').split('\n').slice(672, 760).map((l) => l.trim()).filter(Boolean).join(' ');
  const G = loadGrammar('eng'), r = read(G, passage), rows = [];
  for (const rec of r.records) {
    const toks = Object.keys(rec.surface.keyOfId).length; if (toks < 5 || toks > 30) continue;
    const w = write(rec, G), r2 = read(G, w.text), gapFree = !(rec.gaps ?? []).length && !(w.gaps ?? []).length;
    const fixed = !r2.gap && r2.records.map(lem).join('|') === lem(rec), original = rec.surface.text, f0 = firstLetter(original), f1 = firstLetter(w.text);
    rows.push({ original, written: w.text, fixed, gapFree, surfaceIdentical: letters(original) === letters(w.text), unattested: (w.gaps ?? []).filter((g) => g.gap === 'form_unattested').length, nodes: rec.meaning.nodes.length, caseKept: f0 && f1 ? upper(f0) === upper(f1) : null });
  }
  const sum = (f) => rows.reduce((a, x) => a + f(x), 0), free = rows.filter((x) => x.gapFree);
  return { rows, sentences: rows.length, fixed: sum((x) => +x.fixed), gapFree: free.length, gapFreeFixed: free.filter((x) => x.fixed).length, surfaceIdentical: sum((x) => +x.surfaceIdentical),
    unattested: sum((x) => x.unattested), nodes: sum((x) => x.nodes), gapFreeCaseKept: free.filter((x) => x.caseKept).length, grammarTau: G.grammar.scores?.orderKendallTau ?? null };
}
let M = null; const measured = () => (M ??= measure());

test('R4/R5 BASELINE (pinned, exploratory, English, pg1342 lines 673-760, janus nl-eot cut): the numbers are asserted exactly, so a change is a new row', { skip }, () => {
  const m = measured(); const got = { sentences: m.sentences, fixed: m.fixed, gapFree: m.gapFree, gapFreeFixed: m.gapFreeFixed, surfaceIdentical: m.surfaceIdentical, unattested: m.unattested, nodes: m.nodes, gapFreeCaseKept: m.gapFreeCaseKept };
  console.log('# R4/R5 baseline', JSON.stringify({ ...got, grammarTau: m.grammarTau }));
  assert.deepEqual(got, PIN, `the round trip changed: record a NEW row (and the date) instead of editing the old number. measured ${JSON.stringify(got)}`);
});

test('R5: for a sentence read and written with NO gap, decode(encode(decode(x))) has the same content lemmas as decode(x): 100%', { skip, todo: 'FAILS today: see the pinned baseline (gap-free sentences that are not a fixed point)' }, () => {
  const m = measured(); const bad = m.rows.filter((x) => x.gapFree && !x.fixed);
  assert.equal(bad.length, 0, `${bad.length} of ${m.gapFree} gap-free sentences are not a fixed point, e.g. IN: ${bad[0]?.original} OUT: ${bad[0]?.written}`);
});

test('R4: encode PROSIFIES: a sentence with no gap is written with the capitalisation its first letter had', { skip, todo: 'FAILS today: prosification rules are not built (capitalisation, punctuation, order, negation, auxiliaries)' }, () => {
  const m = measured(); const bad = m.rows.filter((x) => x.gapFree && x.caseKept === false);
  assert.equal(bad.length, 0, `${bad.length} of ${m.gapFree} gap-free sentences lose the case of their first letter, e.g. IN: ${bad[0]?.original} OUT: ${bad[0]?.written}`);
});

// filled from the first run on this checkout (2026-11-27, janus origin/main b053265 + this branch); the file's own header says what each number is
const PIN = { sentences: 36, fixed: 17, gapFree: 17, gapFreeFixed: 10, surfaceIdentical: 8, unattested: 41, nodes: 283, gapFreeCaseKept: 3 };
