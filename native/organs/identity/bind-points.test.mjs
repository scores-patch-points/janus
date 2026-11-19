import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPoints, combinationsOf, buildResidues } from './bind-points.mjs';
import { canonJson } from './bind-sieve-r0.mjs';

const A = 'text:aaaaaaaaaaaaaaaa';
const B = 'text:bbbbbbbbbbbbbbbb';
const D = 'text:dddddddddddddddd';
const C = 'text:cccccccccccccccc';

const mention = (m, key, extra = {}) => ({ m, key, ikey: [key], class: 'description', feats: {}, mods: [], ...extra });
const role = (r, filler) => ({ role: r, filler, borrowed: null });
const act = (a, pred, roles, extra = {}) => ({ a, pred, roles, neg: { polarity: [], pronType: [] }, embedded: ['root'], ...extra });
const L = (id, pass, a, b) => ({ id, pass, a, b, evidence: {}, round: 0, kinds: null });
const standing = (stands, held = [], extra = {}) => ({ runKey: 'rk', round: 2, fixed: true, stands, held, refused: [], ...extra });
const opts = { kinds: 'none', maxCombinations: 64, passes: 'all', dictPermute: null };

// A: "the company bought a red big widget on Monday. It shipped the widget."
// B: "the firm purchased a red small gadget on Monday."   D: a document that names the widget twice
function makeGroup(order = [A, B]) {
  const texts = {
    [A]: {
      acts: {
        mentions: [
          mention(0, 'company'),
          mention(1, 'widget', { mods: ['red', 'big'] }),
          mention(2, 'it', { class: 'pronoun', feats: { Person: '3', Number: 'Sing' } }),
        ],
        acts: [
          act(0, 'buy', [role('nsubj', { m: 0 }), role('obj', { m: 1 }), role('obl[on]', { word: 'monday', row: 9 })]),
          act(1, 'ship', [role('nsubj', { m: 2 }), role('obj', { m: 1 })]),
        ],
      },
      place: null, doc: { address: D, acts: { mentions: [mention(0, 'widget')], acts: [] } }, context: null,
    },
    [B]: {
      acts: {
        mentions: [mention(0, 'firm'), mention(1, 'gadget', { mods: [{ row: 3, key: 'red' }, 'small'] })],
        acts: [act(0, 'purchase', [role('nsubj', { m: 0 }), role('obj', { m: 1 }), role('obl[on]', { word: 'monday', row: 8 })], { neg: { polarity: [4], pronType: [] }, embedded: ['ccomp', 'root'] })],
      },
      place: null, doc: null, context: null,
    },
  };
  const ordered = {};
  for (const k of order) ordered[k] = texts[k];
  return { members: order, texts: ordered };
}

const links = [
  L('i0', 'identity', `${A}#m0`, `${B}#m0`), // company ~ firm
  L('d1', 'identity-doc', `${A}#m1`, `${D}#m0`), // widget ~ document widget
  L('d2', 'dictionary', `${D}#m0`, `${B}#m1`), // document widget ~ gadget
  L('a0', 'act', `${A}#a0`, `${B}#a0`), // buy ~ purchase
  L('h1', 'antecedent', `${A}#m2`, `${A}#m0`),
  L('h2', 'antecedent', `${A}#m2`, `${A}#m1`),
];
const rounds = [{ round: 0, links: links.slice(0, 3).concat(links.slice(4)), acts: [], fixed: false }, { round: 2, links: [], acts: [links[3]], fixed: true }];
const STANDS = ['i0', 'd1', 'd2', 'a0'];
const HELD = [{ group: 'g1', alternatives: [['h1'], ['h2']] }];

const evidence = {
  of: (u, v) => ({ shared: u.length * 10 + v.length, empty: false, nulls: [], n: 0 }),
  antonym: (u, v) => u === 'buy' && v === 'sell',
  unitOf: (m) => m.key,
  words: () => [],
};

