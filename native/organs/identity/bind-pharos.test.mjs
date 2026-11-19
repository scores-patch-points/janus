// Janus plans and weaves the binder's links, points and residues through its own door. The plans are pure and tested on
// hand-written entries in the contract's shapes; the weaving is tested in a temporary pharos directory. The other
// writers (asker, khora, penelope) are this repo's own door opened under those writer names: no other repo is imported.
// The weaving tests need the pharos library: $PHAROS_LIB, else the sibling checkout named by pharos.json's relative path.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDoor } from '../pharos-door.mjs';
import {
  flagsOf, runKeyOf, groupsOf, indexEntries, loadGroup, planBind, planPoints, weaveLinks, weavePoints,
  poolSource, basisOf, sha16,
} from './bind-pharos.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = process.env.PHAROS_LIB ?? path.resolve(HERE, '..', '..', '..', '..', 'claude code', 'pharos', 'lib', 'pharos.mjs');
const skip = fs.existsSync(LIB) ? false : 'pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)';

const A = 'text:aaaaaaaaaaaaaaaa', B = 'text:bbbbbbbbbbbbbbbb', D = 'text:dddddddddddddddd';
const S = (a) => a.slice(5);
const STRINGS = { [A]: 'Acme bought the handset.', [B]: 'Acme bought the phone.', [D]: 'Acme bought the handset. It was cheap.' };

const M = (m, key, cls = 'name') => ({
  m, s: 0, head: m, rows: [m], key, ikey: [key], class: cls,
  feats: { Number: null, Person: null, Gender: null, Poss: null, PronType: null },
  det: [], mods: [], parent: null, at: null, headAt: null, quoted: false,
  brackets: { before: null, after: null }, figure: null, gap: null,
});
const role = (r, m) => ({ role: r, filler: { m }, borrowed: null });
const Act = (a, pred, roles) => ({ a, s: 0, head: a, copular: false, pred, roles, neg: { polarity: [], pronType: [] }, embedded: ['root'], feats: {}, unit: 0 });
const actsBody = (mentions, acts) => ({ reader: 'khora text-acts', rule: 'UD-ACT@1', language: 'en', mentions, acts, sentences: 1 });
const ACTS = {
  [A]: actsBody([M(0, 'acme'), M(1, 'handset', 'description')], [Act(0, 'buy', [role('nsubj', 0), role('obj', 1)])]),
  [B]: actsBody([M(0, 'acme'), M(1, 'phone', 'description')], [Act(0, 'buy', [role('nsubj', 0), role('obj', 1)])]),
  [D]: actsBody([M(0, 'acme'), M(1, 'handset', 'description')], [Act(0, 'buy', [role('nsubj', 0), role('obj', 1)])]),
};
const BOUND = { by: 'test', why: 't', ratified: false, kinds: 'none', kindBound: null, alternatives: { maxCombinations: 64 } };

// a hand-written log: entries with ids, in write order
const logOf = () => {
  const es = [];
  const add = (kind, addr, body = {}, of = []) => { const e = { id: `e${es.length}`, kind, addr, of, body }; es.push(e); return e; };
  const texts = (...ts) => ts.forEach((t) => { add('text', t, { text: STRINGS[t], language: 'en' }); add('text-acts', `acts:${S(t)}`, ACTS[t]); });
  return { es, add, texts };
};
const place = (l, t = A, extra = {}) => l.add('text-place', `place:${S(t)}`, { rule: 'PLACE@1', text: t, document: D, at: [0, 24], occurrences: 1, sentences: [0, 0], mentions: [], acts: [], unmatched: { mentions: 0, acts: 0 }, gap: null, ...extra });
const context = (l, t, k) => l.add('context', `context:${S(t)}:${k}`, { text: t, document: D, k, sentences: [0, 1], whole: k === 'whole', mentions: [], acts: [] });
const pairGroup = (l) => l.add('bind-group', `group:${sha16(A + '\u0000' + B)}`, { texts: [A, B] });
const reasons = (plan) => plan.waiting.map((w) => w.reason);

