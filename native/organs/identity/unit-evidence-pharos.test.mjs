// unit-evidence-pharos: Janus reads requests, readings and clause units from the shared log and weaves unit-news,
// unit-opposition and set-correspondence back (CONTRACT B.6, C.3, H.6). Needs the pharos library at $PHAROS_LIB.
// The other writers (asker, khora, penelope) are this repo's own door opened under those writer names, writing the
// contract's entries by hand: no other repo is imported. The witness is a stand-in that records what it is asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDoor } from '../pharos-door.mjs';
import { sha16 } from './pair-evidence-pharos.mjs';
import { weaveNews, weaveOppositions, weaveCorrespondences, planNews, UNIT_NEWS_KIND, UNIT_OPPOSITION_KIND, SET_CORRESPONDENCE_KIND } from './unit-evidence-pharos.mjs';

const LIB = process.env.PHAROS_LIB ?? '';
const skip = LIB && fs.existsSync(LIB) ? false : 'pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)';
const RUNNER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'unit-evidence.mjs');
const setup = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jue-'));
  const pointer = path.join(d, 'pharos.json');
  fs.writeFileSync(pointer, JSON.stringify({ lib: LIB, sha256: crypto.createHash('sha256').update(fs.readFileSync(LIB)).digest('hex') }));
  return { pointer, dir: path.join(d, 'log'), root: d };
};

// the fixture's parser: "the", "a", "and" are DET / CCONJ by this fixture's say-so; every other word is a NOUN.
// One clause unit per sentence (the fixture's cut, standing in for Khora's UD-CLAUSE@1).
const FUNC = { the: 'DET', a: 'DET', and: 'CCONJ' };
function rowsOf(text) {
  const rows = [];
  text.split(/\.\s*/).filter(Boolean).forEach((sent, s) => sent.split(' ').forEach((w, k) => rows.push({ s, id: k + 1, form: w, lemma: w.toLowerCase(), upos: FUNC[w.toLowerCase()] ?? 'NOUN', feats: null, head: 0, deprel: 'dep', key: w.toLowerCase() })));
  return rows;
}
function unitsOf(rows) {
  const units = [];
  rows.forEach((r, i) => { if (!units[r.s]) units[r.s] = { u: r.s, s: r.s, rows: [] }; units[r.s].rows.push(i); });
  return units.map((x) => ({ ...x, say: x.rows.map((i) => rows[i].form).join(' '), content: x.rows.filter((i) => rows[i].upos === 'NOUN') }));
}

