# PREREG-FORGING-COST-STRUCTURE: does a frame built on relational structure cost more to forge than the surface frames, and keep its true pairs?
Written 2026-11-19 by the Janus session, BEFORE any run. Nothing here is measured. Owner of the data and the harness: the Penelope session (experiments/zero-overlap). Stamp: sha256 of this file, first 16 hex, in PREREG-FORGING-COST-STRUCTURE.md.sha256short. Any change after seeing data is an ERRATUM file, never an edit.

## 1. Why this, and what is already known (ledger rows, not re-measured here)
- Row 8 / RESULT-COST: median tokens to forge a pass: numerals 1, overlap 2, relations 2, usage 5. Accuracy and forging cost run in opposite directions: overlap TP 0.93/0.94 is among the cheapest to forge; usage is the dearest to forge but TP 0.37/0.41. An AND-ladder of the three forged within 10 tokens for 53% (fr) / 45% (de), TP 0.17/0.19. "The fix is not a better combination; it is a frame whose cost to forge is high for a reason."
- RESULT-ADV: numerals price 3 tokens, copy names 10, licensed partners > 30 (FA 0.4+ at k=30). "Not claimed: that any ground/relations-type frame resists forging (untested)."
- Row 27: an informed impostor (a date-like parenthesis prepended) is judged equivalent for 1.000 of verdict-bearing trials. No surface identity dimension survives it.
- Row 18 / holarchy3: the CHAIN (a candidate is in the best-matching region set AND the areas agree) had de TP 27/41 = 0.659, natural suitor FA 11/1763 = 0.0062, against area alone TP 1.000, FA 0.123. The chain has never faced an informed adversary.
THE QUESTION: is the chain's low natural FA a property of structure (hard to forge) or only of there being two cheap keys instead of one?

## 2. Frames compared (all must be run on the SAME pairs and the SAME adversary budget)
A. numerals alone (area or a birth/death year agreeing): the known cheapest.
B. region-membership alone (the candidate's container is among the best-matching region sets).
C. the chain B AND A (holarchy3's rule), unchanged.
D. the chain with a CONSISTENCY requirement: at least two independent structural claims about the candidate must agree with the claimant's (region AND a second container or a second dependency relation), a candidate with only one is a gap, not a pass.
The rule of each frame is fixed before the run and frozen; no threshold is tuned on the adversary arm.

## 3. The adversary (informed: has the claimant's text, the frame definitions and the extractor's behaviour)
It may append up to k tokens to the SUITOR's text (never alter the suitor's own text), k in {3, 10, 30}. Strategies, all declared:
 s1 copy numerals; s2 copy the container phrase; s3 both (the structure-aware attack the first arm lacked);
 s4 FLUENT: one grammatical sentence stating the region and the area (the first arm's tokens were stuffed, not fluent; RESULT-ADV caveat), written from a fixed template by the attacker, never from the suitor's own text;
 s5 against D: s3 plus a second container claim.
Report for each frame x strategy: FA_adv at k = 3, 10, 30, and PRICE = the smallest k with FA_adv > 0.5 (">30" if none).

## 4. Measures, always with Wilson 95% intervals
TP (true pairs passed), natural FA (suitors, k = 0), FA_adv, price, coverage (pairs with a verdict), and the share left silent. A pair with no container or no area is a GAP, counted, never passed and never failed.

## 5. Falsifiers, written now
F1 (structure buys nothing): PRICE(C) <= PRICE(A) + 3 on either language. HIT means the chain is no harder to forge than area alone.
F2 (cheap in the open): FA_adv(C, s4, k = 10) >= 0.5 on either language.
F3 (robustness bought by losing the true pairs, the AND-ladder's failure): TP(C) < 0.5 or TP(D) < 0.2 on either language.
F4 (D adds nothing): PRICE(D) <= PRICE(C) on either language.
The frame "resists forging for a reason" only if NONE of F1, F2, F3 is hit for it. A single hit is a finding and is reported as such; a negative result is not a failure of the study.

## 6. Constraints from the owner (no regex in DEF; the Janus session's rule)
- Container and area extraction MUST come from the dependency-rows-to-claims path (claims-from-rows.mjs over khora's UD parser prior), not from regex. Where the reader has no prior for a language (today fr and de), that language is a typed gap and is NOT run with a regex fallback. If that leaves English only, the run uses name-free same-language pairs (the smoke pairs) and says plainly that it is not a cross-language result.
- The earlier holarchy regex extractor may be run ONLY as a labelled comparison arm ("regex extractor"), never as the arm the conclusion rests on.
- Report which pairs are silent because extraction produced no claim (coverage), separately from pairs judged.

## 7. Data and labels
F1 to F4 have been read (EXPLORATORY). Any number labelled FRESH needs a set no earlier row has scored; splits.json decides, and the ledger checker (gym/ledger-check.mjs) must pass. State the pair counts before scoring. One run on the held set; no second look.

## 8. What this does NOT claim
That any frame decides same or other. Only whether a structural frame is dearer to forge than the surface frames, at what cost in true pairs. An informed impostor who can append fluent text may still forge everything; if F1 or F2 is hit the conclusion is that static text cannot carry the proof and a live probe (ask, wait for the answer; the bed) is needed.
