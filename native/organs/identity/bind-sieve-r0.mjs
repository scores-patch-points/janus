// bind-sieve-r0.mjs — the binder's sieve, ROUND 0 (CONTRACT C.3). Pure.
//
// Reads a group (members' text-acts bodies, text-place bodies, the documents'
// text-acts bodies, the latest context per placed member) and proposes links
// that need nothing standing: P1 identity, identity-doc, place, speaker;
// P2 abbrev, defines; P3 antecedent. Janus proposes; whether a link stands is
// not decided here, and no id is ever rewritten.
//
// Nothing here does I/O, reads a clock, draws a random number, or calls a
// model. Members, mentions and acts are walked in address and index order,
// never in presentation order, so a group's links are a function of its
// members and contexts only.
//
// group  = { members: [address], texts: { [address]: { acts, place, doc, context, text? } } }
//          doc = { address, acts, text? }; acts = a text-acts body.
// kv     = the read-only kind view (inert when kinds are none).
// link   = { id, pass, a, b, evidence, round: 0, kinds }; a and b are mention ids.

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------- identifiers

export function sha16(s) {
  return createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
}

export function canonJson(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => canonJson(x)).join(',') + ']';
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonJson(v[k])).join(',') + '}';
}

export function mentionId(text, m) { return `${text}#m${m}`; }
export function actId(text, a) { return `${text}#a${a}`; }

export function parseId(id) {
  const hit = /^(.*)#([ma])(\d+)$/s.exec(String(id));
  if (!hit) return null;
  return { text: hit[1], kind: hit[2], i: Number(hit[3]) };
}

export function linkId(pass, a, b, evidence) {
  const ends = [String(a), String(b)].sort();
  return sha16(canonJson({ pass, ends, evidence }));
}

// ------------------------------------------------------------------- helpers

const NO_KINDS = { on: false, kindOf: () => null, slotCount: () => null, sameKind: () => null, companyCount: () => null };
const ENTITY = 'entity'; // the population whose standing kinds a mention's head is looked up in (K1)

const NOMINAL_CLASSES = new Set(['name', 'description', 'number', 'demonstrative']);
const CANDIDATE_CLASSES = new Set(['name', 'description', 'number']);
const DEFINED_ROLES = new Set(['obj', 'attr', 'xcomp', 'ccomp']);

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
const roleBase = (role) => String(role).replace(/[:[].*$/s, '');
const mentionsOf = (body) => (body && Array.isArray(body.mentions) ? body.mentions : []);
const actsOf = (body) => (body && Array.isArray(body.acts) ? body.acts : []);
const num = (v) => (v === null || v === undefined ? null : v);

function addressesOf(group) {
  const have = Object.keys((group && group.texts) || {});
  const listed = Array.isArray(group && group.members) ? group.members.filter((a) => have.includes(a)) : have;
  return [...new Set(listed)].sort(cmp);
}

// the documents of the group, once each, in address order: { address, acts, text }
function docsOf(group) {
  const out = new Map();
  for (const addr of addressesOf(group)) {
    const d = group.texts[addr] && group.texts[addr].doc;
    if (d && d.address && d.acts && !out.has(d.address)) out.set(d.address, d);
  }
  return [...out.keys()].sort(cmp).map((k) => out.get(k));
}

const refOf = (text, mention) => ({ text, m: mention.m, key: mention.key === undefined ? null : mention.key });

function kindsFor(kv, ra, rb) {
  if (!kv || !kv.on) return null;
  return { a: num(kv.kindOf(ra.key, ENTITY)), b: num(kv.kindOf(rb.key, ENTITY)) };
}

function mkLink(pass, ra, rb, evidence, kv) {
  const a = mentionId(ra.text, ra.m);
  const b = mentionId(rb.text, rb.m);
  return { id: linkId(pass, a, b, evidence), pass, a, b, evidence, round: 0, kinds: kindsFor(kv, ra, rb) };
}

function dedupe(links) {
  const seen = new Set();
  const out = [];
  for (const l of links) if (!seen.has(l.id)) { seen.add(l.id); out.push(l); }
  return out;
}

const sameKey = (x, y) => canonJson(x) === canonJson(y);

// A nominal head: the nominal classes, except a bare demonstrative (the head is
// itself the demonstrative, PronType=Dem, with no noun under it).
function nominal(mention) {
  if (!NOMINAL_CLASSES.has(mention.class)) return false;
  if (!Array.isArray(mention.ikey) || mention.ikey.length === 0) return false;
  if (mention.class === 'demonstrative' && mention.feats && mention.feats.PronType === 'Dem') return false;
  return true;
}

// -------------------------------------------------------------- P1 identity

export function passIdentity(group, kv = NO_KINDS) {
  const seen = new Map(); // ikey -> [{ text, mention }] in (address, index) order
  for (const addr of addressesOf(group)) {
    for (const mention of mentionsOf(group.texts[addr].acts)) {
      if (!nominal(mention)) continue;
      const k = canonJson(mention.ikey);
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push({ text: addr, mention });
    }
  }
  const links = [];
  for (const [, list] of seen) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].text === list[j].text) continue;
        const evidence = { ikey: list[i].mention.ikey };
        links.push(mkLink('identity', refOf(list[i].text, list[i].mention), refOf(list[j].text, list[j].mention), evidence, kv));
      }
    }
  }
  return dedupe(links);
}

