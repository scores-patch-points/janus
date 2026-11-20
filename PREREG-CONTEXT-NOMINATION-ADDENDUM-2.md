# ADDENDUM-2 to PREREG-CONTEXT-NOMINATION (sha 60432a15020910ad; ADDENDUM-1 sha bb100ba8bdd8d76d): what the DEV runs changed, declared BEFORE FRESH-2 is read or scored
Written 2026-11-19/20 by the Janus session. The parent and ADDENDUM-1 are unchanged. DEV numbers are NOT claimed; they decided only the items below. Stamp: sha256 of this file, first 16 hex, in PREREG-CONTEXT-NOMINATION-ADDENDUM-2.md.sha256short.

## 1. What DEV showed (30 documents, 58 ZERO-CLEAN gold; not claimed)
- N1 and N3 (the paraphrase query) cannot be built when the name appears in no sentence of the document: 30 of the 58 ZERO-CLEAN gold sentences belong to such queries. On them N1 and N3 score 0 by construction, while the bare name still scores 0.500. Where a paraphrase could be built (28 gold) N3 scored 0.500 against N0's 0.214 and N1 0.429 against 0.214 (an unjudgeable stratum on its own, under 30 gold).
- So the pooled ZERO-CLEAN comparison of N1, N2 or N3 with N0 mixes two regimes, and the pooled F1 hit on DEV (N2 0.310 against N0 0.362) is largely the no-query half.

## 2. Declared changes (nothing else changes)
a. DIAGNOSTIC splits reported beside every stratum: ZC_QUERY (ZERO-CLEAN gold whose query has at least one name-bearing sentence) and ZC_NOQUERY (none). A split under 30 gold is UNJUDGEABLE and is reported as a count only.
b. NEW ARM N5 (a fallback rule, fixed here): N5 = N3's ranking when a paraphrase query can be built, otherwise N0's ranking. The same exclusion of name-bearing sentences applies.
c. NEW FALSIFIER F1b: N5 does not beat N0 on ZERO-CLEAN by 0.05 recall@10 with a document-bootstrap interval above 0 (the threshold and interval of F1). F1 is KEPT AS WRITTEN (best of N1, N2, N3 against N0), and is expected to be hit again for the reason in section 1; that expectation is stated now and is not a result.
d. F2 and F6 also apply to N5: its target-swap control is N3's swap control where a query exists and N0's otherwise; F6 is evaluated for the best of N1, N2, N3 and N5 by ZERO-CLEAN recall.
e. U1's embedder arm rule, applied to DEV: the embedder arm among N0, N1, N2, N3 and N5 with the highest ZERO-CLEAN recall on DEV. DEV gives N5 (0.500), so U1 = N5 and M1 interleaved, and `--u1 N5` is the frozen setting.

## 3. Unchanged and still binding
Every other arm, control, threshold, stratum rule, the exclusion rule, the freeze procedure and "FRESH-2 is read once". The claim "a meaningful spread of context nominates better" requires, for the arm that makes it (N5 or N3), that F1 or F1b is NOT hit (F1 as written covers N1 to N3, F1b covers N5) and that F2 and F5 are NOT hit for that arm. M1's F2 was hit on DEV (target-swap ratio 0.62); that is a prediction to check, not a result.

## 4. What this still does not claim
That nomination is sameness; anything about pronouns, other languages or other documents; that a fallback to the bare name is a context result (N5's gain, if any, is the context arm where a query exists and the baseline where it does not, and the split in 2a says which half carries it).
