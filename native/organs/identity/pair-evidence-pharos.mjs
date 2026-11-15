// pair-evidence-pharos.mjs — Janus reads paired texts and their readings FROM the shared log and writes its
// correspondence and its witness testimony back TO it (2026-11-15). No other repo is called, imported or named in
// code: the entries are the whole contract.
//
//   reads   text           INS·Ground   addr text:<sha16(text)>          body { text, language }
//           pair-question  DEF·Figure   addr pair:<sha16(a \0 b)>         body { a: "text:..", b: "text:.." }
//           text-reading   INS·Figure   addr reading:<sha16(text)>        body { rows }
//           witness-request DEF·Figure  addr witness-request:<pair sha16> body { pair: "pair:.." }
//   writes  pair-diff      SEG·Figure   addr diff:<pair sha16>     of [ pair-question, reading a, reading b ]
//           pair-witness   CON·Figure   addr witness:<pair sha16>  of [ witness-request, pair-question ]
//
// A pair-diff carries counts and evidence only (pair-diff.mjs); a pair-witness carries the raw answers only
// (pair-witness.mjs). Neither says licensed, addressed, order-changed or same: each of those applies a bound, and a
// bound and the verdict under it are Penelope's. Cells are nominations (SEG: a cut of two readings into anchors,
// substitutions and orphans; CON: the incidence of a model's answers on a pair), not earned from data.
// Each pass writes only what is missing, so a rerun adds nothing.
import crypto from 'node:crypto';
import { pairDiff } from './pair-diff.mjs';
import { MODEL, WORDING_NAMES } from './pair-witness.mjs';

export const TEXT_KIND = 'text';
export const PAIR_KIND = 'pair-question';
export const READING_KIND = 'text-reading';
export const REQUEST_KIND = 'witness-request';
export const PAIR_DIFF_KIND = 'pair-diff';
export const PAIR_DIFF_CELL = 'SEG·Figure';
export const PAIR_WITNESS_KIND = 'pair-witness';
export const PAIR_WITNESS_CELL = 'CON·Figure';
export const sha16 = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex').slice(0, 16);
const suffix = (addr, prefix) => (typeof addr === 'string' && addr.startsWith(prefix) ? addr.slice(prefix.length) : null);

/** the live entries of a log, the last one per (kind, addr). Pure. */
export function indexEntries(entries) {
  const at = new Map();
  for (const e of entries ?? []) if (e?.kind && e?.addr) at.set(`${e.kind}\u0000${e.addr}`, e);
  const get = (kind, addr) => at.get(`${kind}\u0000${addr}`) ?? null;
  const all = (kind) => [...at.values()].filter((e) => e.kind === kind);
  return { get, all };
}

/** the two texts of a pair-question, checked against its address. -> { sha, a, b } | { why } . Pure. */
export function textsOf(ix, pq) {
  const sha = suffix(pq?.addr, 'pair:');
  if (!sha) return { why: 'pair address is not pair:<sha16>' };
  const ta = ix.get(TEXT_KIND, pq.body?.a), tb = ix.get(TEXT_KIND, pq.body?.b);
  if (!ta || !tb) return { why: 'text missing' };
  const a = ta.body?.text, b = tb.body?.text;
  if (typeof a !== 'string' || typeof b !== 'string') return { why: 'text body has no text' };
  if (sha16(a + '\u0000' + b) !== sha) return { why: 'pair address does not match its texts' };
  return { sha, a, b, ta, tb };
}

/** planDiffs(entries) -> { todo: [{ pq, sha, ra, rb }], counts }. Pure: which pair-questions get a diff now. */
export function planDiffs(entries) {
  const ix = indexEntries(entries), todo = [];
  const counts = { pairs: 0, done: 0, waiting: 0, bad: 0 };
  for (const pq of ix.all(PAIR_KIND)) {
    counts.pairs += 1;
    const t = textsOf(ix, pq);
    if (t.why) { counts.bad += 1; continue; }
    if (ix.get(PAIR_DIFF_KIND, `diff:${t.sha}`)) { counts.done += 1; continue; }
    const ra = ix.get(READING_KIND, `reading:${sha16(t.a)}`), rb = ix.get(READING_KIND, `reading:${sha16(t.b)}`);
    if (!ra || !rb || !Array.isArray(ra.body?.rows) || !Array.isArray(rb.body?.rows)) { counts.waiting += 1; continue; }
    todo.push({ pq, sha: t.sha, ra, rb });
  }
  return { todo, counts };
}

