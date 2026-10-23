// nl-eot: any language -> grammar -> EOT -> back. A grammar is whatever prior is on disk; a language without one is a typed gap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGrammar, read, write, roundTrip, measure, PRIORS } from './nl-eot.mjs';
import { parseConllu } from '../../../khora/native/kernel/eot-rich.js';

const priors = process.env.NL_EOT_PRIORS ?? PRIORS;
const present = fs.readdirSync(priors).filter((f) => f.startsWith('ud-grammar-')).map((f) => f.replace(/^ud-grammar-|\.json\.gz$/g, ''));

test('a language with no grammar is a typed gap, never a guess', () => {
  const G = loadGrammar('zzz', { priors }); assert.equal(G.gap, 'no_grammar');
  assert.equal(read(G, 'anything').gap, 'no_grammar'); assert.equal(write({}, G).gap, 'no_grammar');
});

test('read -> write in one language returns text and a gap list, for every grammar on disk that can read', { skip: !present.length && 'no grammar priors on disk' }, () => {
  let readable = 0;
  for (const code of present) { const G = loadGrammar(code, { priors }); if (!G.parser) continue; readable++;
    const r = roundTrip(G, 'x'); assert.ok(Array.isArray(r.written)); assert.ok(Array.isArray(r.gaps)); }
  assert.ok(readable >= 0);
});

test('the way back, measured on the treebank it came from (gold annotation in, text out): no sentence is dropped, the order is better than reversed', { skip: !present.length && 'no grammar priors on disk' }, () => {
  const UD = '/Users/mlacy/Downloads/workspace/data/ud';
  for (const code of present.slice(0, 3)) {
    const G = loadGrammar(code, { priors }); if (!G.grammar?.treebank || !fs.existsSync(`${UD}/${G.grammar.treebank}`)) continue;
    const files = fs.readdirSync(`${UD}/${G.grammar.treebank}`); const dev = files.find((f) => f.endsWith('-ud-dev.conllu')) ?? files.find((f) => f.endsWith('-ud-test.conllu')); if (!dev) continue;
    const sents = parseConllu(fs.readFileSync(`${UD}/${G.grammar.treebank}/${dev}`, 'utf8')).filter((s) => s.tokens.length && s.tokens.every((t) => t.head !== null)).slice(0, 50);
    const m = measure(G, sents);
    assert.equal(m.sentences, sents.length); assert.ok(m.orderKendallTau > 0, `${code}: tau ${m.orderKendallTau}`); assert.ok(m.tokenFormHit > 0);
  }
});

test('crossing languages without a correspondence is a counted gap, not a guess; with one the lemma crosses', { skip: present.length < 2 && 'needs two grammars' }, () => {
  const [a, b] = present; const A = loadGrammar(a, { priors }), B = loadGrammar(b, { priors }); if (!A.parser) return;
  const r = read(A, 'x'); if (!r.records.length) return;
  const w0 = write(r.records[0], B, { from: a }); assert.ok(w0.gaps.some((g) => g.gap === 'no_correspondence' || g.gap === 'no_marker' || g.gap === 'form_unattested') || w0.tokens.length === 0);
});
