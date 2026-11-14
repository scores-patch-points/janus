// The finder's logic, with stub readers: no model, no khora. These tests pin
// what the finder does with answers; they say nothing about how well any real
// reader reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { find, findUnder, strictlySame } from './text-finder.mjs';
import { readGround, readQuestion } from './text-ground.mjs';
import { align, substitute } from './text-align.mjs';
import { huntHunks, huntFigures, huntNames } from './text-hunters.mjs';
import { unitsOf } from './text-units.mjs';
import { standingOf, standpoint, verdict4, SEVEN } from './standing.mjs';
import { segment, surfaceReading, surfaceReader, figureValue, allInformation, carries, sameThing, sameKind } from './text-finder.fixture.mjs';

const load = (name) => JSON.parse(fs.readFileSync(new URL(`./grounds/statement-equivalence.${name}.json`, import.meta.url), 'utf8'));
const STRICT = load('strict'), CASUAL = load('casual');
// A ground with one decision's body patched (the event keeps its byline).
const withBody = (ground, decides, patch) => ({ ...ground, events: ground.events.map((e) => (e.decides === decides ? { ...e, body: patch(structuredClone(e.body)) } : e)) });
const TAGS_MAY_CONVICT_ORDER = withBody(STRICT, 'dependency', (b) => ({ ...b, mechanical: { ...b.mechanical, order: ['en'] } }));

// A reader whose answers are a function of the question: every draw is kept.
function stub(name, rules = {}) {
  const asked = [];
  const mk = (kind) => async (args) => { asked.push({ kind, ...args }); const r = rules[kind]; return typeof r === 'function' ? r(args) : (r === undefined ? 'yes' : r); };
  return { by: `stub ${name}`, asked, says: mk('says'), figure: mk('figure'), mentions: mk('mentions'), denies: mk('denies'), about: mk('about'), kind: mk('kind') };
}
const readers = (quick = {}, deliberate = {}) => ({ quick: stub('quick', quick), deliberate: stub('deliberate', deliberate) });
const F = (a, b, o = {}) => find(a, b, { ground: STRICT, question: allInformation('test'), adoptedBy: 'test', read: (t, opts = {}) => surfaceReader(t, { ...opts, language: opts.language ?? 'en' }), readers: readers(), ...o });
const said = (v, branch) => v.standpoints.filter((s) => s.branch === branch).map((s) => s.says);
const row = (v, branch) => v.searched.find((s) => s.branch === branch);

// A parsed reading built by hand: "form/UPOS/feats/head/deprel[/lemma]" per token.
function parsed(text, spec) {
  let at = 0;
  const tokens = spec.map((s, i) => {
    const [form, upos, feats, head, deprel, lemma] = s.split('/');
    const start = text.indexOf(form, at); at = start + form.length;
    return { form, start, end: start + form.length, word: upos !== 'PUNCT' && upos !== 'SYM', upos, feats: feats || '_', lemma: lemma ?? form.toLowerCase(), head: Number(head), deprel, id: i + 1, sent: 0 };
  });
  return { text, language: 'en', parsed: true, offersNames: true, tokens, amounts: [], names: [], by: 'reader: hand-built parse' };
}
const reader = (table) => async (text) => table[text] ?? surfaceReading(text, { language: 'en' });

// ---- the ground is declared, or the finder refuses ---------------------------

test('refusals: no ground, a decision left open, a contest, a value or a key the kernel cannot honour', async () => {
  const base = { question: allInformation('t'), adoptedBy: 't', read: surfaceReader };
  assert.match((await find('a b', 'c d', base)).refused[0], /no ground handed in/);
  const missing = { ...STRICT, events: STRICT.events.filter((e) => e.decides !== 'absence') };
  assert.ok((await find('a b', 'c d', { ...base, ground: missing })).refused.some((r) => /absence: no live ground event/.test(r)));
  const contested = { ...STRICT, events: [...STRICT.events, { ...STRICT.events.find((e) => e.decides === 'identity'), id: 'other/identity@0', by: 'someone else' }] };
  assert.ok((await find('a b', 'c d', { ...base, ground: contested })).refused.some((r) => /identity: contested by .* and .*someone else/.test(r)));
  const superseded = { ...STRICT, events: [...STRICT.events, { ...STRICT.events.find((e) => e.decides === 'identity'), id: 'other/identity@1', by: 'someone else', supersedes: 'ground:statement-equivalence/strict/identity@0' }] };
  assert.equal(readGround(superseded).ok, true, 'a later event that supersedes the earlier one is no contest');
  const future = withBody(STRICT, 'time', (b) => ({ ...b, regime: 'valid-time' }));
  assert.ok((await find('a b', 'c d', { ...base, ground: future })).refused.some((r) => /time\.regime: .*does not implement "valid-time"/.test(r)));
  const nameless = { ...STRICT, events: STRICT.events.map((e) => (e.decides === 'time' ? { ...e, by: '' } : e)) };
  assert.ok(readGround(nameless).refused.some((r) => /no byline/.test(r)));
  const unread = withBody(STRICT, 'baseline', (b) => ({ ...b, window: { ...b.window, place: 1 } }));
  assert.ok(readGround(unread).refused.some((r) => /baseline\.window\.place: not a decision this kernel reads/.test(r)), 'a decision nobody reads is refused');
  const unmeetable = withBody(STRICT, 'sufficiency', (b) => ({ ...b, required: ['significance'] }));
  assert.ok(readGround(unmeetable).refused.some((r) => /sufficiency\.required: must be a list drawn from/.test(r)), 'a requirement nothing checks is refused');
});

test('refusals: no question, no asker, no adoption, no reader of text, an empty text, a kind nobody named', async () => {
  const base = { ground: STRICT, adoptedBy: 't', read: surfaceReader };
  assert.match((await find('a b', 'c d', base)).refused[0], /no question handed in/);
  assert.ok((await find('a b', 'c d', { ...base, question: { asks: 'same?', of: 'information', directions: 'both' } })).refused.some((r) => /who asks/.test(r)));
  assert.match((await find('a b', 'c d', { ground: STRICT, question: allInformation('t'), read: surfaceReader })).refused[0], /no adoption/);
  assert.match((await find('a b', 'c d', { ground: STRICT, question: allInformation('t'), adoptedBy: 't' })).refused[0], /no reader of text/);
  assert.match((await F('', 'b')).refused[0], /empty/);
  assert.ok(readQuestion({ asks: 'x', by: 'y', of: 'kind' }).refused.some((r) => /no kind declared/.test(r)));
  const two = await find(surfaceReading('The city bought 1,200 cameras.', { language: 'en' }), surfaceReading('The city bought 1200 cameras.', { language: 'en' }), { ground: STRICT, question: allInformation('t'), adoptedBy: 't', readers: readers() });
  assert.equal(two.distinctions.find((c) => c.kind === 'figure').signal, 'NUL', 'two readings need no reader of text');
});

