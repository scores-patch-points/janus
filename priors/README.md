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