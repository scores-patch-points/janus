// eot-weave: janus reads text, text-codec and text-reading BY KIND from the pharos and writes the EOT of the text at SYN·Pattern.
// The three entries are REAL khora output frozen as a fixture (khora the-fold/pharos-framed.mjs weaveFramedReading on a two-sentence English text); janus imports nothing of khora here: the log is the only seam.
// Needs $PHAROS_LIB (pharos/lib/pharos.mjs) and the English grammar priors; skips with the reason otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDoor } from './pharos-door.mjs';
import { weaveEot, eotOf, EOT_KIND, EOT_GAP_KIND, EOT_CELL, EOT_GAP_CELL } from './eot-weave.mjs';
import { loadGrammar, PRIORS } from './nl-eot.mjs';

const FIX = JSON.parse(fs.readFileSync(new URL('./fixtures/khora-reading.fixture.json', import.meta.url), 'utf8'));
const LIB = process.env.PHAROS_LIB ?? '';
const haveEng = fs.readdirSync(PRIORS).some((f) => f.startsWith('ud-parser-eng-')) && fs.existsSync(path.join(PRIORS, 'ud-grammar-eng.json.gz'));
const skip = !LIB || !fs.existsSync(LIB) ? 'pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)' : !haveEng ? 'no English grammar priors on disk' : false;
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const EXISTENCE_AND_STRUCTURE = ['NUL', 'SIG', 'INS', 'SEG', 'CON', 'SYN'];

// open two doors on one log: "khora" (the test stands in for it, replaying real entries) and janus
async function logWith(mutate = (x) => x) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jeot-')), p = path.join(d, 'pharos.json'); fs.writeFileSync(p, JSON.stringify({ lib: LIB, sha256: sha(LIB) }));
  const khora = await openDoor({ pointer: p, dir: path.join(d, 'log'), log: 'fold', writer: 'khora' }), janus = await openDoor({ pointer: p, dir: path.join(d, 'log'), log: 'fold' });
  assert.equal(khora.on && janus.on, true);
  const ids = new Map();   // addr -> woven id: khora's codec and reading entries are `of` the text entry
  for (const e of mutate(structuredClone(FIX))) {
    if (e.kind === 'kind') { khora.declare(e.body.name, e.body.cell, e.body.why); continue; }
    const w = khora.weave({ cell: e.cell, kind: e.kind, addr: e.addr, body: e.body, of: e.kind === 'text' ? [] : [ids.get(`text:${shaOf}`)] }); assert.ok(w, khora.counts.lastReason); ids.set(e.addr, w.id);
  }
  return { khora, janus };
}
const shaOf = FIX.find((e) => e.kind === 'text').addr.slice('text:'.length);

test('through the door: the EOT of the text is written at SYN·Pattern, of the text, the codec and the reading, with one record per sentence', { skip }, async () => {
  const { janus } = await logWith(); const r = weaveEot(janus);
  assert.deepEqual([r.written, r.refused, r.gaps], [1, 0, []], r.why);
  const [e] = janus.ask([EOT_KIND]); assert.equal(e.cell, EOT_CELL); assert.equal(e.addr, `eot:${shaOf}`); assert.equal(e.of.length, 3);
  assert.equal(e.body.codec, 'eng'); assert.equal(e.body.agrees, true); assert.equal(e.body.records.length, 2); assert.ok(e.body.records.every((x) => x.schema === 'EOTRich@1' && x.language === 'eng'));
  assert.deepEqual(e.body.readingCheck, { khoraSentences: 2, janusSentences: 2, sameCut: true });
  assert.ok(e.body.quotes?.pairs?.length, 'the codec brings its quote table (priors/ud-quotes.json), with its source'); assert.ok(e.body.quotes.source.includes('ud-quotes.json'));
  assert.ok(janus.ask(['text', 'text-codec', 'text-reading']).length === 3, 'the three kinds are read back by kind, none rewritten');
});

test('writing again adds nothing (same body at the same address); the cell is Existence or Structure, never DEF, EVA or REC', { skip }, async () => {
  const { janus } = await logWith(); weaveEot(janus); const again = weaveEot(janus);
  assert.deepEqual([again.written, again.skipped, again.refused], [0, 1, 0]); assert.equal(janus.ask([EOT_KIND]).length, 1);
  for (const c of [EOT_CELL, EOT_GAP_CELL]) assert.ok(EXISTENCE_AND_STRUCTURE.includes(c.split('·')[0]), c); assert.notEqual(EOT_CELL, 'SYN·Ground', 'SYN at Ground is the empty desert cell');
});

