// bind-pharos.mjs: Janus reads the binder's entries FROM the shared log and weaves bind-links, bind-points and
// bind-residue back TO it (CONTRACT C.1, C.4, C.5, C.6). No other repo is called, imported or named in code: the
// entries are the whole contract. Only this file weaves; the sieve and the points builder are pure organs.
//
//   reads   bind-group, set-question, arrival   (asker)   which texts are bound together, and at which arrival
//           text, text-acts, text-place, context (khora)  each member's reading, its place in its document, the window
//           bind-bound, kind-bound, kind-standing, kind-candidates, link-standing (penelope)
//   writes  bind-links    CON·Figure   addr links:<run key>:<r>          one round of one group
//           bind-points   SYN·Pattern  addr points:<run key>
//           bind-residue  SEG·Figure   addr residue:<run key>:<pair sha>
//
// One round per group per pass: round r is planned only when the link-standing of round r-1 exists. A second pass over
// an unchanged log adds nothing. A new context, a new kind record or an arrival changes the run key, and the sieve
// restarts at round 0 under the new key (earlier entries stay).
//
// Choices made where the contract is silent:
//  - the live bind-bound is the last one in log order, unless opts.bound names one (a plain name, as in bind-bound:<name>).
//  - the live kind-bound is the entry the live bind-bound's `kindBound` names; a kind-standing is under it when its
//    `of` holds that entry's id (all kind-standings count when that kind-bound entry is not in the log).
//  - waiting reasons beyond the API card's: no-text (a member's text entry missing), no-acts (a member's or its
//    document's text-acts missing), no-kind-candidates (the kind-standing's record has no kind-candidates entry).
//  - the pair sha of a residue address is C.6's: sha16(a text + NUL + b text), a the member whose address sorts first;
//    the body's `pair` is set to match it (bind-points.mjs hashes the two addresses instead).
//  - the dictionary's pool (a JSON file {pool:[...]}) and the hyperlexicon store are named only by $BINDER_POOL and
//    $JANUS_HYPERLEXICON; with either unset there is no basis to record and weaveLinks writes nothing.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sha16, canonJson } from './bind-sieve-r0.mjs';
import { sieveRound } from './bind-sieve.mjs';
import { makeKindView, NO_KINDS } from './bind-sieve-struct.mjs';
import { buildPoints, buildResidues } from './bind-points.mjs';

export { sha16, canonJson };
export const LINKS_KIND = 'bind-links';
export const LINKS_CELL = 'CON·Figure';
export const POINTS_KIND = 'bind-points';
export const POINTS_CELL = 'SYN·Pattern';
export const RESIDUE_KIND = 'bind-residue';
export const RESIDUE_CELL = 'SEG·Figure';
export const SEED = 'binder-dict';
export const NULLS = 50;
export const ORGANS = ['janus native/organs/identity/bind-sieve.mjs', 'janus native/organs/hyperlexicon/word-evidence.mjs'];

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
const suffix = (addr, prefix) => (typeof addr === 'string' && addr.startsWith(prefix) ? addr.slice(prefix.length) : null);
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** the live entries of a log: the last one per (kind, addr), in the order they were last written. Pure. */
export function indexEntries(entries) {
  const at = new Map();
  let i = 0;
  for (const e of entries ?? []) if (e?.kind && e?.addr) at.set(`${e.kind}\u0000${e.addr}`, { e, i: i++ });
  const get = (kind, addr) => at.get(`${kind}\u0000${addr}`)?.e ?? null;
  const all = (kind) => [...at.values()].filter((x) => x.e.kind === kind).sort((p, q) => p.i - q.i).map((x) => x.e);
  return { get, all };
}

/** flagsOf(opts) -> "" | "no-dict" | "dict-permute:<seed>" | both joined by a comma. Pure. */
export function flagsOf(opts = {}) {
  const f = [];
  if (opts?.passes === 'no-dict') f.push('no-dict');
  if (opts?.dictPermute !== null && opts?.dictPermute !== undefined && opts?.dictPermute !== '') f.push(`dict-permute:${opts.dictPermute}`);
  return f.join(',');
}

