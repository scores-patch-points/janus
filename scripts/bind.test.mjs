// scripts/bind.mjs is a thin runner: flags parsed, the log opened through Janus's door, the plan and the weaving left to
// bind-pharos.mjs. These tests parse flags purely and run main() over a temporary pharos directory with hand-written
// entries in the contract's shapes. Weaving tests need the pharos library: $PHAROS_LIB, else the sibling checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDoor } from '../native/organs/pharos-door.mjs';
import { sha16 } from '../native/organs/identity/bind-pharos.mjs';
import { parseArgs, main, USAGE } from './bind.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = process.env.PHAROS_LIB ?? path.resolve(HERE, '..', '..', 'claude code', 'pharos', 'lib', 'pharos.mjs');
const skip = fs.existsSync(LIB) ? false : 'pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)';

test('flags: mode first, --passes no-dict, --dict-permute <seed>, in any order, either spelling', () => {
  assert.deepEqual(parseArgs(['links']), { ok: true, mode: 'links', opts: { passes: 'all', dictPermute: null }, error: null });
  assert.deepEqual(parseArgs(['points']).opts, { passes: 'all', dictPermute: null });
  assert.deepEqual(parseArgs(['links', '--passes', 'no-dict']).opts, { passes: 'no-dict', dictPermute: null });
  assert.deepEqual(parseArgs(['links', '--dict-permute', 's1']).opts, { passes: 'all', dictPermute: 's1' });
  assert.deepEqual(parseArgs(['points', '--dict-permute=s1', '--passes=no-dict']).opts, { passes: 'no-dict', dictPermute: 's1' });
  assert.deepEqual(parseArgs(['links', '--dict-permute', '7', '--passes', 'no-dict']).opts, { passes: 'no-dict', dictPermute: '7' });
});

test('flags: anything else is a usage error and names what was wrong', () => {
  for (const argv of [[], ['judge'], ['links', 'extra'], ['links', '--passes'], ['links', '--passes', 'all'], ['links', '--passes', 'no-dict', '--passes', 'no-dict'],
    ['links', '--dict-permute'], ['links', '--dict-permute', '--passes', 'no-dict'], ['links', '--dict-permute='], ['links', '--bogus', 'x']]) {
    const r = parseArgs(argv);
    assert.deepEqual([r.ok, r.mode, r.opts], [false, null, null], JSON.stringify(argv));
    assert.equal(typeof r.error, 'string');
  }
  const errs = []; const outs = [];
  return main(['judge'], { err: (s) => errs.push(s), out: (s) => outs.push(s) }).then((code) => {
    assert.equal(code, 2);
    assert.deepEqual([outs.length, errs[0].endsWith(USAGE)], [0, true]);
  });
});

// ---- a hand-written log in a temporary pharos directory
const A = 'text:aaaaaaaaaaaaaaaa', B = 'text:bbbbbbbbbbbbbbbb';
const S = (a) => a.slice(5);
const STRINGS = { [A]: 'Acme bought the handset.', [B]: 'Acme bought the phone.' };
const M = (m, key, cls = 'name') => ({
  m, s: 0, head: m, rows: [m], key, ikey: [key], class: cls,
  feats: { Number: null, Person: null, Gender: null, Poss: null, PronType: null },
  det: [], mods: [], parent: null, at: null, headAt: null, quoted: false,
  brackets: { before: null, after: null }, figure: null, gap: null,
});
const role = (r, m) => ({ role: r, filler: { m }, borrowed: null });
const Act = (a, pred, roles) => ({ a, s: 0, head: a, copular: false, pred, roles, neg: { polarity: [], pronType: [] }, embedded: ['root'], feats: {}, unit: 0 });
const actsBody = (mentions, acts) => ({ reader: 'stand-in reader', rule: 'UD-ACT@1', language: 'en', mentions, acts, sentences: 1 });
const ACTS = {
  [A]: actsBody([M(0, 'acme'), M(1, 'handset', 'description')], [Act(0, 'buy', [role('nsubj', 0), role('obj', 1)])]),
  [B]: actsBody([M(0, 'acme'), M(1, 'phone', 'description')], [Act(0, 'buy', [role('nsubj', 0), role('obj', 1)])]),
};
const BOUND = { by: 'test', why: 't', ratified: false, kinds: 'none', kindBound: null, alternatives: { maxCombinations: 64 } };
const BASIS = { hyperlexicon: { dir: 'store', manifest: 'm'.repeat(64) }, pool: { file: 'pool.json', sha256: 'p'.repeat(64), size: 3 }, seed: 'binder-dict', nulls: 50 };
const evidence = () => ({
  of(u, v) { const s = { 'handset|phone': 4, 'phone|handset': 6 }[`${u}|${v}`] ?? 0; return { shared: s, empty: s === 0, nulls: [0, 1], n: 2 }; },
  antonym: () => false,
  unitOf: (m) => m.ikey.join(' '),
  words: () => ['handset', 'phone', 'acme', 'buy'],
  bucketOf: (w) => w.length % 2,
});