// ---- nothing signs "same" without examining something -------------------------

test('identical texts need no hunt and no draw; but a kind question and an identity question are still asked of them', async () => {
  const r = readers();
  const v = await F('The council approved the contract.', 'The council  approved the contract.', { readers: r });
  assert.equal(v.standing, 'asti'); assert.equal(r.quick.asked.length + r.deliberate.asked.length, 0);
  const k = readers({ kind: 'no' });
  const w = await F('The bridge closed in May.', 'The bridge closed in May.', { question: sameKind('an invoice', 'test'), readers: k });
  assert.equal(w.standing, 'nasti'); assert.equal(k.quick.asked.length, 1, 'one text, asked once');
  const i = readers({ about: 'no' });
  const x = await F('It closed in May.', 'It closed in May.', { question: sameThing('test'), readers: i });
  assert.ok(x.standing.includes('nasti'), 'two copies of one sentence can be about two things: the reader is asked');
  assert.equal(i.quick.asked.filter((q) => q.kind === 'about').length, 2);
});

test('with no reader of questions, matching figures do not become "same": the required whole reading was not reached', async () => {
  const v = await F('The board met in 2024.', 'Trustees torched every archive during 2024.', { readers: {} });
  assert.deepEqual(said(v, 'existence/figures'), ['is']);
  assert.deepEqual(said(v, 'significance/whole'), ['inexpressible']);
  assert.equal(v.standing, 'asti+avaktavya'); assert.equal(strictlySame(v), false);
  assert.match(v.standpoints.find((s) => s.branch === 'significance/whole').why, /required by the ground and not reached/);
});