/** runKeyOf({ group, kinds, contexts, flags }) -> { key, body } (C.1). Members and contexts are sorted here. Pure. */
export function runKeyOf({ group, kinds = 'none', contexts = [], flags = '' }) {
  const body = {
    group: [...new Set(group)].sort(cmp),
    kinds: kinds ?? 'none',
    contexts: contexts.map(([a, k]) => [a, k]).sort((p, q) => cmp(p[0], q[0]) || cmp(canonJson(p[1]), canonJson(q[1]))),
    flags: flags ?? '',
  };
  return { key: sha16(canonJson(body)), body };
}

/** groupsOf(ix) -> [{ id, members }]: bind-groups, static sets, and every arrival n >= 2 of an arrivals set. Pure. */
export function groupsOf(ix) {
  const out = [];
  const uniq = (xs) => [...new Set(xs)].sort(cmp);
  for (const g of ix.all('bind-group')) {
    const m = uniq(Array.isArray(g.body?.texts) ? g.body.texts : []);
    if (m.length >= 2) out.push({ id: g.addr, members: m });
  }
  for (const s of ix.all('set-question')) {
    const name = suffix(s.addr, 'set:');
    if (name === null) continue;
    if (s.body?.mode === 'arrivals') {
      const texts = [];
      for (let n = 1; ; n++) {
        const a = ix.get('arrival', `arrival:${name}:${n}`);
        if (!a || typeof a.body?.text !== 'string') break;
        texts.push(a.body.text);
        if (n >= 2) out.push({ id: `${s.addr}:${n}`, members: uniq(texts) });
      }
    } else if (Array.isArray(s.body?.texts)) {
      const m = uniq(s.body.texts);
      if (m.length >= 2) out.push({ id: s.addr, members: m });
    }
  }
  return out.sort((p, q) => cmp(p.id, q.id));
}

// the widest context of a text: the largest k present (numbers ascending, then "whole")
function widestContext(ix, textAddr) {
  const sha = suffix(textAddr, 'text:');
  let best = null;
  for (const e of ix.all('context')) {
    const k0 = suffix(e.addr, `context:${sha}:`);
    if (k0 === null) continue;
    const k = e.body?.k ?? (/^\d+$/.test(k0) ? Number(k0) : k0);
    const rank = k === 'whole' ? Infinity : Number(k);
    if (!best || rank > best.rank) best = { e, k, rank };
  }
  return best;
}

/**
 * loadGroup(ix, members, opts) -> { group, kv, kinds, contexts, of, strings, opts, bound, waiting }. Pure.
 * opts: the Janus flags { passes, dictPermute } and optionally { bound: <bind-bound name> }.
 * waiting is null, or why nothing may be woven for this group yet.
 */
export function loadGroup(ix, members, opts = {}) {
  const ms = [...new Set(members)].sort(cmp);
  const wait = (waiting, extra = {}) => ({ group: null, kv: NO_KINDS, kinds: 'none', contexts: [], of: [], strings: {}, opts: null, bound: null, ...extra, waiting });
  const bound = opts?.bound ? ix.get('bind-bound', `bind-bound:${opts.bound}`) : ix.all('bind-bound').at(-1) ?? null;
  if (!bound) return wait('no-bind-bound');
  const o = {
    kinds: bound.body?.kinds === 'standing' ? 'standing' : 'none',
    maxCombinations: Number.isFinite(bound.body?.alternatives?.maxCombinations) ? bound.body.alternatives.maxCombinations : 64,
    passes: opts?.passes === 'no-dict' ? 'no-dict' : 'all',
    dictPermute: opts?.dictPermute ?? null,
  };
  const texts = {}, strings = {}, contexts = [], of = [];
  const push = (e) => { if (e && !of.includes(e.id)) of.push(e.id); };
  for (const a of ms) {
    const sha = suffix(a, 'text:');
    const te = ix.get('text', a);
    if (!te || sha === null || typeof te.body?.text !== 'string') return wait('no-text', { bound, opts: o });
    strings[a] = te.body.text;
    const acts = ix.get('text-acts', `acts:${sha}`);
    if (!acts) return wait('no-acts', { bound, opts: o });
    push(acts);
    const place = ix.get('text-place', `place:${sha}`);
    let doc = null, context = null;
    if (place) {
      push(place);
      const placed = place.body?.at !== null && place.body?.at !== undefined && !place.body?.gap;
      if (placed) {
        const dsha = suffix(place.body.document, 'text:');
        const dacts = dsha === null ? null : ix.get('text-acts', `acts:${dsha}`);
        if (!dacts) return wait('no-acts', { bound, opts: o });
        const c = widestContext(ix, a);
        if (!c) return wait('no-context', { bound, opts: o });
        push(dacts); push(c.e);
        doc = { address: place.body.document, acts: dacts.body };
        context = c.e.body;
        contexts.push([a, c.k]);
      }
    }
    texts[a] = { acts: acts.body, place: place ? place.body : null, doc, context };
  }
  let kinds = 'none', kv = NO_KINDS;
  if (o.kinds === 'standing') {
    const kb = bound.body?.kindBound ? ix.get('kind-bound', bound.body.kindBound) : null;
    let ks = null;
    for (const e of ix.all('kind-standing')) {
      if (kb && !(Array.isArray(e.of) && e.of.includes(kb.id))) continue;
      if (!ks || (Number(e.body?.seq) || 0) >= (Number(ks.body?.seq) || 0)) ks = e;
    }
    if (!ks) return wait('no-kind-standing', { bound, opts: o });
    const rec = ks.body?.record;
    const recordSha = typeof rec === 'string' ? rec : rec && typeof rec.sha === 'string' ? rec.sha : null;
    const kc = recordSha === null ? null : ix.get('kind-candidates', `kinds:${recordSha}`);
    if (!kc) return wait('no-kind-candidates', { bound, opts: o });
    kv = makeKindView(ks.body, kc.body, o);
    kinds = recordSha;
    push(ks);
  }
  push(bound);
  return { group: { members: ms, texts }, kv, kinds, contexts, of, strings, opts: o, bound, waiting: null };
}

