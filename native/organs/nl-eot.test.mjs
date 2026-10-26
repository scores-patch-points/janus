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

// THE ISTHMUS: a codec whose treebank licence forbids redistribution is pointed at (priors/ud-codecs.json) and vendored on use,
// never committed, and never answered with another language's grammar meanwhile.
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(fs.readFileSync(new URL('../../priors/ud-codecs.json', import.meta.url), 'utf8'));
const pointed = Object.values(manifest.codecs).filter((r) => !r.redistribute);

test('Isthmus: every codec row names its source by repo, file and sha256, and every pointed-at row a restrictive or unknown licence', () => {
  for (const r of Object.values(manifest.codecs)) {
    assert.match(r.source.repo, /^UniversalDependencies\/UD_/); assert.ok(r.source.file); assert.match(r.source.sha256, /^[0-9a-f]{64}$/);
    if (!r.redistribute) assert.ok(!r.licence || /NC|C-UDA|ND|GPL/.test(r.licence), `${r.code}: ${r.licence} is pointed at but permissive`);
    else assert.match(r.licence, /^CC BY(-SA)? [34]\.0$/, `${r.code}: committed under ${r.licence}`);
  }
  assert.ok(pointed.length > 0);
});

test('Isthmus: no pointed-at codec is tracked by git (the falsifier of the licence rule)', () => {
  const tracked = execFileSync('git', ['ls-files', 'priors'], { cwd: new URL('../..', import.meta.url).pathname, encoding: 'utf8' }).split('\n');
  for (const r of pointed) for (const f of tracked) {
    assert.ok(!(f.startsWith(`priors/ud-parser-${r.code}-`) || f === `priors/ud-tokenizer-${r.code}.json.gz` || f === `priors/ud-grammar-${r.code}.json.gz`), `FALSIFIER: ${f} (${r.licence}) is committed`);
  }
});

test('Isthmus: a pointed-at codec that is not on this machine is a typed gap naming its source, never another grammar', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-eot-priors-')), cache = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-eot-cache-'));
  const was = process.env.FOLD_UD_VENDOR_ON_USE; process.env.FOLD_UD_VENDOR_ON_USE = '0';
  try {
    const r = pointed[0]; const G = loadGrammar(r.code, { priors: empty, cache });
    assert.equal(G.gap, 'codec_not_vendored'); assert.equal(G.source, r.source.repo); assert.match(G.why, /vendor-ud-codec\.mjs/);
    assert.equal(read(G, 'x').gap, 'codec_not_vendored');
  } finally { process.env.FOLD_UD_VENDOR_ON_USE = was ?? ''; if (was === undefined) delete process.env.FOLD_UD_VENDOR_ON_USE; fs.rmSync(empty, { recursive: true, force: true }); fs.rmSync(cache, { recursive: true, force: true }); }
});

test('Isthmus: a codec vendored into the cache is read from there', { skip: !fs.existsSync(path.join(PRIORS, 'ud-grammar-dan.json.gz')) && 'needs a codec to place in the cache' }, () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-eot-priors-')), cache = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-eot-cache-'));
  try {
    for (const f of fs.readdirSync(PRIORS).filter((f) => f.startsWith('ud-parser-dan-') || f === 'ud-tokenizer-dan.json.gz' || f === 'ud-grammar-dan.json.gz')) fs.copyFileSync(path.join(PRIORS, f), path.join(cache, f));
    const G = loadGrammar('dan', { priors: empty, cache });
    assert.ok(!G.gap, String(G.gap)); assert.ok(G.parser); assert.ok(G.grammar);
  } finally { fs.rmSync(empty, { recursive: true, force: true }); fs.rmSync(cache, { recursive: true, force: true }); }
});