async function world(s) {
  const asker = await openDoor({ ...s, writer: 'asker' }), khora = await openDoor({ ...s, writer: 'khora' }), pen = await openDoor({ ...s, writer: 'penelope' });
  asker.declare('text', 'INS·Ground', 't'); asker.declare('pair-question', 'DEF·Figure', 't'); asker.declare('set-question', 'DEF·Figure', 't'); asker.declare('arrival', 'INS·Figure', 't');
  khora.declare('text-reading', 'INS·Figure', 't'); khora.declare('clause-units', 'SEG·Figure', 't');
  pen.declare('unit-request', 'DEF·Figure', 't'); pen.declare('opposition-request', 'DEF·Figure', 't');
  const text = (x) => asker.weave({ cell: 'INS·Ground', kind: 'text', addr: `text:${sha16(x)}`, body: { text: x, language: 'en' } });
  const pair = (a, b) => { const ta = text(a), tb = text(b); return asker.weave({ cell: 'DEF·Figure', kind: 'pair-question', addr: `pair:${sha16(a + '\u0000' + b)}`, of: [ta.id, tb.id], body: { a: ta.addr, b: tb.addr } }); };
  const read = (x) => { const te = text(x); return khora.weave({ cell: 'INS·Figure', kind: 'text-reading', addr: `reading:${sha16(x)}`, of: [te.id], body: { reader: 'stand-in', language: 'en', rows: rowsOf(x) } }); };
  const cut = (x, rule = 'UD-CLAUSE@1') => { const r = read(x); const units = unitsOf(r.body.rows); return khora.weave({ cell: 'SEG·Figure', kind: 'clause-units', addr: `units:${sha16(x)}`, of: [r.id], body: { reader: 'stand-in', rule, language: 'en', units, counts: { units: units.length } } }); };
  const unitRequest = (pq, directions) => pen.weave({ cell: 'DEF·Figure', kind: 'unit-request', addr: `unit-request:${pq.addr.slice(5)}`, of: [pq.id], body: { pair: pq.addr, directions, why: 't' } });
  const oppRequest = (news, u) => pen.weave({ cell: 'DEF·Figure', kind: 'opposition-request', addr: `opposition-request:${news.addr.slice(5)}:${u}`, of: [news.id], body: { news: news.addr, u, why: 't' } });
  const staticSet = (name, texts) => asker.weave({ cell: 'DEF·Figure', kind: 'set-question', addr: `set:${name}`, of: texts.map((x) => text(x).id), body: { name, mode: 'static', texts: texts.map((x) => `text:${sha16(x)}`).sort(), temporal: [] } });
  const arrivalSet = (name, expected) => asker.weave({ cell: 'DEF·Figure', kind: 'set-question', addr: `set:${name}`, body: { name, mode: 'arrivals', expected, order: { seed: 't' } } });
  const arrive = (name, n, x) => { const te = text(x); const sq = asker.fold({ addr: `set:${name}` })[0]; return asker.weave({ cell: 'INS·Figure', kind: 'arrival', addr: `arrival:${name}:${n}`, of: [sq.id, te.id], body: { set: `set:${name}`, text: te.addr, n, temporal: false } }); };
  return { asker, khora, pen, text, pair, read, cut, unitRequest, oppRequest, staticSet, arrivalSet, arrive };
}
const evidence = (calls = []) => () => ({ of: (x, y) => { calls.push(`${x}>${y}`); return { shared: 1, empty: false, nulls: [0, 2], n: 2 }; }, basis: { stand: 'in' } });
function stand(answer = () => ['yes', 'no', 'unparsed']) {
  const asked = [];
  return { asked, held: async (p, s) => { asked.push(['held', p, s]); return answer(p, s); }, opposed: async (p, s) => { asked.push(['opposed', p, s]); return ['no', 'no', 'yes']; } };
}
const FORBIDDEN = ['same', 'verdict', 'bound', 'quantile', 'threshold', 'licensed', 'status', 'standing', 'opposed', 'silent', 'notHeld', 'class', 'classes'];
function keysDeep(v, out = new Set()) { if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); } return out; }

const A = 'The cat sat on the mat. The cat ate fish.', B = 'The cat sat on the rug.', C = 'A dog ran. The dog sat.';

test('a door that is off weaves nothing and says why', async () => {
  for (const w of [await weaveNews({ on: false, why: 'no pointer' }, null), await weaveOppositions({ on: false, why: 'no pointer' }, null), weaveCorrespondences({ on: false, why: 'no pointer' })]) assert.deepEqual([w.on, w.why, w.woven], [false, 'no pointer', 0]);
});

test('unit-news waits while a reading or clause-units is missing, and asks nothing while it waits', { skip }, async () => {
  const s = setup(), W = await world(s);
  const pq = W.pair(A, B);
  W.unitRequest(pq, ['ab', 'ba']);
  W.read(A);                                   // A read, not cut; B not read
  const door = await openDoor(s), wit = stand();
  const w = await weaveNews(door, wit, { evidence: () => { throw new Error('opened'); } });
  assert.deepEqual([w.woven, w.plan.counts.waiting, wit.asked.length], [0, 2, 0]);
});

