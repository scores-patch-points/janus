import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sieveRound, runRounds } from './bind-sieve.mjs';
import { round0 } from './bind-sieve-r0.mjs';

const A = 'text:aaaaaaaaaaaaaaaa';
const B = 'text:bbbbbbbbbbbbbbbb';

const M = (m, key, cls = 'name') => ({
  m, s: 0, head: m, rows: [m], key, ikey: [key], class: cls,
  feats: { Number: null, Person: null, Gender: null, Poss: null, PronType: null },
  det: [], mods: [], parent: null, at: null, headAt: null, quoted: false,
  brackets: { before: null, after: null }, figure: null, gap: null,
});
const role = (r, m) => ({ role: r, filler: { m }, borrowed: null });
const Act = (a, pred, roles) => ({
  a, s: 0, head: a, copular: false, pred, roles, neg: { polarity: [], pronType: [] }, embedded: ['root'], feats: {}, unit: 0,
});
const body = (mentions, acts) => ({ reader: 'text-acts', rule: 'UD-ACT@1', language: 'en', mentions, acts, sentences: 1 });
const T = (acts) => ({ acts, place: null, doc: null, context: null });

// A: "Acme bought the handset"; B: "Acme bought the phone". Equal names (round 0), synonyms (round 1), an act (round 2).
function makeGroup(order = [A, B]) {
  const texts = {
    [A]: T(body([M(0, 'acme'), M(1, 'handset', 'description')], [Act(0, 'buy', [role('nsubj', 0), role('obj', 1)])])),
    [B]: T(body([M(0, 'acme'), M(1, 'phone', 'description')], [Act(0, 'buy', [role('nsubj', 0), role('obj', 1)])])),
  };
  const ordered = {};
  for (const k of order) ordered[k] = texts[k];
  return { members: [...order], texts: ordered };
}

function table(shared = {}, { ant = [] } = {}) {
  const asked = [];
  return {
    asked,
    of(u, v) { asked.push([u, v]); const s = shared[`${u}|${v}`] ?? 0; return { shared: s, empty: s === 0, nulls: [0, 1], n: 2 }; },
    antonym: (u, v) => ant.some(([x, y]) => (x === u && y === v) || (x === v && y === u)),
    unitOf: (m) => m.ikey.join(' '),
    words: () => ['handset', 'phone', 'acme', 'buy'],
  };
}

const none = { kinds: 'none', maxCombinations: 64, passes: 'all', dictPermute: null };
const evid = () => table({ 'handset|phone': 4, 'phone|handset': 6 });
const standAll = (rec, ctx) => ctx.links.map((l) => l.id);

test('the round loop reaches fixed, one dispatch per round, links new under the run key', () => {
  const recs = runRounds({ group: makeGroup(), kv: null, opts: none, evidence: evid(), runKey: 'rk' }, standAll);
  const last = recs.at(-1);
  assert.equal(last.fixed, true);
  assert.deepEqual(last.links, []);
  assert.deepEqual(last.acts, []);
  assert.deepEqual(recs.map((r) => r.round), recs.map((_, i) => i));
  assert.ok(recs.length >= 4 && recs.length <= 6, `rounds: ${recs.length}`);
  assert.deepEqual(recs.slice(0, -1).map((r) => r.fixed), recs.slice(0, -1).map(() => false));
  const ids = recs.flatMap((r) => [...r.links, ...r.acts].map((l) => l.id));
  assert.equal(new Set(ids).size, ids.length, 'no id repeated across rounds');
  for (const r of recs) for (const l of [...r.links, ...r.acts]) assert.equal(l.round, r.round);
  assert.ok(recs.every((r) => r.runKey === 'rk'));
});