// ---------------------------------------------------------------- P2 abbrev

const OPEN = /^\p{Ps}$/u;
const BETWEEN = /^\s*\p{Ps}\s*$/u;

// The contract states the rule over the characters between the two mentions.
// With the text string present it is applied exactly; without it, the offsets
// stand in: y's own brackets.before names the opening character and where it
// is, and only a gap of at most one character may lie between x and it.
function abbrevBetween(x, y, text) {
  if (!x.at || !y.at || !y.brackets || !y.brackets.before || !y.brackets.after) return null;
  if (x.at[1] > y.at[0]) return null;
  const open = y.brackets.before;
  if (!OPEN.test(open.char) || open.at < x.at[1] || open.at >= y.at[0]) return null;
  if (typeof text === 'string') {
    return BETWEEN.test(text.slice(x.at[1], y.at[0])) ? 'text' : null;
  }
  return open.at - x.at[1] <= 1 ? 'offsets' : null;
}

function abbrevIn(address, body, text, kv) {
  const ms = mentionsOf(body).filter((mention) => mention.at);
  const links = [];
  for (const y of ms) {
    if (!y.brackets || !y.brackets.before || !y.brackets.after) continue;
    for (const x of ms) {
      if (x === y) continue;
      const verified = abbrevBetween(x, y, text);
      if (!verified) continue;
      const evidence = { open: y.brackets.before.char, close: y.brackets.after.char, verified };
      links.push(mkLink('abbrev', refOf(address, x), refOf(address, y), evidence, kv));
    }
  }
  return links;
}

export function passAbbrev(group, kv = NO_KINDS) {
  const links = [];
  for (const addr of addressesOf(group)) {
    const T = group.texts[addr];
    links.push(...abbrevIn(addr, T.acts, T.text, kv));
  }
  for (const d of docsOf(group)) links.push(...abbrevIn(d.address, d.acts, d.text, kv));
  return dedupe(links);
}

// ---------------------------------------------------------------- P2 defines

function definesIn(address, body, kv) {
  const ms = new Map(mentionsOf(body).map((mention) => [mention.m, mention]));
  const links = [];
  for (const act of actsOf(body)) {
    const neg = act.neg || {};
    if ((neg.polarity && neg.polarity.length) || (neg.pronType && neg.pronType.length)) continue; // a negated act gives no link
    const roles = Array.isArray(act.roles) ? act.roles : [];
    for (const subj of roles) {
      if (roleBase(subj.role) !== 'nsubj' || !subj.filler || subj.filler.m === undefined) continue;
      const x = ms.get(subj.filler.m);
      if (!x || x.quoted !== true) continue;
      for (const r of roles) {
        if (!DEFINED_ROLES.has(roleBase(r.role)) || !r.filler || r.filler.m === undefined) continue;
        const y = ms.get(r.filler.m);
        if (!y || y === x) continue;
        const evidence = { act: actId(address, act.a), pred: act.pred === undefined ? null : act.pred, role: r.role };
        links.push(mkLink('defines', refOf(address, x), refOf(address, y), evidence, kv));
      }
    }
  }
  return links;
}

export function passDefines(group, kv = NO_KINDS) {
  const links = [];
  for (const addr of addressesOf(group)) links.push(...definesIn(addr, group.texts[addr].acts, kv));
  for (const d of docsOf(group)) links.push(...definesIn(d.address, d.acts, kv));
  return dedupe(links);
}

// ----------------------------------------------------------- P1 identity-doc

