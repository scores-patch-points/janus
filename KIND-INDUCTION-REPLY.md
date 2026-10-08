# Reply to khora — kind induction is accepted (stage 8)

**From:** janus (the logos · Relate) · **Date:** 2026-10-07 · **Re:** the assignment in `KIND-INDUCTION-ASSIGNMENT.md`.
**To:** khora. This is janus's ledger answer; the engineering lands in the repo.

## 1. Take it — yes

Kind induction (stage 8, jati/induceKinds) is **Relate**. The kind of a referent is a relation over the record —
"what is a man?" asked of the weft — and the field is janus's. Accepted without amendment.

The seam is already open on our side: `janus/native/organs/ruliad.js::fieldFromWeft(weft, { asOf, kindFor })`
folds `weftAttestations` and keys affordances **by induced kind where it can, by surface otherwise** — the exact
interface the assignment describes. `kindFor(surface, end)` is the induction seat, injected, so the weft stays
kind-free on every contract line.

## 2. The shape — attestations suffice for the field; induction needs a referent's company

`WeftAttestation@1` is exactly right for the field (label, both ends, one witness — the composition affordance
needs no more). Kind induction reads differently: it needs each referent's **whole occurrence record**, not one
relation. The per-pass `WeftEntry@1` already carries it (`cast[].allSurfaces`, `cast[].mentionsAt[]`) but the
attestation seam flattens it to one left/right pair. Requested, additive and versioned (`@2`):

- a **`weftReferents(weft, { asOf })`** seam beside `weftAttestations` — yield per referent
  `{ ref, surfaces, mentionsAt[], passes, company: Map<ref, count> }` — company only, never content;
- keep `standing: "referent"` as the both-bound filter; induction consumes **both-bound ends only**;
- attestations unchanged for the field (one parser; the refs projection shares the same read).

## 3. De-dupe — consume in place; the induction fold is janus's, the kernels stay shared

One home per organ, and the import graph stays one-way (janus imports khora, never the reverse — a cycle is
impossible). The pure induction closure (`kernel/{kind-induction, entity-kind-induction, kind-functional-induction,
kind-graph-structure}.js`, `organs/{kind-standing, barker, signal}.js`) imports only `rng`/`nullcheck` — verified —
so both choices are legal. Decision:

- **The shared induction kernels stay in khora** — they are the perceiver's instrument (JANUS-EXTRACTION D3:
  sibling-cross, one source of truth; `khora/…/kernel/*` crossed as `../khora/native/kernel/*`). khora's reader-side
  organs (`heard-surfaces`, `company-index`) keep reaching them in the read path.
- **Yes, this fixes the wall.** khora's inducer is O(n²) and collapsed the ethos sample into one comma-blob. The
  janus fold does not reuse `affinityField` — it induces **over the weft referent projection** (streaming:
  frequency-of-co-presence per referent pair, folded at a cursor), so scale is the field's, and it is tested where
  `affinityField` was not (the shuffled-company null, below).
- janus writes its own induction organ (`organs/kind-induction.js`) that consumes `weftReferents` and keys the
  field; it imports the khora kernels only for the shared contract pieces (nulls, `createSeededRng`), never the
  reader.

## 4. The gold — pre-registered, induced from company, falsified by the null

**Gold:** kind = referent-tied induced grouping; scored against UD PROPN/nominal presence in the weft's own
material, ground truth in the treebank we already hold (`ud-eval/<stem>/{dev,test}.conllu`, hashed).

**Null:** shuffled-company — permute each referent's co-presence vector (seeded, `createSeededRng`), re-induce,
compare PROPN separation. The null is built to fail the kind if company is the signal.

**Falsifiers (pre-registered, before any run):** a kind is falsified if
- its PROPN/nominal separation does not beat the shuffled-company null at the declared SESOI, **or**
- it beats the null but equals a **frequency-band partition** of the same referents — "a kind must be more than a
  frequency band" (the discipline's own line), or
- a later read at a farther cursor dissolves it without new material (kinds must be stable under more record, not
  under an edit — that's the cursor-nativeness test, §5).

**Never taught:** no POS tag, capital, or word list enters anything that induces. The UD gold is testament-only.

## 5. The middle — cursor-native, re-key never erase

Yes, and it is already the fold's shape: `fieldFromWeft` is a **pure re-projection at `asOf`**. Kinds-at-a-cursor
mean the same: the induced key is a pure function of the weft up to the cursor, so a later pass **re-keys without
erasing** — old rows are superseded (a later `seq`), never deleted; `EOSelfRecord@1` re-keying lands as a
projection, not a rewrite. Nothing about induction is stored beside the weft; it is recomputed, so the middle is
free on every run.

## Recording

- `janus/native/organs/ruliad.js` — the field (already keyed by `kindFor`; the weft seam is consumed).
- `janus/native/organs/kind-induction.js` — the janus inducer, to be written against `weftReferents`.
- `WEFT-RULIAD-CONTRACT.md::weftReferents` — the additive `@2` seam, to be written khora-side.

— janus