const roundsOf = (ix, key) => {
  const rounds = [];
  for (let r = 0; ; r++) {
    const e = ix.get(LINKS_KIND, `links:${key}:${r}`);
    if (!e) break;
    rounds.push(e);
  }
  return rounds;
};

// every group once, loaded, with its run key; groups with the same members and key are one
function loaded(entries, opts) {
  const ix = indexEntries(entries);
  const seen = new Set(), ready = [], waiting = [];
  for (const g of groupsOf(ix)) {
    const L = loadGroup(ix, g.members, opts);
    if (L.waiting) { waiting.push({ group: g.id, members: g.members, reason: L.waiting }); continue; }
    const rk = runKeyOf({ group: g.members, kinds: L.kinds, contexts: L.contexts, flags: flagsOf(L.opts) });
    if (seen.has(rk.key)) continue;
    seen.add(rk.key);
    ready.push({ g, L, rk });
  }
  return { ix, ready, waiting };
}
const tally = (list) => { const by = {}; for (const w of list) by[w.reason] = (by[w.reason] || 0) + 1; return Object.fromEntries(Object.keys(by).sort().map((k) => [k, by[k]])); };
const finish = (todo, waiting, groups) => {
  waiting.sort((p, q) => cmp(p.group, q.group) || cmp(p.reason, q.reason));
  todo.sort((p, q) => cmp(p.key, q.key) || (p.round ?? 0) - (q.round ?? 0));
  return { todo, waiting, counts: { groups, todo: todo.length, waiting: waiting.length, byReason: tally(waiting) } };
};

/**
 * planBind(entries, opts) -> { todo, waiting, counts }. Pure: which groups get which round now.
 * todo item: { group, members, key, runKey, round, standing, of, input } where input is the sieveRound argument.
 * waiting reasons: no-bind-bound, no-text, no-acts, no-context, no-kind-standing, no-kind-candidates,
 * round-not-standing, fixed.
 */
export function planBind(entries, opts = {}) {
  const { ix, ready, waiting } = loaded(entries, opts);
  const groups = ready.length + waiting.length;
  const todo = [];
  for (const { g, L, rk } of ready) {
    const rounds = roundsOf(ix, rk.key);
    const last = rounds.length - 1;
    const base = { group: g.id, members: g.members, key: rk.key, runKey: rk.body };
    if (last >= 0 && rounds[last].body?.fixed === true) { waiting.push({ ...base, reason: 'fixed' }); continue; }
    let standing = null;
    const of = [...L.of];
    if (last >= 0) {
      const st = ix.get('link-standing', `link-standing:${rk.key}:${last}`);
      if (!st) { waiting.push({ ...base, reason: 'round-not-standing', round: last }); continue; }
      standing = st.body;
      of.push(st.id);
    }
    const round = last + 1;
    const prior = rounds.map((e) => e.body);
    todo.push({ ...base, round, standing, of, input: { group: L.group, kv: L.kv, opts: L.opts, round, standing, prior, runKey: rk.body } });
  }
  return finish(todo, waiting, groups);
}