// A member mention and a document mention with equal ikey, only where the
// document mention is an end of an abbrev or defines link of this round.
export function passIdentityDoc(group, kv = NO_KINDS, abbrevDefinesLinks = []) {
  const docs = new Map(docsOf(group).map((d) => [d.address, d]));
  const via = new Map(); // `${doc address}#${m}` -> sorted link ids
  const ends = [];
  for (const l of abbrevDefinesLinks || []) {
    if (l.pass !== 'abbrev' && l.pass !== 'defines') continue;
    for (const end of [l.a, l.b]) {
      const p = parseId(end);
      if (!p || p.kind !== 'm' || !docs.has(p.text)) continue;
      const k = `${p.text}\u0000${p.i}`;
      if (!via.has(k)) { via.set(k, new Set()); ends.push({ doc: p.text, m: p.i }); }
      via.get(k).add(l.id);
    }
  }
  ends.sort((x, y) => cmp(x.doc, y.doc) || x.m - y.m);
  const links = [];
  for (const e of ends) {
    const d = docs.get(e.doc);
    const dm = mentionsOf(d.acts).find((mention) => mention.m === e.m);
    if (!dm || !nominal(dm)) continue;
    const ids = [...via.get(`${e.doc}\u0000${e.m}`)].sort();
    for (const addr of addressesOf(group)) {
      const T = group.texts[addr];
      if (!T.doc || T.doc.address !== e.doc) continue;
      for (const mention of mentionsOf(T.acts)) {
        if (!nominal(mention) || !sameKey(mention.ikey, dm.ikey)) continue;
        const evidence = { ikey: mention.ikey, via: ids };
        links.push(mkLink('identity-doc', refOf(addr, mention), refOf(e.doc, dm), evidence, kv));
      }
    }
  }
  return dedupe(links);
}

// ------------------------------------------------------------------ P1 place

export function passPlace(group, kv = NO_KINDS) {
  const links = [];
  for (const addr of addressesOf(group)) {
    const T = group.texts[addr];
    const place = T.place;
    if (!place || !Array.isArray(place.mentions)) continue;
    const docAddr = (T.doc && T.doc.address) || place.document;
    if (!docAddr) continue;
    const mine = new Map(mentionsOf(T.acts).map((mention) => [mention.m, mention]));
    const theirs = new Map(mentionsOf(T.doc && T.doc.acts).map((mention) => [mention.m, mention]));
    const pairs = place.mentions.filter((p) => Array.isArray(p) && p.length === 2).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    for (const [m, dm] of pairs) {
      const ra = { text: addr, m, key: mine.has(m) ? num(mine.get(m).key) : null };
      const rb = { text: docAddr, m: dm, key: theirs.has(dm) ? num(theirs.get(dm).key) : null };
      links.push(mkLink('place', ra, rb, { document: docAddr }, kv));
    }
  }
  return dedupe(links);
}

// ---------------------------------------------------------------- P1 speaker

export function passSpeaker(group, kv = NO_KINDS) {
  const firsts = [];
  for (const addr of addressesOf(group)) {
    for (const mention of mentionsOf(group.texts[addr].acts)) {
      if (mention.feats && mention.feats.Person === '1') firsts.push({ text: addr, mention });
    }
  }
  const links = [];
  for (let i = 0; i < firsts.length; i++) {
    for (let j = i + 1; j < firsts.length; j++) {
      const x = firsts[i], y = firsts[j];
      const nx = num(x.mention.feats.Number), ny = num(y.mention.feats.Number);
      if (nx !== ny) continue;
      const evidence = { person: '1', number: nx, scope: x.text === y.text ? 'within' : 'across' };
      links.push(mkLink('speaker', refOf(x.text, x.mention), refOf(y.text, y.mention), evidence, kv));
    }
  }
  return dedupe(links);
}

// ------------------------------------------------------------- P3 antecedent

const isAnaphor = (mention) => {
  if (mention.class === 'relative' || mention.class === 'demonstrative') return true;
  return mention.class === 'pronoun' && !(mention.feats && mention.feats.Person === '1');
};

// [pred, role] of the first role p fills in an act of its own text, with the act
function slotOf(acts, p) {
  for (const act of actsOf(acts)) {
    for (const r of Array.isArray(act.roles) ? act.roles : []) {
      if (r.filler && r.filler.m === p.m) return { pred: act.pred === undefined ? null : act.pred, role: r.role, act };
    }
  }
  return null;
}

function numberRelation(p, c) {
  const np = p.feats && p.feats.Number, nc = c.feats && c.feats.Number;
  if (!np || !nc) return 'absent';
  return np === nc ? 'agree' : 'differ';
}

function bySentence(list) {
  const out = new Map();
  for (const mention of list) {
    if (!out.has(mention.s)) out.set(mention.s, []);
    out.get(mention.s).push(mention);
  }
  return out;
}

