// bind-points.mjs — the binder's SYN and SEG (CONTRACT C.5, C.6). Pure.
//
//   C.5 SYN  buildPoints(group, kv, linkRounds, standing, opts) -> the bind-points body
//            points = components of the standing mention links (singletons included), act classes =
//            components of the standing act links with their slots, alternatives = the held groups,
//            combinations = the product of their sizes, mixed radix, capped by opts.maxCombinations.
//   C.6 SEG  buildResidues(group, pointsBody, evidence, kv) -> one bind-residue body per pair of members
//            per combination: what the two texts share (classes, slots, points) and what one has that
//            the other lacks (onlyA/onlyB, modifiers, unbound, unresolved), with the word evidence of
//            every difference and no side that counts.
//
// Janus writes no standing, no call and no verdict: the output carries none of those fields. Nothing
// here does I/O, reads a clock, draws a random number, or calls a model. Members, mentions, acts and
// links are walked in address, index and id order, never in presentation order, so the same group in
// two member orders gives byte-identical bodies.
//
// Choices made where the contract is silent:
//  - the top-level `points` and `classes` of the body are the base (the standing links alone, held
//    excluded); `built` holds one entry per combination { c, choice, linkIds, points, classes }; when
//    tooMany only c 0 is built and it is the base. The body also carries `links` ({ id, pass, a, b }
//    of every link that stands in some combination) so that SEG can walk `via` paths from the body.
//  - mixed radix: the first held group in id order is the least significant digit.
//  - an act class has at least two acts (it is a component of at least one act link).
//  - a slot groups the (act, role, filler) triples of a class by the filler's identity: its point, its
//    act class, or its word key; an unmatched triple is a slot of its own. `fillers` lists the triples.
//  - residue `pred` and `stance` are per class: preds are the distinct preds of each side, evidence is
//    asked for each cross pair with different preds, stance counts are summed over the side's acts.
//  - modifier keys: a `mods` entry that is an object reads `key`, else the entry itself as a string.

import { sha16, canonJson, mentionId, actId, parseId } from './bind-sieve-r0.mjs';
import { NO_KINDS, pointsOf } from './bind-sieve-struct.mjs';

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
const ANAPHORIC = new Set(['pronoun', 'demonstrative', 'relative']);
const uniqSorted = (xs) => [...new Set(xs)].sort(cmp);

// ---------------------------------------------------------------- indexing

function indexGroup(group) {
  const have = Object.keys((group && group.texts) || {});
  const listed = Array.isArray(group && group.members) ? group.members.filter((a) => have.includes(a)) : have;
  const members = uniqSorted(listed);
  const mentions = new Map();
  const acts = new Map();
  const add = (addr, body) => {
    if (!body) return;
    for (const m of Array.isArray(body.mentions) ? body.mentions : []) mentions.set(mentionId(addr, m.m), { id: mentionId(addr, m.m), text: addr, rec: m });
    for (const a of Array.isArray(body.acts) ? body.acts : []) acts.set(actId(addr, a.a), { id: actId(addr, a.a), text: addr, rec: a });
  };
  const docs = new Map();
  for (const addr of members) {
    const t = group.texts[addr];
    add(addr, t.acts);
    if (t.doc && t.doc.acts && t.doc.address && !docs.has(t.doc.address)) docs.set(t.doc.address, t.doc.acts);
  }
  for (const addr of uniqSorted([...docs.keys()])) if (!members.includes(addr)) add(addr, docs.get(addr));
  return { members, mentions, acts };
}

// every link object of the rounds, once each, in id order: { id, pass, a, b }
function flatLinks(linkRounds) {
  const byId = new Map();
  const push = (l) => { if (l && l.id !== undefined && !byId.has(l.id)) byId.set(l.id, { id: l.id, pass: l.pass, a: l.a, b: l.b }); };
  for (const x of Array.isArray(linkRounds) ? linkRounds : []) {
    if (x && (Array.isArray(x.links) || Array.isArray(x.acts))) { for (const l of x.links || []) push(l); for (const l of x.acts || []) push(l); } else push(x);
  }
  return [...byId.keys()].sort(cmp).map((k) => byId.get(k));
}

function unionFind() {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    return r;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) { if (ra < rb) parent.set(rb, ra); else parent.set(ra, rb); } };
  return { find, union, parent };
}

// ---------------------------------------------------------------- combinations

