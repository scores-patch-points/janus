# identity

Identity by consequence: the **Same** formula, a **referent store**, and a
**discrepancy finder**. Reconstructed from the "What identity is" spec, then run
against the Motorola resolution's primary document.

Zero dependencies. Pure ESM. `node --test` + `node:assert`.

## The formula

```
Same(a,b | W) ⟺ U(a) ≈ U(b) ∧ Δ(a),Δ(b) > null ∧ cos(λ(a),λ(b)) > null
```

- **U(x)** — the world folded around x, cut off at the first hop where widening
  stops changing the fold by more than chance (`src/same.mjs::worldFold`).
- **Δ(x)** — how far x's neighbours move when x is replaced by the average of
  its kind (`displacement`). An alias disturbs nothing; only Δ > null is a
  concept.
- **λ(x)** — x's difference from the kind average (`signature`); `cos` measures
  whether two things deviate from their kind in the same way.
- **W** — the purpose — is a *lens* (which features count, a tolerance, the
  frame). No lens ⇒ **refused**, never false.

## Components

| file | what |
|------|------|
| `src/same.mjs` | the identity formula (U, Δ, λ, null, `same`) |
| `src/referents.mjs` | ids, edges (`holder`/`lens`/`degree`), folds; transitive vs threshold lenses; conceptual referents; fission report |
| `src/finder.mjs` | the discrepancy finder — declared identity keys, named lifts (sum/count), refusal |
| `src/parsers.mjs` | number/date parsers that refuse rather than guess |
| `run/motorola.mjs` | thin structural reader + finder over the Motorola document |

## Run

```sh
npm test               # 19 tests
node run/motorola.mjs  # the finder over the Motorola primary document
```

## The four attack findings, pinned by tests

1. **Shared structure is not sameness** — two invoices from one template are not
   a contradiction; identity keys must be declared (`test/finder.test.mjs`).
2. **Statements sit at different terrains** — a named lift brings parts up to a
   total and cites them (`checkLift`).
3. **A lens may not be an identity relation** — a threshold ("mostly the same")
   lens is never collapsed; the Ship-of-Theseus fission is reported with givers,
   not ranked (`test/referents.test.mjs`).
4. **Parsers guessed** — Thai Buddhist year and German `21.05` are now refused
   unless a giver declares the interpretation (`test/parsers.test.mjs`).

## What the Motorola run found

The Sourcewell master agreement / RFP 030425 (Motorola Solutions) contains a real
internal date discrepancy:

> Addendum No. 1 and No. 2 carry header dates **1/17/2024** against
> acknowledgement dates **1/17/25** — a 2025 solicitation.

The finder refuses to convict on the bare 2-digit `25` (no century giver), then
convicts **2024 ≠ 2025** once a century giver is declared. Two consistency
checks — the "Twelve (12) contracts" count and the "0–10% discount" range — come
back **bound**.

See `STATUS.md` for what remains.

## The two nulls, and the discreteness of the ground (2026-10-22)

The formula has **two different nulls**, and conflating them is a bug:

- **U's null** (`estimateNull`): the median one-hop fold change. It decides when the
  world fold `U(x)` stops widening. Right for the fold.
- **Δ's null** (`displacementNull`): the `quantile`-th displacement over the ground's own
  beings. It decides whether a being is a **figure** (Δ > null) or an alias. It must be
  drawn from the **displacement distribution**, never from the fold changes.

Before this, `same()` defaulted Δ's null to the fold null. On a dense real ground the fold
null (~0.7) exceeds every displacement, so `distinct` is never satisfied and `Same`
degenerates to "everything different" — even a duplicate. `same()` now defaults Δ's null to
`displacementNull`, and returns a `ground: { spread, discrete }` field.

**The discreteness of the ground.** `groundSpread` measures how much the ground's
displacements vary. Near 0 means a **continuous** ground — every being a uniform
perturbation of every other — and a continuous ground has **no discrete figures**, so no
identities in it. This is the finding the hyperlexicon test returned: over a company space,
Δ was flat (~0.024) under band, cell, and random kinds alike. **Identity is figure against a
structured ground; the ground must have discrete kinds.**

**The definition wired here.** *Identity is the difference a being makes to a ground that
exceeds the ground's own variation* — measurable as Δ above `displacementNull`, at the depth
where the connected universe stops changing (`worldFold`/DMD), with sameness settled by
consequence (`U`, `λ`), under a stated lens, and refused without one.

**The profile is cached.** `displacementProfile` costs one displacement per being, so it is
computed once per (world, features that count, `foldNull`, `quantile`) and reused by every
`same()` call on that world. A world is treated as fixed once compared: adding nodes or links
is noticed; editing a node's attrs in place is not — call `forgetGround(world)` after that.

## Correspondence from relations alone (`correspond.mjs`, 2026-10-25)

Which node of one relational graph corresponds to which node of another, with no given alignment, coordinates or dictionary: a graph per text (nodes are lemmas, edges head to dependent labelled by the universal relation), similarity propagation over the labelled edges, a null that shuffles dependents within each label, strict mutual best above the search-aware ceiling, and a stop at the step where the admitted set repeats (DMD). It returns pairs and the control's own admission rate; it does not judge a pair.

Measured (`CONCEPTS-FROM-PARALLEL-STRUCTURE.md`, `identity-udhr-emergence/RESULTS-ABLATION-1.md`): on a planted identical dependency graph recall is 0.44 at precision 1.00 with labels and 0.004 with the labels collapsed; on a random irregular synthetic graph collapsing the labels costs less (60 to 46 correct of 60). The labels are necessary where many nodes are structurally interchangeable, as they are in dependency graphs (determiners, prepositions). On five real editions the control admits 23% as many pairs as the real run. This is a port of the frozen experiment code (the EOT log hashes the original); tests are in `correspond.test.mjs`.

`matchPairDMD` is the canonical stop for the correspondence (khora's `dmdWindow`: the shallowest step whose admitted set equals the set at the propagation's fixed point, by exact equality; a typed gap `reach_exceeds_steps` when the fixed point is not reached). `matchPair` stops at the first step whose set repeats the previous one, which can be a transient plateau; it is kept because the frozen Run 4 used it. On the five real editions the canonical stop admits 73 pairs where the first-repeat stop admitted 93.

## The fold's depth, read as shells (`fold-depth.mjs`, 2026-10-25; not wired into `same()`)

`foldDepth(a, b, world, { lens })`: shell-by-shell closeness out to radius h as a discrete conclusion, the largest radius as the whole, the shallowest agreeing radius as the depth (khora's `dmdWindow` rule), and the typed gap `close_not_beyond_null` when a 'close' is not rarer than chance under re-paired links. Unlike the cumulative descriptor it is not vacuous in a connected world. Limits and the decision pending for `same()`: `STATUS.md`, "a conclusion for the fold that survives exhaustion".