const pairsOf = (members, strings) => {
  const out = [];
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) out.push({ a: members[i], b: members[j], sha: sha16(`${strings[members[i]]}\u0000${strings[members[j]]}`) });
  return out;
};

/**
 * planPoints(entries, opts) -> { todo, waiting, counts }. Pure: groups whose last link-standing is of a fixed round and
 * that lack bind-points or one of their pair residues. waiting reasons: those of planBind, plus no-links, not-fixed,
 * round-not-standing, done.
 */
export function planPoints(entries, opts = {}) {
  const { ix, ready, waiting } = loaded(entries, opts);
  const groups = ready.length + waiting.length;
  const todo = [];
  for (const { g, L, rk } of ready) {
    const rounds = roundsOf(ix, rk.key);
    const last = rounds.length - 1;
    const base = { group: g.id, members: g.members, key: rk.key, runKey: rk.body };
    if (last < 0) { waiting.push({ ...base, reason: 'no-links' }); continue; }
    if (rounds[last].body?.fixed !== true) { waiting.push({ ...base, reason: 'not-fixed', round: last }); continue; }
    const st = ix.get('link-standing', `link-standing:${rk.key}:${last}`);
    if (!st) { waiting.push({ ...base, reason: 'round-not-standing', round: last }); continue; }
    const havePoints = ix.get(POINTS_KIND, `points:${rk.key}`);
    const pairs = pairsOf(g.members, L.strings);
    const missing = pairs.filter((p) => !ix.get(RESIDUE_KIND, `residue:${rk.key}:${p.sha}`));
    if (havePoints && !missing.length) { waiting.push({ ...base, reason: 'done' }); continue; }
    todo.push({
      ...base, round: last, havePoints, pairs, missing, of: [rounds[last].id, st.id],
      input: { group: L.group, kv: L.kv, opts: L.opts, linkRounds: rounds.map((e) => e.body), standing: st.body },
    });
  }
  return finish(todo, waiting, groups);
}

// ---------------------------------------------------------------- the basis (C.4): pool and store, from the environment only

/** poolSource(env) -> { ok, file, sha256, size, pool } | { ok: false, why }. Reads $BINDER_POOL, a JSON file {pool:[...]}. */
export function poolSource(env = process.env) {
  const f = env.BINDER_POOL;
  if (!f) return { ok: false, why: 'BINDER_POOL is not set' };
  try {
    const buf = fs.readFileSync(f);
    const pool = JSON.parse(buf.toString('utf8'))?.pool;
    if (!Array.isArray(pool) || !pool.length) return { ok: false, why: `no pool array in ${path.basename(f)}` };
    return { ok: true, file: path.basename(f), sha256: sha256(buf), size: pool.length, pool };
  } catch (e) { return { ok: false, why: `cannot read the pool: ${e?.message ?? e}` }; }
}

/** storeSource(env) -> { ok, dir, path, manifest } | { ok: false, why }. Names $JANUS_HYPERLEXICON; opens nothing. */
export function storeSource(env = process.env) {
  const d = env.JANUS_HYPERLEXICON;
  if (!d) return { ok: false, why: 'JANUS_HYPERLEXICON is not set' };
  const m = path.join(d, 'manifest.json');
  try { return { ok: true, dir: path.basename(d), path: d, manifest: fs.existsSync(m) ? sha256(fs.readFileSync(m)) : null }; }
  catch (e) { return { ok: false, why: `cannot read the store manifest: ${e?.message ?? e}` }; }
}

/** basisOf(env) -> { ok, basis } | { ok: false, why }: the C.4 basis fields that come from the pool and the store. */
export function basisOf(env = process.env) {
  const p = poolSource(env), s = storeSource(env);
  if (!p.ok) return { ok: false, why: p.why };
  if (!s.ok) return { ok: false, why: s.why };
  return { ok: true, basis: { hyperlexicon: { dir: s.dir, manifest: s.manifest }, pool: { file: p.file, sha256: p.sha256, size: p.size }, seed: SEED, nulls: NULLS } };
}

const lazy = (x) => { let v, done = false; return () => { if (!done) { v = typeof x === 'function' ? x() : x; done = true; } return v; }; };
const off = (door) => ({ on: false, why: door?.why ?? 'no door', plan: null, woven: 0, refused: 0 });

