import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unitOf, dictPermute, predEvidence, round1, bucketFn } from './bind-sieve-dict.mjs';
import { makeFold } from '../hyperlexicon/channel-fold.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const T1 = 'text:aaaaaaaaaaaaaaaa', T2 = 'text:bbbbbbbbbbbbbbbb', T3 = 'text:cccccccccccccccc';

const mention = (m, key, cls = 'name', extra = {}) => ({ m, head: m, rows: [m], key, ikey: [key], class: cls, ...extra });
const act = (a, pred) => ({ a, pred, roles: [] });
const group = (texts, members = Object.keys(texts)) => ({ members: [...members].sort(), texts: Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, { acts: v, place: null, doc: null, context: null }])) });

// an injected evidence function over a table of shared counts; records what it was asked
function table(shared, { ant = [], buckets = null, pool = [] } = {}) {
  const asked = [];
  const antSet = new Set(ant.map(([a, b]) => `${a}|${b}`));
  return {
    asked,
    of(u, v) { asked.push([u, v]); const s = shared[`${u}|${v}`] ?? 0; return { shared: s, empty: s === 0 && !(`${u}|${v}` in shared), nulls: [0, 1, 1, 2], n: 4 }; },
    antonym(u, v) { return antSet.has(`${u}|${v}`) || antSet.has(`${v}|${u}`); },
    unitOf: (m) => m.ikey.join(' '),
    words: () => pool,
    bucketOf: buckets ? (w) => (w in buckets ? buckets[w] : null) : undefined,
  };
}

test('proposing: score is the min of both ways, a link with raw evidence and no verdict fields', () => {
  const g = group({ [T1]: { mentions: [mention(0, 'moto')], acts: [] }, [T2]: { mentions: [mention(0, 'motorola')], acts: [] } });
  const ev = table({ 'moto|motorola': 7, 'motorola|moto': 4 });
  const r = round1(g, { on: false }, { passes: 'all', dictPermute: null }, ev, null, []);
  assert.equal(r.links.length, 1);
  const l = r.links[0];
  assert.equal(l.pass, 'dictionary');
  assert.equal(l.round, 1);
  assert.equal(l.a, `${T1}#m0`);
  assert.equal(l.b, `${T2}#m0`);
  assert.equal(l.evidence.score, 4);
  assert.equal(l.evidence.ab.shared, 7);
  assert.equal(l.evidence.ba.shared, 4);
  assert.deepEqual(l.evidence.ab.nulls, [0, 1, 1, 2]);
  assert.equal(l.kinds, null);
  assert.match(l.id, /^[0-9a-f]{16}$/);
  for (const k of ['verdict', 'standing', 'stands', 'held', 'refused', 'same']) assert.ok(!(k in l) && !(k in l.evidence));
});

test('not proposed: score 0, same text, other classes, mentions whose points already agree', () => {
  const g = group({
    [T1]: { mentions: [mention(0, 'moto'), mention(1, 'phone'), mention(2, 'it', 'pronoun')], acts: [] },
    [T2]: { mentions: [mention(0, 'motorola'), mention(1, 'device'), mention(2, 'they', 'pronoun')], acts: [] },
  });
  const ev = table({ 'moto|motorola': 3, 'motorola|moto': 3, 'moto|phone': 9, 'phone|moto': 9, 'it|they': 5, 'they|it': 5, 'phone|device': 2, 'device|phone': 0 });
  const r = round1(g, { on: false }, {}, ev, null, []);
  assert.deepEqual(r.links.map((l) => [l.a, l.b]), [[`${T1}#m0`, `${T2}#m0`]]); // phone|device is 0 one way; pronoun ignored; moto|phone same text
  // a standing link joins moto and motorola in one point: the pair is no longer asked about
  const prior = { id: 'x1', pass: 'identity', a: `${T1}#m0`, b: `${T2}#m0` };
  const r2 = round1(g, { on: false }, {}, ev, { stands: ['x1'], held: [] }, [prior]);
  assert.equal(r2.links.length, 0);
  // held links do not make a point
  const r3 = round1(g, { on: false }, {}, ev, { stands: ['x1'], held: [{ group: 'g', alternatives: [['x1']] }] }, [prior]);
  assert.equal(r3.links.length, 1);
});

