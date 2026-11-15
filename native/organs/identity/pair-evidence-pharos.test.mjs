// Janus reads paired texts and their readings from the shared log and weaves pair-diff and pair-witness back.
// Needs the pharos library at $PHAROS_LIB. The other writers below (asker, khora, penelope) are this repo's own
// door opened under those writer names, writing the contract's entries by hand: no other repo is imported.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDoor } from '../pharos-door.mjs';
import { weaveDiffs, weaveWitnesses, planDiffs, sha16, PAIR_DIFF_KIND, PAIR_WITNESS_KIND } from './pair-evidence-pharos.mjs';

const LIB = process.env.PHAROS_LIB ?? '';
const skip = LIB && fs.existsSync(LIB) ? false : 'pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)';
const setup = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-'));
  const pointer = path.join(d, 'pharos.json');
  fs.writeFileSync(pointer, JSON.stringify({ lib: LIB, sha256: crypto.createHash('sha256').update(fs.readFileSync(LIB)).digest('hex') }));
  return { pointer, dir: path.join(d, 'log') };
};
const rowsOf = (text) => text.replace(/\.$/, '').split(' ').map((w, k) => ({ s: 0, id: k + 1, form: w, lemma: w.toLowerCase(), upos: k === 0 ? 'DET' : 'NOUN', feats: null, head: 0, deprel: 'dep', key: w.toLowerCase() }));

// the asker's texts and pair, as the contract writes them
function ask(door, a, b) {
  door.declare('text', 'INS·Ground', 't'); door.declare('pair-question', 'DEF·Figure', 't');
  const t = (x) => door.weave({ cell: 'INS·Ground', kind: 'text', addr: `text:${sha16(x)}`, body: { text: x, language: 'en' } });
  const ta = t(a), tb = t(b);
  return door.weave({ cell: 'DEF·Figure', kind: 'pair-question', addr: `pair:${sha16(a + '\u0000' + b)}`, of: [ta.id, tb.id], body: { a: ta.addr, b: tb.addr } });
}
function read(door, text) {
  door.declare('text-reading', 'INS·Figure', 't');
  const te = door.fold({ addr: `text:${sha16(text)}` })[0];
  return door.weave({ cell: 'INS·Figure', kind: 'text-reading', addr: `reading:${sha16(text)}`, of: [te.id], body: { reader: 'stand-in', language: 'en', rows: rowsOf(text) } });
}
const evidence = (calls = []) => () => ({ of: (x, y) => { calls.push(`${x}>${y}`); return { shared: x.length, empty: false, nulls: [0, 1, 2], n: 3 }; }, basis: { stand: 'in' } });

test('a door that is off weaves nothing and says why', async () => {
  assert.deepEqual([weaveDiffs({ on: false, why: 'no pointer' }).on, weaveDiffs({ on: false, why: 'no pointer' }).why], [false, 'no pointer']);
  const w = await weaveWitnesses({ on: false, why: 'no pointer' }, null);
  assert.deepEqual([w.on, w.woven], [false, 0]);
});

test('a pair-diff for every pair whose two readings exist; none for a pair still waiting; a rerun adds nothing', { skip }, async () => {
  const s = setup();
  const asker = await openDoor({ ...s, writer: 'asker' }), khora = await openDoor({ ...s, writer: 'khora' });
  const pq = ask(asker, 'The cat sat on the mat.', 'The dog sat on the rug.');
  const waiting = ask(asker, 'A bird flew.', 'A plane flew.');
  const ra = read(khora, 'The cat sat on the mat.'), rb = read(khora, 'The dog sat on the rug.');
  read(khora, 'A bird flew.');   // its partner has no reading yet
  const door = await openDoor(s), calls = [];
  const w = weaveDiffs(door, { evidence: evidence(calls) });
  assert.deepEqual([w.woven - 1, w.refused], [1, 0]);   // the kind declaration and one diff
  assert.deepEqual(w.plan.counts, { pairs: 2, done: 0, waiting: 1, bad: 0 });
  const [d] = door.fold({ kind: PAIR_DIFF_KIND });
  assert.equal(d.by, 'janus'); assert.equal(d.cell, 'SEG·Figure');
  assert.equal(d.addr, `diff:${pq.addr.slice(5)}`);
  assert.deepEqual([...d.of].sort(), [pq.id, ra.id, rb.id].sort());
  assert.deepEqual(Object.keys(d.body).sort(), ['anchors', 'lcs', 'nA', 'nB', 'orphans', 'share', 'substitutions']);
  assert.deepEqual(d.body.substitutions.map((x) => [x.a, x.b, x.evidence.ab.shared, x.evidence.ba.shared]), [['cat', 'dog', 3, 3], ['mat', 'rug', 3, 3]]);
  assert.deepEqual(calls, ['cat>dog', 'dog>cat', 'mat>rug', 'rug>mat']);
  assert.deepEqual(d.basis.evidence, { stand: 'in' });
  for (const k of ['licensed', 'reasons', 'orderChanged', 'addressed', 'verdict', 'same']) assert.equal(k in d.body, false, k);
  // rerun: nothing new, and the evidence is not even opened
  const again = weaveDiffs(door, { evidence: () => { throw new Error('opened'); } });
  assert.deepEqual([again.woven, again.plan.counts.done, again.plan.counts.waiting], [0, 1, 1]);
  assert.equal(waiting.kind, 'pair-question');
});