/**
 * weaveLinks(door, plan, { evidence, basis }) -> { on, why, woven, refused, plan, error }.
 * evidence: the evidence object of the API card, or a function returning it; called only when a round of 1 or later is
 * woven. basis: { hyperlexicon, pool, seed, nulls }; else basisOf(process.env). With no basis nothing is woven.
 */
export function weaveLinks(door, plan, { evidence = null, basis = null } = {}) {
  if (!door?.on) return off(door);
  const before = { ...door.counts };
  const result = (error = null) => ({ on: true, why: door.why, woven: door.counts.woven - before.woven, refused: door.counts.refused - before.refused, plan, error });
  if (!plan?.todo?.length) return result();
  let b = basis;
  if (!b) { const r = basisOf(process.env); if (!r.ok) return result(`no basis: ${r.why}`); b = r.basis; }
  const ev = lazy(evidence);
  door.declare(LINKS_KIND, LINKS_CELL, 'one round of the sieve for a group of texts: the links proposed, each with its evidence; nothing says a link stands, is held or is refused');
  let error = null;
  for (const t of plan.todo) {
    if (t.round >= 1 && !ev()) { error = 'no evidence for a round of 1 or later'; continue; }
    const rec = sieveRound({ ...t.input, evidence: t.round >= 1 ? ev() : null });
    const body = {
      runKey: t.runKey, round: rec.round, fixed: rec.fixed, links: rec.links, acts: rec.acts,
      predEvidence: rec.round === 1 ? rec.predEvidence : [], unresolved: rec.unresolved, bridges: rec.bridges,
      counts: { proposed: rec.links.length + rec.acts.length, byPass: rec.counts.byPass },
    };
    door.weave({ cell: LINKS_CELL, kind: LINKS_KIND, addr: `links:${t.key}:${t.round}`, of: t.of, body, basis: { organs: ORGANS, ...b } });
  }
  return result(error);
}

/**
 * weavePoints(door, plan, { evidence, basis }) -> { on, why, woven, refused, plan, error }.
 * evidence as in weaveLinks, called only when a residue is to be written.
 */
export function weavePoints(door, plan, { evidence = null, basis = null } = {}) {
  if (!door?.on) return off(door);
  const before = { ...door.counts };
  const result = (error = null) => ({ on: true, why: door.why, woven: door.counts.woven - before.woven, refused: door.counts.refused - before.refused, plan, error });
  if (!plan?.todo?.length) return result();
  const ev = lazy(evidence);
  const b = basis ?? (() => { const r = basisOf(process.env); return r.ok ? r.basis : {}; })();
  door.declare(POINTS_KIND, POINTS_CELL, 'the points (components of the standing links) and act classes of a group, the held alternatives and the combinations built; no standing, no verdict');
  door.declare(RESIDUE_KIND, RESIDUE_CELL, 'per pair of texts, per combination: what they share and what one has that the other lacks, with the word evidence; no side that counts');
  let error = null;
  for (const t of plan.todo) {
    const i = t.input;
    const pointsBody = buildPoints(i.group, i.kv, i.linkRounds, i.standing, i.opts);
    pointsBody.runKey = t.runKey;
    let pe = t.havePoints;
    if (!pe) pe = door.weave({ cell: POINTS_CELL, kind: POINTS_KIND, addr: `points:${t.key}`, of: t.of, body: pointsBody, basis: { organ: 'janus native/organs/identity/bind-points.mjs' } });
    if (!pe) continue;
    if (!ev()) { error = 'no evidence for the residues'; continue; }
    const shaOf = new Map(t.pairs.map((p) => [`${p.a}\u0000${p.b}`, p.sha]));
    const missing = new Set(t.missing.map((p) => p.sha));
    for (const r of buildResidues(i.group, pointsBody, ev(), i.kv)) {
      const sha = shaOf.get(`${r.a}\u0000${r.b}`);
      if (!sha || !missing.has(sha)) continue;
      door.weave({ cell: RESIDUE_CELL, kind: RESIDUE_KIND, addr: `residue:${t.key}:${sha}`, of: [pe.id], body: { ...r, pair: `pair:${sha}` }, basis: { organs: ['janus native/organs/identity/bind-points.mjs', ORGANS[1]], ...b } });
    }
  }
  return result(error);
}
