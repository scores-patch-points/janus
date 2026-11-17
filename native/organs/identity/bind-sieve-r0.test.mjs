import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  sha16, canonJson, mentionId, actId, parseId, linkId,
  passIdentity, passIdentityDoc, passPlace, passSpeaker, passAbbrev, passDefines, passAntecedent, round0,
} from './bind-sieve-r0.mjs';

// ------------------------------------------------------------ hand-written data

const A = 'text:aaaaaaaaaaaaaaaa';
const B = 'text:bbbbbbbbbbbbbbbb';
const D = 'text:dddddddddddddddd';

function M(m, s, head, key, cls, over = {}) {
  const { feats, ...rest } = over;
  return {
    m, s, head, rows: [head], key, ikey: [key], class: cls,
    feats: { Number: null, Person: null, Gender: null, Poss: null, PronType: null, ...(feats || {}) },
    det: [], mods: [], parent: null, at: null, headAt: null, quoted: false,
    brackets: { before: null, after: null }, figure: null, gap: null, ...rest,
  };
}

function Act(a, s, head, pred, roles, over = {}) {
  return {
    a, s, head, copular: false, pred, roles,
    neg: { polarity: [], pronType: [] }, embedded: ['root'], feats: {}, unit: 0, ...over,
  };
}

const body = (mentions, acts = []) => ({ reader: 'text-acts', rule: 'UD-ACT@1', language: 'en', mentions, acts, sentences: 4 });
const groupOf = (texts, members = Object.keys(texts)) => ({ members: [...members].sort(), texts });
const T = (acts, extra = {}) => ({ acts, place: null, doc: null, context: null, ...extra });
const ends = (l) => [l.a, l.b].sort();
const find = (links, a, b) => links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));

// ------------------------------------------------------------------ identifiers