/** combinationsOf(alternatives, max) -> { combinations, tooMany, choices }. Groups in id order; combination c
 * picks, for each group, alternative (c / product of the earlier sizes) mod its size. choices is [] when tooMany. */
export function combinationsOf(alternatives, max = 64) {
  const groups = (Array.isArray(alternatives) ? alternatives : [])
    .filter((g) => g && Array.isArray(g.alternatives) && g.alternatives.length > 0)
    .sort((x, y) => cmp(String(x.group), String(y.group)));
  let n = 1;
  for (const g of groups) n = Math.min(n * g.alternatives.length, Number.MAX_SAFE_INTEGER);
  if (n > max) return { combinations: n, tooMany: true, choices: [] };
  const choices = [];
  for (let c = 0; c < n; c++) {
    let rest = c;
    choices.push(groups.map((g) => { const d = rest % g.alternatives.length; rest = Math.floor(rest / g.alternatives.length); return d; }));
  }
  return { combinations: n, tooMany: false, choices };
}

// ---------------------------------------------------------------- SYN

function classesOf(idx, actLinks, pointOf) {
  const uf = unionFind();
  const linked = new Set();
  for (const l of actLinks) {
    if (l.a === l.b || !idx.acts.has(l.a) || !idx.acts.has(l.b)) continue;
    uf.union(l.a, l.b); linked.add(l.a); linked.add(l.b);
  }
  const comps = new Map();
  for (const id of [...linked].sort(cmp)) { const r = uf.find(id); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(id); }
  const clOf = new Map();
  const list = [];
  for (const ids of comps.values()) { const id = 'cl:' + sha16(canonJson(ids)); list.push({ id, acts: ids }); for (const a of ids) clOf.set(a, id); }
  for (const cl of list) {
    const groups = new Map(); // filler key -> [[act, role, filler ref]]
    for (const aid of cl.acts) {
      const act = idx.acts.get(aid);
      for (const r of Array.isArray(act.rec.roles) ? act.rec.roles : []) {
        const f = r.filler || {};
        let key = null, ref = null;
        if (typeof f.m === 'number') { ref = mentionId(act.text, f.m); const p = pointOf.get(ref); key = p ? 'p:' + p : null; }
        else if (typeof f.a === 'number') { ref = actId(act.text, f.a); key = clOf.has(ref) ? 'c:' + clOf.get(ref) : 'a:' + ref; }
        else if (f.word !== undefined && f.word !== null) { ref = 'word:' + f.word; key = 'w:' + f.word; }
        if (key === null) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push([aid, String(r.role), ref]);
      }
    }
    cl.slots = [...groups.keys()].map((key) => {
      const fillers = [...new Map(groups.get(key).map((t) => [canonJson(t), t])).entries()].sort((x, y) => cmp(x[0], y[0])).map((e) => e[1]);
      const pairs = [...new Map(fillers.map(([a, r]) => [canonJson([a, r]), [a, r]])).entries()].sort((x, y) => cmp(x[0], y[0])).map((e) => e[1]);
      return { id: 'sl:' + sha16(canonJson([cl.id, key])), key, pairs, fillers };
    }).sort((x, y) => cmp(x.id, y.id));
  }
  return list.sort((x, y) => cmp(x.id, y.id));
}

function stateFor(group, idx, kv, linkRounds, flat, ids) {
  const stands = uniqSorted(ids);
  const points = pointsOf(group, { stands }, linkRounds, kv);
  const pointOf = new Map();
  for (const p of points) for (const m of p.mentions) pointOf.set(m, p.id);
  const standSet = new Set(stands);
  const actLinks = flat.filter((l) => standSet.has(l.id) && l.pass === 'act');
  return { stands, points, classes: classesOf(idx, actLinks, pointOf) };
}

const textsOfMembers = (ids, members) => uniqSorted(ids.map((i) => parseId(i)).filter((p) => p && members.includes(p.text)).map((p) => p.text));