const setup = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bindrun-'));
  const pointer = path.join(d, 'pharos.json');
  fs.writeFileSync(pointer, JSON.stringify({ lib: LIB, sha256: crypto.createHash('sha256').update(fs.readFileSync(LIB)).digest('hex') }));
  return { pointer, dir: path.join(d, 'log') };
};
async function seed(s) {
  const asker = await openDoor({ ...s, writer: 'asker' }), reader = await openDoor({ ...s, writer: 'reader' }), pen = await openDoor({ ...s, writer: 'judge' });
  asker.declare('text', 'INS·Ground', 't'); asker.declare('bind-group', 'DEF·Figure', 't');
  reader.declare('text-acts', 'INS·Figure', 't');
  pen.declare('bind-bound', 'DEF·Ground', 't'); pen.declare('link-standing', 'EVA·Figure', 't');
  for (const t of [A, B]) {
    asker.weave({ cell: 'INS·Ground', kind: 'text', addr: t, body: { text: STRINGS[t], language: 'en' } });
    reader.weave({ cell: 'INS·Figure', kind: 'text-acts', addr: `acts:${S(t)}`, body: ACTS[t] });
  }
  asker.weave({ cell: 'DEF·Figure', kind: 'bind-group', addr: `group:${sha16(A + '\u0000' + B)}`, body: { texts: [A, B] } });
  pen.weave({ cell: 'DEF·Ground', kind: 'bind-bound', addr: 'bind-bound:t', body: BOUND });
  return pen;
}
// the judge stands every link proposed so far, for each round that has no standing yet
function standAll(pen, door) {
  let n = 0;
  const have = new Set(door.fold({ kind: 'link-standing' }).map((e) => e.addr));
  for (const e of door.fold({ kind: 'bind-links' })) {
    const [, key, r] = e.addr.split(':');
    if (have.has(`link-standing:${key}:${r}`)) continue;
    const ids = door.fold({ kind: 'bind-links' }).filter((x) => x.addr.startsWith(`links:${key}:`) && Number(x.addr.split(':')[2]) <= Number(r))
      .flatMap((x) => [...x.body.links, ...x.body.acts].map((l) => l.id));
    pen.weave({ cell: 'EVA·Figure', kind: 'link-standing', addr: `link-standing:${key}:${r}`, of: [e.id], body: { runKey: e.body.runKey, round: Number(r), fixed: e.body.fixed, stands: [...new Set(ids)].sort(), held: [], refused: [], counts: {} } });
    n++;
  }
  return n;
}
const run = async (s, argv, extra = {}) => {
  const outs = [], errs = [];
  const code = await main(argv, { open: s, evidence, basis: BASIS, out: (x) => outs.push(x), err: (x) => errs.push(x), ...extra });
  return { code, outs, errs };
};
const count = async (s) => (await openDoor(s)).fold({}).length;

test('a flag is part of the run key and nothing else: three arms are three runs side by side, a second run adds nothing', { skip }, async () => {
  const s = setup();
  await seed(s);
  const arms = [[], ['--passes', 'no-dict'], ['--dict-permute', 'x1']];
  for (const flags of arms) assert.equal((await run(s, ['links', ...flags])).code, 0);
  const door = await openDoor(s);
  const rounds = door.fold({ kind: 'bind-links' });
  assert.equal(rounds.length, 3);
  assert.deepEqual(rounds.map((e) => e.body.runKey.flags).sort(), ['', 'dict-permute:x1', 'no-dict']);
  assert.equal(new Set(rounds.map((e) => e.addr)).size, 3);          // three run keys
  assert.equal(new Set(rounds.map((e) => e.addr.split(':')[1])).size, 3);
  for (const e of rounds) assert.deepEqual(Object.keys(e.body).sort(), ['acts', 'bridges', 'counts', 'fixed', 'links', 'predEvidence', 'round', 'runKey', 'unresolved']);
  // rerun: round 0 is not standing yet, so every arm waits and nothing is written
  const before = await count(s);
  for (const flags of arms) {
    const r = await run(s, ['links', ...flags]);
    assert.equal(r.code, 0);
    assert.match(r.outs[0], /wove 0, refused 0/);
    assert.match(r.outs[0], /round-not-standing 1/);
  }
  assert.equal(await count(s), before);
});