test('each round dispatches to its module', () => {
  const recs = runRounds({ group: makeGroup(), kv: null, opts: none, evidence: evid() }, standAll);
  assert.deepEqual(recs[0].links.map((l) => l.pass), ['identity']); // round 0: P1 identity of 'acme'
  assert.deepEqual(recs[1].links.map((l) => l.pass), ['dictionary']); // round 1: P4 handset/phone
  assert.equal(recs[1].links[0].evidence.score, 4);
  assert.ok(recs[1].predEvidence.length === 0); // same pred: no predEvidence pair
  assert.ok(recs[2].acts.some((l) => l.pass === 'act')); // round 2: 5a
  assert.equal(recs[0].counts.links, 1);
  assert.deepEqual(recs[0].counts.byPass, { identity: 1 });
  assert.deepEqual(recs[0].predEvidence, []);
  // round 0 equals the module's own output (nothing added or lost but the round stamp and order)
  const direct = round0(makeGroup(), { on: false }, none).links;
  assert.deepEqual(recs[0].links.map((l) => l.id), direct.map((l) => l.id));
});

test('byte-identical output for the same group with members presented in two orders', () => {
  const run = (order) => JSON.stringify(runRounds({ group: makeGroup(order), kv: null, opts: none, evidence: evid(), runKey: 'rk' }, standAll));
  assert.equal(run([A, B]), run([B, A]));
  const one = (order) => JSON.stringify(sieveRound({ group: makeGroup(order), opts: none, evidence: evid(), round: 0 }));
  assert.equal(one([A, B]), one([B, A]));
});

test("passes:'no-dict' reaches round 1 as no link, round 2 still runs over round 0's standing", () => {
  const opts = { ...none, passes: 'no-dict' };
  const ev = evid();
  const recs = runRounds({ group: makeGroup(), kv: null, opts, evidence: ev }, standAll);
  assert.deepEqual(recs[1].links, []);
  assert.equal(recs[1].fixed, false, 'an empty round 1 does not end the loop');
  assert.equal(recs.flatMap((r) => r.links).filter((l) => l.pass === 'dictionary').length, 0);
  assert.equal(ev.asked.length, 0, 'the dictionary was not asked');
  assert.ok(recs.length >= 3 && recs.at(-1).fixed);
  assert.ok(recs[2].acts.length >= 1, 'two shared fillers (L=2) still give an act link');
});

test('predEvidence is carried for acts with different preds, in round 1 and later', () => {
  const g = makeGroup();
  g.texts[B].acts.acts[0].pred = 'purchase';
  const ev = table({ 'buy|purchase': 3, 'purchase|buy': 5, 'handset|phone': 1, 'phone|handset': 1 });
  const r1 = sieveRound({ group: g, opts: none, evidence: ev, round: 1, standing: { runKey: 'rk', round: 0, fixed: false, stands: [], held: [], refused: [] }, prior: [] });
  assert.equal(r1.predEvidence.length, 1);
  assert.equal(r1.predEvidence[0].score, 3);
  assert.equal(r1.counts.predEvidence, 1);
  const r2 = sieveRound({ group: g, opts: none, evidence: ev, round: 2, standing: { runKey: 'rk', round: 1, fixed: false, stands: [], held: [], refused: [] }, prior: [] });
  assert.equal(r2.predEvidence.length, 1);
});

test("kinds:'none' keeps every kind field null; 'standing' reaches the modules with the kind view", () => {
  const kv = { on: true, recordSha: 's', kindOf: (key) => (key === 'acme' ? 'k:org' : null), slotCount: () => null, sameKind: () => null, companyCount: () => 0 };
  const off = sieveRound({ group: makeGroup(), kv, opts: { ...none, kinds: 'none' }, evidence: evid(), round: 0 });
  assert.ok(off.links.every((l) => l.kinds === null));
  const onR = sieveRound({ group: makeGroup(), kv, opts: { ...none, kinds: 'standing' }, evidence: evid(), round: 0 });
  assert.deepEqual(onR.links[0].kinds, { a: 'k:org', b: 'k:org' });
  // an inert view with 'standing' stays null too
  const inert = sieveRound({ group: makeGroup(), kv: null, opts: { ...none, kinds: 'standing' }, evidence: evid(), round: 0 });
  assert.ok(inert.links.every((l) => l.kinds === null));
  const r1 = sieveRound({ group: makeGroup(), kv, opts: { ...none, kinds: 'standing' }, evidence: evid(), round: 1, standing: null, prior: [] });
  assert.deepEqual(r1.links.find((l) => l.pass === 'dictionary').kinds, { a: null, b: null });
});

