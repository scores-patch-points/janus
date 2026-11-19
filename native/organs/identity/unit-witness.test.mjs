// unit-witness: seam 1's three wordings per clause unit, and the three falsity wordings (CONTRACT B.4, C.1, B.6, C.3).
// A stand-in model server answers here; no model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeUnitWitness, unitRequestBody, FALSITY, FALSITY_NAMES } from './unit-witness.mjs';
import { makeWitness, requestBody, WORDINGS } from './pair-witness.mjs';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'juw-')), 'draws.jsonl');
function server(rule = () => '{"answer":"no"}') {
  const bodies = [];
  const f = async (url, init) => { const body = JSON.parse(init.body); bodies.push(body); return { json: async () => ({ message: { content: rule(body.messages[1].content) } }) }; };
  return { f, bodies };
}
const G = 'The council bought drones in May. They fly at night.';
const SAY = 'the drones fly at night';

test('held: exactly W1, W2, W3, with the whole ground text as PASSAGE and the unit\'s say as SENTENCE', async () => {
  const s = server((m) => (m.startsWith('PASSAGE') ? '{"answer":"yes"}' : m.startsWith('SENTENCE') ? 'garbled' : '{"answer":"no"}'));
  const W = makeUnitWitness(tmp(), { fetchImpl: s.f });
  assert.deepEqual(await W.held(G, SAY), ['yes', 'no', 'unparsed']);   // raw, as given
  assert.deepEqual(s.bodies.map((b) => b.messages[1].content), ['W1', 'W2', 'W3'].map((w) => WORDINGS[w](G, SAY)));
});

test('held draws are seam 1\'s request bodies byte for byte, and share its cache: a draw seam 1 made is not asked again', async () => {
  for (const w of ['W1', 'W2', 'W3']) assert.equal(JSON.stringify(unitRequestBody(w, G, SAY)), JSON.stringify(requestBody(w, G, SAY)));
  const file = tmp();
  await makeWitness(file, { fetchImpl: server(() => '{"answer":"yes"}').f }).witnessPair(G, SAY);   // seam 1: ab = passage G, sentence SAY
  const none = server(() => { throw new Error('asked'); });
  const W = makeUnitWitness(file, { fetchImpl: none.f });
  assert.deepEqual(await W.held(G, SAY), ['yes', 'yes', 'yes']);
  assert.deepEqual([none.bodies.length, W.stats.cached, W.stats.fresh], [0, 3, 0]);
});

test('opposed: exactly F1, F2, F3 as the contract words them, the same system line, model, options and format', async () => {
  assert.equal(FALSITY.F1('P', 'S'), 'PASSAGE: P\n\nSENTENCE: S\n\nDoes the passage say that the sentence is false? Answer yes only if the passage states the opposite of the sentence or the opposite follows directly from what the passage states.');
  assert.equal(FALSITY.F2('P', 'S'), 'According to the passage alone, is the sentence false? Answer yes only if the passage states the opposite of the sentence or the opposite follows directly from what the passage states.\n\nPASSAGE: P\n\nSENTENCE: S');
  assert.equal(FALSITY.F3('P', 'S'), 'SENTENCE: S\n\nPASSAGE: P\n\nCan the sentence be refuted from the passage? Answer yes only if the passage states the opposite of what the sentence says, or the opposite follows directly from what the passage states.');
  const s = server(() => '{"answer":"yes"}');
  const W = makeUnitWitness(tmp(), { fetchImpl: s.f });
  assert.deepEqual(await W.opposed(G, SAY), ['yes', 'yes', 'yes']);
  assert.deepEqual(s.bodies.map((b) => b.messages[1].content), FALSITY_NAMES.map((w) => FALSITY[w](G, SAY)));
  const ref = requestBody('W1', G, SAY);
  for (const b of s.bodies) { assert.deepEqual({ ...b, messages: [b.messages[0]] }, { ...ref, messages: [ref.messages[0]] }); }
});

test('falsifying: falsity keys never collide with held keys, so a held draw never answers a falsity question', async () => {
  const file = tmp();
  await makeUnitWitness(file, { fetchImpl: server(() => '{"answer":"yes"}').f }).held(G, SAY);
  const s = server(() => '{"answer":"no"}');
  const W = makeUnitWitness(file, { fetchImpl: s.f });
  assert.deepEqual(await W.opposed(G, SAY), ['no', 'no', 'no']);
  assert.equal(s.bodies.length, 3);
  const keys = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l).key);
  assert.deepEqual(keys.map((k) => JSON.parse(k)[0]), ['W1', 'W2', 'W3', 'F1', 'F2', 'F3']);
  // and a second witness on the cache asks nothing at all
  const none = server(() => { throw new Error('asked'); });
  const X = makeUnitWitness(file, { fetchImpl: none.f });
  await X.held(G, SAY); await X.opposed(G, SAY);
  assert.equal(none.bodies.length, 0);
});

test('falsifying: no cache file, no witness; an unknown wording is refused', () => {
  assert.throws(() => makeUnitWitness(''), /cache file/);
  assert.throws(() => unitRequestBody('F4', 'p', 's'), /unknown wording/);
});

test('a server that never answers is retried, then the error is thrown, and nothing is cached', async () => {
  const file = tmp();
  let n = 0;
  const W = makeUnitWitness(file, { fetchImpl: async () => { n += 1; return { json: async () => ({ error: 'down' }) }; }, retryMs: 0 });
  await assert.rejects(W.opposed('a', 'b'), /no message/);
  assert.equal(n, 5);
  assert.equal(fs.existsSync(file), false);
});