test('flags and the run key (C.1): sorted, member-order free, sensitive to a context, a kind record, a flag', () => {
  assert.equal(flagsOf({}), '');
  assert.equal(flagsOf({ passes: 'no-dict' }), 'no-dict');
  assert.equal(flagsOf({ dictPermute: 'x1' }), 'dict-permute:x1');
  assert.equal(flagsOf({ passes: 'no-dict', dictPermute: 'x1' }), 'no-dict,dict-permute:x1');
  const base = { group: [B, A], kinds: 'none', contexts: [[B, 2], [A, 1]], flags: '' };
  const k = runKeyOf(base);
  assert.deepEqual(k.body, { group: [A, B], kinds: 'none', contexts: [[A, 1], [B, 2]], flags: '' });
  assert.equal(runKeyOf({ ...base, group: [A, B], contexts: [[A, 1], [B, 2]] }).key, k.key);
  assert.equal(k.key.length, 16);
  assert.notEqual(runKeyOf({ ...base, contexts: [[B, 2], [A, 2]] }).key, k.key);
  assert.notEqual(runKeyOf({ ...base, contexts: [[B, 2], [A, 'whole']] }).key, k.key);
  assert.notEqual(runKeyOf({ ...base, kinds: 'abc' }).key, k.key);
  assert.notEqual(runKeyOf({ ...base, flags: 'no-dict' }).key, k.key);
  assert.notEqual(runKeyOf({ ...base, group: [A, B, D] }).key, k.key);
});

test('groups: bind-group, static set, and every arrival n >= 2 of an arrivals set', () => {
  const l = logOf();
  pairGroup(l);
  l.add('set-question', 'set:s1', { name: 's1', mode: 'static', texts: [D, B, A], temporal: [] });
  l.add('set-question', 'set:s2', { name: 's2', mode: 'arrivals', expected: 3, order: { seed: 'x' } });
  l.add('arrival', 'arrival:s2:1', { set: 'set:s2', text: D, n: 1, temporal: false });
  l.add('arrival', 'arrival:s2:2', { set: 'set:s2', text: A, n: 2, temporal: false });
  l.add('arrival', 'arrival:s2:3', { set: 'set:s2', text: B, n: 3, temporal: false });
  const gs = groupsOf(indexEntries(l.es));
  assert.deepEqual(gs.map((g) => [g.id, g.members]), [
    [`group:${sha16(A + '\u0000' + B)}`, [A, B]], ['set:s1', [A, B, D]], ['set:s2:2', [A, D]], ['set:s2:3', [A, B, D]],
  ]);
});