test('a requirement is not waived by the shape of the question', async () => {
  const q = { ...allInformation('test'), layers: ['existence', 'structure'] };
  const v = await F('Any software can be integrated with any software.', 'Any software can be integrated with some software.', { question: q });
  assert.equal(strictlySame(v), false, 'this ground lets "no difference" stand only on a whole reading; a question without one cannot be closed');
  assert.match(v.standpoints.find((s) => s.branch === 'significance/whole').why, /outside the question's shape/);
});

test('a reader that answers nothing leaves no "is" anywhere', async () => {
  const v = await F('The board met on Monday in the old hall.', 'A gathering of trustees took place, early in the week.', { readers: readers({ says: null }, { says: null }) });
  assert.equal(v.standpoints.filter((s) => s.says === 'is').length, 0);
  assert.equal(v.standing, 'avaktavya'); assert.equal(v.verdict4.value, 'neither');
  assert.equal(row(v, 'parts/b asked of a').looked, 0, 'an unanswered part was not looked at');
  assert.equal(said(v, 'significance/whole').length, 1, 'said once, by the reader who could not answer');
});

test('parts beyond the ask budget leave an open place, and the standing says so', async () => {
  const small = withBody(STRICT, 'sufficiency', (b) => ({ ...b, budget: { ...b.budget, parts: 2 } }));
  const v = await F('Nothing happened at all that day.', 'One came, two left, three stayed, four slept, five ate, six ran.', { ground: small, readers: readers({}, { says: 'no' }) });
  assert.match(v.distinctions.find((c) => c.kind === 'parts-unasked').why, /4 parts of b never asked/);
  assert.ok(v.standing.includes('avaktavya'));
  assert.equal(row(v, 'parts/b asked of a').looked, 2); assert.equal(row(v, 'parts/b asked of a').reached, false);
});

// ---- the accumulated answer ----------------------------------------------------

test('many small places cannot pass one at a time: the whole reading is the accumulated answer', async () => {
  const A = 'The council met on Monday and approved the larger plan.', B = 'The board met on Tuesday and approved the smaller plan.';
  // A reader that lets every single-place change through, and refuses the whole.
  const salami = ({ passage, sentence }) => ((passage === A && sentence === B) || (passage === B && sentence === A) ? 'no' : 'yes');
  const v = await F(A, B, { readers: readers({}, { says: salami }) });
  assert.equal(v.nominations.alignment.hunks, 3);
  assert.ok(v.distinctions.filter((c) => c.hunk === undefined && c.kind === 'wording').every((c) => c.signal === 'NUL'), 'each place, asked alone, changed nothing');
  assert.ok(v.distinctions.every((c) => !c.testedAlone || /places can act together/.test(c.testedAlone)));
  assert.deepEqual(said(v, 'significance/whole'), ['is-not']);
  assert.match(v.standpoints.find((s) => s.branch === 'significance/whole').why, /no located place accounts for it/);
  assert.equal(v.standing, 'asti+nasti'); assert.equal(strictlySame(v), false);
});

test('one draw is one standpoint: a place closed by the whole reading, or located by it, adds none of its own', async () => {
  const A = 'Any software can be integrated with any software.', B = 'Any software can be integrated with some software.';
  const yes = await F(A, B);
  const d = yes.distinctions.find((c) => c.a?.text === 'any');
  assert.equal(d.signal, 'NUL'); assert.equal(d.byHead, true); assert.match(d.decidedBy, /stub deliberate: read whole/);
  assert.deepEqual(yes.standpoints.map((s) => s.branch), ['significance/whole']);
  assert.match(yes.standpoints[0].why, /1 place where the texts part was read as part of this and not examined apart/);
  const r = readers({}, { says: 'no' });
  const no = await F(A, B, { readers: r });
  assert.equal(no.distinctions.find((c) => c.a?.text === 'any').signal, 'SIG');
  assert.deepEqual(no.standpoints.map((s) => s.branch), ['significance/whole']);
  assert.match(no.standpoints[0].why, /located by elimination at determiner «any» \/ «some»|located by elimination at wording «any» \/ «some»/);
  assert.equal(r.deliberate.asked.filter((q) => q.kind === 'says').length, 1, 'the same reader is not asked the same pair twice to make a second standpoint');
});

// ---- marks, figures and near spellings are places like any other -------------

test('a currency sign is a place the texts part, and it is not the same figure', async () => {
  const A = 'The fee is $500.', B = 'The fee is €500.';
  const none = await F(A, B, { readers: {} });
  assert.equal(strictlySame(none), false);
  assert.deepEqual(said(none, 'existence/figures'), ['inexpressible'], '$500 and €500 are not signed equal by the number parser');
  const v = await F(A, B, { readers: readers({}, { says: 'no', figure: 'no' }) });
  const d = v.distinctions.find((c) => c.kind === 'marks');
  assert.equal(d.signal, 'SIG'); assert.equal(d.a.text, '$'); assert.equal(d.b.text, '€'); assert.equal(A.slice(d.a.start, d.a.end), '$');
  assert.ok(v.distinctions.some((c) => c.kind === 'figure' && c.marks === '$' && c.signal === 'SIG'));
  const minus = await F('The balance is -500.', 'The balance is 500.', { readers: {} });
  assert.deepEqual(said(minus, 'existence/figures'), ['inexpressible'], 'a signed figure is not the bare figure');
  const q = await F('The council approved the contract.', 'The council approved the contract?', { readers: readers({}, { says: 'no' }) });
  assert.equal(q.distinctions.find((c) => c.kind === 'marks').signal, 'SIG');
});

test('two figures that parse to different values: decided by the parsers, and nobody else is asked', async () => {
  const v = await F('The city paid 500 dollars for the cameras.', 'The city paid 700 dollars for the cameras.');
  const d = v.distinctions.find((c) => c.kind === 'figure');
  assert.equal(d.signal, 'SIG'); assert.match(d.decidedBy, /number parsers of the readers .*different values/);
  assert.equal(d.a.text, '500'); assert.equal(d.b.text, '700');
  assert.equal(v.standing, 'nasti'); assert.equal(v.draws.length, 0);
  assert.match(row(v, 'significance/whole').why, /could not change/);
});

test('one value written two ways is a distinction without a difference; "same" still needs the whole reading', async () => {
  const v = await F('The city bought 1,200 cameras.', 'The city bought 1200 cameras.');
  const d = v.distinctions.find((c) => c.kind === 'figure');
  assert.equal(d.signal, 'NUL'); assert.match(d.decidedBy, /the same value written two ways/); assert.equal(v.standing, 'asti');
  const alone = await F('The city bought 1,200 cameras.', 'The city bought 1200 cameras.', { readers: {} });
  assert.equal(alone.standing, 'asti+avaktavya');
});

test('a figure with no equal is asked about as a figure even when the pair aligns and the whole reading said yes', async () => {
  const r = readers({}, { says: 'yes', figure: 'no' }); // the strict ground has its deliberate reader answer the figure question
  const v = await F('The deal was secret for 17 years.', 'The deal was secret for longer than a decade.', { readers: r });
  assert.equal(v.nominations.alignment.readPlaceByPlace, true);
  const d = v.distinctions.find((c) => c.kind === 'figure');
  assert.equal(d.signal, 'SIG'); assert.equal(d.layer, 'existence'); assert.equal(d.a.text, '17');
  const asked = r.deliberate.asked.find((q) => q.kind === 'figure');
  assert.equal(asked.figure, '17'); assert.match(asked.part, /for 17 years/);
  assert.equal(v.standing, 'asti+nasti'); assert.equal(v.verdict4.value, 'both'); assert.equal(strictlySame(v), false);
});

test('a figure nobody valued, set against another, is asked as a figure and not closed by a whole-text yes', async () => {
  const r = readers({}, { says: 'yes', figure: 'no' });
  const v = await F('The fund raised 5M.', 'The fund raised 5B.', { readers: r });
  assert.ok(r.deliberate.asked.some((q) => q.kind === 'figure' && q.figure === '5M'));
  assert.ok(r.deliberate.asked.some((q) => q.kind === 'figure' && q.figure === '5B'));
  assert.equal(strictlySame(v), false); assert.deepEqual(said(v, 'existence/figures'), ['is-not']);
  const place = v.distinctions.find((c) => c.a?.text === '5M' && c.b?.text === '5B');
  assert.equal(place.signal, 'SIG'); assert.equal(place.sameEvidence, true, 'the place takes its figures\' answers and is not counted twice');
  const asked = withBody(STRICT, 'identity', (b) => ({ ...b, figures: 'asked' }));
  const r2 = readers({}, { says: 'yes', figure: 'no' });
  const w = await F('The city paid 500 dollars.', 'The city paid 700 dollars.', { ground: asked, readers: r2 });
  assert.equal(r2.deliberate.asked.filter((q) => q.kind === 'figure').length, 2, 'under figures: asked, the parsers decide nothing and a reader is asked');
  assert.equal(strictlySame(w), false);
});

test('a near spelling is a place like any other: asked in text order, never batched, never closed unasked', async () => {
  const A = 'The contract says crime increased.', B = 'The contnact says crime decreased.';
  const differ = ({ passage, sentence }) => (/increased/.test(passage) !== /increased/.test(sentence) ? 'no' : 'yes');
  const v = await F(A, B, { readers: readers({}, { says: differ }) });
  const slip = v.distinctions.find((c) => c.a?.text === 'contract'), real = v.distinctions.find((c) => c.a?.text === 'increased');
  assert.equal(slip.signal, 'NUL'); assert.equal(real.signal, 'SIG');
  assert.equal(slip.near, undefined, 'no label by edit distance exists to order or batch the asking');
  const tight = withBody(STRICT, 'sufficiency', (b) => ({ ...b, budget: { ...b.budget, hunks: 1 } }));
  const w = await F('The council and the mayor called it legal.', 'The board and the chief called it illegal.', { ground: tight, readers: readers({}, { says: 'no' }) });
  assert.equal(w.distinctions.find((c) => c.a?.text === 'legal').open, 'beyond the ask budget', 'the budget cuts from the end of the text, whatever the spelling');
  assert.equal(w.distinctions.find((c) => c.a?.text === 'council').signal, 'SIG');
});

// ---- the readers' tags decide only what they can know --------------------------

test('a dropped "not" with do-support is caught by the readers\' tags, whatever a fooled reader says', async () => {
  const A = 'Acmecorp did not deliver the cameras.', B = 'Acmecorp delivered the cameras.';
  const read = reader({
    [A]: parsed(A, ['Acmecorp/PROPN//4/nsubj', 'did/AUX//4/aux/do', 'not/PART/Polarity=Neg/4/advmod', 'deliver/VERB//0/root', 'the/DET//6/det', 'cameras/NOUN//4/obj', './PUNCT//4/punct']),
    [B]: parsed(B, ['Acmecorp/PROPN//2/nsubj', 'delivered/VERB//0/root/deliver', 'the/DET//4/det', 'cameras/NOUN//2/obj', './PUNCT//2/punct']),
  });
  const v = await F(A, B, { read, similarity: async () => ({ score: 0.99, by: 'nose: stub' }) });
  const d = v.distinctions.find((c) => c.kind === 'polarity');
  assert.equal(d.signal, 'SIG'); assert.equal(d.a.text, 'did not deliver'); assert.equal(d.b.text, 'delivered');
  assert.match(d.decidedBy, /tags of the readers .*only by a negation/);
  assert.equal(strictlySame(v), false); assert.equal(v.draws.length, 0);
  assert.equal(v.nominations.similarity.score, 0.99, 'a likeness of 0.99 is on the record and changed nothing');
  assert.equal(row(v, "structure/negation by the readers' tags").reached, true);
});

test('at the floor, with no parse, the tag checks do not run and the report says so', async () => {
  const v = await F('Acmecorp did not deliver the cameras.', 'Acmecorp did deliver the cameras.');
  assert.equal(v.standing, 'asti', 'a reader fooled into yes, and no tags to catch it');
  assert.match(row(v, "structure/negation by the readers' tags").why, /no parse for one or both texts/);
  assert.equal(row(v, "structure/negation by the readers' tags").reached, false);
  const es = (t) => ({ ...parsed(t, t === 'No vino nadie.' ? ['No/ADV/Polarity=Neg/2/advmod', 'vino/VERB//0/root/venir', 'nadie/PRON/PronType=Neg/2/nsubj', './PUNCT//2/punct'] : ['Vino/VERB//0/root/venir', 'nadie/PRON/PronType=Neg/1/nsubj', './PUNCT//1/punct']), language: 'es' });
  const w = await F(es('No vino nadie.'), es('Vino nadie.'));
  assert.equal(w.distinctions.some((c) => c.kind === 'polarity'), false, 'the ground lists the languages whose tags may decide a negation; Spanish is not one');
  assert.match(row(w, "structure/negation by the readers' tags").why, /does not let tags decide a negation for these languages \(es, es\)/);
});

test('negation is judged over the whole pair: "not … any" against "no", and a raised negation, go to a reader', async () => {
  const A = 'The council has not approved any plan.', B = 'The council has approved no plan.';
  const read = reader({
    [A]: parsed(A, ['The/DET//2/det', 'council/NOUN//5/nsubj', 'has/AUX//5/aux/have', 'not/PART/Polarity=Neg/5/advmod', 'approved/VERB//0/root/approve', 'any/DET//7/det', 'plan/NOUN//5/obj', './PUNCT//5/punct']),
    [B]: parsed(B, ['The/DET//2/det', 'council/NOUN//4/nsubj', 'has/AUX//4/aux/have', 'approved/VERB//0/root/approve', 'no/DET/PronType=Neg/6/det', 'plan/NOUN//4/obj', './PUNCT//4/punct']),
  });
  const v = await F(A, B, { read });
  assert.equal(v.distinctions.some((c) => c.kind === 'polarity'), false);
  assert.equal(v.standing, 'asti', 'the whole reading carried both; nothing mechanical convicted a paraphrase');
  assert.equal(v.nominations.leads.length, 0, 'one negation each: no lead');

  const C = 'I do not think the vendor delivered the cameras.', D = 'I think the vendor did not deliver the cameras.';
  const read2 = reader({
    [C]: parsed(C, ['I/PRON//4/nsubj', 'do/AUX//4/aux', 'not/PART/Polarity=Neg/4/advmod', 'think/VERB//0/root', 'the/DET//6/det', 'vendor/NOUN//7/nsubj', 'delivered/VERB//4/ccomp/deliver', 'the/DET//9/det', 'cameras/NOUN//7/obj', './PUNCT//4/punct']),
    [D]: parsed(D, ['I/PRON//2/nsubj', 'think/VERB//0/root', 'the/DET//4/det', 'vendor/NOUN//7/nsubj', 'did/AUX//7/aux/do', 'not/PART/Polarity=Neg/7/advmod', 'deliver/VERB//2/ccomp', 'the/DET//9/det', 'cameras/NOUN//7/obj', './PUNCT//2/punct']),
  });
  assert.equal((await F(C, D, { read: read2 })).distinctions.some((c) => c.kind === 'polarity'), false, 'one negation on each side: not decided by tags');
});

test('a reordering: where the ground allows, tags may convict and never clear; under the draft grounds every reordering goes to a reader', async () => {
  const A = 'Acmecorp paid Riverdale.', B = 'Riverdale paid Acmecorp.';
  const table = {
    [A]: parsed(A, ['Acmecorp/PROPN//2/nsubj', 'paid/VERB//0/root/pay', 'Riverdale/PROPN//2/obj', './PUNCT//2/punct']),
    [B]: parsed(B, ['Riverdale/PROPN//2/nsubj', 'paid/VERB//0/root/pay', 'Acmecorp/PROPN//2/obj', './PUNCT//2/punct']),
  };
  const v = await F(A, B, { read: reader(table), ground: TAGS_MAY_CONVICT_ORDER });
  const d = v.distinctions.find((c) => c.kind === 'order');
  assert.equal(d.signal, 'SIG'); assert.match(d.decidedBy, /tags of the readers .*another grammatical role/); assert.equal(v.draws.length, 0);
  const strict = await F(A, B, { read: reader(table), readers: readers({}, { says: 'no' }) });
  assert.match(strict.distinctions.find((c) => c.kind === 'order').decidedBy, /stub deliberate: read whole; the reordered text is not carried/);
  assert.match(row(strict, "structure/order by the readers' tags").why, /does not let tags decide a reordering/);

  const C = 'Acmecorp and Riverdale met.', D = 'Riverdale and Acmecorp met.';
  const read2 = reader({
    [C]: parsed(C, ['Acmecorp/PROPN//4/nsubj', 'and/CCONJ//3/cc', 'Riverdale/PROPN//1/conj', 'met/VERB//0/root/meet', './PUNCT//4/punct']),
    [D]: parsed(D, ['Riverdale/PROPN//4/nsubj', 'and/CCONJ//3/cc', 'Acmecorp/PROPN//1/conj', 'met/VERB//0/root/meet', './PUNCT//4/punct']),
  });
  const v2 = await F(C, D, { read: read2, ground: TAGS_MAY_CONVICT_ORDER });
  const o = v2.distinctions.find((c) => c.kind === 'order');
  assert.equal(o.signal, 'NUL'); assert.match(o.decidedBy, /stub deliberate: read whole/, 'no word changed its role: the tags do not clear it, a reader does');
  assert.match(o.why, /the tags alone cannot make a clearance/);
  assert.equal(v2.standing, 'asti');

  const E = 'The big dog chased the small dog.', G = 'The small dog chased the big dog.';
  const dogs = (first, second) => ['The/DET//3/det', `${first}/ADJ//3/amod`, 'dog/NOUN//4/nsubj', 'chased/VERB//0/root/chase', 'the/DET//7/det', `${second}/ADJ//7/amod`, 'dog/NOUN//4/obj', './PUNCT//4/punct'];
  const v3 = await F(E, G, { read: reader({ [E]: parsed(E, dogs('big', 'small')), [G]: parsed(G, dogs('small', 'big')) }), ground: TAGS_MAY_CONVICT_ORDER });
  assert.equal(v3.distinctions.find((c) => c.kind === 'order').signal, 'SIG', 'big moved from the subject dog to the object dog');

  // Every word is compared, not only the ones the alignment left unmatched: a negation that moved is seen from either side.
  const H = 'He did try not to win.', I = 'He did not try to win.';
  const tried = { [H]: parsed(H, ['He/PRON//3/nsubj', 'did/AUX//3/aux/do', 'try/VERB//0/root', 'not/PART/Polarity=Neg/6/advmod', 'to/PART//6/mark', 'win/VERB//3/xcomp', './PUNCT//3/punct']), [I]: parsed(I, ['He/PRON//4/nsubj', 'did/AUX//4/aux/do', 'not/PART/Polarity=Neg/4/advmod', 'try/VERB//0/root', 'to/PART//6/mark', 'win/VERB//4/xcomp', './PUNCT//4/punct']) };
  for (const [x, y] of [[H, I], [I, H]]) assert.equal((await F(x, y, { read: reader(tried), ground: TAGS_MAY_CONVICT_ORDER })).distinctions.find((c) => c.kind === 'order').signal, 'SIG');
});

// ---- the walk back: only as far as the question needs ---------------------------

test('when a whole text is not carried, the finder says where: part by part, addressed and typed', async () => {
  const A = 'Aircraft without pilots may be flown from afar.', B = 'The drones can be piloted remotely, and carry dispatch systems.';
  const r = readers({ says: ({ part }) => (/dispatch/.test(part) ? 'no' : 'yes'), mentions: 'no', denies: 'no' }, { says: 'no' });
  const v = await F(A, B, { readers: r });
  assert.equal(v.nominations.alignment.readPlaceByPlace, false);
  const d = v.distinctions.find((c) => c.kind === 'part' && c.signal === 'SIG');
  assert.equal(d.layer, 'existence'); assert.match(d.b.text, /dispatch systems/);
  assert.equal(B.slice(d.b.start, d.b.end), d.b.text, 'the address points at the words');
  assert.match(d.decidedBy, /stub quick/); assert.match(d.typedBy, /never mentions it/);
  assert.equal(v.whole.a_says_b, 'no'); assert.match(v.whole.b_says_a, /not asked: the answer could not change/);
  const w = v.standpoints.find((s) => s.branch === 'significance/whole');
  assert.equal(w.negative.b, 'silent'); assert.match(w.negativeBy, /stub quick/, 'who told opposed from silent is on the record');
  assert.equal(v.standing, 'nasti');
});

test('a ground that says "always walk back" is obeyed even when the whole reading said yes', async () => {
  const A = 'Aircraft without pilots may be flown from afar.', B = 'The drones can be piloted remotely, and carry dispatch systems.';
  const r = readers({ says: ({ part }) => (part && /dispatch/.test(part) ? 'no' : 'yes') });
  const v = await F(A, B, { ground: CASUAL, readers: r });
  assert.equal(v.whole.a_says_b, 'yes'); assert.equal(v.whole.b_says_a, 'yes');
  assert.ok(v.distinctions.some((c) => c.kind === 'part' && c.signal === 'SIG' && /dispatch/.test(c.b.text)));
  assert.equal(v.standing, 'asti+nasti'); assert.equal(strictlySame(v), false);
  assert.equal(row(v, 'parts/a asked of b').why, 'no parse and no internal marks: the text cannot be cut mechanically', 'where the walk cannot run, the frontier says so');
});

test('likeness is recorded and never enters the standing, whichever way it points', async () => {
  const run = (a, b, score, rd) => F(a, b, { similarity: async () => ({ score, by: 'nose: stub' }), readers: rd });
  const hi = await run('The board met on Monday.', 'Trustees gathered at the start of the week.', 0.99, readers()), lo = await run('The board met on Monday.', 'Trustees gathered at the start of the week.', 0.01, readers());
  assert.equal(hi.standing, lo.standing); assert.equal(hi.nominations.similarity.score, 0.99);
  assert.match(row(hi, 'nominate/similarity').why, /never enters/);
  const flipped = await run('Acmecorp paid Riverdale.', 'Riverdale paid Acmecorp.', 0.999, readers({}, { says: 'no' }));
  assert.equal(strictlySame(flipped), false, 'a score of 0.999 on a swapped pair is not "same"');
  const apart = await run('The board met on Monday.', 'Trustees gathered at the start of the week.', 0.001, readers());
  assert.equal(apart.standing, 'asti', 'a score of 0.001 on a pair the reader carries is not "other"');
});

// ---- the question's shape sets the test ---------------------------------------

test('three shapes, three answers for one pair', async () => {
  const A = 'Invoice 4471 from Acmecorp is for 500 dollars.', B = 'Invoice 4471 from Acmecorp is for 700 dollars.';
  assert.equal((await F(A, B, { question: sameKind('an invoice', 'test') })).standing, 'asti');
  const telling = readers({ about: ({ sentence }) => (/bridge/.test(sentence) ? 'no' : 'yes') });
  assert.equal((await F(A, B, { question: sameThing('test'), controls: ['The bridge closed in May.'], readers: telling })).standing, 'asti');
  assert.equal((await F(A, B)).standing, 'nasti');
});

test('the identity question: each order is its own standpoint, a control stands beside them, and without a control "the same thing" cannot stand alone', async () => {
  const A = 'Invoice 4471 from Acmecorp is for 500 dollars.', B = 'Invoice 4471 from Acmecorp is for 700 dollars.';
  const yesToAll = await F(A, B, { question: sameThing('test'), controls: ['The bridge closed in May.'] });
  assert.deepEqual(said(yesToAll, 'identity/about'), ['is', 'is']); assert.deepEqual(said(yesToAll, 'identity/control'), ['inexpressible']);
  assert.equal(yesToAll.standing, 'asti+avaktavya', 'the direct answers are kept; the failed control stands beside them');
  const unarmed = await F(A, B, { question: sameThing('test') });
  assert.equal(unarmed.standing, 'asti+avaktavya'); assert.match(unarmed.standpoints.find((s) => s.branch === 'identity/control').why, /required by the ground and not reached: no control statement handed in/);
  const split = await F(A, B, { question: sameThing('test'), controls: ['The bridge closed in May.'], readers: readers({ about: ({ passage, sentence }) => (/bridge/.test(sentence) ? 'no' : passage === A ? 'yes' : 'no') }) });
  assert.equal(split.standing, 'asti+nasti', 'two orders that disagree are reported as both');
});

test('a one-way question asks one way; a word added to the carrying text is never pruned as surplus', async () => {
  const r = readers();
  const v = await F('The council approved the contract.', 'The council approved the contract on Monday.', { question: carries('b-carries-a', 'test'), readers: r });
  assert.equal(v.standing, 'asti'); assert.equal(v.pruned.length, 0);
  assert.equal(v.distinctions.find((c) => c.b?.text === 'on Monday').signal, 'NUL');
  assert.deepEqual(Object.keys(v.whole), ['b_says_a']);
  assert.ok(r.deliberate.asked.every((q) => /on Monday/.test(q.passage)));
  const never = await F('The council approved the contract.', 'The council never approved the contract.', { question: carries('b-carries-a', 'test'), readers: readers({}, { says: 'no' }) });
  assert.equal(never.pruned.length, 0); assert.equal(never.distinctions.find((c) => c.b?.text === 'never').signal, 'SIG'); assert.equal(strictlySame(never), false);
  const A = 'Acmecorp delivered the cameras.', B = 'Acmecorp did not deliver the cameras.';
  const read = reader({
    [A]: parsed(A, ['Acmecorp/PROPN//2/nsubj', 'delivered/VERB//0/root/deliver', 'the/DET//4/det', 'cameras/NOUN//2/obj', './PUNCT//2/punct']),
    [B]: parsed(B, ['Acmecorp/PROPN//4/nsubj', 'did/AUX//4/aux/do', 'not/PART/Polarity=Neg/4/advmod', 'deliver/VERB//0/root', 'the/DET//6/det', 'cameras/NOUN//4/obj', './PUNCT//4/punct']),
  });
  const tagged = await F(A, B, { read, question: carries('b-carries-a', 'test') });
  assert.equal(tagged.distinctions.find((c) => c.kind === 'polarity').signal, 'SIG'); assert.equal(strictlySame(tagged), false);
  const fig = await F('The city paid for the cameras.', 'The city paid 500 dollars for the cameras.', { question: carries('b-carries-a', 'test') });
  assert.equal(fig.pruned.length, 1); assert.match(fig.pruned[0].prunedBecause, /only the carrying text holds/);
});

test('a question may leave a layer out of its shape: a difference there is pruned, not tested', async () => {
  const q = { ...allInformation('test'), layers: ['structure', 'significance'] };
  const v = await F('The city paid 500 dollars for the cameras.', 'The city paid 700 dollars for the cameras.', { question: q });
  assert.equal(v.pruned.length, 1); assert.match(v.pruned[0].prunedBecause, /existence, which is outside the question's shape/);
  assert.equal(v.standing, 'asti');
});

// ---- two grounds, two answers ---------------------------------------------------

test('the same pair under two grounds: the difference between the answers is a finding', async () => {
  const r = readers({ says: 'yes' }, { says: 'no' });
  const u = await findUnder('Any software can be integrated with any software.', 'Any software can be integrated with some software.', [STRICT, CASUAL], { question: allInformation('test'), adoptedBy: 'test', read: surfaceReader, readers: r });
  assert.equal(u.differ, true);
  assert.equal(u.verdicts[0].standing, 'nasti'); assert.equal(u.verdicts[1].standing, 'asti');
  assert.match(u.finding, /strict: nasti; .*casual: asti/);
  assert.match(u.verdicts[0].distinctions.find((c) => c.a?.text === 'any').decidedBy, /stub deliberate/);
  assert.match(row(u.verdicts[1], 'structure/hunks').by, /alignment/);
});

test('the verdict comes back with its stop: frontier, ground, baseline, adopter', async () => {
  const v = await F('The board met on Monday.', 'Trustees gathered at the start of the week.', { adoptedBy: 'the auditor' });
  assert.equal(v.stop.kind, 'stop'); assert.equal(v.stop.adoptedBy, 'the auditor'); assert.equal(v.stop.revisable, true);
  assert.equal(v.stop.ground.events.length, 6); assert.match(v.stop.baseline.questions, /baseline@0/);
  assert.ok(v.stop.frontier.some((f) => f.branch === 'significance/whole' && f.reached));
  assert.ok(v.stop.frontier.some((f) => /pathos/.test(f.branch) && !f.reached && /not built/.test(f.why)));
  assert.ok(v.ground.events.every((e) => /Claude/.test(e.by)), 'every ground event carries its byline');
  const open = await F('The council and the mayor called it legal.', 'The board and the chief called it illegal.', { ground: withBody(STRICT, 'sufficiency', (b) => ({ ...b, budget: { ...b.budget, hunks: 1 } })), readers: readers({}, { says: 'no' }) });
  const f = open.stop.frontier.find((x) => x.branch === 'structure/hunks');
  assert.equal(f.reached, false); assert.equal(f.open, 2, 'a branch with places left open is not marked reached');
});

test('the words a reader is asked are the ground\'s words, end to end', async () => {
  const mine = withBody(STRICT, 'baseline', (b) => ({ ...b, questions: { ...b.questions, says: 'MY OWN WORDING?' } }));
  const r = readers();
  await F('The board met on Monday.', 'Trustees gathered at the start of the week.', { ground: mine, readers: r });
  assert.equal(r.deliberate.asked[0].questions.says, 'MY OWN WORDING?');
});

// ---- the pieces -------------------------------------------------------------------

test('standing: the join reaches all seven, reads as four values, and a standpoint names who decided', () => {
  const sp = (...xs) => xs.map((x) => standpoint('structure/test', x, 'test', ''));
  const seen = new Set([sp('is'), sp('is-not'), sp('inexpressible'), sp('is', 'is-not'), sp('is', 'inexpressible'), sp('is-not', 'inexpressible'), sp('is', 'is-not', 'inexpressible')].map(standingOf));
  assert.deepEqual([...seen].sort(), [...SEVEN].sort()); assert.equal(SEVEN.length, 7);
  assert.equal(standingOf([]), 'avaktavya');
  assert.deepEqual(verdict4(sp('is', 'is-not')), { value: 'both', unsaid: false });
  assert.deepEqual(verdict4([]), { value: 'neither', unsaid: true });
  assert.throws(() => standpoint('structure/test', 'maybe', 'test', ''));
  assert.throws(() => standpoint('structure/test', 'is', '', ''), /names who decided/);
});

test('align: marks are tokens; case and compatibility forms are followed unless the ground makes them accidental', () => {
  const a = 'Any software can be integrated with any software.', b = 'Any software can be integrated with some software.';
  const al = align(segment(a), segment(b), a, b, { accidental: { case: true, forms: true } });
  assert.equal(al.hunks.length, 1); assert.equal(al.hunks[0].a.text, 'any'); assert.equal(substitute(a, al.hunks[0]), b);
  assert.equal(align(segment('The Fee'), segment('the fee'), 'The Fee', 'the fee', { accidental: { case: false } }).hunks.length, 1);
  assert.equal(align(segment('The Fee'), segment('the fee'), 'The Fee', 'the fee', { accidental: { case: true } }).hunks.length, 0);
  assert.equal(align(segment('a ﬁne day'), segment('a fine day'), 'a ﬁne day', 'a fine day', { accidental: {} }).hunks.length, 1, 'a ligature is followed unless the ground says compatibility forms are accidental');
  assert.equal(align(segment('a ﬁne day'), segment('a fine day'), 'a ﬁne day', 'a fine day', { accidental: { forms: true } }).hunks.length, 0);
  assert.equal(align(segment('A paid B'), segment('B paid A'), 'A paid B', 'B paid A').reordered, true);
  const m = align(segment('It closed.'), segment('It closed?'), 'It closed.', 'It closed?');
  assert.equal(m.hunks.length, 1); assert.equal(m.hunks[0].b.text, '?');
});

test('hunters: too few shared tokens is not read place by place; names match by token and case; "every name is spelled" needs both readers', () => {
  const opts = { accidental: { case: true, forms: true }, minCoverage: 0.5, mechanical: { negation: ['en'], order: [] }, figures: 'equal-value' };
  const h = huntHunks(surfaceReading('The board met on Monday.', { language: 'en' }), surfaceReading('Trustees gathered early in the week.', { language: 'en' }), opts);
  assert.equal(h.ran, false); assert.match(h.gap, /too few tokens/);
  const named = (t, names) => ({ ...surfaceReading(t, { language: 'en' }), names, offersNames: true });
  assert.equal(huntNames(named('Ann signed the lease.', [{ text: 'Ann', start: 0, end: 3 }]), named('The annual lease was signed by the tenant.', [])).candidates.length, 1, '"Ann" is not in "annual"');
  assert.equal(huntNames(named('Will signed the lease.', [{ text: 'Will', start: 0, end: 4 }]), named('The tenant will sign the lease.', [])).candidates.length, 1, '"Will" is not "will"');
  const oneSided = huntNames(named('Ann signed.', [{ text: 'Ann', start: 0, end: 3 }]), surfaceReading('Ann signed.', { language: 'de' }));
  assert.equal(oneSided.bothOffer, false); assert.match(oneSided.gap, /not offered by the reader of b/);
  const f = huntFigures(surfaceReading('raised 5M', { language: 'en' }), surfaceReading('raised 5B', { language: 'en' }), { figures: 'equal-value' });
  assert.equal(f.candidates.length, 2); assert.equal(f.candidates[0].kind, 'figure-unread');
});

test('the name standpoint is not signed when only one reader offered names', async () => {
  const A = 'Acmecorp signed the lease.';
  const en = { ...parsed(A, ['Acmecorp/PROPN//2/nsubj', 'signed/VERB//0/root/sign', 'the/DET//4/det', 'lease/NOUN//2/obj', './PUNCT//2/punct']), names: [{ text: 'Acmecorp', start: 0, end: 8 }] };
  const v = await F(en, surfaceReading('Acmecorp hat den Mietvertrag unterschrieben.', { language: 'de' }));
  assert.deepEqual(said(v, 'existence/names'), []); assert.equal(row(v, 'existence/names').reached, false);
  assert.match(row(v, 'existence/names').why, /not offered by the reader of b/);
});

test('the figure parser refuses what it cannot read one way', () => {
  assert.equal(figureValue('1,200', 'en'), 1200); assert.equal(figureValue('1,200', 'en-US'), 1200); assert.equal(figureValue('1.200', 'de'), 1200); assert.equal(figureValue('35,5', 'de'), 35.5);
  assert.equal(figureValue('1,200'), null, 'no locale giver: a separator is refused');
  assert.equal(figureValue('1.200', 'es'), null, 'Spanish regions disagree about the separator: refused');
  assert.equal(figureValue('1.200', 'de-CH'), null); assert.equal(figureValue('1,200', 'es-MX'), null);
  assert.equal(figureValue('5M', 'en'), null); assert.equal(figureValue('1990s', 'en'), null); assert.equal(figureValue('.5', 'en'), null);
  assert.equal(figureValue('12345678901234567', 'en'), null, 'more digits than a number can hold exactly: not valued');
  const R = surfaceReading('It rose from 10 000 to -5%.', { language: 'en' });
  assert.deepEqual(R.amounts.map((x) => [x.text, x.value, x.marks ?? '']), [['10 000', null, ''], ['5', 5, '-%']]);
});

test('units: the reader\'s cut keeps a negation and its auxiliaries with the verb; a one-word run between marks is a part', () => {
  const A = 'Acmecorp did not deliver the cameras to Riverdale.';
  const u = unitsOf(parsed(A, ['Acmecorp/PROPN//4/nsubj', 'did/AUX//4/aux/do', 'not/PART/Polarity=Neg/4/advmod', 'deliver/VERB//0/root', 'the/DET//6/det', 'cameras/NOUN//4/obj', 'to/ADP//8/case', 'Riverdale/PROPN//4/obl', './PUNCT//4/punct']));
  assert.deepEqual(u.units.map((x) => x.text), ['Acmecorp', 'did not deliver', 'the cameras', 'to Riverdale']);
  const B = 'Nobody delivered the cameras.';
  const w = unitsOf(parsed(B, ['Nobody/PRON/PronType=Neg/2/nsubj', 'delivered/VERB//0/root/deliver', 'the/DET//4/det', 'cameras/NOUN//2/obj', './PUNCT//2/punct']));
  assert.ok(w.units.some((x) => x.text === 'Nobody delivered'), 'the negative subject goes out with the verb it denies');
  const C = 'While the docks are placed in fixed spots, the drones fly.';
  const c = unitsOf(parsed(C, ['While/SCONJ//5/mark', 'the/DET//3/det', 'docks/NOUN//5/nsubj', 'are/AUX//5/aux/be', 'placed/VERB//12/advcl/place', 'in/ADP//8/case', 'fixed/ADJ//8/amod', 'spots/NOUN//5/obl', ',/PUNCT//12/punct', 'the/DET//11/det', 'drones/NOUN//12/nsubj', 'fly/VERB//0/root', './PUNCT//12/punct']));
  assert.ok(c.units.some((x) => x.text === 'are placed'), 'the clause linker does not stretch the predicate across its subject');
  assert.deepEqual(unitsOf(surfaceReading('The plan was approved, allegedly, by the council.')).units.map((x) => x.text), ['The plan was approved', 'allegedly', 'by the council']);
  assert.match(unitsOf(surfaceReading('Nothing happened')).gap, /cannot be cut/);
});

// ---- pinned after the third review -----------------------------------------------

test('a number parser does not convict across a change of unit, and does not clear an identifier', async () => {
  const r = readers();
  const v = await F('The outage lasted 7 full days.', 'The outage lasted 1 full week.', { readers: r });
  assert.ok(v.draws.length > 0, 'the texts part in two places: the figures are asked about, not convicted by their values');
  assert.equal(v.distinctions.find((c) => c.a?.text === '7' && c.b?.text === '1').decidedBy.includes('number parsers'), false);
  assert.equal(r.deliberate.asked.filter((q) => q.kind === 'figure').length, 2);
  const id = readers({}, { says: 'yes', figure: 'no' });
  const w = await F('Send it to account 007.', 'Send it to account 7.', { readers: id });
  assert.equal(strictlySame(w), false); assert.ok(id.deliberate.asked.some((q) => q.kind === 'figure' && q.figure === '007'), 'a leading zero is not valued away');
});

test('a figure is asked about with the sign or unit written against it', async () => {
  const r = readers();
  await F('It rose 5%.', 'It rose 5.', { readers: r });
  const q = r.deliberate.asked.find((x) => x.kind === 'figure' && x.passage === 'It rose 5.');
  assert.equal(q.figure, '5%'); assert.match(q.part, /5%/);
});

test('a name with no equal is asked about even where the texts align and the whole reading said yes', async () => {
  const named = (t, name) => ({ ...surfaceReading(t, { language: 'en' }), names: [{ text: name, start: 0, end: name.length }], offersNames: true });
  const r = readers({ says: ({ part }) => (part ? 'no' : 'yes') }, { says: 'yes' });
  const v = await F(named('Acmecorp signed the lease.', 'Acmecorp'), named('Riverdale signed the lease.', 'Riverdale'), { readers: r });
  assert.equal(r.quick.asked.filter((q) => q.part === 'Acmecorp' || q.part === 'Riverdale').length, 2);
  assert.deepEqual(said(v, 'existence/names'), ['is-not']); assert.equal(strictlySame(v), false);
  const silent = await F(named('Acmecorp signed the lease.', 'Acmecorp'), { ...surfaceReading('Acmecorp signed the lease in Oakdale.', { language: 'en' }), names: [], offersNames: true });
  assert.deepEqual(said(silent, 'existence/names'), [], 'a reader that named nothing in a text that spells the other\'s name has not examined names');
  assert.match(row(silent, 'existence/names').why, /gave no names/);
});

test('with the whole reading left out of the question, a one-place pair is still asked about at that place', async () => {
  const r = readers({}, { says: 'no' });
  const q = { ...allInformation('test'), layers: ['existence', 'structure'] };
  const v = await F('Any software can be integrated with any software.', 'Any software can be integrated with some software.', { question: q, readers: r });
  const d = v.distinctions.find((c) => c.a?.text === 'any');
  assert.equal(d.signal, 'SIG'); assert.equal(d.byHead, undefined); assert.match(d.decidedBy, /stub deliberate/);
  assert.equal(r.deliberate.asked.length, 1);
});

test('the part cutter keeps a phrase headed by a currency sign, and a predicate split by another part', () => {
  const A = 'The city paid $500 in fines.';
  const u = unitsOf(parsed(A, ['The/DET//2/det', 'city/NOUN//3/nsubj', 'paid/VERB//0/root/pay', '$/SYM//3/obj', '500/NUM//4/nummod', 'in/ADP//7/case', 'fines/NOUN//4/nmod', './PUNCT//3/punct']));
  assert.ok(u.units.some((x) => /500 in fines/.test(x.text)));
  const B = 'The council may in the coming week approve the plan.';
  const w = unitsOf(parsed(B, ['The/DET//2/det', 'council/NOUN//8/nsubj', 'may/AUX//8/aux', 'in/ADP//7/case', 'the/DET//7/det', 'coming/ADJ//7/amod', 'week/NOUN//8/obl', 'approve/VERB//0/root', 'the/DET//10/det', 'plan/NOUN//8/obj', './PUNCT//8/punct']));
  assert.ok(w.units.some((x) => x.text === 'may … approve'), 'the auxiliary goes out with its verb, the gap marked');
});

test('a ground cannot smuggle in a key by a name every object has', () => {
  const sly = withBody(STRICT, 'absence', (b) => ({ ...b, constructor: 'counts-as-no' }));
  assert.ok(readGround(sly).refused.some((r) => /absence\.constructor: not a decision this kernel reads/.test(r)));
});

// ---- the reader of questions (a giver; khora's side of the line) ----------------------