test('falsifying: a pair whose address does not match its texts is not diffed', { skip }, async () => {
  const s = setup();
  const asker = await openDoor({ ...s, writer: 'asker' }), khora = await openDoor({ ...s, writer: 'khora' });
  const pq = ask(asker, 'One two.', 'Three four.');
  asker.weave({ cell: 'DEF·Figure', kind: 'pair-question', addr: `pair:${sha16('wrong')}`, of: [], body: pq.body });
  read(khora, 'One two.'); read(khora, 'Three four.');
  const p = planDiffs((await openDoor(s)).fold({}));
  assert.deepEqual([p.todo.length, p.counts.bad], [1, 1]);
});

test('a pair-witness for every witness-request without one, raw answers only; a rerun asks nothing', { skip }, async () => {
  const s = setup();
  const asker = await openDoor({ ...s, writer: 'asker' }), khora = await openDoor({ ...s, writer: 'khora' }), pen = await openDoor({ ...s, writer: 'penelope' });
  const pq = ask(asker, 'The cat sat.', 'The dog sat.');
  read(khora, 'The cat sat.'); read(khora, 'The dog sat.');
  const door = await openDoor(s);
  weaveDiffs(door, { evidence: evidence() });
  const diff = door.fold({ kind: PAIR_DIFF_KIND })[0];
  pen.declare('witness-request', 'DEF·Figure', 't');
  const sha = pq.addr.slice(5);
  const req = pen.weave({ cell: 'DEF·Figure', kind: 'witness-request', addr: `witness-request:${sha}`, of: [diff.id], body: { pair: pq.addr, why: 'not settled by the diff' } });
  const asked = [];
  const witness = { witnessPair: async (a, b) => { asked.push([a, b]); return { ab: ['yes', 'yes', 'no'], ba: ['unparsed', 'no', 'no'] }; } };
  const w = await weaveWitnesses(door, witness);
  assert.deepEqual([w.refused, w.error, w.plan.counts.requests], [0, null, 1]);
  assert.deepEqual(asked, [['The cat sat.', 'The dog sat.']]);
  const [x] = door.fold({ kind: PAIR_WITNESS_KIND });
  assert.deepEqual([x.by, x.cell, x.addr], ['janus', 'CON·Figure', `witness:${sha}`]);
  assert.deepEqual([...x.of].sort(), [req.id, pq.id].sort());
  assert.deepEqual(x.body, { model: 'qwen3:8b', wordings: ['W1', 'W2', 'W3'], answers: { ab: ['yes', 'yes', 'no'], ba: ['unparsed', 'no', 'no'] } });
  const again = await weaveWitnesses(door, { witnessPair: async () => { throw new Error('asked'); } });
  assert.deepEqual([again.woven, again.plan.counts.done], [0, 1]);
});

test('a witness that fails stops the pass, keeps what was woven and reports the error', { skip }, async () => {
  const s = setup();
  const asker = await openDoor({ ...s, writer: 'asker' }), pen = await openDoor({ ...s, writer: 'penelope' });
  pen.declare('witness-request', 'DEF·Figure', 't');
  for (const [a, b] of [['A one.', 'B one.'], ['A two.', 'B two.']]) {
    const pq = ask(asker, a, b);
    pen.weave({ cell: 'DEF·Figure', kind: 'witness-request', addr: `witness-request:${pq.addr.slice(5)}`, of: [pq.id], body: { pair: pq.addr, why: 't' } });
  }
  let n = 0;
  const door = await openDoor(s);
  const w = await weaveWitnesses(door, { witnessPair: async () => { if (n++) throw new Error('model down'); return { ab: ['yes', 'yes', 'yes'], ba: ['yes', 'yes', 'yes'] }; } });
  assert.equal(w.error, 'model down');
  assert.equal(door.fold({ kind: PAIR_WITNESS_KIND }).length, 1);
});
