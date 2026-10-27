# janus/priors — the ONE home of every prior

Written 2026-10-08. The rules of reading are **Relate's** — janus keeps the nomos,
so every prior (the rules bytes turn into meaning by) lives HERE, not in khora.

## What is here

Everything that used to live in `khora/native/priors/` (303 files:
`pos-*.json`, `frame-*.json`, `role-config-*.json`, `morph-cues-*.json`,
`morphology-eng.json`, `lang/*.json`, `notation-*.json`, `code-*.json`,
`contractions-*.json`, `refusal-*.json`, `declension-*.json`, …) **plus** the
corpus-derived case priors from `Zenodotus/derived-priors/case-priors/*`
(`case-marking-grc.json`, `-grc-classical.json`, `-lat.json`, `-rus.json`, `-san.json`).

Since 2026-10-24 also `punctuation-<stem>.json` (eng, fra, deu, spa, por, ita, rus) and
`punctuation-index.json`: each language's abbreviations, MEASURED from its corpora by what
a dotted token does (scripts/build-punctuation-priors.mjs, moved from the Holodeck), never a
typed list. khora's reader (native/the-fold/read-core.mjs) passes them to the sentence splitter
together with the text's own and the hyperlexicon's aliases.

Since 2026-10-27 also `conventions-eng.json` (`Conventions@1`): the conventions the reader reads a capital by (a capital marks a name; a capital opens a
sentence; a sentence end is marked; a treebank attests a form's use). A capital is a CONVENTION, kept more or less by a text, so each is a rule of its own
in the nomos: `native/organs/nomos.js` folds the prior into one `NomosRule@1` per convention, with its standing from ITS OWN giver or builder (three are
extracted, one is given by UD_English-EWT). The statements are authored; every figure is measured by `scripts/build-conventions-prior.mjs` from
UD_English-GUM's training file (sha256 pinned in the prior) and from `pos-eng.json`'s provenance. khora reads the file as data
(`native/adapters/text/conventions.js`); its cast never reads the figures, which describe the convention and cannot leak the ground the cast is scored on.

## The contract

- **One home.** A prior has exactly one copy, here. No mirror in khora.
- **khora reads it as DATA, never a module import.** `reader-bundle.js::loadPriors`
  resolves `<root>/janus/priors` by path; janus imports khora's kernel (one-way), so
  a module cycle is impossible — data reads don't create one.
- **Data-gated.** An absent file leaves the reader bare (exact-match only),
  byte-identical to the reader with no prior — a missing prior is a typed gap, never
  a guessed number.
- **Every prior names its giver** (nomos folds it: standing given|candidate|ungrounded,
  and `licenseNomos` refuses a REVEALED rule).
- **Consumers migrate**: anything that read `khora/native/priors/` now points at this
  directory. `reader-bundle.js::loadPriors` is re-pointed (verified: `grammarPrior`
  true). The remaining consumers are the `native/priors` readers in khora's evals and
  organs — each must re-point or it reads a stale copy (drift = a rule with no home).

## Falsifying controls

- a prior that names no giver and no builder (`licenseNomos` must refuse it);
- a prior read from anywhere other than this directory (a copy in khora is drift);
- a `loadPriors` that silently falls back to a local copy instead of a typed bare read.