/** the woven body of a pair-diff: the contract's fields, nothing else */
export const diffBody = (d) => ({ share: d.share, lcs: d.lcs, nA: d.nA, nB: d.nB, anchors: d.anchors, substitutions: d.substitutions, orphans: d.orphans });

/**
 * weaveDiffs(door, { evidence, basis }) -> { on, why, plan, woven, refused, lastReason }. Never throws for the door.
 * evidence: () => { of: (x, y) -> WORDEVIDENCE, basis }, called once and only when there is a pair to diff (the
 * hyperlexicon is opened only then); its basis (what the evidence was computed over) goes into every entry's basis.
 */
export function weaveDiffs(door, { evidence, basis = {} } = {}) {
  if (!door?.on) return { on: false, why: door?.why ?? 'no door', plan: null, woven: 0, refused: 0 };
  const all = door.fold({});
  if (!all) return { on: true, why: `could not read the log: ${door.counts.lastReason}`, plan: null, woven: 0, refused: 0, error: 'fold failed' };   // review fix
  const plan = planDiffs(all);
  const before = { ...door.counts };
  if (plan.todo.length) {
    door.declare(PAIR_DIFF_KIND, PAIR_DIFF_CELL, 'two readings cut into anchored rows, substituted rows with their word evidence both ways, and orphan rows, with the share; counts only, no bound applied');
    const ev = evidence();
    for (const { pq, sha, ra, rb } of plan.todo) {
      const d = pairDiff(ra.body.rows, rb.body.rows, ev.of);
      door.weave({ cell: PAIR_DIFF_CELL, kind: PAIR_DIFF_KIND, addr: `diff:${sha}`, of: [pq.id, ra.id, rb.id], body: diffBody(d), basis: { organ: 'janus native/organs/identity/pair-diff.mjs', evidence: ev.basis ?? null, ...basis } });
    }
  }
  return { on: true, why: door.why, plan, woven: door.counts.woven - before.woven, refused: door.counts.refused - before.refused, lastReason: door.counts.lastReason };
}

/** planWitnesses(entries) -> { todo: [{ req, pq, sha, a, b }], counts }. Pure: which witness-requests get testimony now. */
export function planWitnesses(entries) {
  const ix = indexEntries(entries), todo = [];
  const counts = { requests: 0, done: 0, bad: 0 };
  for (const req of ix.all(REQUEST_KIND)) {
    counts.requests += 1;
    const sha = suffix(req.addr, 'witness-request:');
    if (!sha) { counts.bad += 1; continue; }
    if (ix.get(PAIR_WITNESS_KIND, `witness:${sha}`)) { counts.done += 1; continue; }
    const pq = ix.get(PAIR_KIND, req.body?.pair);
    const t = pq ? textsOf(ix, pq) : { why: 'pair-question missing' };
    if (t.why || t.sha !== sha) { counts.bad += 1; continue; }
    todo.push({ req, pq, sha, a: t.a, b: t.b });
  }
  return { todo, counts };
}

/** weaveWitnesses(door, witness, { basis }) -> { on, why, plan, woven, refused, error }. witness = makeWitness(...). */
export async function weaveWitnesses(door, witness, { basis = {} } = {}) {
  if (!door?.on) return { on: false, why: door?.why ?? 'no door', plan: null, woven: 0, refused: 0 };
  const all = door.fold({});
  if (!all) return { on: true, why: `could not read the log: ${door.counts.lastReason}`, plan: null, woven: 0, refused: 0, error: 'fold failed' };   // review fix
  const plan = planWitnesses(all);
  const before = { ...door.counts };
  let error = null;
  if (plan.todo.length) {
    door.declare(PAIR_WITNESS_KIND, PAIR_WITNESS_CELL, 'a model\'s raw answers on a pair of texts, three wordings with each text as the passage in turn; testimony only, no verdict');
    for (const { req, pq, sha, a, b } of plan.todo) {
      let answers;
      try { answers = await witness.witnessPair(a, b); } catch (e) { error = `${e?.message ?? e}`; break; }   // what is woven stays; the rest waits for a rerun
      door.weave({ cell: PAIR_WITNESS_CELL, kind: PAIR_WITNESS_KIND, addr: `witness:${sha}`, of: [req.id, pq.id], body: { model: MODEL, wordings: [...WORDING_NAMES], answers }, basis: { organ: 'janus native/organs/identity/pair-witness.mjs', ...basis } });
    }
  }
  return { on: true, why: door.why, plan, woven: door.counts.woven - before.woven, refused: door.counts.refused - before.refused, lastReason: door.counts.lastReason, error };
}