const keysOf = (o, out = new Set()) => {
  if (Array.isArray(o)) o.forEach((x) => keysOf(x, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); keysOf(v, out); }
  return out;
};

test('points are the components of the standing links, singletons kept, held links excluded', () => {
  const body = buildPoints(makeGroup(), null, rounds, standing(STANDS, HELD), opts);
  // mentions: A 3, B 2, doc 1 -> six; i0 joins two, d1 and d2 join three -> 3 points
  assert.equal(body.points.length, 3);
  const widget = body.points.find((p) => p.mentions.length === 3);
  assert.deepEqual(widget.mentions, [`${A}#m1`, `${B}#m1`, `${D}#m0`].sort());
  assert.deepEqual(widget.texts, [A, B, D].sort());
  assert.deepEqual(widget.keys, ['gadget', 'widget']);
  assert.match(widget.id, /^pt:[0-9a-f]{16}$/);
  const lone = body.points.find((p) => p.mentions.length === 1);
  assert.deepEqual(lone.mentions, [`${A}#m2`]); // the pronoun: its antecedent links are held, not standing
  assert.deepEqual(body.counts, { points: 3, crossText: 2, classes: 1, crossTextClasses: 1 });
  assert.equal(body.runKey, 'rk');
});

test('combinations are counted in mixed radix over the held groups in id order', () => {
  const alts = [
    { group: 'g2', alternatives: [['x'], ['y'], ['z']] },
    { group: 'g1', alternatives: [['p'], ['q']] },
  ];
  const r = combinationsOf(alts, 64);
  assert.equal(r.combinations, 6);
  assert.equal(r.tooMany, false);
  // g1 (2) is first in id order and least significant; g2 (3) next
  assert.deepEqual(r.choices, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]);
  assert.deepEqual(combinationsOf([], 64), { combinations: 1, tooMany: false, choices: [[]] });
});

test('the cap is respected: over the cap only combination 0 is built, held links excluded', () => {
  const r = combinationsOf([{ group: 'g1', alternatives: [['p'], ['q']] }, { group: 'g2', alternatives: [['x'], ['y'], ['z']] }], 5);
  assert.deepEqual([r.combinations, r.tooMany, r.choices], [6, true, []]);
  const body = buildPoints(makeGroup(), null, rounds, standing(STANDS, HELD), { ...opts, maxCombinations: 1 });
  assert.equal(body.combinations, 2);
  assert.equal(body.tooMany, true);
  assert.equal(body.built.length, 1);
  assert.equal(body.built[0].choice, null);
  assert.deepEqual(body.built[0].linkIds, [...STANDS].sort());
  assert.equal(canonJson(body.built[0].points), canonJson(body.points));
  const resid = buildResidues(makeGroup(), body, evidence);
  assert.equal(resid[0].tooMany, true);
  assert.equal(resid[0].combinations.length, 1);
});

test('each combination builds its points with the chosen alternative added to the standing links', () => {
  const body = buildPoints(makeGroup(), null, rounds, standing(STANDS, HELD), opts);
  assert.equal(body.combinations, 2);
  assert.equal(body.tooMany, false);
  assert.deepEqual(body.alternatives, [{ group: 'g1', alternatives: [['h1'], ['h2']] }]);
  assert.equal(body.built.length, 2);
  const joinedWith = (c, key) => body.built[c].points.find((p) => p.keys.includes(key));
  assert.ok(joinedWith(0, 'it').mentions.includes(`${A}#m0`)); // h1: the pronoun joins the company
  assert.ok(joinedWith(0, 'it').mentions.includes(`${B}#m0`));
  assert.ok(joinedWith(1, 'it').mentions.includes(`${A}#m1`)); // h2: the pronoun joins the widget
  assert.ok(!joinedWith(1, 'it').mentions.includes(`${A}#m0`));
  assert.deepEqual(body.built.map((b) => b.choice), [[0], [1]]);
  assert.deepEqual(body.built[0].linkIds, ['a0', 'd1', 'd2', 'h1', 'i0']);
  // the base keeps the held links out
  assert.equal(body.points.find((p) => p.mentions.includes(`${A}#m2`)).mentions.length, 1);
});