/** buildPoints(group, kv, linkRounds, standing, opts) -> bind-points body (C.5) */
export function buildPoints(group, kv, linkRounds, standing, opts = {}) {
  const K = opts && opts.kinds === 'standing' && kv && kv.on ? kv : NO_KINDS;
  const max = opts && Number.isFinite(opts.maxCombinations) ? opts.maxCombinations : 64;
  const idx = indexGroup(group);
  const flat = flatLinks(linkRounds);
  const stands = (standing && Array.isArray(standing.stands)) ? standing.stands : [];
  const alternatives = ((standing && Array.isArray(standing.held)) ? standing.held : [])
    .map((h) => ({
      group: h.group,
      alternatives: (h.alternatives || []).map((alt) => uniqSorted(alt)).sort((x, y) => cmp(canonJson(x), canonJson(y))),
    }))
    .sort((x, y) => cmp(String(x.group), String(y.group)));
  const combo = combinationsOf(alternatives, max);
  const base = stateFor(group, idx, K, linkRounds, flat, stands);
  const built = [];
  if (combo.tooMany) built.push({ c: 0, choice: null, linkIds: base.stands, points: base.points, classes: base.classes });
  else {
    const groups = alternatives.filter((g) => g.alternatives.length > 0);
    combo.choices.forEach((choice, c) => {
      const ids = [...stands];
      groups.forEach((g, k) => ids.push(...g.alternatives[choice[k]]));
      const st = stateFor(group, idx, K, linkRounds, flat, ids);
      built.push({ c, choice, linkIds: st.stands, points: st.points, classes: st.classes });
    });
  }
  const used = new Set(built.flatMap((b) => b.linkIds));
  const links = flat.filter((l) => used.has(l.id));
  const cross = (ids) => textsOfMembers(ids, idx.members).length >= 2;
  return {
    runKey: standing ? standing.runKey ?? null : null,
    points: base.points,
    classes: base.classes,
    alternatives,
    combinations: combo.combinations,
    tooMany: combo.tooMany,
    counts: {
      points: base.points.length,
      crossText: base.points.filter((p) => cross(p.mentions)).length,
      classes: base.classes.length,
      crossTextClasses: base.classes.filter((c) => cross(c.acts)).length,
    },
    built,
    links,
  };
}

// ---------------------------------------------------------------- SEG

const modKey = (x) => (x !== null && typeof x === 'object' ? String(x.key ?? x.form ?? canonJson(x)) : String(x));
const evOf = (e, u, v) => (e && typeof e.of === 'function' ? e.of(u, v) : null);
const antOf = (e, u, v) => (e && typeof e.antonym === 'function' ? !!(e.antonym(u, v) || e.antonym(v, u)) : false);
const unitFor = (e, m) => (e && typeof e.unitOf === 'function' ? e.unitOf({ ...m.rec, text: m.text }) : m.rec.key);

function shortestPass(adj, from, to) {
  const prev = new Map([[from, null]]);
  const queue = [from];
  for (let h = 0; h < queue.length && !prev.has(to); h++) {
    for (const e of adj.get(queue[h]) || []) if (!prev.has(e.to)) { prev.set(e.to, { from: queue[h], pass: e.pass }); queue.push(e.to); }
  }
  if (!prev.has(to)) return null;
  const passes = [];
  for (let at = to; prev.get(at); at = prev.get(at).from) passes.unshift(prev.get(at).pass);
  return passes;
}

function modifiersOf(idx, e, xs, ys) {
  const keys = (ms) => uniqSorted(ms.flatMap((m) => (Array.isArray(m.rec.mods) ? m.rec.mods : []).map(modKey)));
  const ka = keys(xs), kb = keys(ys);
  const onlyA = ka.filter((k) => !kb.includes(k)), onlyB = kb.filter((k) => !ka.includes(k));
  const evidence = [];
  for (const u of onlyA) for (const v of onlyB) evidence.push({ a: u, b: v, ab: evOf(e, u, v), ba: evOf(e, v, u), antonym: antOf(e, u, v) });
  return { onlyA, onlyB, evidence };
}

