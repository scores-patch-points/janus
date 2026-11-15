#!/usr/bin/env node
// scripts/pair-evidence.mjs diff      a pair-diff for every pair-question whose two readings are in the log and that has none
// scripts/pair-evidence.mjs witness   a pair-witness for every witness-request that has none ($PAIR_WITNESS_CACHE = the draw cache)
// Janus's geometry and testimony on paired texts, read from and written to the shared log through Janus's own door
// (log name $PHAROS_LOG, log directory $PHAROS, pointer $JANUS_PHAROS_JSON). No verdicts.
//
// The word evidence (diff mode) is the composite's: makeEvidence over makeFold(openHyperlexiconBin(<hyperlexicon>),
// { cap: 5000 }) with the pool array of <pool file>, seed "diff-first", nulls 50.
//   <hyperlexicon>  $JANUS_HYPERLEXICON, else ~/hyperlexicon/v2
//   <pool file>     $PAIR_POOL, else ledgers/paraphrase-100/out/pairs.json (read only; its sha256 goes in the basis)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDoor } from '../native/organs/pharos-door.mjs';
import { weaveDiffs, weaveWitnesses } from '../native/organs/identity/pair-evidence-pharos.mjs';
import { wordEvidenceOf } from '../native/organs/identity/pair-diff.mjs';
import { openHyperlexiconBin } from '../native/organs/hyperlexicon/bin.mjs';
import { makeFold } from '../native/organs/hyperlexicon/channel-fold.mjs';
import { makeEvidence } from '../native/organs/hyperlexicon/word-evidence.mjs';

const mode = process.argv[2];
if (mode !== 'diff' && mode !== 'witness') { console.error('usage: node scripts/pair-evidence.mjs diff|witness'); process.exit(2); }
const door = await openDoor();
if (!door.on) { console.error(`pharos door is off: ${door.why}`); process.exit(1); }
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

if (mode === 'diff') {
  const HL = process.env.JANUS_HYPERLEXICON ?? path.join(os.homedir(), 'hyperlexicon', 'v2');
  const POOL = process.env.PAIR_POOL ?? '/Users/mlacy/Documents/claude code/ledgers/paraphrase-100/out/pairs.json';
  const SEED = 'diff-first', NULLS = 50, CAP = 5000;
  /** the composite's word evidence, opened only when a pair needs it */
  const evidence = () => {
    const pool = JSON.parse(fs.readFileSync(POOL, 'utf8')).pool;
    if (!Array.isArray(pool) || !pool.length) throw new Error(`no pool array in ${POOL}`);
    const E = makeEvidence(makeFold(openHyperlexiconBin(HL), { cap: CAP }), { pool, seed: SEED, nulls: NULLS });
    return { of: (x, y) => wordEvidenceOf(E.evidence(x, y)), basis: { organ: 'janus native/organs/hyperlexicon/word-evidence.mjs', hyperlexicon: { dir: path.basename(HL), manifest: fs.existsSync(path.join(HL, 'manifest.json')) ? sha256(path.join(HL, 'manifest.json')) : null }, cap: CAP, pool: { file: path.basename(POOL), sha256: sha256(POOL), size: pool.length }, seed: SEED, nulls: NULLS } };
  };
  const w = weaveDiffs(door, { evidence });
  if (!w.plan) { console.error(`pair-diff: ${w.why}`); process.exit(1); }
  const c = w.plan.counts;
  console.log(`pair-diff over pharos log "${door.log}": ${c.pairs} pair-questions, ${c.done} already diffed, ${c.waiting} waiting for readings, ${c.bad} unreadable · wove ${w.woven}, refused ${w.refused}${w.refused ? ` (${w.lastReason})` : ''}`);
  process.exit(w.refused ? 1 : 0);
}

const CACHE = process.env.PAIR_WITNESS_CACHE;
if (!CACHE) { console.error('PAIR_WITNESS_CACHE is not set: the witness needs its draw cache file'); process.exit(2); }
if (!fs.existsSync(CACHE)) { console.error(`PAIR_WITNESS_CACHE ${CACHE} does not exist; refusing rather than asking the live model for every pair`); process.exit(2); }
const { makeWitness } = await import('../native/organs/identity/pair-witness.mjs');
const W = makeWitness(CACHE);
const w = await weaveWitnesses(door, W);
if (!w.plan) { console.error(`pair-witness: ${w.why}`); process.exit(1); }
const c = w.plan.counts;
console.log(`pair-witness over pharos log "${door.log}": ${c.requests} witness-requests, ${c.done} already witnessed, ${c.bad} unreadable · wove ${w.woven}, refused ${w.refused}${w.refused ? ` (${w.lastReason})` : ''} · draws ${JSON.stringify(W.stats)}${w.error ? ` · stopped: ${w.error}` : ''}`);
process.exit(w.refused || w.error ? 1 : 0);