// the search order of C.3: p's own sentence (mentions before p), earlier
// sentences of p's text, then the document inside the latest context
function* layersFor(T, addr, p) {
  const ms = mentionsOf(T.acts).filter((c) => CANDIDATE_CLASSES.has(c.class));
  const own = bySentence(ms);
  yield { text: addr, distance: 0, list: (own.get(p.s) || []).filter((c) => c.m < p.m) };
  const earlier = [...own.keys()].filter((s) => s < p.s).sort((x, y) => y - x);
  for (const s of earlier) yield { text: addr, distance: p.s - s, list: own.get(s) };

  const place = T.place, ctx = T.context, doc = T.doc;
  if (!place || !place.at || !Array.isArray(place.sentences) || !doc || !doc.acts || !ctx || !Array.isArray(ctx.sentences)) return;
  const images = new Set((place.mentions || []).filter((q) => Array.isArray(q)).map((q) => q[1]));
  const inContext = Array.isArray(ctx.mentions) ? new Set(ctx.mentions) : null;
  const dms = mentionsOf(doc.acts).filter((c) => CANDIDATE_CLASSES.has(c.class) && !images.has(c.m) && (!inContext || inContext.has(c.m)));
  const theirs = bySentence(dms);
  const s0 = place.sentences[0];
  const back = [...theirs.keys()].filter((s) => s <= s0 && s >= ctx.sentences[0]).sort((x, y) => y - x);
  for (const s of back) yield { text: doc.address, distance: p.s + (s0 - s), list: theirs.get(s) };
}

function relativeCandidates(T, addr, p) {
  const ms = mentionsOf(T.acts);
  const act = actsOf(T.acts).find((x) => Array.isArray(x.embedded) && x.embedded[0] === 'acl'
    && (Array.isArray(x.roles) ? x.roles : []).some((r) => r.filler && r.filler.m === p.m));
  if (!act) return [];
  // the head row of the acl act's parent, when the reading carries it; else the
  // nearest mention before the act's head row, said so in the evidence
  if (typeof act.parent === 'number') {
    const c = ms.find((x) => x.head === act.parent);
    return c ? [{ text: addr, distance: p.s - c.s, mention: c, via: 'parent' }] : [];
  }
  const before = ms.filter((x) => x.class !== 'relative' && x !== p && x.head < act.head).sort((x, y) => y.head - x.head)[0];
  return before ? [{ text: addr, distance: p.s - before.s, mention: before, via: 'preceding' }] : [];
}

export function passAntecedent(group, kv = NO_KINDS) {
  const links = [];
  const unresolved = [];
  for (const addr of addressesOf(group)) {
    const T = group.texts[addr];
    for (const p of mentionsOf(T.acts)) {
      if (!isAnaphor(p)) continue;
      const slot = slotOf(T.acts, p);
      let cands = [];
      if (p.class === 'relative') {
        cands = relativeCandidates(T, addr, p);
      } else {
        const agrees = (c) => numberRelation(p, c) !== 'differ';
        for (const layer of layersFor(T, addr, p)) {
          const hit = layer.list.filter(agrees);
          if (hit.length) { cands = hit.map((c) => ({ text: layer.text, distance: layer.distance, mention: c })); break; }
        }
      }
      if (!cands.length) { unresolved.push({ mention: mentionId(addr, p.m), reason: 'no-candidate-in-context' }); continue; }
      for (const c of cands) {
        const slotCount = kv.on && slot ? num(kv.slotCount(c.mention.key, slot.pred, slot.role)) : null;
        const evidence = {
          distance: c.distance,
          number: numberRelation(p, c.mention),
          slot: slot ? [slot.pred, slot.role] : null,
          slotCount,
        };
        if (c.via) evidence.via = c.via;
        links.push(mkLink('antecedent', refOf(addr, p), refOf(c.text, c.mention), evidence, kv));
      }
    }
  }
  return { links: dedupe(links), unresolved };
}

// ------------------------------------------------------------------- round 0

export function round0(group, kv = NO_KINDS, opts = {}) {
  void opts; // round 0 reads nothing of the bind-bound beyond the kind view
  const k = kv || NO_KINDS;
  const abbrev = passAbbrev(group, k);
  const defines = passDefines(group, k);
  const ante = passAntecedent(group, k);
  const links = dedupe([
    ...passIdentity(group, k),
    ...passIdentityDoc(group, k, [...abbrev, ...defines]),
    ...passPlace(group, k),
    ...passSpeaker(group, k),
    ...abbrev,
    ...defines,
    ...ante.links,
  ]);
  return { links, acts: [], unresolved: ante.unresolved };
}
