// bind-sieve.mjs: the public face of the binder's sieve (CONTRACT C.2, C.3).
//
// One round at a time. Round 0 is bind-sieve-r0 (P1-P3), round 1 is bind-sieve-dict (P4 and predEvidence), rounds 2
// and later are bind-sieve-struct (5a-5d and the bridge check) over the links standing at the previous round. This file
// only dispatches, assembles the round record in a fixed order and marks the round fixed. Janus proposes; whether a
// link stands is declared elsewhere, so nothing here reads or writes a verdict.
//
// Pure: no I/O, no clock, no randomness, no model, no import of another repo. The hyperlexicon arrives only as the
// injected `evidence` (API card).
//
// Choices made where the contract is silent:
//  - fixed: a round is fixed when it adds no link AND its index is 2 or more. Rounds 0 and 1 are the two fixed
//    entry rounds: round 1 under passes:'no-dict' adds none by design and round 2 must still run over round 0's
//    standing, so an empty round 0 or 1 does not end the loop.
//  - the kind view is used only when opts.kinds is 'standing'; with 'none' the inert view goes to every module.
//  - a missing `evidence` is the inert evidence (no shared words, no antonyms): P4 proposes nothing.
//  - predEvidence is recomputed on every round from the group and the evidence (it is a pure function of them), so
//    round 2 and later need no previous record; `prior` may still carry round records, but only their links are read.
//  - `standing.round` is forced to round - 1 so the links of round r carry `round: r`.

import { round0 } from './bind-sieve-r0.mjs';
import { round1, predEvidence } from './bind-sieve-dict.mjs';
import { NO_KINDS, round2 } from './bind-sieve-struct.mjs';

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

const PASS_RANK = Object.fromEntries(
  ['identity', 'identity-doc', 'place', 'speaker', 'abbrev', 'defines', 'antecedent', 'dictionary', 'act', 'role', 'forced', 'kind', 'role-frame']
    .map((p, i) => [p, i]),
);
const rank = (l) => (l.pass in PASS_RANK ? PASS_RANK[l.pass] : 99);
const linkOrder = (p, q) => rank(p) - rank(q) || cmp(p.a, q.a) || cmp(p.b, q.b) || cmp(p.id, q.id);

const INERT_EVIDENCE = Object.freeze({
  of: () => ({ shared: 0, empty: true, nulls: [], n: 0 }),
  antonym: () => false,
  unitOf: (m) => (Array.isArray(m.ikey) ? m.ikey.join(' ') : String(m.key)),
  words: () => [],
});

// the group in address order, whatever order its members and texts were presented in
function normalGroup(group) {
  const have = Object.keys((group && group.texts) || {});
  const listed = Array.isArray(group && group.members) ? group.members.filter((a) => have.includes(a)) : have;
  const members = [...new Set(listed)].sort(cmp);
  const texts = {};
  for (const a of members) texts[a] = group.texts[a];
  return { ...group, members, texts };
}

// link objects of earlier rounds: link objects or round records ({ links, acts })
function priorLinks(prior) {
  const out = [];
  const seen = new Set();
  const push = (l) => { if (l && l.id !== undefined && !seen.has(l.id)) { seen.add(l.id); out.push(l); } };
  for (const x of prior || []) {
    if (x && (Array.isArray(x.links) || Array.isArray(x.acts))) { for (const l of x.links || []) push(l); for (const l of x.acts || []) push(l); }
    else push(x);
  }
  return out;
}

const countBy = (links) => {
  const by = {};
  for (const l of links) by[l.pass] = (by[l.pass] || 0) + 1;
  return Object.fromEntries(Object.keys(by).sort().map((k) => [k, by[k]]));
};

/**
 * sieveRound({ group, kv, opts, evidence, round, standing, prior }) -> round record
 *   round     0, 1, 2 ...
 *   standing  the link-standing set of round - 1 (read; null at round 0): { runKey, round, fixed, stands, held, refused }
 *   prior     the links (or round records) of rounds 0..round-1; a link whose id is in it is not proposed again
 *   returns   { runKey, round, fixed, links, acts, predEvidence, unresolved, bridges, counts }
 *             links: mention links; acts: act links (round 2 and later); fixed only at round.fixed.
 */
export function sieveRound({ group, kv = NO_KINDS, opts = {}, evidence = null, round = 0, standing = null, prior = [], runKey = null } = {}) {
  const g = normalGroup(group);
  const o = opts || {};
  const K = o.kinds === 'standing' && kv && kv.on ? kv : NO_KINDS;
  const ev = evidence || INERT_EVIDENCE;
  const before = priorLinks(prior);
  const st = round >= 1 && standing ? { ...standing, round: round - 1 } : standing;

  let links = [], acts = [], pe = [], unresolved = [], bridges = [];
  if (round === 0) {
    const r = round0(g, K, o);
    links = r.links; acts = r.acts || []; unresolved = r.unresolved || [];
  } else if (round === 1) {
    const r = round1(g, K, o, ev, st, before);
    links = r.links; pe = r.predEvidence || [];
  } else {
    pe = predEvidence(g, ev, o);
    const r = round2(g, K, o, st, before, pe);
    links = r.links; acts = r.acts || []; bridges = r.bridges || [];
  }

  // a round adds only ids new under the run key; sorted so the record never depends on discovery order
  const known = new Set(before.map((l) => l.id));
  const fresh = (list) => {
    const out = [];
    for (const l of list) if (!known.has(l.id)) { known.add(l.id); out.push({ ...l, round }); }
    return out.sort(linkOrder);
  };
  const newLinks = fresh(links);
  const newActs = fresh(acts);
  const fixed = round >= 2 && newLinks.length === 0 && newActs.length === 0;
  const key = runKey ?? (standing && standing.runKey) ?? null;
  return {
    runKey: key,
    round,
    fixed,
    links: newLinks,
    acts: newActs,
    predEvidence: pe,
    unresolved,
    bridges,
    counts: {
      links: newLinks.length,
      acts: newActs.length,
      byPass: countBy([...newLinks, ...newActs]),
      predEvidence: pe.length,
      unresolved: unresolved.length,
      bridges: bridges.length,
    },
  };
}

/**
 * runRounds(input, standingOf, { cap }) -> round record[]: test helper. Loops sieveRound from round 0 until a round
 * is fixed (or cap rounds, default 16). `input` is { group, kv, opts, evidence, runKey }. `standingOf(record, ctx)` is
 * the hand-given standing function: it returns that round's link-standing set { stands, held, refused, ... } (an array
 * is read as `stands`); ctx = { links: every link so far, records }.
 */
export function runRounds(input, standingOf, { cap = 16 } = {}) {
  const records = [];
  const all = [];
  let standing = null;
  for (let round = 0; round < cap; round++) {
    const rec = sieveRound({ ...input, round, standing, prior: all });
    records.push(rec);
    all.push(...rec.links, ...rec.acts);
    if (rec.fixed) break;
    const s = standingOf(rec, { links: [...all], records: [...records] });
    standing = Array.isArray(s)
      ? { runKey: rec.runKey, round, fixed: false, stands: [...s].sort(), held: [], refused: [] }
      : { runKey: rec.runKey, fixed: false, stands: [], held: [], refused: [], ...(s || {}), round };
  }
  return records;
}
