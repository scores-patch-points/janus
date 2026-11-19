// pharos-door ask(): a layer gets only the kinds it asks for, in log order, the same with and without pharos's fold layer (a pinned sig.mjs); a mispinned sig is ignored. Needs $PHAROS_LIB (and sig.mjs beside it for the pinned arm).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDoor } from './pharos-door.mjs';
import { planDiffs, DIFF_READS, WITNESS_READS, planWitnesses, TEXT_KIND, PAIR_KIND, sha16 } from './identity/pair-evidence-pharos.mjs';

const LIB = process.env.PHAROS_LIB ?? '', SIGLIB = LIB ? path.join(path.dirname(LIB), 'sig.mjs') : '';
const skip = LIB && fs.existsSync(LIB) ? false : 'pharos library not found (set PHAROS_LIB to pharos/lib/pharos.mjs)';
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const pointer = (extra = {}) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jask-')); const p = path.join(d, 'pharos.json'); fs.writeFileSync(p, JSON.stringify({ lib: LIB, sha256: sha(LIB), ...extra })); return { p, dir: path.join(d, 'log') }; };
const fill = (door) => {
  door.declare(TEXT_KIND, 'INS·Figure', 't'); door.declare(PAIR_KIND, 'INS·Figure', 't'); door.declare('noise', 'INS·Figure', 't');
  const a = 'the cat sat', b = 'the cat sat down'; for (const t of [a, b]) door.weave({ cell: 'INS·Figure', kind: TEXT_KIND, addr: `text:${sha16(t)}`, body: { text: t } });
  door.weave({ cell: 'INS·Figure', kind: PAIR_KIND, addr: `pair:${sha16(a + '\u0000' + b)}`, body: { a: `text:${sha16(a)}`, b: `text:${sha16(b)}` } });
  for (let i = 0; i < 20; i++) door.weave({ cell: 'INS·Figure', kind: 'noise', addr: `n:${i}`, body: { i } });
};

test('ask returns only the asked kinds, in the order of the full fold, and a plan over them equals the plan over everything', { skip }, async () => {
  const { p, dir } = pointer(); const door = await openDoor({ pointer: p, dir, log: 'fold' }); assert.equal(door.on, true); assert.equal(door.sig, false); fill(door);
  const got = door.ask(DIFF_READS), all = door.fold({}); assert.ok(got.length < all.length && got.every((e) => DIFF_READS.includes(e.kind)));
  assert.deepEqual(got.map((e) => e.id), all.filter((e) => DIFF_READS.includes(e.kind)).map((e) => e.id));
  assert.deepEqual(planDiffs(got), planDiffs(all)); assert.deepEqual(planWitnesses(door.ask(WITNESS_READS)), planWitnesses(all));
});

test('through a pinned sig.mjs the answers are the same and a wrong pin is ignored', { skip: skip || (fs.existsSync(SIGLIB) ? false : 'no sig.mjs beside the pharos lib') }, async () => {
  const plain = pointer(), pinned = pointer({ sig: { lib: SIGLIB, sha256: sha(SIGLIB) } }), wrong = pointer({ sig: { lib: SIGLIB, sha256: '0'.repeat(64) } });
  const dA = await openDoor({ pointer: plain.p, dir: plain.dir, log: 'fold' }), dB = await openDoor({ pointer: pinned.p, dir: pinned.dir, log: 'fold' }), dC = await openDoor({ pointer: wrong.p, dir: wrong.dir, log: 'fold' });
  assert.equal(dB.sig, true); assert.equal(dC.sig, false, 'a sig whose bytes do not match the pin is not used');
  fill(dA); fill(dB); const ids = (d) => d.ask(DIFF_READS).map((e) => e.addr + e.kind); assert.deepEqual(ids(dB), ids(dA)); assert.deepEqual(ids(dB), ids(dB));
});