function residueFor(group, idx, entry, evidence, kv, a, b) {
  const side = (id) => { const t = parseId(id); return t && t.text === a ? 'a' : t && t.text === b ? 'b' : null; };
  const pointOf = new Map(), pointById = new Map();
  for (const p of entry.points) { pointById.set(p.id, p); for (const m of p.mentions) pointOf.set(m, p.id); }
  const standSet = new Set(entry.linkIds);
  const adj = new Map();
  const byId = new Map(entry._links.map((l) => [l.id, l]));
  for (const id of [...standSet].sort(cmp)) {
    const l = byId.get(id);
    if (!l || l.pass === 'act') continue;
    if (!adj.has(l.a)) adj.set(l.a, []);
    if (!adj.has(l.b)) adj.set(l.b, []);
    adj.get(l.a).push({ to: l.b, pass: l.pass });
    adj.get(l.b).push({ to: l.a, pass: l.pass });
  }
  const crossOf = (p) => ({ a: p.mentions.filter((m) => side(m) === 'a'), b: p.mentions.filter((m) => side(m) === 'b') });

  const classOfAct = new Map();
  for (const cl of entry.classes) for (const x of cl.acts) classOfAct.set(x, cl.id);
  const mentionSlots = new Map();
  for (const cl of entry.classes) {
    for (const sl of cl.slots) {
      for (const [act, role, ref] of sl.fillers) {
        if (!idx.mentions.has(ref)) continue;
        if (!mentionSlots.has(ref)) mentionSlots.set(ref, []);
        mentionSlots.get(ref).push({ cl: cl.id, slot: sl.id, act, role });
      }
    }
  }
  const slotsOfMention = (id) => (mentionSlots.get(id) || []).sort((x, y) => cmp(canonJson(x), canonJson(y)));

  // acts
  const acts = [], inCrossClass = new Set();
  for (const cl of entry.classes) {
    const sa = cl.acts.filter((x) => side(x) === 'a'), sb = cl.acts.filter((x) => side(x) === 'b');
    if (!sa.length || !sb.length) continue;
    for (const x of [...sa, ...sb]) inCrossClass.add(x);
    const slots = [];
    for (const sl of cl.slots) {
      const fa = sl.fillers.filter((t) => side(t[0]) === 'a').map(([act, role, filler]) => ({ act, role, filler }));
      const fb = sl.fillers.filter((t) => side(t[0]) === 'b').map(([act, role, filler]) => ({ act, role, filler }));
      if (!fa.length && !fb.length) continue;
      slots.push({ slot: sl.id, a: fa, b: fb, aligned: fa.length > 0 && fb.length > 0 });
    }
    const predsOf = (ids) => uniqSorted(ids.map((x) => idx.acts.get(x).rec.pred).filter((p) => p !== undefined && p !== null));
    const pa = predsOf(sa), pb = predsOf(sb);
    const pe = [];
    for (const u of pa) for (const v of pb) {
      if (u === v) continue;
      const kind = kv && kv.on ? kv.sameKind('predicate', u, v) : null;
      pe.push({ a: u, b: v, ab: evOf(evidence, u, v), ba: evOf(evidence, v, u), antonym: antOf(evidence, u, v), kind: kind ?? null });
    }
    const stance = (ids) => {
      let polarity = 0, pronType = 0;
      for (const x of ids) { const n = idx.acts.get(x).rec.neg || {}; polarity += (n.polarity || []).length; pronType += (n.pronType || []).length; }
      const first = idx.acts.get(ids[0]).rec;
      return { polarity, pronType, embedded: Array.isArray(first.embedded) ? first.embedded : null };
    };
    acts.push({
      class: cl.id,
      members: { a: sa, b: sb },
      slots,
      pred: { a: pa, b: pb, evidence: pe, antonym: pe.some((x) => x.antonym), kinds: uniqSorted(pe.map((x) => x.kind).filter((k) => k !== null)) },
      stance: { a: stance(sa), b: stance(sb) },
      embedded: { a: sa.map((x) => idx.acts.get(x).rec.embedded ?? null), b: sb.map((x) => idx.acts.get(x).rec.embedded ?? null) },
    });
  }
  const only = (s) => idx.members.includes(s) ? [...idx.acts.values()].filter((x) => x.text === s && !inCrossClass.has(x.id)).sort((x, y) => cmp(x.id, y.id)).map((x) => ({
    act: x.id,
    pred: x.rec.pred ?? null,
    roles: (Array.isArray(x.rec.roles) ? x.rec.roles : []).map((r) => {
      const f = r.filler || {};
      if (typeof f.m === 'number') { const ref = mentionId(x.text, f.m); return { role: String(r.role), mention: ref, point: pointOf.get(ref) ?? null }; }
      if (typeof f.a === 'number') return { role: String(r.role), act: actId(x.text, f.a) };
      return { role: String(r.role), word: f.word ?? null };
    }),
  })) : [];

  // points shared by both texts
  const points = [];
  for (const p of entry.points) {
    const { a: ma, b: mb } = crossOf(p);
    if (!ma.length || !mb.length) continue;
    const pairs = [];
    for (const x of ma) for (const y of mb) {
      const mx = idx.mentions.get(x), my = idx.mentions.get(y);
      if (!mx || !my) continue;
      const via = shortestPass(adj, x, y);
      const differ = mx.rec.key !== my.rec.key;
      const ux = unitFor(evidence, mx), uy = unitFor(evidence, my);
      const kx = kv && kv.on ? kv.kindOf(mx.rec.key, 'entity') : null, ky = kv && kv.on ? kv.kindOf(my.rec.key, 'entity') : null;
      pairs.push({
        heads: { a: mx.rec.key ?? null, b: my.rec.key ?? null },
        mentions: { a: x, b: y },
        via,
        headEvidence: differ ? { a: ux, b: uy, ab: evOf(evidence, ux, uy), ba: evOf(evidence, uy, ux), antonym: antOf(evidence, ux, uy) } : null,
        kinds: { a: kx ?? null, b: ky ?? null },
      });
    }
    const modifiers = modifiersOf(idx, evidence, ma.map((x) => idx.mentions.get(x)).filter(Boolean), mb.map((x) => idx.mentions.get(x)).filter(Boolean));
    points.push({ point: p.id, pairs, modifiers });
  }

  // unbound and unresolved
  const unboundA = [], unboundB = [], unresolved = [];
  const antecedent = new Set();
  for (const id of entry.linkIds) { const l = byId.get(id); if (l && l.pass === 'antecedent') { antecedent.add(l.a); antecedent.add(l.b); } }
  const ownCrossClassOther = (m, s) => {
    const out = [];
    for (const e of slotsOfMention(m.id)) {
      const cl = entry.classes.find((c) => c.id === e.cl);
      for (const aid of cl.acts) {
        if (side(aid) === s || side(aid) === null) continue;
        for (const r of idx.acts.get(aid).rec.roles || []) if (String(r.role) === e.role) {
          const f = r.filler || {};
          const filler = typeof f.m === 'number' ? mentionId(idx.acts.get(aid).text, f.m) : typeof f.a === 'number' ? actId(idx.acts.get(aid).text, f.a) : 'word:' + f.word;
          out.push({ act: aid, role: e.role, filler });
        }
      }
    }
    return out;
  };
  for (const m of [...idx.mentions.values()].sort((x, y) => cmp(x.id, y.id))) {
    const s = side(m.id);
    if (s === null) continue;
    const pid = pointOf.get(m.id);
    const cr = pid ? crossOf(pointById.get(pid)) : { a: [], b: [] };
    if (cr.a.length && cr.b.length) continue;
    const slots = slotsOfMention(m.id);
    (s === 'a' ? unboundA : unboundB).push({ mention: m.id, key: m.rec.key ?? null, class: m.rec.class ?? null, slots });
    const f = m.rec.feats || {};
    if (ANAPHORIC.has(m.rec.class) && !(m.rec.class === 'pronoun' && f.Person === '1') && !antecedent.has(m.id)) {
      unresolved.push({ side: s, mention: m.id, key: m.rec.key ?? null, class: m.rec.class, slots, other: ownCrossClassOther(m, s) });
    }
  }
  const out = { c: entry.c, choice: entry.choice, acts, onlyA: only(a), onlyB: only(b), points, unboundA, unboundB, unresolved };
  return out;
}