test('waiting: no bind-bound, no acts, no context for a placed member, no kind-standing; nothing written, no round planned', () => {
  const l = logOf();
  l.add('text', A, { text: STRINGS[A] }); l.add('text', B, { text: STRINGS[B] });
  pairGroup(l);
  assert.deepEqual(reasons(planBind(l.es)), ['no-bind-bound']);
  l.add('bind-bound', 'bind-bound:t', BOUND);
  assert.deepEqual(reasons(planBind(l.es)), ['no-acts']);
  l.add('text-acts', `acts:${S(A)}`, ACTS[A]); l.add('text-acts', `acts:${S(B)}`, ACTS[B]);
  assert.deepEqual(planBind(l.es).todo.map((t) => t.round), [0]);   // nothing placed, nothing awaited

  // a placed member without a context waits; with one it goes on; a gap place reads without a document
  const p = logOf(); p.texts(A, B, D); pairGroup(p); p.add('bind-bound', 'bind-bound:t', BOUND); place(p);
  const w = planBind(p.es);
  assert.deepEqual([w.todo.length, reasons(w), w.counts.byReason], [0, ['no-context'], { 'no-context': 1 }]);
  assert.equal(planPoints(p.es).todo.length, 0);
  context(p, A, 1);
  assert.deepEqual(planBind(p.es).todo.map((t) => [t.round, t.input.group.texts[A].doc.address, t.input.group.texts[A].context.k]), [[0, D, 1]]);
  const g = logOf(); g.texts(A, B, D); pairGroup(g); g.add('bind-bound', 'bind-bound:t', BOUND); place(g, A, { at: null, gap: 'not-in-document' });
  const gp = planBind(g.es);
  assert.deepEqual([gp.todo.length, gp.todo[0].input.group.texts[A].doc, gp.todo[0].runKey.contexts], [1, null, []]);

  // kinds: "standing" waits for a kind-standing, then for its candidates
  const k = logOf(); k.texts(A, B); pairGroup(k);
  const kb = k.add('kind-bound', 'kind-bound:kb1', { name: 'kb1' });
  k.add('bind-bound', 'bind-bound:ks', { ...BOUND, kinds: 'standing', kindBound: 'kind-bound:kb1' });
  assert.deepEqual(reasons(planBind(k.es)), ['no-kind-standing']);
  k.add('kind-standing', 'kind-standing:r1', { record: 'r1', seq: 0, kinds: [], counts: {} }, ['kinds:r1', kb.id]);
  assert.deepEqual(reasons(planBind(k.es)), ['no-kind-candidates']);
  k.add('kind-candidates', 'kinds:r1', { record: 'r1', populations: { entity: { kinds: [] }, predicate: { kinds: [] } } });
  const kp = planBind(k.es);
  assert.deepEqual([kp.todo.length, kp.todo[0].runKey.kinds, kp.todo[0].input.kv.on], [1, 'r1', true]);
  // a kind-standing under another kind-bound is not the live one
  const o = logOf(); o.texts(A, B); pairGroup(o); o.add('kind-bound', 'kind-bound:kb1', {}); const kb2 = o.add('kind-bound', 'kind-bound:kb2', {});
  o.add('bind-bound', 'bind-bound:ks', { ...BOUND, kinds: 'standing', kindBound: 'kind-bound:kb2' });
  o.add('kind-standing', 'kind-standing:r1', { record: 'r1', seq: 0, kinds: [] }, ['kinds:r1', o.es[2].id]);
  assert.deepEqual(reasons(planBind(o.es)), ['no-kind-standing']);
  o.add('kind-standing', 'kind-standing:r2', { record: 'r2', seq: 0, kinds: [] }, ['kinds:r2', kb2.id]);
  assert.deepEqual(reasons(planBind(o.es)), ['no-kind-candidates']);
});

test('the run key changes when a context or a kind record changes; the sieve restarts at round 0 under the new key', () => {
  const p = logOf(); p.texts(A, B, D); pairGroup(p); p.add('bind-bound', 'bind-bound:t', BOUND); place(p); context(p, A, 1);
  const before = planBind(p.es).todo[0];
  assert.equal(before.round, 0);
  context(p, A, 3);   // a wider window: the largest k present is read
  const wider = planBind(p.es).todo[0];
  assert.deepEqual(wider.runKey.contexts, [[A, 3]]);
  assert.notEqual(wider.key, before.key);
  assert.equal(wider.round, 0);
  context(p, A, 'whole');
  assert.deepEqual(planBind(p.es).todo[0].runKey.contexts, [[A, 'whole']]);

  const k = logOf(); k.texts(A, B); pairGroup(k);
  const kb = k.add('kind-bound', 'kind-bound:kb1', {});
  k.add('bind-bound', 'bind-bound:ks', { ...BOUND, kinds: 'standing', kindBound: 'kind-bound:kb1' });
  const cands = (r) => k.add('kind-candidates', `kinds:${r}`, { record: r, populations: { entity: { kinds: [] }, predicate: { kinds: [] } } });
  k.add('kind-standing', 'kind-standing:r1', { record: 'r1', seq: 0, kinds: [] }, ['kinds:r1', kb.id]); cands('r1');
  const k1 = planBind(k.es).todo[0];
  k.add('kind-standing', 'kind-standing:r2', { record: 'r2', seq: 1, kinds: [] }, ['kinds:r2', kb.id]); cands('r2');
  const k2 = planBind(k.es).todo[0];
  assert.deepEqual([k1.runKey.kinds, k2.runKey.kinds, k2.round], ['r1', 'r2', 0]);
  assert.notEqual(k1.key, k2.key);
  // the flags are part of the key too
  assert.notEqual(planBind(k.es, { passes: 'no-dict' }).todo[0].key, k2.key);
  // the same members presented in any order, in any group id, give one plan and one key
  k.add('set-question', 'set:dup', { name: 'dup', mode: 'static', texts: [B, A] });
  assert.equal(planBind(k.es).todo.length, 1);
});

