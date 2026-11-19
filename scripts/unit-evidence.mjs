#!/usr/bin/env node
// scripts/unit-evidence.mjs news        a unit-news for every direction a unit-request names that has none
// scripts/unit-evidence.mjs oppose      a unit-opposition for every opposition-request that has none
// scripts/unit-evidence.mjs correspond  a set-correspondence for every set membership that has none (no model)
// Seam 2's Janus parts (ledgers/paraphrase-100/seam2/CONTRACT.md B, C, H.3), read from and written to the shared log
// through Janus's own door (log $PHAROS_LOG, directory $PHAROS, pointer $JANUS_PHAROS_JSON). No verdicts.
//
// news and oppose ask the model only about what a request names, through the draw cache $PAIR_WITNESS_CACHE (the
// same file and format as seam 1's witness); they refuse to start when it is unset or missing, as seam 1 does.
// The word evidence (news) is seam 1's exactly: makeEvidence over makeFold(openHyperlexiconBin(<hyperlexicon>),
// { cap: 5000 }) with the pool array of <pool file>, seed "diff-first", nulls 50, each record through wordEvidenceOf.
//   <hyperlexicon>  $JANUS_HYPERLEXICON, else ~/hyperlexicon/v2 (read from its files, never through a door)
//   <pool file>     $PAIR_POOL, else ledgers/paraphrase-100/out/pairs.json (read only; its sha256 goes in the basis)
//
// Exit: 0 everything ready was written; 1 the door is off; 2 some item failed, was refused or was skipped (each
// printed; a rerun retries), or the draw cache is missing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDoor } from '../native/organs/pharos-door.mjs';
import { weaveNews, weaveOppositions, weaveCorrespondences } from '../native/organs/identity/unit-evidence-pharos.mjs';
import { makeUnitWitness } from '../native/organs/identity/unit-witness.mjs';
import { wordEvidenceOf } from '../native/organs/identity/pair-diff.mjs';
import { openHyperlexiconBin } from '../native/organs/hyperlexicon/bin.mjs';
import { makeFold } from '../native/organs/hyperlexicon/channel-fold.mjs';
import { makeEvidence } from '../native/organs/hyperlexicon/word-evidence.mjs';

const mode = process.argv[2];
if (!['news', 'oppose', 'correspond'].includes(mode)) { console.error('usage: node scripts/unit-evidence.mjs news|oppose|correspond'); process.exit(2); }
const door = await openDoor();
if (!door.on) { console.error(`pharos door is off: ${door.why}`); process.exit(1); }
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report = (label, w, extra = '') => {
  for (const s of w.plan?.skipped ?? []) console.error(`${label}: skipped ${s.at}: ${s.why}`);
  console.log(`${label} over pharos log "${door.log}": ${JSON.stringify(w.plan.counts)} · wove ${w.woven}, refused ${w.refused}${w.refused ? ` (${w.lastReason})` : ''}${extra}${w.error ? ` · stopped: ${w.error}` : ''}`);
  process.exit(w.refused || w.error || w.plan.skipped.length ? 2 : 0);
};

if (mode === 'correspond') {
  const w = weaveCorrespondences(door);
  if (!w.plan) { console.error(`set-correspondence: ${w.why}`); process.exit(1); }
  report('set-correspondence', w);
}

const CACHE = process.env.PAIR_WITNESS_CACHE;
if (!CACHE) { console.error('PAIR_WITNESS_CACHE is not set: the unit witness needs its draw cache file'); process.exit(2); }
if (!fs.existsSync(CACHE)) { console.error(`PAIR_WITNESS_CACHE ${CACHE} does not exist; refusing rather than asking the live model for every unit`); process.exit(2); }
const W = makeUnitWitness(CACHE);

if (mode === 'oppose') {
  const w = await weaveOppositions(door, W);
  if (!w.plan) { console.error(`unit-opposition: ${w.why}`); process.exit(1); }
  report('unit-opposition', w, ` · draws ${JSON.stringify(W.stats)}`);
}

const HL = process.env.JANUS_HYPERLEXICON ?? path.join(os.homedir(), 'hyperlexicon', 'v2');
const POOL = process.env.PAIR_POOL ?? '/Users/mlacy/Documents/claude code/ledgers/paraphrase-100/out/pairs.json';
const SEED = 'diff-first', NULLS = 50, CAP = 5000;
/** seam 1's word evidence (scripts/pair-evidence.mjs diff mode), opened only when a unit-news is to be written */
const evidence = () => {
  const pool = JSON.parse(fs.readFileSync(POOL, 'utf8')).pool;
  if (!Array.isArray(pool) || !pool.length) throw new Error(`no pool array in ${POOL}`);
  const E = makeEvidence(makeFold(openHyperlexiconBin(HL), { cap: CAP }), { pool, seed: SEED, nulls: NULLS });
  return { of: (x, y) => wordEvidenceOf(E.evidence(x, y)), basis: { organ: 'janus native/organs/hyperlexicon/word-evidence.mjs', hyperlexicon: { dir: path.basename(HL), manifest: fs.existsSync(path.join(HL, 'manifest.json')) ? sha256(path.join(HL, 'manifest.json')) : null }, cap: CAP, pool: { file: path.basename(POOL), sha256: sha256(POOL), size: pool.length }, seed: SEED, nulls: NULLS } };
};
const w = await weaveNews(door, W, { evidence });
if (!w.plan) { console.error(`unit-news: ${w.why}`); process.exit(1); }
report('unit-news', w, ` · draws ${JSON.stringify(W.stats)}`);