test('act classes: components of the standing act links, slots grouped by filler across the texts', () => {
  const body = buildPoints(makeGroup(), null, rounds, standing(STANDS, HELD), opts);
  assert.equal(body.classes.length, 1);
  const cl = body.classes[0];
  assert.deepEqual(cl.acts, [`${A}#a0`, `${B}#a0`]);
  assert.match(cl.id, /^cl:[0-9a-f]{16}$/);
  assert.equal(cl.slots.length, 3); // company/firm point, widget/gadget point, the word monday
  const bySlot = (pairs) => cl.slots.find((s) => s.pairs.some((p) => p[0] === pairs[0] && p[1] === pairs[1]));
  const nsubj = bySlot([`${A}#a0`, 'nsubj']);
  assert.deepEqual(nsubj.pairs, [[`${A}#a0`, 'nsubj'], [`${B}#a0`, 'nsubj']]);
  assert.deepEqual(bySlot([`${A}#a0`, 'obj']).pairs, [[`${A}#a0`, 'obj'], [`${B}#a0`, 'obj']]);
  assert.equal(bySlot([`${A}#a0`, 'obl[on]']).pairs.length, 2);
  // an act with no act link is in no class
  assert.ok(!body.classes.some((c) => c.acts.includes(`${A}#a1`)));
  assert.equal(body.counts.crossTextClasses, 1);
});

test('a slot nobody else fills is a slot of its own; act classes can fill slots of other classes', () => {
  const g = makeGroup();
  g.texts[A].acts.acts.push(act(2, 'say', [role('ccomp', { a: 0 })]));
  g.texts[B].acts.acts.push(act(1, 'claim', [role('ccomp', { a: 0 })]));
  const ls = [...links, L('a1', 'act', `${A}#a2`, `${B}#a1`)];
  const body = buildPoints(g, null, [{ links: ls, acts: [] }], standing([...STANDS, 'a1']), opts);
  assert.equal(body.classes.length, 2);
  const outer = body.classes.find((c) => c.acts.includes(`${A}#a2`));
  assert.equal(outer.slots.length, 1);
  assert.equal(outer.slots[0].key.slice(0, 2), 'c:'); // the filler is an act in one class
  assert.deepEqual(outer.slots[0].pairs, [[`${A}#a2`, 'ccomp'], [`${B}#a1`, 'ccomp']]);
  // the pronoun's act has no link: its role is in no class
  const solo = buildPoints(makeGroup(), null, [{ links: [], acts: [] }], standing([]), opts);
  assert.equal(solo.classes.length, 0);
  assert.equal(solo.points.length, 6);
});

