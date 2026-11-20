# RESULT: FRESH-2, scored ONCE under the frozen protocol (PREREG-CONTEXT-NOMINATION 60432a15020910ad; ADDENDA bb100ba8bdd8d76d, 5656df8cce491466, 3ecafc4c8fec0d3d; FREEZE published before the read). Label: FRESH.
Files: results-fresh2.txt (the full printed report), results-fresh2.json (per document counts). Nothing was re-run; a second scoring would be REUSED. The Penelope session decides any ledger row.
Set: 60 documents (Featured articles, positions p mod 50 = 11), 0 titles overlapping the earlier sets. Gold: ZERO-CLEAN 122 (ZC_QUERY 43, ZC_NOQUERY 79), ZERO 136, DIFFERENT 296, NAMEFREE 565. Every stratum above is judgeable (30 or more gold).

## recall@10 on ZERO-CLEAN (null 0.055)
| arm | ZERO-CLEAN | ZC_QUERY (43) | ZC_NOQUERY (79) |
|---|---|---|---|
| N0 bare name (baseline) | 0.205 | 0.140 | 0.241 |
| N1 / N3 profile query | 0.107 | 0.302 | 0.000 |
| N2 neighbours | 0.172 | 0.163 | 0.177 |
| N5 context where a query exists, else bare name | 0.262 | 0.302 | 0.241 |
| M1 mechanical word fold | 0.205 | 0.256 | 0.177 |
| N6F DMD-bounded universe where seeds exist, else bare name | 0.238 | 0.233 | 0.241 |
| T6F its strings-only twin | 0.205 | 0.140 | 0.241 |
| PROXF locality only | 0.205 | 0.140 | 0.241 |
| U1 = N5 + M1 | 0.279 | 0.256 | 0.291 |

## falsifiers (thresholds as pre-registered)
- F1 (best of N1-N3 vs N0): N2 0.172 vs 0.205, diff -0.033 [-0.107, +0.035]: HIT.
- F1b (N5 vs N0): +0.057 [-0.029, +0.144]: HIT (the interval includes 0).
- F1c (N6F vs N0): +0.033 [-0.030, +0.099]: HIT (expected, ADDENDUM-3).
- F7 (N6F vs its twin T6F): +0.033 [-0.007, +0.074]: HIT. F8 (N6F vs locality PROXF): +0.033 [-0.009, +0.080]: HIT.
- F2 (target-swap ratio 0.5 or more = topical, not referent-tied): HIT for N1 (1.00), N2 (0.62), N3 (0.85), N6 (0.90), M1 (1.04); not hit for N5 (0.25) and N6F (0.34).
- F3 (M1 vs the random null): M1 0.205 vs 0.055, +0.150: not hit. F4 (U1 vs its best member N5): +0.016: HIT. F5 (N1 vs a same-length shuffled-frequent query): 0.107 vs 0.016, ratio 0.15: not hit. F6 (precision): not hit.
- Hop reached by the stopping rule (tau 0.8): 1: 105, 2: 279, 3: 235, 4: 149, 5: 46, 6: 20; 10 of 834 not stable by HMAX.

## what this does and does not support
- The claim "a meaningful spread of context nominates better than the bare name" is NOT supported as pre-registered: F1 and F1b are hit. N5's direction is positive (+0.057) but its interval includes 0 at 122 gold.
- Where a profile query CAN be built (ZC_QUERY, 43 gold, judgeable but a diagnostic split), the profile query is about twice the bare name (0.302 vs 0.140), and F5 shows it is not query length. In 79 of the 122 ZERO-CLEAN gold the name never appears in any sentence, so no profile query exists and the bare name's embedding prior is all there is: the paraphrase arms are 0 there by construction.
- F2 says most arms retrieve the document's topical neighbours about as well as the true referent's profile does: the signal that is tied to the referent is weak. N0 itself has swap ratio 0.48.
- The DMD-bounded arm on adjacency (N6) did not pass its pooled controls (F1c, F7, F8, all expected). Its DEV reading, "adjacency is locality", is NOT replicated within ZC_QUERY: N6 0.233 vs twin 0.140 and locality 0.140. That split is a diagnostic and was not pre-registered as a test; it is a lead for the claim-graph experiment, not a result.
- M1, the model-free word fold, beats the random null (+0.150) but equals the bare name and is topical (F2 ratio 1.04).
- None of this speaks for identity or sameness: these are nominators, and the zero-overlap gold is mostly label-to-page knowledge (REFERENT-FIRST rule 4).