test('ids: mention and act ids, their inverse, and a link id that ignores end order', () => {
  assert.equal(mentionId(A, 3), `${A}#m3`);
  assert.equal(actId(A, 2), `${A}#a2`);
  assert.deepEqual(parseId(`${A}#m12`), { text: A, kind: 'm', i: 12 });
  assert.deepEqual(parseId(`${A}#a0`), { text: A, kind: 'a', i: 0 });
  assert.equal(parseId('nonsense'), null);
  assert.equal(sha16('x').length, 16);
  assert.equal(canonJson({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
  assert.equal(linkId('identity', 'x#m1', 'y#m2', { k: 1 }), linkId('identity', 'y#m2', 'x#m1', { k: 1 }));
  assert.notEqual(linkId('identity', 'x#m1', 'y#m2', { k: 1 }), linkId('place', 'x#m1', 'y#m2', { k: 1 }));
});

// ---------------------------------------------------------------- P1 identity

test('P1 identity: equal ikey across member texts, classes name, description, number', () => {
  const g = groupOf({
    [A]: T(body([M(0, 0, 1, 'acme', 'name'), M(1, 0, 4, 'report', 'description', { ikey: ['quarterly', 'report'] }), M(2, 0, 6, '3', 'number')])),
    [B]: T(body([M(0, 0, 1, 'acme', 'name'), M(1, 0, 3, 'report', 'description', { ikey: ['quarterly', 'report'] }), M(2, 0, 5, '3', 'number'), M(3, 0, 7, 'report', 'description')])),
  });
  const links = passIdentity(g);
  assert.equal(links.length, 3);
  assert.ok(find(links, mentionId(A, 0), mentionId(B, 0)));
  assert.ok(find(links, mentionId(A, 1), mentionId(B, 1)));
  assert.ok(find(links, mentionId(A, 2), mentionId(B, 2)));
  assert.equal(find(links, mentionId(A, 1), mentionId(B, 3)), undefined, 'ikey [quarterly report] is not [report]');
  for (const l of links) { assert.equal(l.pass, 'identity'); assert.equal(l.round, 0); assert.equal(l.kinds, null); }
});

test('P1 identity: exclusions (same text, pronoun, expletive, relative, bare demonstrative, unequal ikey, empty ikey)', () => {
  const g = groupOf({
    [A]: T(body([
      M(0, 0, 1, 'acme', 'name'), M(1, 0, 3, 'acme', 'name'),   // two in one text: no link
      M(2, 0, 5, 'it', 'pronoun'), M(3, 0, 6, 'that', 'relative'), M(4, 0, 7, 'it', 'expletive'),
      M(5, 0, 8, 'this', 'demonstrative', { feats: { PronType: 'Dem' } }),
      M(6, 0, 9, 'beta', 'name'), M(7, 0, 10, 'gone', 'description', { ikey: [] }),
    ])),
    [B]: T(body([
      M(0, 0, 1, 'it', 'pronoun'), M(1, 0, 2, 'that', 'relative'), M(2, 0, 3, 'it', 'expletive'),
      M(3, 0, 4, 'this', 'demonstrative', { feats: { PronType: 'Dem' } }),
      M(4, 0, 5, 'gamma', 'name'), M(5, 0, 6, 'gone', 'description', { ikey: [] }),
    ])),
  });
  assert.deepEqual(passIdentity(g), []);
});

test('P1 identity: a demonstrative with a nominal head links; the article is not part of the identity', () => {
  const g = groupOf({
    [A]: T(body([M(0, 0, 2, 'plan', 'demonstrative', { ikey: ['this', 'plan'], det: [{ row: 1, key: 'this', PronType: 'Dem', Definite: null }] })])),
    [B]: T(body([M(0, 0, 2, 'plan', 'demonstrative', { ikey: ['this', 'plan'] })])),
  });
  assert.equal(passIdentity(g).length, 1);
  // ikey is read as given: the reader already left the Art rows out
  const g2 = groupOf({
    [A]: T(body([M(0, 0, 2, 'plan', 'description', { ikey: ['plan'] })])),
    [B]: T(body([M(0, 0, 3, 'plan', 'description', { ikey: ['plan'] })])),
  });
  assert.equal(passIdentity(g2).length, 1);
});

test('P1 identity: with a kind view on, kinds record both heads', () => {
  const kv = { on: true, kindOf: (key) => (key === 'acme' ? 'k:org' : null), slotCount: () => null };
  const g = groupOf({
    [A]: T(body([M(0, 0, 1, 'acme', 'name')])),
    [B]: T(body([M(0, 0, 1, 'acme', 'name')])),
  });
  assert.deepEqual(passIdentity(g, kv)[0].kinds, { a: 'k:org', b: 'k:org' });
});

// -------------------------------------------------------------------- P1 place

test('P1 place: each [m, dm] pair of a placed member; none when unplaced', () => {
  const g = groupOf({
    [A]: T(body([M(0, 0, 1, 'acme', 'name'), M(1, 0, 3, 'bob', 'name'), M(2, 0, 5, 'zed', 'name')]), {
      place: { rule: 'PLACE@1', text: A, document: D, at: [10, 40], sentences: [1, 1], mentions: [[1, 5], [0, 4]], acts: [] },
      doc: { address: D, acts: body([]) },
    }),
    [B]: T(body([M(0, 0, 1, 'acme', 'name')])),
  });
  const links = passPlace(g);
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((l) => [l.a, l.b]), [[mentionId(A, 0), mentionId(D, 4)], [mentionId(A, 1), mentionId(D, 5)]]);
  assert.ok(links.every((l) => l.pass === 'place' && l.evidence.document === D));
  assert.equal(passPlace(groupOf({ [B]: T(body([])) })).length, 0);
});

// ------------------------------------------------------------------- P1 speaker

test('P1 speaker: Person=1 with equal Number, within one text and across texts', () => {
  const first = (m, number) => M(m, 0, m + 1, 'i', 'pronoun', { feats: { Person: '1', Number: number } });
  const g = groupOf({
    [A]: T(body([first(0, 'Sing'), first(1, 'Sing'), first(2, 'Plur'), M(3, 0, 9, 'he', 'pronoun', { feats: { Person: '3', Number: 'Sing' } })])),
    [B]: T(body([first(0, 'Sing'), first(1, 'Plur')])),
  });
  const links = passSpeaker(g);
  const has = (x, y) => Boolean(find(links, x, y));
  assert.ok(has(mentionId(A, 0), mentionId(A, 1)), 'within one text');
  assert.ok(has(mentionId(A, 0), mentionId(B, 0)), 'across texts');
  assert.ok(has(mentionId(A, 1), mentionId(B, 0)));
  assert.ok(has(mentionId(A, 2), mentionId(B, 1)), 'Plur with Plur');
  assert.ok(!has(mentionId(A, 0), mentionId(A, 2)), 'Sing against Plur');
  assert.ok(!has(mentionId(A, 0), mentionId(B, 1)));
  assert.ok(!has(mentionId(A, 3), mentionId(A, 0)), 'Person=3 is not a speaker');
  assert.equal(links.length, 4);
  assert.deepEqual(find(links, mentionId(A, 0), mentionId(A, 1)).evidence, { person: '1', number: 'Sing', scope: 'within' });
  assert.equal(find(links, mentionId(A, 0), mentionId(B, 0)).evidence.scope, 'across');
});

// ------------------------------------------------------------------- P2 abbrev

const ABBREV_TEXT = 'Motorola Solutions (MSI) makes radios.';
const abbrevMentions = (text) => {
  const x0 = text.indexOf('Motorola'), x1 = x0 + 'Motorola Solutions'.length;
  const y0 = text.indexOf('MSI'), y1 = y0 + 3;
  return [
    M(0, 0, 2, 'solutions', 'name', { ikey: ['motorola', 'solutions'], at: [x0, x1], headAt: [x0 + 9, x1] }),
    M(1, 0, 4, 'msi', 'name', { at: [y0, y1], headAt: [y0, y1], brackets: { before: { char: '(', at: y0 - 1 }, after: { char: ')', at: y1 } } }),
  ];
};

test('P2 abbrev: x, one opening bracket, y with a closing bracket after it (text present: exact rule)', () => {
  const g = groupOf({ [A]: T(body(abbrevMentions(ABBREV_TEXT)), { text: ABBREV_TEXT }) });
  const links = passAbbrev(g);
  assert.equal(links.length, 1);
  assert.equal(links[0].pass, 'abbrev');
  assert.equal(links[0].a, mentionId(A, 0));
  assert.equal(links[0].b, mentionId(A, 1));
  assert.deepEqual(links[0].evidence, { open: '(', close: ')', verified: 'text' });
});

test('P2 abbrev: refused when y has no closing bracket, or something other than whitespace lies between', () => {
  const noClose = abbrevMentions(ABBREV_TEXT);
  noClose[1].brackets.after = null;
  assert.equal(passAbbrev(groupOf({ [A]: T(body(noClose), { text: ABBREV_TEXT }) })).length, 0);

  const text = 'Motorola Solutions, (MSI) makes radios.';
  assert.equal(passAbbrev(groupOf({ [A]: T(body(abbrevMentions(text)), { text }) })).length, 0, 'a comma between');
  const spaced = 'Motorola Solutions  (  MSI ) makes radios.';
  assert.equal(passAbbrev(groupOf({ [A]: T(body(abbrevMentions(spaced)), { text: spaced }) })).length, 1, 'optional whitespace on both sides');
  const twice = 'Motorola Solutions ((MSI) makes radios.';
  assert.equal(passAbbrev(groupOf({ [A]: T(body(abbrevMentions(twice)), { text: twice }) })).length, 0, 'exactly one opening character');
  const square = 'Motorola Solutions [MSI] makes radios.';
  const ms = abbrevMentions(square);
  ms[1].brackets = { before: { char: '[', at: square.indexOf('[') }, after: { char: ']', at: square.indexOf(']') } };
  assert.equal(passAbbrev(groupOf({ [A]: T(body(ms), { text: square }) })).length, 1, 'any \\p{Ps} opener');
  const quote = 'Motorola Solutions "MSI" makes radios.';
  const qs = abbrevMentions(quote);
  qs[1].brackets = { before: null, after: null };
  assert.equal(passAbbrev(groupOf({ [A]: T(body(qs), { text: quote }) })).length, 0, 'a quotation mark is not a bracket');
});

test('P2 abbrev: y before x gives no link; with no text string only an adjacent opener passes', () => {
  const late = 'The (MSI) Motorola Solutions makes radios.';
  const y0 = late.indexOf('MSI'), x0 = late.indexOf('Motorola');
  const after = [
    M(0, 0, 2, 'msi', 'name', { at: [y0, y0 + 3], brackets: { before: { char: '(', at: y0 - 1 }, after: { char: ')', at: y0 + 3 } } }),
    M(1, 0, 4, 'solutions', 'name', { at: [x0, x0 + 18] }),
  ];
  assert.equal(passAbbrev(groupOf({ [A]: T(body(after), { text: late }) })).length, 0, 'x must come before the bracket');

  const near = passAbbrev(groupOf({ [A]: T(body(abbrevMentions(ABBREV_TEXT))) }));
  assert.equal(near.length, 1);
  assert.equal(near[0].evidence.verified, 'offsets');
  const far = 'Motorola Solutions, , (MSI) makes radios.';
  assert.equal(passAbbrev(groupOf({ [A]: T(body(abbrevMentions(far))) })).length, 0, 'a wide gap is not taken on offsets alone');
});

test('P2 abbrev: runs over each document, whole, even beyond the context', () => {
  const g = groupOf({ [A]: T(body([]), { doc: { address: D, acts: body(abbrevMentions(ABBREV_TEXT)), text: ABBREV_TEXT } }) });
  const links = passAbbrev(g);
  assert.equal(links.length, 1);
  assert.equal(links[0].a, mentionId(D, 0));
});

// ------------------------------------------------------------------ P2 defines

function definesBody(over = {}, roleLabel = 'obj') {
  const ms = [
    M(0, 0, 1, 'msi', 'name', { quoted: true }),
    M(1, 0, 4, 'company', 'description'),
    M(2, 0, 7, 'radio', 'description'),
  ];
  const act = Act(0, 0, 2, 'mean', [
    { role: 'nsubj', filler: { m: 0 }, borrowed: null },
    { role: roleLabel, filler: { m: 1 }, borrowed: null },
    { role: 'obl[for]', filler: { m: 2 }, borrowed: null },
    { role: 'advmod', filler: { word: 'often', row: 3 }, borrowed: null },
  ], over);
  return body(ms, [act]);
}

test('P2 defines: a quoted nsubj and an obj, attr, xcomp or ccomp mention give a link with the act as evidence', () => {
  for (const label of ['obj', 'attr', 'xcomp', 'ccomp']) {
    const links = passDefines(groupOf({ [A]: T(definesBody({}, label)) }));
    assert.equal(links.length, 1, label);
    assert.equal(links[0].pass, 'defines');
    assert.equal(links[0].a, mentionId(A, 0));
    assert.equal(links[0].b, mentionId(A, 1));
    assert.equal(links[0].evidence.act, actId(A, 0));
    assert.equal(links[0].evidence.role, label);
  }
  const sub = definesBody({}, 'obj');
  sub.acts[0].roles[0].role = 'nsubj:pass';
  assert.equal(passDefines(groupOf({ [A]: T(sub) })).length, 1, 'nsubj of any subtype');
});

test('P2 defines: refused by a negated act, an unquoted subject, a non-mention filler, or other roles', () => {
  assert.equal(passDefines(groupOf({ [A]: T(definesBody({ neg: { polarity: [3], pronType: [] } })) })).length, 0);
  assert.equal(passDefines(groupOf({ [A]: T(definesBody({ neg: { polarity: [], pronType: [5] } })) })).length, 0);
  const unquoted = definesBody();
  unquoted.mentions[0].quoted = false;
  assert.equal(passDefines(groupOf({ [A]: T(unquoted) })).length, 0);
  const wordOnly = definesBody();
  wordOnly.acts[0].roles[1].filler = { word: 'firm', row: 4 };
  assert.equal(passDefines(groupOf({ [A]: T(wordOnly) })).length, 0);
  // the obl role is not a defined role: only the obj mention is linked
  assert.deepEqual(passDefines(groupOf({ [A]: T(definesBody()) })).map((l) => l.b), [mentionId(A, 1)]);
});

test('P2 defines: also runs in each document', () => {
  const g = groupOf({ [A]: T(body([]), { doc: { address: D, acts: definesBody() } }) });
  const links = passDefines(g);
  assert.equal(links.length, 1);
  assert.equal(links[0].a, mentionId(D, 0));
});

// --------------------------------------------------------------- P1 identity-doc

test('P1 identity-doc: only to document mentions that end an abbrev or defines link', () => {
  const dm = abbrevMentions(ABBREV_TEXT);
  const docMentions = [
    ...dm,
    M(2, 3, 20, 'msi', 'name', { at: [200, 203] }), // a later repetition: not a definition end
    M(3, 3, 22, 'radios', 'description'),
  ];
  const g = groupOf({
    [A]: T(body([M(0, 0, 1, 'solutions', 'name', { ikey: ['motorola', 'solutions'] }), M(1, 0, 4, 'msi', 'name'), M(2, 0, 6, 'radios', 'description')]), {
      doc: { address: D, acts: body(docMentions), text: ABBREV_TEXT },
    }),
  });
  const ad = [...passAbbrev(g), ...passDefines(g)];
  assert.equal(ad.length, 1);
  const links = passIdentityDoc(g, undefined, ad);
  assert.deepEqual(links.map((l) => [l.pass, l.a, l.b]).sort(), [
    ['identity-doc', mentionId(A, 0), mentionId(D, 0)],
    ['identity-doc', mentionId(A, 1), mentionId(D, 1)],
  ].sort());
  assert.equal(find(links, mentionId(A, 1), mentionId(D, 2)), undefined, 'a repetition of the word is not reached');
  assert.equal(find(links, mentionId(A, 2), mentionId(D, 3)), undefined, 'radios ends no definition');
  assert.deepEqual(links[0].evidence.via, [ad[0].id]);
  assert.deepEqual(passIdentityDoc(g, undefined, []), [], 'with no abbrev or defines proposal, nothing');
});

test('P1 identity-doc: an abbrev link inside a member text does not reach into the document', () => {
  const inText = abbrevMentions(ABBREV_TEXT);
  const g = groupOf({
    [A]: T(body(inText), { text: ABBREV_TEXT, doc: { address: D, acts: body([M(0, 0, 2, 'msi', 'name')]) } }),
  });
  const links = passIdentityDoc(g, undefined, passAbbrev(g));
  assert.deepEqual(links, []);
});

test('P1 identity-doc: a defines end in a document reaches the member mention with equal ikey', () => {
  const g = groupOf({
    [A]: T(body([M(0, 0, 1, 'msi', 'name'), M(1, 0, 3, 'company', 'description')]), {
      doc: { address: D, acts: definesBody() },
    }),
  });
  const links = passIdentityDoc(g, undefined, passDefines(g));
  assert.deepEqual(links.map((l) => ends(l)), [[mentionId(A, 0), mentionId(D, 0)].sort(), [mentionId(A, 1), mentionId(D, 1)].sort()]);
});

// ----------------------------------------------------------------- P3 antecedent

const slotAct = (a, s, head, mentionIdx, pred = 'run', role = 'nsubj', over = {}) =>
  Act(a, s, head, pred, [{ role, filler: { m: mentionIdx }, borrowed: null }], over);

test('P3 antecedent: p own sentence first, mentions before p only', () => {
  const ms = [
    M(0, 0, 1, 'bob', 'name', { feats: { Number: 'Sing' } }),
    M(1, 0, 3, 'it', 'pronoun', { feats: { Number: 'Sing', Person: '3' } }),
    M(2, 0, 5, 'tool', 'description', { feats: { Number: 'Sing' } }), // after p
  ];
  const g = groupOf({ [A]: T(body(ms, [slotAct(0, 0, 2, 1)])) });
  const { links, unresolved } = passAntecedent(g);
  assert.equal(unresolved.length, 0);
  assert.equal(links.length, 1);
  assert.equal(links[0].pass, 'antecedent');
  assert.equal(links[0].a, mentionId(A, 1));
  assert.equal(links[0].b, mentionId(A, 0));
  assert.deepEqual(links[0].evidence, { distance: 0, number: 'agree', slot: ['run', 'nsubj'], slotCount: null });
});

test('P3 antecedent: the nearest earlier sentence that holds an agreeing mention, every agreeing mention in it', () => {
  const ms = [
    M(0, 0, 1, 'ann', 'name', { feats: { Number: 'Sing' } }),
    M(1, 1, 3, 'bob', 'name', { feats: { Number: 'Sing' } }),
    M(2, 1, 5, 'tool', 'description', { feats: { Number: 'Sing' } }),
    M(3, 2, 7, 'it', 'pronoun', { feats: { Number: 'Sing', Person: '3' } }),
  ];
  const g = groupOf({ [A]: T(body(ms, [slotAct(0, 2, 8, 3)])) });
  const { links } = passAntecedent(g);
  assert.deepEqual(links.map((l) => l.b).sort(), [mentionId(A, 1), mentionId(A, 2)].sort());
  assert.ok(links.every((l) => l.evidence.distance === 1), 'sentence 1 is one back; ann in sentence 0 is not reached');
});

test('P3 antecedent: number agreement skips a disagreeing sentence; an absent Number still agrees', () => {
  const ms = [
    M(0, 0, 1, 'bob', 'name', { feats: { Number: 'Sing' } }),
    M(1, 1, 3, 'tool', 'description', { feats: { Number: 'Plur' } }),
    M(2, 2, 5, 'it', 'pronoun', { feats: { Number: 'Sing', Person: '3' } }),
  ];
  const g = groupOf({ [A]: T(body(ms, [slotAct(0, 2, 6, 2)])) });
  const l = passAntecedent(g).links;
  assert.equal(l.length, 1);
  assert.equal(l[0].b, mentionId(A, 0));
  assert.equal(l[0].evidence.distance, 2);

  const absent = [
    M(0, 0, 1, 'bob', 'name', { feats: { Number: 'Sing' } }),
    M(1, 1, 3, 'tool', 'description'), // no Number
    M(2, 2, 5, 'it', 'pronoun', { feats: { Number: 'Sing', Person: '3' } }),
  ];
  const la = passAntecedent(groupOf({ [A]: T(body(absent, [slotAct(0, 2, 6, 2)])) })).links;
  assert.equal(la.length, 1);
  assert.equal(la[0].b, mentionId(A, 1));
  assert.equal(la[0].evidence.number, 'absent');
});

test('P3 antecedent: which pronouns are looked at; unresolved with a reason', () => {
  const ms = [
    M(0, 0, 1, 'i', 'pronoun', { feats: { Person: '1', Number: 'Sing' } }),
    M(1, 0, 3, 'it', 'expletive'),
    M(2, 0, 5, 'this', 'demonstrative', { feats: { PronType: 'Dem' } }),
    M(3, 0, 7, 'they', 'pronoun', { feats: { Person: '3', Number: 'Plur' } }),
    M(4, 0, 9, 'bob', 'name'),
  ];
  const { links, unresolved } = passAntecedent(groupOf({ [A]: T(body(ms)) }));
  assert.deepEqual(links, []);
  assert.deepEqual(unresolved, [
    { mention: mentionId(A, 2), reason: 'no-candidate-in-context' },
    { mention: mentionId(A, 3), reason: 'no-candidate-in-context' },
  ]);
});

test('P3 antecedent: Person absent counts as not 1; a mention of class pronoun with Person=1 is skipped', () => {
  const ms = [
    M(0, 0, 1, 'bob', 'name'),
    M(1, 0, 3, 'it', 'pronoun', { feats: { Person: null } }),
    M(2, 0, 5, 'me', 'pronoun', { feats: { Person: '1' } }),
  ];
  const { links, unresolved } = passAntecedent(groupOf({ [A]: T(body(ms)) }));
  assert.equal(links.length, 1);
  assert.equal(links[0].a, mentionId(A, 1));
  assert.equal(unresolved.length, 0);
});

function placedGroup({ context, sentences = [3, 3], pOver = {} }) {
  const docMs = [
    M(0, 0, 1, 'ann', 'name', { feats: { Number: 'Sing' } }),
    M(1, 1, 3, 'plan', 'description', { feats: { Number: 'Sing' } }),
    M(2, 2, 5, 'tool', 'description', { feats: { Number: 'Sing' } }),
    M(3, 3, 7, 'bob', 'name', { feats: { Number: 'Sing' } }),   // the place image of the text's own mention
    M(4, 3, 9, 'it', 'pronoun', { feats: { Number: 'Sing', Person: '3' } }),
  ];
  const textMs = [
    M(0, 0, 1, 'bob', 'name', { feats: { Number: 'Sing' } }),
    M(1, 0, 3, 'it', 'pronoun', { feats: { Number: 'Sing', Person: '3' }, ...pOver }),
  ];
  return groupOf({
    [A]: T(body(textMs, [slotAct(0, 0, 4, 1, 'fail', 'nsubj')]), {
      place: { rule: 'PLACE@1', text: A, document: D, at: [30, 50], sentences, mentions: [[0, 3], [1, 4]], acts: [] },
      doc: { address: D, acts: body(docMs) },
      context,
    }),
  });
}

test('P3 antecedent: the text is searched before the document, so a text candidate hides the document', () => {
  const g = placedGroup({ context: { text: A, document: D, k: 2, sentences: [1, 3], whole: false, mentions: [1, 2, 3, 4], acts: [] } });
  const { links } = passAntecedent(g);
  // p is after bob in its own sentence: bob wins, nothing from the document
  assert.deepEqual(links.map((l) => [l.a, l.b]), [[mentionId(A, 1), mentionId(A, 0)]]);
});

test('P3 antecedent: the document is searched backward from place.sentences[0] down to the latest context, leaving out place images', () => {
  const textMs = [M(0, 0, 3, 'it', 'pronoun', { feats: { Number: 'Sing', Person: '3' } }), M(1, 0, 6, 'bob', 'name', { feats: { Number: 'Sing' } })];
  const docMs = [
    M(0, 0, 1, 'ann', 'name', { feats: { Number: 'Sing' } }),
    M(1, 1, 3, 'plan', 'description', { feats: { Number: 'Sing' } }),
    M(2, 2, 5, 'tool', 'description', { feats: { Number: 'Sing' } }),
    M(3, 3, 7, 'it', 'pronoun', { feats: { Number: 'Sing', Person: '3' } }),
    M(4, 3, 9, 'bob', 'name', { feats: { Number: 'Sing' } }), // the image of the text's bob
  ];
  const mk = (context) => groupOf({
    [A]: T(body(textMs, [slotAct(0, 0, 4, 0)]), {
      place: { rule: 'PLACE@1', text: A, document: D, at: [30, 50], sentences: [3, 3], mentions: [[0, 3], [1, 4]], acts: [] },
      doc: { address: D, acts: body(docMs) },
      context,
    }),
  });
  const ctx = (from, mentions) => ({ text: A, document: D, k: 1, sentences: [from, 3], whole: false, mentions, acts: [] });

  const wide = passAntecedent(mk(ctx(1, [1, 2, 3, 4])));
  assert.deepEqual(wide.links.map((l) => l.b), [mentionId(D, 2)], 'sentence 2 is the nearest earlier sentence; the image in sentence 3 is left out');
  assert.equal(wide.links[0].evidence.distance, 1);

  const narrow = passAntecedent(mk(ctx(3, [3, 4])));
  assert.deepEqual(narrow.links, []);
  assert.deepEqual(narrow.unresolved, [{ mention: mentionId(A, 0), reason: 'no-candidate-in-context' }]);

  const none = passAntecedent(mk(null));
  assert.deepEqual(none.unresolved, [{ mention: mentionId(A, 0), reason: 'no-candidate-in-context' }], 'with no context the document is not read');

  const grown = passAntecedent(mk(ctx(0, [0, 1, 2, 3, 4])));
  assert.deepEqual(grown.links.map((l) => l.b), [mentionId(D, 2)], 'a wider context does not displace the nearer candidate');

  const listed = passAntecedent(mk(ctx(1, [1, 3, 4])));
  assert.deepEqual(listed.links.map((l) => l.b), [mentionId(D, 1)], 'document mentions outside context.mentions are not candidates');
});

test('P3 antecedent: a text with a place gap reads without its document', () => {
  const g = placedGroup({ context: null });
  g.texts[A].place = { rule: 'PLACE@1', text: A, document: D, at: null, gap: 'not-in-document', mentions: [], acts: [] };
  g.texts[A].acts.mentions[0].s = 1; // bob after p now; no candidate before p
  const { unresolved } = passAntecedent(g);
  assert.equal(unresolved.length, 1);
});

test('P3 antecedent: relative pronoun takes the parent of its acl act head, or nothing', () => {
  const ms = [
    M(0, 0, 1, 'man', 'description', { feats: { Number: 'Sing' } }),
    M(1, 0, 2, 'who', 'relative'),
    M(2, 0, 5, 'dog', 'description'),
  ];
  const acts = [Act(0, 0, 3, 'bite', [{ role: 'nsubj', filler: { m: 1 }, borrowed: null }, { role: 'obj', filler: { m: 2 }, borrowed: null }], { embedded: ['acl', 'root'] })];
  const withParent = structuredClone(acts);
  withParent[0].parent = 1; // the head row of "man"
  const r1 = passAntecedent(groupOf({ [A]: T(body(ms, withParent)) }));
  assert.equal(r1.links.length, 1);
  assert.equal(r1.links[0].b, mentionId(A, 0));
  assert.equal(r1.links[0].evidence.via, 'parent');
  assert.deepEqual(r1.links[0].evidence.slot, ['bite', 'nsubj']);
  assert.equal(r1.links[0].evidence.number, 'absent');

  const r2 = passAntecedent(groupOf({ [A]: T(body(ms, acts)) }));
  assert.equal(r2.links.length, 1, 'without the parent row, the nearest mention before the act');
  assert.equal(r2.links[0].evidence.via, 'preceding');

  const notAcl = structuredClone(withParent);
  notAcl[0].embedded = ['root'];
  const r3 = passAntecedent(groupOf({ [A]: T(body(ms, notAcl)) }));
  assert.deepEqual(r3.links, []);
  assert.deepEqual(r3.unresolved, [{ mention: mentionId(A, 1), reason: 'no-candidate-in-context' }]);

  const noAct = passAntecedent(groupOf({ [A]: T(body(ms, [])) }));
  assert.equal(noAct.unresolved.length, 1);
});

test('P3 antecedent: the relative rule does not search; it ignores nearer agreeing mentions elsewhere', () => {
  const ms = [
    M(0, 0, 0, 'ann', 'name'),
    M(1, 1, 1, 'man', 'description'),
    M(2, 1, 2, 'who', 'relative'),
  ];
  const acts = [Act(0, 1, 3, 'come', [{ role: 'nsubj', filler: { m: 2 }, borrowed: null }], { embedded: ['acl', 'root'], parent: 1 })];
  const { links } = passAntecedent(groupOf({ [A]: T(body(ms, acts)) }));
  assert.deepEqual(links.map((l) => l.b), [mentionId(A, 1)]);
});

test('P3 antecedent: slotCount comes from the kind view (K4), null with no kinds or no standing kind', () => {
  const ms = [
    M(0, 0, 1, 'bob', 'name'),
    M(1, 0, 3, 'it', 'pronoun', { feats: { Person: '3' } }),
  ];
  const g = groupOf({ [A]: T(body(ms, [slotAct(0, 0, 4, 1, 'fail', 'nsubj')])) });
  const kv = { on: true, kindOf: () => 'k1', slotCount: (key, pred, role) => (key === 'bob' && pred === 'fail' && role === 'nsubj' ? 7 : null) };
  assert.equal(passAntecedent(g, kv).links[0].evidence.slotCount, 7);
  assert.deepEqual(passAntecedent(g, kv).links[0].kinds, { a: 'k1', b: 'k1' });
  const none = { on: true, kindOf: () => null, slotCount: () => null };
  assert.equal(passAntecedent(g, none).links[0].evidence.slotCount, null);
  assert.equal(passAntecedent(g).links[0].evidence.slotCount, null);
});

// ------------------------------------------------------------------- round 0

function wholeGroup() {
  const aMs = [
    M(0, 0, 1, 'acme', 'name'),
    M(1, 0, 3, 'i', 'pronoun', { feats: { Person: '1', Number: 'Sing' } }),
    M(2, 1, 5, 'it', 'pronoun', { feats: { Person: '3', Number: 'Sing' } }),
  ];
  const bMs = [
    M(0, 0, 1, 'acme', 'name'),
    M(1, 0, 3, 'i', 'pronoun', { feats: { Person: '1', Number: 'Sing' } }),
  ];
  return groupOf({
    [A]: T(body(aMs, [slotAct(0, 1, 6, 2)]), {
      place: { rule: 'PLACE@1', text: A, document: D, at: [0, 20], sentences: [0, 1], mentions: [[0, 0]], acts: [] },
      doc: { address: D, acts: body([M(0, 0, 1, 'acme', 'name')]) },
      context: { text: A, document: D, k: 1, sentences: [0, 1], whole: true, mentions: [0], acts: [] },
    }),
    [B]: T(body(bMs)),
  });
}

test('round 0: every pass present, shape fixed, no acts, unresolved listed', () => {
  const r = round0(wholeGroup(), undefined, {});
  assert.deepEqual(Object.keys(r).sort(), ['acts', 'links', 'unresolved']);
  assert.deepEqual(r.acts, []);
  const passes = [...new Set(r.links.map((l) => l.pass))].sort();
  assert.deepEqual(passes, ['antecedent', 'identity', 'place', 'speaker']);
  assert.equal(new Set(r.links.map((l) => l.id)).size, r.links.length, 'ids are unique');
  for (const l of r.links) {
    assert.equal(l.round, 0);
    assert.equal(l.id, linkId(l.pass, l.a, l.b, l.evidence));
    assert.ok(parseId(l.a) && parseId(l.b));
  }
  assert.ok(r.unresolved.every((u) => u.reason === 'no-candidate-in-context'));
});

test('round 0: independent of member order, text-key order and repetition', () => {
  const g = wholeGroup();
  const reversed = { members: [...g.members].reverse(), texts: Object.fromEntries(Object.entries(g.texts).reverse()) };
  const again = structuredClone(g);
  const base = canonJson(round0(g, undefined, {}));
  assert.equal(canonJson(round0(reversed, undefined, {})), base);
  assert.equal(canonJson(round0(again, undefined, {})), base);
});

test('round 0: a group of one text proposes only within-text links', () => {
  const r = round0(groupOf({ [A]: T(body([M(0, 0, 1, 'acme', 'name'), M(1, 0, 3, 'acme', 'name')])) }), undefined, {});
  assert.deepEqual(r.links, []);
});

test('round 0: purity, no model, no outside imports', () => {
  const src = readFileSync(fileURLToPath(new URL('./bind-sieve-r0.mjs', import.meta.url)), 'utf8');
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((x) => x[1]);
  assert.deepEqual(imports, ['node:crypto']);
  const banned = ['pair-' + 'witness', 'unit-' + 'witness', 'sme' + 'll', 'testi' + 'mony', 'olla' + 'ma', '1143' + '4', '1145' + '0', 'anthro' + 'pic', '/api/' + 'generate', '/api/' + 'chat', '/api/' + 'embed'];
  for (const word of banned) assert.ok(!src.includes(word) && !self.includes(word), word);
  for (const word of ['fetch(', 'child_' + 'process', 'Math.random', 'Date.now', 'node:' + 'http', 'node:' + 'net']) assert.ok(!src.includes(word), word);
});