test('SEG on a hand-built pair: slots, via, modifiers, onlyA, unbound, unresolved', () => {
  const g = makeGroup();
  const pts = buildPoints(g, null, rounds, standing(STANDS, HELD), opts);
  const res = buildResidues(g, pts, evidence);
  assert.equal(res.length, 1); // one pair
  const r = res[0];
  assert.equal([r.a, r.b].join(), [A, B].join());
  assert.match(r.pair, /^pair:[0-9a-f]{16}$/);
  assert.equal(r.combinations.length, 2);
  const c0 = r.combinations[0];

  // the shared act class: slots aligned, pred evidence both ways, stance counts, embedded chains
  assert.equal(c0.acts.length, 1);
  const ac = c0.acts[0];
  assert.deepEqual(ac.members, { a: [`${A}#a0`], b: [`${B}#a0`] });
  assert.equal(ac.slots.length, 3);
  assert.ok(ac.slots.every((s) => s.aligned && s.a.length === 1 && s.b.length === 1));
  assert.deepEqual(ac.pred.a, ['buy']);
  assert.deepEqual(ac.pred.b, ['purchase']);
  assert.deepEqual(ac.pred.evidence[0].ab, evidence.of('buy', 'purchase'));
  assert.deepEqual(ac.pred.evidence[0].ba, evidence.of('purchase', 'buy'));
  assert.equal(ac.pred.antonym, false);
  assert.deepEqual(ac.stance, { a: { polarity: 0, pronType: 0, embedded: ['root'] }, b: { polarity: 1, pronType: 0, embedded: ['ccomp', 'root'] } });
  assert.deepEqual(ac.embedded, { a: [['root']], b: [['ccomp', 'root']] });

  // the act A has and B lacks
  assert.deepEqual(c0.onlyA.map((x) => x.act), [`${A}#a1`]);
  assert.deepEqual(c0.onlyB, []);
  assert.equal(c0.onlyA[0].roles[0].mention, `${A}#m2`);
  assert.deepEqual(c0.onlyA[0].embedded, ['root']); // the chain the reader of ground B needs
  assert.equal(c0.onlyA[0].parent, null);

  // shared points: company/firm directly, widget/gadget through the document
  assert.equal(c0.points.length, 2);
  const direct = c0.points.find((p) => p.pairs[0].heads.a === 'company');
  assert.deepEqual(direct.pairs[0].via, ['identity']);
  assert.deepEqual(direct.pairs[0].heads, { a: 'company', b: 'firm' });
  assert.equal(direct.pairs[0].headEvidence.ab.shared, evidence.of('company', 'firm').shared);
  assert.deepEqual(direct.modifiers, { onlyA: [], onlyB: [], evidence: [] });
  const wide = c0.points.find((p) => p.pairs[0].heads.a === 'widget');
  assert.deepEqual(wide.pairs[0].via, ['identity-doc', 'dictionary']);
  assert.deepEqual(wide.modifiers.onlyA, ['big']); // red is on both sides
  assert.deepEqual(wide.modifiers.onlyB, ['small']);
  assert.deepEqual(wide.modifiers.evidence, [{ a: 'big', b: 'small', ab: evidence.of('big', 'small'), ba: evidence.of('small', 'big'), antonym: false }]);

  // combination 0 joins the pronoun to the company point (h1), combination 1 to the widget point (h2):
  // both points are shared, so in neither combination is the pronoun unbound or unresolved
  assert.deepEqual(c0.unboundA, []);
  assert.deepEqual(c0.unboundB, []);
  assert.equal(c0.unresolved.length, 0);
  const c1 = r.combinations[1];
  assert.deepEqual([c1.unboundA, c1.unresolved], [[], []]);
  assert.equal(c1.points.find((p) => p.pairs.some((q) => q.mentions.a === `${A}#m2`)) !== undefined, true);
  assert.equal(c0.points.length, 2);
});

test('an act in onlyA or onlyB carries its embedded chain and the act that holds it as a role filler', () => {
  const g = makeGroup();
  // A adds "the company said that it shipped": a2 (say) holds a3 (ship) as its ccomp; B adds a clause no act of A matches
  g.texts[A].acts.acts.push(act(2, 'say', [role('nsubj', { m: 0 }), role('ccomp', { a: 3 })]));
  g.texts[A].acts.acts.push(act(3, 'ship', [role('obj', { m: 1 })], { embedded: ['ccomp', 'root'] }));
  g.texts[B].acts.acts.push(act(1, 'close', [role('nsubj', { m: 0 })], { embedded: ['advcl', 'conj', 'root'] }));
  const byAct = (list, id) => list.find((x) => x.act === id);
  const c0 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  assert.deepEqual(byAct(c0.onlyA, `${A}#a2`).embedded, ['root']);
  assert.equal(byAct(c0.onlyA, `${A}#a2`).parent, null);
  assert.deepEqual(byAct(c0.onlyA, `${A}#a3`).embedded, ['ccomp', 'root']);
  assert.equal(byAct(c0.onlyA, `${A}#a3`).parent, `${A}#a2`);
  assert.deepEqual(byAct(c0.onlyB, `${B}#a1`).embedded, ['advcl', 'conj', 'root']);
  assert.equal(byAct(c0.onlyB, `${B}#a1`).parent, null);
  // a record with no chain gives an empty chain, never a missing field
  delete g.texts[B].acts.acts[1].embedded;
  const c1 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  assert.deepEqual(byAct(c1.onlyB, `${B}#a1`).embedded, []);
});