test('no declared language is a typed gap, never English by default', { skip }, async () => {
  const { janus } = await logWith((es) => { es.find((e) => e.kind === 'text-codec').body.declared = null; return es; }); const r = weaveEot(janus);
  assert.deepEqual([r.written, r.gaps], [1, ['language_not_declared']]); assert.equal(janus.ask([EOT_KIND]).length, 0); const [g] = janus.ask([EOT_GAP_KIND]); assert.equal(g.cell, EOT_GAP_CELL); assert.equal(g.body.gap, 'language_not_declared');
});

test('no text-codec entry is a typed gap; a codec with no grammar is a typed gap naming it', { skip }, async () => {
  const none = await logWith((es) => es.filter((e) => e.kind !== 'text-codec')); assert.deepEqual(weaveEot(none.janus).gaps, ['no_text_codec']);
  const zzz = await logWith((es) => { es.find((e) => e.kind === 'text-codec').body.declared = 'zzz'; return es; }); assert.deepEqual(weaveEot(zzz.janus).gaps, ['no_grammar']);
});

test('a disagreement between the declared codec and the one found is recorded, not resolved: written under the declared, with agrees false and the found codec named', { skip }, async () => {
  const { janus } = await logWith((es) => { const c = es.find((e) => e.kind === 'text-codec').body; c.chosen = 'pcm'; c.agrees = false; return es; }); weaveEot(janus);
  const [e] = janus.ask([EOT_KIND]); assert.deepEqual([e.body.codec, e.body.foundCodec, e.body.agrees], ['eng', 'pcm', false]);
});

test('a sentence-cut disagreement with the reading rows is reported, not hidden; a door that is off writes nothing and says why', { skip }, async () => {
  const { janus } = await logWith((es) => { const r = es.find((e) => e.kind === 'text-reading').body; r.rows = r.rows.map((x) => ({ ...x, s: 0 })); return es; }); weaveEot(janus);
  assert.deepEqual(janus.ask([EOT_KIND])[0].body.readingCheck, { khoraSentences: 1, janusSentences: 2, sameCut: false });
  const off = weaveEot({ on: false, why: 'no pointer' }); assert.deepEqual([off.written, off.refused, off.why], [0, 1, 'no pointer']);
});

test('pure: eotOf needs a text and says what is missing; it loads the codec it is told to', () => {
  assert.equal(eotOf('x', { text: null, codec: null, reading: null }).gap, 'no_text');
  const seen = []; const r = eotOf('x', { text: { id: 't', body: { text: 'a' } }, codec: { id: 'c', body: { declared: 'qqq' } } }, { grammar: (c) => { seen.push(c); return { gap: 'no_grammar', why: 'fake' }; } });
  assert.deepEqual([seen, r.gap], [['qqq'], 'no_grammar']);
});

test('the codec file brings its quote table: a language in the sidecar has one (with its source), a language without is the typed gap no_quote_table', { skip: !haveEng && 'no English grammar priors on disk' }, () => {
  const G = loadGrammar('eng'); assert.deepEqual(G.quotes.pairs, [['“', '”']]); assert.ok(G.quotes.toggle.includes('"')); assert.ok(G.quotes.source.includes('UDQuotes@1'));
  const j = JSON.parse(fs.readFileSync(path.join(PRIORS, 'ud-quotes.json'), 'utf8')); assert.equal(j.schema, 'UDQuotes@1'); assert.deepEqual(Object.keys(j.codes).sort(), ['deu', 'eng', 'fra', 'ita', 'jpn', 'rus', 'spa', 'zho']);
  const other = fs.readdirSync(PRIORS).filter((f) => f.startsWith('ud-grammar-')).map((f) => f.slice('ud-grammar-'.length, -'.json.gz'.length)).find((c) => !j.codes[c]);
  if (other) { const H = loadGrammar(other); if (!H.gap) { assert.equal(H.quotes, null); assert.ok(H.gaps.some((g) => g.gap === 'no_quote_table'), `${other} must say no_quote_table`); } }
});
