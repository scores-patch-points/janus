# RESULT (label: REUSED-DOCUMENTS): the frozen ADDENDUM-4 EOT arms, run once on the 60 FRESH-2 articles (read earlier for context nomination, so NOT a fresh read for this task)
Run 2026-11-20 after the owner's "go", with the freeze files in place (FREEZE-CLAIM-GRAPH-UNIVERSE-ADDENDUM-4.md). Data: eot-fresh2.json (60 documents, 195,003 EOT content nodes, 9,511 classes, 20,270 anaphors with candidates, 0 misaligned sentences). Gold: DISJOINT 462 pairs (judgeable); the GROWN_DISJOINT stratum 435.
| arm (recall@10, DISJOINT) | FRESH-2 (reused) | DEV (debug) |
|---|---|---|
| A0 bare anchor lemma set | 0.489 | 0.413 |
| VG void-gated universe | 0.461 | 0.386 |
| VGB with bindings | 0.177 | 0.163 |
| VGR reached-first | 0.338 | 0.288 |
| NG ungated | 0.429 | 0.370 |
| ADJF adjacency | 0.323 | 0.299 |
| T_VG strings twin | 0.117 | 0.114 |
| VG_RAND random-edge twin | 0.459 | 0.386 |
Falsifiers on DISJOINT: H1 H2 H3 H4 H4b H5 H6 H7 HIT; H9 not hit. VG grew past the class's own sentences for 17 of 846 queries (VG_RAND 11); bindings widen reach to a mean 61 classes per query. Admits: A0A 0.405 vs A0 0.489 (K1 HIT), vs shuffled kinds 0.409 (K2 HIT), VGA 0.396 vs VG 0.461 (K3 HIT); 56% of classes placed; 54 of 488 gold pairs with both placed are refused (0.11, K4 not hit).
Reading: the result replicates DEV on documents not used to build the arms. No structural arm beats the bare label; the void-gated universe is the class's own sentences in 98% of queries, so it cannot differ from its random twin; the claim-graph universe, as the reader's identity relations give it, does not nominate aliases better than the label. Not tested: pronoun resolution in EOT (bindings are listed, none chosen); a truly fresh set. Limits: English, one parser prior, the embedder is a given.
