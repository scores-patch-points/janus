#!/usr/bin/env node
// scripts/bind.mjs links | points [--passes no-dict] [--dict-permute <seed>]      (CONTRACT C.7, F.2 steps 7 and 9)
//
//   links    one round of the sieve for every group whose previous round is standing and not fixed
//   points   the points, classes and alternatives (C.5) and the residues (C.6) of every group whose final standing exists
//
// A thin runner: it parses the flags, opens the shared log through Janus's own door (log name $PHAROS_LOG, log directory
// $PHAROS, pointer $JANUS_PHAROS_JSON), plans with native/organs/identity/bind-pharos.mjs, weaves, and prints counts.
// The flags are not written anywhere but into the run key (flags field of the key's body), so a run under a flag is a
// different run and its entries sit beside the others; nothing else tells the reader which arm made them.
//
// The word evidence is built only when a round of 1 or later, or a residue, is to be written, from
//   $JANUS_HYPERLEXICON  the hyperlexicon store   $BINDER_POOL  a JSON file {pool:[...]}   (both named in the entry's basis)
// With the door off nothing is written and the exit code is 1. A second run over an unchanged log adds nothing.
// Exit codes: 0 done (including nothing to do), 1 the door is off, a write was refused or the evidence could not be opened,
// 2 a usage error.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDoor } from '../native/organs/pharos-door.mjs';
import {
  planBind, planPoints, weaveLinks, weavePoints, poolSource, storeSource, SEED, NULLS,
} from '../native/organs/identity/bind-pharos.mjs';
import { wordEvidenceOf } from '../native/organs/identity/pair-diff.mjs';
import { unitOf, bucketFn } from '../native/organs/identity/bind-sieve-dict.mjs';
import { openHyperlexiconBin } from '../native/organs/hyperlexicon/bin.mjs';
import { makeFold } from '../native/organs/hyperlexicon/channel-fold.mjs';
import { makeEvidence } from '../native/organs/hyperlexicon/word-evidence.mjs';

export const USAGE = 'usage: node scripts/bind.mjs links|points [--passes no-dict] [--dict-permute <seed>]';
const CAP = 5000;   // the ball cap of the other evidence runner of this repo

/** parseArgs(argv) -> { ok, mode, opts: { passes, dictPermute }, error }. Pure; flags only, in any order. */
export function parseArgs(argv = []) {
  const bad = (error) => ({ ok: false, mode: null, opts: null, error });
  const args = [...argv];
  const mode = args.shift();
  if (mode !== 'links' && mode !== 'points') return bad(`first argument must be links or points, got ${mode === undefined ? 'nothing' : `"${mode}"`}`);
  const opts = { passes: 'all', dictPermute: null };
  const seen = new Set();
  while (args.length) {
    const raw = args.shift();
    const eq = raw.startsWith('--') ? raw.indexOf('=') : -1;
    const flag = eq > 0 ? raw.slice(0, eq) : raw;
    if (flag !== '--passes' && flag !== '--dict-permute') return bad(`unknown argument "${raw}"`);
    if (seen.has(flag)) return bad(`${flag} given twice`);
    seen.add(flag);
    const value = eq > 0 ? raw.slice(eq + 1) : args.shift();
    if (value === undefined || value === '' || (eq < 0 && value.startsWith('--'))) return bad(`${flag} needs a value`);
    if (flag === '--passes') {
      if (value !== 'no-dict') return bad(`--passes takes no-dict, got "${value}"`);
      opts.passes = 'no-dict';
    } else opts.dictPermute = value;
  }
  return { ok: true, mode, opts, error: null };
}

/** the word evidence of the API card from the store and the pool named in the environment: { evidence } or { why }. */
export function evidenceFrom(env = process.env) {
  const st = storeSource(env), pl = poolSource(env);
  if (!st.ok) return { why: st.why };
  if (!pl.ok) return { why: pl.why };
  try {
    const H = openHyperlexiconBin(st.path);
    const fold = makeFold(H, { cap: CAP });
    const E = makeEvidence(fold, { pool: pl.pool, seed: SEED, nulls: NULLS });
    return {
      evidence: {
        of: (u, v) => wordEvidenceOf(E.evidence(u, v)),
        antonym: (u, v) => fold.related(u, v, 'ant'),
        unitOf: (m) => unitOf(m, H),
        words: () => pl.pool,
        bucketOf: bucketFn(fold),
      },
    };
  } catch (e) { return { why: `cannot open the hyperlexicon: ${e?.message ?? e}` }; }
}

const countsLine = (what, door, w) => {
  const c = w.plan.counts;
  const why = Object.entries(c.byReason).map(([k, n]) => `${k} ${n}`).join(', ');
  return `bind ${what} over pharos log "${door.log}": ${c.groups} groups, ${c.todo} to do, ${c.waiting} waiting${why ? ` (${why})` : ''} · wove ${w.woven}, refused ${w.refused}${w.refused && door.counts.lastReason ? ` (${door.counts.lastReason})` : ''}${w.error ? ` · stopped: ${w.error}` : ''}`;
};

/**
 * main(argv, deps) -> exit code. deps (all optional, for tests): open (options for openDoor), env, evidence (the evidence
 * object or a function returning it), basis, out and err (line writers).
 */
export async function main(argv = process.argv.slice(2), deps = {}) {
  const out = deps.out ?? ((s) => console.log(s)), err = deps.err ?? ((s) => console.error(s));
  const a = parseArgs(argv);
  if (!a.ok) { err(`${a.error}\n${USAGE}`); return 2; }
  const door = await openDoor(deps.open ?? {});
  if (!door.on) { err(`pharos door is off: ${door.why}`); return 1; }
  const entries = door.fold({});
  if (!entries) { err(`cannot read the log: ${door.counts.lastReason ?? 'unknown'}`); return 1; }
  let opened = null;
  const evidence = () => {
    if (deps.evidence) return typeof deps.evidence === 'function' ? deps.evidence() : deps.evidence;
    opened ??= evidenceFrom(deps.env ?? process.env);
    return opened.evidence ?? null;
  };
  const given = { evidence, basis: deps.basis ?? null };
  const w = a.mode === 'links'
    ? weaveLinks(door, planBind(entries, a.opts), given)
    : weavePoints(door, planPoints(entries, a.opts), given);
  out(countsLine(a.mode, door, w));
  if (w.error && opened?.why) err(`evidence: ${opened.why}`);
  return w.refused || w.error ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(await main(process.argv.slice(2)));
}
