# STATUS — what is done vs. the spec's "not shown" list

The "What identity is" spec closed with four named gaps. Here is where each
stands after this build.

| gap in the spec | status |
|-----------------|--------|
| 1. nothing has run on the Motorola primary documents | **done (thin reader).** `run/motorola.mjs` extracts addendum dates, contract codes, and discount lines by structure, then runs the finder. It convicts Addenda 1–2 (`1/17/2024` header vs `1/17/25` ack) and confirms the count and discount range as bound. |
| 2. no real reader that turns a page into assertions | **partial.** The run script is a structural text extractor, not a page→assertions reader; it does no OCR/image input and no general assertion extraction. The perceiver's `/v1/perceive` (tesseract) exists in the khora repo but is not wired to this finder. |
| 3. the finder's premise check is a partial version of the identity formula | **formula built, finder not yet wired to it.** `src/same.mjs` is the full U/Δ/λ formula. The finder compares parsed slot values under declared keys/lifts; it does not yet call `same()` to make the slot-level "same/different" call a full world-fold. Wiring `same()` into `finder.compare` is the next step. |
| 4. the referent design exists only as toy code | **real module, no persistence.** `src/referents.mjs` is a real store (append-only edges, read-time groups, transitive vs threshold lenses, conceptual referents, fission report). It is not yet backed by a durable store or wired into the khora perceiver. |

## What is deliberately not claimed

- The four attack findings are pinned by tests; the numbers "61 tests / 12
  invoices / 6 languages" from the spec are **not** reproduced here — this build
  is a fresh implementation with 19 tests, not a port of the prior toy code.
- OCR-robustness (the `21.05 → 01.05` single-digit substitution that survived
  150–400 dpi) is **not** exercised; there is no OCR pass in this build.

## Next steps, in order

1. Wire `same()` into the finder's slot comparison (close gap 3).
2. Back the referent store with a durable log (khora's EODB events / Matrix /
   Drive), and admit real surfaces (close gap 4).
3. Replace the thin extractor with the perceiver's `/v1/perceive` so a page
   image becomes assertions (close gap 2).

## Finding: the default `estimateNull` stops the fold before some deep differences (2026-10-20)

`deep-difference.test.mjs` plants a difference d hops out (d = 2..5) in a seeded noisy branching world and asks whether
`worldFold` reaches it. With a fixed null (0.01 to 0.20) every difference is reached (100%) and irrelevant added branches
move nothing. With the default `estimateNull` (median one-hop change, ~0.39 here) only ~66% are reached (50 to 73% by depth)
and the stopping hop moves when irrelevant detail is added (roadmap item 4's falsifier). No identical pair was ever called
different, so the failure is only the missed direction. Cause: most nodes are leaves, so the median one-hop change is large
and the first hop never exceeds it. Not claimed: that 0.01 to 0.20 is a good setting (single attribute, one kind, synthetic
graphs), or that a bound which never stops would be caught (the test cannot see that). The last test pins the gap and flips
when the default null is fixed.

## Finding: a conclusion for the fold that survives exhaustion (2026-10-25; `fold-depth.mjs`, not wired into `same()`)

`same()`'s fold stops at `estimateNull` (not DMD) and its descriptor U is cumulative, so folded to a whole connected component any two beings in it are identical and "the conclusion compared with the whole" (dmdWindow) is trivially close. `foldDepth(a, b, world, { lens })` reads the fold as **shells** (the tokens at exactly h hops), takes "close shell by shell out to radius h" as the discrete conclusion, the conclusion at the largest radius as the whole, and returns the shallowest radius that agrees (dmdWindow's rule, cross-checked against khora's `dmdWindow` in the test). A 'close' conclusion owes a null (links re-paired at random, 499 draws, alpha 0.01) or it is the typed gap `close_not_beyond_null`.

Measured (`fold-depth.test.mjs`, 7 tests; identity suite 76 of 76):
- the deep-difference world (d in 2..5, f in {1/6, 3/6, 1}, 30 seeds): every planted difference is reached, at exactly its hop; identical pairs are never called different and are all supported by the null; irrelevant branches move neither the conclusion nor the depth (the default `estimateNull` detects about 66% and moves);
- a connected case (the two roots bridged by a hub): the cumulative descriptor is identical for all 360 planted-different pairs; the shell profiles still reach every one, at its hop;
- typed gaps: no lens, unknown being, two isolated look-alikes.

Limits, both measured and not fixed:
1. **A hub linked to every being** puts everything within two hops, so every shell profile is the same whatever the structure. All 20 planted-different pairs in hub worlds are called close and none is caught by the null (it keeps degrees but not "linked to everyone"). Pinned as KNOWN LIMIT; it flips when a hub-aware metric exists.
2. **Beings with little structure.** In the dense ground of `same.test.mjs` (invoices linked only to a vendor) the planted duplicates a and b are close but the null calls that close often (p 0.39): two degree-one beings are alike by chance. foldDepth returns `close_not_beyond_null` there, where the old method returned `same` on the strength of the cumulative U, Δ and λ. The sameness of such beings rests on their attributes (Δ, λ), not on their relations.

Not built: the other candidate (the full verdict at each depth, with Δ's displacement profile per depth). It would help limit 2 and cost one profile per depth.

Decision for the user before `same()`'s default changes: if foldDepth replaces the fold stop, a 'close' without null support is either a refusal of the verdict, a verdict decided by Δ and λ alone, or a fourth value ('unsupported', in the organ's own words "a miss is a typed gap, never a guess"). And Δ's neighbour folds need a depth of their own.

**Decision taken (2026-10-25, Claude's recommendation after "what's most aligned"): a typed gap, opt-in.** `same(a, b, world, { lens, fold: 'dmd' })` reads U with `foldDepth` and adds a fourth verdict, `unsupported`: U is close but no closer than chance when the relations are destroyed. Δ and λ do not decide in that case, for the reasons the thread already measured: λ's null is 0 (vacuous on 259 of 262 filer pairs) and Δ's floor is a median rank cut, so the two weakest conjuncts carrying the verdict repeat the loose-conjunct false-`same` of the filer probe (234 of 4,262), and the organ's own law is "a miss is a typed gap, never a guess". The default is unchanged (`fold: 'cumulative'`); the dense-ground duplicate is `same` by default and `unsupported` under `fold: 'dmd'` (`same-dmd.test.mjs`, identity suite 80 of 80). Δ still uses its own `foldNull`/`estimateNull`: a Δ conclusion that survives exhaustion is not built, and against the whole a jammed ground returns "nothing is distinct" for everyone, so it needs a jam test, not just a depth.
