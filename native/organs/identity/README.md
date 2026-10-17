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
