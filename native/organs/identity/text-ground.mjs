// text-ground.mjs — the ground the finder folds under. Pure.
//
// Two texts are the same or other only under a ground: what counts as the same
// thing, which differences are followed and which are accidental, what "later"
// means, what silence means, how much search is enough, and what difference is
// worth reporting. Every system that compares two things answers those six
// questions; most answer them without saying so. Here they are said.
//
// A ground is a series of ordinary events, each with a byline. It is not read
// off the texts it is used on: it is a received object with a named author.
// It applies only when a reader adopts it, and the adoption is named on every
// verdict. Nothing in this file supplies a default: a decision the ground does
// not make is a refusal, never a quiet choice made here.
//
// Some decisions admit one value here ("time: as-stated"). The kernel has one
// behaviour at those points. A ground must still say it, so that the choice is
// on the record under an author's name, and a ground that wants another answer
// is refused by name instead of being quietly given this one.
//
// The kernel is what is left outside the ground: the three layers and their
// order (existence before structure before significance), the mechanics of
// alignment and cutting, and the rule that an unresolved disagreement is
// reported as both. Anything else that sits in the kernel is a ground in
// disguise and belongs here instead.

export const KERNEL = 'text finder kernel@2';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const one = (...allowed) => (v) => (allowed.includes(v) ? null : `must be one of: ${allowed.join(', ')}`);
const bool = (v) => (typeof v === 'boolean' ? null : 'must be true or false');
const str = (v) => (typeof v === 'string' && v.trim() ? null : 'must be a non-empty string');
const int = (v) => (Number.isInteger(v) && v >= 0 ? null : 'must be a whole number, zero or more');
const share = (v) => (typeof v === 'number' && v >= 0 && v <= 1 ? null : 'must be a number from 0 to 1');
const strings = (v) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? null : 'must be a list of strings');
const readerOrNone = (v) => (v === null || (typeof v === 'string' && v.trim()) ? null : 'must name a reader, or be null');
// Branches a ground may require before "no difference" may stand alone. A name outside this set is refused: a
// requirement nothing can ever meet, or one nothing ever checks, is not a requirement.
// Only branches whose "reached" the kernel can check without a vacuous case are offered: the whole reading (asked and
// answered, or stopped because the answer could not change) and the identity control (asked and answered).
export const REQUIRABLE = Object.freeze(['significance/whole', 'identity/control']);
const branches = (v) => (Array.isArray(v) && v.every((x) => REQUIRABLE.includes(x)) ? null : `must be a list drawn from: ${REQUIRABLE.join(', ')}`);

// What this kernel can honour, decision by decision. A value outside these is
// refused by name: "the ground asks for X; this kernel does not implement it".
const CAN_HONOUR = {
  identity: {
    figures: one('equal-value', 'asked'), //             two figures are one figure when their readers value them equally (and they carry the same sign or unit mark); or every figure difference is asked
    names: one('same-spelling'), //                      a name is the same name when it is spelled the same
    unmatched: one('always-asked', 'asked-on-descent'), // a figure or a name with no equal: asked whatever the whole reading said, or only on the walk back
    sameThing: one('asked'), //                          whether two texts are about one particular thing is asked of a reader
  },
  dependency: {
    accidental: { case: bool, spacing: one(true), forms: one(true) }, // differences the walk does not follow: letter case, spacing, compatibility forms of a character
    mechanical: { negation: strings, order: strings }, //              the languages (as the readings name them) in which the readers' own tags may decide a pure negation edit, or convict a reordering
  },
  time: { regime: one('as-stated') }, // a stated time or tense is a statement like any other
  absence: {
    surplus: one('counts'), //   what one text states and the other does not is a difference (for the side the question asks about)
    noAnswer: one('gap'), //     a reader that gives no answer leaves a gap, never a yes or a no
    negatives: readerOrNone, //  which reader, if any, tells "opposed" from "silent" when a whole text is not carried
  },
  sufficiency: {
    required: branches, //                branches that must be reached before "no difference" may stand alone
    descend: one('when-head-says-no', 'always'),
    stopAtFirstNo: bool, //               once one direction is not carried, the other is not asked
    settledByMechanical: bool, //         once a mechanical difference survives, the whole texts are not asked
    align: { minCoverage: share }, //     below this the pair is not read place by place
    budget: { parts: int, candidates: int, hunks: int, typing: int },
    wholePartShare: share, //             a part this share of its text is the whole again and is not asked twice
  },
  baseline: {
    questions: { system: str, says: str, part: str, figure: str, mentions: str, denies: str, about: str, kind: str },
    tests: { whole: str, hunk: str, part: str, figure: str, thing: str, mentions: str, about: str, kind: str },
    window: { figure: int }, // words of context shown around a figure when it is asked about
  },
};