test('antonym flag rides the link; the link is still proposed', () => {
  const g = group({ [T1]: { mentions: [mention(0, 'hot', 'description')], acts: [] }, [T2]: { mentions: [mention(0, 'cold', 'description')], acts: [] } });
  const ev = table({ 'hot|cold': 6, 'cold|hot': 6 }, { ant: [['hot', 'cold']] });
  const r = round1(g, { on: false }, {}, ev, null, []);
  assert.equal(r.links.length, 1);
  assert.equal(r.links[0].evidence.antonym, true);
  const none = round1(g, { on: false }, {}, table({ 'hot|cold': 6, 'cold|hot': 6 }), null, []);
  assert.equal(none.links[0].evidence.antonym, false);
});

test('ties of one mention are all proposed, listed as alternatives; a strictly lower pair is not', () => {
  const g = group({
    [T1]: { mentions: [mention(0, 'phone')], acts: [] },
    [T2]: { mentions: [mention(0, 'handset'), mention(1, 'device'), mention(2, 'gadget')], acts: [] },
  });
  const ev = table({ 'phone|handset': 5, 'handset|phone': 5, 'phone|device': 5, 'device|phone': 5, 'phone|gadget': 2, 'gadget|phone': 2 });
  const r = round1(g, { on: false }, {}, ev, null, []);
  assert.deepEqual(r.links.map((l) => l.b).sort(), [`${T2}#m0`, `${T2}#m1`]);
  assert.equal(r.ties.length, 1);
  assert.equal(r.ties[0].mention, `${T1}#m0`);
  assert.equal(r.ties[0].links.length, 2);
  assert.deepEqual(r.ties[0].links, r.links.map((l) => l.id).sort());
});

test('a mention with a stronger partner elsewhere does not propose its weaker pair', () => {
  const g = group({
    [T1]: { mentions: [mention(0, 'a1'), mention(1, 'a2')], acts: [] },
    [T2]: { mentions: [mention(0, 'b1')], acts: [] },
  });
  const ev = table({ 'a1|b1': 9, 'b1|a1': 9, 'a2|b1': 3, 'b1|a2': 3 });
  const r = round1(g, { on: false }, {}, ev, null, []);
  assert.deepEqual(r.links.map((l) => l.a), [`${T1}#m0`]);
});

test('no-dict: no mention link, predEvidence still recorded', () => {
  const g = group({
    [T1]: { mentions: [mention(0, 'moto')], acts: [act(0, 'launch')] },
    [T2]: { mentions: [mention(0, 'motorola')], acts: [act(0, 'release')] },
  });
  const ev = table({ 'moto|motorola': 3, 'motorola|moto': 3, 'launch|release': 8, 'release|launch': 6 });
  const r = round1(g, { on: false }, { passes: 'no-dict' }, ev, null, []);
  assert.deepEqual(r.links, []);
  assert.equal(r.predEvidence.length, 1);
  assert.equal(r.predEvidence[0].score, 6);
  const all = round1(g, { on: false }, { passes: 'all' }, ev, null, []);
  assert.equal(all.links.length, 1);
  assert.deepEqual(all.predEvidence, r.predEvidence);
});

test('predEvidence: cross-text act pairs with different pred only, both ways, antonym, act ids', () => {
  const g = group({
    [T1]: { mentions: [], acts: [act(0, 'open'), act(1, 'run')] },
    [T2]: { mentions: [], acts: [act(0, 'close'), act(1, 'run')] },
  });
  const ev = table({ 'open|close': 4, 'close|open': 5, 'open|run': 1, 'run|open': 1 }, { ant: [['open', 'close']] });
  const pe = predEvidence(g, ev);
  const ids = pe.map((p) => `${p.a}~${p.b}`);
  assert.deepEqual(ids, [`${T1}#a0~${T2}#a0`, `${T1}#a0~${T2}#a1`, `${T1}#a1~${T2}#a0`]); // run|run (equal pred) and same-text pairs are absent
  const oc = pe[0];
  assert.equal(oc.ab.shared, 4);
  assert.equal(oc.ba.shared, 5);
  assert.equal(oc.score, 4);
  assert.equal(oc.antonym, true);
  assert.deepEqual(oc.e, ['open', 'close']);
});

test('kinds: recorded from the kind view when on, null when off', () => {
  const g = group({ [T1]: { mentions: [mention(0, 'moto')], acts: [] }, [T2]: { mentions: [mention(0, 'motorola')], acts: [] } });
  const ev = table({ 'moto|motorola': 2, 'motorola|moto': 2 });
  const kv = { on: true, kindOf: (key) => `k:${key}` };
  assert.deepEqual(round1(g, kv, {}, ev, null, []).links[0].kinds, { a: 'k:moto', b: 'k:motorola' });
  assert.equal(round1(g, { on: false, kindOf: () => 'x' }, {}, ev, null, []).links[0].kinds, null);
});

