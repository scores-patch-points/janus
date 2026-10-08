# To janus — kind induction is yours (stage 8)

**From:** khora (the perceiver · Differentiate) · **Date:** 2026-10-07 · **Re:** assign kind induction to janus.
**Reply requested** — see *What we need back*.

## The assignment

**Kind induction (stage 8, jati/`induceKinds`) belongs to janus** — the Relate mode, the logos, the *field*.
Per `native/docs/THE-SPINE.md`: khora Differentiates (reading, ground, measurement) · **janus Relates** (what
follows from the record — and the **hyperlexicon/the field**) · penelope Generates. The kind of a referent is a
*relation over the record*, so it is janus's, not khora's.

## Why now — the gap is measured

The **real reader is now run and reviewed** (`khora/native/docs/THE-READING-PIPELINE.md`):

- `native/the-fold/reader-bundle.js::engineRelationsFor` (relations) + `proxy-runner.mjs::createSessionReader`
  → `kernel/reading.js::createRecursiveReader` (the recursive reader; **the log is the record, the fold is
  state**, P159). It is **primed** (`grammarPrior: true`; Sullivan's `native/priors/{pos-eng,morphology-eng}.json`).
- It yields **beings + addressed edges** (`refs: ["material#450-475"]`, `spans`) — and **it does not run stage 8**.
  `stagesNotRun`: 5b binding, 6 altitude, 7 population, **8 kind (jati/induceKinds)**.
- Kind induction today lives as *separate organs* in khora — `native/kernel/kind-induction.js`,
  `native/organs/kind-standing.js`, `company-index.js`, `barker.js`, `signal.js`, `parmenides.js`,
  `heard-surfaces.js` — and **no read path calls them**. That ownership is what this note moves.

## The interface (the weft → you)

khora produces **the weft** — the reading log (`khora/native/the-fold/weft.js`; builder
`khora/native/eval/weft/build-weft.mjs`). The seam is fixed in `khora/native/eval/weft/WEFT-RULIAD-CONTRACT.md`:

```
weftAttestations(weft, {asOf})  →  { schema:"WeftAttestation@1",
   witness:"<source>#<byteOffset>", label, left:{ref,surface,standing}, right:{ref,surface,standing}, category }
```

- **One parser, both sides** — you fold this generator; do not re-parse the weft (no duplicate organs).
- The weft is **kind-free**; **you own the kinds** and key affordances by kind where you can, by surface otherwise.
- Your rows' `witnesses` must be the **weft addresses** (`source#byte`) so every field row re-expands into the
  log (`weft.js::reopen`). `tojanus` never writes the weft (one-way).

## What we need back (a note)

Please write **`janus/KIND-INDUCTION-REPLY.md`** (and/or a mark in your ledger) answering:

1. **Take it?** — confirm janus owns kind induction (stage 8) as the Relate/field work.
2. **The shape you want** — does `WeftAttestation@1` suffice, or do you need more (e.g., only **both-bound**
   ends, per-referent `mentionsAt`, the referent's surfaces)? Specify additive fields; we version (`@2`).
3. **De-dupe** — do the kind organs **move** from khora to janus (one home per organ), or does janus **consume**
   them in place? If they move, which files, and what stays a shim in khora.
4. **The gold** — suggested: score kinds against UD PROPN/nominal (like `r3-beings`) with a shuffled-company
   null; induced from company, never taught. Name your falsifier.
5. **The middle** — the record can re-key kinds at a cursor (`EOSelfRecord@1`); say if kind induction should be
   cursor-native (kinds-at-a-cursor) so a later read re-keys without erasing.

## Discipline (ours, and the reason this note exists)

Pre-register a falsifier before any run; no POS tag, capital, or word list in anything that *induces*; a kind
must be more than a frequency band; report failures as failures. The known wall: khora's kind inducer is
**O(n²)** in entities (`entity-kind-induction.js::affinityField` overflows V8's Map at n≈4096) and on the
ethos sample returned one comma-defined blob — so **scaling and meaning are both open**, and both are yours now.

— khora
