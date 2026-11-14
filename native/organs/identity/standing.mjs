// standing.mjs — the verdict is a standing, not a boolean. Pure.
//
// Each search that examined something leaves a standpoint: in this respect the
// two texts are the same (asti), are not (nasti), or it cannot be said
// (avaktavya). The standing is the join of the predications present, one of
// the seven of the saptabhangi (khora native/the-fold/standing-cube.js
// JAIN_SEED). The standpoints stay attached: a standing never outlives who
// said what.
//
// An unresolved disagreement is never settled here. "The same in this respect,
// different in that one" is reported as both. That default is part of the
// kernel; a rule that picks a winner would be a ground decision, asserted and
// bylined like any other.

export const PREDICATIONS = Object.freeze(['asti', 'nasti', 'avaktavya']);
// The seven: every non-empty set of the three, in order.
export const SEVEN = Object.freeze([1, 2, 4, 3, 5, 6, 7].map((mask) => PREDICATIONS.filter((_, i) => mask & (1 << i)).join('+')));
const WORD = Object.freeze({ is: 'asti', 'is-not': 'nasti', inexpressible: 'avaktavya' });

// `branch` names the search ("existence/figures", "significance/whole");
// `layer` is its first segment. `by` names whoever DECIDED, never who merely
// nominated.
export function standpoint(branch, says, by, why, extra = {}) {
  if (!(says in WORD)) throw new Error(`standpoint: unknown predication "${says}"`);
  if (!by) throw new Error(`standpoint ${branch}: a standpoint names who decided`);
  return { branch, layer: String(branch).split('/')[0], says, predication: WORD[says], by, why, ...extra };
}

// The join. No standpoint at all is itself a standing: nothing could be said.
export function standingOf(standpoints) {
  const present = new Set((standpoints ?? []).map((s) => s.predication));
  if (!present.size) return 'avaktavya';
  return PREDICATIONS.filter((p) => present.has(p)).join('+');
}

// The four-valued reading of the same standpoints (is, is-not, both, neither),
// with `unsaid` set when some respect could not be said. Nothing is lost
// between the two: the seven is the four plus that flag.
export function verdict4(standpoints) {
  const present = new Set((standpoints ?? []).map((s) => s.predication));
  const is = present.has('asti'), isNot = present.has('nasti');
  return { value: is && isNot ? 'both' : is ? 'is' : isNot ? 'is-not' : 'neither', unsaid: present.has('avaktavya') || !present.size };
}

export const IN_WORDS = Object.freeze({
  asti: 'no difference that makes a difference was found, in any respect searched',
  nasti: 'a difference that makes a difference was found, and nothing searched says the same',
  avaktavya: 'it could not be said either way',
  'asti+nasti': 'the same in some respects, different in others',
  'asti+avaktavya': 'the same as far as it could be said; some respects could not be said',
  'nasti+avaktavya': 'different in some respects; others could not be said',
  'asti+nasti+avaktavya': 'the same in some respects, different in others, and some could not be said',
});