test('order independence: members presented in two orders give identical output', () => {
  const texts = {
    [T1]: { mentions: [mention(0, 'phone'), mention(1, 'moto')], acts: [act(0, 'launch')] },
    [T2]: { mentions: [mention(0, 'handset'), mention(1, 'motorola')], acts: [act(0, 'release')] },
    [T3]: { mentions: [mention(0, 'device')], acts: [act(0, 'ship')] },
  };
  const sh = { 'phone|handset': 4, 'handset|phone': 4, 'moto|motorola': 3, 'motorola|moto': 3, 'phone|device': 4, 'device|phone': 4, 'launch|ship': 2, 'ship|launch': 2 };
  const run = (members) => JSON.stringify(round1(group(texts, members), { on: false }, {}, table(sh), null, []));
  assert.equal(run([T1, T2, T3]), run([T3, T1, T2]));
  assert.equal(run([T1, T2, T3]), run([T2, T3, T1]));
});

test('dictPermute: reproducible from its seed, a bijection, bucket-preserving, empty ball maps to itself', () => {
  const buckets = { a: 1, b: 1, c: 1, d: 1, e: 2, f: 2, g: 2, h: 3 }; // z has no ball
  const bucketOf = (w) => (w in buckets ? buckets[w] : null);
  const args = { words: ['a', 'b', 'e', 'z'], pool: ['c', 'd', 'f', 'g', 'h', 'z'], bucketOf };
  const m1 = dictPermute({ ...args, seed: 's1' });
  const m2 = dictPermute({ ...args, seed: 's1' });
  assert.deepEqual([...m1], [...m2]);
  const domain = [...new Set([...args.words, ...args.pool])];
  assert.deepEqual([...m1.keys()].sort(), [...domain].sort());
  assert.deepEqual([...m1.values()].sort(), [...domain].sort()); // bijection
  for (const [w, img] of m1) assert.equal(bucketOf(w), bucketOf(img));
  assert.equal(m1.get('z'), 'z');
  assert.equal(m1.get('h'), 'h'); // a bucket of one has only itself
  // reproducible across word order, different under another seed (over several seeds, at least one differs)
  const m3 = dictPermute({ words: [...args.words].reverse(), pool: [...args.pool].reverse(), seed: 's1', bucketOf });
  assert.deepEqual([...m1].sort(), [...m3].sort());
  const others = ['s2', 's3', 's4', 's5', 's6'].map((s) => JSON.stringify([...dictPermute({ ...args, seed: s })]));
  assert.ok(others.some((o) => o !== JSON.stringify([...m1])));
  assert.throws(() => dictPermute({ ...args, seed: 's1', bucketOf: undefined }));
  assert.throws(() => dictPermute({ ...args, seed: '', bucketOf }));
});

test('round1 under dictPermute asks the dictionary about images, leaves antonyms unpermuted, is reproducible', () => {
  const buckets = { moto: 1, motorola: 1, phone: 1, device: 1, handset: 1, tablet: 1 };
  const shared = {};
  for (const x of Object.keys(buckets)) for (const y of Object.keys(buckets)) shared[`${x}|${y}`] = 1 + ((x.length * 7 + y.length * 3) % 5);
  const g = group({ [T1]: { mentions: [mention(0, 'moto')], acts: [] }, [T2]: { mentions: [mention(0, 'motorola')], acts: [] } });
  const mk = () => table(shared, { ant: [['moto', 'motorola']], buckets, pool: ['phone', 'device', 'handset', 'tablet'] });
  const e1 = mk();
  const r1 = round1(g, { on: false }, { dictPermute: 'seed-x' }, e1, null, []);
  const map = dictPermute({ words: ['moto', 'motorola'], pool: ['phone', 'device', 'handset', 'tablet'], seed: 'seed-x', bucketOf: e1.bucketOf });
  assert.deepEqual(e1.asked[0], [map.get('moto'), map.get('motorola')]);
  assert.deepEqual(e1.asked[1], [map.get('motorola'), map.get('moto')]);
  assert.equal(r1.links[0].evidence.antonym, true); // the ant relation of the original pair, not of the images
  assert.equal(r1.links[0].evidence.ab.shared, shared[`${map.get('moto')}|${map.get('motorola')}`]);
  const r2 = round1(g, { on: false }, { dictPermute: 'seed-x' }, mk(), null, []);
  assert.deepEqual(r1, r2);
  assert.throws(() => round1(g, { on: false }, { dictPermute: 'seed-x' }, { ...mk(), bucketOf: undefined }, null, []));
});

