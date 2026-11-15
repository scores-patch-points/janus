// pair-witness: the composite's witness, copied, returning raw answers only. A stand-in model server answers here;
// no model is called. The byte-for-byte comparison with the composite's witness.mjs runs when the ledger is on this
// machine ($PAIR_WITNESS_REF overrides where); it is imported, never changed, and given its own temporary cache.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeWitness, requestBody, WORDINGS, SYS, MODEL } from './pair-witness.mjs';

const REF = process.env.PAIR_WITNESS_REF ?? '/Users/mlacy/Documents/claude code/ledgers/paraphrase-100/composite/witness.mjs';
const skipRef = fs.existsSync(REF) ? false : `witness.mjs not found at ${REF}`;
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jw-')), 'draws.jsonl');
// a stand-in server: answers by a rule on the user message, records every body it was sent
function server(rule) {
  const bodies = [];
  const f = async (url, init) => { const body = JSON.parse(init.body); bodies.push({ url, body: init.body }); return { json: async () => ({ message: { content: rule(body.messages[1].content) } }) }; };
  return { f, bodies };
}

test('the raw answers come back per direction and wording, never folded into yes/no/gap or same', async () => {
  const s = server((m) => (m.startsWith('PASSAGE: one') ? '{"answer":"yes"}' : m.startsWith('SENTENCE: one') ? 'garbled' : '{"answer":"no"}'));
  const W = makeWitness(tmp(), { fetchImpl: s.f });
  const r = await W.witnessPair('one', 'two');
  // ab: passage "one". W1 starts "PASSAGE: one" (yes), W2 starts "According" (no), W3 starts "SENTENCE: two" (no)
  // ba: passage "two". W1 "PASSAGE: two" (no), W2 (no), W3 "SENTENCE: one" (unparsed)
  assert.deepEqual(r, { ab: ['yes', 'no', 'no'], ba: ['no', 'no', 'unparsed'] });
  assert.deepEqual(Object.keys(r), ['ab', 'ba']);
  assert.equal(s.bodies.length, 6);
});

test('the request is the composite\'s: model, options, format, system line and wording', async () => {
  const b = requestBody('W2', 'P', 'S');
  assert.equal(b.model, MODEL);
  assert.deepEqual(b.options, { temperature: 0, seed: 1, num_predict: 16 });
  assert.deepEqual([b.stream, b.think], [false, false]);
  assert.deepEqual(b.messages, [{ role: 'system', content: SYS }, { role: 'user', content: WORDINGS.W2('P', 'S') }]);
});

test('every draw is cached; a second witness on the same cache asks the model nothing', async () => {
  const file = tmp();
  const s1 = server(() => '{"answer":"yes"}');
  await makeWitness(file, { fetchImpl: s1.f }).witnessPair('a text', 'b text');
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((r) => Object.keys(r)), Array(6).fill(['key', 'w', 'answer', 'ms']));
  assert.deepEqual(lines[0].key, JSON.stringify(['W1', 'a text', 'b text']));
  const s2 = server(() => { throw new Error('asked'); });
  const W2 = makeWitness(file, { fetchImpl: s2.f });
  assert.deepEqual(await W2.witnessPair('a text', 'b text'), { ab: ['yes', 'yes', 'yes'], ba: ['yes', 'yes', 'yes'] });
  assert.deepEqual([s2.bodies.length, W2.stats.cached, W2.stats.fresh], [0, 6, 0]);
});

test('a server that never answers is retried, then the error is thrown, and nothing is cached', async () => {
  const file = tmp();
  let n = 0;
  const W = makeWitness(file, { fetchImpl: async () => { n += 1; return { json: async () => ({ error: 'down' }) }; }, retryMs: 0 });
  await assert.rejects(W.witnessPair('a', 'b'), /no message/);
  assert.equal(n, 5);
  assert.equal(fs.existsSync(file), false);
});

test('byte for byte the composite\'s witness: same request bodies, same cache lines, same answers', { skip: skipRef }, async () => {
  const ref = await import(REF);
  for (const w of ['W1', 'W2', 'W3']) assert.equal(WORDINGS[w]('P x', 'S y'), ref.WORDINGS[w]('P x', 'S y'));
  const rule = (m) => (m.length % 3 === 0 ? '{"answer":"yes"}' : m.length % 3 === 1 ? '{"answer":"no"}' : 'x');
  const pairs = [['The cat sat.', 'A cat was sitting.'], ['It rained "hard"\non Monday.', 'Monday was dry.']];
  // theirs, through a stand-in global fetch
  const theirFile = tmp(), theirs = server(rule), saved = globalThis.fetch;
  globalThis.fetch = theirs.f;
  const T = ref.makeWitness(theirFile), theirAnswers = [];
  try { for (const [a, b] of pairs) { const ab = await T.ask(a, b), ba = await T.ask(b, a); theirAnswers.push({ ab: ab.d, ba: ba.d }); } } finally { globalThis.fetch = saved; }
  // ours
  const ourFile = tmp(), ours = server(rule);
  const W = makeWitness(ourFile, { fetchImpl: ours.f }), ourAnswers = [];
  for (const [a, b] of pairs) ourAnswers.push(await W.witnessPair(a, b));
  assert.deepEqual(ourAnswers, theirAnswers);
  assert.deepEqual(ours.bodies, theirs.bodies);
  const strip = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => { const { ms, ...r } = JSON.parse(l); return r; });
  assert.deepEqual(strip(ourFile), strip(theirFile));
  // and a cache the composite wrote answers here without a call
  const none = server(() => { throw new Error('asked'); });
  const X = makeWitness(theirFile, { fetchImpl: none.f });
  for (const [a, b] of pairs) await X.witnessPair(a, b);
  assert.equal(none.bodies.length, 0);
});
