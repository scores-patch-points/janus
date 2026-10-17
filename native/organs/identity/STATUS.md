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