test('bucketFn follows word-evidence: radius-1 ball size, ratio 1.25, null for an empty ball', () => {
  const H = fixtureStore({ big: ['n1', 'n2', 'n3', 'n4', 'n5'], small: ['n1'], lonely: [] });
  const fold = makeFold(H);
  const b = bucketFn(fold);
  assert.equal(b('small'), Math.floor(Math.log(1) / Math.log(1.25)));
  assert.equal(b('big'), Math.floor(Math.log(5) / Math.log(1.25)));
  assert.equal(b('lonely'), null);
  assert.equal(b('missing'), null);
});

// a tiny hyperlexicon store: word -> lemma node w:<word>, with translation links to the given nodes
function fixtureStore(words) {
  return {
    answer(ask) {
      if (ask.op === 'names') {
        const surfaces = {};
        for (const s of ask.surfaces) surfaces[s] = { written: s in words ? [{ kind: 'lemma', node: `w:${s}` }] : [] };
        return { surfaces };
      }
      if (ask.op === 'relations') {
        const w = ask.id.replace(/^w:/, '');
        return { links: (words[w] ?? []).map((to) => ({ kind: 'link:translation', to })) };
      }
      return null;
    },
  };
}

test('unitOf: the longest run ending at the head that the store names as a lemma, else the head key', () => {
  const H = fixtureStore({ 'ice cream': ['x'], cream: ['y'], 'new york city': ['z'], city: ['q'] });
  const m = { head: 2, rows: [0, 1, 2], key: 'cream', ikey: ['ice', 'cream'] }; // one row was an article
  assert.equal(unitOf({ ...m, rows: [0, 1], head: 1 }, H), 'ice cream');
  assert.equal(unitOf({ head: 2, rows: [0, 1, 2], key: 'city', ikey: ['new', 'york', 'city'] }, H), 'new york city');
  assert.equal(unitOf({ head: 2, rows: [0, 1, 2], key: 'city', ikey: ['old', 'york', 'city'] }, H), 'city'); // 'old york city' and 'york city' unnamed
  assert.equal(unitOf({ head: 0, rows: [0], key: 'zzz', ikey: ['zzz'] }, H), 'zzz');
  assert.equal(unitOf(m, null), 'cream');
  // rows after the head (post-modifiers) are not part of the run
  assert.equal(unitOf({ head: 1, rows: [0, 1, 2], key: 'cream', ikey: ['ice', 'cream', 'cone'] }, H), 'ice cream');
  // explicit row keys win over ikey; a function store is accepted
  assert.equal(unitOf({ head: 2, rows: [0, 1, 2], key: 'cream', ikey: ['cream'] }, (p) => p === 'the ice cream', ['the', 'ice', 'cream']), 'the ice cream');
});

test('the file imports nothing from the other repos and carries none of the barred names', () => {
  const src = readFileSync(join(here, 'bind-sieve-dict.mjs'), 'utf8');
  const tst = readFileSync(join(here, 'bind-sieve-dict.test.mjs'), 'utf8');
  const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  for (const i of imports) assert.ok(i.startsWith('node:') || i.startsWith('./') || i.startsWith('../'), i);
  for (const i of imports) for (const r of ['kho' + 'ra', 'pene' + 'lope']) assert.ok(!i.toLowerCase().includes(r), i);
  const barred = ['pair-' + 'witness', 'unit-' + 'witness', 'sme' + 'll', 'testi' + 'mony', 'olla' + 'ma', '114' + '34', '114' + '50', 'anthro' + 'pic', 'child_' + 'process', 'fet' + 'ch(', 'node:' + 'http', 'node:' + 'net'];
  for (const b of barred) assert.ok(!src.toLowerCase().includes(b.toLowerCase()), `source mentions ${b}`);
  for (const b of barred) assert.ok(!tst.includes(b), `test mentions ${b}`);
});

test('link ids agree with bind-sieve-r0 when it exists', async () => {
  const p = join(here, 'bind-sieve-r0.mjs');
  if (!existsSync(p)) return;
  const r0 = await import(p);
  const g = group({ [T1]: { mentions: [mention(0, 'moto')], acts: [] }, [T2]: { mentions: [mention(0, 'motorola')], acts: [] } });
  const l = round1(g, { on: false }, {}, table({ 'moto|motorola': 2, 'motorola|moto': 2 }), null, []).links[0];
  assert.equal(l.id, r0.linkId('dictionary', l.a, l.b, l.evidence));
});