test('loadGroup: kind fields are inert when the bind-bound says none; the group is address-ordered', () => {
  const l = logOf(); l.texts(B, A); l.add('bind-bound', 'bind-bound:t', BOUND);
  const L = loadGroup(indexEntries(l.es), [B, A], { dictPermute: 's' });
  assert.deepEqual([L.waiting, L.group.members, Object.keys(L.group.texts), L.kv.on, L.kinds, L.opts.dictPermute, L.opts.maxCombinations], [null, [A, B], [A, B], false, 'none', 's', 64]);
  assert.deepEqual(L.group.texts[A], { acts: ACTS[A], place: null, doc: null, context: null, rows: null });
});

test('loadGroup: the rows of a member\'s text-reading go with it (they turn a mention\'s mods indexes into words); a missing reading is no reason to wait', () => {
  const l = logOf(); l.texts(A, B); l.add('bind-bound', 'bind-bound:t', BOUND);
  const rows = [{ form: 'the', key: 'the' }, { form: 'big', key: 'big' }, { form: 'cats', key: 'cat' }];
  l.add('text-reading', `reading:${S(A)}`, { language: 'en', reader: {}, rows });
  const L = loadGroup(indexEntries(l.es), [A, B], {});
  assert.equal(L.waiting, null);
  assert.deepEqual(L.group.texts[A].rows, rows);
  assert.equal(L.group.texts[B].rows, null);
});

test('loadGroup: mentions that carry mods indexes make a member wait for its text-reading (no-reading); with it, or with mods that are already words, the group loads', () => {
  const withMods = (t, mods) => ({ ...ACTS[t], mentions: ACTS[t].mentions.map((m, i) => (i === 1 ? { ...m, mods } : m)) });
  const logWith = (mods, readings) => {
    const l = logOf();
    for (const t of [A, B]) { l.add('text', t, { text: STRINGS[t], language: 'en' }); l.add('text-acts', `acts:${S(t)}`, withMods(t, mods)); }
    l.add('bind-bound', 'bind-bound:t', BOUND);
    if (readings) for (const t of [A, B]) l.add('text-reading', `reading:${S(t)}`, { language: 'en', reader: {}, rows: [{ key: 'acme' }, { key: 'buy' }, { key: 'big' }] });
    return l;
  };
  assert.equal(loadGroup(indexEntries(logWith([2], false).es), [A, B], {}).waiting, 'no-reading');
  assert.equal(loadGroup(indexEntries(logWith([2], true).es), [A, B], {}).waiting, null);
  assert.equal(loadGroup(indexEntries(logWith(['big'], false).es), [A, B], {}).waiting, null);
  assert.equal(loadGroup(indexEntries(logWith([], false).es), [A, B], {}).waiting, null);
  const g = logWith([2], false); g.add('bind-group', `group:${sha16(A + '\u0000' + B)}`, { texts: [A, B] });
  assert.deepEqual(planBind(g.es).waiting.map((w) => w.reason), ['no-reading']);
  const ok = logWith([2], true); ok.add('bind-group', `group:${sha16(A + '\u0000' + B)}`, { texts: [A, B] });
  assert.equal(planBind(ok.es).todo[0].input.group.texts[A].rows.length, 3); // the rows reach the sieve's input and the points' input alike
});

test('pool and store come only from the environment; with neither named there is no basis', () => {
  assert.equal(poolSource({}).ok, false);
  assert.equal(basisOf({}).ok, false);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-'));
  const pf = path.join(d, 'pool.json');
  fs.writeFileSync(pf, JSON.stringify({ pool: ['w1', 'w2', 'w3'] }));
  const store = path.join(d, 'store'); fs.mkdirSync(store);
  fs.writeFileSync(path.join(store, 'manifest.json'), '{"v":1}');
  const r = basisOf({ BINDER_POOL: pf, JANUS_HYPERLEXICON: store });
  assert.equal(r.ok, true);
  assert.deepEqual(r.basis, {
    hyperlexicon: { dir: 'store', manifest: crypto.createHash('sha256').update('{"v":1}').digest('hex') },
    pool: { file: 'pool.json', sha256: crypto.createHash('sha256').update(fs.readFileSync(pf)).digest('hex'), size: 3 },
    seed: 'binder-dict', nulls: 50,
  });
  fs.writeFileSync(pf, JSON.stringify({ nope: [] }));
  assert.equal(poolSource({ BINDER_POOL: pf }).ok, false);
});