test('one unit-news per requested direction: the right ground and news, the contract\'s body, raw answers, of links', { skip }, async () => {
  const s = setup(), W = await world(s);
  const pq = W.pair(A, B);
  const req = W.unitRequest(pq, ['ab', 'ba']);
  const ua = W.cut(A), ub = W.cut(B);
  const door = await openDoor(s), wit = stand(), calls = [];
  const w = await weaveNews(door, wit, { evidence: evidence(calls) });
  assert.deepEqual([w.woven - 1, w.refused, w.error, w.plan.skipped], [2, 0, null, []]);   // the kind declaration and two news
  const shaAB = pq.addr.slice(5), shaBA = sha16(B + '\u0000' + A);
  const ab = door.fold({ addr: `news:${shaAB}` })[0], ba = door.fold({ addr: `news:${shaBA}` })[0];
  assert.deepEqual([ab.by, ab.cell, ab.kind], ['janus', 'CON·Figure', 'unit-news']);
  // ab: ground a, news b's units; ba the other way round
  assert.deepEqual([ab.body.ground, ab.body.news, ab.body.units.length], [`text:${sha16(A)}`, `text:${sha16(B)}`, 1]);
  assert.deepEqual([ba.body.ground, ba.body.news, ba.body.units.length], [`text:${sha16(B)}`, `text:${sha16(A)}`, 2]);
  const readA = door.fold({ addr: `reading:${sha16(A)}` })[0], readB = door.fold({ addr: `reading:${sha16(B)}` })[0];
  assert.deepEqual([...ab.of].sort(), [req.id, ua.id, ub.id, readA.id, readB.id].sort());
  // pharos stores bodies canonically (keys sorted), so key sets are compared, not key order
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(ab.body), ['ground', 'news', 'rule', 'model', 'units', 'evidence', 'linkNull', 'counts'].sort());
  assert.deepEqual(keys(ab.body.units[0]), ['u', 'say', 'content', 'identical', 'byUnit', 'link', 'pairs', 'held'].sort());
  assert.deepEqual(ab.body.units[0].held, { wordings: ['W1', 'W2', 'W3'], answers: ['yes', 'no', 'unparsed'] });
  assert.deepEqual([ab.body.rule, ab.body.model, ab.body.linkNull.seed, ab.body.linkNull.linked.length], ['UD-CLAUSE@1', 'qwen3:8b', `unit-links:${shaAB}`, 50]);
  assert.deepEqual(ab.body.counts, { units: 1, contentRows: 4, identicalRows: 3, linked: 1, wordPairs: 3, yes: 1, answers: 3 });
  // only B's unmatched "rug" against A's unmatched content rows (cat, sat, on are matched; "the" is not content)
  assert.deepEqual(ab.body.units[0].pairs.map((p) => [p.nw, p.gw]), [['rug', 'mat'], ['rug', 'ate'], ['rug', 'fish']]);
  assert.deepEqual(keys(ab.body.evidence), ['rug\u0000mat', 'rug\u0000ate', 'rug\u0000fish'].sort());
  assert.deepEqual(ab.basis, { organ: 'janus native/organs/identity/unit-news.mjs', evidence: { stand: 'in' } });
  // the witness: passage = the ground's whole text, sentence = each unit's say; nothing else asked
  assert.deepEqual(wit.asked, [['held', A, 'The cat sat on the rug'], ['held', B, 'The cat sat on the mat'], ['held', B, 'The cat ate fish']]);
  // raw: no bound, no reading of answers, no verdict anywhere in the body
  for (const e of [ab, ba]) for (const k of FORBIDDEN) assert.equal(keysDeep(e.body).has(k), false, k);
});

