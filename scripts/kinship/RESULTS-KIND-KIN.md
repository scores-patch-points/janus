# RESULTS KIND-KIN — the kind-induction arm on the fresh window, scored once

Written after the run. PREREG-KIND-KIN.md (sha256 `41211593d4a7a8b96b5b3fe83b7b6aa345a019117224a7f0d94f7a6001e8182e`), its addendum 1 (the window, chosen by the registered rule R1; sha256 `75c8599a…`) and addendum 2 (the gold; sha256 `decc96c178099ec09193af024c3d1cf06f1156821fb87c9f96c3f36b7d809735`) were sealed before it; nothing in the arm, the scorer or the gold changed after (code frozen at commit 89fe769: kind-kin.mjs `0a973ca7…`, score-kind-kin.mjs `0d32859b…`).
The gold (`gold-kind-window4.json`, sha256 `a7ca6c18346c3e22f1ae70d744952e9494b0fb8c8d3d12e58702a49ab7ae9809`) is a self:model opinion made by a separate model context. Every number is read from `kin-binder-gold/results-kind-window4.json` (sha256 `3f372fc0b5bb2602ede2c1e00706c16ba47b4865aad63cf4e981aaaf7ebd3571`). No model is called by the arm or the scorer.

## Headline

- **The registered arm does NOT clear its bars.** B1 FAIL, B3 FAIL; B2, B4, B7, B9, B10 pass; B11 unassessed; B5, B6, B8 pass. "CLEARED" is not said. Nothing is fed to the composer or to any answer.
- **B1 misses by 0.10.** K ties 37 ends on the 63 unbound statements and 21 are right: precision 0.568 against the declared 2/3, above all three chance controls (p95 0.314, 0.270, 0.135) and above the scene model's 0.466 on the same window and gold (S3: 58 ends, 27 right) and above the arm without the kind gate (KG0: 44 ends, 19 right, 0.432).
- **The induced kind matters here (B10 passes).** The shuffled-kind control (the kind records permuted among the beings, the same rules and gates) has mean precision 0.271 and 5.2 correct ends (p95 0.476 and 12); K has 0.568 and 21. The registered prediction said B10 would fail, as it did on the fit set and as the scene model's control did; it passed.
- **Two-ended facts: 8 emitted, 3 right (0.375; bar 0.5).** B3 FAIL, though 3 is more than the plain arm's 0 and fact precision is above all three nulls (p95 0.2, 0.2, 0). S3 emits 12 facts and 3 are right (0.25).
- **Polarity is unassessed and the one reading was wrong.** The gold holds 57 affirmed, 1 former and 6 other statements, none negated; K read one statement negated (the gold says affirmed) and withheld no fact. The polarity rules read negation, absence and 'former' cues; the gold's six `other` (a wish, a question, a comparison) are not a reading they make. B11 is unassessed by the rule as registered (K reads fewer than 3 not affirmed).
- **The ceiling.** The labeller names a being for 96 of 128 ends and both ends of **40 of 64 statements** (21 with no forward reference); K's correct two-ended facts are **3 of the 40**. 32 gold ends are named in another paragraph of the scene and 40 before the kin word's sentence: K reaches 0 of each; the 18 it gets right in the kin word's own sentence and 3 only-later ends are what it can read without a scene.

## The window

Chosen by the registered rule R1 at its first candidate (block 80; R2 was not applied): full-text lines 23717 to 23988, 63,231 bytes, headings XII to XV, 132 narrative paragraphs, 64 statements (plain categories N 57, P 4, H 2, A 1). The reader's ledger has 55 beings (183 referents). The store's verdict on the beings' written forms: name 24, common 3, unknown 28. The induced kinds: 11 persons (9 with a sex), 5 anchored by the page layer's own ties.
The gold: 8 scenes; of 128 ends 96 bound (scene 32, subject 24, discourse 17, pronoun 11, apposition 5, reflexive 4, deictic 2, genitive 1; identified before the kin word 40, in its sentence 33, only later 23) and 32 null (unnamed 20, generic 6, not_in_ledger 6); 3 ends flagged doubtful; polarity affirmed 57, former 1, other 6.

## Arms (ends over the 63 unbound statements; the gold binds 94 of their ends)

