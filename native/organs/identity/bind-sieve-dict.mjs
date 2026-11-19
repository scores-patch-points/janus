// bind-sieve-dict.mjs — the binder's round 1: P4 dictionary, predEvidence, and the null modes (CONTRACT C.3, C.7).
//
// Janus proposes; it never judges whether a share is enough. Raw word evidence (shared, empty, nulls, n) is
// written on each link; the quantile rule, the antonym refusal and the tie holds are Penelope's (B.2, D.2). The
// hyperlexicon arrives only as an injected `evidence` (the API card): this file reads no store of its own except
// through the exported `unitOf` helper, which takes a store handle as an argument.
//
// Pure: no I/O, no clock, no randomness except from a given seed. Mentions, acts and members are iterated in
// address and index order, so member order never changes the result.
//
//   evidence = { of(u, v) -> { shared, empty, nulls, n }, antonym(u, v) -> bool, unitOf(mention) -> string,
//                words() -> [pool words], bucketOf?(word) -> bucket | null }
//   bucketOf is needed only for dictPermute; `bucketFn(fold)` below builds it exactly as word-evidence.mjs does.

import { createHash } from 'node:crypto';
import { lemmaNodes } from '../hyperlexicon/channel-fold.mjs';
import { rng } from '../hyperlexicon/word-evidence.mjs';

export const SIEVE_DICT_SCHEMA = 'BindSieveDict@1';
export const DICT_CLASSES = ['name', 'description', 'number']; // C.3 P4: the classes the dictionary is asked about

// ---- shared shapes of the API card (same definitions as bind-sieve-r0.mjs; a test checks they agree when it exists)
const sha16 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
function canonJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return `[${v.map(canonJson).join(',')}]`;
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonJson(v[k])}`).join(',')}}`;
}
const mentionId = (text, m) => `${text}#m${m}`;
const actId = (text, a) => `${text}#a${a}`;
const linkId = (pass, a, b, evidence) => sha16(canonJson({ pass, ends: [a, b].sort(), evidence }));

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

/** The bucket function of word-evidence.mjs (size of the radius-1 ball, ratio 1.25): null for an empty ball. */
export function bucketFn(fold, { ratio = 1.25, radius = 1 } = {}) {
  return (w) => { const s = fold.ball(w, radius).nodes.size; return s > 0 ? Math.floor(Math.log(s) / Math.log(ratio)) : null; };
}

/**
 * unitOf(mention, store, rowKeys) -> the longest run of consecutive span rows ending at the head row whose keys,
 * joined by one space, the store names as a lemma; else the head key. `store` is a handle with answer(ask)
 * (lemmaNodes of channel-fold.mjs is the test) or a function phrase -> bool. The keys of the span rows come from
 * `rowKeys` (parallel to mention.rows) when given, else from `ikey` (the span keys without articles) cut at the head.
 */
export function unitOf(mention, store, rowKeys = null) {
  const head = mention.key;
  let keys;
  if (Array.isArray(rowKeys) && rowKeys.length === (mention.rows ?? []).length) {
    const hp = mention.rows.indexOf(mention.head);
    keys = rowKeys.slice(0, hp >= 0 ? hp + 1 : rowKeys.length);
  } else {
    const ik = Array.isArray(mention.ikey) ? mention.ikey : [];
    const rows = mention.rows ?? [];
    const dropped = Math.max(0, rows.length - ik.length);
    const expect = Math.max(0, rows.indexOf(mention.head) - dropped);
    let at = -1;
    for (let i = Math.min(expect, ik.length - 1); i >= 0; i--) if (ik[i] === head) { at = i; break; }
    if (at < 0) at = ik.lastIndexOf(head);
    keys = at >= 0 ? ik.slice(0, at + 1) : [head];
  }
  if (!store) return head;
  const names = typeof store === 'function' ? store : (p) => lemmaNodes(store, p).length > 0;
  for (let i = 0; i < keys.length; i++) {
    const phrase = keys.slice(i).join(' ');
    if (phrase && names(phrase)) return phrase;
  }
  return head;
}

/**
 * dictPermute({ words, pool, seed, bucketOf }) -> Map word -> image. Every word asked about and every pool word is
 * mapped through a seeded permutation within its bucket; a word whose bucket is null (empty ball) maps to itself.
 * The domain is sorted, so the map is a function of the word sets and the seed only. A bijection per bucket.
 */
export function dictPermute({ words = [], pool = [], seed, bucketOf }) {
  if (typeof bucketOf !== 'function') throw new Error('dictPermute needs bucketOf (the bucket of word-evidence.mjs)');
  if (seed === undefined || seed === null || seed === '') throw new Error('dictPermute needs a seed');
  const domain = [...new Set([...words, ...pool])].sort(cmp);
  const map = new Map(), byBucket = new Map();
  for (const w of domain) {
    const b = bucketOf(w);
    if (b === null || b === undefined) { map.set(w, w); continue; }
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b).push(w);
  }
  const r = rng(String(seed));
  for (const b of [...byBucket.keys()].sort((x, y) => x - y)) {
    const members = byBucket.get(b), order = [...members];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    members.forEach((w, i) => map.set(w, order[i]));
  }
  return map;
}

// ---- the evidence door, normalised, with the permutation applied on the way in
const rec = (e) => { const nulls = Array.isArray(e?.nulls) ? [...e.nulls] : []; return { shared: e?.shared ?? 0, empty: !!e?.empty, nulls, n: e?.n ?? nulls.length }; };