test('request-driven: a direction not requested is never written and its units are never put to the model', { skip }, async () => {
  const s = setup(), W = await world(s);
  const pq = W.pair(A, B);
  W.unitRequest(pq, ['ab']);
  W.cut(A); W.cut(B);
  const W2 = await world(s); W2.cut(C);        // a text nobody asked about
  const door = await openDoor(s), wit = stand();
  await weaveNews(door, wit, { evidence: evidence() });
  assert.equal(door.fold({ kind: UNIT_NEWS_KIND }).length, 1);
  assert.deepEqual(wit.asked.map(([, p]) => p), [A]);   // only passage A (direction ab); B is never a passage
  // the request is re-woven with both directions (classes mode, CONTRACT D.5): only ba is new
  W.unitRequest(pq, ['ab', 'ba']);
  const wit2 = stand();
  const w2 = await weaveNews(door, wit2, { evidence: evidence() });
  assert.deepEqual([w2.woven, w2.plan.counts.done], [1, 1]);
  assert.deepEqual(wit2.asked.map(([, p, x]) => [p, x]), [[B, 'The cat sat on the mat'], [B, 'The cat ate fish']]);
});

test('one unit-news per ORDERED pair however many requests need it; a rerun adds nothing and opens nothing', { skip }, async () => {
  const s = setup(), W = await world(s);
  W.cut(A); W.cut(B);
  // pair (A, B) both ways and pair (B, A) both ways: four directions, two ordered pairs
  W.unitRequest(W.pair(A, B), ['ab', 'ba']);
  W.unitRequest(W.pair(B, A), ['ab', 'ba']);
  const door = await openDoor(s), wit = stand();
  const w = await weaveNews(door, wit, { evidence: evidence() });
  assert.deepEqual([w.plan.counts.directions, w.plan.todo.length, door.fold({ kind: UNIT_NEWS_KIND }).length], [4, 2, 2]);
  assert.equal(wit.asked.length, 3);   // 1 unit of B + 2 units of A, each asked once
  const again = await weaveNews(door, { held: async () => { throw new Error('asked'); } }, { evidence: () => { throw new Error('opened'); } });
  assert.deepEqual([again.woven, again.plan.counts.done, again.error], [0, 4, null]);
});

test('falsifying: two texts cut by different unit rules are skipped as rule-mismatch, not compared', { skip }, async () => {
  const s = setup(), W = await world(s);
  W.unitRequest(W.pair(A, B), ['ab']);
  W.cut(A); W.cut(B, 'RANDOM-CUT@1:seed');
  const door = await openDoor(s), wit = stand();
  const w = await weaveNews(door, wit, { evidence: evidence() });
  assert.equal(w.woven, 0);
  assert.match(w.plan.skipped[0].why, /^rule-mismatch/);
  assert.equal(wit.asked.length, 0);
});

test('a model that fails stops the news pass, keeps what was woven, and reports the error', { skip }, async () => {
  const s = setup(), W = await world(s);
  W.cut(A); W.cut(B); W.cut(C);
  W.unitRequest(W.pair(A, B), ['ab']); W.unitRequest(W.pair(A, C), ['ab']);
  let n = 0;
  const door = await openDoor(s);
  const w = await weaveNews(door, { held: async () => { if (n++) throw new Error('model down'); return ['yes', 'yes', 'yes']; } }, { evidence: evidence() });
  assert.equal(w.error, 'model down');
  assert.equal(door.fold({ kind: UNIT_NEWS_KIND }).length, 1);
});