| arm | ends bound | right | precision | recall | facts | facts right |
|---|---|---|---|---|---|---|
| PLAIN (category A only) | 0 | 0 | — | 0 | 0 | 0 |
| T2 (the page layer) | 11 | 2 | 0.182 | 0.021 | 1 | 0 |
| S3 (the scene model, scene-model-5's arm) | 58 | 27 | 0.466 | 0.287 | 12 | 3 |
| **K (registered)** | **37** | **21** | **0.568** | **0.223** | **8** | **3** |
| KG0 (K without the kind gate) | 44 | 19 | 0.432 | 0.202 | 12 | 2 |
| KP0 (K reading no polarity) | 37 | 21 | 0.568 | 0.223 | 8 | 3 |

Controls (over the 37 ends K binds; seed 20261029, 1000 draws): C1 chance in the paragraph-and-one-before pool: precision mean 0.213, p95 0.314, recall p95 0.117, fact precision p95 0.2; C2 deranged ends: precision p95 0.270, fact precision p95 0.2; C1K chance among the 11 person-kind beings: precision p95 0.135, recall p95 0.053, fact precision p95 0;
C3 swapped ends: 4 of 37 right (0.108); SK shuffled kind: precision mean 0.271, p95 0.476, max 0.583; correct ends mean 5.2, p95 12, max 21; fact precision p95 0.25.

## Bars (as registered)

| bar | result | numbers |
|---|---|---|
| B1 end precision above the three chance controls and 2/3 | **FAIL** | 0.568; null p95 0.314 (passes); budget 0.667 (misses); 37 bound |
| B2 more correct ends than the plain arm, recall above the person-kind chance | **PASS** | 22 against 0 (over all statements); recall 0.223 against C1K p95 0.053; 94 gold-bound |
| B3 fact precision at least 1/2, above the nulls, more correct facts than plain | **FAIL** | 3 of 8 (0.375); null p95 0.2; correct facts 3 against 0 |
| B4 every fact witnessed, giver text:ru\|rule:…, candidate, ledger beings | **PASS** | 8 of 8 on each check |
| B5 determinism | **PASS** | scorer twice identical (sha256 93acd86d…); the arm twice identical (17ad27d6…); two CLI runs of kind-kin.mjs byte-identical (sha256 a4f54465…) |
| B6 nothing existing changed | **PASS** | the branch adds 48 files to main and changes none (27 on top of the scene-model PR's head); the test file pins the page layer, the first binder, the extractor, kinship.js, the scene model and its scorer by sha256 |
| B7 every unbound end a typed gap | **PASS** | 90 gaps, all of a kind of kinship.js and a reason of the closed set; 64 of 64 statements match |
| B8 no model, no network, no typed polarity word | **PASS** | the test shows the imports and that none of «не», «нет», «без», «ни», «бывший» is a string of the arm |
| B9 the swapped-ends mutant falls below the threshold | **PASS** | C3 0.108 against 0.667 |
| B10 the shuffled-kind control is beaten | **PASS** | precision 0.568 against SK p95 0.476; correct ends 21 against SK p95 12 |
| B11 polarity read | **UNASSESSED** | gold not affirmed 7 (1 former, 6 other); K reads 1 not affirmed (negated), 0 of them the gold's; no fact withheld; fewer than 3 read |

Repository checks (janus has no CI workflows): every `*.test.mjs` with `node --test`: 257 tests, 257 pass, 0 fail (the branch adds the 10 tests of `kind-kin.test.mjs`).

## What reached which ends (K, over the unbound statements)

| rule | ends bound | right |
|---|---|---|
| K-SUBJ (the nearest person-kind clause subject before the kin word) | 19 | 15 (0.79) |
| K-OTHER (the one other person-kind being of the sentence or paragraph) | 6 | 4 |
| K-CONV (a converse of a tie the page layer made in the window) | 1 | 0 |
| P-REFL (the page layer) | 3 | 2 |
| P-GEN, P-PRON3, H-APP-DET, H-PRED (the page layer) | 3, 2, 2, 1 | 0, 0, 0, 0 |

By the gold's licence kind (gold-bound ends, K right): subject 24 (14), discourse 17 (4), pronoun 11 (1), apposition 4 (0), reflexive 4 (2), deictic 2 (0), **scene 32 (0)**. By where the identifying mention stands: same sentence 31 (18), **before 40 (0)**, only later 23 (3).
The typed gaps K leaves (90): no marker, the page layer's gap kept, 42 (the gold names a being for 29); no person-kind subject 24 (18); no holder candidate 9 (8); kin word inside speech 7 (5); ambiguous 2 + 2; one referent for both ends 1.

## Reading it

1. **The arm's own rules are precise; the page layer's ties are what pull it under 2/3.** K-SUBJ is right 15 of 19 and K-OTHER 4 of 6; the page layer's ties that K keeps are right 2 of 11 on this window (P-GEN, P-PRON3, H-APP-DET and H-PRED are all wrong: 0 of 8). Post-hoc, not registered, not a pass: K's own rules alone are 19 right of 26 (0.73). The registration kept the page layer's ties because they were precise on every earlier window (0.82 to 0.93); on this one they are not, and the arm inherits that.
2. **The induced kind does work the shuffled control can see.** Same rules, kinds permuted among the beings: 5 correct ends on average against K's 21. The kind gate over the whole arm: KG0 (no gate) ties 44 and 19 are right (0.432); K ties 37 and 21 are right (0.568): fewer ties and more right ones.
3. **Against the scene model on the same window and gold:** K ties fewer ends (37 against 58) and fewer right (21 against 27), more precisely (0.568 against 0.466); both emit 3 correct facts, K from 8 and S3 from 12. Neither clears B1 or B3; K clears B10 and S3 did not clear it on its own window.
4. **Nothing before the kin word's own sentence is reached.** 40 gold ends have their identifying mention in an earlier sentence and 32 are named in another paragraph of the scene; K gets none of them. A scene-free arm cannot reach those, and the scene model that tried reached 1 of 44 on its window: whatever reaches them is neither.
5. **Polarity is not measured by this window.** It holds no negated kin statement; K's single reading (a negated reading the gold calls affirmed) is a false reading, and the gold's six `other` statements show a class (wish, question, figure) the cue rules do not read. A window with negated kin statements, and cues for `other`, would be needed; neither is started.
6. **The fit did not predict the fresh window.** Fit precision (page-lens and scene-lens golds, four windows): K 0.791, S3 0.624; fresh: K 0.568, S3 0.466. Both fall by about 0.15 to 0.22; the order is the same.

## Not claimed

That a bound end is true; that the gold is right (one separate model context's opinion: it binds 96 of 128 ends); that the ledger's referents are right; that the hyperlexicon holds converse, sex or generation rows for kin terms (it does not; the arm takes them from the givers' glosses); that the polarity cues are complete; that a different kind induction would not do better; that anything here changes a reading, a verdict or a weight.