/** buildResidues(group, pointsBody, evidence, kv) -> bind-residue body[] (C.6), one per pair of members (a < b) */
export function buildResidues(group, pointsBody, evidence, kv = NO_KINDS) {
  const idx = indexGroup(group);
  const K = kv || NO_KINDS;
  const bodies = [];
  const links = (pointsBody && pointsBody.links) || [];
  for (let i = 0; i < idx.members.length; i++) {
    for (let j = i + 1; j < idx.members.length; j++) {
      const a = idx.members[i], b = idx.members[j];
      const combinations = ((pointsBody && pointsBody.built) || []).map((entry) => residueFor(group, idx, { ...entry, _links: links }, evidence, K, a, b));
      bodies.push({
        runKey: pointsBody ? pointsBody.runKey ?? null : null,
        pair: 'pair:' + sha16(canonJson({ a, b })),
        a,
        b,
        combinations,
        tooMany: !!(pointsBody && pointsBody.tooMany),
        counts: {
          combinations: combinations.length,
          perCombination: combinations.map((x) => ({
            c: x.c, acts: x.acts.length, onlyA: x.onlyA.length, onlyB: x.onlyB.length, points: x.points.length,
            unboundA: x.unboundA.length, unboundB: x.unboundB.length, unresolved: x.unresolved.length,
          })),
        },
      });
    }
  }
  return bodies;
}