test('parent also finds the act that holds a predicate nominal: the role names the mention and the same row heads the copular act', () => {
  const g = makeGroup();
  // A adds "the company said it was a lie": a2 (say) holds, as its ccomp, the mention m3 ("lie"), and row 14, the head of m3,
  // also heads the copular act a3 (be); a3's own attr role names the same mention and must not make it its own parent
  g.texts[A].acts.mentions.push(mention(3, 'lie', { head: 14 }), mention(4, 'door', { head: 20 }));
  g.texts[A].acts.acts.push(act(2, 'say', [role('nsubj', { m: 0 }), role('ccomp', { m: 3 })]));
  g.texts[A].acts.acts.push(act(3, 'be', [role('attr', { m: 3 })], { head: 14, copular: true, embedded: ['ccomp', 'root'] }));
  // a mention on a row that heads no act changes nothing
  g.texts[A].acts.acts.push(act(4, 'open', [role('obj', { m: 4 })], { head: 21 }));
  const c0 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  const byAct = (id) => c0.onlyA.find((x) => x.act === id);
  assert.equal(byAct(`${A}#a3`).parent, `${A}#a2`);
  assert.deepEqual(byAct(`${A}#a3`).embedded, ['ccomp', 'root']);
  assert.equal(byAct(`${A}#a2`).parent, null);
  assert.equal(byAct(`${A}#a4`).parent, null);
  // an act held both as { a } and through a mention keeps the holder with the least id
  g.texts[A].acts.acts.push(act(5, 'doubt', [role('ccomp', { a: 3 })]));
  const c1 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  assert.equal(c1.onlyA.find((x) => x.act === `${A}#a3`).parent, `${A}#a2`);
});

test('modifiers are compared as the keys of the reading rows their indexes name, not as the indexes', () => {
  // the same modifier "red" sits at row 3 in A and row 4 in B (B has one more word before it); "big" and "small" sit at row 1
  const g = makeGroup();
  g.texts[A].acts.mentions[1] = mention(1, 'widget', { mods: [3, 1] });
  g.texts[B].acts.mentions[1] = mention(1, 'gadget', { mods: [4, 1] });
  g.texts[A].rows = [{ key: 'x' }, { key: 'big' }, { key: 'y' }, { key: 'red' }];
  g.texts[B].rows = [{ key: 'x' }, { key: 'small' }, { key: 'y' }, { key: 'z' }, { key: 'red' }];
  const c0 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  const wide = c0.points.find((p) => p.pairs[0].heads.a === 'widget');
  assert.deepEqual(wide.modifiers.onlyA, ['big']); // red is on both sides although its index differs
  assert.deepEqual(wide.modifiers.onlyB, ['small']); // big and small share index 1 but are different words
  // with no rows an index is not compared at all (a number alone says nothing about a word): no difference is invented
  delete g.texts[A].rows; delete g.texts[B].rows;
  const c1 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  const bare = c1.points.find((p) => p.pairs[0].heads.a === 'widget');
  assert.deepEqual([bare.modifiers.onlyA, bare.modifiers.onlyB], [[], []]);
});