function check(spec, body, path, problems) {
  // A key the kernel does not know is refused: a decision nobody reads is not a decision.
  for (const k of Object.keys(isObj(body) ? body : {})) if (!Object.hasOwn(spec, k)) problems.push(`${path}.${k}: not a decision this kernel reads`);
  for (const [k, rule] of Object.entries(spec)) {
    const at = `${path}.${k}`, v = body?.[k];
    if (typeof rule === 'function') {
      if (v === undefined) problems.push(`${at}: not decided by the ground`);
      else { const bad = rule(v); if (bad) problems.push(`${at}: ${bad}; this kernel does not implement ${JSON.stringify(v)}`); }
    } else if (!isObj(v)) problems.push(`${at}: not decided by the ground`);
    else check(rule, v, at, problems);
  }
}

// Fold a ground's events into the six decisions. Later events may supersede
// earlier ones by id. Two live events that decide the same thing are a
// contest the kernel does not settle: the reader adopts one, or folds under
// each and reads the difference as a finding.
export function readGround(ground) {
  if (!isObj(ground) || !Array.isArray(ground.events)) return { ok: false, refused: ['no ground handed in: two texts are the same or other only under a declared ground'] };
  const problems = [];
  const superseded = new Set(ground.events.flatMap((e) => (e?.supersedes == null ? [] : [].concat(e.supersedes))));
  const live = {};
  for (const e of ground.events) {
    if (!isObj(e) || !e.id) { problems.push('a ground event without an id'); continue; }
    if (str(e.by)) { problems.push(`event ${e.id}: no byline (a ground event names its author)`); continue; }
    if (!(e.decides in CAN_HONOUR)) { problems.push(`event ${e.id}: decides "${e.decides}", which is not one of the six ground decisions`); continue; }
    if (superseded.has(e.id)) continue;
    (live[e.decides] ??= []).push(e);
  }
  const G = { name: ground.name ?? null, events: [], bylines: [] };
  for (const decision of Object.keys(CAN_HONOUR)) {
    const L = live[decision] ?? [];
    if (!L.length) { problems.push(`${decision}: no live ground event decides it`); continue; }
    if (L.length > 1) { problems.push(`${decision}: contested by ${L.map((e) => `${e.id} (${e.by})`).join(' and ')}; adopt one, or fold under each`); continue; }
    check(CAN_HONOUR[decision], L[0].body, decision, problems);
    G[decision] = L[0].body;
    G.events.push({ id: L[0].id, decides: decision, by: L[0].by, at: L[0].at ?? null });
    if (!G.bylines.includes(L[0].by)) G.bylines.push(L[0].by);
  }
  if (problems.length) return { ok: false, refused: problems };
  G.eventFor = (decision) => G.events.find((e) => e.decides === decision);
  G.signed = (decision) => { const e = G.eventFor(decision); return `ground ${G.name ?? '(unnamed)'}, ${decision} event ${e.id} by ${e.by}`; };
  return { ok: true, G };
}

// A question is a declared shape, named by whoever asks it:
//   { asks: 'plain words', by: 'who asks', of: 'information' | 'identity' | 'kind',
//     directions: 'both' | 'a-carries-b' | 'b-carries-a',   (of: information)
//     layers: ['existence', 'structure', 'significance'],    (of: information; which layers are in the answer)
//     kind: 'an invoice' }                                   (of: kind)
// "Both are invoices", "the same invoice" and "aligned in all information" are
// three shapes, and the same pair answers each differently.
const LAYERS = ['existence', 'structure', 'significance'];
export function readQuestion(q) {
  const problems = [];
  if (!isObj(q)) return { ok: false, refused: ['no question handed in: the same pair answers different questions differently'] };
  if (str(q.asks)) problems.push('question.asks: the question in plain words is missing');
  if (str(q.by)) problems.push('question.by: who asks is missing');
  if (one('information', 'identity', 'kind')(q.of)) problems.push('question.of: must be one of: information, identity, kind');
  const Q = { asks: q.asks, by: q.by, of: q.of, grain: q.grain ?? null };
  if (q.of === 'information') {
    const bad = one('both', 'a-carries-b', 'b-carries-a')(q.directions);
    if (bad) problems.push(`question.directions: ${bad}`);
    Q.directions = q.directions;
    const layers = q.layers ?? LAYERS;
    if (!Array.isArray(layers) || !layers.length || layers.some((l) => !LAYERS.includes(l))) problems.push(`question.layers: must be drawn from ${LAYERS.join(', ')}`);
    Q.layers = LAYERS.filter((l) => layers.includes(l)); // kept in the kernel's order: existence before structure before significance
  }
  if (q.of === 'kind') { if (str(q.kind)) problems.push('question.kind: no kind declared: a kind is named by the asker, never guessed'); Q.kind = String(q.kind ?? '').trim(); }
  return problems.length ? { ok: false, refused: problems } : { ok: true, Q };
}