function door(evidence, units, preds, opts) {
  let img = null;
  if (opts?.dictPermute !== null && opts?.dictPermute !== undefined) {
    img = dictPermute({ words: [...units, ...preds], pool: evidence.words?.() ?? [], seed: opts.dictPermute, bucketOf: evidence.bucketOf });
  }
  const to = (w) => (img ? (img.get(w) ?? w) : w);
  return {
    both: (u, v) => { const ab = rec(evidence.of(to(u), to(v))), ba = rec(evidence.of(to(v), to(u))); return { ab, ba, score: Math.min(ab.shared, ba.shared) }; },
    antonym: (u, v) => !!(evidence.antonym?.(u, v) || evidence.antonym?.(v, u)), // the store's ant relations are not permuted
    permuted: !!img,
  };
}

const textsOf = (group) => [...(group.members ?? Object.keys(group.texts ?? {}))].sort(cmp).filter((t) => group.texts?.[t]);

// ---- points of the standing links (held excluded), for "whose points differ"
function pointIndex(standing, links) {
  const stands = new Set(standing?.stands ?? []), held = new Set();
  for (const g of standing?.held ?? []) for (const alt of g.alternatives ?? []) for (const id of alt) held.add(id);
  const parent = new Map();
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; } return r; };
  for (const l of links ?? []) {
    if (!stands.has(l.id) || held.has(l.id) || l.pass === 'act') continue;
    const ra = find(l.a), rb = find(l.b);
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  }
  return find;
}

/** collect the mentions of the dictionary's classes (member texts only), in address and index order */
function dictMentions(group, evidence) {
  const out = [];
  for (const t of textsOf(group)) {
    for (const m of group.texts[t].acts?.mentions ?? []) {
      if (!DICT_CLASSES.includes(m.class)) continue;
      const unit = typeof evidence.unitOf === 'function' ? evidence.unitOf({ ...m, text: t }) : unitOf(m, null);
      out.push({ text: t, m: m.m, id: mentionId(t, m.m), mention: m, unit });
    }
  }
  return out.sort((x, y) => cmp(x.id, y.id));
}

/**
 * predEvidence(group, evidence, opts) -> [{ a, b, e, ab, ba, score, antonym }]: both-way evidence for every pair of
 * acts in two different member texts with different `pred` (a, b act ids in sorted order; e the two preds in that
 * order). Evidence, not a link. Under opts.dictPermute it is computed on the images, as the links are.
 */
export function predEvidence(group, evidence, opts = {}) {
  const acts = [];
  for (const t of textsOf(group)) for (const a of group.texts[t].acts?.acts ?? []) acts.push({ text: t, id: actId(t, a.a), pred: a.pred });
  acts.sort((x, y) => cmp(x.id, y.id));
  const d = door(evidence, [], [...new Set(acts.map((a) => a.pred))], opts);
  const out = [];
  for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) {
    const x = acts[i], y = acts[j];
    if (x.text === y.text || x.pred === y.pred) continue;
    const w = d.both(x.pred, y.pred);
    out.push({ a: x.id, b: y.id, e: [x.pred, y.pred], ab: w.ab, ba: w.ba, score: w.score, antonym: d.antonym(x.pred, y.pred) });
  }
  return out;
}

/**
 * round1(group, kv, opts, evidence, standing, links) -> { links, predEvidence, ties }
 *   standing  the round-0 link-standing (read); links the link objects of round 0 ({ id, a, b, pass }) so its
 *             points can be built (the API card passes only `standing`; `standing.links` is read when `links` is absent)
 *   P4: for mentions of the dictionary's classes in two different member texts whose points differ, score =
 *   min(shared both ways); every pair with score > 0 such that neither end has a strictly greater pair is proposed
 *   (ties all proposed; `ties` lists, per mention with several proposals, those link ids: Penelope holds them).
 *   opts.passes === 'no-dict': no link; predEvidence still recorded. No quantile is applied here (C.3).
 */
export function round1(group, kv, opts = {}, evidence, standing = null, links = standing?.links ?? []) {
  const ms = dictMentions(group, evidence);
  const preds = [];
  for (const t of textsOf(group)) for (const a of group.texts[t].acts?.acts ?? []) preds.push(a.pred);
  const pe = predEvidence(group, evidence, opts);
  if (opts.passes === 'no-dict') return { links: [], predEvidence: pe, ties: [] };

  const find = pointIndex(standing, links);
  const d = door(evidence, ms.map((x) => x.unit), preds, opts);
  const cands = [], best = new Map();
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    const x = ms[i], y = ms[j];
    if (x.text === y.text || find(x.id) === find(y.id)) continue;
    const w = d.both(x.unit, y.unit);
    if (!(w.score > 0)) continue;
    cands.push({ x, y, w });
    for (const e of [x.id, y.id]) best.set(e, Math.max(best.get(e) ?? 0, w.score));
  }
  const out = [], byEnd = new Map();
  for (const { x, y, w } of cands) {
    if (w.score < best.get(x.id) || w.score < best.get(y.id)) continue;
    const ev = { units: [x.unit, y.unit], ab: w.ab, ba: w.ba, score: w.score, antonym: d.antonym(x.unit, y.unit) };
    const kinds = kv?.on ? { a: kv.kindOf(x.mention.key, 'entity') ?? null, b: kv.kindOf(y.mention.key, 'entity') ?? null } : null;
    const link = { id: linkId('dictionary', x.id, y.id, ev), pass: 'dictionary', a: x.id, b: y.id, evidence: ev, round: 1, kinds };
    out.push(link);
    for (const e of [x.id, y.id]) { if (!byEnd.has(e)) byEnd.set(e, []); byEnd.get(e).push(link.id); }
  }
  out.sort((p, q) => cmp(p.id, q.id));
  const ties = [...byEnd.entries()].filter(([, ids]) => ids.length > 1).sort((p, q) => cmp(p[0], q[0])).map(([mention, ids]) => ({ mention, links: [...ids].sort(cmp) }));
  return { links: out, predEvidence: pe, ties };
}