// ---- weaving in a temporary pharos directory
const setup = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-'));
  const pointer = path.join(d, 'pharos.json');
  fs.writeFileSync(pointer, JSON.stringify({ lib: LIB, sha256: crypto.createHash('sha256').update(fs.readFileSync(LIB)).digest('hex') }));
  return { pointer, dir: path.join(d, 'log') };
};
const BASIS = { hyperlexicon: { dir: 'store', manifest: 'm'.repeat(64) }, pool: { file: 'pool.json', sha256: 'p'.repeat(64), size: 3 }, seed: 'binder-dict', nulls: 50 };
const evidence = () => ({
  of(u, v) { const s = { 'handset|phone': 4, 'phone|handset': 6 }[`${u}|${v}`] ?? 0; return { shared: s, empty: s === 0, nulls: [0, 1], n: 2 }; },
  antonym: () => false,
  unitOf: (m) => m.ikey.join(' '),
  words: () => ['handset', 'phone', 'acme', 'buy'],
});
// the khora and asker entries of the hand-written log, written through the door under their own writer names
async function seed(s) {
  const asker = await openDoor({ ...s, writer: 'asker' }), khora = await openDoor({ ...s, writer: 'khora' }), pen = await openDoor({ ...s, writer: 'penelope' });
  for (const k of ['text', 'bind-group']) asker.declare(k, k === 'text' ? 'INS·Ground' : 'DEF·Figure', 't');
  for (const k of ['text-acts']) khora.declare(k, 'INS·Figure', 't');
  pen.declare('bind-bound', 'DEF·Ground', 't'); pen.declare('link-standing', 'EVA·Figure', 't');
  for (const t of [A, B]) {
    asker.weave({ cell: 'INS·Ground', kind: 'text', addr: t, body: { text: STRINGS[t], language: 'en' } });
    khora.weave({ cell: 'INS·Figure', kind: 'text-acts', addr: `acts:${S(t)}`, body: ACTS[t] });
  }
  asker.weave({ cell: 'DEF·Figure', kind: 'bind-group', addr: `group:${sha16(A + '\u0000' + B)}`, body: { texts: [A, B] } });
  pen.weave({ cell: 'DEF·Ground', kind: 'bind-bound', addr: 'bind-bound:t', body: BOUND });
  return pen;
}
// penelope stands every link proposed so far under the run key
function stand(pen, door, t) {
  const rows = door.fold({ kind: 'bind-links' }).filter((e) => e.addr.startsWith(`links:${t.key}:`) && Number(e.addr.split(':')[2]) <= t.round);
  const cur = rows.find((e) => e.addr === `links:${t.key}:${t.round}`);
  const ids = [...new Set(rows.flatMap((e) => [...e.body.links, ...e.body.acts].map((l) => l.id)))].sort();
  return pen.weave({ cell: 'EVA·Figure', kind: 'link-standing', addr: `link-standing:${t.key}:${t.round}`, of: [cur.id], body: { runKey: t.runKey, round: t.round, fixed: cur.body.fixed, stands: ids, held: [], refused: [], counts: {} } });
}

