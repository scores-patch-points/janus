# RESULT (label FRESH for LinES and ParTUT: fresh for every arm; PUD: fresh for our parsers only): PREREG-PARSE-LIBRARIES (stamp 02c3fbc2bddf0d59), frozen by FREEZE-PARSE-LIBRARIES.md, read once on 2026-11-20
Gold tokenization handed to every arm. Stanza 1.15.1, English combined_charlm (pos, lemma, depparse); our arms are the frozen POOL, BLEND, EWT, GUM. Bootstrap by document (ParTUT has no document ids: by sentence).
| arm | LinES UPOS/UAS/LAS | ParTUT UPOS/UAS/LAS | PUD UPOS/UAS/LAS (Stanza trained on PUD: not a fair test for it) |
|---|---|---|---|
| POOL | 93.4 / 84.3 / 78.4 | 91.7 / 85.6 / 79.2 | 95.4 / 85.9 / 82.1 |
| BLEND | 93.1 / 84.1 / 78.1 | 91.3 / 84.9 / 78.7 | 95.2 / 85.6 / 81.6 |
| EWT | 92.8 / 82.6 / 76.1 | 92.3 / 84.0 / 77.7 | 94.6 / 84.0 / 79.8 |
| GUM | 92.6 / 82.8 / 76.7 | 89.7 / 84.1 / 77.8 | 94.8 / 84.7 / 80.6 |
| STANZA | 94.3 / 90.0 / 85.2 | 92.4 / 92.1 / 86.2 | 98.0 / 96.2 / 94.5 (inflated) |
| ENS_LIB (MBR of POOL, BLEND, STANZA) | 93.5 / 85.6 / 80.1 | 91.9 / 86.4 / 80.2 | 96.0 / 88.3 / 84.9 |
Falsifiers: L1 NOT hit (STANZA minus POOL LAS +6.77 [+6.01, +7.44] on LinES, +7.05 [+5.50, +8.64] on ParTUT). L2 NOT hit: POOL's error rate where STANZA agrees on (head, relation) is 9.9% of 17,436 tokens, where it disagrees 85.2% of 3,176 (ratio 8.63; the constant 2 is ours and arbitrary). L3 HIT: ENS_LIB minus STANZA is -5.08 [-5.88, -4.36] and -6.00 [-7.60, -4.47]: a majority vote of two weak parsers and one strong one is worse than the strong one.
Reading, per the pre-registered rule: the library earns a place as a codec SOURCE (L1) and as a SECOND EYE (L2); layering by majority vote does not (L3): use the library as the primary reading or as a teacher, and our parsers as the eye that is checked, never as voters that outvote it.
Context: on these treebanks even Stanza's UPOS is 92 to 94 and its LAS 85 to 86, below its figures on EWT and GUM dev (89 to 91, possibly contaminated): cross-treebank conventions cap every arm, so 0.95 LAS is not a realistic number for this protocol; the gap to our parsers (about 7 points of LAS) is the real finding. Limits: English; gold tokens given; one library; our parsers are the older perceptron family; PUD is reported, not judged.