test('unit-opposition: waits for its unit-news; asks F only about the named unit; skips a unit the news lacks; a rerun adds nothing', { skip }, async () => {
  const s = setup(), W = await world(s);
  W.cut(A); W.cut(B);
  const pq = W.pair(B, A);                     // ab: ground B, news A (two units)
  W.unitRequest(pq, ['ab']);
  const door = await openDoor(s);
  // a request before its news exists waits
  W.pen.weave({ cell: 'DEF·Figure', kind: 'opposition-request', addr: `opposition-request:${pq.addr.slice(5)}:1`, of: [pq.id], body: { news: `news:${pq.addr.slice(5)}`, u: 1, why: 't' } });
  const w0 = await weaveOppositions(door, stand());
  assert.deepEqual([w0.woven, w0.plan.counts.waiting], [0, 1]);
  await weaveNews(door, stand(), { evidence: evidence() });
  const news = door.fold({ kind: UNIT_NEWS_KIND })[0];
  const req7 = W.oppRequest(news, 7);         // no unit 7
  const wit = stand();
  const w = await weaveOppositions(door, wit);
  assert.deepEqual([w.woven - 1, w.plan.skipped], [1, [{ at: req7.addr, why: 'no-such-unit' }]]);
  assert.deepEqual(wit.asked, [['opposed', B, 'The cat ate fish']]);   // only unit 1, only the falsity question, passage = the ground
  const [o] = door.fold({ kind: UNIT_OPPOSITION_KIND });
  const req1 = door.fold({ addr: `opposition-request:${pq.addr.slice(5)}:1` })[0];
  assert.deepEqual([o.addr, o.cell, o.by], [`opposition:${pq.addr.slice(5)}:1`, 'CON·Figure', 'janus']);
  assert.deepEqual([...o.of].sort(), [req1.id, news.id].sort());
  assert.deepEqual(o.body, { ground: `text:${sha16(B)}`, news: `text:${sha16(A)}`, u: 1, say: 'The cat ate fish', model: 'qwen3:8b', wordings: ['F1', 'F2', 'F3'], answers: ['no', 'no', 'yes'] });
  assert.deepEqual(o.basis, { organ: 'janus native/organs/identity/unit-witness.mjs' });
  const again = await weaveOppositions(door, { opposed: async () => { throw new Error('asked'); } });
  assert.deepEqual([again.woven, again.plan.counts.done, again.error], [0, 1, null]);
});

test('falsifying: an opposition-request whose address and body disagree is skipped, never asked', { skip }, async () => {
  const s = setup(), W = await world(s);
  W.cut(A); W.cut(B);
  const pq = W.pair(A, B); W.unitRequest(pq, ['ab']);
  const door = await openDoor(s);
  await weaveNews(door, stand(), { evidence: evidence() });
  const news = door.fold({ kind: UNIT_NEWS_KIND })[0];
  W.pen.weave({ cell: 'DEF·Figure', kind: 'opposition-request', addr: `opposition-request:${news.addr.slice(5)}:0`, of: [news.id], body: { news: news.addr, u: 1, why: 't' } });
  const wit = stand();
  const w = await weaveOppositions(door, wit);
  assert.deepEqual([w.woven, w.plan.counts.skipped, wit.asked.length], [0, 1, 0]);
});

test('a static set of three: one set-correspondence over all members, once every member is cut; a rerun adds nothing', { skip }, async () => {
  const s = setup(), W = await world(s);
  const sq = W.staticSet('three', [A, B, C]);
  const ua = W.cut(A), ub = W.cut(B);
  const door = await openDoor(s);
  const w0 = weaveCorrespondences(door);
  assert.deepEqual([w0.woven, w0.plan.counts.waiting], [0, 1]);   // C not cut yet
  const uc = W.cut(C);
  const w = weaveCorrespondences(door);
  assert.equal(w.woven - 1, 1);
  const [x] = door.fold({ kind: SET_CORRESPONDENCE_KIND });
  assert.deepEqual([x.addr, x.cell, x.by], ['correspondence:three:3', 'CON·Pattern', 'janus']);
  assert.deepEqual([...x.of].sort(), [sq.id, ua.id, ub.id, uc.id].sort());
  assert.deepEqual(Object.keys(x.body).sort(), ['set', 'members', 'rule', 'links', 'components', 'counts', 'null'].sort());
  assert.deepEqual(x.body.members, [A, B, C].map((t) => `text:${sha16(t)}`).sort());
  assert.equal(x.body.null.seed, 'set-links:three:3');
  for (const k of FORBIDDEN) assert.equal(keysDeep(x.body).has(k), false, k);
  assert.equal(weaveCorrespondences(door).woven, 0);
});