test('one round: bind-links woven once with its basis and of; a second pass adds nothing while the round is not standing', { skip }, async () => {
  const s = setup();
  const pen = await seed(s);
  const door = await openDoor(s);
  const plan = planBind(door.fold({}));
  assert.deepEqual([plan.todo.length, plan.todo[0].round], [1, 0]);
  const w = weaveLinks(door, plan, { evidence, basis: BASIS });
  assert.deepEqual([w.on, w.refused, w.error, w.woven], [true, 0, null, 2]);   // the kind declaration and one round
  const [e] = door.fold({ kind: 'bind-links' });
  const t = plan.todo[0];
  assert.deepEqual([e.by, e.cell, e.addr], ['janus', 'CON·Figure', `links:${t.key}:0`]);
  assert.deepEqual(e.body.runKey, { group: [A, B], kinds: 'none', contexts: [], flags: '' });
  assert.deepEqual([e.body.round, e.body.fixed, e.body.links.map((l) => l.pass), e.body.counts], [0, false, ['identity'], { proposed: 1, byPass: { identity: 1 } }]);
  assert.deepEqual(e.body.predEvidence, []);
  assert.deepEqual(Object.keys(e.body).sort(), ['acts', 'bridges', 'counts', 'fixed', 'links', 'predEvidence', 'round', 'runKey', 'unresolved']);
  assert.deepEqual(e.basis, { organs: ['janus native/organs/identity/bind-sieve.mjs', 'janus native/organs/hyperlexicon/word-evidence.mjs'], ...BASIS });
  assert.equal(e.of.length, 3);   // two text-acts and the bind-bound
  const again = planBind(door.fold({}));
  assert.deepEqual([again.todo.length, reasons(again)], [0, ['round-not-standing']]);
  assert.deepEqual([weaveLinks(door, again, { evidence: () => { throw new Error('opened'); }, basis: BASIS }).woven, planPoints(door.fold({})).counts.byReason], [0, { 'not-fixed': 1 }]);
  // standing it releases round 1, whose entry records the standing it rests on
  stand(pen, door, t);
  const next = planBind(door.fold({}));
  assert.deepEqual([next.todo.length, next.todo[0].round], [1, 1]);
  assert.equal(next.todo[0].of.length, 4);
  // with no evidence a round of 1 is refused, not faked
  const noEv = weaveLinks(door, next, { basis: BASIS });
  assert.deepEqual([noEv.woven, noEv.error], [0, 'no evidence for a round of 1 or later']);
  // with no basis nothing is written at all
  const noBasis = weaveLinks(door, next, { evidence, basis: null });
  assert.deepEqual([noBasis.woven, /^no basis/.test(noBasis.error)], [0, true]);
});