test('a negation marker (a word filler on a row of neg.polarity) is no slot, so a negated act can line up with the plain one', () => {
  const g = makeGroup();
  // B's purchase is "did not purchase": the role advmod holds the word "not" on row 4, which neg.polarity counts
  g.texts[B].acts.acts[0] = act(0, 'purchase', [role('nsubj', { m: 0 }), role('obj', { m: 1 }), role('obl[on]', { word: 'monday', row: 8 }), role('advmod', { word: 'not', row: 4 })], { neg: { polarity: [4], pronType: [] }, embedded: ['root'] });
  const c0 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  const ac = c0.acts[0];
  assert.equal(ac.slots.length, 3); // company/firm, widget/gadget, monday: no slot for "not"
  assert.ok(ac.slots.every((s) => s.aligned));
  assert.equal(ac.stance.b.polarity, 1); // the negation is in the stance
  // an adverb that the act's neg.pronType counts ("never") is a negation marker too
  g.texts[B].acts.acts[0].roles = [role('nsubj', { m: 0 }), role('obj', { m: 1 }), role('obl[on]', { word: 'monday', row: 8 }), role('advmod', { word: 'never', row: 4 })];
  g.texts[B].acts.acts[0].neg = { polarity: [], pronType: [4] };
  const cNever = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  assert.equal(cNever.acts[0].slots.length, 3);
  assert.equal(cNever.acts[0].stance.b.pronType, 1);
  g.texts[B].acts.acts[0].roles = [role('nsubj', { m: 0 }), role('obj', { m: 1 }), role('obl[on]', { word: 'monday', row: 8 }), role('advmod', { word: 'not', row: 4 })];
  g.texts[B].acts.acts[0].neg = { polarity: [4], pronType: [] };
  // a word filler on a row neg.polarity does not count stays a slot of its own
  g.texts[B].acts.acts[0].roles.push(role('advmod', { word: 'quickly', row: 6 }));
  const c1 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  const slots = c1.acts[0].slots;
  assert.equal(slots.length, 4);
  assert.equal(slots.filter((s) => !s.aligned).length, 1);
});

test('parent: a lent role holds nothing, an act is never its own parent, and the head rows of another text are not this text\'s acts', () => {
  const g = makeGroup();
  // A: an acl clause a2 has the borrowed role "head" filled by the mention m3, whose head row (14) is also the row of the copular act a3
  g.texts[A].acts.mentions.push(mention(3, 'lie', { head: 14 }));
  g.texts[A].acts.acts.push(act(2, 'say', [{ role: 'head', filler: { m: 3 }, borrowed: 'acl' }], { embedded: ['acl', 'root'] }));
  g.texts[A].acts.acts.push(act(3, 'be', [role('attr', { m: 3 })], { head: 14, copular: true, embedded: ['ccomp', 'root'] }));
  // B has a mention on row 14 too, held by one of B's acts: it gives no parent to A's a3
  g.texts[B].acts.mentions.push(mention(5, 'door', { head: 14 }));
  g.texts[B].acts.acts.push(act(1, 'open', [role('ccomp', { m: 5 })]));
  const c0 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  const a3 = c0.onlyA.find((x) => x.act === `${A}#a3`);
  assert.equal(a3.parent, null); // not the acl clause (lent role), not itself (its own attr role names its own row), not B's act
  assert.equal(c0.onlyA.find((x) => x.act === `${A}#a2`).parent, null);
  // the same role, not lent, is a holding
  g.texts[A].acts.acts[2] = act(2, 'say', [role('ccomp', { m: 3 })]);
  const c1 = buildResidues(g, buildPoints(g, null, rounds, standing(STANDS, HELD), opts), evidence)[0].combinations[0];
  assert.equal(c1.onlyA.find((x) => x.act === `${A}#a3`).parent, `${A}#a2`);
});