test('bodies in motion: one correspondence per arrival, and two arrival orders end in the identical correspondence', { skip }, async () => {
  const bodies = [];
  for (const order of [[A, B, C], [C, A, B]]) {
    const s = setup(), W = await world(s);
    W.arrivalSet('moving', 3);
    for (const t of [A, B, C]) W.cut(t);
    const door = await openDoor(s);
    order.forEach((t, k) => { W.arrive('moving', k + 1, t); weaveCorrespondences(door); });   // a pass after each arrival
    const xs = door.fold({ kind: SET_CORRESPONDENCE_KIND });
    assert.deepEqual(xs.map((e) => e.addr), ['correspondence:moving:1', 'correspondence:moving:2', 'correspondence:moving:3']);
    assert.deepEqual(xs.map((e) => e.body.members.length), [1, 2, 3]);
    const arr3 = door.fold({ addr: 'arrival:moving:3' })[0];
    assert.ok(xs[2].of.includes(arr3.id));
    bodies.push(xs[2].body);
  }
  assert.deepEqual(bodies[0], bodies[1]);
});

test('falsifying: an arrival that names another set stops the memberships at the arrival before it', { skip }, async () => {
  const s = setup(), W = await world(s);
  W.arrivalSet('m', 3); W.arrivalSet('other', 1);
  for (const t of [A, B]) W.cut(t);
  W.arrive('m', 1, A);
  W.asker.weave({ cell: 'INS·Figure', kind: 'arrival', addr: 'arrival:m:2', of: [], body: { set: 'set:other', text: `text:${sha16(B)}`, n: 2, temporal: false } });
  const door = await openDoor(s);
  const w = weaveCorrespondences(door);
  assert.deepEqual(door.fold({ kind: SET_CORRESPONDENCE_KIND }).map((e) => e.addr), ['correspondence:m:1']);
  assert.match(w.plan.skipped[0].why, /arrival 2/);
});

test('the runner: door off exits 1; news without a draw cache exits 2 and writes nothing; correspond writes once, then nothing', { skip }, async () => {
  const s = setup(), W = await world(s);
  W.staticSet('three', [A, B, C]); for (const t of [A, B, C]) W.cut(t);
  const env = { ...process.env, JANUS_PHAROS_JSON: s.pointer, PHAROS: s.dir, PHAROS_LOG: 'fold' };
  const run = (mode, extra = {}) => spawnSync(process.execPath, [RUNNER, mode], { env: { ...env, ...extra }, encoding: 'utf8' });
  assert.equal(run('correspond', { JANUS_PHAROS_JSON: path.join(s.root, 'none.json') }).status, 1);
  const r0 = run('news', { PAIR_WITNESS_CACHE: '' });
  assert.equal(r0.status, 2); assert.match(r0.stderr, /PAIR_WITNESS_CACHE/);
  const r0b = run('oppose', { PAIR_WITNESS_CACHE: path.join(s.root, 'missing.jsonl') });
  assert.equal(r0b.status, 2);
  const r1 = run('correspond');
  assert.equal(r1.status, 0, r1.stderr); assert.match(r1.stdout, /wove 2/);   // the kind and one entry
  const r2 = run('correspond');
  assert.equal(r2.status, 0); assert.match(r2.stdout, /wove 0/);
  // news with an existing cache and nothing requested: no model, no hyperlexicon, nothing written, exit 0
  const cache = path.join(s.root, 'draws.jsonl'); fs.writeFileSync(cache, '');
  const r3 = run('news', { PAIR_WITNESS_CACHE: cache, JANUS_HYPERLEXICON: path.join(s.root, 'no-hl') });
  assert.equal(r3.status, 0, r3.stderr); assert.match(r3.stdout, /wove 0/);
  assert.equal(planNews((await openDoor(s)).fold({})).todo.length, 0);
});