test('dictPermute reaches the dictionary: the store is asked about images, not the words', () => {
  const asked = [];
  const ev = {
    of(u, v) { asked.push([u, v]); return { shared: 0, empty: true, nulls: [], n: 0 }; },
    antonym: () => false,
    unitOf: (m) => m.ikey.join(' '),
    words: () => ['handset', 'phone', 'acme', 'buy', 'alpha', 'beta', 'gamma', 'delta'],
    bucketOf: () => 1,
  };
  sieveRound({ group: makeGroup(), opts: { ...none, dictPermute: 'seed-1' }, evidence: ev, round: 1, standing: null, prior: [] });
  const plain = [];
  const ev2 = { ...ev, of(u, v) { plain.push([u, v]); return { shared: 0, empty: true, nulls: [], n: 0 }; } };
  sieveRound({ group: makeGroup(), opts: none, evidence: ev2, round: 1, standing: null, prior: [] });
  assert.ok(asked.length > 0 && plain.length > 0);
  assert.notDeepEqual(asked, plain);
  // reproducible from its seed
  const again = [];
  sieveRound({ group: makeGroup(), opts: { ...none, dictPermute: 'seed-1' }, evidence: { ...ev, of(u, v) { again.push([u, v]); return { shared: 0, empty: true, nulls: [], n: 0 }; } }, round: 1, standing: null, prior: [] });
  assert.deepEqual(again, asked);
});

test('a link already in prior is not proposed again; held-out ids are dropped, the round can then be fixed', () => {
  const g = makeGroup();
  const first = sieveRound({ group: g, opts: none, evidence: evid(), round: 0 });
  assert.equal(first.links.length, 1);
  const again = sieveRound({ group: g, opts: none, evidence: evid(), round: 0, prior: first.links });
  assert.deepEqual(again.links, []);
  assert.equal(again.fixed, false, 'round 0 is never the end of the loop');
  const later = sieveRound({ group: g, opts: none, evidence: table(), round: 2, standing: { runKey: 'rk', round: 1, fixed: false, stands: [], held: [], refused: [] }, prior: [first] });
  assert.equal(later.fixed, true);
  assert.deepEqual(later.links, []);
});

test('the record carries the card shape and no verdict field; missing evidence proposes no dictionary link', () => {
  const rec = sieveRound({ group: makeGroup(), opts: none, evidence: null, round: 1, standing: null, prior: [] });
  assert.deepEqual(Object.keys(rec).sort(), ['acts', 'bridges', 'counts', 'fixed', 'links', 'predEvidence', 'round', 'runKey', 'unresolved']);
  assert.deepEqual(rec.links, []);
  const json = JSON.stringify(sieveRound({ group: makeGroup(), opts: none, evidence: evid(), round: 0 }));
  for (const k of ['verdict', 'stands', 'held', 'refused', 'standing', 'same']) assert.ok(!json.includes(`"${k}":`), k);
  assert.ok(!('fixed' in rec.links), 'fixed lives only at round.fixed');
});

test('pure and walled: no repo import, no network, no model strings', () => {
  const src = readFileSync(fileURLToPath(new URL('./bind-sieve.mjs', import.meta.url)), 'utf8');
  for (const bad of ['khora', 'penelope', 'node:http', 'node:net', 'child_process', 'fetch(', 'ollama', '11434', '11450', 'anthropic', 'pair-witness', 'unit-witness', 'smell', 'testimony', '/api/generate', '/api/chat', '/api/embed']) {
    assert.ok(!src.toLowerCase().includes(bad.toLowerCase()), bad);
  }
  for (const m of src.matchAll(/from\s+'([^']+)'/g)) assert.match(m[1], /^\.\/bind-sieve-(r0|dict|struct)\.mjs$/);
});