test('the whole run: rounds to fixed, points and residues once, then a second pass adds nothing', { skip }, async () => {
  const s = setup();
  const pen = await seed(s);
  const door = await openDoor(s);
  let guard = 0;
  for (; guard < 12; guard++) {
    const plan = planBind(door.fold({}));
    if (!plan.todo.length) break;
    const w = weaveLinks(door, plan, { evidence, basis: BASIS });
    assert.deepEqual([w.refused, w.error], [0, null]);
    for (const t of plan.todo) stand(pen, door, t);
  }
  const rounds = door.fold({ kind: 'bind-links' });
  assert.ok(rounds.length >= 4 && rounds.length <= 6, `rounds: ${rounds.length}`);
  assert.deepEqual(rounds.map((e) => e.body.round), rounds.map((_, i) => i));
  assert.deepEqual(rounds.map((e) => e.body.fixed), rounds.map((_, i) => i === rounds.length - 1));
  assert.deepEqual(rounds.at(-1).body.links.concat(rounds.at(-1).body.acts), []);
  assert.deepEqual(rounds[1].body.links.map((l) => l.pass), ['dictionary']);
  assert.equal(rounds[1].body.links[0].evidence.score, 4);
  assert.ok(rounds[2].body.acts.some((l) => l.pass === 'act'));
  assert.deepEqual(planBind(door.fold({})).counts.byReason, { fixed: 1 });

  const pp = planPoints(door.fold({}));
  assert.equal(pp.todo.length, 1);
  const w = weavePoints(door, pp, { evidence, basis: BASIS });
  assert.deepEqual([w.refused, w.error, w.woven], [0, null, 4]);   // two declarations, the points, the one pair's residue
  const key = pp.todo[0].key;
  const [pt] = door.fold({ kind: 'bind-points' }), [rs] = door.fold({ kind: 'bind-residue' });
  assert.deepEqual([pt.cell, pt.addr, pt.of.length, pt.body.runKey], ['SYN·Pattern', `points:${key}`, 2, pp.todo[0].runKey]);
  const lastLinks = rounds.at(-1), lastStanding = door.fold({ kind: 'link-standing' }).at(-1);
  assert.deepEqual([...pt.of].sort(), [lastLinks.id, lastStanding.id].sort());
  assert.ok(pt.body.counts.crossText >= 2);
  const pairSha = sha16(STRINGS[A] + '\u0000' + STRINGS[B]);
  assert.deepEqual([rs.cell, rs.addr, rs.of, rs.body.pair], ['SEG·Figure', `residue:${key}:${pairSha}`, [pt.id], `pair:${pairSha}`]);
  assert.deepEqual([rs.body.a, rs.body.b], [A, B]);
  assert.deepEqual(rs.basis.pool, BASIS.pool);
  for (const body of [pt.body, rs.body]) for (const k of ['verdict', 'standing', 'stands', 'same']) assert.equal(JSON.stringify(body).includes(`"${k}"`), false, k);

  // a second pass: nothing planned, nothing woven, evidence never opened
  const before = door.fold({}).length;
  const p2 = planPoints(door.fold({}));
  assert.deepEqual([p2.todo.length, p2.counts.byReason], [0, { done: 1 }]);
  assert.equal(weavePoints(door, p2, { evidence: () => { throw new Error('opened'); } }).woven, 0);
  assert.equal(weaveLinks(door, planBind(door.fold({})), { evidence: () => { throw new Error('opened'); }, basis: BASIS }).woven, 0);
  assert.equal(door.fold({}).length, before);

  // a missing residue is made good alone; the points are not written twice
  const only = planPoints(door.fold({}).filter((e) => e.kind !== 'bind-residue'));
  assert.deepEqual([only.todo.length, !!only.todo[0].havePoints, only.todo[0].missing.length], [1, true, 1]);

  // a wider context is a new run key: round 0 again, the earlier entries stay
  const khora = await openDoor({ ...s, writer: 'khora' });
  khora.declare('text-place', 'INS·Figure', 't'); khora.declare('context', 'INS·Figure', 't');
  khora.weave({ cell: 'INS·Figure', kind: 'text-acts', addr: `acts:${S(D)}`, body: ACTS[D] });
  const asker = await openDoor({ ...s, writer: 'asker' });
  asker.weave({ cell: 'INS·Ground', kind: 'text', addr: D, body: { text: STRINGS[D], language: 'en' } });
  khora.weave({ cell: 'INS·Figure', kind: 'text-place', addr: `place:${S(A)}`, body: { rule: 'PLACE@1', text: A, document: D, at: [0, 24], occurrences: 1, sentences: [0, 0], mentions: [], acts: [], unmatched: { mentions: 0, acts: 0 }, gap: null } });
  assert.deepEqual(reasons(planBind(door.fold({}))), ['no-context']);
  khora.weave({ cell: 'INS·Figure', kind: 'context', addr: `context:${S(A)}:1`, body: { text: A, document: D, k: 1, sentences: [0, 1], whole: false, mentions: [], acts: [] } });
  const fresh = planBind(door.fold({}));
  assert.deepEqual([fresh.todo.length, fresh.todo[0].round, fresh.todo[0].key === key], [1, 0, false]);
  assert.equal(weaveLinks(door, fresh, { evidence, basis: BASIS }).refused, 0);
  assert.equal(door.fold({ kind: 'bind-links' }).length, rounds.length + 1);
});

test('a door that is off weaves nothing and says why', () => {
  const off = { on: false, why: 'no pointer' };
  for (const w of [weaveLinks(off, { todo: [] }), weavePoints(off, { todo: [] })]) assert.deepEqual([w.on, w.why, w.woven], [false, 'no pointer', 0]);
});

test('this file imports nothing of another repo, no network, no process, no model', () => {
  const src = fs.readFileSync(path.join(HERE, 'bind-pharos.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // code only: the comments name the writers
  const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  for (const i of imports) assert.ok(i.startsWith('node:fs') || i.startsWith('node:path') || i.startsWith('node:crypto') || i.startsWith('./bind-'), i);
  for (const bad of ['http', 'net', 'child_process', 'worker_threads', 'fetch(', 'kho' + 'ra', 'penel' + 'ope', 'pair-wit' + 'ness', 'unit-wit' + 'ness', 'olla' + 'ma', '114' + '34', '114' + '50', '/api/' + 'generate']) {
    assert.equal(src.includes(bad), false, bad);
  }
});
