# RESULT: PREREG-UNIVERSES (stamp in PREREG-UNIVERSES.md.sha256short), run 2026-11-20, one run per group, LinES+ParTUT REUSED, EWT dev and GUM dev DEV. Logs: ~/Documents/janus-experiments/universes-{fresh,dev}.log
| | LinES+ParTUT | EWT dev | GUM dev |
|---|---|---|---|
| complete sentences (of those with a fork) | 317 of 469 | 366 of 476 | 411 of 542 |
| M1 gold universe present | 78.9% | 75.4% | 75.7% |
| best single arm (teacher exact on forked tokens) | 74.4% | 71.3% | 74.5% |
| M2 top-weight universe is gold: UNIV / SHUF twin / UNIFORM twin | 40.7 / 43.8 / 59.0 | 35.5 / 43.4 / 53.3 | 34.5 / 45.5 / 56.4 |
| mean log2 weight of gold universe: UNIV / UNIFORM | -5.33 / -5.32 | -5.98 / -5.92 | -6.00 / -5.96 |
| M3 Q-FAM invariant share; right vs teacher on the same | 85.8%; 96.7 vs 98.2 | 82.6%; 93.3 vs 97.5 | 83.1%; 96.4 vs 98.2 |
| M3 Q-SUBJ invariant share; right vs teacher on the same | 76.0%; 85.5 vs 89.6 | 76.8%; 85.4 vs 92.2 | 75.2%; 85.8 vs 90.9 |
| M4 valid universes median / p95; pruned by validity | 2 / 8; 22.5% | 2 / 8; 23.9% | 2 / 8; 31.1% |
Falsifiers: U1 HIT (reach gain 4.5, 4.1, 1.2 points, under 10). U2 HIT (UNIV below the shuffled-label twin; mean log2 weight equal to uniform). U3 HIT (invariant answers are LESS precise than the teacher's on the same questions, though 75 to 86% are invariant). U4 not hit (median 2). U5 not hit (validity prunes 22 to 31%).
Reading, stated plainly: universes as built here do not beat committing to the teacher. Forking at |margin| < 1 bit means every fork has near-even weights, so the weights are not evidence (U2). The gold universe is present only slightly more often than the teacher's tree; the 21 to 25% that are absent are probably valid-tree failures from the non-forked tokens (not verified here). What did work as structure: validity pruned a quarter of combinations, the idea stays cheap (median 2 universes), and about 80% of relation-family questions do not depend on the choice. What did not: invariance is not a competency signal, because invariant answers are worse than just trusting the teacher.
Defect found in my own design, reported not hidden: the UNIFORM twin breaks ties toward mask 0 (all-teacher), so its top-1 (53 to 59%) is a teacher baseline, not a random one; it overstates that twin. This does not change U2, which is judged against SHUF.
What would change the answer: weights that carry real evidence (the priors tell the structure, not the lexical attachment, per PREREG-PRIOR-COLLAPSE), e.g. a competency signal or a lexical prior, and downstream questions that really span forked tokens. Nothing here is a claim about creoles.