test('a pronoun with no antecedent and no cross-text point is unresolved, with the other text\'s fillers of its slot', () => {
  const g = makeGroup();
  g.texts[A].acts.acts.push(act(2, 'say', [role('nsubj', { m: 2 })]));
  g.texts[B].acts.acts.push(act(1, 'say', [role('nsubj', { m: 0 })]));
  const ls = [...links, L('a2', 'act', `${A}#a2`, `${B}#a1`)];
  const pts = buildPoints(g, null, [{ links: ls, acts: [] }], standing([...STANDS, 'a2']), opts);
  const r = buildResidues(g, pts, evidence)[0].combinations[0];
  assert.equal(r.unresolved.length, 1);
  const u = r.unresolved[0];
  assert.equal(u.mention, `${A}#m2`);
  assert.equal(u.side, 'a');
  assert.equal(u.slots.length, 1);
  assert.deepEqual(u.other, [{ act: `${B}#a1`, role: 'nsubj', filler: `${B}#m0` }]);
  // a first-person pronoun is not asked for an antecedent
  g.texts[A].acts.mentions[2].feats = { Person: '1' };
  const r2 = buildResidues(g, pts, evidence)[0].combinations[0];
  assert.equal(r2.unresolved.length, 0);
});

test('byte-identical output when members, texts, rounds and standing are presented in another order', () => {
  const g1 = makeGroup([A, B]);
  const g2 = makeGroup([B, A]);
  const rounds2 = [...rounds].reverse().map((x) => ({ ...x, links: [...x.links].reverse(), acts: [...x.acts].reverse() }));
  const s1 = standing(STANDS, HELD);
  const s2 = standing([...STANDS].reverse(), [{ group: 'g1', alternatives: [['h2'], ['h1']] }]);
  const p1 = buildPoints(g1, null, rounds, s1, opts);
  const p2 = buildPoints(g2, null, rounds2, s2, opts);
  assert.equal(canonJson(p1), canonJson(p2));
  assert.equal(canonJson(buildResidues(g1, p1, evidence)), canonJson(buildResidues(g2, p2, evidence)));
  assert.equal(JSON.stringify(p1), JSON.stringify(p2)); // not only canonically equal
});

test('Janus writes no side that counts: no output field is named standing, call or verdict', () => {
  const g = makeGroup();
  const pts = buildPoints(g, null, rounds, standing(STANDS, HELD), opts);
  const res = buildResidues(g, pts, evidence);
  for (const body of [pts, ...res]) {
    const keys = keysOf(body);
    for (const bad of ['standing', 'call', 'verdict', 'stands', 'held', 'refused', 'same']) assert.ok(!keys.has(bad), `field ${bad}`);
  }
});

test('the file imports only node built-ins and files of its own repo, names no model and no other repo', () => {
  const src = readFileSync(fileURLToPath(new URL('./bind-points.mjs', import.meta.url)), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['./bind-sieve-r0.mjs', './bind-sieve-struct.mjs']);
  for (const bad of ['khora', 'penelope', 'pair-witness', 'unit-witness', 'smell', 'testimony', 'ollama', '11434', '11450', 'anthropic', '/api/generate', '/api/chat', '/api/embed', 'fetch(', 'child_process']) {
    assert.ok(!src.toLowerCase().includes(bad.toLowerCase()), `names ${bad}`);
  }
});

test('three or more texts: pairs in address order, each with its own residue', () => {
  const g = makeGroup();
  g.members = [A, B, C];
  g.texts[C] = { acts: { mentions: [mention(0, 'company')], acts: [] }, place: null, doc: null, context: null };
  const ls = [...links, L('i9', 'identity', `${A}#m0`, `${C}#m0`)];
  const pts = buildPoints(g, null, [{ links: ls, acts: [] }], standing([...STANDS, 'i9']), opts);
  const res = buildResidues(g, pts, evidence);
  assert.deepEqual(res.map((r) => [r.a, r.b]), [[A, B], [A, C], [B, C]]);
  const bc = res[2].combinations[0];
  assert.equal(bc.points.length, 1); // company: B and C meet through A's mention
  assert.deepEqual(bc.points[0].pairs[0].via, ['identity', 'identity']);
  assert.equal(pts.counts.crossText, 2);
});
