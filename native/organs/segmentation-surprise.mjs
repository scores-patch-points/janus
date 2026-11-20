// segmentation-surprise.mjs: HOW MUCH A SLICE MAKES WHAT WAS ENCOUNTERED LESS SURPRISING (the owner, 2026-11-20: priors and competency; how we know how to slice is how much a slice makes the text we met retroactively less surprising; this is self-emergent learning).
// Surprise is CODE LENGTH in bits under an ADAPTIVE word model whose prior is only what it has already seen (a Dirichlet-process unigram over word types, the standard model of unsupervised word segmentation): a token seen c times among N costs -log2(c / (N + alpha)); a NOVEL token costs -log2(alpha / (N + alpha)) plus the cost of spelling it, (|w| + 1) * log2(A) with A the number of distinct characters in the corpus (read from the data). No gold, no treebank, no regex, no word list, no model call.
//   codeLength(tokens, { alpha }) -> { bits, N, types, novel }              retroactive: the cost of the stream as it was encountered, each token priced by what came before it
//   prospective(trainTokens, heldTokens, { alpha }) -> { bits, N }           competency: the model is built on the training stream, then PRICES text it has never seen, with no further learning
//   gain(plain, sliced, opts) -> { bitsPlain, bitsSliced, gain, perToken }   gain > 0: the slice made the stream less surprising
// alpha is the Dirichlet-process concentration: an ARBITRARY CONSTANT of ours (1 by default), labelled, and swept by the callers. Pure.
const alphabet = (streams) => new Set(streams.flatMap((t) => t.flatMap((w) => [...w]))).size;
export function codeLength(tokens, { alpha = 1, A = null } = {}) {
  const a = A ?? Math.max(2, alphabet([tokens])), counts = new Map(); let bits = 0, N = 0, novel = 0;
  for (const w of tokens) { const c = counts.get(w); if (c) bits += -Math.log2(c / (N + alpha)); else { novel++; bits += -Math.log2(alpha / (N + alpha)) + ([...w].length + 1) * Math.log2(a); } counts.set(w, (c ?? 0) + 1); N++; }
  return { bits, N, types: counts.size, novel };
}
export function prospective(trainTokens, heldTokens, { alpha = 1 } = {}) {
  const a = Math.max(2, alphabet([trainTokens, heldTokens])), counts = new Map(); for (const w of trainTokens) counts.set(w, (counts.get(w) ?? 0) + 1); const N = trainTokens.length; let bits = 0;
  for (const w of heldTokens) { const c = counts.get(w); bits += c ? -Math.log2(c / (N + alpha)) : -Math.log2(alpha / (N + alpha)) + ([...w].length + 1) * Math.log2(a); }
  return { bits, N: heldTokens.length };
}
export function gain(plain, sliced, opts = {}) { const A = Math.max(2, alphabet([plain, sliced])), p = codeLength(plain, { ...opts, A }), s = codeLength(sliced, { ...opts, A }); return { bitsPlain: p.bits, bitsSliced: s.bits, gain: p.bits - s.bits, perToken: (p.bits - s.bits) / p.N, typesPlain: p.types, typesSliced: s.types }; }
