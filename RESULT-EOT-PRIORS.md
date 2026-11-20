# RESULT: PREREG-EOT-PRIORS (stamp in PREREG-EOT-PRIORS.md.sha256short), run 2026-11-20, one run per group. LinES+ParTUT REUSED, EWT dev and GUM dev DEV. Logs: ~/Documents/janus-experiments/eotpriors-{fresh,dev}.log. Sources: GOLD 23,858 sentences (353,992 EOT records); SILVER-AGREED 361,905 of 439,783 teacher arcs (82%) agreed by our parser and kept. Every record went through khora toEot.
Precision on collapsed reachable tokens at margin m = 1 (coverage in brackets); always-teacher on the same tokens beside it.
| | LinES+ParTUT | EWT dev | GUM dev |
|---|---|---|---|
| STRUCT (the five structural priors) | 63.0 (74.5%) | 60.0 (77.6%) | 61.3 (75.0%) |
| SURFACE (strings) | 67.5 (12.6%) | 68.9 (13.1%) | 67.9 (12.5%) |
| EOT-GOLD | 64.0 (64.3%) | 66.0 (66.3%) | 67.1 (64.9%) |
| EOT (gold + silver-agreed) | 65.4 (68.5%) | 66.5 (69.2%) | 67.8 (70.1%) |
| COMBINED (STRUCT + EOT) | 65.3 (87.4%) | 64.4 (88.2%) | 64.7 (87.2%) |
| EOT-SHUF twin | 62.2 (69.6%) | 64.6 (69.2%) | 65.4 (70.5%) |
| always-teacher, same tokens | 79.7-79.8 | 79.7-80.1 | 84.1-85.0 |
At full coverage (m = 0): STRUCT 61.9 / 59.0 / 59.5; SURFACE 56.4 / 57.4 / 58.7; EOT 65.3 / 66.3 / 67.4; always-teacher 79.9 / 79.3 / 84.2.
Veto at m = 1 (the arm prefers OURS): ours right EOT 27.4 / 29.1 / 23.0%, COMBINED 27.4 / 27.4 / 20.3%, SURFACE 39.6 / 48.0 / 36.3%.
Falsifiers: L1 (COMBINED over STRUCT by 3): mixed: +2.3 on LinES+ParTUT (hit), +4.4 and +3.4 on the dev sets (not hit), each with higher coverage. L2 (EOT over SURFACE by 2): HIT at m >= 0.5, as SURFACE is 2 points more precise but abstains on 87% of tokens (a trade); at full coverage EOT is 9 points above SURFACE. L3 (EOT over its shuffled twin by 5): HIT in all three (+3.2, +1.9, +2.4). L4 (EOT over EOT-GOLD by 1): mixed (+1.4 not hit; +0.5, +0.7 hit): past confident readings add about a point. L5 (beat always-teacher): HIT everywhere, by 12 to 17 points. L6 (veto above 50%): HIT everywhere.
Reading, stated plainly: content-bearing priors mined through EOT raise the full-coverage choice from about 60% to about 65-67% and the collapse coverage, and they beat strings at full coverage, but they still cannot replace the teacher (80-84%) and still cannot find the teacher's errors (ours right 20-29% where they prefer ours). The silver readings add about a point. The shuffled twin keeps most of the gain (relation labels permuted, but the lexical context kept), so most of the lift comes from lexical co-occurrence in general, not from relation-specific content: my twin was weaker than intended and L3's reading is limited by that. Unmeasured and stated as a hypothesis: most delta tokens have contexts unseen in 360k arcs (SURFACE abstains on 87%); the lexical tables are too sparse, so generalising by kind (Janus's induced kinds) rather than by lemma is the next thing to try, not a result here.
Nothing here is a claim about creoles; standard English, three sets, one run.
