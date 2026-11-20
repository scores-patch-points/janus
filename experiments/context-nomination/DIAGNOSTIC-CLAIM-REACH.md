# DIAGNOSTIC (EXPLORATORY, DEV only, no arm, nothing scored): how far can a claim-and-binding universe reach on the row-30 zero-overlap gold?
Script: claimreach.mjs (the reader's rows from khora-pharos-reading, Janus's binding-evidence). 30 DEV documents, 150,467 reader rows, 58 ZERO-CLEAN gold. Written 2026-11-20. The question behind it: REFERENT-FIRST rule 4 says most of this gold is label-to-page knowledge; how much of it could ANY structural universe connect to the target from the document alone?
| ZERO-CLEAN gold (58) | count |
|---|---|
| the name appears in NO sentence, and the reader finds no contiguous mention either: the claim graph has no handle on the target (ZC_NOQUERY) | 30 |
| the name appears somewhere (ZC_QUERY) | 28 |
| ... within 1 sentence of a name-bearing sentence | 8 |
| ... within 3 sentences | 10 |
| ... whose sentence holds an anaphor (a pronoun or a definite description, which is almost every sentence: a weak signal) | 25 |
| ... with a POSSIBLE bond to the target (an anaphor whose binding candidates include it, number not a mismatch), window 3 sentences | 5 |
Sensitivity of the last row to the window (an ARBITRARY CONSTANT here, reported as one): window 3: 5 of 28; 6: 7; 12: 8; 30: 11 (6 of them farther than 3 sentences from any name-bearing sentence). So at most 11 of 58 (19%) of the ZERO-CLEAN gold have even a POSSIBLE structural bond to the target, and "possible" is weak: the candidate lists are large (about 16 per anaphor at window 3).
Reading: a claim-graph universe cannot test the principle on this gold. For 52% of it (30 of 58) the target has no mention to grow from, and for the rest the structure reaches a minority. The experiment that tests the principle needs tasks where the DOCUMENT holds the evidence: pronoun and description binding with coreference gold, same-versus-other with claims on both sides, explicit alias statements. Limits: DEV only; one reader (English, a parser prior); the target's mentions are found by a contiguous stemmed name match, so a name that appears only as a variant is missed; "possible bond" is a necessary condition, not an accuracy.