test('links then points: rounds to fixed, points and residue once, and a second run of each adds nothing', { skip }, async () => {
  const s = setup();
  const pen = await seed(s);
  const door = await openDoor(s);
  let guard = 0;
  for (; guard < 12; guard++) {
    const r = await run(s, ['links']);
    assert.equal(r.code, 0);
    if (standAll(pen, door) === 0) break;
  }
  assert.ok(guard > 2 && guard < 12, `passes: ${guard}`);
  assert.equal(door.fold({ kind: 'bind-links' }).at(-1).body.fixed, true);
  assert.equal(door.fold({ kind: 'bind-points' }).length, 0);       // links alone writes no point
  const p = await run(s, ['points']);
  assert.equal(p.code, 0);
  assert.match(p.outs[0], /1 to do/);
  assert.deepEqual([door.fold({ kind: 'bind-points' }).length, door.fold({ kind: 'bind-residue' }).length], [1, 1]);
  const before = await count(s);
  assert.match((await run(s, ['points'])).outs[0], /wove 0, refused 0/);
  assert.match((await run(s, ['links'])).outs[0], /wove 0, refused 0/);
  assert.equal(await count(s), before);
  // a flagged arm has a final standing of its own only once it has run: points under a flag waits, writes nothing
  const flagged = await run(s, ['points', '--passes', 'no-dict']);
  assert.deepEqual([flagged.code, /1 to do/.test(flagged.outs[0])], [0, false]);
  assert.equal(await count(s), before);
});

test('the evidence is opened only when a round or residue needs it; with none named the run stops and says why', { skip }, async () => {
  const s = setup();
  const pen = await seed(s);
  const door = await openDoor(s);
  const never = () => { throw new Error('opened'); };
  assert.equal((await run(s, ['links'], { evidence: never })).code, 0);          // round 0 needs none
  standAll(pen, door);
  const before = await count(s);
  const r = await run(s, ['links'], { evidence: undefined, env: {} });           // round 1 needs it, and none is named
  assert.equal(r.code, 1);
  assert.match(r.outs[0], /stopped: no evidence/);
  assert.match(r.errs[0], /JANUS_HYPERLEXICON is not set/);
  assert.equal(await count(s), before);
});

test('a door that is off writes nothing and exits 1', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bindoff-'));
  const open = { pointer: path.join(d, 'missing.json'), dir: path.join(d, 'log') };
  for (const mode of ['links', 'points']) {
    const outs = [], errs = [];
    const code = await main([mode], { open, evidence, basis: BASIS, out: (x) => outs.push(x), err: (x) => errs.push(x) });
    assert.deepEqual([code, outs.length], [1, 0]);
    assert.match(errs[0], /pharos door is off/);
  }
  assert.equal(fs.existsSync(open.dir), false);
});

test('this file imports nothing of another repo, no network, no process, no model', () => {
  for (const f of ['bind.mjs', 'bind.test.mjs']) {
    const src = fs.readFileSync(path.join(HERE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const i of [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])) {
      assert.ok(i.startsWith('node:') || i.startsWith('../native/') || i.startsWith('./bind'), `${f}: ${i}`);
    }
    if (f !== 'bind.mjs') continue;   // the test names the banned strings in this very list; its imports are checked above
    for (const bad of ['http', 'net', 'child_process', 'worker_threads', 'fetch(', 'kho' + 'ra', 'penel' + 'ope', 'pair-wit' + 'ness', 'unit-wit' + 'ness', 'smel' + 'l', 'testimo' + 'ny', 'olla' + 'ma', '114' + '34', '114' + '50', 'anthro' + 'pic', '/api/' + 'generate', '/api/' + 'chat', '/api/' + 'embed']) {
      assert.equal(src.includes(bad), false, `${f}: ${bad}`);
    }
  }
});
